/** All shop-facing dates/times use Pakistan (Karachi), regardless of browser TZ. */
export const PK_TIMEZONE = "Asia/Karachi";

/** YYYY-MM-DD in Karachi — use for API date filters. */
export function pkYmd(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: PK_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function formatPkDateTime(
  value: string | Date,
  opts: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  },
): string {
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-PK", { ...opts, timeZone: PK_TIMEZONE });
}

export function formatPkTime(value: string | Date): string {
  return formatPkDateTime(value, {
    hour: "2-digit",
    minute: "2-digit",
  });
}
