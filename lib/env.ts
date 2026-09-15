import "server-only";
import { parseServerEnv, type ServerEnv } from "./env-schema";

let cached: ServerEnv | undefined;

/** Accounts stay hidden until the Supabase setup is done and ACCOUNTS_ENABLED is "true". */
export function accountsEnabled(): boolean {
  return process.env.ACCOUNTS_ENABLED === "true";
}

/** Read lazily so builds and tests without secrets still work until a key is needed. */
export function serverEnv(): ServerEnv {
  cached ??= parseServerEnv(process.env);
  return cached;
}
