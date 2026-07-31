/** Play Validation Engine — rejects impossible baseball, not unusual baseball. */
import type { BatterInput, GameState, PlayInput, PlayResolution } from "../types";

export function validatePlay(
  state: GameState,
  input: PlayInput,
  resolution: PlayResolution,
): string[] {
  const errors: string[] = [];
  const { advances, batterTo, classification, outsRecorded, rbi } = resolution;

  if (state.over) errors.push("The game is final — no further plays can be recorded.");
  if (state.outs + outsRecorded > 3) {
    errors.push(`That records ${outsRecorded} out(s) with ${state.outs} already out.`);
  }

  for (const a of advances) {
    if (state.bases[a.from] !== a.runnerId) {
      errors.push(`No runner on ${a.from === 1 ? "1st" : a.from === 2 ? "2nd" : "3rd"}.`);
    }
  }

  const seen = new Set<number>();
  for (const a of advances) {
    if (a.to === "out" || a.to === 4) continue;
    if (seen.has(a.to)) errors.push("Two runners cannot end on the same base.");
    seen.add(a.to);
  }
  if (typeof batterTo === "number" && batterTo !== 4 && seen.has(batterTo)) {
    errors.push("The batter and a runner cannot end on the same base.");
  }

  for (const a of advances) {
    if (a.to !== "out" && a.to !== 4 && a.to < a.from) {
      errors.push("A runner cannot move backwards.");
    }
  }

  const runnerIds = advances.map((a) => a.runnerId);
  if (new Set(runnerIds).size !== runnerIds.length) {
    errors.push("A runner cannot be both safe and out on the same play.");
  }

  if (classification === "SF") {
    if (state.outs >= 2) errors.push("A sacrifice fly is impossible with two outs.");
    if (!advances.some((a) => a.to === 4)) errors.push("A sacrifice fly requires a run to score.");
  }
  if (classification === "TP" && state.outs > 0) {
    errors.push("A triple play is only possible with no outs.");
  }
  if (classification === "TP" && advances.length + 1 < 3) {
    errors.push("A triple play requires enough baserunners.");
  }
  if (rbi > 0 && classification === "E") errors.push("An error cannot produce an RBI.");

  if (isBatterInput(input) && input.kind === "batted") {
    const runners = ([1, 2, 3] as const).filter((b) => state.bases[b]);
    for (const target of input.retired) {
      if (target !== "batter" && !runners.includes(target)) {
        errors.push("Cannot retire a runner who is not on base.");
      }
    }
    if (input.retired.length === 0 && !input.errorFielders?.length) {
      errors.push("Select who was retired, or record the play as an error.");
    }
  }

  return Array.from(new Set(errors));
}

function isBatterInput(input: PlayInput): input is BatterInput {
  return !["steal", "wild-pitch", "passed-ball", "balk", "defensive-indifference", "pickoff"].includes(
    input.kind,
  );
}
