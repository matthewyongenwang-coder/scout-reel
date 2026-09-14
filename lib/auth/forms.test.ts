import { describe, expect, it } from "vitest";
import { formatInviteCode, normalizeInviteCode, parseOtpForm, parseSignInForm, safeNextPath } from "./forms";

const form = (entries: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
};

describe("safeNextPath", () => {
  it.each([["/"], ["/scouting"], ["/team/141836?event=RE-V5RC-26-5090"], ["/account#workspaces"]])("keeps %s", (path) => {
    expect(safeNextPath(path)).toBe(path);
  });

  it.each([
    ["https://evil.example"],
    ["//evil.example"],
    ["/\\evil.example"],
    ["\\\\evil.example"],
    ["/%2F%2Fevil.example"],
    ["/%5Cevil.example"],
    ["javascript:alert(1)"],
    ["scouting"],
    ["/\tevil"],
    ["/\nevil"],
    [" /scouting"],
    [`/${"a".repeat(300)}`],
    [""],
    [null],
    [undefined],
    [42],
  ])("falls back to the home page for %j", (value) => {
    expect(safeNextPath(value)).toBe("/");
  });
});

describe("invite codes", () => {
  const code = "0123456789abcdef0123456789abcdef";

  it("formats a code in groups of four for reading aloud or copying", () => {
    expect(formatInviteCode(code)).toBe("0123-4567-89ab-cdef-0123-4567-89ab-cdef");
  });

  it.each([[code], [code.toUpperCase()], ["0123-4567-89ab-cdef-0123-4567-89ab-cdef"], [" 0123 4567 89ab cdef 0123 4567 89ab cdef "]])(
    "reads %s",
    (input) => {
      expect(normalizeInviteCode(input)).toBe(code);
    },
  );

  it.each([["short"], [`${code}00`], ["g123456789abcdef0123456789abcdef"], [""], ["x".repeat(500)]])("rejects %s", (input) => {
    expect(normalizeInviteCode(input)).toBeNull();
  });
});

describe("parseSignInForm", () => {
  it("accepts an email with the age box ticked", () => {
    expect(parseSignInForm(form({ email: "  Scout@School.org ", age: "on", next: "/scouting" }))).toEqual({
      ok: true,
      email: "scout@school.org",
      next: "/scouting",
    });
  });

  it("requires the age box", () => {
    expect(parseSignInForm(form({ email: "scout@school.org" }))).toEqual({
      ok: false,
      error: "You need to be 13 or older to make an account. Tick the box to confirm.",
    });
  });

  it.each([["not-an-email"], [""], [`${"a".repeat(250)}@x.org`], ["a@b"]])("rejects the email %j", (email) => {
    expect(parseSignInForm(form({ email, age: "on" }))).toEqual({ ok: false, error: "Enter a valid email address." });
  });

  it("drops an unsafe next path", () => {
    const result = parseSignInForm(form({ email: "scout@school.org", age: "on", next: "//evil.example" }));
    expect(result).toEqual({ ok: true, email: "scout@school.org", next: "/" });
  });
});

describe("parseOtpForm", () => {
  it.each([["123456"], ["12345678"], [" 123 456 "]])("reads the code %j", (code) => {
    const result = parseOtpForm(form({ email: "scout@school.org", code, next: "/account" }));
    expect(result).toEqual({ ok: true, email: "scout@school.org", code: code.replace(/\s/g, ""), next: "/account" });
  });

  it.each([["12345"], ["abcdef"], ["12345678901"], [""]])("rejects the code %j", (code) => {
    expect(parseOtpForm(form({ email: "scout@school.org", code }))).toEqual({
      ok: false,
      error: "Enter the code from the email. It is 6 to 10 digits.",
    });
  });
});
