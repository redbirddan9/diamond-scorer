/** RBI Engine — RBIs are always computed, never entered by the scorer. */
import type { BatterInput, PlayClassification } from "../types";
import type { AdvancementResult } from "./advancement";
import { isGroundIntoDoublePlay } from "./classify";

export function calculateRBIs(
  input: BatterInput,
  classification: PlayClassification,
  adv: AdvancementResult,
): number {
  const runs = adv.advances.filter((a) => a.to === 4).length + (adv.batterTo === 4 ? 1 : 0);
  if (runs === 0) return 0;

  // No RBI on runs that score because of an error.
  if (classification === "E") return 0;
  if (input.kind === "batted" && input.errorFielders?.length) return 0;
  if (input.kind === "dropped-third" && input.errorFielders?.length) return 0;

  // No RBI when the batter grounds into a double play.
  if (isGroundIntoDoublePlay(input, classification)) return 0;

  // Runs on a dropped third strike / passed ball are not batted in.
  if (input.kind === "dropped-third") return 0;

  return runs;
}

/** Runner-only plays (steals, wild pitches, balks) never produce RBIs. */
export const RUNNER_PLAY_RBI = 0;
