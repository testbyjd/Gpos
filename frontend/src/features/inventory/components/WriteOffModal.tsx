"use client";

import { FormEvent, useMemo, useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModalPortal } from "@/components/ui/modal-portal";
import { useModalDismiss } from "@/lib/hooks/useModalDismiss";
import { createStockWriteOff, type ProductRow } from "@/lib/admin-api";
import { getErrorMessage } from "@/lib/api";
import { formatMoney } from "@/lib/utils";

const REASONS = [
  { value: "expired", label: "Expired" },
  { value: "damage", label: "Damage / broken" },
  { value: "gift_sample", label: "Gift / sample" },
  { value: "theft", label: "Theft / missing" },
] as const;

const inputCls =
  "h-10 w-full rounded-md border border-border bg-input px-3 text-sm font-semibold text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/25";
const labelCls =
  "mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted-foreground";

interface Props {
  product: ProductRow;
  onClose: () => void;
  onSaved: (product: ProductRow, lossValue: number) => void;
}

export function WriteOffModal({ product, onClose, onSaved }: Props) {
  useModalDismiss(onClose, { escape: false });

  const [qty, setQty] = useState("");
  const [reason, setReason] = useState<(typeof REASONS)[number]["value"]>("expired");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const qtyNum = parseFloat(qty) || 0;
  const stock = Number(product.stock_qty);
  const unitCost = Number(product.avg_cost);
  const lossPreview = useMemo(() => Math.round(qtyNum * unitCost * 100) / 100, [qtyNum, unitCost]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (qtyNum <= 0) return setError("Qty likho.");
    if (qtyNum > stock) return setError(`Stock sirf ${stock} ${product.unit} hai.`);

    setSaving(true);
    try {
      const res = await createStockWriteOff({
        product_id: product.id,
        qty: qtyNum,
        reason,
        note: note.trim() || undefined,
      });
      const updatedStock = Math.max(0, stock - qtyNum);
      onSaved({ ...product, stock_qty: updatedStock }, Number(res.data.loss_value));
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, "Write-off save nahi hua."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/50 p-4 py-8 backdrop-blur-sm">
        <div className="flex min-h-full items-center justify-center">
          <form
            onSubmit={onSubmit}
            className="w-full max-w-md rounded-xl border border-border/80 bg-card p-5 shadow-xl"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-danger/10 text-danger">
                  <AlertTriangle className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-lg font-black text-foreground">Stock write-off</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{product.name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mb-4 grid grid-cols-3 gap-2 rounded-lg border border-border/80 bg-muted/40 p-3 text-center text-sm">
              <div>
                <p className="text-[11px] uppercase text-muted-foreground">In stock</p>
                <p className="mt-1 font-black tabular-nums">{stock} {product.unit}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase text-muted-foreground">Avg cost</p>
                <p className="mt-1 font-black tabular-nums">{formatMoney(unitCost)}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase text-muted-foreground">Loss</p>
                <p className="mt-1 font-black tabular-nums text-danger">{formatMoney(lossPreview)}</p>
              </div>
            </div>

            <div className="space-y-3">
              <label className="block">
                <span className={labelCls}>Qty to remove ({product.unit})</span>
                <input
                  type="number"
                  min="0"
                  max={stock}
                  step="0.001"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  autoFocus
                  className={inputCls}
                />
              </label>

              <label className="block">
                <span className={labelCls}>Reason</span>
                <select value={reason} onChange={(e) => setReason(e.target.value as typeof reason)} className={inputCls}>
                  {REASONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className={labelCls}>Note (optional)</span>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. batch expired, gave to neighbour"
                  className={inputCls}
                />
              </label>
            </div>

            {error && (
              <p className="mt-3 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm font-bold text-danger">
                {error}
              </p>
            )}

            <div className="mt-5 flex gap-2">
              <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={saving || qtyNum <= 0}>
                {saving ? "Saving…" : "Confirm write-off"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
}

export function writeOffReasonLabel(reason: string): string {
  return REASONS.find((r) => r.value === reason)?.label ?? reason;
}
