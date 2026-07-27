import { notationFor } from "@/lib/scoring/notation";
import type { GameState, LoggedPlay, TeamSide } from "@/lib/scoring/types";
import { cn } from "@/lib/utils";

interface Props {
  state: GameState;
  side: TeamSide;
}

/** Traditional paper-scorebook grid: batting order rows × inning columns. */
export function ScorebookGrid({ state, side }: Props) {
  const innings = Math.max(state.setup.innings, state.inning);
  const order = state.lineup[side];
  const playerName = (id: string) =>
    state.setup[side].players.find((p) => p.id === id)?.name ?? id;
  const playerNumber = (id: string) =>
    state.setup[side].players.find((p) => p.id === id)?.number ?? "";

  const cellFor = (slot: number, inning: number) =>
    state.plays.find((p) => p.battingTeam === side && p.slot === slot && p.inning === inning);

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 min-w-40 border border-border bg-secondary p-2 text-left font-semibold">
              {state.setup[side].name}
            </th>
            {Array.from({ length: innings }, (_, i) => (
              <th key={i} className="w-20 border border-border bg-secondary p-2 font-mono">
                {i + 1}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {order.map((playerId, slot) => (
            <tr key={`${playerId}-${slot}`}>
              <th className="sticky left-0 z-10 border border-border bg-card p-2 text-left font-normal">
                <span className="mr-2 font-mono text-muted-foreground">{playerNumber(playerId)}</span>
                <span className="font-medium">{playerName(playerId)}</span>
              </th>
              {Array.from({ length: innings }, (_, i) => (
                <td key={i} className="h-20 w-20 border border-border p-0 align-top">
                  <ScoreCell play={cellFor(slot, i + 1)} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ScoreCell({ play }: { play?: LoggedPlay }) {
  const reached = play && play.batterTo !== "out";
  const scored = play?.runsScored.includes(play.batterId);
  const basesReached =
    play?.batterTo === "out"
      ? 0
      : play?.batterTo === 4
        ? 4
        : typeof play?.batterTo === "number"
          ? play.batterTo
          : 0;

  return (
    <div className="relative h-full w-full p-1">
      <svg viewBox="0 0 60 60" className="absolute inset-0 h-full w-full">
        <path
          d="M30 52 L10 32 L30 12 L50 32 Z"
          className={cn("fill-none stroke-border")}
          strokeWidth="1"
        />
        {play && basesReached >= 1 && (
          <path d="M30 52 L50 32" className="stroke-ink" strokeWidth="2.5" fill="none" />
        )}
        {play && basesReached >= 2 && (
          <path d="M50 32 L30 12" className="stroke-ink" strokeWidth="2.5" fill="none" />
        )}
        {play && basesReached >= 3 && (
          <path d="M30 12 L10 32" className="stroke-ink" strokeWidth="2.5" fill="none" />
        )}
        {scored && (
          <>
            <path d="M10 32 L30 52" className="stroke-ink" strokeWidth="2.5" fill="none" />
            <path d="M30 52 L10 32 L30 12 L50 32 Z" className="fill-field/70 stroke-none" />
          </>
        )}
      </svg>
      <div className="relative flex h-full flex-col items-center justify-center">
        <span className="font-mono text-[11px] font-bold leading-none">
          {play ? notationFor(play) : ""}
        </span>
        {play && play.rbi > 0 && (
          <span className="mt-0.5 text-[9px] text-muted-foreground">{play.rbi} RBI</span>
        )}
      </div>
      {play && play.batterTo === "out" && (
        <span className="absolute bottom-0.5 right-1 font-mono text-[9px] text-pencil">
          {play.outsBefore + 1}
        </span>
      )}
      {!reached && !play && <span className="sr-only">no plate appearance</span>}
    </div>
  );
}