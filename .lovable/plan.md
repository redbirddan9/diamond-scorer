## The bug

`resolveRunnerAdvancement` in `src/lib/scoring/rules/advancement.ts` decides runner destinations without knowing whether the play's own outs end the half inning. On a ground ball where the batter is retired, an unforced runner is routinely advanced one base (line ~170), so a runner on third is sent home. `logPlay` in `src/lib/scoring/engine.ts` then credits that advance as a run before it applies the third out. With runners on first and third and two outs, a `4-3` therefore scores a run that MLB rules disallow.

Nothing in the engine currently encodes Rule 5.08(a) / 5.09: **no run scores when the third out is made by the batter-runner before reaching first base, or by any runner being forced out.** Only a genuine time play (a tag out on a non-force play) lets a run that crossed first still count.

## Fix (general, not a 4-3 special case)

All of the work stays in the rules layer so notation, RBIs, box score and scorecard all follow from one decision.

**`src/lib/scoring/rules/advancement.ts`** — at the end of `resolveRunnerAdvancement`, after `advances`, `batterTo` and `outsRecorded` are computed:

1. Determine whether this play ends the half inning: `state.outs + outsRecorded >= 3` (already computed as `inningEnds`).
2. Classify the inning-ending out. The run-negating cases are:
   - `batterTo === "out"` on a batted ball / bunt / dropped third — the batter-runner was retired before reaching first; or
   - any advance in this play with `to === "out"` and `reason === "force-out"`.
3. When the inning ends **and** the out is one of those cases, drop every non-out advance from the result (runners neither score nor move; the half inning is over and the bases clear anyway). This removes the scoring advance at its source, so `runs`, `rbi` in `src/lib/scoring/rules/rbi.ts`, and the engine's `addRun` all see zero.
4. When the inning-ending out is a **tag out** (a time play, e.g. a runner thrown out at third while another runner crosses the plate), leave the advances as they are — that run legitimately counts, and the scorer can still override it.

`resolveRunnerEvent` (steals, pickoffs, wild pitches) is untouched: those third outs are tag outs, i.e. time plays, and already behave correctly.

## Verification

Add cases to `src/lib/scoring/engine.test.ts`:
- Runners on first and third, two outs, ground ball `4-3`: away score stays 0, the inning ends, `resolution.runs === 0` and `rbi === 0`.
- Same situation with **one** out: the runner from third still scores (fewer than three outs, unchanged behaviour).
- Bases loaded, two outs, force at second (`6-4`): no run scores.
- Time play sanity check: two outs, runner tagged out on a non-force play while another runner scores — the run still counts.

Then run the full test suite and typecheck, and score the reported situation in the preview to confirm the linescore and the runner-on-third's box are correct.
