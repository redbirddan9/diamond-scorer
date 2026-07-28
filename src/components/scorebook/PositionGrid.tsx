import { Button } from "@/components/ui/button";

/** Fielding positions laid out as a 3x3 grid (no pitcher). */
export const POSITION_GRID = [
  ["DH", "C", "1B"],
  ["2B", "SS", "3B"],
  ["LF", "CF", "RF"],
];

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
            className={compact ? "h-8 px-0 text-xs" : "h-10 px-0 text-sm"}
            onClick={() => onChange(value === pos ? "" : pos)}
          >
            {pos}
          </Button>
        ))}
      </div>
      {includePitcher && (
        <Button
          type="button"
          variant={value === "P" ? "default" : "outline"}
          className={compact ? "h-8 w-full text-xs" : "h-10 w-full text-sm"}
          onClick={() => onChange("P")}
        >
          P
        </Button>
      )}
    </div>
  );
}
