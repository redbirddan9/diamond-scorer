/**
 * Rules engine.
 *
 * Pure, deterministic reduction of an immutable event log into game state.
 * Nothing here touches React, storage, or the DOM — editing a past play is
 * simply "drop/replace the event and replay".
 */
import type {
  AbsEvent,
  Advance,
  Base,
  Destination,
  GameEvent,
  GameSetup,
  GameState,
  LoggedPlay,
  PlayEvent,
  PlayResult,
  TeamSide,
} from "./types";

export const BATTER_OUT_RESULTS: PlayResult[] = [
  "K_SWING",
  "K_LOOK",
  "GO",
  "FO",
  "PF",
  "LO",
  "PO",
  "DP",
  "TP",
  "SF",
  "SH",
];

export const HIT_RESULTS: PlayResult[] = ["1B", "2B", "3B", "HR", "GRD"];

export function isHit(result: PlayResult) {
  return HIT_RESULTS.includes(result);
}

export function isStrikeout(result: PlayResult) {
  return result === "K_SWING" || result === "K_LOOK";
}

export function isWalk(result: PlayResult) {
  return result === "BB" || result === "IBB";
}

/** Plate appearances that do not count as an official at-bat. */
export function isAtBat(result: PlayResult) {
  return !(
    isWalk(result) ||
    result === "HBP" ||
    result === "SF" ||
    result === "SH" ||
    result === "CI" ||
    result === "OBSTRUCTION" ||
    result === "INTERFERENCE"
  );
}

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
    plays: [],
    over: false,
    challenges: { away: 2, home: 2 },
    absLog: [],
    ghostRunner: null,
    winner: null,
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
    plays: [...state.plays],
    challenges: { ...state.challenges },
    absLog: [...state.absLog],
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
  state.bases = emptyBases();
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
  placeGhostRunner(state);
}

/**
 * Extra-innings automatic runner: the player who made the last out of the
 * previous inning (i.e. the batter directly preceding the leadoff hitter)
 * starts at second base.
 */
function placeGhostRunner(state: GameState) {
  state.ghostRunner = null;
  if (state.inning <= state.setup.innings || state.over) return;
  const side = battingSide(state);
  const order = state.lineup[side];
  if (!order.length) return;
  const runnerId = order[(state.slot[side] - 1 + order.length) % order.length];
  state.bases[2] = runnerId;
  state.ghostRunner = runnerId;
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

/** Apply runner + batter destinations to the base state. */
function applyMovement(
  state: GameState,
  advances: Advance[],
  batterId: string | null,
  batterTo: Destination | null,
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
    } else if (adv.to === 4) {
      scored.push(id);
      addRun(state, offense);
    } else {
      next[adv.to] = id;
    }
  }

  if (batterId && batterTo !== null) {
    if (batterTo === "out") {
      outs += 1;
    } else if (batterTo === 4) {
      scored.push(batterId);
      addRun(state, offense);
    } else {
      next[batterTo] = batterId;
    }
  }

  state.bases = next;
  return { outs, scored };
}

function applyPlay(prev: GameState, ev: PlayEvent): GameState {
  const state = clone(prev);
  const offense = battingSide(state);
  const defense = fieldingSide(state);
  const outsBefore = state.outs;
  const pitcherId = state.pitcher[defense];
  const pitchCount = state.balls + state.strikes;

  if (isHit(ev.result)) state.hits[offense] += 1;
  state.errors[defense] += (ev.errorFielders ?? []).length;

  const { outs, scored } = applyMovement(state, ev.advances, ev.batterId, ev.batterTo);
  state.outs += outs;

  const logged: LoggedPlay = {
    ...ev,
    inning: state.inning,
    half: state.half,
    battingTeam: offense,
    slot: state.slot[offense] % state.lineup[offense].length,
    pitcherId,
    outsBefore,
    runsScored: scored,
    pitchCount,
  };
  state.plays.push(logged);
  state.pitchesThrown[pitcherId] = (state.pitchesThrown[pitcherId] ?? 0) + Math.max(pitchCount, 1);

  state.slot[offense] = (state.slot[offense] + 1) % state.lineup[offense].length;
  state.balls = 0;
  state.strikes = 0;
  ensureInningCell(state, offense);

  if (state.outs >= 3) {
    endHalfInning(state);
  } else {
    checkWalkOff(state);
  }
  return state;
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
    case "runner": {
      const state = clone(prev);
      const { outs } = applyMovement(state, ev.advances, null, null);
      state.outs += outs;
      if (state.outs >= 3) endHalfInning(state);
      else checkWalkOff(state);
      return state;
    }
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
      return applyPlay(prev, ev);
    default:
      return prev;
  }
}

export function reduceEvents(setup: GameSetup, events: GameEvent[]): GameState {
  return events.reduce<GameState>(applyEvent, createInitialState(setup));
}

/* ------------------------------------------------------------------ *
 * Intelligent scorebook assist
 * ------------------------------------------------------------------ */

function occupied(state: GameState): Base[] {
  return ([3, 2, 1] as Base[]).filter((b) => state.bases[b]);
}

