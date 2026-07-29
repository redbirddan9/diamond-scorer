/**
 * Derived model for the paper scorecard: what each cell should draw, how far
 * each batter eventually got, substitution annotations and per-row totals.
 */
import { isAtBat, isHit } from "./engine";
import type { GameState, LoggedPlay, TeamSide } from "./types";

export interface CellModel {
  play: LoggedPlay;
  /** Furthest base reached by the batter in that inning (0-4). */
  base: number;
  scored: boolean;
  /** Which out of the inning this batter was, if retired at the plate. */
  outNumber?: number;
  /** A pitching change happened before this plate appearance. */
  pitcherChange: boolean;
}

export interface RowModel {
  slot: number;
  /** Original starter first, then each substitute in order. */
  names: { id: string; name: string; position: string; inning?: number }[];
  /** Inning column that gets the bold entry line, if any. */
  boundaryInning?: number;
  cells: Record<number, CellModel>;
  ab: number;
  r: number;
  h: number;
  rbi: number;
}

/** How far the batter of `plays[index]` eventually advanced that inning. */
export function batterProgress(plays: LoggedPlay[], index: number) {
  const play = plays[index];
  let base = play.batterTo === "out" ? 0 : play.batterTo === 4 ? 4 : Number(play.batterTo);
  let scored = base === 4;
  let out = play.batterTo === "out";
  if (!out && !scored) {
    for (let i = index + 1; i < plays.length; i += 1) {
      const later = plays[i];
      if (later.inning !== play.inning || later.half !== play.half) break;
      for (const adv of later.advances) {
        if (adv.runnerId !== play.batterId) continue;
        if (adv.to === "out") out = true;
        else if (adv.to === 4) {
          base = 4;
          scored = true;
        } else base = Math.max(base, adv.to);
      }
      if (out || scored) break;
    }
  }
  return { base, scored, out };
}

export function buildScorecard(state: GameState, side: TeamSide): RowModel[] {
  const starters = state.setup[side].lineup;
  const size = Math.max(starters.length, state.lineup[side].length);
  const nameOf = (id: string) => state.playerNames[id] ?? id;
  const positionOf = (id: string) =>
    state.positions[side][id] ??
    state.setup[side].players.find((p) => p.id === id)?.position ??
    "";

  return Array.from({ length: size }, (_, slot) => {
    const cells: Record<number, CellModel> = {};
    let ab = 0;
    let r = 0;
    let h = 0;
    let rbi = 0;

    state.plays.forEach((play, index) => {
      if (play.battingTeam !== side || play.slot !== slot) return;
      const progress = batterProgress(state.plays, index);
      const pitcherChange = state.subLog.some(
        (s) =>
          s.kind === "P" &&
          s.battingTeam === side &&
          s.battingSlot === slot &&
          s.inning === play.inning &&
          s.half === play.half,
      );
      cells[play.inning] = {
        play,
        base: progress.base,
        scored: progress.scored,
        outNumber: play.batterTo === "out" ? play.outsBefore + 1 : undefined,
        pitcherChange,
      };
      if (isAtBat(play.result)) ab += 1;
      if (isHit(play.result)) h += 1;
      if (progress.scored) r += 1;
      rbi += play.rbi;
    });

    const subs = state.subLog.filter((s) => s.team === side && s.slot === slot && s.kind !== "P");
    const names = [
      {
        id: starters[slot],
        name: nameOf(starters[slot]),
        position: positionOf(starters[slot]),
      },
      ...subs.map((s) => ({
        id: s.inPlayerId,
        name: nameOf(s.inPlayerId),
        position: s.position ?? positionOf(s.inPlayerId),
        inning: s.inning,
      })),
    ].filter((n) => n.id);

    let boundaryInning: number | undefined;
    if (subs.length) {
      const last = subs[subs.length - 1];
      boundaryInning = cells[last.inning] ? last.inning + 1 : last.inning;
    }

    return { slot, names, boundaryInning, cells, ab, r, h, rbi };
  });
}