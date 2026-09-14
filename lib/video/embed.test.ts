import { describe, expect, it } from "vitest";
import { boxcastFrameSrc, segmentStep, twitchOptions, vimeoEmbedSrc } from "./embed";

describe("vimeoEmbedSrc", () => {
  it("builds a privacy-friendly player link from the id", () => {
    const src = new URL(vimeoEmbedSrc({ platform: "vimeo", id: "76979871" }));
    expect(src.origin).toBe("https://player.vimeo.com");
    expect(src.pathname).toBe("/video/76979871");
    expect(src.searchParams.get("dnt")).toBe("1");
    expect(src.searchParams.get("playsinline")).toBe("1");
    expect(src.searchParams.get("autoplay")).toBe("0");
    expect(src.searchParams.has("h")).toBe(false);
  });

  it("adds the privacy hash of an unlisted video", () => {
    const src = new URL(vimeoEmbedSrc({ platform: "vimeo", id: "76979871", hash: "8272103f6e" }));
    expect(src.searchParams.get("h")).toBe("8272103f6e");
  });

  it("refuses anything that is not a valid Vimeo video", () => {
    expect(() => vimeoEmbedSrc({ platform: "youtube", id: "dQw4w9WgXcQ" })).toThrow();
    expect(() => vimeoEmbedSrc({ platform: "vimeo", id: "1/../../evil" })).toThrow();
  });
});

describe("twitchOptions", () => {
  it("plays the VOD, does not autoplay, and names this site as the parent", () => {
    expect(twitchOptions({ platform: "twitch", id: "2245617381" }, "scout-reel-five.vercel.app", 90)).toEqual({
      video: "v2245617381",
      parent: ["scout-reel-five.vercel.app"],
      autoplay: false,
      time: "0h1m30s",
      width: "100%",
      height: "100%",
    });
  });

  it("starts at the beginning without a time", () => {
    expect(twitchOptions({ platform: "twitch", id: "1" }, "localhost").time).toBe("0h0m0s");
  });

  it("refuses a bad id or hostname", () => {
    expect(() => twitchOptions({ platform: "twitch", id: "abc" }, "localhost")).toThrow();
    expect(() => twitchOptions({ platform: "twitch", id: "1" }, "evil.example/&parent=x")).toThrow();
  });
});

describe("boxcastFrameSrc", () => {
  it("points at the isolated player page on this site", () => {
    expect(boxcastFrameSrc({ platform: "boxcast", id: "vmztpbgyjgtq53srci08" })).toBe(
      "/player/boxcast?b=vmztpbgyjgtq53srci08",
    );
  });

  it("refuses a bad id", () => {
    expect(() => boxcastFrameSrc({ platform: "boxcast", id: "../../etc" })).toThrow();
  });
});

describe("segmentStep", () => {
  const start = 100;
  const end = 115;

  it("waits while a freshly loaded video still reports 0", () => {
    expect(segmentStep(0, start, end)).toBe("wait");
  });

  it("keeps playing inside the segment", () => {
    expect(segmentStep(100.5, start, end)).toBe("wait");
    expect(segmentStep(114.9, start, end)).toBe("wait");
  });

  it("pauses at the end of the segment", () => {
    expect(segmentStep(115, start, end)).toBe("pause");
    expect(segmentStep(119, start, end)).toBe("pause");
  });

  it("stops watching without pausing when the viewer seeks away", () => {
    expect(segmentStep(50, start, end)).toBe("release");
    expect(segmentStep(121, start, end)).toBe("release");
  });

  it("allows a little slack before the start while seeking settles", () => {
    expect(segmentStep(98.5, start, end)).toBe("wait");
  });
});
