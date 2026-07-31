/**
 * Game state reducer.
 *
 * Pure, deterministic reduction of an immutable event log into game state.
 * All baseball rules live in ./rules — this file only applies the resolved
 * outcome to the state machine (bases, outs, innings, scoreboard).
 */
import type {
  AbsEvent,
  AdvanceReason,
  Base,
  BatterInput,
  Destination,
  GameEvent,
  GameSetup,
  GameState,
  LoggedPlay,
  PlayEvent,
  RunnerEvent,
  TeamSide,
} from "./types";
import { resolvePlay } from "./rules";

export function emptyBases(): Record<Base, string | null> {
  return { 1: null, 2: null, 3: null };
}

export function createInitialState(setup: GameSetup): GameState {
  const positions = (side: TeamSide) => {
    const map: Record<string, string> = {};
    for (const p of setup[side].players) map[p.id] = p.position;
    return map;
  };
  return {
    setup,
    inning: 1,
    half: "top",
    outs: 0,
    balls: 0,
    strikes: 0,
    bases: emptyBases(),
    score: { away: 0, home: 0 },
    hits: { away: 0, home: 0 },
    errors: { away: 0, home: 0 },
    lineScore: { away: [], home: [] },
    lineup: { away: [...setup.away.lineup], home: [...setup.home.lineup] },
    slot: { away: 0, home: 0 },
    pitcher: { away: setup.away.pitcherId, home: setup.home.pitcherId },
    pitchesThrown: {},
    positions: { away: positions("away"), home: positions("home") },
    playerNames: Object.fromEntries(
      [...setup.away.players, ...setup.home.players].map((p) => [p.id, p.name]),
    ),
    plays: [],
    over: false,
    challenges: { away: 2, home: 2 },
    absLog: [],
    subLog: [],
    ghostRunner: null,
    winner: null,
    runnerState: {},
  };
}

export function battingSide(state: GameState): TeamSide {
  return state.half === "top" ? "away" : "home";
}

export function fieldingSide(state: GameState): TeamSide {
  return state.half === "top" ? "home" : "away";
}

export function currentBatterId(state: GameState): string {
  const side = battingSide(state);
  return state.lineup[side][state.slot[side] % state.lineup[side].length];
}

export function batterAtOffset(state: GameState, offset: number): string {
  const side = battingSide(state);
  const order = state.lineup[side];
  return order[(state.slot[side] + offset) % order.length];
}

function clone(state: GameState): GameState {
  return {
    ...state,
    bases: { ...state.bases },
    score: { ...state.score },
    hits: { ...state.hits },
    errors: { ...state.errors },
    lineScore: { away: [...state.lineScore.away], home: [...state.lineScore.home] },
    lineup: { away: [...state.lineup.away], home: [...state.lineup.home] },
    slot: { ...state.slot },
    pitcher: { ...state.pitcher },
    pitchesThrown: { ...state.pitchesThrown },
    positions: { away: { ...state.positions.away }, home: { ...state.positions.home } },
    playerNames: { ...state.playerNames },
    plays: [...state.plays],
    challenges: { ...state.challenges },
    absLog: [...state.absLog],
    subLog: [...state.subLog],
    runnerState: { ...state.runnerState },
  };
}

function addRun(state: GameState, side: TeamSide) {
  state.score[side] += 1;
  const idx = state.inning - 1;
  const line = state.lineScore[side];
  while (line.length <= idx) line.push(0);
  line[idx] += 1;
}

function ensureInningCell(state: GameState, side: TeamSide) {
  const line = state.lineScore[side];
  while (line.length < state.inning) line.push(0);
}

function endHalfInning(state: GameState) {
  const side = battingSide(state);
  ensureInningCell(state, side);
  const ghost = state.ghostRunner;
  // Preserve the ghost runner's runner state for the next half-inning.
  const ghostState = ghost ? state.runnerState[ghost] : undefined;
  state.bases = emptyBases();
  state.runnerState = {};
  state.outs = 0;
  state.balls = 0;
  state.strikes = 0;
  const regulation = state.setup.innings;
  if (state.half === "top") {
    state.half = "bottom";
    // Home team wins without batting in the bottom half.
    if (state.inning >= regulation && state.score.home > state.score.away) {
      state.over = true;
      state.winner = "home";
      return;
    }
  } else {
    state.half = "top";
    state.inning += 1;
    if (state.inning > regulation && state.score.home !== state.score.away) {
      state.over = true;
      state.winner = state.score.home > state.score.away ? "home" : "away";
      return;
    }
    // Extra innings: teams with no challenges left get one for this inning.
    if (state.inning > regulation) {
      if (state.challenges.away === 0) state.challenges.away = 1;
      if (state.challenges.home === 0) state.challenges.home = 1;
    }
  }
  placeGhostRunner(state, ghostState);
}

