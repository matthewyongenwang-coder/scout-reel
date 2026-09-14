/**
 * Manual sync: when a viewer marks where a known match starts in a video, the
 * stream's real start time follows, and every other match on that stream can
 * be placed from its own start time.
 */
export function streamStartFromAnchor(matchStartedIso: string, videoSeconds: number): string | null {
  const started = Date.parse(matchStartedIso);
  if (Number.isNaN(started) || !Number.isFinite(videoSeconds) || videoSeconds < 0) return null;
  return new Date(started - Math.round(videoSeconds * 1000)).toISOString();
}
