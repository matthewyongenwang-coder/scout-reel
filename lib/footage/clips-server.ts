import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { youtubeGet } from "@/lib/youtube/client";
import { buildClipIndex, type ClipIndex } from "./clip-index";

/** Uploads playlist of "Robot Stats: VEX Scouting & Matches", which posts one clip per Signature match. */
export const ROBOT_STATS_UPLOADS = "UUMBIfXh0oly6jgbt8iEHpTQ";

// About 2,000 videos in September 2026. Each page is 50 videos and costs 2 quota units.
const MAX_PAGES = 200;

type PlaylistPage = { nextPageToken?: string; items: { contentDetails: { videoId: string } }[] };
type VideosPage = { items: { id: string; snippet: { description: string; publishedAt?: string } }[] };

export type ClipIndexResult = { ok: true; index: ClipIndex } | { ok: false };

/**
 * Every Robot Stats match clip, indexed by VEX event id. Rebuilt in the background
 * twice a day and never kept longer than a week, well inside YouTube's 30-day rule.
 * A failure (for example an exhausted quota) is cached for a few minutes so every
 * visitor does not restart the whole rebuild.
 */
export async function getRobotStatsClipIndex(): Promise<ClipIndexResult> {
  "use cache: remote";
  cacheTag("clip-index:robot-stats");

  try {
    const detailPages: Promise<VideosPage>[] = [];
    let pageToken: string | undefined;
    let pages = 0;
    do {
      const list = await youtubeGet<PlaylistPage>("playlistItems", {
        part: "contentDetails",
        playlistId: ROBOT_STATS_UPLOADS,
        maxResults: "50",
        ...(pageToken ? { pageToken } : {}),
      });
      const ids = list.items.map((item) => item.contentDetails.videoId);
      if (ids.length > 0) {
        detailPages.push(youtubeGet<VideosPage>("videos", { part: "snippet", id: ids.join(",") }));
      }
      pageToken = list.nextPageToken;
      pages++;
    } while (pageToken && pages < MAX_PAGES);

    if (pageToken) {
      console.warn(`Robot Stats clip index stopped at ${MAX_PAGES} pages; older clips are missing. Raise MAX_PAGES.`);
    }

    const videos = (await Promise.all(detailPages)).flatMap((page) =>
      page.items.map((video) => ({
        videoId: video.id,
        description: video.snippet.description,
        publishedAt: video.snippet.publishedAt ?? null,
      })),
    );
    cacheLife({ stale: 60 * 60, revalidate: 60 * 60 * 12, expire: 60 * 60 * 24 * 7 });
    return { ok: true, index: buildClipIndex(videos) };
  } catch (error) {
    cacheLife({ stale: 60, revalidate: 5 * 60, expire: 10 * 60 });
    // The client never puts the API key in error messages, so this is safe to log.
    console.warn("Robot Stats clip index failed:", error instanceof Error ? error.message : "unknown error");
    return { ok: false };
  }
}
