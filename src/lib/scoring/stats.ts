/** Statistics derived entirely from the reduced game state. */
import { isAtBat, isHit, isStrikeout, isWalk } from "./engine";
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
    const b = get(play.batterId);
    b.pa += 1;
    if (isAtBat(play.result)) b.ab += 1;
    b.rbi += play.rbi;
    if (isWalk(play.result)) b.bb += 1;
    if (isStrikeout(play.result)) b.so += 1;
    if (play.result === "HBP") b.hbp += 1;
    if (isHit(play.result)) {
      b.h += 1;
      if (play.result === "2B") {
        b.doubles += 1;
        b.tb += 2;
      } else if (play.result === "3B") {
        b.triples += 1;
        b.tb += 3;
      } else if (play.result === "HR") {
        b.hr += 1;
        b.tb += 4;
      } else {
        b.tb += 1;
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
  const get = (id: string) => {
    let line = lines.get(id);
    if (!line) {
      line = emptyPitching(id);
      lines.set(id, line);
    }
    return line;
  };
  get(state.pitcher[side]);

  for (const play of state.plays) {
    if (play.battingTeam === side) continue;
    const p = get(play.pitcherId);
    p.bf += 1;
    if (isHit(play.result)) p.h += 1;
    if (play.result === "HR") p.hr += 1;
    if (isStrikeout(play.result)) p.so += 1;
    if (isWalk(play.result)) p.bb += 1;
    if (play.result === "HBP") p.hbp += 1;
    p.r += play.runsScored.length;
    if (play.earnedRuns !== false) p.er += play.runsScored.length;
    const outs =
      play.advances.filter((a) => a.to === "out").length + (play.batterTo === "out" ? 1 : 0);
    p.outs += outs;
  }

  for (const line of lines.values()) {
    line.pitches = state.pitchesThrown[line.playerId] ?? 0;
    const innings = line.outs / 3;
    line.ip = `${Math.floor(line.outs / 3)}.${line.outs % 3}`;
    line.era = innings > 0 ? (line.er * 9) / innings : 0;
    line.whip = innings > 0 ? (line.bb + line.h) / innings : 0;
  }
  return [...lines.values()];
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
    const f = play.fielders;
    if (f.length) {
      const putout = f[f.length - 1];
      get(putout).po += 1;
      f.slice(0, -1).forEach((pos) => (get(pos).a += 1));
    }
    if (isStrikeout(play.result)) get(2).po += 1;
    if (play.errorFielder) get(play.errorFielder).e += 1;
    if (play.result === "DP" || play.result === "TP") f.forEach((pos) => (get(pos).dp += 1));
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
    if (play.batterTo !== "out" && play.batterTo !== 4) inningRunners.add(play.batterId);
    for (const adv of play.advances) {
      if (adv.to === "out" || adv.to === 4) inningRunners.delete(adv.runnerId);
    }
    if (play.batterTo === 4) inningRunners.delete(play.batterId);
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