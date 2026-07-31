import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BoxScore, LineScore } from "./BoxScore";
import type { GameSetup, GameState } from "@/lib/scoring/types";

interface Props {
  state: GameState;
  onSaveInfo: (patch: Partial<GameSetup>) => void;
}

/** Final summary shown once the game ends. */
export function GameSummary({ state, onSaveInfo }: Props) {
  const setup = state.setup;
  const winner =
    state.winner ?? (state.score.home > state.score.away ? "home" : state.score.away > state.score.home ? "away" : null);
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
        <p className="mt-1 text-2xl font-semibold">
          {setup.away.name} {state.score.away} — {state.score.home} {setup.home.name}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {winner ? `${setup[winner].name} win` : "Tie game"} in {Math.max(state.inning - 1, setup.innings)} innings
        </p>
      </div>

      <LineScore state={state} />
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
