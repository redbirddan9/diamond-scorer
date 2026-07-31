/**
 * Runner Advancement Engine — the single source of truth for where every
 * runner ends up. Nothing else in the app may move a runner.
 */
import type {
  Advance,
  AdvanceReason,
  Base,
  BatterInput,
  Destination,
  GameState,
  OutTarget,
  RunnerInput,
  RunnerKey,
} from "../types";
import { BASES, advanceBy, forcedBases, keyForBase, occupiedBases } from "./situation";

export interface AdvancementResult {
  advances: Advance[];
  /** null when the play has no batter. */
  batterTo: Destination | null;
  outsRecorded: number;
  /** Runners whose destination the scorer must confirm. */
  uncertain: RunnerKey[];
}

type Overrides = Partial<Record<RunnerKey, Destination>>;

const AIR: string[] = ["fly", "line", "popup"];

function retiredTargets(input: BatterInput): OutTarget[] {
  if (input.kind === "batted") return input.retired;
  if (input.kind === "sac-bunt") return input.retired ?? ["batter"];
  if (input.kind === "dropped-third") return input.batterSafe ? [] : ["batter"];
  if (input.kind === "strikeout") return ["batter"];
  return [];
}

function reasonFor(input: BatterInput): AdvanceReason {
  switch (input.kind) {
    case "hit":
      return "hit";
    case "walk":
    case "hbp":
    case "catcher-interference":
      return "walk";
    case "sac-bunt":
      return "sacrifice";
    case "dropped-third":
      return input.cause === "passed-ball" ? "passed-ball" : "wild-pitch";
    case "batted":
      return input.errorFielders?.length ? "error" : "fielders-choice";
    default:
      return "other";
  }
}

/** Where the batter ends up before any override. */
function defaultBatterTo(input: BatterInput, retired: OutTarget[]): Destination {
  if (retired.includes("batter")) return "out";
  switch (input.kind) {
    case "hit":
      return input.bases as Destination;
    case "walk":
    case "hbp":
    case "catcher-interference":
    case "dropped-third":
      return 1;
    case "batted":
    case "sac-bunt":
      return 1;
    default:
      return "out";
  }
}

/** Resolve every runner movement for a batter play. */
export function resolveRunnerAdvancement(
  state: GameState,
  input: BatterInput,
  overrides: Overrides = {},
): AdvancementResult {
  const bases = state.bases;
  const retired = retiredTargets(input);
  const batterTo = overrides.batter ?? defaultBatterTo(input, retired);
  const batterReaches = batterTo !== "out";
  const reason = reasonFor(input);

  const retiredBases = new Set<Base>(retired.filter((r): r is Base => r !== "batter"));
  const survivors = new Set<Base>(occupiedBases(bases).filter((b) => !retiredBases.has(b)));
  const forced = batterReaches ? forcedBases(bases, survivors) : [];

  const isAir = input.kind === "batted" && AIR.includes(input.batted);
  const hasError = Boolean(
    (input.kind === "batted" || input.kind === "dropped-third") && input.errorFielders?.length,
  );

  const advances: Advance[] = [];
  const uncertain: RunnerKey[] = [];

  for (const from of BASES) {
    const runnerId = bases[from];
    if (!runnerId) continue;
    const key = keyForBase(from);

    if (retiredBases.has(from)) {
      advances.push({ runnerId, from, to: "out", reason: forcedOrTag(bases, from, forced) });
      continue;
    }

    let to: Destination = from as unknown as Destination;
    let certain = false;

    switch (input.kind) {
      case "hit": {
        to = advanceBy(from, input.bases);
        certain = input.bases >= 3 || to === 4 || Boolean(input.groundRule);
        break;
      }
      case "walk":
      case "hbp":
      case "catcher-interference": {
        to = forced.includes(from) ? advanceBy(from, 1) : (from as unknown as Destination);
        certain = true;
        break;
      }
      case "strikeout": {
        to = from as unknown as Destination;
        certain = true;
        break;
      }
      case "dropped-third": {
        to = forced.includes(from) || !batterReaches ? advanceBy(from, 1) : (from as unknown as Destination);
        certain = forced.includes(from);
        break;
      }
      case "sac-bunt": {
        to = advanceBy(from, 1);
        certain = true;
        break;
      }
      case "batted": {
        if (forced.includes(from)) {
          to = advanceBy(from, 1);
          certain = true;
        } else if (hasError) {
          to = advanceBy(from, 1);
          certain = false;
        } else if (isAir) {
          to = from as unknown as Destination;
          certain = false;
        } else {
          // ground ball with the batter retired: runners take the next base
          to = batterReaches ? (from as unknown as Destination) : advanceBy(from, 1);
          certain = false;
        }
        break;
      }
    }

    const override = overrides[key];
    if (override !== undefined) {
      to = override;
      certain = true;
    }
    if (!certain) uncertain.push(key);
    if (to !== (from as unknown as Destination)) {
      advances.push({ runnerId, from, to, reason: to === "out" ? "tag-out" : reason });
    }
  }

  const outsRecorded =
    advances.filter((a) => a.to === "out").length + (batterTo === "out" ? 1 : 0);

  // No decisions are needed once the half inning is over.
  const inningEnds = state.outs + outsRecorded >= 3;
  return {
    advances,
    batterTo,
    outsRecorded,
    uncertain: inningEnds ? [] : uncertain,
  };
}

function forcedOrTag(
  bases: Record<Base, string | null>,
  from: Base,
  forced: Base[],
): AdvanceReason {
  return forced.includes(from) ? "force-out" : "tag-out";
}

/** Resolve runner-only plays (steals, wild pitches, balks, pickoffs …). */
export function resolveRunnerEvent(
  state: GameState,
  input: RunnerInput,
  overrides: Overrides = {},
): AdvancementResult {
  const bases = state.bases;
  const advances: Advance[] = [];

  const push = (from: Base, to: Destination, reason: AdvanceReason) => {
    const runnerId = bases[from];
    if (!runnerId) return;
    const override = overrides[keyForBase(from)];
    advances.push({ runnerId, from, to: override ?? to, reason });
  };

  switch (input.kind) {
    case "steal":
      for (const attempt of input.attempts) {
        push(
          attempt.from,
          attempt.safe ? advanceBy(attempt.from, 1) : "out",
          attempt.safe ? "stolen-base" : "caught-stealing",
        );
      }
      break;
    case "wild-pitch":
    case "passed-ball":
      for (const from of occupiedBases(bases)) {
        push(from, advanceBy(from, 1), input.kind === "wild-pitch" ? "wild-pitch" : "passed-ball");
      }
      break;
    case "balk":
      for (const from of occupiedBases(bases)) push(from, advanceBy(from, 1), "balk");
      break;
    case "defensive-indifference":
      push(input.from, advanceBy(input.from, 1), "defensive-indifference");
      break;
    case "pickoff":
      push(
        input.from,
        input.out ? "out" : input.errorFielders?.length ? advanceBy(input.from, 1) : (input.from as unknown as Destination),
        input.out ? "pickoff" : "error",
      );
      break;
  }

  const kept = advances.filter((a) => a.to !== (a.from as unknown as Destination));
  return {
    advances: kept,
    batterTo: null,
    outsRecorded: kept.filter((a) => a.to === "out").length,
    uncertain: [],
  };
}
