# Simplify lineup entry + "N" shortcut for New Game

## Roster editor cleanup
In the lineup sections on the New Game screen:
- Remove the "Save roster" button.
- Remove the "Load roster…" dropdown (it only exists to load saved rosters).
- Keep the name field and the position picker grid for each of the nine spots.
- Keep the as-you-type name suggestions — typed names are still remembered per player, so autocomplete keeps working.

## "N" opens New Game
On the home (library) screen, pressing `N` navigates to the New Game screen.
- Ignored while typing in the search box or any text field, and when a modifier key (Cmd/Ctrl/Alt) is held.
- The visible New Game button stays clickable and arrow-key focusable; the shortcut is an addition.
- Add a small "N" hint on the button so it's discoverable.

## Technical notes
- `src/routes/new.tsx`: drop `loadTemplates` / `saveTemplate` imports, the `templates` state, and the `templates` / `onSaveTemplate` props on `RosterEditor`; keep `loadRecall("players")` and the `rememberRecall` on blur.
- `src/routes/index.tsx`: add a `keydown` listener that checks `isTextField` from `src/lib/keyboard/spatial-nav.ts` before routing to `/new` via `useNavigate`.
- Leave the template helpers in `src/lib/storage/games.ts` in place (unused, no behavior change) unless removal is preferred.
