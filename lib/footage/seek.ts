import type { MatchTiming } from "@/config/seasons";

export type Clip = { start: number; end: number };

/**
 * Seconds into a stream where a match starts:
 * (match started - stream actual start) + calibration offset.
 * Returns null when a timestamp is missing or the match is before the stream.
 */
export function seekSeconds(
  startedIso: string | null | undefined,
  streamStartIso: string | null | undefined,
  offsetS = 0,
): number | null {
  if (!startedIso || !streamStartIso) return null;
  const started = Date.parse(startedIso);
  const streamStart = Date.parse(streamStartIso);
  if (Number.isNaN(started) || Number.isNaN(streamStart)) return null;
  const seek = Math.floor((started - streamStart) / 1000) + offsetS;
  return seek < 0 ? null : seek;
}

export function autonClip(seek: number, timing: MatchTiming): Clip {
  return {
    start: Math.max(0, seek - timing.leadS),
    end: seek + timing.autonS + timing.leadS,
  };
}

/**
 * Driver control starts after auton plus the reset pause. The clip ends when
 * driver control ends, or earlier if the next match on the same field begins.
 */
export function driverClip(
  seek: number,
  timing: MatchTiming,
  opts: { gapS?: number; nextMatchSeek?: number | null } = {},
): Clip {
  const start = seek + timing.autonS + (opts.gapS ?? timing.defaultGapS);
  let end = start + timing.driverS + timing.leadS;
  if (opts.nextMatchSeek != null && opts.nextMatchSeek > start) {
    end = Math.min(end, opts.nextMatchSeek);
  }
  return { start, end };
}
