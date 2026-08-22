# Usability pass: lineup entry, runner outs on hits, scorecard marks

## 1. Lineup entry (New Game page)

- **Auto-capitalize names**: as you type, each word is capitalized ("danny p" -> "Danny P"). Applied on change so the stored/recalled name is clean; typing mid-word is not disrupted.
- **Type positions by number**: the position control becomes a small typeable field next to the name. Typing `2` sets C, `7` sets LF, `D` sets DH (map: 2 C, 3 1B, 4 2B, 5 3B, 6 SS, 7 LF, 8 CF, 9 RF, 1 P, D DH). One keystroke commits and focus jumps to the next player's name field, so a whole lineup is name-Tab-number-Enter down the list.
- The 3x3 grid picker stays available (button next to the field) and now shows the number under each position label as a reminder.
- **No jump to top**: selecting a position from the grid keeps focus on that row's position control instead of falling back to the first control on the page (which is what scrolls the page up today).

## 2. Hit plus out on the bases

Today, when a runner's destination is set to "Out" in the finalize step, no detail is captured. Add a follow-up in that same panel: after choosing **Out**, pick

- **where** the runner was retired (2nd, 3rd, Home), and
- **how** — the fielder sequence, entered with the position keypad (e.g. `9 6 2` -> `9-6-2`), plus an unassisted/tag option.

The batter's result is untouched: a double with the runner thrown out at home stays **2B** for the batter, and the retired runner's box gets the circled corner at home with `9-6-2` next to it, matching the existing caught-stealing/pickoff marking style.

## 3. Play entry keys

- Inside the Strikeout menu, **Swinging is `K`** (Looking stays `L`, Dropped 3rd stays `D`). Pressing `K` twice = strikeout swinging.

## 4. Scorecard fixes

- **Substitution bar to the left**: the bold vertical rule that separates a pinch hitter from the previous hitter is drawn on the left edge of the substitute's first box, not the box after it.
- **Pitching-change triangle on the correct card**: the triangle marks the last batter the outgoing pitcher faced, so a change by the home team must appear on the away team's card. Today the marker is not filtered by which team made the change, so it appears on both cards.

## 5. General usability

- Consistent focus order on the setup page (team -> date -> stadium -> pitchers -> lineups) so arrow-key/Enter flow moves forward without surprises.
- Position field and name field share the same row height and focus highlight as the rest of the app.

## Technical notes

- `src/routes/new.tsx`: title-case helper on name change; new `PositionField` (typeable, number-mapped) replacing the plain button; keep `PositionGrid` in a popover and refocus the trigger on select.
- `src/components/scorebook/PositionGrid.tsx`: show position numbers.
- `src/lib/scoring/types.ts`: add optional `outDetails?: Partial<Record<RunnerKey, { at: Base | 4; fielders: number[] }>>` to `PlayEvent`, and carry it into `Advance` (`at`, `fielders`) so the scorecard can draw it. Existing events without it keep working.
- `src/lib/scoring/rules/advancement.ts`: when an override is `out` with detail, use `at` for the circled base and `tag-out`/`force-out` as today.
- `src/components/scorebook/ReviewPanel.tsx`: out-detail sub-panel (base buttons + fielder keypad).
- `src/lib/scoring/scorecard.ts`: `outOnBases` label from the fielder chain; fix `boundaryInning` to the substitute's first inning; filter pitching-change subs to `s.team !== side`.
- `src/components/scorebook/PlayEntry.tsx`: strikeout `hot` key change.
