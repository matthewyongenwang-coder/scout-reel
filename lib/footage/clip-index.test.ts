import { describe, expect, it } from "vitest";
import clips from "@/tests/fixtures/youtube/clip-descriptions.json";
import { buildClipIndex, findClip } from "./clip-index";

const videos = [
  ...(clips as { videoId: string; description: string; publishedAt: string }[]),
  { videoId: "notAMatch01", description: "VEX Override robot reveal #vexrobotics", publishedAt: "2026-08-01T00:00:00Z" },
];

const r16 = { name: "R16 #4-1", red: ["1698V", "96Z"], blue: ["2131N", "2145Z"] };

describe("buildClipIndex", () => {
  const index = buildClipIndex(videos);

  it("groups match clips by VEX event id and skips other videos", () => {
    expect(Object.keys(index).sort()).toEqual(["64244", "64392"]);
    expect(index["64244"]).toHaveLength(1);
    expect(index["64244"][0].publishedAt).toBe("2026-08-09T14:36:49Z");
  });

  it("finds the clip for an official match regardless of team order", () => {
    const clip = findClip(index, 64244, { ...r16, redScore: 42, blueScore: 63, eventStart: "2026-08-06T00:00:00-05:00" });
    expect(clip?.videoId).toBe("FJ8PsDIvag8");
    expect(clip?.autonStartS).toBe(4);
  });

  it("skips a clip published well before the event started", () => {
    expect(findClip(index, 64244, { ...r16, eventStart: "2026-09-01T00:00:00-05:00" })).toBeNull();
  });

  it("returns null for the wrong event, a wrong score, or a match with no clip", () => {
    expect(findClip(index, 64392, r16)).toBeNull();
    expect(findClip(index, 64244, { ...r16, redScore: 10, blueScore: 63 })).toBeNull();
    expect(findClip(index, 64244, { name: "Qualifier #1", red: ["96Z"], blue: ["1A"] })).toBeNull();
  });
});
