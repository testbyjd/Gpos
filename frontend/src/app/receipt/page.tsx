"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { AppToast, useAppToast } from "@/components/ui/app-toast";
import { Printer, RotateCcw, Save } from "lucide-react";
import {
  getReceiptSettings,
  normalizeReceiptSettings,
  RECEIPT_DESIGN_DEFAULTS,
  updateReceiptSettings,
  type ReceiptSettings,
} from "@/lib/admin-api";
import { getErrorMessage } from "@/lib/api";
import { ReceiptPreview } from "@/features/admin/components/ReceiptPreview";
import { AdminShell, PageAlert, PagePanel, PanelHeader } from "@/features/admin/components/AdminShell";

const DEFAULTS = normalizeReceiptSettings({});

const inputCls =
  "h-10 w-full rounded-md border border-border bg-input px-3 text-sm font-semibold text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/25";
const labelCls = "mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted-foreground";
const rangeCls = "h-2 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary";

function SliderField({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center justify-between gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
        <span>{label}</span>
        <span className="tabular-nums text-foreground">
          {step < 1 ? value.toFixed(2) : value}
          {unit ?? ""}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={rangeCls}
      />
    </label>
  );
}

export default function ReceiptPage() {
  const [settings, setSettings] = useState<ReceiptSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast, showToast, hideToast } = useAppToast();
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getReceiptSettings()
      .then((res) => {
        if (!alive) return;
        setSettings(normalizeReceiptSettings(res.data));
        setLoadError(null);
      })
      .catch((err) => {
        if (!alive) return;
        setLoadError(getErrorMessage(err, "Receipt settings load nahi hui. Server check karo."));
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  function update<K extends keyof ReceiptSettings>(key: K, value: ReceiptSettings[K]) {
    setSettings((prev) => normalizeReceiptSettings({ ...prev, [key]: value }));
  }

  async function save() {
    setSaving(true);
    try {
      const payload = normalizeReceiptSettings(settings);
      const res = await updateReceiptSettings(payload);
      setSettings(normalizeReceiptSettings(res.data));
      showToast("Receipt settings save ho gayi.", "success");
    } catch (err) {
      showToast(getErrorMessage(err, "Save fail. Dobara try karo."), "error");
    } finally {
      setSaving(false);
    }
  }

  function resetDesign() {
    setSettings((prev) =>
      normalizeReceiptSettings({
        ...prev,
        ...RECEIPT_DESIGN_DEFAULTS,
      }),
    );
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
      {loadError && <PageAlert message={loadError} tone="error" className="print:hidden" />}
      <AppToast toast={toast} onDismiss={hideToast} />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-4 print:hidden">
          <PagePanel>
            <PanelHeader title="Shop details" meta="Yeh details har customer bill par chhapti hain" />
            <div className="grid gap-4 p-4 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className={labelCls}>Shop name</span>
                <input className={inputCls} value={settings.shop_name} onChange={(e) => update("shop_name", e.target.value)} />
              </label>
              <label className="block sm:col-span-2">
                <span className={labelCls}>Tagline (optional)</span>
                <input
                  className={inputCls}
                  value={settings.tagline}
                  onChange={(e) => update("tagline", e.target.value)}
                  placeholder="e.g. Wholesale & Retail"
                />
              </label>
              <label className="block sm:col-span-2">
                <span className={labelCls}>Address</span>
                <input
                  className={inputCls}
                  value={settings.address}
                  onChange={(e) => update("address", e.target.value)}
                  placeholder="Shop address"
                />
              </label>
              <label className="block">
                <span className={labelCls}>Phone</span>
                <input
                  className={inputCls}
                  value={settings.phone}
                  onChange={(e) => update("phone", e.target.value)}
                  placeholder="03xx-xxxxxxx"
                />
              </label>
              <label className="block">
                <span className={labelCls}>Paper width</span>
                <select
                  className={inputCls}
                  value={settings.paper_width}
                  onChange={(e) => update("paper_width", e.target.value as ReceiptSettings["paper_width"])}
                >
                  <option value="58">58mm (small)</option>
                  <option value="80">80mm (standard)</option>
                  <option value="110">110mm (wide)</option>
                  <option value="112">112mm (wide+)</option>
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
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-primary"
                    checked={settings.show_cashier}
                    onChange={(e) => update("show_cashier", e.target.checked)}
                  />
                  Cashier ka naam dikhao
                </label>
                <label className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-primary"
                    checked={settings.show_customer}
                    onChange={(e) => update("show_customer", e.target.checked)}
                  />
                  Customer ka naam dikhao
                </label>
              </div>
            </div>
          </PagePanel>

          <PagePanel>
            <PanelHeader
              title="Design controls"
              meta="Sliders se live redesign — Save dabao print pe apply hone ke liye"
              actions={
                <Button size="sm" variant="secondary" onClick={resetDesign}>
                  <RotateCcw className="h-4 w-4" />
                  Reset design
                </Button>
              }
            />
            <div className="grid gap-5 p-4 sm:grid-cols-2">
              <SliderField
                label="Body font size"
                value={settings.font_size ?? RECEIPT_DESIGN_DEFAULTS.font_size}
                min={10}
                max={18}
                step={1}
                unit="px"
                onChange={(v) => update("font_size", v)}
              />
              <SliderField
                label="Title size"
                value={settings.title_size ?? RECEIPT_DESIGN_DEFAULTS.title_size}
                min={12}
                max={26}
                step={1}
                unit="px"
                onChange={(v) => update("title_size", v)}
              />
              <SliderField
                label="Font weight"
                value={settings.font_weight ?? RECEIPT_DESIGN_DEFAULTS.font_weight}
                min={400}
                max={900}
                step={100}
                onChange={(v) => update("font_weight", v)}
              />
              <SliderField
                label="Line height"
                value={settings.line_height ?? RECEIPT_DESIGN_DEFAULTS.line_height}
                min={1.1}
                max={1.9}
                step={0.05}
                onChange={(v) => update("line_height", v)}
              />
              <SliderField
                label="Padding"
                value={settings.padding ?? RECEIPT_DESIGN_DEFAULTS.padding}
                min={4}
                max={24}
                step={1}
                unit="px"
                onChange={(v) => update("padding", v)}
              />
              <SliderField
                label="Section gap"
                value={settings.section_gap ?? RECEIPT_DESIGN_DEFAULTS.section_gap}
                min={2}
                max={16}
                step={1}
                unit="px"
                onChange={(v) => update("section_gap", v)}
              />
            </div>
          </PagePanel>
        </div>

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
