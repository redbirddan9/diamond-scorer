import { Button } from "@/components/ui/button";
import { Diamond } from "./Diamond";
import { applyEvent } from "@/lib/scoring/engine";
import { resolvePlay, validate } from "@/lib/scoring/rules";
import { RESULT_LABELS, notationParts } from "@/lib/scoring/notation";
import type {
  Base,
  Destination,
  GameState,
  PlayInput,
  RunnerKey,
} from "@/lib/scoring/types";
import { cn } from "@/lib/utils";

interface ReviewPanelProps {
  state: GameState;
  input: PlayInput;
  batterId: string;
  overrides: Partial<Record<RunnerKey, Destination>>;
  nameOf: (id: string) => string;
  onChange: (overrides: Partial<Record<RunnerKey, Destination>>) => void;
  onFinalize: () => void;
  onCancel: () => void;
}

const DESTINATIONS: { label: string; value: Destination }[] = [
  { label: "1st", value: 1 },
  { label: "2nd", value: 2 },
  { label: "3rd", value: 3 },
  { label: "Score", value: 4 },
  { label: "Out", value: "out" },
];

/**
 * Advancement review. Shown ONLY when a runner's destination is genuinely
 * uncertain. RBIs and the play classification are computed, never entered.
 */
export function ReviewPanel({
  state,
  input,
  batterId,
  overrides,
  nameOf,
  onChange,
  onFinalize,
  onCancel,
}: ReviewPanelProps) {
  const resolution = resolvePlay(state, input, overrides);
  const errors = validate(state, input, resolution);
  const preview = applyEvent(state, {
    id: "preview",
    ts: "",
    type: "play",
    batterId,
    input: input as never,
    overrides,
  });
  const notation = notationParts({
    id: "preview",
    ts: "",
    type: "play",
    batterId,
    input,
    resolution,
    inning: state.inning,
    half: state.half,
    battingTeam: state.half === "top" ? "away" : "home",
    slot: 0,
    pitcherId: "",
    outsBefore: state.outs,
    runsScored: [],
    taintedRuns: [],
    earnedRunIds: [],
    runResponsibility: {},
    pitchCount: 0,
  });

  const occupied = ([1, 2, 3] as Base[]).filter((b) => state.bases[b]);

  const destinationOf = (key: RunnerKey): Destination | "hold" => {
    if (key === "batter") return resolution.batterTo ?? "hold";
    const from = Number(key) as Base;
    const advance = resolution.advances.find((a) => a.from === from);
    return advance ? advance.to : "hold";
  };

  const setDestination = (key: RunnerKey, value: Destination) =>
    onChange({ ...overrides, [key]: value });

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-4">
        <Diamond
          first={Boolean(preview.bases[1])}
          second={Boolean(preview.bases[2])}
          third={Boolean(preview.bases[3])}
          size={96}
        />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="font-mono text-2xl font-bold">
            {notation.main}
            {notation.sub}
            {notation.below ? ` ${notation.below}` : ""}
          </p>
          <p className="truncate text-sm text-muted-foreground">
            {nameOf(batterId)} — {RESULT_LABELS[resolution.classification]}
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-sm">
            <span>Runs {resolution.runs}</span>
            <span>Outs {Math.min(state.outs + resolution.outsRecorded, 3)}</span>
            <span>RBI {resolution.rbi}</span>
            <span>
              {state.setup.away.name} {preview.score.away} – {preview.score.home}{" "}
              {state.setup.home.name}
            </span>
          </div>
        </div>
      </div>

      {resolution.batterTo !== null && resolution.batterTo !== "out" && (
        <RunnerRow
          label={`Batter — ${nameOf(batterId)}`}
          value={destinationOf("batter")}
          uncertain={resolution.uncertain.includes("batter")}
          options={DESTINATIONS}
          onSelect={(v) => setDestination("batter", v)}
        />
      )}

      {occupied.map((base) => {
        const key = String(base) as RunnerKey;
        return (
          <RunnerRow
            key={base}
            label={`${base === 1 ? "1st" : base === 2 ? "2nd" : "3rd"} — ${nameOf(state.bases[base]!)}`}
            value={destinationOf(key)}
            uncertain={resolution.uncertain.includes(key)}
            options={DESTINATIONS.filter(
              (d) => d.value === "out" || d.value === 4 || (typeof d.value === "number" && d.value > base),
            )}
            hold={{ label: base === 1 ? "Hold 1st" : base === 2 ? "Hold 2nd" : "Hold 3rd", value: base as Destination }}
            onSelect={(v) => setDestination(key, v)}
          />
        );
      })}

      {errors.length > 0 && (
        <ul className="rounded-md border border-destructive/60 bg-destructive/10 p-2 text-xs text-destructive">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        <Button variant="ghost" className="h-14" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          className="h-14 flex-1 text-base font-semibold"
          disabled={errors.length > 0}
          onClick={onFinalize}
        >
          Finalize Play
        </Button>
      </div>
    </div>
  );
}

function RunnerRow({
  label,
  value,
  options,
  hold,
  uncertain,
  onSelect,
}: {
  label: string;
  value: Destination | "hold";
  options: { label: string; value: Destination }[];
  hold?: { label: string; value: Destination };
  uncertain?: boolean;
  onSelect: (value: Destination) => void;
}) {
  const all = hold ? [hold, ...options] : options;
  return (
    <div className={cn("rounded-md border p-2", uncertain ? "border-ink" : "border-border")}>
      <p className="mb-2 truncate text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {all.map((opt) => (
          <Button
            key={String(opt.value)}
            size="sm"
            variant={value === opt.value ? "default" : "outline"}
            className="h-10 min-w-14 text-xs"
            onClick={() => onSelect(opt.value)}
          >
            {opt.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
