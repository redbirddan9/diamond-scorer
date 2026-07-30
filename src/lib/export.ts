/** Local, offline exports: JSON event log, CSV box score, printable scorecard. */
import { battingStats, pitchingStats } from "./scoring/stats";
import { notationFor } from "./scoring/notation";
import type { GameState, StoredGame, TeamSide } from "./scoring/types";

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportJson(game: StoredGame) {
  download(`${slug(game)}.json`, JSON.stringify(game, null, 2), "application/json");
}

export function exportCsv(game: StoredGame, state: GameState) {
  const rows: string[][] = [["Team", "Player", "AB", "R", "H", "RBI", "BB", "SO", "HR", "AVG"]];
  (["away", "home"] as TeamSide[]).forEach((side) => {
    const nameOf = (id: string) =>
      state.setup[side].players.find((p) => p.id === id)?.name ?? id;
    for (const b of battingStats(state, side)) {
      rows.push([
        state.setup[side].name,
        nameOf(b.playerId),
        String(b.ab),
        String(b.r),
        String(b.h),
        String(b.rbi),
        String(b.bb),
        String(b.so),
        String(b.hr),
        b.avg.toFixed(3),
      ]);
    }
  });
  rows.push([]);
  rows.push(["Team", "Pitcher", "IP", "H", "R", "ER", "SO", "BB", "ERA", "WHIP"]);
  (["away", "home"] as TeamSide[]).forEach((side) => {
    const nameOf = (id: string) =>
      state.setup[side].players.find((p) => p.id === id)?.name ?? id;
    for (const p of pitchingStats(state, side)) {
      rows.push([
        state.setup[side].name,
        nameOf(p.playerId),
        p.ip,
        String(p.h),
        String(p.r),
        String(p.er),
        String(p.so),
        String(p.bb),
        p.era.toFixed(2),
        p.whip.toFixed(2),
      ]);
    }
  });
  rows.push([]);
  rows.push(["Inning", "Half", "Batter", "Result", "Notation", "RBI", "Runs"]);
  for (const play of state.plays) {
    const side = play.battingTeam;
    const nameOf = (id: string) =>
      state.setup[side].players.find((p) => p.id === id)?.name ?? id;
    rows.push([
      String(play.inning),
      play.half,
      play.batterId ? nameOf(play.batterId) : "",
      play.resolution.classification,
      notationFor(play),
      String(play.resolution.rbi),
      String(play.runsScored.length),
    ]);
  }
  const csv = rows.map((r) => r.map((c) => `"${(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  download(`${slug(game)}.csv`, csv, "text/csv");
}

/** Uses the browser print pipeline — "Save as PDF" works fully offline. */
export function printScorecard() {
  window.print();
}

function slug(game: StoredGame) {
  return `${game.setup.away.name}-at-${game.setup.home.name}-${game.setup.date}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");
}