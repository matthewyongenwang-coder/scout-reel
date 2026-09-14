import { type ClipInfo, clipShowsMatch, type MatchFacts, parseClipDescription } from "./clip-description";

export type IndexedClip = ClipInfo & { videoId: string; publishedAt: string | null };

/** Clips grouped by VEX event id. Plain JSON so it can live in the remote cache. */
export type ClipIndex = Record<string, IndexedClip[]>;

const DAY_MS = 24 * 60 * 60 * 1000;

export function buildClipIndex(
  videos: { videoId: string; description: string; publishedAt?: string | null }[],
): ClipIndex {
  const index: ClipIndex = {};
  for (const video of videos) {
    const info = parseClipDescription(video.description);
    if (!info) continue;
    (index[String(info.eventId)] ??= []).push({ ...info, videoId: video.videoId, publishedAt: video.publishedAt ?? null });
  }
  return index;
}

/**
 * The clip for one official match at one event, or null. A clip published more
 * than two days before the event started cannot show it, so it is skipped.
 */
export function findClip(
  index: ClipIndex,
  eventId: number,
  match: MatchFacts & { eventStart?: string | null },
): IndexedClip | null {
  const start = match.eventStart ? Date.parse(match.eventStart) : Number.NaN;
  const cutoff = Number.isNaN(start) ? null : start - 2 * DAY_MS;
  return (
    (index[String(eventId)] ?? []).find((clip) => {
      if (cutoff !== null && clip.publishedAt && Date.parse(clip.publishedAt) < cutoff) return false;
      return clipShowsMatch(clip, match);
    }) ?? null
  );
}
