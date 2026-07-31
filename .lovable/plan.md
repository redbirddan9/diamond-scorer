Plan: Earned Run Reconstruction + Inherited Runners

Goals
1. Make ERA accurate by reconstructing each half-inning without errors/passed balls/catcher's interference to decide earned vs. unearned runs.
2. Track which pitcher is responsible for runners who score after a pitching change, and expose inherited/bequeathed runner stats.

Both features stay inside the rules/stat layer; the scorecard UI and play-entry flow do not change.

Data model changes

- `src/lib/scoring/types.ts`
  - Add `EarnedRunRecord` to the resolved `PlayResolution` or compute it at stats time. Keep events immutable; derived state is enough.
  - Add `runnerResponsibility` to `GameState`: a map of runnerId -> pitcherId who originally allowed that runner to reach base.
  - Add `BaseRunner` metadata: when a runner reaches base, record the pitcher on the mound and whether the reach was earned.
  - Add `PitchingDecisions`/`PitchingLine` fields: `inheritedRunners`, `inheritedRunnersScored`, `bequeathedRunnersScored`, `earnedRuns`, `unearnedRuns`.

Rules engine changes

- `src/lib/scoring/engine.ts`
  - When a batter reaches base, store the current pitcherId as the responsible pitcher for that runner.
  - When a runner advances due to error/passed ball/catcher's interference, flag the runner as "tainted" so any run he scores is unearned.
  - When a pitcher substitution occurs, mark live runners as bequeathed by the outgoing pitcher and inherited by the incoming pitcher.
  - When a run scores, record the responsible pitcher and whether the runner is tainted.

- `src/lib/scoring/rules/earned-runs.ts` (new)
  - For each half-inning, replay the events with errors/passed balls/catcher's interference removed.
  - Treat `errorFielders` on batted balls, hit+error, dropped-third errors, and catcher's interference as "no error".
  - Treat passed-ball advances as "no advance".
  - Compare reconstructed runs to actual runs in the same half-inning. Runs up to the reconstructed count are earned; excess runs are unearned.
  - Edge case: if the inning would have ended sooner without the error, all subsequent runs are unearned.
  - Return a per-play `earnedRuns` count (0..N) that replaces the current boolean.

- `src/lib/scoring/rules/validate.ts`
  - Add validation: a pitcher cannot be charged with more earned runs than his reconstructed inning allows.

Stats changes

- `src/lib/scoring/stats.ts`
  - Update `pitchingStats` to compute earned/unearned runs from the new per-play records.
  - Add `inheritedRunners` count for each reliever: runners on base when he entered.
  - Add `inheritedRunnersScored`: runners who scored while he was pitching and were originally put on by the previous pitcher.
  - Add `bequeathedRunnersScored`: runners originally put on by this pitcher who scored after he left.
  - Compute `ERA` using `earnedRuns` instead of total runs.
  - Add `BlownSave`/`QualityStart` detection as optional follow-ups only if trivial to add.

UI changes

- `src/components/scorebook/BoxScore.tsx` or `GameSummary.tsx`
  - Pitching line: split `R` into `ER` and `UER`, or show `R / ER`.
  - Add small columns for `IRS` (inherited runners scored) and `BRS` (bequeathed runners scored) if screen width allows; otherwise show in a detail modal.
  - Keep the 800x480 touch targets in mind; hide extra columns behind a "pitching details" toggle if needed.

Testing

- `src/lib/scoring/engine.test.ts`
  - Add cases:
    - Error with two outs, runner scores after error -> run is unearned.
    - Error with no outs, same inning continues, next batter hits a home run -> HR run is earned.
    - Pitching change with runner on first; runner scores on next hit -> original pitcher charged with run, reliever gets inherited runner scored.
    - Passed ball on third strike, runner reaches -> any run scored by that runner is unearned.

Implementation order

1. Data model: `runnerResponsibility`, tainted-runner tracking, per-play `earnedRuns` count.
2. New `earned-runs.ts` reconstruction engine.
3. Update `engine.ts` to assign pitcher responsibility and apply reconstruction results.
4. Update `stats.ts` pitching lines with ER/UER, inherited, bequeathed.
5. Update box score UI to display the new pitching columns.
6. Add tests and verify with a full 9-inning game replay.