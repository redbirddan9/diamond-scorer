/**
 * Keyboard-only control layer.
 *
 * Arrow keys move DOM focus to the nearest focusable element in that direction
 * (resolved geometrically, so grids behave the way they look), Enter activates
 * the focused element, and Backspace walks back one level through whatever
 * screen registered a back handler.
 */

export type Direction = "up" | "down" | "left" | "right";

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type=hidden])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export function isTextField(el: Element | null): el is HTMLInputElement | HTMLTextAreaElement {
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === "textarea") return true;
  if (tag !== "input") return false;
  const type = (el as HTMLInputElement).type;
  return !["checkbox", "radio", "button", "submit", "range", "color"].includes(type);
}

function visible(el: HTMLElement) {
  if (el.hasAttribute("aria-hidden")) return false;
  const rect = el.getBoundingClientRect();
  if (rect.width < 2 || rect.height < 2) return false;
  const style = window.getComputedStyle(el);
  return style.visibility !== "hidden" && style.display !== "none" && style.opacity !== "0";
}

export function focusables(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(visible);
}

interface Box {
  el: HTMLElement;
  cx: number;
  cy: number;
  rect: DOMRect;
}

function boxes(): Box[] {
  return focusables().map((el) => {
    const rect = el.getBoundingClientRect();
    return { el, rect, cx: rect.left + rect.width / 2, cy: rect.top + rect.height / 2 };
  });
}

/** Nearest focusable in `dir`, falling back to DOM order so nothing is a dead end. */
export function nextTarget(from: HTMLElement | null, dir: Direction): HTMLElement | null {
  const all = boxes();
  if (!all.length) return null;
  if (!from || !all.some((b) => b.el === from)) return all[0].el;

  const origin = all.find((b) => b.el === from)!;
  const horizontal = dir === "left" || dir === "right";
  const sign = dir === "left" || dir === "up" ? -1 : 1;

  let best: Box | null = null;
  let bestScore = Infinity;
  for (const b of all) {
    if (b.el === from) continue;
    const along = horizontal ? (b.cx - origin.cx) * sign : (b.cy - origin.cy) * sign;
    if (along < 4) continue; // not in this direction
    const cross = horizontal ? Math.abs(b.cy - origin.cy) : Math.abs(b.cx - origin.cx);
    // Overlapping on the cross axis means same row/column — strongly preferred.
    const overlap = horizontal
      ? b.rect.bottom > origin.rect.top && b.rect.top < origin.rect.bottom
      : b.rect.right > origin.rect.left && b.rect.left < origin.rect.right;
    const score = along + cross * (overlap ? 0.4 : 3);
    if (score < bestScore) {
      bestScore = score;
      best = b;
    }
  }
  if (best) return best.el;

  // Edge of the screen: wrap through DOM order instead of trapping focus.
  const order = all.map((b) => b.el);
  const i = order.indexOf(from);
  const step = sign;
  const wrapped = order[(i + step + order.length) % order.length];
  return wrapped ?? null;
}

export function moveFocus(dir: Direction): boolean {
  const target = nextTarget(document.activeElement as HTMLElement | null, dir);
  if (!target) return false;
  target.focus();
  target.scrollIntoView({ block: "nearest", inline: "nearest" });
  return true;
}

/** Focus the first focusable element on screen (used when a stage changes). */
export function focusFirst(): void {
  const list = focusables();
  const target = list.find((el) => el.dataset["navPrimary"] === "true") ?? list[0];
  target?.focus();
}

/* --------------------------- back handler stack --------------------------- */

type BackHandler = () => boolean;

const backHandlers: BackHandler[] = [];

/** Register a "Backspace" behavior; returns an unregister function. */
export function registerBackHandler(handler: BackHandler): () => void {
  backHandlers.push(handler);
  return () => {
    const i = backHandlers.indexOf(handler);
    if (i >= 0) backHandlers.splice(i, 1);
  };
}

/** Run the innermost handler that claims the event. */
export function goBack(): boolean {
  for (let i = backHandlers.length - 1; i >= 0; i--) {
    if (backHandlers[i]()) return true;
  }
  return false;
}
