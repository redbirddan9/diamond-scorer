/** Traditional scorebook notation rendering. */
import type { LoggedPlay, PlayResult } from "./types";

const FIELDER_OUT_PREFIX: Record<string, string> = {
  FO: "F",
  LO: "L",
  PO: "P",
};

export const RESULT_LABELS: Record<PlayResult, string> = {
  "1B": "Single",
  "2B": "Double",
  "3B": "Triple",
  HR: "Home Run",
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
  FO: "Fly Out",
  LO: "Line Out",
  PO: "Pop Out",
  DP: "Double Play",
  TP: "Triple Play",
  CI: "Catcher's Interference",
  OBSTRUCTION: "Obstruction",
  INTERFERENCE: "Interference",
  APPEAL: "Appeal Play",
  OTHER: "Other",
};

/** Short scorebook notation, e.g. `6-3`, `F8`, `K`, `ꓘ`, `1B`, `E6`. */
export function notationFor(play: {
  result: PlayResult;
  fielders: number[];
  errorFielder?: number | null;
}): string {
  const f = play.fielders;
  switch (play.result) {
    case "1B":
    case "2B":
    case "3B":
    case "HR":
      return play.result;
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
    case "E":
      return `E${play.errorFielder ?? f[0] ?? ""}`;
    case "FC":
      return f.length ? `FC ${f.join("-")}` : "FC";
    case "SF":
      return f.length ? `SAC F${f[0]}` : "SAC";
    case "SH":
      return f.length ? `SAC ${f.join("-")}` : "SAC";
    case "GO":
      return f.length ? f.join("-") : "GO";
    case "FO":
    case "LO":
    case "PO":
      return f.length ? `${FIELDER_OUT_PREFIX[play.result]}${f[0]}` : play.result;
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