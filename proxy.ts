import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { hasSupabaseAuthCookie, SUPABASE_COOKIE_OPTIONS } from "@/lib/auth/session-cookie";

/**
 * Keeps a signed-in user's session fresh, since Server Components cannot write cookies.
 * Anonymous visitors, who have no Supabase cookie, pass straight through without any
 * Supabase call. Server actions still check the user themselves; this is not a gate.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (process.env.ACCOUNTS_ENABLED !== "true" || !url || !key) return response;
  if (!hasSupabaseAuthCookie(request.cookies.getAll().map((c) => c.name))) return response;

  const supabase = createServerClient(url, key, {
    cookieOptions: SUPABASE_COOKIE_OPTIONS,
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(list, headers) {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
        // Supabase asks for no caching whenever it writes session cookies.
        for (const [header, value] of Object.entries(headers ?? {})) response.headers.set(header, value);
      },
    },
  });
  // Refreshes an expired access token. Nothing may run between creating the client and this call.
  await supabase.auth.getClaims();
  return response;
}

export const config = {
  // Pages only: skip Next's assets, the sandboxed BoxCast page, and any path with a file extension.
  matcher: ["/((?!_next/static|_next/image|player/boxcast|.*\\..*).*)"],
};
