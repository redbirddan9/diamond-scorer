import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PositionGrid } from "./PositionGrid";
import type { GameState, TeamSide } from "@/lib/scoring/types";

export interface PendingFielder {
  team: TeamSide;
  playerId: string;
  placeholder: string;
}

/** Pending pinch hitters / pinch runners on the team now taking the field. */
export function pendingFielders(state: GameState, team: TeamSide): PendingFielder[] {
  return state.lineup[team]
    .map((id) => ({ team, playerId: id, placeholder: state.positions[team][id] ?? "" }))
    .filter((p) => p.placeholder === "PH" || p.placeholder === "PR");
}

interface Props {
  state: GameState;
  pending: PendingFielder;
  onAssign: (position: string) => void;
  onSkip: () => void;
}

export function PositionAssign({ state, pending, onAssign, onSkip }: Props) {
  const [position, setPosition] = useState("");
  const name = state.playerNames[pending.playerId] ?? pending.playerId;

  return (
    <div className="space-y-2 rounded-md border border-border bg-card p-3">
      <p className="text-sm font-semibold uppercase tracking-wide">Fielding position</p>
      <p className="text-xs text-muted-foreground">
        {name} entered as {pending.placeholder}. Where do they play?
      </p>
      <PositionGrid value={position} onChange={setPosition} compact />
      <div className="flex gap-2">
        <Button variant="ghost" className="h-10" onClick={onSkip}>
          Later
        </Button>
        <Button className="h-10 flex-1" disabled={!position} onClick={() => onAssign(position)}>
          Assign
        </Button>
      </div>
    </div>
  );
}
