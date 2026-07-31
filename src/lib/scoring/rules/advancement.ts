/**
 * Runner Advancement Engine — the single source of truth for where every
 * runner ends up. Nothing else in the app may move a runner.
 */
import type {
  Advance,
  AdvanceReason,
  Base,
  BasepathMark,
  BatterInput,
  Destination,
  GameState,
  OutTarget,
  RunnerInput,
  RunnerKey,
  SecondaryError,
} from "../types";
import { BASES, advanceBy, forcedBases, keyForBase, occupiedBases } from "./situation";

export interface AdvancementResult {
  advances: Advance[];
  /** null when the play has no batter. */
  batterTo: Destination | null;
  outsRecorded: number;
  marks: BasepathMark[];
  /** Runners whose destination the scorer must confirm. */
  uncertain: RunnerKey[];
}

type Overrides = Partial<Record<RunnerKey, Destination>>;

/** Caught-ball trajectories — the batter is retired in the air. */
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
    case "dropped-third":
    case "batted":
    case "sac-bunt":
      return 1;
    default:
      return "out";
  }
}

function bump(to: Destination, bases: number): Destination {
  if (to === "out" || to === 4) return to;
  const next = to + bases;
  return (next >= 4 ? 4 : next) as Destination;
}

/**
 * Official Rule 5.08(a) — third-out timing.
 *
 * No run may score if the third out of the inning is made by the batter-runner
 * before reaching first base, or by any runner forced out. A third out made by
 * tagging a trailing runner does not nullify runs that crossed the plate first.
 */
function applyThirdOutRule(
  state: GameState,
  advances: Advance[],
  batterTo: Destination | null,
): { advances: Advance[]; batterTo: Destination | null } {
  const outsRecorded = advances.filter((a) => a.to === "out").length + (batterTo === "out" ? 1 : 0);
  if (state.outs + outsRecorded < 3) return { advances, batterTo };

  const batterRetired = batterTo === "out";
  const forceOut = advances.some((a) => a.to === "out" && a.reason === "force-out");
  if (!batterRetired && !forceOut) return { advances, batterTo };

  // Runs are wiped: surviving runners are simply stranded where they were.
  return {
    advances: advances.filter((a) => a.to !== 4),
    batterTo: batterTo === 4 ? null : batterTo,
  };
}

/** Apply a secondary error to an already-resolved play. */
function applySecondary(
  bases: Record<Base, string | null>,
  secondary: SecondaryError,
  advances: Advance[],
  batterTo: Destination | null,
  batterId: string,
  marks: BasepathMark[],
): { advances: Advance[]; batterTo: Destination | null } {
  const extra = secondary.bases ?? 1;
  const label = `E${secondary.fielder}`;

  if (secondary.runner === "batter") {
    if (batterTo === "out" || batterTo === null) return { advances, batterTo };
    const to = bump(batterTo, extra);
    marks.push({ runnerId: batterId, base: to === 4 ? 4 : to, label });
    return { advances, batterTo: to };
  }

  const from = Number(secondary.runner) as Base;
  const runnerId = bases[from];
  if (!runnerId) return { advances, batterTo };
  const existing = advances.find((a) => a.from === from);
  const current: Destination = existing ? existing.to : (from as Destination);
  if (current === "out") return { advances, batterTo };
  const to = bump(current, extra);
  marks.push({ runnerId, base: to === 4 ? 4 : to, label });
  const next = advances.filter((a) => a.from !== from);
  next.push({ runnerId, from, to, reason: "error", errorFielder: secondary.fielder });
  return { advances: next, batterTo };
}

