import { useCallback, useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, Download, FileJson, Printer, Redo2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Diamond } from "@/components/scorebook/Diamond";
import { PlayEntry } from "@/components/scorebook/PlayEntry";
import { ReviewPanel } from "@/components/scorebook/ReviewPanel";
import { ScorebookGrid } from "@/components/scorebook/ScorebookGrid";
import { BoxScore, LineScore } from "@/components/scorebook/BoxScore";
import { AbsPanel } from "@/components/scorebook/AbsPanel";
import { SubstitutionPanel } from "@/components/scorebook/SubstitutionPanel";
import { PositionAssign, pendingFielders } from "@/components/scorebook/PositionAssign";
import { GameSummary } from "@/components/scorebook/GameSummary";
import { ThemeToggle } from "@/components/scorebook/ThemeToggle";
import { TeamMark } from "@/components/scorebook/TeamMark";
import { useGame, newId } from "@/lib/useGame";
import {
  absCountResult,
  battingSide,
  currentBatterId,
  fieldingSide,
} from "@/lib/scoring/engine";
import { needsAdvancementInput, resolvePlay } from "@/lib/scoring/rules";
import { describePlay } from "@/lib/scoring/notation";
import { exportCsv, exportJson, printScorecard } from "@/lib/export";
import type {
  AbsCaller,
  AbsOutcome,
  BatterInput,
  Destination,
  GameEvent,
  GameState,
  PlayInput,
  RunnerInput,
  RunnerKey,
  TeamSide,
} from "@/lib/scoring/types";
import { cn } from "@/lib/utils";

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
  const [pending, setPending] = useState<{
    input: PlayInput;
    batterId: string;
    overrides: Partial<Record<RunnerKey, Destination>>;
  } | null>(null);
  const [strikeThree, setStrikeThree] = useState(false);
  const [mode, setMode] = useState<Mode>("play");
  const [menuDepth, setMenuDepth] = useState(0);
  const [tab, setTab] = useState<string>("away");
  const [skipAssign, setSkipAssign] = useState<string[]>([]);

  const state = session.state;
  const over = Boolean(state?.over);
  const trackPitches = Boolean(state?.setup.trackPitches);
  const halfKey = state ? `${state.inning}-${state.half}` : null;
  const battingTeam = state ? (state.half === "top" ? "away" : "home") : null;

  // Half innings switch themselves: follow the batting team, or the box once final.
  useEffect(() => {
    if (over) setTab("box");
    else if (battingTeam) setTab(battingTeam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [halfKey, over]);

  // Games end themselves once the rules say so.
  useEffect(() => {
    if (over && session.game && session.game.status === "in-progress") {
      session.setStatus("final");
    }
  }, [over, session]);

  const handleDepth = useCallback((d: number) => setMenuDepth(d), []);

  /** Record an observation; the rules layer decides everything else. */
  const startPlay = useCallback(
    (input: BatterInput) => {
      if (!state || state.over) return;
      const batterId = currentBatterId(state);
      const resolution = resolvePlay(state, input);
      if (needsAdvancementInput(resolution)) {
        setPending({ input, batterId, overrides: {} });
        return;
      }
      session.commit({
        id: newId(),
        type: "play",
        ts: new Date().toISOString(),
        batterId,
        input,
      });
    },
    [state, session],
  );

  const startRunnerPlay = useCallback(
    (input: RunnerInput) => {
      if (!state || state.over) return;
      session.commit({ id: newId(), type: "runner", ts: new Date().toISOString(), input });
    },
    [state, session],
  );

  const pitch = useCallback(
    (call: "ball" | "strike" | "foul") => {
      if (!state || pending || state.over) return;
      if (call === "ball" && state.balls === 3) {
        startPlay({ kind: "walk" });
        return;
      }
      if (call === "strike" && state.strikes === 2) {
        setStrikeThree(true);
        return;
      }
      session.commit({ id: newId(), type: "pitch", ts: new Date().toISOString(), call });
    },
    [state, pending, session, startPlay],
  );

  // Keyboard: pitch calls at the top level of the play menu.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && /input|textarea|select/i.test(target.tagName)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (strikeThree) {
        if (k === "s") startPlay({ kind: "strikeout", swinging: true });
        else if (k === "l") startPlay({ kind: "strikeout", swinging: false });
        else if (e.key !== "Escape") return;
        setStrikeThree(false);
        e.preventDefault();
        return;
      }
      if (!trackPitches || mode !== "play" || pending || menuDepth > 0 || over) return;
      if (k === "b") pitch("ball");
      else if (k === "s") pitch("strike");
      else if (k === "f") pitch("foul");
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pitch, startPlay, strikeThree, mode, pending, menuDepth, over, trackPitches]);

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
  const activeSlot = state.slot[offense] % Math.max(state.lineup[offense].length, 1);
  // Pinch hitters/runners pick a fielding position once their half inning ends.
  const assignTarget =
    pendingFielders(state, defense).find((p) => !skipAssign.includes(p.playerId)) ?? null;

  const finalize = () => {
    if (!pending) return;
    const ts = new Date().toISOString();
    session.commit(
      pending.input.kind === "steal" ||
        pending.input.kind === "wild-pitch" ||
        pending.input.kind === "passed-ball" ||
        pending.input.kind === "balk" ||
        pending.input.kind === "defensive-indifference" ||
        pending.input.kind === "pickoff"
        ? { id: newId(), type: "runner", ts, input: pending.input, overrides: pending.overrides }
        : {
            id: newId(),
            type: "play",
            ts,
            batterId: pending.batterId,
            input: pending.input,
            overrides: pending.overrides,
          },
    );
    setPending(null);
  };

  const submitAbs = (caller: AbsCaller, outcome: AbsOutcome) => {
    const ts = new Date().toISOString();
    const batch: GameEvent[] = [{ id: newId(), type: "abs", ts, caller, outcome }];
    const call = absCountResult(outcome);
    if (call === "ball" && state.balls === 3) {
      batch.push({
        id: newId(),
        type: "play",
        ts,
        batterId: currentBatterId(state),
        input: { kind: "walk" },
      });
    } else if (call === "strike" && state.strikes === 2) {
      batch.push({
        id: newId(),
        type: "play",
        ts,
        batterId: currentBatterId(state),
        input: { kind: "strikeout", swinging: false },
      });
    }
    session.commitMany(batch);
    setMode("play");
  };

  return (
    <main className="mx-auto min-h-screen w-full max-w-[820px] px-1.5 pb-4 pt-1.5">
      <header className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-1 print:hidden">
        <Button asChild variant="ghost" size="icon" className="h-8 w-8">
          <Link to="/" aria-label="Back to library">
            <ChevronLeft className="h-5 w-5" />
          </Link>
        </Button>
        <p className="truncate text-center text-xs text-muted-foreground">
          {state.setup.date}
          {state.setup.stadium ? ` · ${state.setup.stadium}` : ""}
          {state.setup.city ? `, ${state.setup.city}` : ""}
        </p>
        <ThemeToggle />
      </header>

      <Scoreboard state={state} trackPitches={trackPitches} />

      {over && (
        <div className="mt-1.5 rounded-md border border-border bg-secondary px-3 py-1.5 text-center">
          <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Final</span>
          <span className="ml-2 text-sm font-semibold">
            {state.winner ? `${state.setup[state.winner].name} win` : "Tie game"} —{" "}
            <span className="inline-flex items-center gap-1 align-middle">
              <TeamMark teamId={state.setup.away.teamId} name={state.setup.away.name} size={16} />
              {state.setup.away.name} {state.score.away}
            </span>
            {", "}
            <span className="inline-flex items-center gap-1 align-middle">
              <TeamMark teamId={state.setup.home.teamId} name={state.setup.home.name} size={16} />
              {state.setup.home.name} {state.score.home}
            </span>
          </span>
        </div>
      )}

      {!over && (
        <section className="mt-1.5 space-y-1.5">
          <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-md border border-border bg-card p-1.5">
            <Diamond
              first={Boolean(state.bases[1])}
              second={Boolean(state.bases[2])}
              third={Boolean(state.bases[3])}
              size={64}
            />
            <div className="min-w-0 text-sm">
              <p className="truncate">
                <span className="text-muted-foreground">At bat </span>
                <span className="text-base font-semibold">{nameOf(currentBatterId(state))}</span>
                <span className="text-muted-foreground"> · #{activeSlot + 1}</span>
              </p>
              <p className="truncate text-xs text-muted-foreground">
                Pitching {nameOf(state.pitcher[defense])}
                {trackPitches ? ` · ${state.pitchesThrown[state.pitcher[defense]] ?? 0} P` : ""}
                {state.ghostRunner ? ` · Auto runner ${nameOf(state.ghostRunner)}` : ""}
              </p>
            </div>
          </div>

          {mode === "play" && !pending && !strikeThree && assignTarget ? (
            <PositionAssign
              key={assignTarget.playerId}
              state={state}
              pending={assignTarget}
              onSkip={() => setSkipAssign((s) => [...s, assignTarget.playerId])}
              onAssign={(position) => {
                session.commit({
                  id: newId(),
                  type: "position",
                  ts: new Date().toISOString(),
                  team: assignTarget.team,
                  playerId: assignTarget.playerId,
                  position,
                });
              }}
            />
          ) : null}

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
          ) : pending ? (
            <div className="rounded-md border border-border bg-card p-3">
              <ReviewPanel
                state={state}
                input={pending.input}
                batterId={pending.batterId}
                overrides={pending.overrides}
                nameOf={nameOf}
                onChange={(overrides) => setPending({ ...pending, overrides })}
                onFinalize={finalize}
                onCancel={() => setPending(null)}
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
                    startPlay({ kind: "strikeout", swinging: true });
                  }}
                >
                  Swinging (S)
                </Button>
                <Button
                  className="h-12 text-base"
                  onClick={() => {
                    setStrikeThree(false);
                    startPlay({ kind: "strikeout", swinging: false });
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
              {trackPitches && (
                <div className="grid grid-cols-3 gap-2">
                  <Button variant="outline" className="h-11" onClick={() => pitch("ball")}>
                    Ball <kbd className="ml-1 text-xs opacity-60">B</kbd>
                  </Button>
                  <Button variant="outline" className="h-11" onClick={() => pitch("strike")}>
                    Strike <kbd className="ml-1 text-xs opacity-60">S</kbd>
                  </Button>
                  <Button variant="outline" className="h-11" onClick={() => pitch("foul")}>
                    Foul <kbd className="ml-1 text-xs opacity-60">F</kbd>
                  </Button>
                </div>
              )}
              <PlayEntry
                bases={state.bases}
                nameOf={nameOf}
                onPlay={startPlay}
                onRunnerPlay={startRunnerPlay}
                onAction={(a) => setMode(a)}
                onDepthChange={handleDepth}
              />
            </>
          )}
        </section>
      )}

      <Tabs value={tab} onValueChange={setTab} className="mt-2">
        <TabsList className="grid w-full grid-cols-4 print:hidden">
          <TabsTrigger value="away" className="gap-1.5">
            <TeamMark teamId={state.setup.away.teamId} name={state.setup.away.name} size={16} />
            <span className="truncate">{state.setup.away.name}</span>
          </TabsTrigger>
          <TabsTrigger value="home" className="gap-1.5">
            <TeamMark teamId={state.setup.home.teamId} name={state.setup.home.name} size={16} />
            <span className="truncate">{state.setup.home.name}</span>
          </TabsTrigger>
          <TabsTrigger value="box">Box</TabsTrigger>
          <TabsTrigger value="plays">Plays</TabsTrigger>
        </TabsList>

        <TabsContent value="away" className="mt-2 space-y-2">
          <LineScore state={state} />
          <ScorebookGrid
            state={state}
            side="away"
            activeSlot={!over && offense === "away" ? activeSlot : null}
          />
        </TabsContent>

        <TabsContent value="home" className="mt-2 space-y-2">
          <LineScore state={state} />
          <ScorebookGrid
            state={state}
            side="home"
            activeSlot={!over && offense === "home" ? activeSlot : null}
          />
        </TabsContent>

        <TabsContent value="box" className="mt-2 space-y-4">
          {over ? (
            <GameSummary state={state} onSaveInfo={session.updateSetup} />
          ) : (
            <>
              <LineScore state={state} />
              <BoxScore state={state} side="away" />
              <BoxScore state={state} side="home" />
            </>
          )}
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
      </Tabs>

      <div className="mt-2 flex flex-wrap gap-1 print:hidden">
        <Button variant="ghost" className="h-9" disabled={!session.canUndo} onClick={session.undo}>
          <Undo2 className="mr-1 h-4 w-4" /> Undo
        </Button>
        <Button variant="ghost" className="h-9" disabled={!session.canRedo} onClick={session.redo}>
          <Redo2 className="mr-1 h-4 w-4" /> Redo
        </Button>
        <Button variant="ghost" className="h-9" onClick={printScorecard}>
          <Printer className="mr-1 h-4 w-4" /> Print
        </Button>
        <Button variant="ghost" className="h-9" onClick={() => exportCsv(session.game!, state)}>
          <Download className="mr-1 h-4 w-4" /> CSV
        </Button>
        <Button variant="ghost" className="h-9" onClick={() => exportJson(session.game!)}>
          <FileJson className="mr-1 h-4 w-4" /> JSON
        </Button>
        <span className="ml-auto max-w-[45%] truncate self-center text-xs text-muted-foreground">
          {state.plays.length ? describePlay(state.plays[state.plays.length - 1], nameOf) : ""}
        </span>
      </div>
    </main>
  );
}

