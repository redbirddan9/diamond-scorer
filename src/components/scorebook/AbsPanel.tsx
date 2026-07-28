import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { AbsCaller, AbsOutcome, GameState, TeamSide } from "@/lib/scoring/types";
import { battingSide, fieldingSide } from "@/lib/scoring/engine";

const CALLERS: { value: AbsCaller; label: string }[] = [
  { value: "pitcher", label: "Pitcher" },
  { value: "catcher", label: "Catcher" },
  { value: "batter", label: "Batter" },
];

const OUTCOMES: { value: AbsOutcome; label: string }[] = [
  { value: "ball-confirmed", label: "Ball confirmed" },
  { value: "ball-overturned", label: "Ball overturned" },
  { value: "strike-confirmed", label: "Strike confirmed" },
  { value: "strike-overturned", label: "Strike overturned" },
];

interface Props {
  state: GameState;
  onSubmit: (caller: AbsCaller, outcome: AbsOutcome) => void;
  onCancel: () => void;
}

/** ABS (Automated Ball-Strike) challenge entry. */
export function AbsPanel({ state, onSubmit, onCancel }: Props) {
  const [caller, setCaller] = useState<AbsCaller | null>(null);
  const team: TeamSide | null =
    caller === null ? null : caller === "batter" ? battingSide(state) : fieldingSide(state);
  const remaining = team ? state.challenges[team] : null;

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide">ABS Challenge</h3>
        <p className="text-xs text-muted-foreground">
          {state.setup.away.name} {state.challenges.away} · {state.setup.home.name}{" "}
          {state.challenges.home} left
        </p>
      </div>

      <div>
        <p className="mb-1 text-xs uppercase text-muted-foreground">Who called it?</p>
        <div className="grid grid-cols-3 gap-2">
          {CALLERS.map((c) => (
            <Button
              key={c.value}
              variant={caller === c.value ? "default" : "outline"}
              className="h-12"
              onClick={() => setCaller(c.value)}
            >
              {c.label}
            </Button>
          ))}
        </div>
      </div>

      {caller && (
        <div>
          <p className="mb-1 text-xs uppercase text-muted-foreground">
            Result {remaining === 0 && "— no challenges remaining"}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {OUTCOMES.map((o) => (
              <Button
                key={o.value}
                variant="secondary"
                className="h-12"
                disabled={remaining === 0}
                onClick={() => onSubmit(caller, o.value)}
              >
                {o.label}
              </Button>
            ))}
          </div>
        </div>
      )}

      <Button variant="ghost" className="h-11" onClick={onCancel}>
        Cancel
      </Button>
    </div>
  );
}
