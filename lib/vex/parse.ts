/**
 * Turns whatever a user pastes (an events.vex.com or robotevents.com link, or a
 * bare SKU) into an event SKU. Links are only accepted from known VEX hosts so
 * a pasted URL can never make the server fetch an arbitrary address.
 */

const SKU_PATTERN = /\bRE-[A-Z0-9]+-\d{2}-\d{3,6}\b/i;

export const EVENT_HOSTS = [
  "events.vex.com",
  "www.events.vex.com",
  "robotevents.com",
  "www.robotevents.com",
] as const;

export type ParseResult =
  | { ok: true; sku: string }
  | { ok: false; error: string };

export function parseEventInput(raw: string): ParseResult {
  const input = raw.trim();
  if (!input) return { ok: false, error: "Paste an event link or SKU." };

  if (/^https?:\/\//i.test(input)) {
    let url: URL;
    try {
      url = new URL(input);
    } catch {
      return { ok: false, error: "That link could not be read." };
    }
    if (!(EVENT_HOSTS as readonly string[]).includes(url.hostname.toLowerCase())) {
      return {
        ok: false,
        error: "Only events.vex.com or robotevents.com links are supported.",
      };
    }
    const match = url.pathname.match(SKU_PATTERN);
    if (!match) return { ok: false, error: "No event SKU found in that link." };
    return { ok: true, sku: match[0].toUpperCase() };
  }

  const match = input.match(SKU_PATTERN);
  if (!match || match[0].length !== input.length) {
    return { ok: false, error: "That does not look like an event SKU (for example RE-V5RC-26-4531)." };
  }
  return { ok: true, sku: match[0].toUpperCase() };
}

const FETCH_HOSTS = new Set<string>([
  ...EVENT_HOSTS,
  "www.youtube.com",
  "youtube.com",
  "m.youtube.com",
  "youtu.be",
]);

/** Server-side fetch guard: https only, exact host match against the allowlist. */
export function isAllowedFetchUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  if (url.username || url.password || url.port) return false;
  return FETCH_HOSTS.has(url.hostname.toLowerCase());
}
