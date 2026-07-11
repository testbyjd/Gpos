"use client";

export function PosFooter() {
  return (
    <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-border/80 bg-[#e5e7eb] px-3 py-1.5 text-[11px] font-medium text-muted-foreground dark:bg-muted/50 sm:px-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span>
          <kbd className="rounded border border-border bg-white px-1 font-bold dark:bg-card">F2</kbd>{" "}
          Search / Quick Add
        </span>
        <span>
          <kbd className="rounded border border-border bg-white px-1 font-bold dark:bg-card">F6</kbd>{" "}
          Return
        </span>
        <span>
          <kbd className="rounded border border-border bg-white px-1 font-bold dark:bg-card">F4</kbd>{" "}
          Hold Cart
        </span>
        <span>
          <kbd className="rounded border border-border bg-white px-1 font-bold dark:bg-card">F9</kbd>{" "}
          Pay / Checkout
        </span>
        <span>
          <kbd className="rounded border border-border bg-white px-1 font-bold dark:bg-card">Esc</kbd>{" "}
          Close Modal
        </span>
      </div>
      <p className="text-[11px]">
        Tip: Type <span className="font-semibold text-foreground">5*sugar</span> to add 5 units
        directly.
      </p>
    </footer>
  );
}
