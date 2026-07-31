## What's wrong today

Verified in the code: on a batted ball with anyone on base, `PlayEntry` always stops at a "who was retired?" step with the batter pre-selected (`src/components/scorebook/PlayEntry.tsx`). Nothing reads the fielder chain, so:

- `5-3` with a runner on first forces you to answer an obvious question (the throw went to first — the batter is out).
- If you tap the 1st-base runner without deselecting the batter you get two outs and `DP`, which is why FC never appeared.

The rules layer itself is fine: given `retired: [1]` with the batter safe, `resolvePlay` already returns `FC` and `notationParts` returns `{ above: "FC", main: "5-4" }`. The bug is that the UI never sends that input.

## The inference rule

The last fielder in the chain tells you which base the ball was thrown to, and the situation tells you who could be retired there:

```text
last fielder   base covered   who is retired there
3 (or 1u/3u)   first          the batter
4 or 6         second         runner from first (force)
5              third          runner from second (force, needs 1st also occupied)
2              home           runner from third (force, bases loaded)
```

Applied to ground balls / bunts:

- `5-3`, runner on first → batter out at first. Unforced runner on first advances to second (routine). No FC, no prompt. Scores `5-3`.
- `5-4`, runner on first → force at second, batter safe → `FC 5-4`, one out, batter on first. No prompt.
- `6-4-3` or `5-4-3`, runner on first → put-out at second *and* at first → `DP`, two outs. No prompt.
- `4-6-2-5`-style oddities, or a chain whose ending base has no eligible runner → still ambiguous, so the picker opens as it does now (with nothing pre-selected).

Caught balls in the air (pop/line/pop foul) keep today's behavior: the batter is out, runners may tag up, and the review panel handles uncertain runners.

## Implementation

1. New pure helper `inferRetired(state, batted, fielders)` in `src/lib/scoring/rules/` (own module, exported through `rules/index.ts`): returns either a confident `OutTarget[]` per the table above, or `null` when the chain can't be read.
2. `PlayEntry.finishFielders` calls it for the ground/bunt out flow: if it returns a list, commit `{ kind: "batted", batted, fielders, retired }` straight away — no extra tap. If it returns `null`, open the existing retired picker with `retired` starting empty and "Record Play" disabled until at least one out is selected.
3. Keep a manual escape hatch: an "Adjust outs" button on the confirmation-free path is not needed since Undo exists, but the retired picker stays reachable for ambiguous chains and keeps its live "Scores as FC 5-4 / DP 5-4-3" preview.
4. No changes to `classify.ts`, `advancement.ts`, `rbi.ts`, or `notation.ts` — FC/DP/TP detection stays the single source of truth.

## Verification

- Unit tests in `src/lib/scoring/engine.test.ts` for the four cases above: `5-3` with runner on first → `OUT`, runner ends on second; `5-4` → `FC`, batter on first; `6-4-3` → `DP`; empty chain-target case → ambiguous.
- Then drive the running app: runner on first, record ground out `5-4`, and screenshot the scorecard cell to confirm `FC` renders above `5-4` and is legible at 800x480; bump the `above` label size in `ScorebookGrid.tsx` only if it's too small.
