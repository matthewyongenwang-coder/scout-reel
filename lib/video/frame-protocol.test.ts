import { describe, expect, it } from "vitest";
import { commandMessage, parseCommand, parseReport, reportMessage } from "./frame-protocol";

describe("commands sent to the player frame", () => {
  it.each([
    [{ kind: "load", id: "vmztpbgyjgtq53srci08", start: 12.5 }],
    [{ kind: "seek", seconds: 30 }],
    [{ kind: "play" }],
    [{ kind: "pause" }],
    [{ kind: "time", requestId: 4 }],
  ] as const)("round trips %j", (command) => {
    expect(parseCommand(commandMessage(command))).toEqual(command);
  });

  it.each([
    [null],
    ["load"],
    [{ kind: "load", id: "vmztpbgyjgtq53srci08" }],
    [{ source: "other", kind: "play" }],
    [{ source: "scout-reel-player", kind: "eval", code: "alert(1)" }],
    [{ source: "scout-reel-player", kind: "load", id: "<img src=x>", start: 0 }],
    [{ source: "scout-reel-player", kind: "seek", seconds: "10" }],
    [{ source: "scout-reel-player", kind: "seek", seconds: -1 }],
    [{ source: "scout-reel-player", kind: "seek", seconds: Number.POSITIVE_INFINITY }],
    [{ source: "scout-reel-player", kind: "time", requestId: 1.5 }],
  ])("ignores %j", (data) => {
    expect(parseCommand(data)).toBeNull();
  });
});

describe("reports sent back by the player frame", () => {
  it.each([
    [{ kind: "ready" }],
    [{ kind: "time", requestId: 4, seconds: 61.2 }],
    [{ kind: "time", requestId: 4, seconds: null }],
    [{ kind: "progress", seconds: 61.2, duration: 3600 }],
    [{ kind: "progress", seconds: 61.2, duration: null }],
    [{ kind: "error", message: "unavailable" }],
  ] as const)("round trips %j", (report) => {
    expect(parseReport(reportMessage(report))).toEqual(report);
  });

  it.each([
    [{ source: "scout-reel-player", kind: "error", message: "x".repeat(500) }],
    [{ source: "scout-reel-player", kind: "error", message: "<script>" }],
    [{ source: "scout-reel-player", kind: "progress", seconds: Number.NaN, duration: 1 }],
    [{ source: "scout-reel-player", kind: "navigate", url: "https://evil.example" }],
  ])("ignores %j", (data) => {
    expect(parseReport(data)).toBeNull();
  });
});
