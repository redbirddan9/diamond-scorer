import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BoxScore, LineScore } from "./BoxScore";
import { gameFeats } from "@/lib/scoring/rules";
import { pitchingStats } from "@/lib/scoring/stats";
import type { GameSetup, GameState, TeamSide } from "@/lib/scoring/types";

interface Props {
  state: GameState;
  onSaveInfo: (patch: Partial<GameSetup>) => void;
}

const FEAT_LABELS = {
  "perfect-game": "Perfect Game",
  "no-hitter": "No-Hitter",
  shutout: "Shutout",
};

/** Final summary shown once the game ends. */
export function GameSummary({ state, onSaveInfo }: Props) {
  const setup = state.setup;
  const winner =
    state.winner ?? (state.score.home > state.score.away ? "home" : state.score.away > state.score.home ? "away" : null);
  const feats = gameFeats(state);
  const [info, setInfo] = useState({
    startTime: setup.startTime ?? "",
    attendance: setup.attendance ?? "",
    stadium: setup.stadium ?? "",
    city: setup.city ?? "",
    umpHome: setup.umpires?.home ?? "",
    umpFirst: setup.umpires?.first ?? "",
    umpSecond: setup.umpires?.second ?? "",
    umpThird: setup.umpires?.third ?? "",
    notes: setup.notes ?? "",
  });
  const [saved, setSaved] = useState(false);
  const [decisions, setDecisions] = useState({
    win: setup.decisions?.win ?? "",
    loss: setup.decisions?.loss ?? "",
    save: setup.decisions?.save ?? "",
  });
  const [decisionsSaved, setDecisionsSaved] = useState(false);

  const pitcherOptions = (["away", "home"] as TeamSide[]).flatMap((side) =>
    pitchingStats(state, side).map((p) => ({
      id: p.playerId,
      label: `${setup[side].players.find((pl) => pl.id === p.playerId)?.name ?? p.playerId} (${setup[side].name})`,
    })),
  );

  const decisionField = (key: "win" | "loss" | "save", label: string) => (
    <div className="space-y-1">
      <Label htmlFor={`dec-${key}`} className="text-[11px] uppercase text-muted-foreground">
        {label}
      </Label>
      <select
        id={`dec-${key}`}
        className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
        value={decisions[key]}
        onChange={(e) => {
          setDecisions({ ...decisions, [key]: e.target.value });
          setDecisionsSaved(false);
        }}
      >
        <option value="">— none —</option>
        {pitcherOptions.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );

  const field = (key: keyof typeof info, label: string, type = "text") => (
    <div className="space-y-1">
      <Label htmlFor={`sum-${key}`} className="text-[11px] uppercase text-muted-foreground">
        {label}
      </Label>
      <Input
        id={`sum-${key}`}
        type={type}
        className="h-10"
        value={info[key]}
        onChange={(e) => {
          setInfo({ ...info, [key]: e.target.value });
          setSaved(false);
        }}
      />
    </div>
  );

  return (
    <section className="space-y-4">
      <div className="rounded-md border border-border bg-secondary p-4 text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Final</p>
        <p className="mt-1 flex flex-wrap items-center justify-center gap-2 text-2xl font-semibold">
          <TeamMark teamId={setup.away.teamId} name={setup.away.name} size={28} />
          <span>
            {setup.away.name} {state.score.away} — {state.score.home} {setup.home.name}
          </span>
          <TeamMark teamId={setup.home.teamId} name={setup.home.name} size={28} />
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {winner ? `${setup[winner].name} win` : "Tie game"} in {Math.max(state.inning - 1, setup.innings)} innings
        </p>
        {feats.length > 0 && (
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            {feats.map((f, i) => (
              <span
                key={i}
                className="rounded-full bg-field px-3 py-1 text-xs font-semibold uppercase tracking-wide text-ink"
              >
                {setup[f.team].name} — {FEAT_LABELS[f.feat]}
              </span>
            ))}
          </div>
        )}
      </div>

      <LineScore state={state} />

      <div className="rounded-md border border-border p-3">
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide">Pitching decisions</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {decisionField("win", "Win (W)")}
          {decisionField("loss", "Loss (L)")}
          {decisionField("save", "Save (S)")}
        </div>
        <Button
          className="mt-3 h-11 print:hidden"
          onClick={() => {
            onSaveInfo({
              decisions: {
                win: decisions.win || undefined,
                loss: decisions.loss || undefined,
                save: decisions.save || undefined,
              },
            });
            setDecisionsSaved(true);
          }}
        >
          {decisionsSaved ? "Saved" : "Save decisions"}
        </Button>
      </div>

      <BoxScore state={state} side="away" />
      <BoxScore state={state} side="home" />

      {state.absLog.length > 0 && (
        <div>
          <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide">ABS Challenges</h3>
          <ul className="space-y-1 text-sm">
            {state.absLog.map((c, i) => (
              <li key={i} className="rounded-md border border-border p-2">
                {c.half === "top" ? "T" : "B"}
                {c.inning} · {setup[c.team].name} · {c.caller} · {c.outcome.replace("-", " ")} ·{" "}
                {c.retained ? "challenge retained" : "challenge used"}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-md border border-border p-3 print:hidden">
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide">Game information</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {field("stadium", "Stadium")}
          {field("city", "City")}
          {field("startTime", "Start Time", "time")}
          {field("attendance", "Attendance")}
          {field("umpHome", "HP Umpire")}
          {field("umpFirst", "1B Umpire")}
          {field("umpSecond", "2B Umpire")}
          {field("umpThird", "3B Umpire")}
        </div>
        <div className="mt-3 space-y-1">
          <Label htmlFor="sum-notes" className="text-[11px] uppercase text-muted-foreground">
            Notes
          </Label>
          <Textarea
            id="sum-notes"
            value={info.notes}
            onChange={(e) => {
              setInfo({ ...info, notes: e.target.value });
              setSaved(false);
            }}
          />
        </div>
        <Button
          className="mt-3 h-11"
          onClick={() => {
            onSaveInfo({
              stadium: info.stadium,
              city: info.city,
              startTime: info.startTime,
              attendance: info.attendance,
              notes: info.notes,
              umpires: {
                home: info.umpHome,
                first: info.umpFirst,
                second: info.umpSecond,
                third: info.umpThird,
              },
            });
            setSaved(true);
          }}
        >
          {saved ? "Saved" : "Save game info"}
        </Button>
      </div>
    </section>
  );
}
