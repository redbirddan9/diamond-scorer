import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { createGame, loadTemplates, saveTemplate } from "@/lib/storage/games";
import { loadRecall, rememberRecall } from "@/lib/storage/recall";
import { PositionGrid } from "@/components/scorebook/PositionGrid";
import { newId } from "@/lib/useGame";
import type { GameSetup, Player, TeamSetup } from "@/lib/scoring/types";

export const Route = createFileRoute("/new")({
  head: () => ({
    meta: [
      { title: "New Game Setup — Scorebook Deck" },
      {
        name: "description",
        content: "Enter teams, date, ballpark, pitchers and lineups before first pitch.",
      },
      { property: "og:title", content: "New Game Setup — Scorebook Deck" },
      {
        property: "og:description",
        content: "Set up teams, pitchers and lineups before first pitch.",
      },
    ],
  }),
  component: NewGame,
});

export const POSITION_OPTIONS = ["DH", "C", "1B", "2B", "SS", "3B", "LF", "CF", "RF"];

function blankRoster(prefix: string): Player[] {
  return Array.from({ length: 9 }, (_, i) => ({
    id: `${prefix}-${i}-${Math.random().toString(36).slice(2, 7)}`,
    number: "",
    name: "",
    position: "",
  }));
}

function NewGame() {
  const navigate = useNavigate();
  const [away, setAway] = useState<Player[]>(() => blankRoster("away"));
  const [home, setHome] = useState<Player[]>(() => blankRoster("home"));
  const [showMore, setShowMore] = useState(false);
  const [useDh, setUseDh] = useState(true);
  const [trackPitches, setTrackPitches] = useState(false);
  const [meta, setMeta] = useState({
    awayName: "Away",
    homeName: "Home",
    date: new Date().toISOString().slice(0, 10),
    stadium: "",
    city: "",
    awayPitcher: "",
    homePitcher: "",
    startTime: "",
    attendance: "",
    notes: "",
    innings: "9",
    umpHome: "",
    umpFirst: "",
    umpSecond: "",
    umpThird: "",
  });
  const templates = loadTemplates();
  const recall = {
    teams: loadRecall("teams"),
    stadiums: loadRecall("stadiums"),
    cities: loadRecall("cities"),
  };

  const buildTeam = (name: string, players: Player[], pitcherName: string): TeamSetup => {
    const filled = players.map((p, i) => ({
      ...p,
      name: p.name.trim() || `Player ${i + 1}`,
      position: p.position || (useDh && i === 0 ? "DH" : ""),
    }));
    const lineup = filled.map((p) => p.id);
    const inLineupPitcher = filled.find((p) => p.position === "P");
    if (!useDh && inLineupPitcher) {
      return { name: name.trim() || "Team", players: filled, lineup, pitcherId: inLineupPitcher.id };
    }
    const pitcher: Player = {
      id: `${name}-p-${Math.random().toString(36).slice(2, 7)}`,
      number: "",
      name: pitcherName.trim() || "Pitcher",
      position: "P",
    };
    return {
      name: name.trim() || "Team",
      players: [...filled, pitcher],
      lineup,
      pitcherId: pitcher.id,
    };
  };

  const start = async () => {
    const setup: GameSetup = {
      id: newId(),
      createdAt: new Date().toISOString(),
      date: meta.date,
      startTime: meta.startTime,
      stadium: meta.stadium,
      city: meta.city,
      attendance: meta.attendance,
      notes: meta.notes,
      useDh,
      trackPitches,
      umpires: {
        home: meta.umpHome,
        first: meta.umpFirst,
        second: meta.umpSecond,
        third: meta.umpThird,
      },
      innings: Number(meta.innings) || 9,
      away: buildTeam(meta.awayName, away, meta.awayPitcher),
      home: buildTeam(meta.homeName, home, meta.homePitcher),
    };
    rememberRecall("teams", meta.awayName, meta.homeName);
    rememberRecall("stadiums", meta.stadium);
    rememberRecall("cities", meta.city);
    const game = await createGame(setup);
    void navigate({ to: "/game/$gameId", params: { gameId: game.id } });
  };

  const field = (key: keyof typeof meta, label: string, type = "text", list?: string) => (
    <div className="space-y-1">
      <Label htmlFor={key} className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      <Input
        id={key}
        type={type}
        list={list}
        className="h-11"
        value={meta[key]}
        onChange={(e) => setMeta({ ...meta, [key]: e.target.value })}
      />
    </div>
  );

  const datalist = (id: string, values: string[]) => (
    <datalist id={id}>
      {values.map((v) => (
        <option key={v} value={v} />
      ))}
    </datalist>
  );

  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl px-4 pb-24 pt-6">
      <h1 className="text-2xl font-bold tracking-tight">New Game</h1>
      <p className="text-sm text-muted-foreground">Everything is stored locally on this device.</p>

      <section className="mt-6 space-y-3">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {field("awayName", "Away Team", "text", "recall-teams")}
          {field("homeName", "Home Team", "text", "recall-teams")}
          {field("date", "Date", "date")}
          {field("stadium", "Stadium", "text", "recall-stadiums")}
          {field("city", "City", "text", "recall-cities")}
        </div>
        {datalist("recall-teams", recall.teams)}
        {datalist("recall-stadiums", recall.stadiums)}
        {datalist("recall-cities", recall.cities)}
      </section>

      <section className="mt-6 space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide">Starting Pitchers</h2>
        <div className="grid grid-cols-2 gap-3">
          {field("awayPitcher", `${meta.awayName || "Away"} Pitcher`)}
          {field("homePitcher", `${meta.homeName || "Home"} Pitcher`)}
        </div>
      </section>

      <section className="mt-6">
        <Button
          variant="outline"
          className="h-12 w-full justify-start"
          onClick={() => setShowMore((s) => !s)}
        >
          {showMore ? (
            <ChevronDown className="mr-2 h-4 w-4" />
          ) : (
            <ChevronRight className="mr-2 h-4 w-4" />
          )}
          Game details &amp; settings
        </Button>
        {showMore && (
          <div className="mt-3 space-y-4 rounded-md border border-border p-3">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {field("startTime", "Start Time", "time")}
              {field("attendance", "Attendance")}
              {field("innings", "Innings")}
            </div>
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Umpires
              </h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {field("umpHome", "Home Plate")}
                {field("umpFirst", "First Base")}
                {field("umpSecond", "Second Base")}
                {field("umpThird", "Third Base")}
              </div>
            </div>
            <div className="flex items-center justify-between rounded-md border border-border p-3">
              <div>
                <p className="text-sm font-medium">Universal DH</p>
                <p className="text-xs text-muted-foreground">
                  Pitcher does not bat; the lineup uses a designated hitter.
                </p>
              </div>
              <Switch checked={useDh} onCheckedChange={setUseDh} aria-label="Universal DH" />
            </div>
            <div className="flex items-center justify-between rounded-md border border-border p-3">
              <div>
                <p className="text-sm font-medium">Track pitch counts</p>
                <p className="text-xs text-muted-foreground">
                  Show ball/strike/foul entry and pitch totals while scoring.
                </p>
              </div>
              <Switch
                checked={trackPitches}
                onCheckedChange={setTrackPitches}
                aria-label="Track pitch counts"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="notes" className="text-xs uppercase tracking-wide text-muted-foreground">
                Notes
              </Label>
              <Textarea
                id="notes"
                value={meta.notes}
                onChange={(e) => setMeta({ ...meta, notes: e.target.value })}
              />
            </div>
          </div>
        )}
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
  const [openPos, setOpenPos] = useState<number | null>(null);

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
                    t.players.map((p) => ({
                      ...p,
                      id: `${p.id}-${Math.random().toString(36).slice(2, 6)}`,
                    })),
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
          <li key={p.id} className="space-y-1">
            <div className="grid grid-cols-[minmax(0,1fr)_6rem] items-center gap-2">
              <Input
                className="h-11"
                value={p.name}
                placeholder={`Player ${i + 1}`}
                aria-label="Player name"
                onChange={(e) => update(i, { name: e.target.value })}
              />
              <Button
                type="button"
                variant="outline"
                aria-label="Position"
                className="h-11 font-medium"
                onClick={() => setOpenPos(openPos === i ? null : i)}
              >
                {p.position || "Pos"}
              </Button>
            </div>
            {openPos === i && (
              <div className="rounded-md border border-border p-2">
                <PositionGrid
                  value={p.position}
                  onChange={(pos) => {
                    update(i, { position: pos });
                    setOpenPos(null);
                  }}
                />
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
