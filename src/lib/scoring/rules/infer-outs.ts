/**
 * Out Inference — reads the fielding sequence and the base situation to decide
 * WHO was retired, so the scorer never answers an obvious question.
 *
 * The base a fielder covers on the final throw identifies the put-out:
 *   3 -> first (batter), 4/6 -> second, 5 -> third, 2 -> home.
 */
import type { Base, BaseMap, BattedBallType, OutTarget } from "../types";
import { forcedBases, occupiedBases } from "./situation";

/** Base a fielder is covering when he receives the ball for a put-out. */
const COVERS: Record<number, 1 | 2 | 3 | 4> = {
  2: 4,
  3: 1,
  4: 2,
  5: 3,
  6: 2,
};

const GROUND: BattedBallType[] = ["ground", "bunt"];

/** The runner (or batter) forced out at `base`, given who is aboard. */
function forcedAt(bases: BaseMap, base: 1 | 2 | 3 | 4): OutTarget | null {
  if (base === 1) return "batter";
  const from = (base - 1) as Base;
  if (!bases[from]) return null;
  // Every base behind the runner must be occupied for the force to reach him.
  const forced = forcedBases(bases, new Set<Base>(occupiedBases(bases)));
  return forced.includes(from) ? from : null;
}

/**
 * Retired targets implied by a ground ball fielding sequence, or `null` when
 * the sequence is ambiguous and the scorer must say who was out.
 */
export function inferRetired(
  bases: BaseMap,
  batted: BattedBallType,
  fielders: number[],
): OutTarget[] | null {
  if (!GROUND.includes(batted) || fielders.length === 0) return null;

  // Unassisted (single fielder): a put-out at the base he covers.
  if (fielders.length === 1) {
    const covered = COVERS[fielders[0]];
    if (!covered) return null;
    const target = forcedAt(bases, covered);
    return target === null ? null : [target];
  }

  // Each receiver after the fielder who handled the ball may record a put-out
  // at the base he covers, provided a forced runner was heading there.
  const retired: OutTarget[] = [];
  for (const f of fielders.slice(1)) {
    const covered = COVERS[f];
    if (!covered) return null;
    const target = forcedAt(bases, covered);
    if (target === null) return null;
    if (!retired.includes(target)) retired.push(target);
  }
  if (!retired.length) return null;
  return retired;
}