/**
 * Extra-innings automatic runner: the player who made the last out of the
 * previous inning (i.e. the batter directly preceding the leadoff hitter)
 * starts at second base.
 */
function placeGhostRunner(
  state: GameState,
  ghostState?: { runnerId: string; responsiblePitcherId: string; tainted: boolean },
) {
  state.ghostRunner = null;
  if (state.inning <= state.setup.innings || state.over) return;
  const side = battingSide(state);
  const order = state.lineup[side];
  if (!order.length) return;
  const runnerId = order[(state.slot[side] - 1 + order.length) % order.length];
  state.bases[2] = runnerId;
  state.ghostRunner = runnerId;
  if (ghostState) {
    state.runnerState[runnerId] = ghostState;
  } else {
    state.runnerState[runnerId] = {
      runnerId,
      responsiblePitcherId: state.pitcher[fieldingSide(state)],
      tainted: false,
    };
  }
}

function checkWalkOff(state: GameState) {
  if (
    state.half === "bottom" &&
    state.inning >= state.setup.innings &&
    state.score.home > state.score.away
  ) {
    state.over = true;
    state.winner = "home";
  }
}

/** Apply runner + batter destinations to the base state and runner-state book. */
function applyMovement(
  state: GameState,
  advances: Advance[],
  batterId: string | null,
  batterTo: Destination | null,
  batterReason: AdvanceReason = "hit",
): { outs: number; scored: string[] } {
  const offense = battingSide(state);
  const next = emptyBases();
  const scored: string[] = [];
  let outs = 0;

  const held = new Set(advances.map((a) => a.from));
  // Runners with no explicit advance hold their base.
  ([1, 2, 3] as Base[]).forEach((b) => {
    const id = state.bases[b];
    if (id && !held.has(b)) next[b] = id;
  });

  for (const adv of advances) {
    const id = state.bases[adv.from] ?? adv.runnerId;
    if (!id) continue;
    if (adv.to === "out") {
      outs += 1;
      delete state.runnerState[id];
    } else if (adv.to === 4) {
      scored.push(id);
      addRun(state, offense);
      delete state.runnerState[id];
    } else {
      next[adv.to] = id;
      if (taintedReason(adv.reason)) {
        state.runnerState[id] = { ...state.runnerState[id], runnerId: id, tainted: true };
      }
    }
  }

  if (batterId && batterTo !== null) {
    if (batterTo === "out") {
      outs += 1;
      delete state.runnerState[batterId];
    } else if (batterTo === 4) {
      scored.push(batterId);
      addRun(state, offense);
      delete state.runnerState[batterId];
    } else {
      next[batterTo] = batterId;
      state.runnerState[batterId] = {
        runnerId: batterId,
        responsiblePitcherId: state.pitcher[fieldingSide(state)],
        tainted: taintedReason(batterReason),
      };
    }
  }

  state.bases = next;
  return { outs, scored };
}

function taintedReason(reason: AdvanceReason): boolean {
  return reason === "error" || reason === "passed-ball" || reason === "catcher-interference";
}

function logPlay(
  prev: GameState,
  ev: PlayEvent | RunnerEvent,
): GameState {
  const state = clone(prev);
  const offense = battingSide(state);
  const defense = fieldingSide(state);
  const outsBefore = state.outs;
  const pitcherId = state.pitcher[defense];
  const pitchCount = state.balls + state.strikes;
  const batterId = ev.type === "play" ? ev.batterId : null;

  // Every scoring decision comes from the rules layer.
  const resolution = resolvePlay(state, ev.input, ev.overrides ?? {});

  if (resolution.isHit) state.hits[offense] += 1;
  state.errors[defense] += resolution.errorFielders.length;

  const batterReason = ev.type === "play" ? batterReasonFor(ev.input) : "other";
  const { outs, scored } = applyMovement(state, resolution.advances, batterId, resolution.batterTo, batterReason);
  state.outs += outs;

  const taintedRuns = scored.filter((id) => state.runnerState[id]?.tainted);

  const logged: LoggedPlay = {
    id: ev.id,
    ts: ev.ts,
    type: ev.type,
    batterId,
    input: ev.input,
    resolution,
    inning: state.inning,
    half: state.half,
    battingTeam: offense,
    slot: batterId ? state.slot[offense] % state.lineup[offense].length : null,
    pitcherId,
    outsBefore,
    runsScored: scored,
    taintedRuns,
    pitchCount,
  };
  state.plays.push(logged);

  if (ev.type === "play") {
    state.pitchesThrown[pitcherId] = (state.pitchesThrown[pitcherId] ?? 0) + Math.max(pitchCount, 1);
    state.slot[offense] = (state.slot[offense] + 1) % state.lineup[offense].length;
    state.balls = 0;
    state.strikes = 0;
  }
  ensureInningCell(state, offense);

  // Half innings switch automatically on the third out.
  if (state.outs >= 3) endHalfInning(state);
  else checkWalkOff(state);
  return state;
}

