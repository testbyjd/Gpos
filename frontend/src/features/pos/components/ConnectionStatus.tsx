"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Cloud, CloudOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { checkApiHealth } from "@/lib/api";
import {
  formatLastSync,
  formatLastSyncFull,
  getLastSyncAt,
  getLastSyncAtServerSnapshot,
  recordSync,
  subscribeSync,
} from "@/lib/sync-status";

function subscribeToConnectionChange(onStoreChange: () => void) {
  const onOnline = () => {
    recordSync();
    onStoreChange();
  };
  window.addEventListener("online", onOnline);
  window.addEventListener("offline", onStoreChange);
  return () => {
    window.removeEventListener("online", onOnline);
    window.removeEventListener("offline", onStoreChange);
  };
}

function getConnectionSnapshot() {
  return navigator.onLine;
}

function subscribeTick(onStoreChange: () => void) {
  const id = window.setInterval(onStoreChange, 30_000);
  return () => window.clearInterval(id);
}

/**
 * Shows live online/offline state. Billing is online-only: when offline the
 * cashier sees "billing paused" and checkout is blocked until the connection
 * (and the server) are reachable again.
 */
export function ConnectionStatus() {
  const [apiOnline, setApiOnline] = useState(true);
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const online = useSyncExternalStore(
    subscribeToConnectionChange,
    getConnectionSnapshot,
    () => true,
  );

  const lastSyncAt = useSyncExternalStore(
    subscribeSync,
    getLastSyncAt,
    getLastSyncAtServerSnapshot,
  );

  const now = useSyncExternalStore(subscribeTick, () => Date.now(), () => 0);

  useEffect(() => {
    let alive = true;
    async function ping() {
      if (!navigator.onLine) {
        if (alive) setApiOnline(false);
        return;
      }
      const healthy = await checkApiHealth();
      if (!alive) return;
      setApiOnline(healthy);
      if (healthy) {
        recordSync();
      }
    }
    void ping();
    const id = window.setInterval(ping, 30_000);
    window.addEventListener("online", ping);
    return () => {
      alive = false;
      window.clearInterval(id);
      window.removeEventListener("online", ping);
    };
  }, []);

  const connected = online && apiOnline;
  const syncLabel = mounted ? formatLastSync(lastSyncAt, now) : null;

  const title = mounted
    ? connected
      ? `Online — billing live (last contact ${formatLastSyncFull(lastSyncAt)})`
      : `Offline — billing paused, internet needed (last contact ${formatLastSyncFull(lastSyncAt)})`
    : connected
      ? "Online — billing live"
      : "Offline — billing paused (internet needed)";

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
