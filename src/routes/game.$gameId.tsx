import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, Download, FileJson, Printer, Redo2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Diamond } from "@/components/scorebook/Diamond";
import { PlayEntry } from "@/components/scorebook/PlayEntry";
import { ReviewPanel } from "@/components/scorebook/ReviewPanel";
import { ScorebookGrid } from "@/components/scorebook/ScorebookGrid";
import { BoxScore, LineScore } from "@/components/scorebook/BoxScore";
import { ThemeToggle } from "@/components/scorebook/ThemeToggle";
import { useGame, newId } from "@/lib/useGame";
import {
  battingSide,
  batterAtOffset,
  currentBatterId,
  fieldingSide,
  proposePlay,
  type PlayDraft,
} from "@/lib/scoring/engine";
import { describePlay } from "@/lib/scoring/notation";
import { exportCsv, exportJson, printScorecard } from "@/lib/export";
import type { GameState, PlayResult, TeamSide } from "@/lib/scoring/types";

export const Route = createFileRoute("/game/$gameId")({
  head: () => ({
    meta: [
      { title: "Live Scoring — Scorebook Deck" },
      {
        name: "description",
        content:
          "Score the game pitch by pitch with automatic runners, outs, RBIs and a live traditional scorecard.",
      },
      { property: "og:title", content: "Live Scoring — Scorebook Deck" },
      { property: "og:description", content: "Fast, offline, rules-aware live baseball scoring." },
    ],
  }),
  component: GameScreen,
});

