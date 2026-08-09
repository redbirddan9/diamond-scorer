import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { createGame } from "@/lib/storage/games";
import { loadRecall, rememberRecall } from "@/lib/storage/recall";
import { PositionGrid } from "@/components/scorebook/PositionGrid";
import { TeamPicker } from "@/components/scorebook/TeamPicker";
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
  const [teamIds, setTeamIds] = useState<{ away?: string; home?: string }>({});
  const [meta, setMeta] = useState({
    awayName: "",
    homeName: "",
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
  const [recall, setRecall] = useState({
    teams: [] as string[],
    stadiums: [] as string[],
    cities: [] as string[],
    players: [] as string[],
  });
  useEffect(() => {
    setRecall({
      teams: loadRecall("teams"),
      stadiums: loadRecall("stadiums"),
      cities: loadRecall("cities"),
      players: loadRecall("players"),
    });
  }, []);

  const buildTeam = (
    name: string,
    players: Player[],
    pitcherName: string,
    teamId?: string,
  ): TeamSetup => {
    const filled = players.map((p, i) => ({
      ...p,
      name: p.name.trim() || `Player ${i + 1}`,
      position: p.position || (useDh && i === 0 ? "DH" : ""),
    }));
    const lineup = filled.map((p) => p.id);
    const inLineupPitcher = filled.find((p) => p.position === "P");
    if (!useDh && inLineupPitcher) {
      return {
        name: name.trim() || "Team",
        teamId,
        players: filled,
        lineup,
        pitcherId: inLineupPitcher.id,
      };
    }
    const pitcher: Player = {
      id: `${name}-p-${Math.random().toString(36).slice(2, 7)}`,
      number: "",
      name: pitcherName.trim() || "Pitcher",
      position: "P",
    };
    return {
      name: name.trim() || "Team",
      teamId,
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
      away: buildTeam(meta.awayName || "Away", away, meta.awayPitcher, teamIds.away),
      home: buildTeam(meta.homeName || "Home", home, meta.homePitcher, teamIds.home),
    };
    if (!teamIds.away) rememberRecall("teams", meta.awayName);
    if (!teamIds.home) rememberRecall("teams", meta.homeName);
    rememberRecall("stadiums", meta.stadium);
    rememberRecall("cities", meta.city);
    rememberRecall("players", ...[...away, ...home].map((p) => p.name));
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
    <main className="mx-auto min-h-screen w-full max-w-4xl px-4 pb-24 pt-4">
      <Button
        variant="ghost"
        className="-ml-2 h-10 px-2 text-sm"
        onClick={() => navigate({ to: "/" })}
        aria-label="Back to library"
      >
        <ArrowLeft className="mr-1 h-4 w-4" /> Back
      </Button>

      <h1 className="text-2xl font-bold tracking-tight">New Game</h1>
      <p className="text-sm text-muted-foreground">Everything is stored locally on this device.</p>

      <section className="mt-6 space-y-3">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <TeamPicker
            label="Away Team"
            teamId={teamIds.away}
            name={meta.awayName}
            recallListId="recall-teams"
            onChange={({ teamId, name }) => {
              setTeamIds((t) => ({ ...t, away: teamId }));
              setMeta((m) => ({ ...m, awayName: name }));
            }}
          />
          <TeamPicker
            label="Home Team"
            teamId={teamIds.home}
            name={meta.homeName}
            recallListId="recall-teams"
            onChange={({ teamId, name }) => {
              setTeamIds((t) => ({ ...t, home: teamId }));
              setMeta((m) => ({ ...m, homeName: name }));
            }}
          />
          {field("date", "Date", "date")}
          {field("stadium", "Stadium", "text", "recall-stadiums")}
          {field("city", "City", "text", "recall-cities")}
        </div>
        {datalist("recall-teams", recall.teams)}
        {datalist("recall-stadiums", recall.stadiums)}
        {datalist("recall-cities", recall.cities)}
        {datalist("recall-players", recall.players)}
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

      <RosterEditor title={`${meta.awayName || "Away"} Lineup`} players={away} onChange={setAway} />
      <RosterEditor title={`${meta.homeName || "Home"} Lineup`} players={home} onChange={setHome} />

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
}: {
  title: string;
  players: Player[];
  onChange: (players: Player[]) => void;
}) {
  const update = (index: number, patch: Partial<Player>) =>
    onChange(players.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  const [openPos, setOpenPos] = useState<number | null>(null);

  return (
    <section className="mt-6 space-y-2">
      <h2 className="truncate text-sm font-semibold uppercase tracking-wide">{title}</h2>
      <ul className="space-y-1.5">
        {players.map((p, i) => (
          <li key={p.id} className="space-y-1">
            <div className="grid grid-cols-[minmax(0,1fr)_6rem] items-center gap-2">
              <Input
                className="h-11"
                value={p.name}
                list="recall-players"
                autoComplete="off"
                placeholder={`Player ${i + 1}`}
                aria-label="Player name"
                onChange={(e) => update(i, { name: e.target.value })}
                onBlur={(e) => rememberRecall("players", e.target.value)}
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
