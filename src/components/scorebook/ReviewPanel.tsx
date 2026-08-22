import { Button } from "@/components/ui/button";
import { Diamond } from "./Diamond";
import { applyEvent } from "@/lib/scoring/engine";
import { resolvePlay, validate } from "@/lib/scoring/rules";
import { RESULT_LABELS, notationParts } from "@/lib/scoring/notation";
import type {
  Base,
  Destination,
  GameState,
  OutDetail,
  OutDetails,
  PlayInput,
  RunnerKey,
} from "@/lib/scoring/types";
import { cn } from "@/lib/utils";

interface ReviewPanelProps {
  state: GameState;
  input: PlayInput;
  batterId: string;
  overrides: Partial<Record<RunnerKey, Destination>>;
  outDetails: OutDetails;
  nameOf: (id: string) => string;
  onChange: (overrides: Partial<Record<RunnerKey, Destination>>) => void;
  onDetailsChange: (details: OutDetails) => void;
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

const BASE_LABEL: Record<number, string> = { 1: "1st", 2: "2nd", 3: "3rd", 4: "Home" };

const FIELDERS = [
  { n: 1, label: "P" },
  { n: 2, label: "C" },
  { n: 3, label: "1B" },
  { n: 4, label: "2B" },
  { n: 5, label: "3B" },
  { n: 6, label: "SS" },
  { n: 7, label: "LF" },
  { n: 8, label: "CF" },
  { n: 9, label: "RF" },
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
  outDetails,
  nameOf,
  onChange,
  onDetailsChange,
  onFinalize,
  onCancel,
}: ReviewPanelProps) {
  const resolution = resolvePlay(state, input, overrides, outDetails);
  const errors = validate(state, input, resolution);
  const preview = applyEvent(state, {
    id: "preview",
    ts: "",
    type: "play",
    batterId,
    input: input as never,
    overrides,
    outDetails,
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

  const setDetail = (key: RunnerKey, detail: OutDetail) =>
    onDetailsChange({ ...outDetails, [key]: detail });

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
        const value = destinationOf(key);
        return (
          <div key={base} className="space-y-1">
            <RunnerRow
              label={`${BASE_LABEL[base]} — ${nameOf(state.bases[base]!)}`}
              value={value}
              uncertain={resolution.uncertain.includes(key)}
              options={DESTINATIONS.filter(
                (d) =>
                  d.value === "out" || d.value === 4 || (typeof d.value === "number" && d.value > base),
              )}
              hold={{ label: `Hold ${BASE_LABEL[base]}`, value: base as Destination }}
              onSelect={(v) => setDestination(key, v)}
            />
            {value === "out" && (
              <OutDetailRow
                from={base}
                detail={outDetails[key]}
                onChange={(d) => setDetail(key, d)}
              />
            )}
          </div>
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

/** Where and how a runner was retired: base + fielding sequence (e.g. 9-6-2). */
function OutDetailRow({
  from,
  detail,
  onChange,
}: {
  from: Base;
  detail?: OutDetail;
  onChange: (detail: OutDetail) => void;
}) {
  const at = detail?.at ?? (Math.min(from + 1, 4) as 1 | 2 | 3 | 4);
  const fielders = detail?.fielders ?? [];
  const bases = ([2, 3, 4] as const).filter((b) => b > from);

  return (
    <div className="space-y-2 rounded-md border border-dashed border-border p-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Out at
        </span>
        {bases.map((b) => (
          <Button
            key={b}
            size="sm"
            variant={at === b ? "default" : "outline"}
            className="h-9 min-w-14 text-xs"
            onClick={() => onChange({ at: b, fielders })}
          >
            {BASE_LABEL[b]}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          How
        </span>
        <span className="min-w-14 font-mono text-sm font-bold">
          {fielders.length ? fielders.join("-") : "—"}
        </span>
        {FIELDERS.map((f) => (
          <Button
            key={f.n}
            size="sm"
            variant="outline"
            className="h-9 w-11 flex-col gap-0 px-0 text-[10px] leading-tight"
            onClick={() => onChange({ at, fielders: [...fielders, f.n] })}
          >
            <span className="font-mono text-xs font-bold">{f.n}</span>
            <span className="opacity-70">{f.label}</span>
          </Button>
        ))}
        <Button
          size="sm"
          variant="ghost"
          className="h-9 text-xs"
          onClick={() => onChange({ at, fielders: [] })}
        >
          Clear
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