function Scoreboard({ state, trackPitches }: { state: GameState; trackPitches: boolean }) {
  const cell = (label: string, value: string | number) => (
    <div className="flex items-center gap-1">
      <span className="text-[9px] uppercase tracking-widest text-muted-foreground">{label}</span>
      <span className="font-mono text-lg font-bold leading-tight">{value}</span>
    </div>
  );
  const team = (side: TeamSide) => (
    <div className="min-w-0 text-center">
      <div className="flex items-center justify-center gap-1">
        {[0, 1].map((i) => (
          <span
            key={i}
            aria-hidden
            className={cn(
              "h-2 w-2 border border-ink",
              i < state.challenges[side] ? "bg-ink" : "bg-transparent",
            )}
          />
        ))}
        <span className="sr-only">{state.challenges[side]} challenges remaining</span>
      </div>
      <p className="truncate text-[11px] uppercase tracking-wide text-muted-foreground">
        {state.setup[side].name}
      </p>
      <p className="font-mono text-2xl font-bold leading-none">{state.score[side]}</p>
    </div>
  );
  return (
    <div className="mt-1.5 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 rounded-md border border-border bg-secondary p-1.5">
      {team("away")}
      <div className="flex shrink-0 items-center gap-3">
        {state.over
          ? cell("Final", `${Math.max(state.inning - 1, state.setup.innings)}`)
          : cell("Inn", `${state.half === "top" ? "▲" : "▼"}${state.inning}`)}
        {trackPitches && !state.over && cell("B-S", `${state.balls}-${state.strikes}`)}
        <div className="flex items-center gap-1">
          <span className="text-[9px] uppercase tracking-widest text-muted-foreground">Out</span>
          <span className="flex gap-1">
            {[0, 1].map((i) => (
              <span
                key={i}
                aria-hidden
                className={cn(
                  "h-3 w-3 rounded-full border-2 border-ink",
                  i < state.outs ? "bg-ink" : "bg-transparent",
                )}
              />
            ))}
          </span>
          <span className="sr-only">{state.outs} out</span>
        </div>
      </div>
      {team("home")}
    </div>
  );
}
