import { boxcastFrameSrc, segmentStep } from "@/lib/video/embed";
import { commandMessage, type FrameCommand, type FrameReport, parseReport } from "@/lib/video/frame-protocol";
import { sameVideo, type VideoRef } from "@/lib/video/platforms";
import type { AdapterFactory, PlayerAdapter } from "./types";

const READY_TIMEOUT_MS = 20_000;
const TIME_TIMEOUT_MS = 1_000;

/**
 * BoxCast's player runs inside the page it is embedded in, so it is loaded in a
 * sandboxed frame without same-origin access. It cannot read this site's cookies or
 * storage, and the two sides only exchange the validated messages in frame-protocol.
 */
export const createBoxCastAdapter: AdapterFactory = async (mount, first) => {
  let current: VideoRef = first;
  let frame: HTMLIFrameElement | null = null;
  let ready: Promise<void> = Promise.resolve();
  let isReady = false;
  let lastTime: number | null = null;
  let lastDuration: number | null = null;
  let segment: { start: number; end: number } | null = null;
  let segmentCount = 0;
  let requestCount = 0;
  const timeRequests = new Map<number, (seconds: number | null) => void>();
  let settle: { resolve: () => void; reject: (error: Error) => void } | null = null;

  const send = (command: FrameCommand) => {
    if (isReady) frame?.contentWindow?.postMessage(commandMessage(command), "*");
  };

  function handle(report: FrameReport) {
    switch (report.kind) {
      case "ready":
        isReady = true;
        settle?.resolve();
        settle = null;
        break;
      case "progress": {
        lastTime = report.seconds;
        if (report.duration !== null) lastDuration = report.duration;
        if (!segment) break;
        const step = segmentStep(report.seconds, segment.start, segment.end);
        if (step === "pause") send({ kind: "pause" });
        if (step !== "wait") segment = null;
        break;
      }
      case "time":
        timeRequests.get(report.requestId)?.(report.seconds);
        timeRequests.delete(report.requestId);
        break;
      case "error":
        settle?.reject(new Error(report.message));
        settle = null;
        break;
    }
  }

  const listener = (event: MessageEvent) => {
    // The frame's origin is opaque ("null"), so the sending window is what identifies it.
    if (!frame || event.source !== frame.contentWindow) return;
    const report = parseReport(event.data);
    if (report) handle(report);
  };
  window.addEventListener("message", listener);

  function show(video: VideoRef): Promise<void> {
    settle?.reject(new Error("replaced"));
    frame?.remove();
    current = video;
    isReady = false;
    lastTime = null;
    lastDuration = null;
    segment = null;
    const element = document.createElement("iframe");
    element.src = boxcastFrameSrc(video);
    element.title = "BoxCast video player";
    element.setAttribute("sandbox", "allow-scripts");
    element.allow = "autoplay; fullscreen";
    element.referrerPolicy = "no-referrer";
    element.className = "h-full w-full";
    mount.appendChild(element);
    frame = element;
    ready = new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error("BoxCast player timed out")), READY_TIMEOUT_MS);
      settle = {
        resolve: () => {
          window.clearTimeout(timeout);
          resolve();
        },
        reject: (error) => {
          window.clearTimeout(timeout);
          reject(error);
        },
      };
    });
    // Callers that care attach their own handlers; this stops a replaced frame's rejection going unhandled.
    ready.catch(() => undefined);
    return ready;
  }

  function removeFrame() {
    window.removeEventListener("message", listener);
    frame?.remove();
    frame = null;
  }

  try {
    await show(first);
  } catch (error) {
    removeFrame();
    throw error;
  }

  return {
    cue(video) {
      segmentCount++;
      segment = null;
      if (!sameVideo(video, current)) void show(video).catch(() => undefined);
    },
    playSegment(video, start, end) {
      const id = ++segmentCount;
      segment = null;
      void (async () => {
        await (sameVideo(video, current) ? ready : show(video));
        if (id !== segmentCount) return;
        send({ kind: "seek", seconds: start });
        send({ kind: "play" });
        segment = { start, end };
      })().catch(() => undefined);
    },
    currentTime() {
      if (!isReady) return Promise.resolve(null);
      const requestId = ++requestCount;
      return new Promise<number | null>((resolve) => {
        const timeout = window.setTimeout(() => {
          timeRequests.delete(requestId);
          resolve(lastTime);
        }, TIME_TIMEOUT_MS);
        timeRequests.set(requestId, (seconds) => {
          window.clearTimeout(timeout);
          resolve(seconds);
        });
        send({ kind: "time", requestId });
      });
    },
    duration: () => lastDuration,
    destroy() {
      segmentCount++;
      segment = null;
      // Clears the ready timeout of a frame that never finished loading.
      settle?.reject(new Error("destroyed"));
      settle = null;
      window.removeEventListener("message", listener);
      timeRequests.forEach((resolve) => resolve(null));
      timeRequests.clear();
      frame?.remove();
      frame = null;
    },
  } satisfies PlayerAdapter;
};
