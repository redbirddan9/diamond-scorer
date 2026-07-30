/** Base/force primitives. Single source of truth for force situations. */
import type { Base, Destination, RunnerKey } from "../types";

export const BASES: Base[] = [1, 2, 3];

export type BaseMap = Record<Base, string | null>;

export function occupiedBases(bases: BaseMap): Base[] {
  return BASES.filter((b) => Boolean(bases[b]));
}

export function keyForBase(base: Base): RunnerKey {
  return String(base) as RunnerKey;
}

export function baseFromKey(key: RunnerKey): Base | null {
  return key === "batter" ? null : (Number(key) as Base);
}

/**
 * Bases whose runner is forced to advance, given the batter reaches first base
 * and `survivors` are the runners still on the basepaths.
 */
export function forcedBases(bases: BaseMap, survivors: Set<Base>): Base[] {
  const forced: Base[] = [];
  for (const b of BASES) {
    const occupied = Boolean(bases[b]) && survivors.has(b);
    if (!occupied) break;
    forced.push(b);
  }
  return forced;
}

export function isForced(bases: BaseMap, base: Base, survivors: Set<Base>): boolean {
  return forcedBases(bases, survivors).includes(base);
}

export function advanceBy(from: Base, count: number): Destination {
  const to = from + count;
  return (to >= 4 ? 4 : to) as Destination;
}
