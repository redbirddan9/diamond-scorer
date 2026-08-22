import { Button } from "@/components/ui/button";

/** Fielding positions laid out as a 3x3 grid (no pitcher). */
export const POSITION_GRID = [
  ["DH", "C", "1B"],
  ["2B", "SS", "3B"],
  ["LF", "CF", "RF"],
];

/** Scoring key for each position: the number you'd write on a scorecard. */
export const POSITION_KEYS: Record<string, string> = {
  P: "1",
  C: "2",
  "1B": "3",
  "2B": "4",
  "3B": "5",
  SS: "6",
  LF: "7",
  CF: "8",
  RF: "9",
  DH: "D",
};

/** Typed key (number or D) -> position. */
export const KEY_TO_POSITION: Record<string, string> = Object.fromEntries(
  Object.entries(POSITION_KEYS).map(([pos, key]) => [key.toLowerCase(), pos]),
);

interface Props {
  value: string;
  onChange: (position: string) => void;
  /** Include the pitcher as a tenth key (used for pitching changes). */
  includePitcher?: boolean;
  compact?: boolean;
}

export function PositionGrid({ value, onChange, includePitcher, compact }: Props) {
  return (
    <div className="space-y-1">
      <div className="grid grid-cols-3 gap-1">
        {POSITION_GRID.flat().map((pos) => (
          <Button
            key={pos}
            type="button"
            variant={value === pos ? "default" : "outline"}
            className={cellClass(compact)}
            onClick={() => onChange(value === pos ? "" : pos)}
          >
            <span className="font-medium">{pos}</span>
            <span className="font-mono opacity-60">{POSITION_KEYS[pos]}</span>
          </Button>
        ))}
      </div>
      {includePitcher && (
        <Button
          type="button"
          variant={value === "P" ? "default" : "outline"}
          className={`${cellClass(compact)} w-full`}
          onClick={() => onChange("P")}
        >
          <span className="font-medium">P</span>
          <span className="font-mono opacity-60">1</span>
        </Button>
      )}
    </div>
  );
}

function cellClass(compact?: boolean) {
  return compact
    ? "h-9 flex-col gap-0 px-0 text-xs leading-tight"
    : "h-11 flex-col gap-0 px-0 text-sm leading-tight";
}

