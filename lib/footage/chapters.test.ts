import { describe, expect, it } from "vitest";
import { getMatchTiming, PROGRAM_V5RC } from "@/config/seasons";
import { segmentsFromChapters } from "./chapters";

const timing = getMatchTiming(PROGRAM_V5RC);

describe("segmentsFromChapters", () => {
  it("uses exact chapter times from the 96Z Mall of America clip", () => {
    expect(segmentsFromChapters({ autonStartS: 4, driverStartS: 41 }, timing)).toEqual({
      auton: { start: 1, end: 22 },
      driver: { start: 38, end: 149 },
    });
  });

  it("estimates both segments from the clip start when chapters are missing", () => {
    expect(segmentsFromChapters({ autonStartS: null, driverStartS: null }, timing)).toEqual({
      auton: { start: 0, end: 18 },
      driver: { start: 33, end: 141 },
    });
  });
});
