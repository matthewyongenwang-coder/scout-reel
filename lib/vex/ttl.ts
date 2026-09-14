/**
 * How long to cache API data for an event, based on where it is in time.
 * Live events change every few minutes; finished events almost never change.
 */

export const CACHE_SECONDS = {
  live: 120,
  upcoming: 60 * 60,
  finished: 60 * 60 * 24 * 30,
  unknown: 60 * 60,
} as const;

const DAY_MS = 24 * 60 * 60 * 1000;

export function eventCacheSeconds(
  event: { start?: string | null; end?: string | null },
  nowMs: number = Date.now(),
): number {
  const start = event.start ? Date.parse(event.start) : Number.NaN;
  const end = event.end ? Date.parse(event.end) : Number.NaN;
  if (Number.isNaN(start) || Number.isNaN(end)) return CACHE_SECONDS.unknown;
  // The API end is usually midnight of the last day, and scores get fixed late,
  // so an event only counts as finished one full day after its end.
  if (nowMs > end + DAY_MS) return CACHE_SECONDS.finished;
  if (nowMs >= start - DAY_MS / 2) return CACHE_SECONDS.live;
  return CACHE_SECONDS.upcoming;
}
