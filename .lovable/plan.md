## Goal

The Advancement/RBI menu should appear exactly when a runner's destination is a judgment call — most importantly the case you raised: single with a runner on first, and the fast runner takes third. Today hits are treated as always "certain" (base-for-base), so that menu never appears and the runner is forced to second.

## Changes (advancement engine only)

All edits are in `src/lib/scoring/rules/advancement.ts`, in the `uncertain` determination. Destinations, RBI, classification, notation, and the scorecard stay exactly as they are.

1. **Hits: prompt when extra bases are physically possible.**
   For each surviving runner on a single/double/triple, the default stays base-for-base, but the runner is flagged uncertain when they could take at least one extra base and still be on the field (i.e. default destination is not home). Examples:
   - Single, runner on 1st → prompt (2nd, 3rd, or home available).
   - Single, runner on 2nd → prompt (3rd or home).
   - Double, runner on 1st → prompt (3rd or home).
   - Triple, runner on 1st/2nd/3rd → default is home, no prompt.
   - Home run → all runners score, no prompt.
   - Bases empty → no prompt (batter's own extra bases are recorded by the hit itself).

2. **Keep everything already automatic silent.** No prompt for walks/HBP/CI, strikeouts, forced runners, routine ground outs, sacrifice bunts, dropped third strikes, any play that ends the half inning, or plays where all runner outcomes are determined (force double play / triple play).

3. **Keep existing prompts that are genuine judgment calls:** tag-up on a caught fly/line/pop with the batter out, extra bases on an error (primary or secondary error on a hit).

4. **Runner-only plays** (SB/CS, WP, PB, balk, DI, pickoff) remain unprompted — the scorer already picked the outcome.

## Verification

Add cases to `src/lib/scoring/engine.test.ts`:
- single with runner on 1st → `uncertain` contains that runner; overriding them to 3rd yields runner on 3rd, batter on 1st, 0 RBI.
- single with runner on 2nd overridden to home → 1 run, 1 RBI (RBI still automatic).
- home run with runners, walk with runner on 1st, routine 6-4-3 double play, and third-out plays → `uncertain` stays empty.
Then run the test suite and typecheck.
