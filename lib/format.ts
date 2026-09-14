/**
 * Display formatting. Event dates come from the date part of the API timestamp,
 * which is the event's listed day. Match clock times are deliberately not shown:
 * the API stamps every match in US Eastern time, not the venue's own timezone.
 */

const withYear = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});
const withoutYear = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

function datePart(iso: string | null | undefined): number | null {
  const m = iso?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

export function formatEventDates(start: string | null | undefined, end: string | null | undefined): string {
  const s = datePart(start);
  const e = datePart(end);
  if (s === null) return "Date not set";
  if (e === null || e === s) return withYear.format(s);
  return `${withoutYear.format(s)} to ${withYear.format(e)}`;
}

export function formatLocation(parts: (string | null | undefined)[]): string {
  return parts.filter((p): p is string => Boolean(p && p.trim())).join(", ");
}

/** Seconds -> "4:05" or "1:02:03". */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}
