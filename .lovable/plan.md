Add a proper print/PDF output for a finished game: 3 pages, each on its own sheet.

## Pages

1. Away team scorecard (line score header + away scorebook grid)
2. Home team scorecard (line score header + home scorebook grid)
3. Full box score (line score, away batting/pitching/fielding, home batting/pitching/fielding, plus game info/decisions and feats from the summary)

## How it works

Currently the Print button just calls `window.print()`, which prints whatever tab happens to be open with screen styling. Instead:

- New `src/components/scorebook/PrintSheet.tsx` — a print-only block rendered once in the game route (`hidden print:block`). It renders all three sections regardless of the active tab, so the output never depends on which tab is visible.
- Each section wrapped in a page container with `break-after: page` (last one without), so pages break exactly at the boundaries.
- Print rules added to `src/styles.css` inside `@media print`:
  - `@page { size: letter landscape; margin: 0.4in }` — landscape so the 9+ inning grid fits without clipping.
  - Force light colors for ink (white background, black text/borders) while leaving the on-screen dark theme untouched.
  - Hide the live app shell in print (`main > *` except the print sheet) so the screen UI doesn't leak into the PDF.
  - Remove `overflow-x-auto` scroll clipping in print so wide tables print fully; scale the scorecard grid down if needed to fit page width.
- The existing "Print" button is relabeled "PDF" (still `window.print()`), which via the browser's "Save as PDF" destination produces the file fully offline.

## Technical details

- `LineScore`, `ScorebookGrid`, `BoxScore`, and `GameSummary` are reused as-is; no scoring, stats, or engine code changes.
- Box score tables get `break-inside: avoid` per table so a table isn't split mid-page if content grows; page 3 may spill to a 4th sheet only when rosters are unusually long.
- Verification: run a headless print-to-PDF of a scored game and visually check each rendered page for clipping, contrast, and correct page breaks.

## Out of scope

- Changing CSV/JSON exports.
- A custom PDF renderer (no new dependencies) — the browser print pipeline stays the mechanism.
