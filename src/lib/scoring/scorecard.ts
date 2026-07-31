/**
 * Derived model for the paper scorecard: what each cell should draw, how far
 * each batter eventually got, basepath notations, substitution annotations and
 * per-row totals. Purely derived — it makes no scoring decisions.
 */
import type { GameState, LoggedPlay, TeamSide } from "./types";

export interface BasepathLabel {
  label: string;
  /** Runner was retired going for that base — circle the corner. */
  out?: boolean;
}

export interface CellModel {
  play: LoggedPlay;
  /** Furthest base reached by the batter in that inning (0-4). */
  base: number;
  scored: boolean;
  /** Which out of the inning this batter was, if retired at the plate. */
  outNumber?: number;
  /** Notations drawn on each basepath leg (1 = home→1st … 4 = 3rd→home). */
  paths: Record<number, BasepathLabel>;
  /** This is the last box the outgoing pitcher faced before a change. */
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

/**
 * How far the batter of `plays[index]` eventually advanced that inning, plus
 * every basepath notation earned along the way.
 */
export function batterProgress(plays: LoggedPlay[], index: number) {
  const play = plays[index];
  const batterTo = play.resolution.batterTo;
  const paths: Record<number, BasepathLabel> = {};
  let base = batterTo === "out" || batterTo === null ? 0 : batterTo === 4 ? 4 : Number(batterTo);
  let scored = base === 4;
  let out = batterTo === "out";

  const collect = (p: LoggedPlay) => {
    for (const mark of p.resolution.marks) {
      if (mark.runnerId !== play.batterId) continue;
      paths[mark.base] = { label: mark.label, out: mark.out };
    }
  };
  collect(play);

  if (!out && !scored) {
    for (let i = index + 1; i < plays.length; i += 1) {
      const later = plays[i];
      if (later.inning !== play.inning || later.half !== play.half) break;
      collect(later);
      for (const adv of later.resolution.advances) {
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
  return { base, scored, out, paths };
}

export function buildScorecard(state: GameState, side: TeamSide): RowModel[] {
  const starters = state.setup[side].lineup;
  const size = Math.max(starters.length, state.lineup[side].length);
  const nameOf = (id: string) => state.playerNames[id] ?? id;
  const positionOf = (id: string) =>
    state.positions[side][id] ??
    state.setup[side].players.find((p) => p.id === id)?.position ??
    "";

  // A pitching change marks the LAST box the outgoing pitcher faced.
  const pitcherChangePlayIds = new Set(
    state.subLog
      .filter((s) => s.kind === "P" && s.afterPlayId)
      .map((s) => s.afterPlayId as string),
  );

  return Array.from({ length: size }, (_, slot) => {
    const cells: Record<number, CellModel> = {};
    let ab = 0;
    let r = 0;
    let h = 0;
    let rbi = 0;

    state.plays.forEach((play, index) => {
      if (play.type !== "play" || play.battingTeam !== side || play.slot !== slot) return;
      const progress = batterProgress(state.plays, index);
      cells[play.inning] = {
        play,
        base: progress.base,
        scored: progress.scored,
        outNumber: play.resolution.batterTo === "out" ? play.outsBefore + 1 : undefined,
        paths: progress.paths,
        pitcherChange: pitcherChangePlayIds.has(play.id),
      };
      if (play.resolution.isAtBat) ab += 1;
      if (play.resolution.isHit) h += 1;
      if (progress.scored) r += 1;
      rbi += play.resolution.rbi;
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
        position: positionOf(s.inPlayerId) || s.position || "",
        inning: s.inning,
      })),
    ].filter((n) => n.id);

    // The entry line is drawn immediately BEFORE the substitute's first frame.
    let boundaryInning: number | undefined;
    if (subs.length) {
      const last = subs[subs.length - 1];
      const firstFrame = state.plays.find(
        (p) => p.battingTeam === side && p.slot === slot && p.batterId === last.inPlayerId,
      );
      boundaryInning = firstFrame
        ? firstFrame.inning
        : cells[last.inning]
          ? last.inning + 1
          : last.inning;
    }

    return { slot, names, boundaryInning, cells, ab, r, h, rbi };
  });
}
