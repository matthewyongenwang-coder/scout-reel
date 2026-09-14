/** Video platforms the player can embed and control. Each has one adapter in components/player. */
export const PLATFORMS = ["youtube", "twitch", "vimeo", "boxcast"] as const;
export type Platform = (typeof PLATFORMS)[number];

/**
 * A parsed, validated video. Players are only ever built from this, never from a pasted URL.
 * `hash` is the privacy hash of an unlisted Vimeo video.
 */
export type VideoRef = { platform: Platform; id: string; hash?: string };

export const PLATFORM_NAMES: Record<Platform, string> = {
  youtube: "YouTube",
  twitch: "Twitch",
  vimeo: "Vimeo",
  boxcast: "BoxCast",
};

export const ID_PATTERNS: Record<Platform, RegExp> = {
  youtube: /^[A-Za-z0-9_-]{11}$/,
  // Twitch VOD ids are numbers; the "v" prefix some links use is stripped when parsing.
  twitch: /^[0-9]{1,15}$/,
  vimeo: /^[0-9]{1,15}$/,
  boxcast: /^[a-z0-9]{20}$/,
};

export const VIMEO_HASH = /^[0-9a-f]{6,20}$/;

export function isPlatform(value: unknown): value is Platform {
  return typeof value === "string" && (PLATFORMS as readonly string[]).includes(value);
}

export function isValidVideoRef(value: unknown): value is VideoRef {
  if (typeof value !== "object" || value === null) return false;
  const { platform, id, hash } = value as Record<string, unknown>;
  if (!isPlatform(platform) || typeof id !== "string" || !ID_PATTERNS[platform].test(id)) return false;
  if (hash === undefined) return true;
  return platform === "vimeo" && typeof hash === "string" && VIMEO_HASH.test(hash);
}

/** Copies only the known fields, so nothing extra from storage or a request reaches a player. */
export function cleanVideoRef(video: VideoRef): VideoRef {
  return video.hash ? { platform: video.platform, id: video.id, hash: video.hash } : { platform: video.platform, id: video.id };
}

export function sameVideo(a: VideoRef | null | undefined, b: VideoRef | null | undefined): boolean {
  return Boolean(a && b && a.platform === b.platform && a.id === b.id && a.hash === b.hash);
}
