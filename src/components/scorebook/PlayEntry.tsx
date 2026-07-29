import { useEffect, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RESULT_LABELS } from "@/lib/scoring/notation";
import type { PlayResult } from "@/lib/scoring/types";

interface Node {
  key: string;
  /** Keyboard shortcut for this key. */
  hot: string;
  /** Scorebook symbol shown on the key. */
  symbol: string;
  label: string;
  result?: PlayResult;
  /** Non-play action handled by the parent screen. */
  action?: "abs" | "sub";
  children?: Node[];
}

/** Hierarchical menu — never more than three taps to any play. */
export const MENU: Node[] = [
  {
    key: "hit",
    hot: "h",
    symbol: "H",
    label: "Hit",
    children: [
      { key: "1b", hot: "1", symbol: "1B", label: "Single", result: "1B" },
      { key: "2b", hot: "2", symbol: "2B", label: "Double", result: "2B" },
      { key: "3b", hot: "3", symbol: "3B", label: "Triple", result: "3B" },
      { key: "hr", hot: "4", symbol: "HR", label: "Home Run", result: "HR" },
      { key: "grd", hot: "g", symbol: "GRD", label: "Ground Rule 2B", result: "GRD" },
    ],
  },
  {
    key: "out",
    hot: "o",
    symbol: "O",
    label: "Out",
    children: [
      { key: "go", hot: "g", symbol: "GO", label: "Ground Out", result: "GO" },
      { key: "lo", hot: "l", symbol: "L", label: "Line Out", result: "LO" },
      { key: "po", hot: "p", symbol: "P", label: "Pop Out", result: "PO" },
      { key: "pf", hot: "f", symbol: "PF", label: "Pop Foul Out", result: "PF" },
      { key: "dp", hot: "d", symbol: "DP", label: "Double Play", result: "DP" },
      { key: "tp", hot: "t", symbol: "TP", label: "Triple Play", result: "TP" },
    ],
  },
  {
    key: "k",
    hot: "k",
    symbol: "K",
    label: "Strikeout",
    children: [
      { key: "ks", hot: "s", symbol: "K", label: "Swinging", result: "K_SWING" },
      { key: "kl", hot: "l", symbol: "L", label: "Looking", result: "K_LOOK" },
    ],
  },
  { key: "bb", hot: "w", symbol: "BB", label: "Walk", result: "BB" },
  { key: "hbp", hot: "y", symbol: "HBP", label: "Hit By Pitch", result: "HBP" },
  { key: "e", hot: "e", symbol: "E", label: "Error", result: "E" },
  {
    key: "sac",
    hot: "s",
    symbol: "SAC",
    label: "Sacrifice",
    children: [
      { key: "sf", hot: "f", symbol: "SF", label: "Sac Fly (RBI)", result: "SF" },
      { key: "sh", hot: "b", symbol: "SH", label: "Sac Bunt", result: "SH" },
    ],
  },
  {
    key: "other",
    hot: "x",
    symbol: "…",
    label: "Other",
    children: [
      { key: "abs", hot: "a", symbol: "ABS", label: "ABS Challenge", action: "abs" },
      { key: "ibb", hot: "i", symbol: "IBB", label: "Intentional Walk", result: "IBB" },
      { key: "ci", hot: "c", symbol: "CI", label: "Catcher's Interference", result: "CI" },
      { key: "obs", hot: "b", symbol: "OB", label: "Obstruction", result: "OBSTRUCTION" },
      { key: "int", hot: "n", symbol: "INT", label: "Interference", result: "INTERFERENCE" },
    ],
  },
  { key: "sub", hot: "u", symbol: "SUB", label: "Substitution", action: "sub" },
];

const NEEDS_FIELDERS: PlayResult[] = [
  "GO",
  "PF",
  "LO",
  "PO",
  "DP",
  "TP",
  "E",
  "SF",
  "SH",
];

/** Air outs are always recorded by exactly one fielder. */
const SINGLE_FIELDER: PlayResult[] = ["LO", "PO", "PF", "SF"];

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
  onAction?: (action: "abs" | "sub") => void;
  /** Reports menu depth so the parent can pause its own hotkeys. */
  onDepthChange?: (depth: number) => void;
}

