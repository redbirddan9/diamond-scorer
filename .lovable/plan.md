Right now the portrait PDF fills the page width but only about a third of the height: the scorecard cells are locked to a fixed height (`h-14` on the inning cells in `ScorebookGrid.tsx`), and the box-score tables use tight row padding, so pages 1–3 all end with a large blank bottom area.

## 1. Make each print page a full-height box

In `src/styles.css` (`@media print`):

- Give `.print-page` an explicit printable height (letter minus margins, ~10.3in) with `display: flex; flex-direction: column;` so its children can be told to absorb the leftover space.
- Bump the print root font size from 8px to ~10px, since the extra room means we no longer need to shrink text to fit width.

## 2. Pages 1 and 2 — scorecard fills the sheet

- In `PrintSheet.tsx`, wrap the `ScorebookGrid` in a `print-fill` container that is the flex-grow child of the page.
- Print-only CSS: inside `.print-fill`, the scorebook table gets `height: 100%`, and the inning cells' fixed height is overridden (`height: auto`) so the 9 batting rows divide the remaining vertical space evenly. The diamond SVG in each cell already scales to its box (`h-full w-full`, `viewBox 0 0 60 60`), so bigger cells mean bigger, clearer diamonds and notation with no code changes to the drawing logic.
- Team-name column stays proportional so names don't clip.

## 3. Page 3 — box score fills the sheet

- Make the stacked away/home box-score block the flex-grow child.
- Print-only CSS increases cell padding and line-height for the batting/pitching/fielding tables so the three sections spread down the page instead of bunching at the top, and the umpires/notes footer sits at the bottom.
- Keep each section unbroken (`break-inside: avoid`) so nothing spills onto a 4th page.

## Verification

Regenerate the PDF from a real scored game in a headless browser, render all pages to images, and confirm: exactly 3 pages, each visibly filled top to bottom, no clipping, no overflow to a 4th page, and diamonds/notation legible.

## Out of scope

- Screen (non-print) layout stays exactly as it is.
- No changes to scoring logic, stats, or notation rendering.
