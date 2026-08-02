/** Always-visible reminder of the keyboard-only controls. */
export function KeyHints() {
  return (
    <p className="pointer-events-none fixed bottom-1 left-0 right-0 z-50 text-center font-mono text-[10px] uppercase tracking-wide text-muted-foreground print:hidden">
      ↑↓←→ move · Enter select · Backspace back
    </p>
  );
}
