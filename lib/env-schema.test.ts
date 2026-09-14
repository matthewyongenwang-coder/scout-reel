import { describe, expect, it } from "vitest";
import { parseServerEnv } from "./env-schema";

const valid = {
  VEX_API_KEY: "vex-key",
  YOUTUBE_API_KEY: "yt-key",
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
};

describe("parseServerEnv", () => {
  it("returns the parsed values when everything is set, with accounts off by default", () => {
    expect(parseServerEnv(valid)).toEqual({ ...valid, ACCOUNTS_ENABLED: false });
  });

  it("turns accounts on only for the exact value true", () => {
    const site = { NEXT_PUBLIC_SITE_URL: "https://scout-reel-five.vercel.app" };
    expect(parseServerEnv({ ...valid, ...site, ACCOUNTS_ENABLED: "true" }).ACCOUNTS_ENABLED).toBe(true);
    expect(parseServerEnv({ ...valid, ACCOUNTS_ENABLED: "yes" }).ACCOUNTS_ENABLED).toBe(false);
    expect(parseServerEnv({ ...valid, ACCOUNTS_ENABLED: "" }).ACCOUNTS_ENABLED).toBe(false);
  });

  it("reads the site address used in sign-in emails", () => {
    expect(parseServerEnv({ ...valid, NEXT_PUBLIC_SITE_URL: "https://scout-reel-five.vercel.app" }).NEXT_PUBLIC_SITE_URL).toBe(
      "https://scout-reel-five.vercel.app",
    );
    expect(() => parseServerEnv({ ...valid, NEXT_PUBLIC_SITE_URL: "scout-reel" })).toThrow(/NEXT_PUBLIC_SITE_URL/);
  });

  it("requires the site address when accounts are on", () => {
    expect(() => parseServerEnv({ ...valid, ACCOUNTS_ENABLED: "true" })).toThrow(/NEXT_PUBLIC_SITE_URL/);
  });

  it("names every missing variable without printing values", () => {
    expect(() =>
      parseServerEnv({ ...valid, VEX_API_KEY: undefined, NEXT_PUBLIC_SUPABASE_ANON_KEY: "" }),
    ).toThrow(/VEX_API_KEY, NEXT_PUBLIC_SUPABASE_ANON_KEY/);
  });

  it("treats .env.example placeholders as missing", () => {
    expect(() => parseServerEnv({ ...valid, VEX_API_KEY: "your-vex-events-api-key" })).toThrow(/VEX_API_KEY/);
  });

  it("allows the YouTube key to be missing for now", () => {
    expect(parseServerEnv({ ...valid, YOUTUBE_API_KEY: "your-youtube-data-api-key" }).YOUTUBE_API_KEY).toBeUndefined();
  });

  it("rejects a Supabase URL that is not a URL", () => {
    expect(() => parseServerEnv({ ...valid, NEXT_PUBLIC_SUPABASE_URL: "nope" })).toThrow(
      /NEXT_PUBLIC_SUPABASE_URL/,
    );
  });
});