function forcedBases(state: GameState): Base[] {
  const forced: Base[] = [];
  if (state.bases[1]) {
    forced.push(1);
    if (state.bases[2]) {
      forced.push(2);
      if (state.bases[3]) forced.push(3);
    }
  }
  return forced;
}

function advanceBy(base: Base, n: number): Destination {
  const target = base + n;
  return (target >= 4 ? 4 : target) as Destination;
}

export interface PlayDraft extends Omit<PlayEvent, "id" | "ts"> {}

/**
 * Given the current state and a chosen result, infer the complete play using
 * official scoring conventions. The UI presents this for review/override.
 */
export function proposePlay(
  state: GameState,
  result: PlayResult,
  fielders: number[] = [],
): PlayDraft {
  const batterId = currentBatterId(state);
  const advances: Advance[] = [];
  let batterTo: Destination = "out";
  let errorFielders: number[] = [];

  const push = (from: Base, to: Destination, reason: Advance["reason"]) => {
    const runnerId = state.bases[from];
    if (runnerId) advances.push({ runnerId, from, to, reason });
  };

  switch (result) {
    case "1B":
      batterTo = 1;
      occupied(state).forEach((b) => push(b, advanceBy(b, 1), "hit"));
      break;
    case "2B":
      batterTo = 2;
      occupied(state).forEach((b) => push(b, advanceBy(b, 2), "hit"));
      break;
    case "GRD":
      // Ground rule double: two-base award for the batter and every runner.
      batterTo = 2;
      occupied(state).forEach((b) => push(b, advanceBy(b, 2), "hit"));
      break;
    case "3B":
      batterTo = 3;
      occupied(state).forEach((b) => push(b, 4, "hit"));
      break;
    case "HR":
      batterTo = 4;
      occupied(state).forEach((b) => push(b, 4, "hit"));
      break;
    case "BB":
    case "IBB":
    case "HBP":
    case "CI":
    case "OBSTRUCTION":
    case "INTERFERENCE":
      batterTo = 1;
      forcedBases(state).forEach((b) => push(b, advanceBy(b, 1), "walk"));
      break;
    case "E":
      batterTo = 1;
      errorFielders = [...fielders];
      occupied(state).forEach((b) => push(b, advanceBy(b, 1), "error"));
      break;
    case "FC": {
      batterTo = 1;
      const lead = forcedBases(state).slice(-1)[0];
      if (lead !== undefined) push(lead, "out", "force-out");
      break;
    }
    case "SF":
      if (state.bases[3]) push(3, 4, "sacrifice");
      break;
    case "SH":
      occupied(state).forEach((b) => push(b, advanceBy(b, 1), "sacrifice"));
      break;
    case "DP": {
      const lead = forcedBases(state)[0];
      if (lead !== undefined) push(lead, "out", "double-play");
      break;
    }
    case "TP": {
      forcedBases(state)
        .slice(0, 2)
        .forEach((b) => push(b, "out", "double-play"));
      break;
    }
    default:
      // Strikeouts and routine outs: batter retired, runners hold.
      break;
  }

  const scoring = advances.filter((a) => a.to === 4).length + (batterTo === 4 ? 1 : 0);
  const noRbi = result === "E" || result === "FC" || result === "DP" || result === "TP";
  const rbi = noRbi ? 0 : scoring;

  return {
    type: "play",
    batterId,
    result,
    fielders,
    batterTo,
    advances,
    rbi,
    errorFielders,
    earnedRuns: errorFielders.length === 0,
  };
}

export function isInningEnding(state: GameState, draft: PlayDraft): boolean {
  const outs =
    draft.advances.filter((a) => a.to === "out").length + (draft.batterTo === "out" ? 1 : 0);
  return state.outs + outs >= 3;
}

export function runsOnPlay(draft: PlayDraft): number {
  return draft.advances.filter((a) => a.to === 4).length + (draft.batterTo === 4 ? 1 : 0);
}

/**
 * Should the scorer be asked to confirm runner advancement / RBIs?
 *
 * Only when the situation is genuinely ambiguous about a run scoring —
 * otherwise basic baseball logic is applied automatically.
 */
export function needsReview(state: GameState, draft: PlayDraft): boolean {
  const runners = ([1, 2, 3] as Base[]).filter((b) => state.bases[b]);
  if (runners.length === 0) return false;

  switch (draft.result) {
    // Everybody scores — nothing to decide.
    case "HR":
    case "3B":
      return false;
    // Ground rule double: the award is fixed by rule, never a judgement call.
    case "GRD":
      return false;
    // Ball in play with the batter reaching: a trailing runner stopped at
    // third could plausibly have been waved home.
    case "1B":
    case "2B":
    case "E":
    case "FC":
      return draft.advances.some((a) => a.to === 3);
    case "SF":
      // Tagging from second is a judgement call.
      return Boolean(state.bases[2]) || Boolean(state.bases[1]);
    case "SH":
      return Boolean(state.bases[3]);
    case "DP":
    case "TP":
      return true;
    // Routine outs: a run can only score from third with fewer than two outs.
    case "GO":
    case "FO":
    case "PF":
    case "LO":
    case "PO":
      return Boolean(state.bases[3]) && state.outs < 2;
    default:
      return false;
  }
}