/** Resolve every runner movement for a batter play. */
export function resolveRunnerAdvancement(
  state: GameState,
  input: BatterInput,
  overrides: Overrides = {},
  batterId = "batter",
): AdvancementResult {
  const bases = state.bases;
  const retired = retiredTargets(input);
  let batterTo: Destination | null = overrides.batter ?? defaultBatterTo(input, retired);
  const batterReaches = batterTo !== "out";
  const reason = reasonFor(input);

  const retiredBases = new Set<Base>(retired.filter((r): r is Base => r !== "batter"));
  const survivors = new Set<Base>(occupiedBases(bases).filter((b) => !retiredBases.has(b)));
  const forced = batterReaches ? forcedBases(bases, survivors) : [];

  const isAir = input.kind === "batted" && AIR.includes(input.batted);
  const hasError = Boolean(
    (input.kind === "batted" || input.kind === "dropped-third") && input.errorFielders?.length,
  );

  let advances: Advance[] = [];
  const marks: BasepathMark[] = [];
  const uncertain: RunnerKey[] = [];

  for (const from of BASES) {
    const runnerId = bases[from];
    if (!runnerId) continue;
    const key = keyForBase(from);

    if (retiredBases.has(from)) {
      const forceOut = forcedBases(bases, new Set(occupiedBases(bases))).includes(from);
      advances.push({ runnerId, from, to: "out", reason: forceOut ? "force-out" : "tag-out" });
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
      case "hbp": {
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
        to =
          forced.includes(from) || !batterReaches
            ? advanceBy(from, 1)
            : (from as unknown as Destination);
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
          // Caught ball: the runner may hold or tag up — scorer decides.
          to = from as unknown as Destination;
          certain = false;
        } else {
          // Ground ball with the batter retired: runners take the next base.
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

  const secondary = input.kind === "hit" || input.kind === "batted" ? input.secondary : undefined;
  if (secondary) {
    const applied = applySecondary(bases, secondary, advances, batterTo, batterId, marks);
    advances = applied.advances;
    batterTo = applied.batterTo;
  }

  const settled = applyThirdOutRule(state, advances, batterTo);
  advances = settled.advances;
  batterTo = settled.batterTo;

  const outsRecorded = advances.filter((a) => a.to === "out").length + (batterTo === "out" ? 1 : 0);

  // No decisions are needed once the half inning is over.
  const inningEnds = state.outs + outsRecorded >= 3;
  return {
    advances,
    batterTo,
    outsRecorded,
    marks,
    uncertain: inningEnds ? [] : uncertain,
  };
}

const RUNNER_LABEL: Partial<Record<AdvanceReason, string>> = {
  "stolen-base": "SB",
  "caught-stealing": "CS",
  "wild-pitch": "WP",
  "passed-ball": "PB",
  balk: "BK",
  "defensive-indifference": "DI",
  pickoff: "PO",
};

/** Resolve runner-only plays (steals, wild pitches, balks, pickoffs …). */
export function resolveRunnerEvent(
  state: GameState,
  input: RunnerInput,
  overrides: Overrides = {},
): AdvancementResult {
  const bases = state.bases;
  const advances: Advance[] = [];
  const marks: BasepathMark[] = [];

  const push = (from: Base, to: Destination, reason: AdvanceReason, errorFielder?: number) => {
    const runnerId = bases[from];
    if (!runnerId) return;
    const override = overrides[keyForBase(from)];
    const dest = override ?? to;
    advances.push({ runnerId, from, to: dest, reason, errorFielder });
    const label = errorFielder ? `E${errorFielder}` : RUNNER_LABEL[reason];
    if (label) {
      marks.push({
        runnerId,
        base: dest === "out" ? Math.min(from + 1, 4) : dest,
        label,
        out: dest === "out",
      });
    }
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
      // No safe/out decision: the defense conceded the base.
      for (const from of input.runners) push(from, advanceBy(from, 1), "defensive-indifference");
      break;
    case "pickoff":
      if (input.out) push(input.from, "out", "pickoff");
      else if (input.errorFielders?.length)
        push(input.from, advanceBy(input.from, 1), "error", input.errorFielders[0]);
      break;
  }

  const kept = advances.filter((a) => a.to !== (a.from as unknown as Destination));
  const settled = applyThirdOutRule(state, kept, null);

  return {
    advances: settled.advances,
    batterTo: null,
    outsRecorded: settled.advances.filter((a) => a.to === "out").length,
    marks,
    uncertain: [],
  };
}
