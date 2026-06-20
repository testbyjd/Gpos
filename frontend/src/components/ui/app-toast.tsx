"use client";

import { useCallback, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastTone = "success" | "error" | "info";

type ToastState = { message: string; tone: ToastTone } | null;

const DURATION: Record<ToastTone, number> = {
  success: 2800,
  error: 8000,
  info: 4000,
};

export function useAppToast() {
  const [toast, setToast] = useState<ToastState>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hideToast = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast(null);
  }, []);

  const showToast = useCallback(
    (message: string, tone: ToastTone = "info") => {
      if (timerRef.current) clearTimeout(timerRef.current);
      setToast({ message, tone });
      timerRef.current = setTimeout(() => setToast(null), DURATION[tone]);
    },
    [],
  );

  return { toast, showToast, hideToast };
}

export function AppToast({
  toast,
  onDismiss,
}: {
  toast: ToastState;
  onDismiss?: () => void;
}) {
  if (!toast) return null;

  const Icon =
    toast.tone === "success" ? CheckCircle2 : toast.tone === "error" ? AlertTriangle : Info;

  return (
    <div
      role="status"
      className={cn(
        "animate-fade-in fixed bottom-6 left-1/2 z-[200] flex max-w-lg -translate-x-1/2 items-start gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium text-white shadow-lg",
        toast.tone === "success" && "border-success/30 bg-success",
        toast.tone === "error" && "border-danger/30 bg-danger",
        toast.tone === "info" && "border-border/80 bg-foreground/90",
      )}
    >
      <Icon className="mt-0.5 h-5 w-5 shrink-0" />
      <span className="flex-1">{toast.message}</span>
      {(toast.tone === "error" || onDismiss) && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="shrink-0 rounded p-0.5 opacity-80 hover:opacity-100"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
