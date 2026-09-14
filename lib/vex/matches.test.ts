import { describe, expect, it } from "vitest";
import fixture from "@/tests/fixtures/vex/matches-64342-div1.json";
import { type ApiMatch, matchesForTeam, nextStartOnField } from "./matches";

const matches = (fixture as { data: ApiMatch[] }).data;
const TEAM_ID = 170597; // 3477B in the recorded fixture

describe("matchesForTeam (recorded event RE-V5RC-26-4342)", () => {
  const result = matchesForTeam(matches, TEAM_ID);

  it("returns exactly the matches the team played in", () => {
    const expected = matches.filter((m) =>
      m.alliances?.some((a) => a.teams?.some((t) => t.team?.id === TEAM_ID)),
    );
    expect(result.length).toBe(expected.length);
    expect(result.length).toBeGreaterThan(0);
  });

  it("sorts matches in play order", () => {
    const known = result
      .map((m) => Date.parse(m.started ?? m.scheduled ?? ""))
      .filter((t) => !Number.isNaN(t));
    expect(known).toEqual([...known].sort((a, b) => a - b));
  });

  it("never lists the team as its own partner or opponent", () => {
    for (const m of result) {
      expect(m.partners).not.toContain("3477B");
      expect(m.opponents).not.toContain("3477B");
    }
  });

  it("counts finished matches as played even though the API scored flag is false", () => {
    expect(matches.every((m) => m.scored === false)).toBe(true);
    expect(result.filter((r) => r.result !== "unplayed").length).toBeGreaterThan(0);
  });

  it("derives win, loss, or tie from scores on played matches", () => {
    for (const m of result.filter((r) => r.result !== "unplayed")) {
      const diff = (m.score ?? 0) - (m.opponentScore ?? 0);
      expect(m.result).toBe(diff > 0 ? "win" : diff < 0 ? "loss" : "tie");
    }
  });
});

describe("nextStartOnField", () => {
  const base = (id: number, field: string, started: string | null): ApiMatch => ({
    id,
    name: `Q${id}`,
    field,
    started,
  });
  const list = [
    base(1, "Field 1", "2026-08-26T10:00:00-04:00"),
    base(2, "Field 2", "2026-08-26T10:02:00-04:00"),
    base(3, "Field 1", "2026-08-26T10:09:00-04:00"),
    base(4, "Field 1", "2026-08-26T10:05:00-04:00"),
    base(5, "Field 1", null),
  ];

  it("finds the earliest later match on the same field", () => {
    expect(nextStartOnField(list, 1)).toBe("2026-08-26T10:05:00-04:00");
  });

  it("returns null for the last match or a match without a start time", () => {
    expect(nextStartOnField(list, 3)).toBeNull();
    expect(nextStartOnField(list, 5)).toBeNull();
  });
});
