import { z } from "zod";

/**
 * Environment variables. Only NEXT_PUBLIC_* values may reach the browser;
 * the VEX and YouTube keys are server-only and must never be renamed to NEXT_PUBLIC_*.
 */
export const serverEnvSchema = z.object({
  VEX_API_KEY: z.string().min(1),
  YOUTUBE_API_KEY: z.string().min(1),
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
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
