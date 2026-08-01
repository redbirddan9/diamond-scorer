Add an MLB team picker to game setup with offline cap-style monogram logos, while keeping free-text entry for non-MLB teams.

## 1. Team data (new `src/lib/teams/mlb.ts`)

A static array of all 30 clubs, each with:

- `id` (e.g. `LAD`), `city` ("Los Angeles"), `nickname` ("Dodgers"), `name` ("Los Angeles Dodgers")
- `cap` — cap letters for the monogram ("LA", "NY", "SD", "STL", …)
- `primary` / `secondary` — team colors as raw hex, used only inside the logo mark
- `division` for grouping in the picker

No trademark image files are shipped; the mark is drawn from data.

## 2. Logo component (new `src/components/scorebook/TeamMark.tsx`)

Renders an inline SVG roundel: filled circle in the club's primary color, cap letters in the secondary color, sized via a `size` prop (16 / 24 / 32 px for the three placements). For manually entered teams it falls back to a neutral, design-token-colored circle with the first 1–2 letters of the typed name, so non-MLB teams look consistent.

## 3. Setup screen (`src/routes/new.tsx`)

Replace each of the two plain team inputs with a compact team field:

- A touch-friendly picker button showing the current mark + team name; tapping opens a searchable list of the 30 clubs grouped by division, with rows large enough for the 7" screen.
- A "Custom team…" row at the bottom of the list switches that slot back to the existing free-text input (with the current recall datalist intact).
- Choosing an MLB club fills the team name and records its id.

Nothing about lineups, pitchers, or the rest of the form changes.

## 4. Persisting the identity (`src/lib/scoring/types.ts`)

Add optional `teamId?: string` to `TeamSetup`. Optional so existing stored games keep working; when absent, the neutral fallback mark is used.

## 5. Display placements

- `src/routes/game.$gameId.tsx` — marks beside the away/home names in the scoring header and in the away/home tab triggers.
- `src/components/scorebook/BoxScore.tsx` and `GameSummary.tsx` — marks beside each team name in the score line/headers.
- `src/routes/index.tsx` — marks beside each saved game row ("Away at Home").

## Technical details

- Colors for the logo mark are intentionally raw hex inside `mlb.ts`/`TeamMark` (they are brand data, not theme values); everything else keeps using semantic design tokens.
- Fully offline: pure data + inline SVG, no network fetch, no new dependencies.
- Team resolution helper `teamById(id)` returns `undefined` for custom teams; all UI handles that path.

## Out of scope

- Official logo artwork, wordmarks, or team-colored theming of the app chrome.
- Auto-filling MLB rosters or ballparks from the team selection.