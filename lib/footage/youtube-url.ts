const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

/** Pulls the 11-character video id out of any common YouTube link, or a bare id. */
export function parseYouTubeVideoId(raw: string): string | null {
  const input = raw.trim();
  if (VIDEO_ID.test(input)) return input;

  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;

  const host = url.hostname.toLowerCase().replace(/^(www|m)\./, "");
  let id: string | null = null;
  if (host === "youtu.be") {
    id = url.pathname.split("/")[1] ?? null;
  } else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (url.pathname === "/watch") {
      id = url.searchParams.get("v");
    } else {
      id = url.pathname.match(/^\/(?:live|embed|shorts)\/([^/]+)/)?.[1] ?? null;
    }
  }
  return id && VIDEO_ID.test(id) ? id : null;
}
