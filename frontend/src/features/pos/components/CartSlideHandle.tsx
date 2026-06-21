"use client";

import { ChevronLeft, ChevronRight, ShoppingCart } from "lucide-react";
import { cn, formatMoney } from "@/lib/utils";

interface CartSlideHandleProps {
  open: boolean;
  itemCount: number;
  total: number;
  onToggle: () => void;
}

/** Mobile/tablet: arrow tab to slide cart in from the right. Hidden on lg+ where cart is always visible. */
export function CartSlideHandle({ open, itemCount, total, onToggle }: CartSlideHandleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-label={open ? "Cart band karo" : "Cart kholo"}
      className={cn(
        "fixed right-0 top-1/2 z-[60] flex -translate-y-1/2 flex-col items-center gap-1 rounded-l-xl border border-r-0 border-border/80 bg-card px-1.5 py-3 shadow-lg transition-transform duration-300 ease-out lg:hidden",
        open && "-translate-x-[min(100vw,420px)]",
      )}
    >
      {open ? (
        <ChevronRight className="h-5 w-5 text-primary" />
      ) : (
        <ChevronLeft className="h-5 w-5 text-primary" />
      )}
      <ShoppingCart className="h-4 w-4 text-muted-foreground" />
      {itemCount > 0 && (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-black text-primary-foreground">
          {itemCount > 99 ? "99+" : itemCount}
        </span>
      )}
      {itemCount > 0 && !open && (
        <span className="max-w-[3.5rem] truncate text-[9px] font-bold tabular-nums text-foreground">
          {formatMoney(total)}
        </span>
      )}
    </button>
  );
}
