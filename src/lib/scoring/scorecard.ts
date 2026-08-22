/**
 * Derived model for the paper scorecard: what each cell should draw, how far
 * each batter eventually got, substitution annotations and per-row totals.
 */
import type { AdvanceReason, GameState, LoggedPlay, TeamSide } from "./types";

/** Label drawn along a basepath segment (2 = 1B→2B, etc.). */
export interface PathLabel {
  from: number;
  to: number;
  label: string;
}

const REASON_LABEL: Partial<Record<AdvanceReason, string>> = {
  "stolen-base": "SB",
  "wild-pitch": "WP",
  "passed-ball": "PB",
  balk: "BK",
  "defensive-indifference": "DI",
};

export interface CellModel {
  play: LoggedPlay;
  /** Furthest base reached by the batter in that inning (0-4). */
  base: number;
  scored: boolean;
  /**
   * Out made on the basepaths: the base corner where this runner was retired
   * (force out, tag out, caught stealing, pickoff) plus an optional label.
   */
  outOnBases?: { base: number; label?: string };
  /**
   * Secondary error on a hit: label drawn along the basepath the batter took
   * because of the error (e.g. E9 between 2B and 3B).
   */
  errorAdvance?: { from: number; to: number; label: string };
  /** Reasons (SB, WP, PB, BK, E#, DI) for each non-hit advance of this batter. */
  pathLabels: PathLabel[];
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
  const batterTo = play.resolution.batterTo;
  let base = batterTo === "out" || batterTo === null ? 0 : batterTo === 4 ? 4 : Number(batterTo);
  let scored = base === 4;
  let out = batterTo === "out";
  let outOnBases: { base: number; label?: string } | undefined;
  const pathLabels: PathLabel[] = [];
  if (!out && !scored) {
    for (let i = index + 1; i < plays.length; i += 1) {
      const later = plays[i];
      if (later.inning !== play.inning || later.half !== play.half) break;
      for (const adv of later.resolution.advances) {
        if (adv.runnerId !== play.batterId) continue;
        if (adv.to === "out") {
          out = true;
          const chain = adv.fielders?.length ? adv.fielders.join("-") : undefined;
          if (adv.reason === "pickoff") outOnBases = { base: adv.from, label: "PO" };
          else if (adv.reason === "caught-stealing")
            outOnBases = { base: adv.from + 1, label: "CS" };
          else if (adv.reason === "force-out" || adv.reason === "tag-out")
            outOnBases = { base: adv.at ?? adv.from + 1, label: chain };
        }
        else {
          const errorFielders = later.resolution.errorFielders;
          const label =
            adv.reason === "error" && errorFielders.length
              ? `E${errorFielders.join("")}`
              : REASON_LABEL[adv.reason];
          if (label) pathLabels.push({ from: adv.from, to: adv.to, label });
        }
        if (adv.to === 4) {
          base = 4;
          scored = true;
        } else if (adv.to !== "out") base = Math.max(base, adv.to);
      }
      if (out || scored) break;
    }
  }
  return { base, scored, out, outOnBases, pathLabels };
}

export function buildScorecard(state: GameState, side: TeamSide): RowModel[] {
  const starters = state.setup[side].lineup;
  const size = Math.max(starters.length, state.lineup[side].length);
  const nameOf = (id: string) => state.playerNames[id] ?? id;
  const positionOf = (id: string) =>
    state.positions[side][id] ??
    state.setup[side].players.find((p) => p.id === id)?.position ??
    "";

  // Pitching change: mark the LAST batter box the outgoing pitcher faced.
  const pitchChangePlayIds = new Set<string>();
  state.subLog.forEach((s) => {
    if (s.kind !== "P") return;
    const upto = typeof s.playIndex === "number" ? s.playIndex : state.plays.length;
    for (let i = upto - 1; i >= 0; i -= 1) {
      const p = state.plays[i];
      if (p.type !== "play") continue;
      if (p.battingTeam === side) pitchChangePlayIds.add(p.id);
      break;
    }
  });

  return Array.from({ length: size }, (_, slot) => {
    const cells: Record<number, CellModel> = {};
    let ab = 0;
    let r = 0;
    let h = 0;
    let rbi = 0;

    state.plays.forEach((play, index) => {
      if (play.type !== "play" || play.battingTeam !== side || play.slot !== slot) return;
      const progress = batterProgress(state.plays, index);
      const pitcherChange = pitchChangePlayIds.has(play.id);
      let errorAdvance: CellModel["errorAdvance"];
      if (
        play.input?.kind === "hit" &&
        play.input.errorFielders?.length &&
        typeof play.resolution.batterTo === "number"
      ) {
        const from = play.input.bases;
        const to = play.resolution.batterTo;
        if (to > from) {
          errorAdvance = {
            from,
            to,
            label: `E${play.input.errorFielders.join("")}`,
          };
        }
      }
      cells[play.inning] = {
        play,
        base: progress.base,
        scored: progress.scored,
        outOnBases: progress.outOnBases,
        errorAdvance,
        pathLabels: progress.pathLabels,
        outNumber: play.resolution.batterTo === "out" ? play.outsBefore + 1 : undefined,
        pitcherChange,
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