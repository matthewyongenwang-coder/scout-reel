import "server-only";
import { parseServerEnv, type ServerEnv } from "./env-schema";

let cached: ServerEnv | undefined;

/** Read lazily so builds and tests without secrets still work until a key is needed. */
export function serverEnv(): ServerEnv {
  cached ??= parseServerEnv(process.env);
  return cached;
}
