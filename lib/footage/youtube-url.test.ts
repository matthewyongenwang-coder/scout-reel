import { describe, expect, it } from "vitest";
import { parseYouTubeVideoId } from "./youtube-url";

const ID = "dQw4w9WgXcQ";

describe("parseYouTubeVideoId", () => {
  it.each([
    [ID],
    [`https://www.youtube.com/watch?v=${ID}`],
    [`https://www.youtube.com/watch?v=${ID}&t=3605s`],
    [`https://youtu.be/${ID}?t=90`],
    [`https://www.youtube.com/live/${ID}?si=abc`],
    [`https://m.youtube.com/watch?v=${ID}`],
    [`https://www.youtube-nocookie.com/embed/${ID}`],
  ])("reads %s", (input) => {
    expect(parseYouTubeVideoId(input)).toBe(ID);
  });

  it.each([
    [""],
    ["https://www.youtube.com/@VEXRobotics"],
    [`https://evil.example.com/watch?v=${ID}`],
    [`javascript:alert(1)//${ID}`],
    ["https://www.youtube.com/watch?v=short"],
  ])("rejects %s", (input) => {
    expect(parseYouTubeVideoId(input)).toBeNull();
  });
});
