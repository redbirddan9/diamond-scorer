## Goal

Run the entire app with only Arrow keys, Enter, and Backspace — no mouse, on the 800x480 Pi touchscreen. Existing letter hotkeys (B/S/F, H/K/W, position digits) stay as fast shortcuts; arrows become the guaranteed fallback for every screen.

## How it works

A single spatial-navigation layer, not per-component key handling:

```text
Arrow keys  -> move focus to nearest focusable element in that direction
Enter       -> activate focused element (button, link, checkbox, open picker)
Backspace   -> go back one level (submenu -> menu, panel -> cancel, page -> library)
```

- Focus is driven by real DOM focus, so it works for every existing button/link with no rewrite of each screen.
- Direction is resolved geometrically (element bounding boxes), so the 3x3 position grid, 5-wide fielder pad, and tab bar all behave the way they look, including wrapping at row ends.
- A high-contrast focus ring is added so the current target is always obvious on the small display.
- On text inputs (roster names, setup fields, team search) arrows and Backspace behave normally for editing; Enter commits and moves to the next field, and Down/Up jumps between fields. A dedicated key (Enter on the last field, or Escape) leaves the field so arrows resume navigation.

## Screen-by-screen

- **Library (`/`)**: arrows move between game cards and the New Game button; Enter opens; Backspace does nothing (top level).
- **New game (`/new`)**: arrows walk teams -> date/stadium -> pitcher -> extra info -> roster rows; team picker is fully arrow-driven (type to filter, arrows through results, Enter selects); roster position 3x3 grid is arrow-navigable.
- **Scoring (`/game/$gameId`)**: arrows move within the current play keypad grid; Enter selects; Backspace = the existing back/cancel behavior in the play tree, flows, review panel, ABS panel, substitution panel, and position assignment.
- **Tabs (Away/Home/Box/Plays)**: reachable by arrowing up out of the keypad; Left/Right switches tabs when focused.
- **Footer actions** (Undo/Redo/PDF/CSV/JSON): reachable by arrowing down past the tabs.

## Discoverability

- A small always-visible hint line: `↑↓←→ move · Enter select · Backspace back`.
- Focus is auto-placed on the most likely next target when a screen or stage changes (e.g. first key of a new submenu, first empty roster name), so the user never has to hunt.

## Technical notes

- New `src/lib/keyboard/spatial-nav.ts` (geometry-based next-target resolver) plus a `useSpatialNav()` hook mounted once in `src/routes/__root.tsx`.
- Backspace routing: a lightweight back-handler stack (`registerBackHandler`) so `PlayEntry`, `ReviewPanel`, `AbsPanel`, `SubstitutionPanel`, `PositionAssign`, `TeamPicker`, and route level each push their own "back" behavior; Backspace calls the topmost one.
- Existing hotkey handlers in `game.$gameId.tsx` and `PlayEntry.tsx` are kept; the nav layer runs after them and ignores keys they consumed.
- Global focus-visible styling added in `src/styles.css`; print styles untouched.
- Verified with a headless browser pass driving a full plate appearance using only arrows/Enter/Backspace.
