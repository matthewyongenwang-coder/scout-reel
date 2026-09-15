/**
 * Options for Supabase's session cookie. The app never runs Supabase in the browser, so
 * page scripts have no reason to read the session: it is httpOnly, and Secure in production.
 */
export const SUPABASE_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

// Supabase stores the session as sb-<project ref>-auth-token, split into .0, .1 and so on when long.
const AUTH_COOKIE = /^sb-[a-z0-9]+-auth-token(\.\d+)?$/;

/**
 * True when the request carries a Supabase session cookie. Without one the visitor is
 * anonymous, so the app skips Supabase entirely and browsing stays fast.
 */
export function hasSupabaseAuthCookie(names: Iterable<string>): boolean {
  for (const name of names) if (AUTH_COOKIE.test(name)) return true;
  return false;
}
