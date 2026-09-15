import { describe, expect, it } from "vitest";
import { pickActiveWorkspace } from "./active";

const older = { workspaceId: "11111111-1111-4111-8111-111111111111", name: "Ctrl Z", role: "owner" as const, joinedAt: "2026-09-01T00:00:00Z" };
const newer = { workspaceId: "22222222-2222-4222-8222-222222222222", name: "Club", role: "member" as const, joinedAt: "2026-09-10T00:00:00Z" };

describe("pickActiveWorkspace", () => {
  it("has nothing to pick without memberships", () => {
    expect(pickActiveWorkspace([], older.workspaceId)).toBeNull();
  });

  it("uses the workspace saved in the cookie when the user belongs to it", () => {
    expect(pickActiveWorkspace([older, newer], newer.workspaceId)).toBe(newer);
  });

  it("falls back to the oldest membership when the cookie is missing", () => {
    expect(pickActiveWorkspace([newer, older], undefined)).toBe(older);
  });

  it.each([
    ["a workspace the user is not in", "33333333-3333-4333-8333-333333333333"],
    ["garbage", "'; drop table memberships; --"],
    ["an empty value", ""],
  ])("ignores a cookie naming %s", (_, value) => {
    expect(pickActiveWorkspace([newer, older], value)).toBe(older);
  });
});
