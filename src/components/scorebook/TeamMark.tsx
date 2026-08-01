import { teamById } from "@/lib/teams/mlb";
import { cn } from "@/lib/utils";

/** Initials fallback for manually entered (non-MLB) teams. */
function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

/**
 * Cap-style roundel drawn from club data — no image files, works offline.
 * Falls back to a neutral themed circle for custom teams.
 */
export function TeamMark({
  teamId,
  name,
  size = 24,
  className,
}: {
  teamId?: string;
  name: string;
  size?: number;
  className?: string;
}) {
  const team = teamById(teamId);
  const text = team ? team.cap : initials(name);
  const fontSize = text.length >= 3 ? 40 : text.length === 2 ? 50 : 58;

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      role="img"
      aria-label={`${name} mark`}
      className={cn("shrink-0", className)}
    >
      <circle
        cx="50"
        cy="50"
        r="48"
        fill={team ? team.primary : "currentColor"}
        fillOpacity={team ? 1 : 0.15}
        stroke={team ? team.secondary : "currentColor"}
        strokeOpacity={team ? 0.9 : 0.35}
        strokeWidth="4"
      />
      <text
        x="50"
        y="52"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={fontSize}
        fontWeight="700"
        fontFamily="var(--font-mono, monospace)"
        letterSpacing="-1"
        fill={team ? team.secondary : "currentColor"}
      >
        {text}
      </text>
    </svg>
  );
}