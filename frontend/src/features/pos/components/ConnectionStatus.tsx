"use client";

import { useSyncExternalStore } from "react";
import { Cloud, CloudOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBillingConnection } from "@/lib/connection-status";
import {
  formatLastSync,
  formatLastSyncFull,
  getLastSyncAt,
  getLastSyncAtServerSnapshot,
  subscribeSync,
} from "@/lib/sync-status";

function subscribeTick(onStoreChange: () => void) {
  const id = window.setInterval(onStoreChange, 30_000);
  return () => window.clearInterval(id);
}

/** Live online/offline badge — billing only when browser + server are reachable. */
export function ConnectionStatus() {
  const { connected } = useBillingConnection();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const lastSyncAt = useSyncExternalStore(
    subscribeSync,
    getLastSyncAt,
    getLastSyncAtServerSnapshot,
  );

  const now = useSyncExternalStore(subscribeTick, () => Date.now(), () => 0);
  const syncLabel = mounted ? formatLastSync(lastSyncAt, now) : null;

  const title = mounted
    ? connected
      ? `Online — billing live (last contact ${formatLastSyncFull(lastSyncAt)})`
      : `Offline — billing paused, server/internet chahiye (last contact ${formatLastSyncFull(lastSyncAt)})`
    : connected
      ? "Online — billing live"
      : "Offline — billing paused";

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
        connected
          ? "border-success/30 bg-success/10 text-success"
          : "border-warning/40 bg-warning/10 text-warning",
      )}
      title={title}
      suppressHydrationWarning
    >
      {connected ? (
        <Cloud className="h-3.5 w-3.5 shrink-0" />
      ) : (
        <CloudOff className="h-3.5 w-3.5 shrink-0" />
      )}
      <span className="whitespace-nowrap">{connected ? "Online" : "Offline"}</span>
      {syncLabel && (
        <>
          <span className="opacity-50">·</span>
          <span className="whitespace-nowrap tabular-nums text-[10px] font-semibold opacity-90">
            {syncLabel}
          </span>
        </>
      )}
    </div>
  );
}
