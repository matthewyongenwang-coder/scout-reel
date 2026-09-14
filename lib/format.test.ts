import { describe, expect, it } from "vitest";
import { formatClock, formatEventDates, formatLocation } from "./format";

describe("formatEventDates", () => {
  it("shows a single day using the date in the timestamp, not the viewer's timezone", () => {
    expect(formatEventDates("2026-08-29T00:00:00-04:00", "2026-08-29T00:00:00-04:00")).toBe("Aug 29, 2026");
  });

  it("shows a range", () => {
    expect(formatEventDates("2026-10-03T00:00:00-07:00", "2026-10-04T00:00:00-07:00")).toBe("Oct 3 to Oct 4, 2026");
  });

  it("handles missing dates", () => {
    expect(formatEventDates(null, null)).toBe("Date not set");
  });
});

describe("formatLocation", () => {
  it("skips empty parts", () => {
    expect(formatLocation(["Templestowe College", "", null, "Victoria"])).toBe("Templestowe College, Victoria");
  });
});

describe("formatClock", () => {
  it("formats minutes and hours", () => {
    expect(formatClock(245)).toBe("4:05");
    expect(formatClock(3723)).toBe("1:02:03");
    expect(formatClock(-5)).toBe("0:00");
  });
});
