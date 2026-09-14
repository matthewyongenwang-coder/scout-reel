import { cleanVideoRef, ID_PATTERNS, isValidVideoRef, type VideoRef } from "./platforms";

/** A livestream loaded for one event, and when that stream started if it has been synced. */
export type StoredSync = { video: VideoRef; streamStart: string | null };

type StorageReader = Pick<Storage, "getItem">;
type StorageWriter = Pick<Storage, "setItem" | "removeItem">;

export const syncKey = (sku: string) => `scout-reel.sync.v2.${sku}`;
/** YouTube-only entries saved before other platforms were supported. */
export const syncKeyV1 = (sku: string) => `scout-reel.sync.v1.${sku}`;

function validTime(value: unknown): string | null {
  return typeof value === "string" && !Number.isNaN(Date.parse(value)) ? value : null;
}

function parseJson(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function parseStoredSync(raw: string | null): StoredSync | null {
  const value = parseJson(raw);
  if (!value || value.v !== 2) return null;
  const video = { platform: value.platform, id: value.id, hash: value.hash };
  if (video.hash === undefined) delete video.hash;
  if (!isValidVideoRef(video)) return null;
  return { video: cleanVideoRef(video), streamStart: validTime(value.streamStart) };
}

export function serializeSync(sync: StoredSync): string {
  return JSON.stringify({ v: 2, ...cleanVideoRef(sync.video), streamStart: sync.streamStart });
}

function parseV1(raw: string | null): StoredSync | null {
  const value = parseJson(raw);
  if (!value || typeof value.videoId !== "string" || !ID_PATTERNS.youtube.test(value.videoId)) return null;
  return { video: { platform: "youtube", id: value.videoId }, streamStart: validTime(value.streamStart) };
}

/**
 * Reads an event's sync. An old YouTube-only entry is read as YouTube; it is only
 * rewritten by writeSync, so reading stays free of side effects. Never throws.
 */
export function readSync(storage: StorageReader, sku: string): StoredSync | null {
  try {
    const current = storage.getItem(syncKey(sku));
    if (current !== null) return parseStoredSync(current);
    return parseV1(storage.getItem(syncKeyV1(sku)));
  } catch {
    return null;
  }
}

/** Saves or removes an event's sync in the current format. Throws if storage refuses. */
export function writeSync(storage: StorageWriter, sku: string, sync: StoredSync | null): void {
  if (sync) storage.setItem(syncKey(sku), serializeSync(sync));
  else storage.removeItem(syncKey(sku));
  storage.removeItem(syncKeyV1(sku));
}
