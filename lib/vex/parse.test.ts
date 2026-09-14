import { describe, expect, it } from "vitest";
import { isAllowedFetchUrl, parseEventInput } from "./parse";

describe("parseEventInput", () => {
  it("accepts a bare SKU in any case", () => {
    expect(parseEventInput(" re-v5rc-26-4531 ")).toEqual({ ok: true, sku: "RE-V5RC-26-4531" });
  });

  it("accepts an events.vex.com link", () => {
    expect(
      parseEventInput(
        "https://events.vex.com/robot-competitions/vex-robotics-competition/RE-V5RC-26-4531.html#webcast",
      ),
    ).toEqual({ ok: true, sku: "RE-V5RC-26-4531" });
  });

  it("accepts an old robotevents.com link", () => {
    expect(
      parseEventInput("https://www.robotevents.com/robot-competitions/vex-robotics-competition/RE-VRC-23-1488.html"),
    ).toEqual({ ok: true, sku: "RE-VRC-23-1488" });
  });

  it("rejects links from other hosts even if they contain a SKU", () => {
    expect(parseEventInput("https://evil.example.com/RE-V5RC-26-4531.html").ok).toBe(false);
  });

  it("rejects look-alike hosts", () => {
    expect(parseEventInput("https://events.vex.com.evil.io/RE-V5RC-26-4531.html").ok).toBe(false);
  });

  it("rejects empty input and text that only contains a SKU", () => {
    expect(parseEventInput("").ok).toBe(false);
    expect(parseEventInput("event RE-V5RC-26-4531 please").ok).toBe(false);
  });

  it("rejects a valid host with no SKU", () => {
    expect(parseEventInput("https://events.vex.com/webcasts").ok).toBe(false);
  });
});

describe("isAllowedFetchUrl", () => {
  it("allows https VEX and YouTube hosts", () => {
    expect(isAllowedFetchUrl("https://events.vex.com/webcasts")).toBe(true);
    expect(isAllowedFetchUrl("https://www.youtube.com/@VEXRobotics")).toBe(true);
  });

  it("blocks http, private addresses, ports, and credentials", () => {
    expect(isAllowedFetchUrl("http://events.vex.com/webcasts")).toBe(false);
    expect(isAllowedFetchUrl("https://169.254.169.254/latest/meta-data")).toBe(false);
    expect(isAllowedFetchUrl("https://localhost/")).toBe(false);
    expect(isAllowedFetchUrl("https://events.vex.com:8443/")).toBe(false);
    expect(isAllowedFetchUrl("https://user:pw@events.vex.com/")).toBe(false);
    expect(isAllowedFetchUrl("not a url")).toBe(false);
  });
});
