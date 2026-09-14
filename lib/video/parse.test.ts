import { describe, expect, it } from "vitest";
import { parseVideoLink } from "./parse";

const YT = "dQw4w9WgXcQ";

function video(input: string) {
  const result = parseVideoLink(input);
  return result.ok ? result.video : null;
}

describe("parseVideoLink: YouTube", () => {
  it.each([
    [YT],
    [`https://www.youtube.com/watch?v=${YT}`],
    [`https://www.youtube.com/watch?v=${YT}&t=3605s`],
    [`https://youtube.com/watch?feature=share&v=${YT}`],
    [`https://youtu.be/${YT}?t=90`],
    [`https://www.youtube.com/live/${YT}?si=abc`],
    [`https://m.youtube.com/watch?v=${YT}`],
    [`https://www.youtube-nocookie.com/embed/${YT}`],
    [`https://www.youtube.com/embed/${YT}`],
    [`https://www.youtube.com/shorts/${YT}`],
    [`  https://www.youtube.com/watch?v=${YT}  `],
    [`www.youtube.com/watch?v=${YT}`],
  ])("reads %s", (input) => {
    expect(video(input)).toEqual({ platform: "youtube", id: YT });
  });

  it.each([
    ["https://www.youtube.com/@VEXRobotics"],
    ["https://www.youtube.com/watch?v=short"],
    [`https://www.youtube.com/watch?v=${YT}x`],
    [`https://www.youtube.com/playlist?list=PL${YT}`],
  ])("rejects a YouTube link without a single video: %s", (input) => {
    const result = parseVideoLink(input);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/video/i);
  });
});

describe("parseVideoLink: Twitch", () => {
  it.each([
    ["https://www.twitch.tv/videos/2245617381"],
    ["https://twitch.tv/videos/2245617381"],
    ["https://m.twitch.tv/videos/2245617381"],
    ["https://www.twitch.tv/videos/2245617381?t=1h2m3s"],
    ["https://player.twitch.tv/?video=v2245617381&parent=example.com"],
    ["https://player.twitch.tv/?video=2245617381&parent=example.com"],
  ])("reads the VOD %s", (input) => {
    expect(video(input)).toEqual({ platform: "twitch", id: "2245617381" });
  });

  it.each([
    ["https://www.twitch.tv/vexrobotics"],
    ["https://player.twitch.tv/?channel=vexrobotics&parent=example.com"],
  ])("explains that live channels cannot be synced: %s", (input) => {
    const result = parseVideoLink(input);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/past broadcast/i);
  });

  it.each([
    ["https://clips.twitch.tv/IncredulousAbstemiousFennelImGlitch"],
    ["https://www.twitch.tv/vexrobotics/clip/IncredulousAbstemiousFennelImGlitch"],
    ["https://www.twitch.tv/videos/abc"],
    ["https://www.twitch.tv/videos/12345678901234567890"],
    ["https://www.twitch.tv/collections/abc123"],
  ])("rejects %s", (input) => {
    expect(parseVideoLink(input).ok).toBe(false);
  });
});

describe("parseVideoLink: Vimeo", () => {
  it.each([
    ["https://vimeo.com/76979871", { platform: "vimeo", id: "76979871" }],
    ["https://www.vimeo.com/76979871", { platform: "vimeo", id: "76979871" }],
    ["https://vimeo.com/76979871/8272103f6e", { platform: "vimeo", id: "76979871", hash: "8272103f6e" }],
    ["https://player.vimeo.com/video/76979871", { platform: "vimeo", id: "76979871" }],
    ["https://player.vimeo.com/video/76979871?h=8272103f6e&dnt=1", { platform: "vimeo", id: "76979871", hash: "8272103f6e" }],
    ["https://vimeo.com/channels/staffpicks/76979871", { platform: "vimeo", id: "76979871" }],
    ["https://vimeo.com/showcase/123/video/76979871", { platform: "vimeo", id: "76979871" }],
  ])("reads %s", (input, expected) => {
    expect(video(input)).toEqual(expected);
  });

  it.each([
    ["https://vimeo.com/event/4012345"],
    ["https://vimeo.com/user12345"],
    ["https://vimeo.com/76979871/not-a-hash!"],
    ["https://player.vimeo.com/video/76979871?h=<script>"],
    ["https://vimeo.com.evil.example/76979871"],
    ["https://evil.vimeo.work/76979871"],
  ])("rejects %s", (input) => {
    expect(parseVideoLink(input).ok).toBe(false);
  });
});

describe("parseVideoLink: BoxCast", () => {
  const ID = "vmztpbgyjgtq53srci08";
  it.each([
    [`https://boxcast.tv/view/${ID}`],
    [`https://boxcast.tv/view/vex-iq-uk-nationals-finals-${ID}`],
    [`https://boxcast.tv/view-embed/${ID}?showTitle=0`],
    [`https://boxcast.tv/channel/qvmn3bkd7x9zropshvm8?b=${ID}`],
    [`https://www.boxcast.tv/view/${ID}`],
  ])("reads %s", (input) => {
    expect(video(input)).toEqual({ platform: "boxcast", id: ID });
  });

  it.each([
    ["https://boxcast.tv/channel/qvmn3bkd7x9zropshvm8"],
    ["https://boxcast.tv/view/short"],
    ["https://boxcast.tv/view/VMZTPBGYJGTQ53SRCI08"],
    ["https://dashboard.boxcast.com/broadcasts/vmztpbgyjgtq53srci08"],
    ["https://boxcast.tv.evil.example/view/vmztpbgyjgtq53srci08"],
  ])("rejects %s", (input) => {
    expect(parseVideoLink(input).ok).toBe(false);
  });
});

describe("parseVideoLink: hostile and unsupported input", () => {
  it.each([
    [`https://evil.example.com/watch?v=${YT}`],
    [`https://youtube.com.evil.example/watch?v=${YT}`],
    [`https://notyoutube.com/watch?v=${YT}`],
    [`https://youtube.com@evil.example/watch?v=${YT}`],
    [`https://user:pass@www.youtube.com/watch?v=${YT}`],
    [`https://www.youtube.com:8443/watch?v=${YT}`],
    [`javascript:alert(1)//www.youtube.com/watch?v=${YT}`],
    [`data:text/html,https://www.youtube.com/watch?v=${YT}`],
    [`ftp://www.youtube.com/watch?v=${YT}`],
    [`https://www.youtube.com%2eevil.example/watch?v=${YT}`],
    [`https://xn--youtube-9ya.com/watch?v=${YT}`],
    [`https://www.google.com/url?q=https://www.youtube.com/watch?v=${YT}`],
    [`https://www.youtube.com/redirect?q=https://evil.example`],
  ])("rejects %s", (input) => {
    expect(parseVideoLink(input).ok).toBe(false);
  });

  it("names the platforms that work when the site is not supported", () => {
    const result = parseVideoLink("https://www.dailymotion.com/video/x8abcd");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("YouTube");
      expect(result.error).toContain("dailymotion.com");
    }
  });

  it("asks for a link when the input is empty", () => {
    expect(parseVideoLink("   ")).toEqual({ ok: false, error: "Paste a livestream or video link first." });
  });

  it("rejects very long input without parsing it", () => {
    expect(parseVideoLink(`https://www.youtube.com/watch?v=${YT}&x=${"a".repeat(3000)}`).ok).toBe(false);
  });

  it("never echoes an unsafe host back in the error", () => {
    const result = parseVideoLink("https://<script>.example/video");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).not.toContain("<");
  });
});
