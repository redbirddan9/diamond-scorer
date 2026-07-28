import { useCallback, useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, Download, FileJson, Printer, Redo2, Undo2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Diamond } from "@/components/scorebook/Diamond";
import { PlayEntry } from "@/components/scorebook/PlayEntry";
import { ReviewPanel } from "@/components/scorebook/ReviewPanel";
import { ScorebookGrid } from "@/components/scorebook/ScorebookGrid";
import { BoxScore, LineScore } from "@/components/scorebook/BoxScore";
import { AbsPanel } from "@/components/scorebook/AbsPanel";
import { SubstitutionPanel } from "@/components/scorebook/SubstitutionPanel";
import { GameSummary } from "@/components/scorebook/GameSummary";
import { ThemeToggle } from "@/components/scorebook/ThemeToggle";
import { useGame, newId } from "@/lib/useGame";
import {
  absCountResult,
  battingSide,
  batterAtOffset,
  currentBatterId,
  fieldingSide,
  needsReview,
  proposePlay,
  type PlayDraft,
} from "@/lib/scoring/engine";
import { describePlay } from "@/lib/scoring/notation";
import { exportCsv, exportJson, printScorecard } from "@/lib/export";
import type {
  AbsCaller,
  AbsOutcome,
  GameEvent,
  GameState,
  PlayResult,
  TeamSide,
} from "@/lib/scoring/types";

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

type Mode = "play" | "abs" | "sub";

