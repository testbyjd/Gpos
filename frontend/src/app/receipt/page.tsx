"use client";

import { useEffect, useState } from "react";
import { Printer, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getReceiptSettings,
  updateReceiptSettings,
  type ReceiptSettings,
} from "@/lib/admin-api";
import { ReceiptPreview } from "@/features/admin/components/ReceiptPreview";
import { AdminShell, PagePanel, PanelHeader } from "@/features/admin/components/AdminShell";

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

const inputCls =
  "h-10 w-full rounded-md border border-border bg-input px-3 text-sm font-semibold text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/25";
const labelCls = "mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted-foreground";

export default function ReceiptPage() {
  const [settings, setSettings] = useState<ReceiptSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getReceiptSettings()
      .then((res) => alive && setSettings({ ...DEFAULTS, ...res.data }))
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  function update<K extends keyof ReceiptSettings>(key: K, value: ReceiptSettings[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  async function save() {
    setSaving(true);
    setNotice(null);
    try {
      const res = await updateReceiptSettings(settings);
      setSettings({ ...DEFAULTS, ...res.data });
      setNotice("Receipt settings save ho gayi.");
    } catch {
      setNotice("Save fail. Dobara try karo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminShell
      title="Receipt"
      eyebrow="Customer bill template"
      allowedRoles={["owner"]}
      actions={
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
            Test print
          </Button>
          <Button size="sm" onClick={save} disabled={saving || loading}>
            <Save className="h-4 w-4" />
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      }
    >
      {notice && (
        <div className="mb-4 rounded-lg border border-border/80 bg-muted/60 px-4 py-3 text-sm font-semibold text-foreground print:hidden">
          {notice}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <PagePanel className="print:hidden">
          <PanelHeader title="Customize receipt" meta="Yeh details har customer bill par chhapti hain" />
          <div className="grid gap-4 p-4 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className={labelCls}>Shop name</span>
              <input className={inputCls} value={settings.shop_name} onChange={(e) => update("shop_name", e.target.value)} />
            </label>
            <label className="block sm:col-span-2">
              <span className={labelCls}>Tagline (optional)</span>
              <input className={inputCls} value={settings.tagline} onChange={(e) => update("tagline", e.target.value)} placeholder="e.g. Wholesale & Retail" />
            </label>
            <label className="block sm:col-span-2">
              <span className={labelCls}>Address</span>
              <input className={inputCls} value={settings.address} onChange={(e) => update("address", e.target.value)} placeholder="Shop address" />
            </label>
            <label className="block">
              <span className={labelCls}>Phone</span>
              <input className={inputCls} value={settings.phone} onChange={(e) => update("phone", e.target.value)} placeholder="03xx-xxxxxxx" />
            </label>
            <label className="block">
              <span className={labelCls}>Paper width</span>
              <select className={inputCls} value={settings.paper_width} onChange={(e) => update("paper_width", e.target.value as ReceiptSettings["paper_width"])}>
                <option value="80">80mm (standard)</option>
                <option value="58">58mm (small)</option>
              </select>
            </label>
            <label className="block sm:col-span-2">
              <span className={labelCls}>Footer note</span>
              <textarea
                className="min-h-20 w-full rounded-md border border-border bg-input px-3 py-2 text-sm font-semibold text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/25"
                value={settings.footer_note}
                onChange={(e) => update("footer_note", e.target.value)}
                placeholder="Thank you message / return policy"
              />
            </label>

            <div className="sm:col-span-2 grid gap-2">
              <label className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <input type="checkbox" className="h-4 w-4 accent-primary" checked={settings.show_cashier} onChange={(e) => update("show_cashier", e.target.checked)} />
                Cashier ka naam dikhao
              </label>
              <label className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <input type="checkbox" className="h-4 w-4 accent-primary" checked={settings.show_customer} onChange={(e) => update("show_customer", e.target.checked)} />
                Customer ka naam dikhao
              </label>
            </div>
          </div>
        </PagePanel>

        <div className="xl:sticky xl:top-24 xl:self-start">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground print:hidden">Live preview</p>
          <div className="rounded-lg border border-border/80 bg-muted/40 p-4 print:border-0 print:bg-transparent print:p-0">
            <ReceiptPreview settings={settings} />
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