function GameScreen() {
  const { gameId } = Route.useParams();
  const session = useGame(gameId);
  const [draft, setDraft] = useState<PlayDraft | null>(null);

  if (session.loading) {
    return <p className="p-6 text-sm text-muted-foreground">Loading scorebook…</p>;
  }
  if (!session.game || !session.state) {
    return (
      <main className="p-6">
        <p className="text-sm text-muted-foreground">This game isn't on this device.</p>
        <Button asChild className="mt-4">
          <Link to="/">Back to library</Link>
        </Button>
      </main>
    );
  }

  const state = session.state;
  const offense = battingSide(state);
  const defense = fieldingSide(state);
  const nameOf = (id: string) => {
    const all = [...state.setup.away.players, ...state.setup.home.players];
    return all.find((p) => p.id === id)?.name ?? id;
  };

  const pitch = (call: "ball" | "strike" | "foul") => {
    if (draft) return;
    if (call === "ball" && state.balls === 3) {
      startPlay("BB");
      return;
    }
    if (call === "strike" && state.strikes === 2) {
      startPlay("K_LOOK");
      return;
    }
    session.commit({ id: newId(), type: "pitch", ts: new Date().toISOString(), call });
  };

  const startPlay = (result: PlayResult, fielders: number[] = []) =>
    setDraft(proposePlay(state, result, fielders));

  const finalize = () => {
    if (!draft) return;
    session.commit({ ...draft, id: newId(), ts: new Date().toISOString() });
    setDraft(null);
  };

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-3 pb-10 pt-3">
      <header className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 print:hidden">
        <Button asChild variant="ghost" size="icon" className="h-11 w-11">
          <Link to="/" aria-label="Back to library">
            <ChevronLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="min-w-0 text-center">
          <p className="truncate text-sm font-semibold">
            {state.setup.away.name} at {state.setup.home.name}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {state.setup.date}
            {state.setup.stadium ? ` · ${state.setup.stadium}` : ""}
          </p>
        </div>
        <ThemeToggle />
      </header>

      <Scoreboard state={state} />

      <Tabs defaultValue="score" className="mt-3">
        <TabsList className="grid w-full grid-cols-4 print:hidden">
          <TabsTrigger value="score">Score</TabsTrigger>
          <TabsTrigger value="book">Scorebook</TabsTrigger>
          <TabsTrigger value="box">Box</TabsTrigger>
          <TabsTrigger value="plays">Plays</TabsTrigger>
        </TabsList>

        <TabsContent value="score" className="mt-3 space-y-4">
          <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-4 rounded-md border border-border bg-card p-3">
            <Diamond
              first={Boolean(state.bases[1])}
              second={Boolean(state.bases[2])}
              third={Boolean(state.bases[3])}
            />
            <div className="min-w-0 space-y-1 text-sm">
              <p className="truncate">
                <span className="text-muted-foreground">At bat </span>
                <span className="font-semibold">{nameOf(currentBatterId(state))}</span>
              </p>
              <p className="truncate text-muted-foreground">
                On deck {nameOf(batterAtOffset(state, 1))} · In the hole{" "}
                {nameOf(batterAtOffset(state, 2))}
              </p>
              <p className="truncate">
                <span className="text-muted-foreground">Pitching </span>
                {nameOf(state.pitcher[defense])} ·{" "}
                {state.pitchesThrown[state.pitcher[defense]] ?? 0} P
              </p>
              <p className="truncate text-xs text-muted-foreground">
                Last: {state.plays.length ? describePlay(state.plays[state.plays.length - 1], nameOf) : "—"}
              </p>
            </div>
          </div>

          {draft ? (
            <div className="rounded-md border border-border bg-card p-3">
              <ReviewPanel
                state={state}
                draft={draft}
                nameOf={nameOf}
                onChange={setDraft}
                onFinalize={finalize}
                onCancel={() => setDraft(null)}
              />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2">
                <Button variant="outline" className="h-14 text-base" onClick={() => pitch("ball")}>
                  Ball
                </Button>
                <Button variant="outline" className="h-14 text-base" onClick={() => pitch("strike")}>
                  Strike
                </Button>
                <Button variant="outline" className="h-14 text-base" onClick={() => pitch("foul")}>
                  Foul
                </Button>
              </div>
              <PlayEntry onSelect={startPlay} />
            </>
          )}

          <div className="flex flex-wrap gap-2 print:hidden">
            <Button variant="ghost" className="h-11" disabled={!session.canUndo} onClick={session.undo}>
              <Undo2 className="mr-1 h-4 w-4" /> Undo
            </Button>
            <Button variant="ghost" className="h-11" disabled={!session.canRedo} onClick={session.redo}>
              <Redo2 className="mr-1 h-4 w-4" /> Redo
            </Button>
            <Button variant="ghost" className="h-11" onClick={printScorecard}>
              <Printer className="mr-1 h-4 w-4" /> Print / PDF
            </Button>
            <Button
              variant="ghost"
              className="h-11"
              onClick={() => exportCsv(session.game!, state)}
            >
              <Download className="mr-1 h-4 w-4" /> CSV
            </Button>
            <Button variant="ghost" className="h-11" onClick={() => exportJson(session.game!)}>
              <FileJson className="mr-1 h-4 w-4" /> JSON
            </Button>
            <Button
              variant="outline"
              className="ml-auto h-11"
              onClick={() => session.setStatus(session.game!.status === "final" ? "in-progress" : "final")}
            >
              {session.game.status === "final" ? "Reopen game" : "Mark final"}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="book" className="mt-3 space-y-6">
          <LineScore state={state} />
          <ScorebookGrid state={state} side="away" />
          <ScorebookGrid state={state} side="home" />
        </TabsContent>

        <TabsContent value="box" className="mt-3 space-y-8">
          <LineScore state={state} />
          <BoxScore state={state} side="away" />
          <BoxScore state={state} side="home" />
        </TabsContent>

        <TabsContent value="plays" className="mt-3">
          <ol className="space-y-1 text-sm">
            {state.plays.map((play, i) => (
              <li
                key={play.id}
                className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-md border border-border p-2"
              >
                <span className="font-mono text-xs text-muted-foreground">
                  {play.half === "top" ? "T" : "B"}
                  {play.inning}
                </span>
                <span className="min-w-0 truncate">{describePlay(play, nameOf)}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => session.deleteEvent(play.id)}
                  aria-label={`Delete play ${i + 1}`}
                >
                  Delete
                </Button>
              </li>
            ))}
            {state.plays.length === 0 && (
              <li className="p-4 text-center text-muted-foreground">No plays recorded yet.</li>
            )}
          </ol>
        </TabsContent>
      </Tabs>
    </main>
  );
}

function Scoreboard({ state }: { state: GameState }) {
  const cell = (label: string, value: string | number) => (
    <div className="flex flex-col items-center">
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</span>
      <span className="font-mono text-2xl font-bold leading-tight">{value}</span>
    </div>
  );
  const team = (side: TeamSide) => (
    <div className="min-w-0 text-center">
      <p className="truncate text-xs uppercase tracking-wide text-muted-foreground">
        {state.setup[side].name}
      </p>
      <p className="font-mono text-3xl font-bold leading-none">{state.score[side]}</p>
    </div>
  );
  return (
    <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 rounded-md border border-border bg-secondary p-3">
      {team("away")}
      <div className="flex shrink-0 items-center gap-4">
        {cell("Inn", `${state.half === "top" ? "▲" : "▼"}${state.inning}`)}
        {cell("B-S", `${state.balls}-${state.strikes}`)}
        {cell("Out", state.outs)}
      </div>
      {team("home")}
    </div>
  );
}