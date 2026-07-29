/** Remembered free-text entries (teams, stadiums, cities) for quick re-entry. */
export type RecallKind = "teams" | "stadiums" | "cities";

const KEY = (kind: RecallKind) => `scorebook.recall.${kind}`;

export function loadRecall(kind: RecallKind): string[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = JSON.parse(localStorage.getItem(KEY(kind)) ?? "[]");
    return Array.isArray(raw) ? (raw as string[]) : [];
  } catch {
    return [];
  }
}

export function rememberRecall(kind: RecallKind, ...values: string[]) {
  if (typeof localStorage === "undefined") return;
  const clean = values.map((v) => v.trim()).filter(Boolean);
  if (!clean.length) return;
  const existing = loadRecall(kind);
  const merged = [...clean, ...existing.filter((v) => !clean.includes(v))].slice(0, 40);
  localStorage.setItem(KEY(kind), JSON.stringify(merged));
}
