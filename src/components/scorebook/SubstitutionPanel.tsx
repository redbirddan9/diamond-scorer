import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PositionGrid } from "./PositionGrid";
import { battingSide, fieldingSide } from "@/lib/scoring/engine";
import type { Base, GameState, SubEvent, TeamSide } from "@/lib/scoring/types";

type Kind = "PH" | "PR" | "P" | "DEF";

const KINDS: { value: Kind; label: string; hint: string }[] = [
  { value: "PH", label: "Pinch Hitter", hint: "Bats for the current slot" },
  { value: "PR", label: "Pinch Runner", hint: "Replaces a runner on base" },
  { value: "P", label: "Pitching Change", hint: "New pitcher enters" },
  { value: "DEF", label: "Defensive Sub", hint: "Fielding replacement" },
];

interface Props {
  state: GameState;
  onSubmit: (sub: Omit<SubEvent, "id" | "ts" | "type">) => void;
  onCancel: () => void;
}

export function SubstitutionPanel({ state, onSubmit, onCancel }: Props) {
  const [kind, setKind] = useState<Kind | null>(null);
  const [name, setName] = useState("");
  const [slot, setSlot] = useState<number | null>(null);
  const [base, setBase] = useState<Base | null>(null);
  const [position, setPosition] = useState("");

  const offense = battingSide(state);
  const defense = fieldingSide(state);
  const team: TeamSide = kind === "PH" || kind === "PR" ? offense : defense;
  const order = state.lineup[team];
  const nameOf = (id: string) => state.playerNames[id] ?? id;
  const occupied = ([1, 2, 3] as Base[]).filter((b) => state.bases[b]);

  const submit = () => {
    if (!kind || !name.trim()) return;
    const inPlayerId = `sub-${Math.random().toString(36).slice(2, 9)}`;
    let outPlayerId = "";
    let outSlot: number | undefined;
    let pos = position;

    if (kind === "PH") {
      outSlot = slot ?? state.slot[team] % order.length;
      outPlayerId = order[outSlot];
      // Defensive position is assigned later (after the half inning ends).
      pos = "PH";
    } else if (kind === "PR") {
      const b = base ?? occupied[0];
      if (!b) return;
      outPlayerId = state.bases[b]!;
      const idx = order.indexOf(outPlayerId);
      if (idx >= 0) outSlot = idx;
      pos = "PR";
    } else if (kind === "P") {
      outPlayerId = state.pitcher[team];
      pos = "P";
      const idx = order.indexOf(outPlayerId);
      if (idx >= 0) outSlot = idx;
    } else {
      outPlayerId = order.find((id) => state.positions[team][id] === position) ?? "";
      const idx = order.indexOf(outPlayerId);
      if (idx >= 0) outSlot = idx;
    }

    onSubmit({
      team,
      kind,
      outPlayerId,
      inPlayerId,
      inPlayerName: name.trim(),
      slot: outSlot,
      position: pos || undefined,
      base: kind === "PR" ? (base ?? occupied[0]) : undefined,
    });
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold uppercase tracking-wide">Substitution</h3>
      <div className="grid grid-cols-4 gap-2">
        {KINDS.map((k) => (
          <Button
            key={k.value}
            variant={kind === k.value ? "default" : "outline"}
            className="h-14 flex-col gap-0.5 px-1"
            onClick={() => {
              setKind(k.value);
              setPosition("");
              setSlot(null);
              setBase(null);
            }}
          >
            <span className="text-xs font-semibold">{k.label}</span>
            <span className="text-[9px] font-normal opacity-70">{k.hint}</span>
          </Button>
        ))}
      </div>

      {kind && (
        <div className="space-y-3 rounded-md border border-border p-3">
          <p className="text-xs text-muted-foreground">
            {team === "away" ? state.setup.away.name : state.setup.home.name}
          </p>
          <Input
            className="h-11"
            placeholder="Incoming player name"
            value={name}
            autoFocus
            onChange={(e) => setName(e.target.value)}
          />

          {kind === "PH" && (
            <div>
              <p className="mb-1 text-xs uppercase text-muted-foreground">Batting slot</p>
              <div className="grid grid-cols-9 gap-1">
                {order.map((id, i) => (
                  <Button
                    key={id}
                    variant={(slot ?? state.slot[team] % order.length) === i ? "default" : "outline"}
                    className="h-10 px-0 font-mono"
                    onClick={() => setSlot(i)}
                    title={nameOf(id)}
                  >
                    {i + 1}
                  </Button>
                ))}
              </div>
              <p className="mt-1 truncate text-xs text-muted-foreground">
                Replacing {nameOf(order[slot ?? state.slot[team] % order.length])}
              </p>
            </div>
          )}

          {kind === "PR" && (
            <div>
              <p className="mb-1 text-xs uppercase text-muted-foreground">Runner</p>
              {occupied.length === 0 ? (
                <p className="text-sm text-muted-foreground">No runners on base.</p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {occupied.map((b) => (
                    <Button
                      key={b}
                      variant={(base ?? occupied[0]) === b ? "default" : "outline"}
                      className="h-11 flex-col gap-0"
                      onClick={() => setBase(b)}
                    >
                      <span className="text-xs">{b === 1 ? "1st" : b === 2 ? "2nd" : "3rd"}</span>
                      <span className="truncate text-[10px] opacity-70">
                        {nameOf(state.bases[b]!)}
                      </span>
                    </Button>
                  ))}
                </div>
              )}
            </div>
          )}

          {kind === "DEF" && (
            <div>
              <p className="mb-1 text-xs uppercase text-muted-foreground">Position</p>
              <PositionGrid value={position} onChange={setPosition} compact />
            </div>
          )}

          {(kind === "PH" || kind === "PR") && (
            <p className="text-xs text-muted-foreground">
              Shown as {kind}. Pick a fielding position after the half inning ends.
            </p>
          )}

          {kind === "P" && (
            <p className="text-sm text-muted-foreground">
              Replacing {nameOf(state.pitcher[team])} on the mound.
            </p>
          )}

          <div className="flex gap-2">
            <Button variant="ghost" className="h-11" onClick={onCancel}>
              Cancel
            </Button>
            <Button className="h-11 flex-1" onClick={submit} disabled={!name.trim()}>
              Make substitution
            </Button>
          </div>
        </div>
      )}

      {!kind && (
        <Button variant="ghost" className="h-11" onClick={onCancel}>
          Cancel
        </Button>
      )}
    </div>
  );
}
