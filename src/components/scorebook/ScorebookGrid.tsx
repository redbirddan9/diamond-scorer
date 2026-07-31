import { notationParts } from "@/lib/scoring/notation";
import { buildScorecard, type CellModel, type RowModel } from "@/lib/scoring/scorecard";
import type { GameState, TeamSide } from "@/lib/scoring/types";
import { cn } from "@/lib/utils";

interface Props {
  state: GameState;
  side: TeamSide;
  /** Highlight the slot currently at bat. */
  activeSlot?: number | null;
}

/** Traditional paper-scorebook grid: batting order rows × inning columns. */
export function ScorebookGrid({ state, side, activeSlot }: Props) {
  const innings = Math.max(state.setup.innings, state.inning);
  const rows = buildScorecard(state, side);

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[11px]">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 w-36 border border-border bg-secondary p-1 text-left font-semibold">
              {state.setup[side].name}
            </th>
            {Array.from({ length: innings }, (_, i) => (
              <th key={i} className="w-14 border border-border bg-secondary p-1 font-mono">
                {i + 1}
              </th>
            ))}
            {["AB", "R", "H", "RBI"].map((h) => (
              <th key={h} className="w-8 border border-border bg-secondary p-1 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.slot}>
              <th
                className={cn(
                  "sticky left-0 z-10 border border-border bg-card p-1 text-left font-normal",
                  activeSlot === row.slot && "bg-field/60",
                )}
              >
                <NameBox row={row} />
              </th>
              {Array.from({ length: innings }, (_, i) => (
                <td
                  key={i}
                  className={cn(
                    "h-14 w-14 border border-border p-0 align-top",
                    row.boundaryInning === i + 1 && "border-l-[3px] border-l-ink",
                  )}
                >
                  <ScoreCell cell={row.cells[i + 1]} />
                </td>
              ))}
              {[row.ab, row.r, row.h, row.rbi].map((v, i) => (
                <td key={i} className="border border-border p-1 text-center font-mono">
                  {v}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function NameBox({ row }: { row: RowModel }) {
  return (
    <div className="space-y-0.5">
      {row.names.map((n, i) => {
        const replaced = i < row.names.length - 1;
        return (
          <div key={n.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-1">
            <span className={cn("truncate", replaced ? "line-through opacity-60" : "font-medium")}>
              {n.name}
              {n.inning ? ` (${n.inning})` : ""}
            </span>
            <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
              {n.position}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function ScoreCell({ cell }: { cell?: CellModel }) {
  if (!cell) return <div className="h-full w-full" />;
  const { play, base, scored, outOnBases, errorAdvance, pathLabels, outNumber, pitcherChange } =
    cell;
  const marks = notationParts(play);
  // Diamond corners: home, 1B, 2B, 3B.
  const corners: Record<number, [number, number]> = {
    1: [50, 32],
    2: [30, 12],
    3: [10, 32],
    4: [30, 52],
  };
  // Any out on the basepaths: circle the corner where the runner was retired.
  const outCorner = outOnBases ? corners[outOnBases.base] : undefined;
  const outFrom =
    outOnBases && outOnBases.base > 1 ? corners[outOnBases.base - 1] : undefined;
  const outMid =
    outCorner && outFrom
      ? [(outCorner[0] + outFrom[0]) / 2, (outCorner[1] + outFrom[1]) / 2]
      : undefined;
  // Secondary error on a hit: label the basepath the batter took on the error.
  const eaFrom = errorAdvance ? corners[errorAdvance.from] : undefined;
  const eaTo = errorAdvance ? corners[errorAdvance.to] : undefined;
  const eaMid =
    eaFrom && eaTo ? [(eaFrom[0] + eaTo[0]) / 2, (eaFrom[1] + eaTo[1]) / 2] : undefined;
  // Reason labels (SB, WP, PB, BK, DI, E#) along the basepath each was taken on.
  const reasonMarks = (pathLabels ?? []).map((p, i) => {
    const a = corners[p.from];
    const b = corners[p.to];
    if (!a || !b) return null;
    const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    return { key: `${i}-${p.label}`, x: mid[0], y: mid[1], label: p.label };
  });

  return (
    <div className="relative h-full w-full">
      <svg viewBox="0 0 60 60" className="absolute inset-0 h-full w-full">
        <path d="M30 52 L10 32 L30 12 L50 32 Z" className="fill-none stroke-border" strokeWidth="1" />
        {scored && (
          <path d="M30 52 L10 32 L30 12 L50 32 Z" className="fill-field/70 stroke-none" />
        )}
        {base >= 1 && <path d="M30 52 L50 32" className="stroke-ink" strokeWidth="2.5" fill="none" />}
        {base >= 2 && <path d="M50 32 L30 12" className="stroke-ink" strokeWidth="2.5" fill="none" />}
        {base >= 3 && <path d="M30 12 L10 32" className="stroke-ink" strokeWidth="2.5" fill="none" />}
        {base >= 4 && <path d="M10 32 L30 52" className="stroke-ink" strokeWidth="2.5" fill="none" />}
        {pitcherChange && <path d="M60 60 L60 44 L44 60 Z" className="fill-ink" />}
        {errorAdvance && eaMid && (
          <text
            x={eaMid[0]}
            y={eaMid[1]}
            dx={eaMid[0] < 30 ? -3 : 3}
            dy={eaMid[1] < 32 ? -2 : 4}
            textAnchor="middle"
            className="fill-ink font-mono"
            fontSize="8"
            fontWeight="700"
          >
            {errorAdvance.label}
          </text>
        )}
        {reasonMarks.map(
          (m) =>
            m && (
              <text
                key={m.key}
                x={m.x}
                y={m.y}
                dx={m.x < 30 ? -3 : 3}
                dy={m.y < 32 ? -2 : 4}
                textAnchor="middle"
                className="fill-ink font-mono"
                fontSize="8"
                fontWeight="700"
              >
                {m.label}
              </text>
            ),
        )}
        {outCorner && (
          <>
            {outFrom && outOnBases?.label !== "PO" && (
              <path
                d={`M${outFrom[0]} ${outFrom[1]} L${outCorner[0]} ${outCorner[1]}`}
                className="stroke-ink"
                strokeWidth="1.5"
                fill="none"
              />
            )}
            <circle
              cx={outCorner[0]}
              cy={outCorner[1]}
              r="5"
              className="fill-none stroke-ink"
              strokeWidth="1.5"
            />
            {outOnBases?.label &&
              (outMid && outOnBases.label !== "PO" ? (
                <text
                  x={outMid[0]}
                  y={outMid[1]}
                  dx="-1"
                  dy="-2"
                  textAnchor="middle"
                  className="fill-ink font-mono"
                  fontSize="9"
                  fontWeight="700"
                >
                  {outOnBases.label}
                </text>
              ) : (
                <text
                  x={outCorner[0]}
                  y={outCorner[1]}
                  dx={outCorner[0] < 30 ? -8 : 8}
                  dy={outCorner[1] < 32 ? -4 : 6}
                  textAnchor="middle"
                  className="fill-ink font-mono"
                  fontSize="9"
                  fontWeight="700"
                >
                  {outOnBases.label}
                </text>
              ))}
          </>
        )}
      </svg>
      <div className="relative flex h-full flex-col items-center justify-center leading-none">
        {marks.above && (
          <span className="font-mono text-[10px] font-bold leading-none tracking-tight">
            {marks.above}
          </span>
        )}
        <span className="font-mono text-[13px] font-bold">
          {marks.main}
          {marks.sub && <sub className="text-[9px] font-semibold">{marks.sub}</sub>}
        </span>
        {marks.below && <span className="font-mono text-[9px] font-bold">{marks.below}</span>}
        {play.resolution.rbi > 0 && (
          <span className="text-[8px] text-muted-foreground">{play.resolution.rbi} RBI</span>
        )}
      </div>
      {outNumber && (
        <span className="absolute bottom-0 left-0.5 font-mono text-[9px] text-pencil">
          {outNumber}
        </span>
      )}
    </div>
  );
}