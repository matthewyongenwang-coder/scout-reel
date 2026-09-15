import "server-only";
import { cookies } from "next/headers";
import { NEXT_PATH_COOKIE, safeNextPath } from "./forms";

/**
 * Where to go after signing in: the page saved when the email was sent, else the given
 * fallback, else the account page. Clears the saved page. Not a server action on purpose.
 */
export async function takeNextPath(fallback: string): Promise<string> {
  const store = await cookies();
  const saved = safeNextPath(store.get(NEXT_PATH_COOKIE)?.value);
  store.delete(NEXT_PATH_COOKIE);
  if (saved !== "/") return saved;
  const given = safeNextPath(fallback);
  return given !== "/" ? given : "/account";
}
