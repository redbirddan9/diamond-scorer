/** Play Classification Engine — decides the official scoring result. */
import type {
  BatterInput,
  GameState,
  PlayClassification,
  RunnerInput,
} from "../types";
import type { AdvancementResult } from "./advancement";

/** Caught-ball trajectories that can produce a sacrifice fly. */
const AIR = ["fly", "line", "popup"];

export function classifyBatterPlay(
  state: GameState,
  input: BatterInput,
  adv: AdvancementResult,
): PlayClassification {
  const runs = adv.advances.filter((a) => a.to === 4).length + (adv.batterTo === 4 ? 1 : 0);
  const batterOut = adv.batterTo === "out";

  switch (input.kind) {
    case "hit":
      // A secondary error never downgrades a legitimate hit.
      return input.bases === 4 ? "HR" : input.groundRule ? "2B" : ((`${input.bases}B` as PlayClassification));
    case "strikeout":
    case "dropped-third":
      return "K";
    case "walk":
      return input.intentional ? "IBB" : "BB";
    case "hbp":
      return "HBP";
    case "sac-bunt":
      return adv.outsRecorded >= 2 ? "DP" : "SH";
    case "batted": {
      if (adv.outsRecorded >= 3) return "TP";
      if (adv.outsRecorded === 2) return "DP";
      if (input.errorFielders?.length && !batterOut) return "E";
      if (batterOut) {
        // Sacrifice fly: caught fly/line ball, fewer than two outs, a run scores.
        if (AIR.includes(input.batted) && state.outs < 2 && runs > 0) return "SF";
        return "OUT";
      }
      // Batter safe while the defense retired someone else — fielder's choice.
      if (adv.outsRecorded === 1) return "FC";
      return input.errorFielders?.length ? "E" : "FC";
    }
  }
}

export function classifyRunnerPlay(input: RunnerInput, adv: AdvancementResult): PlayClassification {
  switch (input.kind) {
    case "steal":
      return adv.advances.some((a) => a.to === "out") ? "CS" : "SB";
    case "wild-pitch":
      return "WP";
    case "passed-ball":
      return "PB";
    case "balk":
      return "BALK";
    case "defensive-indifference":
      return "DI";
    case "pickoff":
      return "PO";
  }
}

/** Ground ball double play with the batter retired at first. */
export function isGroundIntoDoublePlay(
  input: BatterInput,
  classification: PlayClassification,
): boolean {
  return (
    (classification === "DP" || classification === "TP") &&
    input.kind === "batted" &&
    (input.batted === "ground" || input.batted === "bunt")
  );
}
