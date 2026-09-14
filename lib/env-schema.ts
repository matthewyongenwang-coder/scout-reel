import { z } from "zod";

/**
 * Environment variables. Only NEXT_PUBLIC_* values may reach the browser;
 * the VEX and YouTube keys are server-only and must never be renamed to NEXT_PUBLIC_*.
 * Empty values and the "your-..." placeholders from .env.example count as missing.
 */
const unset = (value: unknown) =>
  typeof value === "string" && (value.trim() === "" || value.startsWith("your-")) ? undefined : value;

const required = z.preprocess(unset, z.string().min(1));

export const serverEnvSchema = z
  .object({
    VEX_API_KEY: required,
    // Optional until the footage step; features that need it check for it.
    YOUTUBE_API_KEY: z.preprocess(unset, z.string().min(1).optional()),
    NEXT_PUBLIC_SUPABASE_URL: z.preprocess(unset, z.url()),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: required,
    // Sign in stays hidden until the Supabase project is set up, then this is set to "true".
    ACCOUNTS_ENABLED: z.preprocess((value) => value === "true", z.boolean()),
    // The site address used in sign-in emails. Never taken from the request's Host header.
    NEXT_PUBLIC_SITE_URL: z.preprocess(unset, z.url({ protocol: /^https?$/ }).optional()),
  })
  .refine((env) => !env.ACCOUNTS_ENABLED || env.NEXT_PUBLIC_SITE_URL, {
    path: ["NEXT_PUBLIC_SITE_URL"],
    message: "Required when ACCOUNTS_ENABLED is true",
  });

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function parseServerEnv(source: Record<string, string | undefined>): ServerEnv {
  const result = serverEnvSchema.safeParse(source);
  if (!result.success) {
    const names = result.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`Missing or invalid environment variables: ${names}. See .env.example.`);
  }
  return result.data;
}
