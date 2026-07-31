/** Statistics derived entirely from the reduced game state. */
import type { GameState, TeamSide } from "./types";

export interface BattingLine {
  playerId: string;
  pa: number;
  ab: number;
  r: number;
  h: number;
  rbi: number;
  bb: number;
  so: number;
  hbp: number;
  doubles: number;
  triples: number;
  hr: number;
  tb: number;
  lob: number;
  avg: number;
  obp: number;
  slg: number;
  ops: number;
}

export interface PitchingLine {
  playerId: string;
  outs: number;
  ip: string;
  h: number;
  r: number;
  er: number;
  hr: number;
  so: number;
  bb: number;
  hbp: number;
  bf: number;
  pitches: number;
  era: number;
  whip: number;
  /** Runners on base when this pitcher entered the game. */
  inheritedRunners: number;
  /** Inherited runners who scored while this pitcher was pitching. */
  inheritedRunnersScored: number;
  /** Runners this pitcher left on base who scored after he left. */
  bequeathedRunnersScored: number;
}

export interface FieldingLine {
  position: number;
  po: number;
  a: number;
  e: number;
  dp: number;
  fpct: number;
}

const emptyBatting = (playerId: string): BattingLine => ({
  playerId,
  pa: 0,
  ab: 0,
  r: 0,
  h: 0,
  rbi: 0,
  bb: 0,
  so: 0,
  hbp: 0,
  doubles: 0,
  triples: 0,
  hr: 0,
  tb: 0,
  lob: 0,
  avg: 0,
  obp: 0,
  slg: 0,
  ops: 0,
});

const emptyPitching = (playerId: string): PitchingLine => ({
  playerId,
  outs: 0,
  ip: "0.0",
  h: 0,
  r: 0,
  er: 0,
  hr: 0,
  so: 0,
  bb: 0,
  hbp: 0,
  bf: 0,
  pitches: 0,
  era: 0,
  whip: 0,
  inheritedRunners: 0,
  inheritedRunnersScored: 0,
  bequeathedRunnersScored: 0,
});

const ratio = (n: number, d: number) => (d > 0 ? n / d : 0);

export function battingStats(state: GameState, side: TeamSide): BattingLine[] {
  const lines = new Map<string, BattingLine>();
  const get = (id: string) => {
    let line = lines.get(id);
    if (!line) {
      line = emptyBatting(id);
      lines.set(id, line);
    }
    return line;
  };
  for (const id of state.lineup[side]) get(id);

  for (const play of state.plays) {
    if (play.battingTeam !== side) continue;
    const res = play.resolution;
    if (play.batterId) {
      const b = get(play.batterId);
      if (res.isPlateAppearance) b.pa += 1;
      if (res.isAtBat) b.ab += 1;
      b.rbi += res.rbi;
      if (res.isWalk) b.bb += 1;
      if (res.isStrikeout) b.so += 1;
      if (res.classification === "HBP") b.hbp += 1;
      if (res.isHit) {
        b.h += 1;
        if (res.classification === "2B") {
          b.doubles += 1;
          b.tb += 2;
        } else if (res.classification === "3B") {
          b.triples += 1;
          b.tb += 3;
        } else if (res.classification === "HR") {
          b.hr += 1;
          b.tb += 4;
        } else {
          b.tb += 1;
        }
      }
    }
    for (const runnerId of play.runsScored) get(runnerId).r += 1;
  }

  for (const line of lines.values()) {
    line.avg = ratio(line.h, line.ab);
    line.obp = ratio(line.h + line.bb + line.hbp, line.ab + line.bb + line.hbp);
    line.slg = ratio(line.tb, line.ab);
    line.ops = line.obp + line.slg;
  }
  const order = state.lineup[side];
  return [...lines.values()].sort(
    (a, b) =>
      (order.indexOf(a.playerId) + 1 || 99) - (order.indexOf(b.playerId) + 1 || 99),
  );
}

