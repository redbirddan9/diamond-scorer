import { useState } from "react";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { RESULT_LABELS } from "@/lib/scoring/notation";
import type { PlayResult } from "@/lib/scoring/types";

interface Category {
  key: string;
  label: string;
  options: { result: PlayResult; label: string }[];
}

/** Hierarchical menu — never more than three taps to any play. */
export const CATEGORIES: Category[] = [
  {
    key: "hit",
    label: "Hit",
    options: [
      { result: "1B", label: "Single" },
      { result: "2B", label: "Double" },
      { result: "3B", label: "Triple" },
      { result: "HR", label: "Home Run" },
    ],
  },
  {
    key: "k",
    label: "Strikeout",
    options: [
      { result: "K_SWING", label: "Swinging" },
      { result: "K_LOOK", label: "Looking" },
    ],
  },
  {
    key: "bb",
    label: "Walk",
    options: [
      { result: "BB", label: "Walk" },
      { result: "IBB", label: "Intentional" },
    ],
  },
  { key: "hbp", label: "Hit By Pitch", options: [{ result: "HBP", label: "Hit By Pitch" }] },
  { key: "e", label: "Reached on Error", options: [{ result: "E", label: "Reached on Error" }] },
  { key: "fc", label: "Fielder's Choice", options: [{ result: "FC", label: "Fielder's Choice" }] },
  {
    key: "sac",
    label: "Sacrifice",
    options: [
      { result: "SF", label: "Sac Fly" },
      { result: "SH", label: "Sac Bunt" },
    ],
  },
  {
    key: "out",
    label: "Out",
    options: [
      { result: "GO", label: "Ground Out" },
      { result: "FO", label: "Fly Out" },
      { result: "LO", label: "Line Out" },
      { result: "PO", label: "Pop Out" },
      { result: "DP", label: "Double Play" },
      { result: "TP", label: "Triple Play" },
    ],
  },
  {
    key: "misc",
    label: "Miscellaneous",
    options: [
      { result: "CI", label: "Catcher's Interference" },
      { result: "OBSTRUCTION", label: "Obstruction" },
      { result: "INTERFERENCE", label: "Fan Interference" },
      { result: "APPEAL", label: "Appeal Play" },
      { result: "OTHER", label: "Other" },
    ],
  },
];

const NEEDS_FIELDERS: PlayResult[] = ["GO", "FO", "LO", "PO", "DP", "TP", "E", "FC", "SF", "SH"];

const COMMON_COMBOS: Partial<Record<PlayResult, string[]>> = {
  GO: ["6-3", "4-3", "5-3", "1-3", "3-1", "5-4-3", "6-4-3"],
  DP: ["6-4-3", "4-6-3", "5-4-3", "1-6-3", "3-6-1"],
  FO: ["8", "9", "7"],
  LO: ["6", "4", "5", "3"],
  PO: ["3", "4", "2", "5"],
  SF: ["8", "9", "7"],
  SH: ["1-3", "5-3", "3-1"],
  FC: ["6-4", "4-6", "5-4", "2-5"],
  E: ["6", "5", "4", "3", "8", "9", "7"],
};

const POSITIONS = [
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

const RECENTS_KEY = "scorebook.recents";

export function loadRecents(): PlayResult[] {
  if (typeof localStorage === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(RECENTS_KEY) ?? "[]") as PlayResult[];
  } catch {
    return [];
  }
}

export function pushRecent(result: PlayResult) {
  const next = [result, ...loadRecents().filter((r) => r !== result)].slice(0, 4);
  localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
}

interface PlayEntryProps {
  onSelect: (result: PlayResult, fielders: number[]) => void;
}

export function PlayEntry({ onSelect }: PlayEntryProps) {
  const [category, setCategory] = useState<Category | null>(null);
  const [pending, setPending] = useState<PlayResult | null>(null);
  const [fielders, setFielders] = useState<number[]>([]);
  const recents = loadRecents();

  const choose = (result: PlayResult) => {
    if (NEEDS_FIELDERS.includes(result)) {
      setPending(result);
      setFielders([]);
      return;
    }
    pushRecent(result);
    onSelect(result, []);
    setCategory(null);
  };

  const finishFielders = (list: number[]) => {
    if (!pending) return;
    pushRecent(pending);
    onSelect(pending, list);
    setPending(null);
    setCategory(null);
    setFielders([]);
  };

  if (pending) {
    const combos = COMMON_COMBOS[pending] ?? [];
    return (
      <div className="space-y-3">
        <Header
          title={`${RESULT_LABELS[pending]} — fielders`}
          onBack={() => {
            setPending(null);
            setFielders([]);
          }}
        />
        {combos.length > 0 && (
          <div className="grid grid-cols-4 gap-2">
            {combos.map((combo) => (
              <Button
                key={combo}
                variant="secondary"
                className="h-14 font-mono text-lg"
                onClick={() => finishFielders(combo.split("-").map(Number))}
              >
                {combo}
              </Button>
            ))}
          </div>
        )}
        <div className="grid grid-cols-3 gap-2">
          {POSITIONS.map((p) => (
            <Button
              key={p.n}
              variant="outline"
              className="h-14 flex-col gap-0 text-base"
              onClick={() => setFielders((f) => [...f, p.n])}
            >
              <span className="font-mono text-lg font-bold">{p.n}</span>
              <span className="text-[10px] text-muted-foreground">{p.label}</span>
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex h-12 flex-1 items-center rounded-md border border-border px-3 font-mono text-lg">
            {fielders.join("-") || "—"}
          </div>
          <Button variant="ghost" className="h-12" onClick={() => setFielders([])}>
            Clear
          </Button>
          <Button className="h-12 px-6" onClick={() => finishFielders(fielders)}>
            Apply
          </Button>
        </div>
      </div>
    );
  }

  if (category) {
    return (
      <div className="space-y-3">
        <Header title={category.label} onBack={() => setCategory(null)} />
        <div className="grid grid-cols-2 gap-2">
          {category.options.map((opt) => (
            <Button
              key={opt.result}
              variant="secondary"
              className="h-16 text-base"
              onClick={() => choose(opt.result)}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {recents.length > 0 && (
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Recent
          </p>
          <div className="grid grid-cols-4 gap-2">
            {recents.map((r) => (
              <Button key={r} variant="outline" className="h-12 text-xs" onClick={() => choose(r)}>
                {RESULT_LABELS[r]}
              </Button>
            ))}
          </div>
        </div>
      )}
      <div className="grid grid-cols-3 gap-2">
        {CATEGORIES.map((c) => (
          <Button
            key={c.key}
            className={cn("h-16 text-sm leading-tight", c.key === "misc" && "col-span-3 h-12")}
            variant={c.key === "misc" ? "ghost" : "default"}
            onClick={() => (c.options.length === 1 ? choose(c.options[0].result) : setCategory(c))}
          >
            {c.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

function Header({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="flex items-center gap-2">
      <Button variant="ghost" size="icon" className="h-10 w-10" onClick={onBack} aria-label="Back">
        <ChevronLeft className="h-5 w-5" />
      </Button>
      <h3 className="text-sm font-semibold uppercase tracking-wide">{title}</h3>
    </div>
  );
}