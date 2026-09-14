import { isValidVideoRef, type VideoRef } from "./platforms";

function assertVideo(video: VideoRef, platform: VideoRef["platform"]) {
  if (video.platform !== platform || !isValidVideoRef(video)) throw new Error(`Not a valid ${platform} video`);
}

/** Vimeo player link built only from a validated id, with tracking turned off. */
export function vimeoEmbedSrc(video: VideoRef): string {
  assertVideo(video, "vimeo");
  const params = new URLSearchParams();
  if (video.hash) params.set("h", video.hash);
  params.set("dnt", "1");
  params.set("playsinline", "1");
  params.set("autoplay", "0");
  return `https://player.vimeo.com/video/${video.id}?${params}`;
}

const HOSTNAME = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/;

function twitchTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  return `${Math.floor(total / 3600)}h${Math.floor((total % 3600) / 60)}m${total % 60}s`;
}

/**
 * Options for Twitch's player. Twitch requires `parent` to be the hostname of the page
 * embedding it, so the caller passes window.location.hostname.
 */
export function twitchOptions(video: VideoRef, hostname: string, start = 0) {
  assertVideo(video, "twitch");
  if (!HOSTNAME.test(hostname)) throw new Error("Not a valid hostname");
  return {
    video: `v${video.id}`,
    parent: [hostname],
    autoplay: false,
    time: twitchTime(start),
    width: "100%",
    height: "100%",
  };
}

/** BoxCast runs in a sandboxed page on this site, so its scripts never share the app's origin. */
export function boxcastFrameSrc(video: VideoRef): string {
  assertVideo(video, "boxcast");
  return `/player/boxcast?b=${video.id}`;
}

/**
 * What to do while a segment plays: keep waiting, pause because the end was reached,
 * or let go because the viewer moved somewhere else in the video.
 */
export function segmentStep(t: number, start: number, end: number): "wait" | "pause" | "release" {
  // A freshly loaded video reports 0 until playback begins.
  if (t === 0) return "wait";
  if (t < start - 2 || t > end + 5) return "release";
  return t >= end ? "pause" : "wait";
}
