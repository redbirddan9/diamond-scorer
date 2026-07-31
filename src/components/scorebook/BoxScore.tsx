import {
  battingStats,
  fieldingStats,
  formatAvg,
  pitchingStats,
  teamTotals,
} from "@/lib/scoring/stats";
import type { GameState, TeamSide } from "@/lib/scoring/types";

export function LineScore({ state }: { state: GameState }) {
  const innings = Math.max(state.setup.innings, state.lineScore.away.length, state.lineScore.home.length);
  const row = (side: TeamSide) => {
    const totals = teamTotals(state, side);
    return (
      <tr>
        <th className="border border-border p-2 text-left font-medium">{state.setup[side].name}</th>
        {Array.from({ length: innings }, (_, i) => (
          <td key={i} className="border border-border p-2 text-center font-mono">
            {state.lineScore[side][i] ?? (isPlayed(state, side, i + 1) ? 0 : "")}
          </td>
        ))}
        <td className="border border-border bg-secondary p-2 text-center font-mono font-bold">{totals.runs}</td>
        <td className="border border-border bg-secondary p-2 text-center font-mono">{totals.hits}</td>
        <td className="border border-border bg-secondary p-2 text-center font-mono">{totals.errors}</td>
      </tr>
    );
  };
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="border border-border bg-secondary p-2 text-left">Team</th>
            {Array.from({ length: innings }, (_, i) => (
              <th key={i} className="border border-border bg-secondary p-2 font-mono">{i + 1}</th>
            ))}
            <th className="border border-border bg-secondary p-2">R</th>
            <th className="border border-border bg-secondary p-2">H</th>
            <th className="border border-border bg-secondary p-2">E</th>
          </tr>
        </thead>
        <tbody>
          {row("away")}
          {row("home")}
        </tbody>
      </table>
    </div>
  );
}

function isPlayed(state: GameState, side: TeamSide, inning: number) {
  if (inning < state.inning) return true;
  return inning === state.inning && (side === "away" || state.half === "bottom");
}

export function BoxScore({ state, side }: { state: GameState; side: TeamSide }) {
  const batters = battingStats(state, side);
  const pitchers = pitchingStats(state, side === "away" ? "away" : "home");
  const fielding = fieldingStats(state, side);
  const totals = teamTotals(state, side);
  const nameOf = (id: string) =>
    [...state.setup[side].players].find((p) => p.id === id)?.name ?? id;
  const decisions = state.setup.decisions;
  const decisionFor = (id: string) =>
    decisions?.win === id ? "W" : decisions?.loss === id ? "L" : decisions?.save === id ? "S" : null;

  return (
    <section className="space-y-6">
      <div>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide">
          {state.setup[side].name} — Batting
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-secondary">
                {["Batter", "AB", "R", "H", "RBI", "BB", "SO", "HBP", "2B", "3B", "HR", "TB", "AVG", "OBP", "SLG", "OPS"].map(
                  (h) => (
                    <th key={h} className="border border-border p-1.5 text-left font-semibold">{h}</th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {batters.map((b) => (
                <tr key={b.playerId}>
                  <td className="border border-border p-1.5 font-medium">{nameOf(b.playerId)}</td>
                  {[b.ab, b.r, b.h, b.rbi, b.bb, b.so, b.hbp, b.doubles, b.triples, b.hr, b.tb].map((v, i) => (
                    <td key={i} className="border border-border p-1.5 font-mono">{v}</td>
                  ))}
                  <td className="border border-border p-1.5 font-mono">{formatAvg(b.avg)}</td>
                  <td className="border border-border p-1.5 font-mono">{formatAvg(b.obp)}</td>
                  <td className="border border-border p-1.5 font-mono">{formatAvg(b.slg)}</td>
                  <td className="border border-border p-1.5 font-mono">{formatAvg(b.ops)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Team — R {totals.runs} · H {totals.hits} · E {totals.errors} · LOB {totals.lob}
        </p>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide">Pitching</h3>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-secondary">
                {["Pitcher", "IP", "H", "R", "ER", "HR", "SO", "BB", "HBP", "BF", "P", "ERA", "WHIP", "IR", "IRS", "BRS"].map((h) => (
                  <th key={h} className="border border-border p-1.5 text-left font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pitchers.map((p) => (
                <tr key={p.playerId}>
                  <td className="border border-border p-1.5 font-medium">
                    {nameOf(p.playerId)}
                    {decisionFor(p.playerId) && (
                      <span className="ml-1 font-mono font-bold">({decisionFor(p.playerId)})</span>
                    )}
                  </td>
                  {[p.ip, p.h, p.r, p.er, p.hr, p.so, p.bb, p.hbp, p.bf, p.pitches].map((v, i) => (
                    <td key={i} className="border border-border p-1.5 font-mono">{v}</td>
                  ))}
                  <td className="border border-border p-1.5 font-mono">{p.era.toFixed(2)}</td>
                  <td className="border border-border p-1.5 font-mono">{p.whip.toFixed(2)}</td>
                  <td className="border border-border p-1.5 font-mono">{p.inheritedRunners || ""}</td>
                  <td className="border border-border p-1.5 font-mono">{p.inheritedRunnersScored || ""}</td>
                  <td className="border border-border p-1.5 font-mono">{p.bequeathedRunnersScored || ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide">Fielding</h3>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-secondary">
                {["Pos", "PO", "A", "E", "DP", "FPCT"].map((h) => (
                  <th key={h} className="border border-border p-1.5 text-left font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fielding.map((f) => (
                <tr key={f.position}>
                  <td className="border border-border p-1.5 font-mono">{f.position}</td>
                  <td className="border border-border p-1.5 font-mono">{f.po}</td>
                  <td className="border border-border p-1.5 font-mono">{f.a}</td>
                  <td className="border border-border p-1.5 font-mono">{f.e}</td>
                  <td className="border border-border p-1.5 font-mono">{f.dp}</td>
                  <td className="border border-border p-1.5 font-mono">{formatAvg(f.fpct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}