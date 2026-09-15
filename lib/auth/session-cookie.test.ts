import { describe, expect, it } from "vitest";
import { hasSupabaseAuthCookie } from "./session-cookie";

describe("hasSupabaseAuthCookie", () => {
  it.each([
    [["sb-abcdefghijklmnop-auth-token"]],
    [["sb-abcdefghijklmnop-auth-token.0", "sb-abcdefghijklmnop-auth-token.1"]],
    [["theme", "sb-abcdefghijklmnop-auth-token"]],
  ])("finds a session cookie in %j", (names) => {
    expect(hasSupabaseAuthCookie(names)).toBe(true);
  });

  it.each([
    [[]],
    [["theme", "sr_ws"]],
    [["sb-abcdefghijklmnop-auth-token-code-verifier"]],
    [["xsb-abcdefghijklmnop-auth-token"]],
    [["sb--auth-token"]],
  ])("finds no session cookie in %j", (names) => {
    expect(hasSupabaseAuthCookie(names)).toBe(false);
  });
});
