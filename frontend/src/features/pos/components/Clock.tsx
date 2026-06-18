"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

export function Clock() {
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!mounted) return <div className="h-9 w-28" />;

  const time = now.toLocaleTimeString("en-PK", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  const date = now.toLocaleDateString("en-PK", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  return (
    <div className="text-right leading-tight">
      <div className="font-mono text-sm font-semibold tabular-nums text-foreground">
        {time}
      </div>
      <div className="text-xs text-muted-foreground">{date}</div>
    </div>
  );
}
