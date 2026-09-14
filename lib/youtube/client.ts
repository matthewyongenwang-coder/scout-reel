import "server-only";
import { serverEnv } from "@/lib/env";

export class YouTubeApiError extends Error {
  constructor(
    readonly status: number,
    readonly reason: string | null,
    message: string,
  ) {
    super(message);
    this.name = "YouTubeApiError";
  }
}

type Resource = "playlistItems" | "videos" | "channels";

/**
 * Minimal YouTube Data API v3 reader. Only 1-unit list calls are allowed here;
 * search.list costs 100 units and has its own tiny daily cap, so it is not exposed.
 */
export async function youtubeGet<T>(resource: Resource, params: Record<string, string>): Promise<T> {
  const key = serverEnv().YOUTUBE_API_KEY;
  if (!key) throw new YouTubeApiError(0, "missingKey", "The YouTube API key is not configured.");

  const url = new URL(`https://www.googleapis.com/youtube/v3/${resource}`);
  for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);
  url.searchParams.set("key", key);

  const res = await fetch(url);
  if (!res.ok) {
    let reason: string | null = null;
    try {
      const body = (await res.json()) as { error?: { errors?: { reason?: string }[] } };
      reason = body.error?.errors?.[0]?.reason ?? null;
    } catch {
      // Non-JSON error body; the status code is enough.
    }
    // Never include the URL in the message: it carries the API key.
    throw new YouTubeApiError(res.status, reason, `YouTube ${resource} request failed with status ${res.status}.`);
  }
  return (await res.json()) as T;
}