function batterReasonFor(input: BatterInput): AdvanceReason {
  switch (input.kind) {
    case "hit":
      return "hit";
    case "walk":
      return "walk";
    case "batted":
      return input.errorFielders?.length ? "error" : "fielders-choice";
    case "catcher-interference":
      return "catcher-interference";
    case "dropped-third":
      return input.cause === "passed-ball" ? "passed-ball" : "error";
    default:
      return "other";
  }
}

/** How the count changes when an ABS challenge is resolved. */
export function absCountResult(outcome: AbsEvent["outcome"]): "ball" | "strike" {
  return outcome === "ball-confirmed" || outcome === "strike-overturned" ? "ball" : "strike";
}

export function absTeam(caller: AbsEvent["caller"], state: GameState): TeamSide {
  return caller === "batter" ? battingSide(state) : fieldingSide(state);
}

export function absRetained(outcome: AbsEvent["outcome"]): boolean {
  return outcome.endsWith("overturned");
}

export function applyEvent(prev: GameState, ev: GameEvent): GameState {
  switch (ev.type) {
    case "pitch": {
      const state = clone(prev);
      const pitcherId = state.pitcher[fieldingSide(state)];
      state.pitchesThrown[pitcherId] = (state.pitchesThrown[pitcherId] ?? 0) + 1;
      if (ev.call === "ball") state.balls = Math.min(state.balls + 1, 3);
      else if (ev.call === "strike") state.strikes = Math.min(state.strikes + 1, 2);
      else if (state.strikes < 2) state.strikes += 1;
      return state;
    }
    case "runner":
      return ev.input ? logPlay(prev, ev) : prev;
    case "abs": {
      const state = clone(prev);
      const team = absTeam(ev.caller, state);
      const retained = absRetained(ev.outcome);
      if (!retained) state.challenges[team] = Math.max(0, state.challenges[team] - 1);
      state.absLog.push({
        inning: state.inning,
        half: state.half,
        team,
        caller: ev.caller,
        outcome: ev.outcome,
        retained,
      });
      const pitcherId = state.pitcher[fieldingSide(state)];
      state.pitchesThrown[pitcherId] = (state.pitchesThrown[pitcherId] ?? 0) + 1;
      if (absCountResult(ev.outcome) === "ball") state.balls = Math.min(state.balls + 1, 3);
      else state.strikes = Math.min(state.strikes + 1, 2);
      return state;
    }
    case "sub": {
      const state = clone(prev);
      const order = state.lineup[ev.team];
      if (ev.inPlayerName) state.playerNames[ev.inPlayerId] = ev.inPlayerName;
      const battingTeam = battingSide(state);
      const outSlot =
        typeof ev.slot === "number" && ev.slot >= 0 && ev.slot < order.length
          ? ev.slot
          : order.indexOf(ev.outPlayerId);
      state.subLog.push({
        team: ev.team,
        kind: ev.kind ?? "DEF",
        inning: state.inning,
        half: state.half,
        slot: outSlot >= 0 ? outSlot : undefined,
        outPlayerId: ev.outPlayerId,
        inPlayerId: ev.inPlayerId,
        position: ev.position,
        battingTeam,
        battingSlot: state.slot[battingTeam] % Math.max(state.lineup[battingTeam].length, 1),
        playIndex: state.plays.length,
      });
      if (typeof ev.slot === "number" && ev.slot >= 0 && ev.slot < order.length) {
        order[ev.slot] = ev.inPlayerId;
      } else {
        const idx = order.indexOf(ev.outPlayerId);
        if (idx >= 0) order[idx] = ev.inPlayerId;
      }
      if (ev.position) state.positions[ev.team][ev.inPlayerId] = ev.position;
      if (ev.position === "P" || state.pitcher[ev.team] === ev.outPlayerId) {
        if (ev.position === "P") state.pitcher[ev.team] = ev.inPlayerId;
      }
      ([1, 2, 3] as Base[]).forEach((b) => {
        if (state.bases[b] === ev.outPlayerId) state.bases[b] = ev.inPlayerId;
      });
      return state;
    }
    case "play":
      return ev.input ? logPlay(prev, ev) : prev;
    case "position": {
      const state = clone(prev);
      state.positions[ev.team][ev.playerId] = ev.position;
      if (ev.position === "P") state.pitcher[ev.team] = ev.playerId;
      return state;
    }
    default:
      return prev;
  }
}

export function reduceEvents(setup: GameSetup, events: GameEvent[]): GameState {
  return events.reduce<GameState>(applyEvent, createInitialState(setup));
}

