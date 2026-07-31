## Goal

Today only caught stealing and pickoffs draw a circle at the base corner. Extend that to **every out made on the basepaths** — forced runner on a double play, the retired runner on a fielder's choice, tag outs, plus the existing CS and PO — so the circle always appears in the retired runner's own box, at the corner where he was put out. Empty circle, no out number inside. Batter-runners retired going to first are unchanged (notation only).

## How it works

The engine already records every runner retired as an advance with `to: "out"` and a reason (`force-out`, `tag-out`, `caught-stealing`, `pickoff`). What's missing is a single derived "put-out base" for each of those, and rendering for reasons other than CS/PO.

Base where the out is drawn:

```text
force-out       -> from + 1   (runner on 1B forced at 2B)
tag-out         -> from + 1   (retired trying for the next base)
caught-stealing -> from + 1   (unchanged)
pickoff         -> from       (unchanged, out at the base he occupied)
```

## Changes

**`src/lib/scoring/scorecard.ts`**
- Replace the two narrow fields `caughtStealingAt` / `pickedOffAt` on `CellModel` with one `outOnBases?: { base: number; label?: string }`, computed in `batterProgress` for any advance where `to === "out"` and the runner is this box's batter. `label` is `"CS"` for caught stealing, `"PO"` for a pickoff, and omitted for force and tag outs (the batter's own box already shows DP / FC / the fielder chain).
- Keep the existing behaviour of stopping the progress scan once the runner is out or scores, and keep the basepath-reason labels (SB, WP, PB, BK, DI, E#) exactly as they are.

**`src/components/scorebook/ScorebookGrid.tsx`**
- Draw one shared marker from `outOnBases`: the short basepath line into that corner (as CS does today), an empty circle at the corner, and the optional CS/PO text beside it. This removes the duplicated CS and PO blocks.
- Circle radius, stroke weight and the 800x480-legible font sizes stay as they are.

**`src/lib/scoring/engine.test.ts`**
- Add cases asserting the circled base for: runner on 1B forced at 2B on a `6-4-3` double play, the retired runner on a fielder's choice (`5-4`), a caught stealing, and a pickoff.

## Verification

Run the unit tests and typecheck, then score a live double play and a fielder's choice in the preview and screenshot the grid to confirm the circle lands on the correct corner of the retired runner's box and doesn't collide with the play notation.
