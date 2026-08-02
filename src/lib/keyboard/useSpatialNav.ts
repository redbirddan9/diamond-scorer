import { useEffect } from "react";
import {
  focusFirst,
  focusables,
  goBack,
  isTextField,
  moveFocus,
  type Direction,
} from "./spatial-nav";

const DIRS: Record<string, Direction> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};

/**
 * Mounted once at the root. Existing letter hotkeys run first; anything they
 * consumed (defaultPrevented) is ignored here.
 */
export function useSpatialNav() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const active = document.activeElement as HTMLElement | null;
      const inText = isTextField(active);
      const dir = DIRS[e.key];

      if (dir) {
        // Left/Right stay with the caret while typing; Up/Down leave the field.
        if (inText && (dir === "left" || dir === "right")) return;
        if (moveFocus(dir)) e.preventDefault();
        return;
      }

      if (e.key === "Enter") {
        if (inText) {
          // Commit the field and hop to the next control.
          const list = focusables();
          const i = list.indexOf(active!);
          const next = list[i + 1];
          if (next) {
            next.focus();
            e.preventDefault();
          }
          return;
        }
        if (!active || active === document.body) {
          focusFirst();
          e.preventDefault();
        }
        return; // buttons/links activate natively
      }

      if (e.key === "Backspace") {
        if (inText) return; // editing text
        if (goBack()) e.preventDefault();
        return;
      }

      if (e.key === "Escape" && inText) {
        active?.blur();
        e.preventDefault();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Keep a focus target alive: when the focused element disappears (a stage or
  // panel swapped out), move focus to the first control of the new screen.
  useEffect(() => {
    const observer = new MutationObserver(() => {
      const active = document.activeElement;
      if (!active || active === document.body || !document.contains(active)) {
        focusFirst();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    if (!document.activeElement || document.activeElement === document.body) focusFirst();
    return () => observer.disconnect();
  }, []);
}
