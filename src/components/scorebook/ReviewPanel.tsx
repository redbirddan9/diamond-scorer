import { Button } from "@/components/ui/button";
import { Diamond } from "./Diamond";
import { applyEvent, runsOnPlay } from "@/lib/scoring/engine";
import type { PlayDraft } from "@/lib/scoring/engine";
import { RESULT_LABELS, notationFor } from "@/lib/scoring/notation";
import type { Advance, Base, Destination, GameState } from "@/lib/scoring/types";
import { cn } from "@/lib/utils";

interface ReviewPanelProps {
  state: GameState;
  draft: PlayDraft;
  nameOf: (id: string) => string;
  onChange: (draft: PlayDraft) => void;
  onFinalize: () => void;
  onCancel: () => void;
}

const DESTINATIONS: { label: string; value: Destination | "hold" }[] = [
  { label: "Hold", value: "hold" },
  { label: "1st", value: 1 },
  { label: "2nd", value: 2 },
  { label: "3rd", value: 3 },
  { label: "Score", value: 4 },
  { label: "Out", value: "out" },
];

/** Finalize-play review: shows the inferred outcome and allows any override. */
export function ReviewPanel({
  state,
  draft,
  nameOf,
  onChange,
  onFinalize,
  onCancel,
}: ReviewPanelProps) {
  const preview = applyEvent(state, { ...draft, id: "preview", ts: "" });
  const runs = runsOnPlay(draft);
  const outs =
    draft.advances.filter((a) => a.to === "out").length + (draft.batterTo === "out" ? 1 : 0);
  const occupiedBases = ([1, 2, 3] as Base[]).filter((b) => state.bases[b]);

  const setRunner = (base: Base, value: Destination | "hold") => {
    const runnerId = state.bases[base]!;
    const rest = draft.advances.filter((a) => a.from !== base);
    const next: Advance[] =
      value === "hold"
        ? rest
        : [...rest, { runnerId, from: base, to: value, reason: draft.advances.find((a) => a.from === base)?.reason ?? "other" }];
    const scoring = next.filter((a) => a.to === 4).length + (draft.batterTo === 4 ? 1 : 0);
    onChange({ ...draft, advances: next, rbi: Math.min(draft.rbi, scoring) });
  };

  const setBatter = (value: Destination) => {
    const scoring = draft.advances.filter((a) => a.to === 4).length + (value === 4 ? 1 : 0);
    onChange({ ...draft, batterTo: value, rbi: Math.min(draft.rbi, scoring) });
  };

  const runnerValue = (base: Base): Destination | "hold" =>
    draft.advances.find((a) => a.from === base)?.to ?? "hold";

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-4">
        <Diamond
          first={Boolean(preview.bases[1])}
          second={Boolean(preview.bases[2])}
          third={Boolean(preview.bases[3])}
          size={104}
        />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="font-mono text-2xl font-bold">{notationFor(draft)}</p>
          <p className="truncate text-sm text-muted-foreground">
            {nameOf(draft.batterId)} — {RESULT_LABELS[draft.result]}
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-sm">
            <span>Runs {runs}</span>
            <span>Outs {Math.min(state.outs + outs, 3)}</span>
            <span>RBI {draft.rbi}</span>
            <span>
              {state.setup.away.name} {preview.score.away} – {preview.score.home}{" "}
              {state.setup.home.name}
            </span>
          </div>
        </div>
      </div>

      <RunnerRow
        label={`Batter — ${nameOf(draft.batterId)}`}
        value={draft.batterTo}
        onSelect={(v) => setBatter(v === "hold" ? "out" : v)}
        options={DESTINATIONS.filter((d) => d.value !== "hold")}
      />

      {occupiedBases.map((base) => (
        <RunnerRow
          key={base}
          label={`${base === 1 ? "1st" : base === 2 ? "2nd" : "3rd"} — ${nameOf(state.bases[base]!)}`}
          value={runnerValue(base)}
          onSelect={(v) => setRunner(base, v)}
          options={DESTINATIONS.filter((d) => d.value === "hold" || d.value === "out" || d.value === 4 || (typeof d.value === "number" && d.value > base))}
        />
      ))}

      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">RBI</span>
        <div className="flex gap-2">
          {[0, 1, 2, 3, 4].map((n) => (
            <Button
              key={n}
              size="sm"
              variant={draft.rbi === n ? "default" : "outline"}
              className="h-10 w-10"
              onClick={() => onChange({ ...draft, rbi: n })}
            >
              {n}
            </Button>
          ))}
        </div>
        <Button
          size="sm"
          variant={draft.earnedRuns === false ? "default" : "outline"}
          className="ml-auto h-10"
          onClick={() => onChange({ ...draft, earnedRuns: draft.earnedRuns === false })}
        >
          Unearned
        </Button>
      </div>

      <div className="flex gap-2">
        <Button variant="ghost" className="h-14" onClick={onCancel}>
          Cancel
        </Button>
        <Button className="h-14 flex-1 text-base font-semibold" onClick={onFinalize}>
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
  onSelect,
}: {
  label: string;
  value: Destination | "hold";
  options: { label: string; value: Destination | "hold" }[];
  onSelect: (value: Destination | "hold") => void;
}) {
  return (
    <div className="rounded-md border border-border p-2">
      <p className="mb-2 truncate text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => (
          <Button
            key={String(opt.value)}
            size="sm"
            variant={value === opt.value ? "default" : "outline"}
            className={cn("h-10 min-w-14 text-xs")}
            onClick={() => onSelect(opt.value)}
          >
            {opt.label}
          </Button>
        ))}
      </div>
    </div>
  );
}