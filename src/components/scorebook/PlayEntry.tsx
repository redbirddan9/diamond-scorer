import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import type {
  Base,
  BatterInput,
  BattedBallType,
  OutTarget,
  RunnerInput,
} from "@/lib/scoring/types";

/**
 * Play entry records WHAT HAPPENED. It never decides how a play is scored —
 * classification, RBIs and runner movement all come from the rules layer.
 */

type Action = "abs" | "sub";

interface Node {
  key: string;
  hot: string;
  symbol: string;
  label: string;
  batter?: BatterInput;
  runner?: RunnerInput;
  action?: Action;
  /** Multi-step flow that needs more observation from the scorer. */
  flow?: Flow;
  children?: Node[];
}

type Flow =
  | { kind: "out" }
  | { kind: "error" }
  | { kind: "sac-bunt" }
  | { kind: "steal" }
  | { kind: "pickoff" }
  | { kind: "dropped-third" };

const BATTED: { key: BattedBallType; hot: string; symbol: string; label: string }[] = [
  { key: "ground", hot: "g", symbol: "GO", label: "Ground-out" },
  { key: "popup", hot: "p", symbol: "P", label: "Pop-out" },
  { key: "line", hot: "l", symbol: "L", label: "Line-out" },
  { key: "pop-foul", hot: "f", symbol: "PF", label: "Pop Foul" },
];

export const MENU: Node[] = [
  {
    key: "hit",
    hot: "h",
    symbol: "H",
    label: "Hit",
    children: [
      { key: "1b", hot: "1", symbol: "1B", label: "Single", batter: { kind: "hit", bases: 1 } },
      { key: "2b", hot: "2", symbol: "2B", label: "Double", batter: { kind: "hit", bases: 2 } },
      { key: "3b", hot: "3", symbol: "3B", label: "Triple", batter: { kind: "hit", bases: 3 } },
      { key: "hr", hot: "4", symbol: "HR", label: "Home Run", batter: { kind: "hit", bases: 4 } },
      {
        key: "grd",
        hot: "g",
        symbol: "GRD",
        label: "Ground Rule 2B",
        batter: { kind: "hit", bases: 2, groundRule: true },
      },
    ],
  },
  { key: "out", hot: "o", symbol: "O", label: "Out", flow: { kind: "out" } },
  {
    key: "k",
    hot: "k",
    symbol: "K",
    label: "Strikeout",
    children: [
      {
        key: "ks",
        hot: "s",
        symbol: "K",
        label: "Swinging",
        batter: { kind: "strikeout", swinging: true },
      },
      {
        key: "kl",
        hot: "l",
        symbol: "L",
        label: "Looking",
        batter: { kind: "strikeout", swinging: false },
      },
      {
        key: "k3",
        hot: "d",
        symbol: "K2-3",
        label: "Dropped 3rd",
        flow: { kind: "dropped-third" },
      },
    ],
  },
  { key: "bb", hot: "w", symbol: "BB", label: "Walk", batter: { kind: "walk" } },
  { key: "hbp", hot: "y", symbol: "HBP", label: "Hit By Pitch", batter: { kind: "hbp" } },
  { key: "e", hot: "e", symbol: "E", label: "Error", flow: { kind: "error" } },
  { key: "steal", hot: "t", symbol: "SB", label: "Stolen Base", flow: { kind: "steal" } },
  {
    key: "other",
    hot: "x",
    symbol: "…",
    label: "Other",
    children: [
      { key: "abs", hot: "a", symbol: "ABS", label: "ABS Challenge", action: "abs" },
      {
        key: "ibb",
        hot: "i",
        symbol: "IBB",
        label: "Intentional Walk",
        batter: { kind: "walk", intentional: true },
      },
      { key: "sh", hot: "b", symbol: "SH", label: "Sac Bunt", flow: { kind: "sac-bunt" } },
      { key: "wp", hot: "w", symbol: "WP", label: "Wild Pitch", runner: { kind: "wild-pitch" } },
      { key: "pb", hot: "p", symbol: "PB", label: "Passed Ball", runner: { kind: "passed-ball" } },
      { key: "bk", hot: "k", symbol: "BK", label: "Balk", runner: { kind: "balk" } },
      { key: "po", hot: "o", symbol: "PO", label: "Pickoff", flow: { kind: "pickoff" } },
      {
        key: "di",
        hot: "d",
        symbol: "DI",
        label: "Defensive Indifference",
        flow: { kind: "steal" },
      },
      {
        key: "ci",
        hot: "c",
        symbol: "CI",
        label: "Catcher's Interference",
        batter: { kind: "catcher-interference" },
      },
    ],
  },
  { key: "sub", hot: "u", symbol: "SUB", label: "Substitution", action: "sub" },
];

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