export function pitchingStats(state: GameState, side: TeamSide): PitchingLine[] {
  const lines = new Map<string, PitchingLine>();
  const firstAppearance = new Map<string, number>();
  const get = (id: string, index?: number) => {
    let line = lines.get(id);
    if (!line) {
      line = emptyPitching(id);
      lines.set(id, line);
    }
    if (index !== undefined && !firstAppearance.has(id)) {
      firstAppearance.set(id, index);
    }
    return line;
  };

  state.plays.forEach((play, index) => {
    if (play.battingTeam === side) return;
    const res = play.resolution;
    const p = get(play.pitcherId, index);
    if (res.isPlateAppearance) p.bf += 1;
    if (res.isHit) p.h += 1;
    if (res.classification === "HR") p.hr += 1;
    if (res.isStrikeout) p.so += 1;
    if (res.isWalk) p.bb += 1;
    if (res.classification === "HBP") p.hbp += 1;
    p.outs += res.outsRecorded;

    // Charge runs to the pitcher originally responsible for the runner.
    for (const runnerId of play.runsScored) {
      const responsible = play.runResponsibility[runnerId] ?? play.pitcherId;
      const line = get(responsible);
      line.r += 1;
      if (play.earnedRunIds.includes(runnerId)) line.er += 1;
    }
  });

  // Inherited and bequeathed runners come from substitution records.
  for (const sub of state.subLog) {
    if (sub.team !== side) continue;
    if (!sub.inheritedRunners || !sub.previousPitcherId || !sub.newPitcherId) continue;
    const newLine = get(sub.newPitcherId);
    const prevLine = get(sub.previousPitcherId);
    newLine.inheritedRunners += sub.inheritedRunners.length;
    for (const runnerId of sub.inheritedRunners) {
      if (runnerScoredAfter(state, runnerId, sub)) {
        newLine.inheritedRunnersScored += 1;
        prevLine.bequeathedRunnersScored += 1;
      }
    }
  }

  // Ensure the current pitcher is listed even if no plays have been logged yet.
  get(state.pitcher[side]);

  for (const line of lines.values()) {
    line.pitches = state.pitchesThrown[line.playerId] ?? 0;
    const innings = line.outs / 3;
    line.ip = `${Math.floor(line.outs / 3)}.${line.outs % 3}`;
    line.era = innings > 0 ? (line.er * 9) / innings : 0;
    line.whip = innings > 0 ? (line.bb + line.h) / innings : 0;
  }

  return [...lines.values()].sort((a, b) => {
    const aIdx = firstAppearance.get(a.playerId) ?? Infinity;
    const bIdx = firstAppearance.get(b.playerId) ?? Infinity;
    return aIdx - bIdx;
  });
}

/** True if a runner who was on base at the time of a sub later scored in the same half-inning. */
function runnerScoredAfter(state: GameState, runnerId: string, sub: SubRecord): boolean {
  for (let i = sub.playIndex ?? 0; i < state.plays.length; i++) {
    const play = state.plays[i];
    if (play.runsScored.includes(runnerId)) return true;
    // If the half-inning changed, the runner was stranded.
    if (play.inning !== sub.inning || play.half !== sub.half) return false;
  }
  return false;
}

export function fieldingStats(state: GameState, side: TeamSide): FieldingLine[] {
  const lines = new Map<number, FieldingLine>();
  const get = (pos: number) => {
    let line = lines.get(pos);
    if (!line) {
      line = { position: pos, po: 0, a: 0, e: 0, dp: 0, fpct: 0 };
      lines.set(pos, line);
    }
    return line;
  };

  for (const play of state.plays) {
    if (play.battingTeam === side) continue; // this side is fielding
    const res = play.resolution;
    const f = res.fielders;
    if (f.length) {
      const putout = f[f.length - 1];
      get(putout).po += 1;
      f.slice(0, -1).forEach((pos) => (get(pos).a += 1));
    }
    if (res.isStrikeout) get(2).po += 1;
    for (const pos of res.errorFielders) get(pos).e += 1;
    if (res.classification === "DP" || res.classification === "TP")
      f.forEach((pos) => (get(pos).dp += 1));
  }

  for (const line of lines.values()) {
    line.fpct = ratio(line.po + line.a, line.po + line.a + line.e);
  }
  return [...lines.values()].sort((a, b) => a.position - b.position);
}

export function leftOnBase(state: GameState, side: TeamSide): number {
  let lob = 0;
  let inningRunners = new Set<string>();
  let currentKey = "";
  for (const play of state.plays) {
    if (play.battingTeam !== side) continue;
    const key = `${play.inning}-${play.half}`;
    if (key !== currentKey) {
      lob += inningRunners.size;
      inningRunners = new Set();
      currentKey = key;
    }
    const batterTo = play.resolution.batterTo;
    if (play.batterId && batterTo !== "out" && batterTo !== 4 && batterTo !== null)
      inningRunners.add(play.batterId);
    for (const adv of play.resolution.advances) {
      if (adv.to === "out" || adv.to === 4) inningRunners.delete(adv.runnerId);
    }
    if (play.batterId && batterTo === 4) inningRunners.delete(play.batterId);
  }
  const activeSide = state.half === "top" ? "away" : "home";
  if (activeSide === side) {
    // Runners still on base in the live half-inning are not yet stranded.
    return lob;
  }
  return lob + inningRunners.size;
}

export function teamTotals(state: GameState, side: TeamSide) {
  return {
    runs: state.score[side],
    hits: state.hits[side],
    errors: state.errors[side === "away" ? "away" : "home"],
    lob: leftOnBase(state, side),
  };
}

export function formatAvg(value: number): string {
  if (!Number.isFinite(value) || value === 0) return ".000";
  const s = value.toFixed(3);
  return value < 1 ? s.slice(1) : s;
}