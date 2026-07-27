import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createGame, loadTemplates, saveTemplate } from "@/lib/storage/games";
import { newId } from "@/lib/useGame";
import type { GameSetup, Player, TeamSetup } from "@/lib/scoring/types";

export const Route = createFileRoute("/new")({
  head: () => ({
    meta: [
      { title: "New Game Setup — Scorebook Deck" },
      {
        name: "description",
        content:
          "Enter teams, rosters, batting order, umpires and game conditions before first pitch.",
      },
      { property: "og:title", content: "New Game Setup — Scorebook Deck" },
      { property: "og:description", content: "Set up teams, lineups and conditions before first pitch." },
    ],
  }),
  component: NewGame,
});

const DEFAULT_POSITIONS = ["P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"];

function blankRoster(prefix: string): Player[] {
  return DEFAULT_POSITIONS.map((position, i) => ({
    id: `${prefix}-${i}-${Math.random().toString(36).slice(2, 7)}`,
    number: String(i + 1),
    name: "",
    position,
  }));
}

function NewGame() {
  const navigate = useNavigate();
  const [away, setAway] = useState<Player[]>(() => blankRoster("away"));
  const [home, setHome] = useState<Player[]>(() => blankRoster("home"));
  const [meta, setMeta] = useState({
    awayName: "Away",
    homeName: "Home",
    league: "",
    season: String(new Date().getFullYear()),
    gameNumber: "",
    date: new Date().toISOString().slice(0, 10),
    startTime: "",
    stadium: "",
    city: "",
    weather: "",
    temperature: "",
    wind: "",
    attendance: "",
    fieldConditions: "",
    officialScorer: "",
    notes: "",
    innings: "9",
    umpHome: "",
    umpFirst: "",
    umpSecond: "",
    umpThird: "",
  });
  const templates = loadTemplates();

  const buildTeam = (name: string, players: Player[]): TeamSetup => {
    const filled = players.map((p, i) => ({
      ...p,
      name: p.name.trim() || `Player ${i + 1}`,
    }));
    return {
      name: name.trim() || "Team",
      players: filled,
      lineup: filled.map((p) => p.id),
      pitcherId: filled.find((p) => p.position === "P")?.id ?? filled[0].id,
    };
  };

  const start = async () => {
    const setup: GameSetup = {
      id: newId(),
      createdAt: new Date().toISOString(),
      league: meta.league,
      season: meta.season,
      gameNumber: meta.gameNumber,
      date: meta.date,
      startTime: meta.startTime,
      stadium: meta.stadium,
      city: meta.city,
      weather: meta.weather,
      temperature: meta.temperature,
      wind: meta.wind,
      attendance: meta.attendance,
      fieldConditions: meta.fieldConditions,
      officialScorer: meta.officialScorer,
      notes: meta.notes,
      umpires: {
        home: meta.umpHome,
        first: meta.umpFirst,
        second: meta.umpSecond,
        third: meta.umpThird,
      },
      innings: Number(meta.innings) || 9,
      away: buildTeam(meta.awayName, away),
      home: buildTeam(meta.homeName, home),
    };
    const game = await createGame(setup);
    void navigate({ to: "/game/$gameId", params: { gameId: game.id } });
  };

  const field = (key: keyof typeof meta, label: string, type = "text") => (
    <div className="space-y-1">
      <Label htmlFor={key} className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      <Input
        id={key}
        type={type}
        className="h-11"
        value={meta[key]}
        onChange={(e) => setMeta({ ...meta, [key]: e.target.value })}
      />
    </div>
  );

  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl px-4 pb-24 pt-6">
      <h1 className="text-2xl font-bold tracking-tight">New Game</h1>
      <p className="text-sm text-muted-foreground">Everything is stored locally on this device.</p>

      <section className="mt-6 space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide">Game</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {field("awayName", "Away Team")}
          {field("homeName", "Home Team")}
          {field("league", "League")}
          {field("season", "Season")}
          {field("gameNumber", "Game Number")}
          {field("date", "Date", "date")}
          {field("startTime", "Start Time", "time")}
          {field("stadium", "Stadium")}
          {field("city", "City")}
          {field("weather", "Weather")}
          {field("temperature", "Temperature")}
          {field("wind", "Wind")}
          {field("attendance", "Attendance")}
          {field("fieldConditions", "Field Conditions")}
          {field("officialScorer", "Official Scorer")}
          {field("innings", "Innings")}
        </div>
      </section>

      <section className="mt-6 space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide">Umpires</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {field("umpHome", "Home Plate")}
          {field("umpFirst", "First Base")}
          {field("umpSecond", "Second Base")}
          {field("umpThird", "Third Base")}
        </div>
      </section>

      <RosterEditor
        title={`${meta.awayName || "Away"} Lineup`}
        players={away}
        onChange={setAway}
        templates={templates}
        onSaveTemplate={() => saveTemplate({ name: meta.awayName, players: away })}
      />
      <RosterEditor
        title={`${meta.homeName || "Home"} Lineup`}
        players={home}
        onChange={setHome}
        templates={templates}
        onSaveTemplate={() => saveTemplate({ name: meta.homeName, players: home })}
      />

      <section className="mt-6 space-y-1">
        <Label htmlFor="notes" className="text-xs uppercase tracking-wide text-muted-foreground">
          Notes
        </Label>
        <Textarea
          id="notes"
          value={meta.notes}
          onChange={(e) => setMeta({ ...meta, notes: e.target.value })}
        />
      </section>

      <div className="mt-8 flex gap-2">
        <Button variant="ghost" className="h-14" onClick={() => navigate({ to: "/" })}>
          Cancel
        </Button>
        <Button className="h-14 flex-1 text-base font-semibold" onClick={start}>
          Play Ball
        </Button>
      </div>
    </main>
  );
}

