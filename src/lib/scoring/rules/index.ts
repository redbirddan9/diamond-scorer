/**
 * Official Scorer Rules Layer.
 *
 * Game State -> Play Input -> Advancement -> Classification -> RBI -> Validation
 *
 * Every scoring decision in the application flows through `resolvePlay`.
 */
import type {
  BatterInput,
  GameState,
  PlayInput,
  PlayResolution,
  RunnerInput,
  RunnerKey,
  Destination,
} from "../types";
import { resolveRunnerAdvancement, resolveRunnerEvent } from "./advancement";
import { classifyBatterPlay, classifyRunnerPlay } from "./classify";
import { calculateRBIs, RUNNER_PLAY_RBI } from "./rbi";
import { validatePlay } from "./validate";

export * from "./situation";
export { resolveRunnerAdvancement, resolveRunnerEvent } from "./advancement";
export { classifyBatterPlay, classifyRunnerPlay } from "./classify";
export { calculateRBIs } from "./rbi";
export { validatePlay } from "./validate";

type Overrides = Partial<Record<RunnerKey, Destination>>;

const RUNNER_KINDS: PlayInput["kind"][] = [
  "steal",
  "wild-pitch",
  "passed-ball",
  "balk",
  "defensive-indifference",
  "pickoff",
];

export function isRunnerInput(input: PlayInput): input is RunnerInput {
  return RUNNER_KINDS.includes(input.kind);
}

/** Resolve any play into its full official outcome. */
export function resolvePlay(
  state: GameState,
  input: PlayInput,
  overrides: Overrides = {},
  batterId = "batter",
): PlayResolution {
  return isRunnerInput(input)
    ? resolveRunner(state, input, overrides)
    : resolveBatter(state, input as BatterInput, overrides, batterId);
}

function resolveBatter(
  state: GameState,
  input: BatterInput,
  overrides: Overrides,
  batterId: string,
): PlayResolution {
  const adv = resolveRunnerAdvancement(state, input, overrides, batterId);
  const classification = classifyBatterPlay(state, input, adv);
  const rbi = calculateRBIs(input, classification, adv);
  const runs = adv.advances.filter((a) => a.to === 4).length + (adv.batterTo === 4 ? 1 : 0);

  const primaryErrors =
    (input.kind === "batted" || input.kind === "dropped-third" ? input.errorFielders : undefined) ?? [];
  const secondary = input.kind === "hit" || input.kind === "batted" ? input.secondary : undefined;
  const errorFielders = secondary ? [...primaryErrors, secondary.fielder] : primaryErrors;

  const fielders =
    input.kind === "batted" || input.kind === "sac-bunt" || input.kind === "dropped-third"
      ? (input.fielders ?? [])
      : [];

  const isHit = input.kind === "hit";
  const isWalk = classification === "BB" || classification === "IBB";
  const isStrikeout = classification === "K";
  const noAtBat =
    isWalk || classification === "HBP" || classification === "SF" || classification === "SH";

  return {
    classification,
    batterTo: adv.batterTo,
    advances: adv.advances,
    rbi,
    outsRecorded: adv.outsRecorded,
    runs,
    fielders,
    errorFielders,
    earnedRuns: errorFielders.length === 0,
    isHit,
    isAtBat: !noAtBat,
    isPlateAppearance: true,
    isStrikeout,
    isWalk,
    marks: adv.marks,
    uncertain: adv.uncertain,
  };
}

function resolveRunner(
  state: GameState,
  input: RunnerInput,
  overrides: Overrides,
): PlayResolution {
  const adv = resolveRunnerEvent(state, input, overrides);
  const classification = classifyRunnerPlay(input, adv);
  const errorFielders = (input.kind === "pickoff" ? input.errorFielders : undefined) ?? [];
  return {
    classification,
    batterTo: null,
    advances: adv.advances,
    rbi: RUNNER_PLAY_RBI,
    outsRecorded: adv.outsRecorded,
    runs: adv.advances.filter((a) => a.to === 4).length,
    fielders: (input.kind === "pickoff" ? input.fielders : undefined) ?? [],
    errorFielders,
    earnedRuns: errorFielders.length === 0,
    isHit: false,
    isAtBat: false,
    isPlateAppearance: false,
    isStrikeout: false,
    isWalk: false,
    marks: adv.marks,
    uncertain: [],
  };
}

/**
 * The advancement menu appears only when a surviving runner's destination is
 * genuinely uncertain — never because of the play type the scorer picked.
 */
export function needsAdvancementInput(resolution: PlayResolution): boolean {
  return resolution.uncertain.length > 0;
}

export function validate(state: GameState, input: PlayInput, resolution: PlayResolution) {
  return validatePlay(state, input, resolution);
}
