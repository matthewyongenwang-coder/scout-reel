import { ID_PATTERNS, PLATFORM_NAMES, PLATFORMS, VIMEO_HASH, type VideoRef } from "./platforms";

export type ParseResult = { ok: true; video: VideoRef } | { ok: false; error: string };

const MAX_LENGTH = 2000;

const supportedList = () => {
  const names = PLATFORMS.map((p) => PLATFORM_NAMES[p]);
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
};

const fail = (error: string): ParseResult => ({ ok: false, error });
const found = (video: VideoRef): ParseResult => ({ ok: true, video });

function parseYouTube(url: URL, host: string): ParseResult {
  let id: string | null;
  if (host === "youtu.be") {
    id = url.pathname.split("/")[1] ?? null;
  } else if (url.pathname === "/watch") {
    id = url.searchParams.get("v");
  } else {
    id = url.pathname.match(/^\/(?:live|embed|shorts)\/([^/]+)\/?$/)?.[1] ?? null;
  }
  return id && ID_PATTERNS.youtube.test(id)
    ? found({ platform: "youtube", id })
    : fail("That YouTube link does not point to a single video or livestream. Open the video and copy its link.");
}

const TWITCH_LIVE =
  "Twitch live channels cannot be synced. Once the event ends, open the channel's Videos tab, pick the past broadcast, and paste its link.";

function parseTwitch(url: URL, host: string): ParseResult {
  let id: string | null = null;
  if (host === "player.twitch.tv") {
    if (url.searchParams.has("channel") && !url.searchParams.has("video")) return fail(TWITCH_LIVE);
    id = url.searchParams.get("video")?.replace(/^v/, "") ?? null;
  } else {
    const segments = url.pathname.split("/").filter(Boolean);
    if (segments[0] === "videos" && segments.length === 2) id = segments[1];
    else if (segments.length === 1 && !["videos", "directory", "collections"].includes(segments[0])) return fail(TWITCH_LIVE);
    else if (segments[1] === "clip") return fail("Twitch clips cannot be controlled. Paste the link to the full past broadcast instead.");
  }
  return id && ID_PATTERNS.twitch.test(id)
    ? found({ platform: "twitch", id })
    : fail("That Twitch link is not a past broadcast. Links look like twitch.tv/videos/ followed by numbers.");
}

function parseVimeo(url: URL, host: string): ParseResult {
  const segments = url.pathname.split("/").filter(Boolean);
  let id: string | undefined;
  let hash: string | null | undefined;
  if (host === "player.vimeo.com") {
    if (segments[0] === "video" && segments.length === 2) id = segments[1];
    hash = url.searchParams.get("h");
  } else if (segments[0] === "event") {
    return fail("Vimeo live event links cannot be controlled. Paste the link to the recorded video instead.");
  } else if (/^[0-9]+$/.test(segments[0] ?? "")) {
    if (segments.length > 2) return fail("That Vimeo link is not a single video.");
    id = segments[0];
    hash = segments[1] ?? url.searchParams.get("h");
  } else if (segments[0] === "channels" && segments.length === 3) {
    id = segments[2];
  } else if (segments[0] === "showcase" && segments[2] === "video" && segments.length === 4) {
    id = segments[3];
  }
  if (!id || !ID_PATTERNS.vimeo.test(id)) return fail("That Vimeo link is not a single video. Open the video and copy its link.");
  if (hash == null) return found({ platform: "vimeo", id });
  return VIMEO_HASH.test(hash)
    ? found({ platform: "vimeo", id, hash })
    : fail("That Vimeo link has a private code Scout Reel does not recognise. Copy the link again from Vimeo.");
}

function parseBoxCast(url: URL): ParseResult {
  const segments = url.pathname.split("/").filter(Boolean);
  let id: string | null | undefined;
  if ((segments[0] === "view" || segments[0] === "view-embed") && segments.length === 2) {
    // Share links can put a readable title before the id: /view/some-title-<id>.
    id = segments[1].split("-").at(-1);
  } else if (segments[0] === "channel" && segments.length === 2) {
    id = url.searchParams.get("b");
    if (!id) return fail("That BoxCast link is a whole channel. Pick one broadcast on the page and copy its link.");
  }
  return id && ID_PATTERNS.boxcast.test(id)
    ? found({ platform: "boxcast", id })
    : fail("That BoxCast link is not a single broadcast. Open the broadcast and copy its link.");
}

type HostParser = (url: URL, host: string) => ParseResult;

/** Exact hostnames per platform. Anything else, including subdomains not listed, is refused. */
const HOSTS: Record<string, HostParser> = {
  "youtube.com": parseYouTube,
  "www.youtube.com": parseYouTube,
  "m.youtube.com": parseYouTube,
  "youtu.be": parseYouTube,
  "youtube-nocookie.com": parseYouTube,
  "www.youtube-nocookie.com": parseYouTube,
  "twitch.tv": parseTwitch,
  "www.twitch.tv": parseTwitch,
  "m.twitch.tv": parseTwitch,
  "player.twitch.tv": parseTwitch,
  "vimeo.com": parseVimeo,
  "www.vimeo.com": parseVimeo,
  "player.vimeo.com": parseVimeo,
  "boxcast.tv": parseBoxCast,
  "www.boxcast.tv": parseBoxCast,
};

/**
 * Turns a pasted livestream or video link into a platform and id. Only exact,
 * known hosts are accepted, and the player is built from the result, never from the link.
 */
export function parseVideoLink(raw: string): ParseResult {
  const input = raw.trim();
  if (!input) return fail("Paste a livestream or video link first.");
  if (input.length > MAX_LENGTH) return fail("That link is too long.");
  if (ID_PATTERNS.youtube.test(input)) return found({ platform: "youtube", id: input });

  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(input) ? input : `https://${input}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return fail(`That is not a link. Scout Reel can play links from ${supportedList()}.`);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return fail(`Only web links work here. Scout Reel can play links from ${supportedList()}.`);
  }
  if (url.username || url.password || url.port) return fail("That link is not a normal video link.");

  const host = url.hostname.toLowerCase();
  const parse = Object.hasOwn(HOSTS, host) ? HOSTS[host] : undefined;
  if (!parse) {
    const shown = /^[a-z0-9.-]+$/.test(host) ? ` That link is from ${host}.` : "";
    return fail(`Scout Reel can play links from ${supportedList()}.${shown}`);
  }
  return parse(url, host);
}
