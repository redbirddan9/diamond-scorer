import { ScorebookGrid } from "./ScorebookGrid";
import { BoxScore, LineScore } from "./BoxScore";
import { gameFeats } from "@/lib/scoring/rules";
import type { GameState, TeamSide } from "@/lib/scoring/types";

const FEAT_LABELS: Record<string, string> = {
  "perfect-game": "Perfect Game",
  "no-hitter": "No-Hitter",
  shutout: "Shutout",
};

/**
 * Print-only output: page 1 away scorecard, page 2 home scorecard,
 * page 3 the full box score. Rendered regardless of the active tab.
 */
export function PrintSheet({ state }: { state: GameState }) {
  const setup = state.setup;
  const feats = gameFeats(state);
  const winner =
    state.winner ??
    (state.score.home > state.score.away ? "home" : state.score.away > state.score.home ? "away" : null);
  const umpires = setup.umpires;

  const heading = (title: string) => (
    <header className="mb-2">
      <h2 className="text-base font-semibold">
        {setup.away.name} at {setup.home.name} — {title}
      </h2>
      <p className="text-xs">
        {setup.date}
        {setup.stadium ? ` · ${setup.stadium}` : ""}
        {setup.city ? `, ${setup.city}` : ""}
        {setup.startTime ? ` · ${setup.startTime}` : ""}
        {setup.attendance ? ` · Att. ${setup.attendance}` : ""}
      </p>
    </header>
  );

  const card = (side: TeamSide) => (
    <section className="print-page">
      {heading(`${setup[side].name} scorecard`)}
      <LineScore state={state} />
      <div className="print-fill mt-2">
        <ScorebookGrid state={state} side={side} activeSlot={null} />
      </div>
    </section>
  );

  return (
    <div className="hidden print:block" aria-hidden="true">
      {card("away")}
      {card("home")}

      <section className="print-page print-page-last">
        {heading("Box score")}
        <p className="mb-2 text-sm font-semibold">
          Final: {setup.away.name} {state.score.away} — {state.score.home} {setup.home.name}
          {winner ? ` · ${setup[winner].name} win` : " · tie"} in{" "}
          {Math.max(state.inning - 1, setup.innings)} innings
        </p>
        {feats.length > 0 && (
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide">
            {feats.map((f) => `${setup[f.team].name} — ${FEAT_LABELS[f.feat]}`).join(" · ")}
          </p>
        )}
        <LineScore state={state} />
        <div className="print-fill mt-3 space-y-3">
          <BoxScore state={state} side="away" />
          <BoxScore state={state} side="home" />
        </div>
        {(umpires?.home || umpires?.first || umpires?.second || umpires?.third || setup.notes) && (
          <div className="print-footer mt-3 text-xs">
            {(umpires?.home || umpires?.first || umpires?.second || umpires?.third) && (
              <p>
                Umpires: {[umpires?.home, umpires?.first, umpires?.second, umpires?.third]
                  .filter(Boolean)
                  .join(", ")}
              </p>
            )}
            {setup.notes && <p className="mt-1">Notes: {setup.notes}</p>}
          </div>
        )}
      </section>
    </div>
  );
}
