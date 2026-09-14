/**
 * One queue for all VEX Events API requests from this server instance.
 * The API has no published rate limit and answers bursts with 403 or 429,
 * so requests start at least `minIntervalMs` apart, identical in-flight
 * requests share one network call, and 403/429 responses back off and retry.
 */

export type QueueOptions = {
  minIntervalMs: number;
  maxRetries: number;
  baseBackoffMs: number;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
};

export type RequestQueue = {
  run(key: string, doFetch: () => Promise<Response>): Promise<Response>;
};

const RETRY_STATUSES = new Set([403, 429]);

export function createRequestQueue(opts: QueueOptions): RequestQueue {
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const now = opts.now ?? Date.now;
  const inflight = new Map<string, Promise<Response>>();
  let chain: Promise<unknown> = Promise.resolve();
  let lastStart = Number.NEGATIVE_INFINITY;

  function throttled(doFetch: () => Promise<Response>): Promise<Response> {
    const run = chain.then(async () => {
      const wait = lastStart + opts.minIntervalMs - now();
      if (wait > 0) await sleep(wait);
      lastStart = now();
      return doFetch();
    });
    chain = run.catch(() => undefined);
    return run;
  }

  async function withRetry(doFetch: () => Promise<Response>): Promise<Response> {
    for (let attempt = 0; ; attempt++) {
      const res = await throttled(doFetch);
      if (!RETRY_STATUSES.has(res.status) || attempt >= opts.maxRetries) return res;
      const retryAfter = Number(res.headers.get("retry-after"));
      const delay =
        Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : opts.baseBackoffMs * 2 ** attempt;
      await sleep(delay);
    }
  }

  return {
    run(key, doFetch) {
      let shared = inflight.get(key);
      if (!shared) {
        shared = withRetry(doFetch).finally(() => inflight.delete(key));
        inflight.set(key, shared);
      }
      // Every caller gets its own clone so one reader cannot consume another's body.
      return shared.then((res) => res.clone());
    },
  };
}
