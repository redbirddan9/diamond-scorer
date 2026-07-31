import { describe, expect, it } from "vitest";
import { resolvePlay } from "@/lib/scoring/rules";
import { notationParts } from "@/lib/scoring/notation";
const state: any = { outs: 0, inning: 1, bases: { 1: "r1", 2: null, 3: null }, setup: {} };
describe("fc", () => {
  it("runner forced at second, batter safe", () => {
    const r = resolvePlay(state, { kind: "batted", batted: "ground", fielders: [6,4], retired: [1] } as any);
    console.log(r.classification, r.outsRecorded, r.batterTo, notationParts({ input: { kind: "batted", batted: "ground" }, resolution: r } as any));
    expect(r.classification).toBe("FC");
  });
});
