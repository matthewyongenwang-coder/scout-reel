import { describe, expect, it } from "vitest";
import eventsFixture from "@/tests/fixtures/vex/team-189332-season204-events.json";
import matchesFixture from "@/tests/fixtures/vex/team-189332-season204-matches.json";
import {
  groupSeason,
  isCurrentOrUpcoming,
  isOngoing,
  type SeasonEvent,
  type SeasonMatch,
  seasonRecord,
} from "./season";

const TEAM_96Z = 189332;
const events = (eventsFixture as { data: SeasonEvent[] }).data;
const matches = (matchesFixture as { data: SeasonMatch[] }).data;

describe("groupSeason (96Z, Override season, recorded 13 Sep 2026)", () => {
  const season = groupSeason(events, matches, TEAM_96Z, "2026-09-13");

  it("lists played events newest first with every match", () => {
    expect(season.played.map((p) => p.event.sku)).toEqual(["RE-V5RC-26-4843", "RE-V5RC-26-4244", "RE-V5RC-26-4431"]);
    expect(season.played.reduce((sum, p) => sum + p.matches.length, 0)).toBe(29);
  });

  it("lists upcoming events soonest first", () => {
    expect(season.upcoming.map((e) => e.sku)).toEqual(["RE-V5RC-26-4246", "RE-V5RC-26-4926", "VE-V5-27-65698"]);
  });

  it("keeps a finished event with no published matches under played", () => {
    const extra: SeasonEvent = { id: 1, sku: "RE-X-26-1", name: "No results", start: "2026-08-01", end: "2026-08-01", level: null };
    const result = groupSeason([...events, extra], matches, TEAM_96Z, "2026-09-13");
    expect(result.played.find((p) => p.event.id === 1)?.matches).toEqual([]);
  });

  it("keeps matches whose event is missing from the team's event list", () => {
    const orphan: SeasonMatch = {
      id: 99901,
      name: "Qualifier #1",
      started: "2026-09-05T10:00:00-04:00",
      event: { id: 999, name: "Unlisted Scrimmage", code: "RE-V5RC-26-9999" },
      alliances: [
        { color: "red", score: 50, teams: [{ team: { id: TEAM_96Z, name: "96Z" } }] },
        { color: "blue", score: 40, teams: [{ team: { id: 1, name: "1A" } }] },
      ],
    };
    const result = groupSeason(events, [...matches, orphan], TEAM_96Z, "2026-09-13");
    const unlisted = result.played.find((p) => p.event.id === 999);
    expect(unlisted?.event).toMatchObject({ sku: "RE-V5RC-26-9999", name: "Unlisted Scrimmage" });
    expect(unlisted?.matches).toHaveLength(1);
    expect(result.played[0].event.id).toBe(999);
  });

  it("treats an event ending today as upcoming", () => {
    const today: SeasonEvent = { id: 2, sku: "RE-X-26-2", name: "Today", start: "2026-09-12", end: "2026-09-13", level: null };
    expect(groupSeason([today], [], TEAM_96Z, "2026-09-13").upcoming).toHaveLength(1);
  });
});

describe("seasonRecord", () => {
  it("counts events with matches and every result", () => {
    const { played } = groupSeason(events, matches, TEAM_96Z, "2026-09-13");
    const record = seasonRecord(played);
    const all = played.flatMap((p) => p.matches);
    expect(record.events).toBe(3);
    expect(record.matches).toBe(29);
    expect(record.wins).toBe(all.filter((m) => m.result === "win").length);
    expect(record.wins + record.losses + record.ties).toBe(all.filter((m) => m.result !== "unplayed").length);
  });
});

describe("isCurrentOrUpcoming", () => {
  const today = "2026-09-13";
  it("keeps a league that started weeks ago but has not ended", () => {
    expect(isCurrentOrUpcoming({ name: "League", start: "2026-08-20T00:00:00-04:00", end: "2026-12-10T00:00:00-05:00" }, today)).toBe(true);
  });

  it("keeps events ending today and drops events that ended yesterday", () => {
    expect(isCurrentOrUpcoming({ name: "A", start: "2026-09-12", end: "2026-09-13T00:00:00-04:00" }, today)).toBe(true);
    expect(isCurrentOrUpcoming({ name: "B", start: "2026-09-11", end: "2026-09-12T00:00:00-04:00" }, today)).toBe(false);
  });

  it("drops canceled events and events with no dates", () => {
    expect(isCurrentOrUpcoming({ name: "CANCELED: Opener", start: "2026-10-01", end: "2026-10-01" }, today)).toBe(false);
    expect(isCurrentOrUpcoming({ name: "No dates", start: null, end: null }, today)).toBe(false);
  });
});

describe("isOngoing", () => {
  it("is true only between the first and last day", () => {
    const event = { start: "2026-09-12T00:00:00-04:00", end: "2026-09-14T00:00:00-04:00" };
    expect(isOngoing(event, "2026-09-11")).toBe(false);
    expect(isOngoing(event, "2026-09-12")).toBe(true);
    expect(isOngoing(event, "2026-09-14")).toBe(true);
    expect(isOngoing(event, "2026-09-15")).toBe(false);
  });
});
