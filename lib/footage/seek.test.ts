import { describe, expect, it } from "vitest";
import { getMatchTiming, PROGRAM_V5RC } from "@/config/seasons";
import { autonClip, driverClip, seekSeconds } from "./seek";

const timing = getMatchTiming(PROGRAM_V5RC);

describe("seekSeconds", () => {
  it("subtracts stream start across different UTC offsets", () => {
    // 09:15 Pacific is 16:15 UTC; stream started 16:00 UTC -> 900s in.
    expect(seekSeconds("2026-10-03T09:15:00-07:00", "2026-10-03T16:00:00Z")).toBe(900);
  });

  it("applies the calibration offset", () => {
    expect(seekSeconds("2026-10-03T16:15:00Z", "2026-10-03T16:00:00Z", -45)).toBe(855);
  });

  it("returns null for missing or invalid timestamps", () => {
    expect(seekSeconds(null, "2026-10-03T16:00:00Z")).toBeNull();
    expect(seekSeconds("2026-10-03T16:15:00Z", undefined)).toBeNull();
    expect(seekSeconds("garbage", "2026-10-03T16:00:00Z")).toBeNull();
  });

  it("returns null when the match is before the stream started", () => {
    expect(seekSeconds("2026-10-03T15:59:00Z", "2026-10-03T16:00:00Z")).toBeNull();
  });
});

describe("autonClip", () => {
  it("pads the 15s auton on both sides", () => {
    expect(autonClip(900, timing)).toEqual({ start: 897, end: 918 });
  });

  it("never starts before 0", () => {
    expect(autonClip(1, timing).start).toBe(0);
  });
});

describe("driverClip", () => {
  it("starts after auton plus the default reset pause", () => {
    expect(driverClip(900, timing)).toEqual({ start: 925, end: 1033 });
  });

  it("uses a known gap from a driver anchor", () => {
    expect(driverClip(900, timing, { gapS: 22 }).start).toBe(937);
  });

  it("ends early if the next match on the field starts first", () => {
    expect(driverClip(900, timing, { nextMatchSeek: 1000 }).end).toBe(1000);
  });

  it("ignores a next-match time that is before driver starts", () => {
    expect(driverClip(900, timing, { nextMatchSeek: 910 }).end).toBe(1033);
  });
});
