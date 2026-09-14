import { describe, expect, it } from "vitest";
import { parseServerEnv } from "./env-schema";

const valid = {
  VEX_API_KEY: "vex-key",
  YOUTUBE_API_KEY: "yt-key",
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
};

describe("parseServerEnv", () => {
  it("returns the parsed values when everything is set", () => {
    expect(parseServerEnv(valid)).toEqual(valid);
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
