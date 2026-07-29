/** Traditional scorebook notation rendering. */
import type { LoggedPlay, PlayResult } from "./types";

/** Subscript letter shown after the fielder number for air outs. */
const AIR_OUT_SUFFIX: Record<string, string> = {
  PF: "PF",
  LO: "L",
  PO: "P",
};

export const RESULT_LABELS: Record<PlayResult, string> = {
  "1B": "Single",
  "2B": "Double",
  "3B": "Triple",
  HR: "Home Run",
  GRD: "Ground Rule Double",
  K_SWING: "Strikeout Swinging",
  K_LOOK: "Strikeout Looking",
  BB: "Walk",
  IBB: "Intentional Walk",
  HBP: "Hit By Pitch",
  E: "Reached on Error",
  FC: "Fielder's Choice",
  SF: "Sacrifice Fly",
  SH: "Sacrifice Bunt",
  GO: "Ground Out",
  PF: "Pop Foul Out",
  LO: "Line Out",
  PO: "Pop Out",
  DP: "Double Play",
  TP: "Triple Play",
  CI: "Catcher's Interference",
  OBSTRUCTION: "Obstruction",
  INTERFERENCE: "Interference",
};

/** Short scorebook notation, e.g. `6-3`, `F8`, `K`, `ꓘ`, `1B`, `E6`. */
export function notationFor(play: {
  result: PlayResult;
  fielders: number[];
  errorFielders?: number[];
}): string {
  const f = play.fielders;
  switch (play.result) {
    case "1B":
    case "2B":
    case "3B":
    case "HR":
      return play.result;
    case "GRD":
      return "GRD";
    case "K_SWING":
      return "K";
    case "K_LOOK":
      return "ꓘ";
    case "BB":
      return "BB";
    case "IBB":
      return "IBB";
    case "HBP":
      return "HBP";
    case "E": {
      const errs = play.errorFielders?.length ? play.errorFielders : f;
      return errs.length ? errs.map((n) => `E${n}`).join(" ") : "E";
    }
    case "FC":
      return f.length ? `FC ${f.join("-")}` : "FC";
    case "SF":
      return f.length ? `SAC F${f[0]}` : "SAC";
    case "SH":
      return f.length ? `SAC ${f.join("-")}` : "SAC";
    case "GO":
      // A single fielder recorded the out unassisted, e.g. "3u".
      if (!f.length) return "GO";
      return f.length === 1 ? `${f[0]}u` : f.join("-");
    case "PF":
    case "LO":
    case "PO":
      return f.length ? `${f[0]}${AIR_OUT_SUFFIX[play.result]}` : play.result;
    case "DP":
      return f.length ? `${f.join("-")} DP` : "DP";
    case "TP":
      return f.length ? `${f.join("-")} TP` : "TP";
    case "CI":
      return "CI";
    default:
      return RESULT_LABELS[play.result] ?? play.result;
  }
}

export function describePlay(play: LoggedPlay, nameOf: (id: string) => string): string {
  const runs = play.runsScored.length;
  const parts = [`${nameOf(play.batterId)} — ${RESULT_LABELS[play.result]} (${notationFor(play)})`];
  if (runs) parts.push(`${runs} run${runs > 1 ? "s" : ""}`);
  if (play.rbi) parts.push(`${play.rbi} RBI`);
  return parts.join(", ");
}

/**
 * Scorecard rendering split: a large primary mark with an optional smaller
 * suffix (e.g. a big `8` with a subscript `P` for a pop out to centre) and an
 * optional second line (e.g. `DP`).
 */
export function notationParts(play: {
  result: PlayResult;
  fielders: number[];
  errorFielders?: number[];
}): { main: string; sub?: string; below?: string } {
  const f = play.fielders;
  switch (play.result) {
    case "LO":
    case "PO":
    case "PF":
      return f.length
        ? { main: String(f[0]), sub: AIR_OUT_SUFFIX[play.result] }
        : { main: play.result };
    case "DP":
      return { main: f.length ? f.join("-") : "DP", below: f.length ? "DP" : undefined };
    case "TP":
      return { main: f.length ? f.join("-") : "TP", below: f.length ? "TP" : undefined };
    default:
      return { main: notationFor(play) };
  }
}