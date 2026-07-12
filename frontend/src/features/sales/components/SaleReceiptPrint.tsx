"use client";

import { useEffect, useState } from "react";
import { Printer, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModalPortal } from "@/components/ui/modal-portal";
import { ReceiptPreview } from "@/features/admin/components/ReceiptPreview";
import { getReceiptSettings, normalizeReceiptSettings, type ReceiptSettings } from "@/lib/admin-api";
import { getErrorMessage } from "@/lib/api";
import { printReceiptDirect } from "@/lib/print-bridge";
import type { SaleDetail } from "@/lib/admin-api";
import { saleToReceiptData } from "../saleReceipt";

const DEFAULTS = normalizeReceiptSettings({});

interface Props {
  sale: SaleDetail;
  onClose: () => void;
  /** When true, open browser print dialog once receipt is ready (POS Print button). */
  autoPrint?: boolean;
}

export function SaleReceiptPrint({ sale, onClose, autoPrint = false }: Props) {
  const [settings, setSettings] = useState<ReceiptSettings>(DEFAULTS);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [printError, setPrintError] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    let alive = true;
    getReceiptSettings()
      .then((res) => {
        if (!alive) return;
        setSettings(normalizeReceiptSettings(res.data));
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

  useEffect(() => {
    if (!autoPrint || !ready || error) return;
    void handlePrint();
    // A sale already kicks the drawer; receipt printing must not kick it twice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPrint, ready, error]);

  async function handlePrint() {
    if (printing) return;
    setPrinting(true);
    setPrintError(null);
    const result = await printReceiptDirect({
      settings: settings as unknown as Record<string, unknown>,
      data: saleToReceiptData(sale) as unknown as Record<string, unknown>,
      openDrawer: false,
    });
    setPrinting(false);
    if (!result.ok) {
      setPrintError(`${result.message} Browser print fallback use ho raha hai.`);
      window.setTimeout(() => window.print(), 50);
    }
  }

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[200] overflow-y-auto bg-black/55 p-4 py-8 backdrop-blur-sm print:bg-white print:p-0">
        <div className="mx-auto flex min-h-full max-w-lg flex-col items-center print:min-h-0">
          <div className="mb-4 flex w-full items-center justify-between no-print">
            <p className="font-black text-white print:text-foreground">Receipt — {sale.invoice_no}</p>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => void handlePrint()} disabled={!ready || !!error || printing}>
                <Printer className="h-4 w-4" />
                {printing ? "Printing…" : "Print"}
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
          {printError && <p className="mb-3 text-sm font-bold text-warning no-print">{printError}</p>}

          {ready && !error && (
            <ReceiptPreview settings={settings} data={saleToReceiptData(sale)} />
          )}
        </div>
      </div>
    </ModalPortal>
  );
}
