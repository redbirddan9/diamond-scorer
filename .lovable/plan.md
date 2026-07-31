Move the basepath reason symbols (SB, CS, WP, PB, BK, DI, E#) and secondary-error labels away from the diamond center in `ScorebookGrid.tsx` so they are less crowded.

1. Locate the `ScoreCell` SVG text rendering inside `src/components/scorebook/ScorebookGrid.tsx` (lines 140–170).
2. Replace the current small `dx/dy` offsets (±3 horizontal, -2/4 vertical) with an outward offset from the diamond center at `(30, 32)`.
   - Compute the vector from the center to the midpoint of the basepath.
   - Normalize that vector and scale it by a larger distance (e.g., 8–10 px in the `60×60` SVG coordinate space) so the label sits clearly outside the diamond.
3. Apply the same outward-offset logic to both:
   - `reasonMarks` (SB, CS, WP, PB, BK, DI)
   - `errorAdvance` label (E# along a basepath)
4. Leave the diamond, basepath lines, out circles, and scoring notation unchanged.
5. Verify visually in the preview that the labels are now backed off from the diamond edges.