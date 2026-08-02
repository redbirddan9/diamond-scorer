import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { registerBackHandler } from "@/lib/keyboard/spatial-nav";
import { TeamMark } from "./TeamMark";
import { MLB_DIVISIONS, MLB_TEAMS, teamsByDivision, type MlbTeam } from "@/lib/teams/mlb";

interface Props {
  label: string;
  /** Selected MLB club id, or undefined for a custom (manually typed) team. */
  teamId?: string;
  name: string;
  /** Datalist id for remembered custom team names. */
  recallListId?: string;
  onChange: (next: { teamId?: string; name: string }) => void;
}

export function TeamPicker({ label, teamId, name, recallListId, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  // MLB-first: start on the club picker unless a custom name was already typed.
  const [manual, setManual] = useState(() => !teamId && name.trim().length > 0);
  const searchRef = useRef<HTMLInputElement>(null);

  // Opening the list puts the caret in search so typing filters straight away.
  useEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);

  // Backspace closes the club list (unless the caret is in a text field).
  useEffect(
    () =>
      registerBackHandler(() => {
        if (!open) return false;
        setOpen(false);
        return true;
      }),
    [open],
  );

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return MLB_TEAMS.filter((t) =>
      [t.name, t.city, t.nickname, t.id].some((v) => v.toLowerCase().includes(q)),
    );
  }, [query]);

  const pick = (team: MlbTeam) => {
    onChange({ teamId: team.id, name: team.name });
    setQuery("");
    setManual(false);
    setOpen(false);
  };

  const row = (team: MlbTeam) => (
    <button
      key={`${team.id}-${team.name}`}
      type="button"
      onClick={() => pick(team)}
      className="flex h-11 w-full items-center gap-2 rounded-md px-2 text-left text-sm hover:bg-secondary aria-[current=true]:bg-secondary"
      aria-current={team.id === teamId}
    >
      <TeamMark teamId={team.id} name={team.name} size={22} />
      <span className="truncate">{team.name}</span>
    </button>
  );

  return (
    <div className="space-y-1">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>
      {manual ? (
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-1">
          <Input
            className="h-11"
            value={name}
            list={recallListId}
            aria-label={label}
            onChange={(e) => onChange({ teamId: undefined, name: e.target.value })}
          />
          <Button
            type="button"
            variant="outline"
            className="h-11 px-2 text-xs"
            onClick={() => {
              setManual(false);
              setOpen(true);
            }}
          >
            MLB
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="h-11 w-full justify-start gap-2 font-medium"
          onClick={() => setOpen((o) => !o)}
        >
          {name ? (
            <>
              <TeamMark teamId={teamId} name={name} size={22} />
              <span className="truncate">{name}</span>
            </>
          ) : (
            <span className="truncate text-muted-foreground">Select team…</span>
          )}
        </Button>
      )}

      {open && (
        <div className="rounded-md border border-border bg-card p-2">
          <Input
            className="h-10"
            ref={searchRef}
            placeholder="Search teams…"
            value={query}
            autoComplete="off"
            aria-label="Search MLB teams"
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="mt-2 max-h-56 overflow-y-auto">
            {matches ? (
              matches.length ? (
                matches.map(row)
              ) : (
                <p className="p-2 text-sm text-muted-foreground">No teams match.</p>
              )
            ) : (
              MLB_DIVISIONS.map((div) => (
                <div key={div} className="mb-1">
                  <p className="px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-widest text-muted-foreground">
                    {div}
                  </p>
                  {teamsByDivision(div).map(row)}
                </div>
              ))
            )}
          </div>
          <Button
            type="button"
            variant="ghost"
            className="mt-1 h-10 w-full justify-start text-sm"
            onClick={() => {
              onChange({ teamId: undefined, name: teamId ? "" : name });
              setManual(true);
              setQuery("");
              setOpen(false);
            }}
          >
            Enter team name manually…
          </Button>
        </div>
      )}
    </div>
  );
}