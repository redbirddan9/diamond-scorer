The user wants the keyboard navigation "box cursor" (the focused button highlight) to match the green used in the scorecard.

Background
- The scorecard green is the `--field` design token in `src/styles.css`.
  - Light mode: `oklch(0.93 0.045 143)` (seen as `fill-field/70` inside scored diamonds and `bg-field/60` on the active batter row).
  - Dark mode: `oklch(0.3 0.04 145)`.
- The spatial navigation system moves focus between buttons, so the visible "box cursor" is the browser’s `:focus-visible` / `button:focus` ring.
- That ring is defined in `src/styles.css` at lines 182–192 with `outline: 3px solid var(--color-ring);`.

Changes
1. Update the global focus ring color in `src/styles.css` from `var(--color-ring)` to `var(--color-field)` so the focused button outline matches the scorecard green family.
2. Keep the existing `outline-width` (3px) and `outline-offset` (2px) so the highlight remains visible on both light and dark backgrounds.
3. Do not change any other focus styles (inputs, selects, textareas) unless the same color is desired everywhere — the plan targets only the visible keyboard cursor.

Validation
- Navigate the game screen with arrow keys in the preview and confirm the focused button is ringed in the same green as the scorecard diamond fill.
- Check both light and dark modes to ensure the ring is still clearly distinguishable.