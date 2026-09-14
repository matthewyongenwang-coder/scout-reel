import { describe, expect, it } from "vitest";
import clips from "@/tests/fixtures/youtube/clip-descriptions.json";
import { clipShowsMatch, parseClipDescription } from "./clip-description";

const byId = (id: string) => {
  const clip = (clips as { videoId: string; description: string }[]).find((c) => c.videoId === id);
  if (!clip) throw new Error(`fixture ${id} missing`);
  return clip.description;
};

describe("parseClipDescription (recorded Robot Stats clips)", () => {
  it("reads the plain style: Mall of America R16 #4-1 with 96Z", () => {
    expect(parseClipDescription(byId("FJ8PsDIvag8"))).toEqual({
      eventId: 64244,
      matchName: "R16 #4-1",
      red: ["96Z", "1698V"],
      blue: ["2131N", "2145Z"],
      redScore: 42,
      blueScore: 63,
      autonStartS: 4,
      driverStartS: 41,
    });
  });

  it("reads the emoji style with scores after the teams", () => {
    expect(parseClipDescription(byId("PfJe0ZkNvHU"))).toEqual({
      eventId: 64392,
      matchName: "Final #1-3",
      red: ["2731K", "9123S"],
      blue: ["54001A", "18190X"],
      redScore: 73,
      blueScore: 0,
      autonStartS: 9,
      driverStartS: 32,
    });
  });

  it("returns null for descriptions that are not match clips", () => {
    expect(parseClipDescription("Gear ratios explained in under one minute #vexrobotics")).toBeNull();
  });

  it("keeps scores and chapters optional", () => {
    const text = "Event page: https://events.vex.com/api/v2/events/1\nMatch: Qualifier #3\nRed Alliance: 1A & 2B\nBlue Alliance: 3C & 4D";
    expect(parseClipDescription(text)).toMatchObject({
      eventId: 1,
      redScore: null,
      blueScore: null,
      autonStartS: null,
      driverStartS: null,
    });
  });

  it("ignores chapter times too long to be inside a match clip", () => {
    const text =
      "https://events.vex.com/api/v2/events/1\nMatch: Q #1\nRed Alliance: 1A & 2B\nBlue Alliance: 3C & 4D\n99:59:59 Auton Start\n00:30 Driver Start";
    expect(parseClipDescription(text)).toMatchObject({ autonStartS: null, driverStartS: 30 });
  });
});

describe("clipShowsMatch", () => {
  const clip = parseClipDescription(byId("FJ8PsDIvag8"))!;
  const official = { name: "R16 #4-1", red: ["1698V", "96Z"], blue: ["2145Z", "2131N"] };

  it("accepts the same match name and teams in any order", () => {
    expect(clipShowsMatch(clip, official)).toBe(true);
  });

  it("accepts matching official scores and rejects a clip whose score disagrees", () => {
    expect(clipShowsMatch(clip, { ...official, redScore: 42, blueScore: 63 })).toBe(true);
    expect(clipShowsMatch(clip, { ...official, redScore: 42, blueScore: 64 })).toBe(false);
  });

  it("rejects a different match name or a swapped alliance", () => {
    expect(clipShowsMatch(clip, { ...official, name: "R16 #4-2" })).toBe(false);
    expect(clipShowsMatch(clip, { name: "R16 #4-1", red: ["2131N", "2145Z"], blue: ["96Z", "1698V"] })).toBe(false);
  });
});
