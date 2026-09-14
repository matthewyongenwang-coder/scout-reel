import { describe, expect, it } from "vitest";
import { parseReportForm, parseWorkspaceForm, RATING_FIELDS } from "./forms";

const WS = "3f2c9a7e-1b4d-4c8e-9f00-2a6b7c8d9e10";

const form = (entries: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
};

const valid = {
  workspaceId: WS,
  teamId: "141836",
  seasonId: "204",
  teamNumber: "96Z",
  driving: "7",
  consistency: "6",
  fieldSense: "10",
  autonomous: "1",
  notes: "Fast cycles\r\nWeak defence",
};

describe("parseReportForm", () => {
  it("reads a full card", () => {
    expect(parseReportForm(form(valid))).toEqual({
      ok: true,
      report: {
        workspaceId: WS,
        teamId: 141836,
        seasonId: 204,
        teamNumber: "96Z",
        driving: 7,
        consistency: 6,
        fieldSense: 10,
        autonomous: 1,
        notes: "Fast cycles\nWeak defence",
      },
    });
  });

  it("treats a blank rating as not rated yet", () => {
    const result = parseReportForm(form({ ...valid, driving: "", autonomous: "" }));
    expect(result.ok && result.report.driving).toBeNull();
    expect(result.ok && result.report.autonomous).toBeNull();
  });

  it("lists the four ratings in order", () => {
    expect(RATING_FIELDS.map((f) => f.label)).toEqual(["Driving", "Consistency", "Field Sense", "Autonomous"]);
  });

  it.each([["0"], ["11"], ["7.5"], ["seven"], ["-1"]])("rejects the rating %j", (driving) => {
    expect(parseReportForm(form({ ...valid, driving }))).toEqual({ ok: false, error: "Ratings must be whole numbers from 1 to 10." });
  });

  it("rejects notes over 4000 characters", () => {
    expect(parseReportForm(form({ ...valid, notes: "x".repeat(4001) }))).toEqual({
      ok: false,
      error: "Notes can be at most 4000 characters.",
    });
  });

  it("keeps markup in notes as plain text", () => {
    const notes = "<img src=x onerror=alert(1)>";
    const result = parseReportForm(form({ ...valid, notes }));
    expect(result.ok && result.report.notes).toBe(notes);
  });

  it.each([
    [{ workspaceId: "not-a-uuid" }],
    [{ teamId: "0" }],
    [{ teamId: "abc" }],
    [{ seasonId: "-4" }],
    [{ teamNumber: "96Z<script>" }],
  ])("rejects bad hidden fields %j", (override) => {
    expect(parseReportForm(form({ ...valid, ...override }))).toEqual({
      ok: false,
      error: "Something went wrong with this card. Reload the page and try again.",
    });
  });
});

describe("parseWorkspaceForm", () => {
  it("reads a name and team number", () => {
    expect(parseWorkspaceForm(form({ name: "  Ctrl Z  ", teamLabel: " 96z " }))).toEqual({
      ok: true,
      name: "Ctrl Z",
      teamLabel: "96Z",
    });
  });

  it("allows no team number", () => {
    expect(parseWorkspaceForm(form({ name: "Scouting club", teamLabel: "" }))).toEqual({ ok: true, name: "Scouting club", teamLabel: null });
  });

  it.each([[""], ["   "], ["x".repeat(61)], ["bad\nname"]])("rejects the name %j", (name) => {
    expect(parseWorkspaceForm(form({ name, teamLabel: "" }))).toEqual({
      ok: false,
      error: "Give the workspace a name of up to 60 characters.",
    });
  });

  it.each([["96Z!"], ["123456789"]])("rejects the team number %j", (teamLabel) => {
    expect(parseWorkspaceForm(form({ name: "Ctrl Z", teamLabel }))).toEqual({
      ok: false,
      error: "Team numbers use only letters and numbers, like 96Z.",
    });
  });
});