const BASE_LABEL: Record<Base, string> = { 1: "1st", 2: "2nd", 3: "3rd" };

interface PlayEntryProps {
  /** Runners currently on base, for steal / retired pickers. */
  bases: Record<Base, string | null>;
  nameOf: (id: string) => string;
  onPlay: (input: BatterInput) => void;
  onRunnerPlay: (input: RunnerInput) => void;
  onAction?: (action: Action) => void;
  onDepthChange?: (depth: number) => void;
}

type Stage =
  | { name: "menu" }
  | { name: "batted-type"; flow: Flow }
  | { name: "fielders"; flow: Flow; batted: BattedBallType }
  | { name: "retired"; batted: BattedBallType; fielders: number[] }
  | { name: "steal-runners"; indifference: boolean }
  | { name: "steal-outcome"; runners: Base[]; indifference: boolean }
  | { name: "pickoff-base" }
  | { name: "pickoff-outcome"; from: Base }
  | { name: "dropped-cause" }
  | { name: "dropped-outcome"; cause: "wild-pitch" | "passed-ball" | "throw" };

export function PlayEntry({
  bases,
  nameOf,
  onPlay,
  onRunnerPlay,
  onAction,
  onDepthChange,
}: PlayEntryProps) {
  const [path, setPath] = useState<Node[]>([]);
  const [stage, setStage] = useState<Stage>({ name: "menu" });
  const [fielders, setFielders] = useState<number[]>([]);
  const [retired, setRetired] = useState<OutTarget[]>(["batter"]);
  const [runners, setRunners] = useState<Base[]>([]);

  const occupied = useMemo(
    () => ([1, 2, 3] as Base[]).filter((b) => bases[b]),
    [bases],
  );

  const reset = useCallback(() => {
    setPath([]);
    setStage({ name: "menu" });
    setFielders([]);
    setRetired(["batter"]);
    setRunners([]);
  }, []);

  const commitPlay = useCallback(
    (input: BatterInput) => {
      onPlay(input);
      reset();
    },
    [onPlay, reset],
  );

  const commitRunner = useCallback(
    (input: RunnerInput) => {
      onRunnerPlay(input);
      reset();
    },
    [onRunnerPlay, reset],
  );

  const startFlow = useCallback(
    (flow: Flow, node?: Node) => {
      switch (flow.kind) {
        case "out":
        case "error":
          setStage({ name: "batted-type", flow });
          break;
        case "sac-bunt":
          setFielders([]);
          setStage({ name: "fielders", flow, batted: "bunt" });
          break;
        case "steal": {
          const indifference = node?.key === "di";
          if (occupied.length === 1) {
            setStage({ name: "steal-outcome", runners: [occupied[0]], indifference });
          } else {
            setRunners([]);
            setStage({ name: "steal-runners", indifference });
          }
          break;
        }
        case "pickoff":
          setStage({ name: "pickoff-base" });
          break;
        case "dropped-third":
          setStage({ name: "dropped-cause" });
          break;
      }
    },
    [occupied],
  );

  const choose = useCallback(
    (node: Node) => {
      if (node.children?.length) {
        setPath((p) => [...p, node]);
        return;
      }
      if (node.action) {
        onAction?.(node.action);
        reset();
        return;
      }
      if (node.flow) {
        startFlow(node.flow, node);
        return;
      }
      if (node.batter) commitPlay(node.batter);
      else if (node.runner) commitRunner(node.runner);
    },
    [commitPlay, commitRunner, onAction, reset, startFlow],
  );

  const back = useCallback(() => {
    if (stage.name !== "menu") {
      setStage({ name: "menu" });
      setFielders([]);
      setRetired(["batter"]);
      return;
    }
    setPath((p) => p.slice(0, -1));
  }, [stage]);

  const current = path[path.length - 1];
  const nodes = current ? current.children! : MENU;
  const depth = stage.name === "menu" ? path.length : path.length + 1;

  useEffect(() => {
    onDepthChange?.(depth);
  }, [depth, onDepthChange]);

  const finishFielders = useCallback(
    (flow: Flow, batted: BattedBallType, picked: number[]) => {
      if (flow.kind === "error") {
        commitPlay({ kind: "batted", batted, fielders: picked, retired: [], errorFielders: picked });
        return;
      }
      if (flow.kind === "sac-bunt") {
        commitPlay({ kind: "sac-bunt", fielders: picked, retired: ["batter"] });
        return;
      }
      // Out: the scorer only picks who was retired when runners are aboard.
      if (occupied.length === 0) {
        commitPlay({ kind: "batted", batted, fielders: picked, retired: ["batter"] });
        return;
      }
      setRetired(["batter"]);
      setStage({ name: "retired", batted, fielders: picked });
    },
    [commitPlay, occupied.length],
  );

  const pickFielder = useCallback(
    (n: number) => {
      if (stage.name !== "fielders") return;
      const single = stage.flow.kind === "out" && stage.batted !== "ground";
      const next = [...fielders, n];
      if (single) {
        finishFielders(stage.flow, stage.batted, [n]);
        setFielders([]);
        return;
      }
      setFielders(next);
    },
    [fielders, finishFielders, stage],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && /input|textarea|select/i.test(target.tagName)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();

      if (stage.name === "fielders") {
        if (/^[1-9]$/.test(k)) pickFielder(Number(k));
        else if (e.key === "Enter" && fielders.length) finishFielders(stage.flow, stage.batted, fielders);
        else if (e.key === "Backspace") setFielders((f) => f.slice(0, -1));
        else if (e.key === "Escape") back();
        else return;
        e.preventDefault();
        return;
      }

      if (stage.name === "batted-type") {
        const b = BATTED.find((x) => x.hot === k);
        if (b) {
          setFielders([]);
          setStage({ name: "fielders", flow: stage.flow, batted: b.key });
          e.preventDefault();
        } else if (e.key === "Escape") {
          back();
          e.preventDefault();
        }
        return;
      }

      if (stage.name !== "menu") {
        if (e.key === "Escape") {
          back();
          e.preventDefault();
        }
        return;
      }

      if (e.key === "Escape" && path.length) {
        back();
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

  /* ----------------------------- stages ----------------------------- */

  if (stage.name === "batted-type") {
    return (
      <div className="space-y-2">
        <Header
          title={stage.flow.kind === "error" ? "Error — batted ball" : "Out — batted ball"}
          onBack={back}
        />
        <div className="grid grid-cols-4 gap-2">
          {BATTED.map((b) => (
            <Button
              key={b.key}
              variant="secondary"
              className="relative h-12 flex-col gap-0"
              onClick={() => {
                setFielders([]);
                setStage({ name: "fielders", flow: stage.flow, batted: b.key });
              }}
            >
              <span className="font-mono text-base font-bold leading-none">{b.symbol}</span>
              <span className="text-[10px] font-normal opacity-80">{b.label}</span>
              <Hint k={b.hot.toUpperCase()} corner />
            </Button>
          ))}
        </div>
      </div>
    );
  }

  if (stage.name === "fielders") {
    const single = stage.flow.kind === "out" && stage.batted !== "ground";
    return (
      <div className="space-y-2">
        <Header
          title={`${stage.flow.kind === "error" ? "Error" : stage.flow.kind === "sac-bunt" ? "Sac bunt" : "Out"} — ${single ? "position" : "position numbers"}`}
          onBack={back}
        />
        <div className="grid grid-cols-5 gap-1.5">
          {POSITIONS.map((p) => (
            <Button
              key={p.n}
              variant="outline"
              className="h-11 flex-col gap-0"
              onClick={() => pickFielder(p.n)}
            >
              <span className="font-mono text-lg font-bold leading-none">{p.n}</span>
              <span className="text-[10px] text-muted-foreground">{p.label}</span>
            </Button>
          ))}
        </div>
        {!single && (
          <div className="flex items-center gap-2">
            <div className="flex h-11 flex-1 items-center rounded-md border border-border px-3 font-mono text-lg">
              {fielders.join("-") || "—"}
            </div>
            <Button variant="ghost" className="h-11" onClick={() => setFielders([])}>
              Clear
            </Button>
            <Button
              className="h-11 px-6"
              disabled={!fielders.length}
              onClick={() => finishFielders(stage.flow, stage.batted, fielders)}
            >
              Apply <Hint k="↵" />
            </Button>
          </div>
        )}
        {stage.flow.kind === "error" && fielders.length > 1 && (
          <p className="text-xs text-muted-foreground">
            {fielders.length} errors will be charged on this play.
          </p>
        )}
      </div>
    );
  }

  if (stage.name === "retired") {
    const toggle = (t: OutTarget) =>
      setRetired((r) => (r.includes(t) ? r.filter((x) => x !== t) : [...r, t]));
    return (
      <div className="space-y-2">
        <Header title={`${fielders.join("-")} — who was retired?`} onBack={back} />
        <div className="grid grid-cols-4 gap-2">
          <Button
            variant={retired.includes("batter") ? "default" : "outline"}
            className="h-12 flex-col gap-0"
            onClick={() => toggle("batter")}
          >
            <span className="text-sm font-bold">Batter</span>
          </Button>
          {occupied.map((b) => (
            <Button
              key={b}
              variant={retired.includes(b) ? "default" : "outline"}
              className="h-12 flex-col gap-0"
              onClick={() => toggle(b)}
            >
              <span className="text-sm font-bold">{BASE_LABEL[b]}</span>
              <span className="max-w-full truncate text-[10px] opacity-80">
                {nameOf(bases[b]!)}
              </span>
            </Button>
          ))}
        </div>
        <Button
          className="h-12 w-full text-base"
          onClick={() =>
            commitPlay({
              kind: "batted",
              batted: stage.batted,
              fielders: stage.fielders,
              retired,
            })
          }
        >
          Record Play
        </Button>
      </div>
    );
  }

  if (stage.name === "steal-runners") {
    const toggle = (b: Base) =>
      setRunners((r) => (r.includes(b) ? r.filter((x) => x !== b) : [...r, b]));
    return (
      <div className="space-y-2">
        <Header title="Which runner(s) went?" onBack={back} />
        <div className="grid grid-cols-3 gap-2">
          {occupied.map((b) => (
            <Button
              key={b}
              variant={runners.includes(b) ? "default" : "outline"}
              className="h-12 flex-col gap-0"
              onClick={() => toggle(b)}
            >
              <span className="text-sm font-bold">{BASE_LABEL[b]}</span>
              <span className="max-w-full truncate text-[10px] opacity-80">{nameOf(bases[b]!)}</span>
            </Button>
          ))}
        </div>
        <Button
          className="h-12 w-full"
          disabled={!runners.length}
          onClick={() =>
            setStage({ name: "steal-outcome", runners, indifference: stage.indifference })
          }
        >
          Continue
        </Button>
      </div>
    );
  }

  if (stage.name === "steal-outcome") {
    const send = (safe: boolean) => {
      if (stage.indifference && safe) {
        commitRunner({ kind: "defensive-indifference", from: stage.runners[0] });
        return;
      }
      commitRunner({
        kind: "steal",
        attempts: stage.runners.map((from) => ({ from, safe })),
      });
    };
    return (
      <div className="space-y-2">
        <Header title="Stolen base attempt" onBack={back} />
        <div className="grid grid-cols-2 gap-2">
          <Button className="h-14 text-base" onClick={() => send(true)}>
            Safe (SB)
          </Button>
          <Button variant="secondary" className="h-14 text-base" onClick={() => send(false)}>
            Caught (CS)
          </Button>
        </div>
      </div>
    );
  }

  if (stage.name === "pickoff-base") {
    return (
      <div className="space-y-2">
        <Header title="Pickoff — which runner?" onBack={back} />
        <div className="grid grid-cols-3 gap-2">
          {occupied.map((b) => (
            <Button
              key={b}
              variant="outline"
              className="h-12 flex-col gap-0"
              onClick={() => setStage({ name: "pickoff-outcome", from: b })}
            >
              <span className="text-sm font-bold">{BASE_LABEL[b]}</span>
              <span className="max-w-full truncate text-[10px] opacity-80">{nameOf(bases[b]!)}</span>
            </Button>
          ))}
        </div>
      </div>
    );
  }

  if (stage.name === "pickoff-outcome") {
    return (
      <div className="space-y-2">
        <Header title="Pickoff" onBack={back} />
        <div className="grid grid-cols-2 gap-2">
          <Button
            className="h-14 text-base"
            onClick={() => commitRunner({ kind: "pickoff", from: stage.from, out: true, fielders: [1, 3] })}
          >
            Runner Out
          </Button>
          <Button
            variant="secondary"
            className="h-14 text-base"
            onClick={() =>
              commitRunner({ kind: "pickoff", from: stage.from, out: false, errorFielders: [1] })
            }
          >
            Pickoff Error
          </Button>
        </div>
      </div>
    );
  }

  if (stage.name === "dropped-cause") {
    const causes: { key: "wild-pitch" | "passed-ball" | "throw"; label: string }[] = [
      { key: "wild-pitch", label: "Wild Pitch" },
      { key: "passed-ball", label: "Passed Ball" },
      { key: "throw", label: "Throw to 1st" },
    ];
    return (
      <div className="space-y-2">
        <Header title="Dropped third strike" onBack={back} />
        <div className="grid grid-cols-3 gap-2">
          {causes.map((c) => (
            <Button
              key={c.key}
              variant="secondary"
              className="h-12"
              onClick={() => setStage({ name: "dropped-outcome", cause: c.key })}
            >
              {c.label}
            </Button>
          ))}
        </div>
      </div>
    );
  }

  if (stage.name === "dropped-outcome") {
    return (
      <div className="space-y-2">
        <Header title="Dropped third strike" onBack={back} />
        <div className="grid grid-cols-2 gap-2">
          <Button
            className="h-14 text-base"
            onClick={() =>
              commitPlay({
                kind: "dropped-third",
                swinging: true,
                cause: stage.cause,
                batterSafe: true,
                fielders: stage.cause === "throw" ? [2, 3] : [],
              })
            }
          >
            Batter Safe
          </Button>
          <Button
            variant="secondary"
            className="h-14 text-base"
            onClick={() =>
              commitPlay({
                kind: "dropped-third",
                swinging: true,
                cause: stage.cause,
                batterSafe: false,
                fielders: [2, 3],
              })
            }
          >
            Batter Out
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {current && <Header title={current.label} onBack={back} />}
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