function RosterEditor({
  title,
  players,
  onChange,
  templates,
  onSaveTemplate,
}: {
  title: string;
  players: Player[];
  onChange: (players: Player[]) => void;
  templates: { name: string; players: Player[] }[];
  onSaveTemplate: () => void;
}) {
  const update = (index: number, patch: Partial<Player>) =>
    onChange(players.map((p, i) => (i === index ? { ...p, ...patch } : p)));

  return (
    <section className="mt-6 space-y-2">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
        <h2 className="truncate text-sm font-semibold uppercase tracking-wide">{title}</h2>
        <div className="flex shrink-0 gap-1">
          {templates.length > 0 && (
            <select
              className="h-9 rounded-md border border-input bg-background px-2 text-xs"
              defaultValue=""
              onChange={(e) => {
                const t = templates.find((x) => x.name === e.target.value);
                if (t)
                  onChange(
                    t.players.map((p) => ({ ...p, id: `${p.id}-${Math.random().toString(36).slice(2, 6)}` })),
                  );
              }}
            >
              <option value="">Load roster…</option>
              {templates.map((t) => (
                <option key={t.name} value={t.name}>
                  {t.name}
                </option>
              ))}
            </select>
          )}
          <Button size="sm" variant="outline" onClick={onSaveTemplate}>
            Save roster
          </Button>
        </div>
      </div>
      <ul className="space-y-1.5">
        {players.map((p, i) => (
          <li key={p.id} className="grid grid-cols-[2rem_4rem_minmax(0,1fr)_4.5rem] items-center gap-2">
            <span className="text-center font-mono text-xs text-muted-foreground">{i + 1}</span>
            <Input
              className="h-11 text-center font-mono"
              value={p.number}
              aria-label="Uniform number"
              onChange={(e) => update(i, { number: e.target.value })}
            />
            <Input
              className="h-11"
              value={p.name}
              placeholder={`Player ${i + 1}`}
              aria-label="Player name"
              onChange={(e) => update(i, { name: e.target.value })}
            />
            <Input
              className="h-11 text-center"
              value={p.position}
              aria-label="Position"
              onChange={(e) => update(i, { position: e.target.value })}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}