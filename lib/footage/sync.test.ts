import { describe, expect, it } from "vitest";
import { seekSeconds } from "./seek";
import { streamStartFromAnchor } from "./sync";

describe("streamStartFromAnchor", () => {
  it("works backwards from a marked match start to the stream start", () => {
    // Match started 20:09:23 EDT (00:09:23 UTC) and appears 1800s into the video.
    expect(streamStartFromAnchor("2026-08-26T20:09:23-04:00", 1800)).toBe("2026-08-26T23:39:23.000Z");
  });

  it("places the anchor match back at the marked time, and later matches after it", () => {
    const streamStart = streamStartFromAnchor("2026-08-26T20:09:23-04:00", 1800)!;
    expect(seekSeconds("2026-08-26T20:09:23-04:00", streamStart)).toBe(1800);
    expect(seekSeconds("2026-08-26T20:15:23-04:00", streamStart)).toBe(2160);
  });

  it("rejects invalid input", () => {
    expect(streamStartFromAnchor("nope", 10)).toBeNull();
    expect(streamStartFromAnchor("2026-08-26T20:09:23-04:00", -1)).toBeNull();
    expect(streamStartFromAnchor("2026-08-26T20:09:23-04:00", Number.NaN)).toBeNull();
  });
});
