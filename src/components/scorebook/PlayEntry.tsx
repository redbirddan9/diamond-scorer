import { useState } from "react";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RESULT_LABELS } from "@/lib/scoring/notation";
import type { PlayResult } from "@/lib/scoring/types";

interface Node {
  key: string;
  /** Scorebook symbol shown on the key. */
  symbol: string;
  label: string;
  result?: PlayResult;
  children?: Node[];
}

/** Hierarchical menu — never more than three taps to any play. */
export const MENU: Node[] = [
  {
    key: "inplay",
    symbol: "IP",
    label: "In Play",
    children: [
      {
        key: "hit",
        symbol: "H",
        label: "Hit",
        children: [
          { key: "1b", symbol: "1B", label: "Single", result: "1B" },
          { key: "2b", symbol: "2B", label: "Double", result: "2B" },
          { key: "3b", symbol: "3B", label: "Triple", result: "3B" },
          { key: "hr", symbol: "HR", label: "Home Run", result: "HR" },
        ],
      },
      {
        key: "out",
        symbol: "O",
        label: "Out",
        children: [
          { key: "go", symbol: "GO", label: "Ground Out", result: "GO" },
          { key: "fo", symbol: "F", label: "Fly Out", result: "FO" },
          { key: "lo", symbol: "L", label: "Line Out", result: "LO" },
          { key: "po", symbol: "P", label: "Pop Out", result: "PO" },
          { key: "dp", symbol: "DP", label: "Double Play", result: "DP" },
          { key: "tp", symbol: "TP", label: "Triple Play", result: "TP" },
        ],
      },
      { key: "fc", symbol: "FC", label: "Fielder's Choice", result: "FC" },
      {
        key: "sac",
        symbol: "SAC",
        label: "Sacrifice",
        children: [
          { key: "sf", symbol: "SF", label: "Sac Fly (RBI)", result: "SF" },
          { key: "sh", symbol: "SH", label: "Sac Bunt", result: "SH" },
        ],
      },
    ],
  },
  {
    key: "k",
    symbol: "K",
    label: "Strikeout",
    children: [
      { key: "ks", symbol: "K", label: "Swinging", result: "K_SWING" },
      { key: "kl", symbol: "ꓘ", label: "Looking", result: "K_LOOK" },
    ],
  },
  { key: "bb", symbol: "BB", label: "Walk", result: "BB" },
  { key: "hbp", symbol: "HBP", label: "Hit By Pitch", result: "HBP" },
  { key: "e", symbol: "E", label: "Reached on Error", result: "E" },
  {
    key: "other",
    symbol: "…",
    label: "Other",
    children: [
      { key: "ibb", symbol: "IBB", label: "Intentional Walk", result: "IBB" },
      { key: "ci", symbol: "CI", label: "Catcher's Interference", result: "CI" },
      { key: "obs", symbol: "OB", label: "Obstruction", result: "OBSTRUCTION" },
      { key: "int", symbol: "INT", label: "Fan Interference", result: "INTERFERENCE" },
      { key: "app", symbol: "AP", label: "Appeal Play", result: "APPEAL" },
      { key: "oth", symbol: "?", label: "Other", result: "OTHER" },
    ],
  },
];

const NEEDS_FIELDERS: PlayResult[] = ["GO", "FO", "LO", "PO", "DP", "TP", "E", "FC", "SF", "SH"];

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

interface PlayEntryProps {
  onSelect: (result: PlayResult, fielders: number[]) => void;
}

export function PlayEntry({ onSelect }: PlayEntryProps) {
  const [path, setPath] = useState<Node[]>([]);
  const [pending, setPending] = useState<PlayResult | null>(null);
  const [fielders, setFielders] = useState<number[]>([]);

  const reset = () => {
    setPath([]);
    setPending(null);
    setFielders([]);
  };

  const choose = (node: Node) => {
    if (node.children?.length) {
      setPath((p) => [...p, node]);
      return;
    }
    const result = node.result!;
    if (NEEDS_FIELDERS.includes(result)) {
      setPending(result);
      setFielders([]);
      return;
    }
    onSelect(result, []);
    reset();
  };

  if (pending) {
    return (
      <div className="space-y-3">
        <Header
          title={`${RESULT_LABELS[pending]} — position numbers`}
          onBack={() => {
            setPending(null);
            setFielders([]);
          }}
        />
        <div className="grid grid-cols-3 gap-2">
          {POSITIONS.map((p) => (
            <Button
              key={p.n}
              variant="outline"
              className="h-16 flex-col gap-0 text-base"
              onClick={() => setFielders((f) => [...f, p.n])}
            >
              <span className="font-mono text-xl font-bold">{p.n}</span>
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
          <Button
            className="h-12 px-6"
            onClick={() => {
              onSelect(pending, fielders);
              reset();
            }}
          >
            Apply
          </Button>
        </div>
      </div>
    );
  }

  const current = path[path.length - 1];
  const nodes = current ? current.children! : MENU;

  return (
    <div className="space-y-3">
      {current && <Header title={current.label} onBack={() => setPath((p) => p.slice(0, -1))} />}
      <div className="grid grid-cols-3 gap-2">
        {nodes.map((node) => (
          <Button
            key={node.key}
            variant={current ? "secondary" : "default"}
            className="h-16 flex-col gap-0.5"
            onClick={() => choose(node)}
          >
            <span className="font-mono text-xl font-bold leading-none">{node.symbol}</span>
            <span className="text-[10px] font-normal opacity-80">{node.label}</span>
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
