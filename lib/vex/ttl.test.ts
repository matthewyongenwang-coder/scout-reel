import { describe, expect, it } from "vitest";
import { CACHE_SECONDS, eventCacheSeconds } from "./ttl";

const event = { start: "2026-10-03T00:00:00-07:00", end: "2026-10-04T00:00:00-07:00" };
const at = (iso: string) => Date.parse(iso);

describe("eventCacheSeconds", () => {
  it("treats events more than half a day away as upcoming", () => {
    expect(eventCacheSeconds(event, at("2026-09-20T12:00:00-07:00"))).toBe(CACHE_SECONDS.upcoming);
  });

  it("treats the event days as live, including the evening before", () => {
    expect(eventCacheSeconds(event, at("2026-10-02T18:00:00-07:00"))).toBe(CACHE_SECONDS.live);
    expect(eventCacheSeconds(event, at("2026-10-04T15:00:00-07:00"))).toBe(CACHE_SECONDS.live);
  });

  it("treats events finished for more than a day as finished", () => {
    expect(eventCacheSeconds(event, at("2026-10-05T01:00:00-07:00"))).toBe(CACHE_SECONDS.finished);
  });

  it("falls back when dates are missing or invalid", () => {
    expect(eventCacheSeconds({ start: null, end: undefined })).toBe(CACHE_SECONDS.unknown);
    expect(eventCacheSeconds({ start: "nope", end: "nope" })).toBe(CACHE_SECONDS.unknown);
  });
});
