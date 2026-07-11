"use client";

import { useState } from "react";
import { KeyRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/utils";
import { useModalDismiss } from "@/lib/hooks/useModalDismiss";
import { verifyManagerPin } from "../api/verifyPin";

interface Props {
  productName: string;
  amount: number;
  maxDiscount: number;
  freeCap: number;
  onApproved: () => void;
  onClose: () => void;
}

export function DiscountPinModal({
  productName,
  amount,
  maxDiscount,
  freeCap,
  onApproved,
  onClose,
}: Props) {
  useModalDismiss(onClose);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (pin.length < 4 || submitting) return;
    setSubmitting(true);
    setError("");
    const ok = await verifyManagerPin(pin);
    setSubmitting(false);
    if (!ok) {
      setError("Galat PIN — manager / owner PIN try karo.");
      setPin("");
      return;
    }
    onApproved();
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="discount-pin-title"
    >
      <section
        className="animate-fade-in w-full max-w-sm overflow-hidden rounded-xl border border-border bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border/80 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-warning/15 text-warning">
              <KeyRound className="h-4 w-4" />
            </span>
            <h2 id="discount-pin-title" className="text-base font-black text-foreground">
              Manager PIN
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-card-hover"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3 p-5">
          <p className="text-sm text-muted-foreground">
            <span className="font-bold text-foreground">{productName}</span> pe discount{" "}
            <span className="font-bold tabular-nums text-foreground">{formatMoney(amount)}</span>{" "}
            free limit ({formatMoney(freeCap)}) se zyada hai — max {formatMoney(maxDiscount)}.
          </p>

          <label className="block space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              PIN
            </span>
            <input
              type="password"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={8}
              value={pin}
              autoFocus
              onChange={(e) => {
                setPin(e.target.value.replace(/\D/g, "").slice(0, 8));
                setError("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") void submit();
              }}
              placeholder="••••"
              className="h-12 w-full rounded-lg border border-border bg-input px-3 text-center text-xl font-black tracking-[0.35em] outline-none focus:border-primary focus:ring-2 focus:ring-ring/25"
            />
          </label>

          {error && <p className="text-xs font-bold text-danger">{error}</p>}

          <div className="grid grid-cols-3 gap-2 pt-1">
            <Button variant="secondary" size="lg" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button
              size="lg"
              className="col-span-2"
              disabled={pin.length < 4 || submitting}
              onClick={() => void submit()}
            >
              {submitting ? "Checking…" : "Approve discount"}
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
