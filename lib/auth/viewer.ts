import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { accountsEnabled } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasSupabaseAuthCookie } from "./session-cookie";

export type Viewer = { userId: string; email: string | null };

/**
 * The signed-in user for this request, or null. Visitors without a session cookie never
 * cause a Supabase call. Reads cookies, so callers must sit inside a Suspense boundary.
 */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  if (!accountsEnabled()) return null;
  const store = await cookies();
  if (!hasSupabaseAuthCookie(store.getAll().map((c) => c.name))) return null;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims || typeof claims.sub !== "string") return null;
  return { userId: claims.sub, email: typeof claims.email === "string" ? claims.email : null };
});
