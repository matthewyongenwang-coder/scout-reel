import { describe, expect, it } from "vitest";
import { parseStoredSync, readSync, serializeSync, syncKey, syncKeyV1, writeSync } from "./sync-storage";

const YT = "dQw4w9WgXcQ";
const START = "2026-08-26T23:39:23.000Z";

class MemoryStorage {
  items = new Map<string, string>();
  writes = 0;
  getItem(key: string) {
    return this.items.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.writes++;
    this.items.set(key, value);
  }
  removeItem(key: string) {
    this.writes++;
    this.items.delete(key);
  }
}

describe("parseStoredSync", () => {
  it("reads a v2 entry", () => {
    const raw = JSON.stringify({ v: 2, platform: "youtube", id: YT, streamStart: START });
    expect(parseStoredSync(raw)).toEqual({ video: { platform: "youtube", id: YT }, streamStart: START });
  });

  it("reads other platforms, keeping a Vimeo privacy hash", () => {
    const twitch = JSON.stringify({ v: 2, platform: "twitch", id: "2245617381", streamStart: null });
    const vimeo = JSON.stringify({ v: 2, platform: "vimeo", id: "76979871", hash: "8272103f6e", streamStart: START });
    expect(parseStoredSync(twitch)).toEqual({ video: { platform: "twitch", id: "2245617381" }, streamStart: null });
    expect(parseStoredSync(vimeo)).toEqual({
      video: { platform: "vimeo", id: "76979871", hash: "8272103f6e" },
      streamStart: START,
    });
  });

  it("round trips through serializeSync", () => {
    const sync = { video: { platform: "vimeo" as const, id: "76979871", hash: "8272103f6e" }, streamStart: START };
    expect(parseStoredSync(serializeSync(sync))).toEqual(sync);
  });

  it("drops fields it does not know", () => {
    const raw = JSON.stringify({ v: 2, platform: "youtube", id: YT, streamStart: START, extra: "<b>" });
    expect(parseStoredSync(raw)).toEqual({ video: { platform: "youtube", id: YT }, streamStart: START });
  });

  it.each([
    ["not json"],
    ["null"],
    ["[]"],
    [JSON.stringify({ v: 2, platform: "myspace", id: YT, streamStart: START })],
    [JSON.stringify({ v: 2, platform: "youtube", id: "bad id!", streamStart: START })],
    [JSON.stringify({ v: 2, platform: "__proto__", id: YT, streamStart: START })],
    [JSON.stringify({ v: 2, platform: "twitch", id: YT, streamStart: START })],
    [JSON.stringify({ v: 2, platform: "youtube", id: YT, hash: "abcdef", streamStart: START })],
    [JSON.stringify({ v: 3, platform: "youtube", id: YT, streamStart: START })],
  ])("drops invalid data %s", (raw) => {
    expect(parseStoredSync(raw)).toBeNull();
  });

  it("clears a bad sync time but keeps the video", () => {
    const raw = JSON.stringify({ v: 2, platform: "youtube", id: YT, streamStart: "yesterday" });
    expect(parseStoredSync(raw)).toEqual({ video: { platform: "youtube", id: YT }, streamStart: null });
  });
});

describe("readSync", () => {
  it("reads an old YouTube entry as YouTube without writing anything", () => {
    const storage = new MemoryStorage();
    storage.setItem(syncKeyV1("RE-V5RC-26-1234"), JSON.stringify({ videoId: YT, streamStart: START }));
    storage.writes = 0;

    expect(readSync(storage, "RE-V5RC-26-1234")).toEqual({ video: { platform: "youtube", id: YT }, streamStart: START });
    expect(storage.writes).toBe(0);
  });

  it("reads an old entry that was loaded but never synced", () => {
    const storage = new MemoryStorage();
    storage.setItem(syncKeyV1("A"), JSON.stringify({ videoId: YT, streamStart: null }));
    expect(readSync(storage, "A")).toEqual({ video: { platform: "youtube", id: YT }, streamStart: null });
  });

  it("prefers v2 over a leftover v1 entry", () => {
    const storage = new MemoryStorage();
    storage.setItem(syncKeyV1("A"), JSON.stringify({ videoId: "aaaaaaaaaaa", streamStart: START }));
    storage.setItem(syncKey("A"), JSON.stringify({ v: 2, platform: "twitch", id: "2245617381", streamStart: null }));
    expect(readSync(storage, "A")).toEqual({ video: { platform: "twitch", id: "2245617381" }, streamStart: null });
  });

  it("ignores an invalid old entry without throwing", () => {
    const storage = new MemoryStorage();
    storage.setItem(syncKeyV1("A"), "{broken");
    expect(readSync(storage, "A")).toBeNull();
  });

  it("returns null when storage itself throws", () => {
    const storage = {
      getItem: (): string | null => {
        throw new Error("SecurityError");
      },
    };
    expect(readSync(storage, "A")).toBeNull();
  });
});

describe("writeSync", () => {
  it("writes v2 and removes the old entry", () => {
    const storage = new MemoryStorage();
    storage.setItem(syncKeyV1("A"), JSON.stringify({ videoId: YT, streamStart: null }));
    const sync = { video: { platform: "youtube" as const, id: YT }, streamStart: START };

    writeSync(storage, "A", sync);

    expect(storage.getItem(syncKeyV1("A"))).toBeNull();
    expect(readSync(storage, "A")).toEqual(sync);
  });

  it("removes both entries when the livestream is removed", () => {
    const storage = new MemoryStorage();
    storage.setItem(syncKeyV1("A"), JSON.stringify({ videoId: YT, streamStart: null }));
    storage.setItem(syncKey("A"), serializeSync({ video: { platform: "youtube", id: YT }, streamStart: null }));

    writeSync(storage, "A", null);

    expect(storage.items.size).toBe(0);
    expect(readSync(storage, "A")).toBeNull();
  });

  it("lets a storage error reach the caller so it can fall back to memory", () => {
    const storage = new MemoryStorage();
    storage.setItem = () => {
      throw new Error("QuotaExceededError");
    };
    expect(() => writeSync(storage, "A", { video: { platform: "youtube", id: YT }, streamStart: null })).toThrow();
  });
});
