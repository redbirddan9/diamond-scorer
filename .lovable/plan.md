Implement save-rule validation, blown-save/hold tracking, and live game-feat detection (no-hitter, perfect game, shutout) in the box score and game summary.

## Why this matters

Pitching decisions (W/L/S) are already assignable, but the app does not verify whether a save is actually valid under MLB Rule 9.19, nor does it track blown saves, holds, or notable game achievements. Adding these makes the box score honest and surfaces no-hitter/perfect game/shutout status automatically as the game progresses.

## Prerequisite: fix a current runtime error

The home page is throwing `Cannot read properties of undefined (reading 'kind')` at `src/lib/scoring/rules/earned-runs.ts:21`. The earned-run reconstruction function calls `cleanBatterInput(ev.input)` on play events that may have a missing `input` in legacy/corrupted data. I will add a guard so `cleanBatterInput` and `cleanRunnerEvent` return `null` safely when `input` is undefined, which prevents the crash before the save/game-feat work begins.

## Plan

### 1. Save opportunities and eligibility

Add a new `src/lib/scoring/rules/saves.ts` module that is the single source of truth for save/hold/blown-save logic.

- **Save situation**: pitcher enters with his team leading and either (a) the lead is 3 runs or fewer, or (b) the tying run is on base, at bat, or on deck.
- **Save eligibility** (Rule 9.19): the pitcher is the finishing pitcher, is not the winning pitcher, his team wins, and he entered in a save situation.
- **Blown save**: a pitcher enters in a save situation and later leaves (or the game ends) while no longer holding the lead.
- **Hold**: a pitcher enters in a save situation, records at least one out, leaves with the lead intact, and does not get the win.

The module will read `state.subLog` to know when pitchers entered and left, and read `state.plays` to know the score at those points.

### 2. Update pitching statistics

Extend `PitchingLine` in `src/lib/scoring/stats.ts` with:

- `saveOpportunities`
- `saves`
- `blownSaves`
- `holds`

Update `pitchingStats()` to compute these by walking the substitution and play logs in chronological order, using the helpers from `saves.ts`. Keep the existing `IR`, `IRS`, and `BRS` columns untouched.

### 3. Game-feat detection

Add a `src/lib/scoring/rules/feats.ts` module that returns a list of achievements for the game:

- **No-hitter**: one team allows 0 hits in a completed game.
- **Perfect game**: one team allows no opposing runner to reach base in a completed game (no hits, walks, HBP, errors, catcher's interference, or other reach).
- **Shutout**: one team wins while allowing 0 runs.

Expose a `gameFeats(state)` function that returns labels such as `{ team: "away", feat: "perfect-game" }`.

### 4. UI updates

In `src/components/scorebook/BoxScore.tsx`:

- Add `SV`, `BS`, and `HLD` columns to the pitching table.
- Keep `W/L/S` badges from the existing decisions UI.

In `src/components/scorebook/GameSummary.tsx`:

- Display any `gameFeats` as badges above the final score (e.g., "Perfect Game", "No-Hitter", "Shutout").
- Keep the pitching-decisions section but do not block it; save validation is informational.

### 5. Tests

Add tests to `src/lib/scoring/engine.test.ts` covering:

- A valid save (3-run lead, 1 inning pitched, not the winning pitcher).
- A blown save (pitcher enters with a 1-run lead and the lead is lost).
- A hold (setup man gets an out and leaves with the lead).
- A perfect game detected at the end of a game.
- A no-hitter that is not a perfect game.
- A shutout.

## Technical details

- Save/hold logic depends on the existing `subLog` and `plays` arrays, so no new event types are needed.
- The manual `PitchingDecisions` object in `GameSetup` remains the source of truth for W/L/S; the new save-eligibility logic only computes the derived `SV/BS/HLD` counts.
- The game-feat detection runs after the game is final; it reads the reduced `GameState` rather than adding new events.

## Out of scope

- Changing the manual W/L/S picker; we will still let the scorer assign decisions, but the derived save stats will make invalid choices obvious.
- DH enforcement, batting out of order, or infield fly rule; those are separate features and will be deferred.