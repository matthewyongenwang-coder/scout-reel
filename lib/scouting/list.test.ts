import { describe, expect, it } from "vitest";
import { averageRating, filterReports, type ReportSummary, sortReports } from "./list";

const report = (overrides: Partial<ReportSummary>): ReportSummary => ({
  teamId: 1,
  teamNumber: "1A",
  seasonId: 204,
  driving: null,
  consistency: null,
  fieldSense: null,
  autonomous: null,
  notes: "",
  updatedAt: "2026-09-14T10:00:00Z",
  ...overrides,
});

describe("averageRating", () => {
  it("averages the ratings that are filled in, to one decimal place", () => {
    expect(averageRating(report({ driving: 7, consistency: 6, fieldSense: 8, autonomous: 5 }))).toBe(6.5);
    expect(averageRating(report({ driving: 9, autonomous: 6 }))).toBe(7.5);
    expect(averageRating(report({ driving: 7, consistency: 7, fieldSense: 8 }))).toBe(7.3);
  });

  it("has no average before anything is rated", () => {
    expect(averageRating(report({}))).toBeNull();
  });
});

describe("filterReports", () => {
  const reports = [
    report({ teamId: 1, teamNumber: "96Z", notes: "Fast cycles, weak auton" }),
    report({ teamId: 2, teamNumber: "1698V", notes: "Great defence" }),
    report({ teamId: 3, teamNumber: "2131N", notes: "" }),
  ];

  it("returns everything for an empty search", () => {
    expect(filterReports(reports, "   ")).toHaveLength(3);
  });

  it.each([
    ["96z", [1]],
    ["1698", [2]],
    ["DEFENCE", [2]],
    ["auton", [1]],
    ["nothing matches", []],
  ])("finds %s by team number or notes", (query, ids) => {
    expect(filterReports(reports, query).map((r) => r.teamId)).toEqual(ids);
  });
});

describe("sortReports", () => {
  const a = report({ teamId: 1, teamNumber: "96Z", driving: 5, updatedAt: "2026-09-10T00:00:00Z" });
  const b = report({ teamId: 2, teamNumber: "1698V", driving: 9, updatedAt: "2026-09-12T00:00:00Z" });
  const c = report({ teamId: 3, teamNumber: "2131N", updatedAt: "2026-09-11T00:00:00Z" });

  it("puts the most recently updated first", () => {
    expect(sortReports([a, b, c], "recent").map((r) => r.teamId)).toEqual([2, 3, 1]);
  });

  it("puts the highest average first, with unrated teams last", () => {
    expect(sortReports([a, c, b], "rating").map((r) => r.teamId)).toEqual([2, 1, 3]);
  });

  it("orders team numbers naturally", () => {
    expect(sortReports([b, c, a], "team").map((r) => r.teamNumber)).toEqual(["96Z", "1698V", "2131N"]);
  });

  it("does not change the list it was given", () => {
    const list = [a, b, c];
    sortReports(list, "rating");
    expect(list.map((r) => r.teamId)).toEqual([1, 2, 3]);
  });
});