export function PlayEntry({ onSelect, onAction, onDepthChange }: PlayEntryProps) {
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
    if (node.action) {
      onAction?.(node.action);
      reset();
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

  const current = path[path.length - 1];
  const nodes = current ? current.children! : MENU;
  const depth = pending ? path.length + 1 : path.length;
  const singleFielder = pending ? SINGLE_FIELDER.includes(pending) : false;

  const pick = (result: PlayResult, n: number) => {
    if (SINGLE_FIELDER.includes(result)) {
      onSelect(result, [n]);
      reset();
      return;
    }
    setFielders((f) => [...f, n]);
  };

  useEffect(() => {
    onDepthChange?.(depth);
  }, [depth, onDepthChange]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && /input|textarea|select/i.test(target.tagName)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();

      if (pending) {
        if (/^[1-9]$/.test(k)) {
          pick(pending, Number(k));
        } else if (e.key === "Enter") {
          onSelect(pending, fielders);
          reset();
        } else if (e.key === "Backspace") {
          setFielders((f) => f.slice(0, -1));
        } else if (e.key === "Escape") {
          setPending(null);
          setFielders([]);
        } else {
          return;
        }
        e.preventDefault();
        return;
      }

      if (e.key === "Escape" && path.length) {
        setPath((p) => p.slice(0, -1));
        e.preventDefault();
        return;
      }
      const hit = nodes.find((n) => n.hot === k);
      if (hit) {
        e.preventDefault();
        choose(hit);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (pending) {
    return (
      <div className="space-y-2">
        <Header
          title={`${RESULT_LABELS[pending]} — ${singleFielder ? "position" : "position numbers"}`}
          onBack={() => {
            setPending(null);
            setFielders([]);
          }}
        />
        <div className="grid grid-cols-5 gap-1.5">
          {POSITIONS.map((p) => (
            <Button
              key={p.n}
              variant="outline"
              className="h-11 flex-col gap-0"
              onClick={() => pick(pending, p.n)}
            >
              <span className="font-mono text-lg font-bold leading-none">{p.n}</span>
              <span className="text-[10px] text-muted-foreground">{p.label}</span>
            </Button>
          ))}
        </div>
        {!singleFielder && (
        <div className="flex items-center gap-2">
          <div className="flex h-11 flex-1 items-center rounded-md border border-border px-3 font-mono text-lg">
            {fielders.join("-") || "—"}
          </div>
          <Button variant="ghost" className="h-11" onClick={() => setFielders([])}>
            Clear
          </Button>
          <Button
            className="h-11 px-6"
            onClick={() => {
              onSelect(pending, fielders);
              reset();
            }}
          >
            Apply <Hint k="↵" />
          </Button>
        </div>
        )}
        {pending === "E" && fielders.length > 1 && (
          <p className="text-xs text-muted-foreground">
            {fielders.length} errors will be charged on this play.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {current && <Header title={current.label} onBack={() => setPath((p) => p.slice(0, -1))} />}
      <div className="grid grid-cols-3 gap-2">
        {nodes.map((node) => (
          <Button
            key={node.key}
            variant={current ? "secondary" : "default"}
            className="relative h-12 flex-col gap-0"
            onClick={() => choose(node)}
          >
            <span className="font-mono text-base font-bold leading-none">{node.symbol}</span>
            <span className="text-[10px] font-normal opacity-80">{node.label}</span>
            <Hint k={node.hot.toUpperCase()} corner />
          </Button>
        ))}
      </div>
    </div>
  );
}

function Hint({ k, corner }: { k: string; corner?: boolean }) {
  return (
    <span
      className={
        corner
          ? "absolute right-1 top-1 rounded border border-current/30 px-1 text-[9px] leading-tight opacity-60"
          : "ml-1.5 text-xs opacity-70"
      }
    >
      {k}
    </span>
  );
}

function Header({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="flex items-center gap-2">
      <Button variant="ghost" size="icon" className="h-9 w-9" onClick={onBack} aria-label="Back">
        <ChevronLeft className="h-5 w-5" />
      </Button>
      <h3 className="text-sm font-semibold uppercase tracking-wide">{title}</h3>
      <span className="ml-auto text-[10px] uppercase text-muted-foreground">Esc = back</span>
    </div>
  );
}
