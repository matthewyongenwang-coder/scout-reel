import "server-only";
import { Client } from "events.vex";
import { serverEnv } from "@/lib/env";
import { createRequestQueue } from "./queue";

// About 1 request per second is what the community reports the API tolerates.
const queue = createRequestQueue({ minIntervalMs: 1000, maxRetries: 3, baseBackoffMs: 2000 });

let client: ReturnType<typeof Client> | undefined;

/** Shared VEX Events API client. Every network request goes through the queue. */
export function vex() {
  client ??= Client({
    authorization: { token: serverEnv().VEX_API_KEY },
    request: {
      fetch: (request: Request) => queue.run(request.url, () => fetch(request.clone())),
    },
  });
  return client;
}
