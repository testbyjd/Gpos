"use client";

import { useEffect, useState } from "react";
import { Printer, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModalPortal } from "@/components/ui/modal-portal";
import { ReceiptPreview } from "@/features/admin/components/ReceiptPreview";
import { getReceiptSettings, type ReceiptSettings } from "@/lib/admin-api";
import { getErrorMessage } from "@/lib/api";
import type { SaleDetail } from "@/lib/admin-api";
import { saleToReceiptData } from "../saleReceipt";

const DEFAULTS: ReceiptSettings = {
  shop_name: "Gondal Traders",
  tagline: "",
  address: "",
  phone: "",
  footer_note: "Shukria! Dobara tashreef laaiye.",
  paper_width: "80",
  show_cashier: true,
  show_customer: true,
};

interface Props {
  sale: SaleDetail;
  onClose: () => void;
}

export function SaleReceiptPrint({ sale, onClose }: Props) {
  const [settings, setSettings] = useState<ReceiptSettings>(DEFAULTS);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getReceiptSettings()
      .then((res) => {
        if (!alive) return;
        setSettings({ ...DEFAULTS, ...res.data });
        setReady(true);
      })
      .catch((err) => {
        if (!alive) return;
        setError(getErrorMessage(err, "Receipt settings load nahi hui."));
        setReady(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  function handlePrint() {
    window.print();
  }

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[200] overflow-y-auto bg-black/55 p-4 py-8 backdrop-blur-sm print:bg-white print:p-0">
        <div className="mx-auto flex min-h-full max-w-lg flex-col items-center print:min-h-0">
          <div className="mb-4 flex w-full items-center justify-between no-print">
            <p className="font-black text-white print:text-foreground">Receipt — {sale.invoice_no}</p>
            <div className="flex gap-2">
              <Button size="sm" onClick={handlePrint} disabled={!ready || !!error}>
                <Printer className="h-4 w-4" />
                Print
              </Button>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-card text-foreground"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {error && <p className="mb-3 text-sm font-bold text-danger no-print">{error}</p>}

          {ready && !error && (
            <ReceiptPreview settings={settings} data={saleToReceiptData(sale)} />
          )}
        </div>
      </div>
    </ModalPortal>
  );
}
