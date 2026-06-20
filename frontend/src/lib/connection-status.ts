"use client";

import { useEffect, useSyncExternalStore } from "react";
import { checkApiHealth } from "./api";
import { recordSync } from "./sync-status";

const PING_MS = 30_000;

let apiOnline = true;
const apiListeners = new Set<() => void>();

function setApiOnline(next: boolean) {
  if (apiOnline === next) return;
  apiOnline = next;
  apiListeners.forEach((listener) => listener());
}

function subscribeApiOnline(listener: () => void) {
  apiListeners.add(listener);
  return () => apiListeners.delete(listener);
}

function getApiOnlineSnapshot() {
  return apiOnline;
}

function subscribeBrowserOnline(listener: () => void) {
  const onOnline = () => {
    recordSync();
    listener();
  };
  window.addEventListener("online", onOnline);
  window.addEventListener("offline", listener);
  return () => {
    window.removeEventListener("online", onOnline);
    window.removeEventListener("offline", listener);
  };
}

function getBrowserOnlineSnapshot() {
  return navigator.onLine;
}

let monitorStarted = false;

function startConnectionMonitor() {
  if (monitorStarted || typeof window === "undefined") return;
  monitorStarted = true;

  async function ping() {
    if (!navigator.onLine) {
      setApiOnline(false);
      return;
    }
    const healthy = await checkApiHealth();
    setApiOnline(healthy);
    if (healthy) {
      recordSync();
    }
  }

  void ping();
  window.setInterval(ping, PING_MS);
  window.addEventListener("online", ping);
}

/**
 * Shared browser + API health for POS billing and the connection badge.
 * Billing should only proceed when `connected` is true.
 */
export function useBillingConnection() {
  const browserOnline = useSyncExternalStore(
    subscribeBrowserOnline,
    getBrowserOnlineSnapshot,
    () => true,
  );
  const serverOnline = useSyncExternalStore(
    subscribeApiOnline,
    getApiOnlineSnapshot,
    () => true,
  );

  useEffect(() => {
    startConnectionMonitor();
  }, []);

  return {
    connected: browserOnline && serverOnline,
    browserOnline,
    serverOnline,
  };
}
