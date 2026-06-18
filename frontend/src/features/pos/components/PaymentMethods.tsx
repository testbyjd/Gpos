"use client";

import { Banknote, CreditCard, QrCode, NotebookPen, SplitSquareHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PaymentMethod } from "../types";

const METHODS: { id: PaymentMethod; label: string; icon: typeof Banknote }[] = [
  { id: "cash", label: "Cash", icon: Banknote },
  { id: "card", label: "Card", icon: CreditCard },
  { id: "wallet", label: "Wallet / QR", icon: QrCode },
  { id: "khata", label: "Khata", icon: NotebookPen },
  { id: "split", label: "Split", icon: SplitSquareHorizontal },
];

interface Props {
  selected: PaymentMethod;
  onSelect: (m: PaymentMethod) => void;
}

export function PaymentMethods({ selected, onSelect }: Props) {
  return (
    <div className="grid grid-cols-5 gap-1.5 lg:gap-2">
      {METHODS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => onSelect(id)}
          className={cn(
            "flex h-11 flex-col items-center justify-center gap-0.5 rounded-md border px-1 text-center text-[10px] font-semibold leading-tight transition-all lg:h-16 lg:gap-1 lg:px-1.5 lg:text-[11px]",
            selected === id
              ? "border-primary bg-primary/10 text-primary shadow-sm ring-1 ring-primary/15"
              : "border-border/80 bg-card text-muted-foreground hover:border-primary/30 hover:bg-card-hover hover:text-foreground",
          )}
        >
          <Icon className="h-4 w-4 shrink-0 lg:h-5 lg:w-5" />
          {label}
        </button>
      ))}
    </div>
  );
}
