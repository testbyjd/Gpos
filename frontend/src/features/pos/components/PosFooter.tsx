"use client";

const KBD =
  "rounded border border-border bg-card px-1.5 py-0.5 font-mono text-[10px] font-bold text-foreground shadow-sm";

export function PosFooter() {
  return (
    <footer className="hidden shrink-0 flex-wrap items-center justify-between gap-2 border-t border-border/70 bg-surface px-4 py-1.5 text-[11px] font-medium text-muted-foreground xl:flex">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="inline-flex items-center gap-1">
          <kbd className={KBD}>F2</kbd> Search / Quick Add
        </span>
        <span className="inline-flex items-center gap-1">
          <kbd className={KBD}>F6</kbd> Return
        </span>
        <span className="inline-flex items-center gap-1">
          <kbd className={KBD}>F4</kbd> Hold Cart
        </span>
        <span className="inline-flex items-center gap-1">
          <kbd className={KBD}>F9</kbd> Pay / Checkout
        </span>
        <span className="inline-flex items-center gap-1">
          <kbd className={KBD}>Esc</kbd> Close Modal
        </span>
      </div>
      <p className="text-[11px]">
        Tip: Type <span className="font-semibold text-foreground">5*sugar</span> to add 5 units
        directly.
      </p>
    </footer>
  );
}