function GameScreen() {
  const { gameId } = Route.useParams();
  const session = useGame(gameId);
  const [draft, setDraft] = useState<PlayDraft | null>(null);
  const [strikeThree, setStrikeThree] = useState(false);
  const [mode, setMode] = useState<Mode>("play");
  const [menuDepth, setMenuDepth] = useState(0);

  const state = session.state;
  const over = Boolean(state?.over);

  // Games end themselves once the rules say so.
  useEffect(() => {
    if (over && session.game && session.game.status === "in-progress") {
      session.setStatus("final");
    }
  }, [over, session]);

  const handleDepth = useCallback((d: number) => setMenuDepth(d), []);

  const startPlay = useCallback(
    (result: PlayResult, fielders: number[] = []) => {
      if (!state) return;
      const proposed = proposePlay(state, result, fielders);
      if (needsReview(state, proposed)) {
        setDraft(proposed);
        return;
      }
      session.commit({ ...proposed, id: newId(), ts: new Date().toISOString() });
    },
    [state, session],
  );

  const pitch = useCallback(
    (call: "ball" | "strike" | "foul") => {
      if (!state || draft) return;
      if (call === "ball" && state.balls === 3) {
        startPlay("BB");
        return;
      }
      if (call === "strike" && state.strikes === 2) {
        setStrikeThree(true);
        return;
      }
      session.commit({ id: newId(), type: "pitch", ts: new Date().toISOString(), call });
    },
    [state, draft, session, startPlay],
  );

  // Keyboard: pitch calls at the top level of the play menu.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && /input|textarea|select/i.test(target.tagName)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (strikeThree) {
        if (k === "s") startPlay("K_SWING");
        else if (k === "l") startPlay("K_LOOK");
        else if (e.key !== "Escape") return;
        setStrikeThree(false);
        e.preventDefault();
        return;
      }
      if (mode !== "play" || draft || menuDepth > 0 || over) return;
      if (k === "b") pitch("ball");
      else if (k === "s") pitch("strike");
      else if (k === "f") pitch("foul");
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pitch, startPlay, strikeThree, mode, draft, menuDepth, over]);

  if (session.loading) {
    return <p className="p-6 text-sm text-muted-foreground">Loading scorebook…</p>;
  }
  if (!session.game || !state) {
    return (
      <main className="p-6">
        <p className="text-sm text-muted-foreground">This game isn't on this device.</p>
        <Button asChild className="mt-4">
          <Link to="/">Back to library</Link>
        </Button>
      </main>
    );
  }

  const defense = fieldingSide(state);
  const offense = battingSide(state);
  const nameOf = (id: string) => state.playerNames[id] ?? id;

  const finalize = () => {
    if (!draft) return;
    session.commit({ ...draft, id: newId(), ts: new Date().toISOString() });
    setDraft(null);
  };

  const submitAbs = (caller: AbsCaller, outcome: AbsOutcome) => {
    const ts = new Date().toISOString();
    const batch: GameEvent[] = [{ id: newId(), type: "abs", ts, caller, outcome }];
    const call = absCountResult(outcome);
    if (call === "ball" && state.balls === 3) {
      batch.push({ ...proposePlay(state, "BB", []), id: newId(), ts });
    } else if (call === "strike" && state.strikes === 2) {
      batch.push({ ...proposePlay(state, "K_LOOK", []), id: newId(), ts });
    }
    session.commitMany(batch);
    setMode("play");
  };

  return (
    <main className="mx-auto min-h-screen w-full max-w-[1024px] px-2 pb-6 pt-2">
      <header className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 print:hidden">
        <Button asChild variant="ghost" size="icon" className="h-10 w-10">
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

      <Tabs defaultValue={over ? "summary" : "score"} className="mt-2">
        <TabsList className="grid w-full grid-cols-5 print:hidden">
          <TabsTrigger value="score" disabled={over}>
            Score
          </TabsTrigger>
          <TabsTrigger value="book">Scorebook</TabsTrigger>
          <TabsTrigger value="box">Box</TabsTrigger>
          <TabsTrigger value="plays">Plays</TabsTrigger>
          <TabsTrigger value="summary">Summary</TabsTrigger>
        </TabsList>

        <TabsContent value="score" className="mt-2 space-y-3">
          <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-md border border-border bg-card p-2">
            <Diamond
              first={Boolean(state.bases[1])}
              second={Boolean(state.bases[2])}
              third={Boolean(state.bases[3])}
              size={96}
            />
            <div className="min-w-0 space-y-0.5 text-sm">
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
                Challenges — {state.setup.away.name} {state.challenges.away} ·{" "}
                {state.setup.home.name} {state.challenges.home}
                {state.ghostRunner
                  ? ` · Automatic runner: ${nameOf(state.ghostRunner)}`
                  : ""}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                Last:{" "}
                {state.plays.length
                  ? describePlay(state.plays[state.plays.length - 1], nameOf)
                  : "—"}
              </p>
            </div>
          </div>

          {mode === "abs" ? (
            <div className="rounded-md border border-border bg-card p-3">
              <AbsPanel state={state} onSubmit={submitAbs} onCancel={() => setMode("play")} />
            </div>
          ) : mode === "sub" ? (
            <div className="rounded-md border border-border bg-card p-3">
              <SubstitutionPanel
                state={state}
                onCancel={() => setMode("play")}
                onSubmit={(sub) => {
                  session.commit({
                    ...sub,
                    id: newId(),
                    type: "sub",
                    ts: new Date().toISOString(),
                  });
                  setMode("play");
                }}
              />
            </div>
          ) : draft ? (
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
          ) : strikeThree ? (
            <div className="space-y-2 rounded-md border border-border p-3">
              <p className="text-sm font-semibold uppercase tracking-wide">Strike three</p>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  className="h-12 text-base"
                  onClick={() => {
                    setStrikeThree(false);
                    startPlay("K_SWING");
                  }}
                >
                  Swinging (S)
                </Button>
                <Button
                  className="h-12 text-base"
                  onClick={() => {
                    setStrikeThree(false);
                    startPlay("K_LOOK");
                  }}
                >
                  Looking (L)
                </Button>
                <Button variant="ghost" className="h-12" onClick={() => setStrikeThree(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-4 gap-2">
                <Button variant="outline" className="h-12 text-base" onClick={() => pitch("ball")}>
                  Ball <kbd className="ml-1 text-xs opacity-60">B</kbd>
                </Button>
                <Button variant="outline" className="h-12 text-base" onClick={() => pitch("strike")}>
                  Strike <kbd className="ml-1 text-xs opacity-60">S</kbd>
                </Button>
                <Button variant="outline" className="h-12 text-base" onClick={() => pitch("foul")}>
                  Foul <kbd className="ml-1 text-xs opacity-60">F</kbd>
                </Button>
                <Button variant="outline" className="h-12" onClick={() => setMode("sub")}>
                  <Users className="mr-1 h-4 w-4" /> Subs
                </Button>
              </div>
              <PlayEntry
                onSelect={startPlay}
                onAction={(a) => setMode(a === "abs" ? "abs" : "play")}
                onDepthChange={handleDepth}
              />
            </>
          )}

          <div className="flex flex-wrap gap-1.5 print:hidden">
            <Button variant="ghost" className="h-10" disabled={!session.canUndo} onClick={session.undo}>
              <Undo2 className="mr-1 h-4 w-4" /> Undo
            </Button>
            <Button variant="ghost" className="h-10" disabled={!session.canRedo} onClick={session.redo}>
              <Redo2 className="mr-1 h-4 w-4" /> Redo
            </Button>
            <Button variant="ghost" className="h-10" onClick={printScorecard}>
              <Printer className="mr-1 h-4 w-4" /> Print
            </Button>
            <Button variant="ghost" className="h-10" onClick={() => exportCsv(session.game!, state)}>
              <Download className="mr-1 h-4 w-4" /> CSV
            </Button>
            <Button variant="ghost" className="h-10" onClick={() => exportJson(session.game!)}>
              <FileJson className="mr-1 h-4 w-4" /> JSON
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="book" className="mt-2 space-y-5">
          <LineScore state={state} />
          <ScorebookGrid state={state} side="away" />
          <ScorebookGrid state={state} side="home" />
        </TabsContent>

        <TabsContent value="box" className="mt-2 space-y-6">
          <LineScore state={state} />
          <BoxScore state={state} side="away" />
          <BoxScore state={state} side="home" />
        </TabsContent>

        <TabsContent value="plays" className="mt-2">
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

        <TabsContent value="summary" className="mt-2">
          {over ? (
            <GameSummary state={state} onSaveInfo={session.updateSetup} />
          ) : (
            <p className="p-4 text-center text-sm text-muted-foreground">
              The summary appears automatically once the game is final. Currently{" "}
              {offense === "away" ? "top" : "bottom"} {state.inning}.
            </p>
          )}
        </TabsContent>
      </Tabs>
    </main>
  );
}

function Scoreboard({ state }: { state: GameState }) {
  const cell = (label: string, value: string | number) => (
    <div className="flex flex-col items-center">
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</span>
      <span className="font-mono text-xl font-bold leading-tight">{value}</span>
    </div>
  );
  const team = (side: TeamSide) => (
    <div className="min-w-0 text-center">
      <p className="truncate text-xs uppercase tracking-wide text-muted-foreground">
        {state.setup[side].name}
      </p>
      <p className="font-mono text-2xl font-bold leading-none">{state.score[side]}</p>
    </div>
  );
  return (
    <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 rounded-md border border-border bg-secondary p-2">
      {team("away")}
      <div className="flex shrink-0 items-center gap-4">
        {state.over
          ? cell("Final", `${Math.max(state.inning - 1, state.setup.innings)}`)
          : cell("Inn", `${state.half === "top" ? "▲" : "▼"}${state.inning}`)}
        {cell("B-S", `${state.balls}-${state.strikes}`)}
        {cell("Out", state.outs)}
      </div>
      {team("home")}
    </div>
  );
}
