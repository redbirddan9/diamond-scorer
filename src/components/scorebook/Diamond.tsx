import { cn } from "@/lib/utils";

interface DiamondProps {
  first?: boolean;
  second?: boolean;
  third?: boolean;
  size?: number;
  className?: string;
}

/** Base-occupancy diamond used on the game screen and the review dialog. */
export function Diamond({ first, second, third, size = 96, className }: DiamondProps) {
  const base = (occupied?: boolean) =>
    occupied ? "fill-primary stroke-primary" : "fill-background stroke-field-line";
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      aria-label="Base runners"
      role="img"
    >
      <path d="M50 88 L14 52 L50 16 L86 52 Z" className="fill-field stroke-field-line" strokeWidth="2" />
      <rect x="42" y="8" width="16" height="16" rx="2" transform="rotate(45 50 16)" className={cn(base(second), "stroke-2")} />
      <rect x="78" y="44" width="16" height="16" rx="2" transform="rotate(45 86 52)" className={cn(base(first), "stroke-2")} />
      <rect x="6" y="44" width="16" height="16" rx="2" transform="rotate(45 14 52)" className={cn(base(third), "stroke-2")} />
      <rect x="43" y="81" width="14" height="14" rx="2" transform="rotate(45 50 88)" className="fill-background stroke-field-line stroke-2" />
    </svg>
  );
}