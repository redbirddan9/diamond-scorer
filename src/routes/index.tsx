import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Archive, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deleteGame, listGames, saveGame } from "@/lib/storage/games";
import { reduceEvents } from "@/lib/scoring/engine";
import type { StoredGame } from "@/lib/scoring/types";
import { ThemeToggle } from "@/components/scorebook/ThemeToggle";
import { TeamMark } from "@/components/scorebook/TeamMark";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Scorebook Deck — Offline Baseball Scorekeeping" },
      {
        name: "description",
        content:
          "An offline-first electronic baseball scorebook: event-driven rules engine, traditional scorecard, automatic box score and stats.",
      },
      { property: "og:title", content: "Scorebook Deck — Offline Baseball Scorekeeping" },
      {
        property: "og:description",
        content: "Keep score like paper, with the math done for you. Works with no internet.",
      },
    ],
  }),
  component: Library,
});

function Library() {
  const [games, setGames] = useState<StoredGame[]>([]);
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  const refresh = () => listGames().then(setGames);
  useEffect(() => {
    void refresh();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return games
      .filter((g) => (showArchived ? g.status === "archived" : g.status !== "archived"))
      .filter((g) =>
        !q
          ? true
          : [g.setup.away.name, g.setup.home.name, g.setup.city, g.setup.stadium, g.setup.date]
              .filter(Boolean)
              .some((v) => String(v).toLowerCase().includes(q)),
      );
  }, [games, query, showArchived]);

  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl px-4 pb-16 pt-6">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 sm:flex sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold tracking-tight">Scorebook Deck</h1>
          <p className="text-sm text-muted-foreground">Offline baseball scorekeeping</p>
        </div>
        <ThemeToggle />
      </header>

      <div className="mt-6 flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          placeholder="Search teams, stadium, city, date"
            className="h-12 pl-9"
          />
        </div>
        <Button asChild className="h-12 shrink-0 px-5">
          <Link to="/new">
            <Plus className="mr-1 h-4 w-4" /> New Game
          </Link>
        </Button>
      </div>

      <div className="mt-3 flex gap-2">
        <Button
          variant={showArchived ? "outline" : "secondary"}
          size="sm"
          onClick={() => setShowArchived(false)}
        >
          Active
        </Button>
        <Button
          variant={showArchived ? "secondary" : "outline"}
          size="sm"
          onClick={() => setShowArchived(true)}
        >
          Archived
        </Button>
      </div>

      <ul className="mt-4 space-y-2">
        {filtered.map((game) => {
          const state = reduceEvents(game.setup, game.events);
          return (
            <li
              key={game.id}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-md border border-border bg-card p-3"
            >
              <Link
                to="/game/$gameId"
                params={{ gameId: game.id }}
                className="min-w-0"
              >
                <p className="flex items-center gap-1.5 truncate font-semibold">
                  <TeamMark teamId={game.setup.away.teamId} name={game.setup.away.name} size={18} />
                  <span className="truncate">
                    {game.setup.away.name} at {game.setup.home.name}
                  </span>
                  <TeamMark teamId={game.setup.home.teamId} name={game.setup.home.name} size={18} />
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {game.setup.date}
                  {game.setup.stadium ? ` · ${game.setup.stadium}` : ""} ·{" "}
                  {state.over || game.status === "final"
                    ? `Final ${state.score.away}–${state.score.home}`
                    : `${state.half === "top" ? "Top" : "Bot"} ${state.inning} · ${state.score.away}–${state.score.home}`}
                </p>
              </Link>
              <div className="flex shrink-0 gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Archive game"
                  onClick={async () => {
                    await saveGame({
                      ...game,
                      status: game.status === "archived" ? "in-progress" : "archived",
                    });
                    void refresh();
                  }}
                >
                  <Archive className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Delete game"
                  onClick={async () => {
                    await deleteGame(game.id);
                    void refresh();
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </li>
          );
        })}
        {filtered.length === 0 && (
          <li className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No games yet. Start a new game to begin scoring.
          </li>
        )}
      </ul>
    </main>
  );
}