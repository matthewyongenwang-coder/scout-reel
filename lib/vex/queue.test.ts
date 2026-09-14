import { describe, expect, it } from "vitest";
import { createRequestQueue } from "./queue";

function fakeClock() {
  let t = 0;
  const sleeps: number[] = [];
  return {
    now: () => t,
    sleep: async (ms: number) => {
      sleeps.push(ms);
      t += ms;
    },
    sleeps,
  };
}

const ok = (body = "ok", status = 200, headers: Record<string, string> = {}) =>
  new Response(body, { status, headers });

describe("createRequestQueue", () => {
  it("starts requests at least minIntervalMs apart", async () => {
    const clock = fakeClock();
    const queue = createRequestQueue({ minIntervalMs: 1000, maxRetries: 0, baseBackoffMs: 500, ...clock });
    const starts: number[] = [];
    const call = (key: string) =>
      queue.run(key, async () => {
        starts.push(clock.now());
        return ok();
      });
    await Promise.all([call("a"), call("b"), call("c")]);
    expect(starts).toEqual([0, 1000, 2000]);
  });

  it("shares one network call between identical in-flight requests", async () => {
    const clock = fakeClock();
    const queue = createRequestQueue({ minIntervalMs: 0, maxRetries: 0, baseBackoffMs: 500, ...clock });
    let calls = 0;
    const doFetch = async () => {
      calls++;
      return ok("shared");
    };
    const [a, b] = await Promise.all([queue.run("same", doFetch), queue.run("same", doFetch)]);
    expect(calls).toBe(1);
    expect(await a.text()).toBe("shared");
    expect(await b.text()).toBe("shared");
  });

  it("backs off exponentially on 429 and 403, then succeeds", async () => {
    const clock = fakeClock();
    const queue = createRequestQueue({ minIntervalMs: 0, maxRetries: 3, baseBackoffMs: 500, ...clock });
    const statuses = [429, 403, 200];
    const res = await queue.run("k", async () => ok("x", statuses.shift()!));
    expect(res.status).toBe(200);
    expect(clock.sleeps).toEqual([500, 1000]);
  });

  it("honors Retry-After in seconds", async () => {
    const clock = fakeClock();
    const queue = createRequestQueue({ minIntervalMs: 0, maxRetries: 1, baseBackoffMs: 500, ...clock });
    const responses = [ok("slow down", 429, { "retry-after": "7" }), ok()];
    await queue.run("k", async () => responses.shift()!);
    expect(clock.sleeps).toEqual([7000]);
  });

  it("returns the last error response after maxRetries", async () => {
    const clock = fakeClock();
    const queue = createRequestQueue({ minIntervalMs: 0, maxRetries: 2, baseBackoffMs: 100, ...clock });
    let calls = 0;
    const res = await queue.run("k", async () => {
      calls++;
      return ok("denied", 403);
    });
    expect(res.status).toBe(403);
    expect(calls).toBe(3);
  });

  it("does not retry other errors", async () => {
    const clock = fakeClock();
    const queue = createRequestQueue({ minIntervalMs: 0, maxRetries: 3, baseBackoffMs: 100, ...clock });
    let calls = 0;
    const res = await queue.run("k", async () => {
      calls++;
      return ok("missing", 404);
    });
    expect(res.status).toBe(404);
    expect(calls).toBe(1);
  });
});
