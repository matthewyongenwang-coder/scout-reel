import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_COOKIE_OPTIONS } from "@/lib/auth/session-cookie";
import { serverEnv } from "@/lib/env";

/**
 * A Supabase client for one request, acting as the signed-in user through their session
 * cookie and the public anon key. Row level security decides what it can see. Never
 * shared between requests, and no service key exists anywhere in the app.
 */
export async function createSupabaseServerClient() {
  const env = serverEnv();
  const store = await cookies();
  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookieOptions: SUPABASE_COOKIE_OPTIONS,
    cookies: {
      getAll: () => store.getAll(),
      setAll(list) {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // Called while rendering a Server Component, which cannot set cookies. proxy.ts refreshes sessions.
        }
      },
    },
  });
}
