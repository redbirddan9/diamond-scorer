## Goal

The printed pages currently stretch edge to edge, so the scorecard looks bulky rather than like a real paper scorebook. Add margins and internal breathing room while keeping the 3-page portrait output.

## Changes (print-only, `src/styles.css` `@media print`)

1. **Wider page margins** — bump `@page` margin from `0.35in` to `0.6in` and reduce `.print-page` height to match (~9.8in), so every sheet has a visible white border.

2. **Stop over-stretching the grid** — instead of forcing the scorebook table to `height: 100%`, cap it: set a maximum row height for inning cells (roughly `0.62in`) so the 9 batting rows stay proportional and the diamonds keep a squarer, hand-drawn look. If the rows don't consume the full page, the leftover space becomes bottom whitespace rather than oversized cells.

3. **Paper-like framing** — give the scorecard block a light outer padding and a thin outer rule around the grid, with the header (teams, date, line score) separated by a bit more vertical space, mirroring a printed scorebook.

4. **Box score page** — same margin change applies; keep sections spread but reduce the extra cell padding slightly so the tables read as a compact stat block with white space around them instead of a stretched full-bleed table.

## Verification

Regenerate the PDF from a scored game in a headless browser, render each page to an image, and confirm: exactly 3 pages, clear white margin on all four sides, square-ish diamonds, no clipping, nothing spilling to a 4th page.

## Out of scope

Screen (non-print) layout, scoring logic, stats, and notation rendering all stay unchanged.
