/**
 * Scorecard notation — the single source of truth for how an official result
 * is drawn (SF-9, FC 6-4, DP 6-4-3 …), never the raw menu selection.
 */
import type { BatterInput, LoggedPlay, PlayClassification, PlayInput } from "./types";

export const RESULT_LABELS: Record<PlayClassification, string> = {
  "1B": "Single",
  "2B": "Double",
  "3B": "Triple",
  HR: "Home Run",
  K: "Strikeout",
  BB: "Walk",
  IBB: "Intentional Walk",
  HBP: "Hit By Pitch",
  E: "Reached On Error",
  FC: "Fielder's Choice",
  SF: "Sacrifice Fly",
  SH: "Sacrifice Bunt",
  DP: "Double Play",
  TP: "Triple Play",
  OUT: "Out",
  SB: "Stolen Base",
  CS: "Caught Stealing",
  WP: "Wild Pitch",
  PB: "Passed Ball",
  BALK: "Balk",
  DI: "Defensive Indifference",
  PO: "Pickoff",
};

/** Backwards K — the traditional called-strikeout mark. */
export const BACKWARDS_K = "\uA7B0";

/** Subscript letter for each caught-ball trajectory. */
const AIR_LETTER: Record<string, string> = { fly: "F", line: "L", popup: "P", bunt: "B" };

function isBatter(input: PlayInput): input is BatterInput {
  return !["steal", "wild-pitch", "passed-ball", "balk", "defensive-indifference", "pickoff"].includes(
    input.kind,
  );
}

function chain(fielders: number[]): string {
  if (!fielders.length) return "";
  if (fielders.length === 1) return `${fielders[0]}u`;
  return fielders.join("-");
}

export interface NotationParts {
  /** Small line above the main mark (FC, DP, TP …). */
  above?: string;
  /** Large, centered mark. */
  main: string;
  /** Subscript that follows the main mark. */
  sub?: string;
  /** Smaller line underneath. */
  below?: string;
}

export function notationParts(play: LoggedPlay): NotationParts {
  const { input, resolution } = play;
  const c = resolution.classification;
  const f = resolution.fielders;
  const e = resolution.errorFielders;

  if (!isBatter(input)) {
    switch (input.kind) {
      case "steal":
        return { main: c === "CS" ? "CS" : "SB" };
      case "wild-pitch":
        return { main: "WP" };
      case "passed-ball":
        return { main: "PB" };
      case "balk":
        return { main: "BK" };
      case "defensive-indifference":
        return { main: "DI" };
      case "pickoff":
        return { main: "PO", sub: e.length ? `E${e[0]}` : undefined };
    }
  }

  const secondary =
    input.kind === "hit" || input.kind === "batted" ? input.secondary : undefined;
  const secondaryMark = secondary ? `E${secondary.fielder}` : undefined;

  switch (c) {
    case "HR":
      return { main: "HR", below: secondaryMark };
    case "1B":
    case "2B":
    case "3B":
      return {
        main: c,
        sub: input.kind === "hit" && input.groundRule ? "GR" : undefined,
        below: secondaryMark,
      };
    case "K": {
      if (input.kind === "dropped-third") {
        const cause =
          input.cause === "passed-ball" ? "PB" : input.cause === "wild-pitch" ? "WP" : "2-3";
        return { main: input.swinging ? "K" : BACKWARDS_K, sub: cause };
      }
      return { main: input.kind === "strikeout" && !input.swinging ? BACKWARDS_K : "K" };
    }
    case "BB":
      return { main: "BB" };
    case "IBB":
      return { main: "IBB" };
    case "HBP":
      return { main: "HBP" };
    case "E":
      return { main: `E${e[0] ?? ""}`, below: e.length > 1 ? `E${e.slice(1).join(" E")}` : undefined };
    case "FC":
      return { above: "FC", main: chain(f) || "FC", below: secondaryMark };
    case "SF":
      return { main: `SF-${f[0] ?? ""}`.replace(/-$/, "") };
    case "SH":
      return { main: "SH", sub: chain(f) || undefined };
    case "DP":
    case "TP":
      return { above: c, main: chain(f) || c };
    case "OUT":
    default: {
      if (input.kind === "batted" && input.batted !== "ground") {
        const foul = input.foul === true;
        return {
          main: f.length ? String(f[0]) : "—",
          sub: foul ? "PF" : AIR_LETTER[input.batted],
        };
      }
      return { main: chain(f) || "OUT", below: secondaryMark };
    }
  }
}

/** Single-line notation, used in exports and the play log. */
export function notationFor(play: LoggedPlay): string {
  const p = notationParts(play);
  const rbi = play.resolution.rbi > 0 ? ` ${play.resolution.rbi} RBI` : "";
  const above = p.above ? `${p.above} ` : "";
  const below = p.below ? ` ${p.below}` : "";
  return `${above}${p.main}${p.sub ?? ""}${below}${rbi}`.trim();
}

export function describePlay(play: LoggedPlay, nameOf: (id: string) => string): string {
  const who = play.batterId ? nameOf(play.batterId) : "";
  const label = RESULT_LABELS[play.resolution.classification];
  const notation = notationFor(play);
  return [who, `${label} (${notation})`].filter(Boolean).join(" — ");
}
