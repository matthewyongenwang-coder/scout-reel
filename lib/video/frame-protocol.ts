/**
 * Messages between the app and a sandboxed player frame. The frame has an opaque origin,
 * so both sides check the sending window and accept only these exact shapes.
 */
import { ID_PATTERNS } from "./platforms";

export const FRAME_SOURCE = "scout-reel-player";

export type FrameCommand =
  | { kind: "load"; id: string; start: number }
  | { kind: "seek"; seconds: number }
  | { kind: "play" }
  | { kind: "pause" }
  | { kind: "time"; requestId: number };

export type FrameReport =
  | { kind: "ready" }
  | { kind: "time"; requestId: number; seconds: number | null }
  | { kind: "progress"; seconds: number; duration: number | null }
  | { kind: "error"; message: string };

const ERROR_MESSAGE = /^[A-Za-z0-9 .,'()-]{1,200}$/;

const isSeconds = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0;
const isRequestId = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v >= 0;

function envelope(data: unknown): Record<string, unknown> | null {
  if (typeof data !== "object" || data === null || Array.isArray(data)) return null;
  const record = data as Record<string, unknown>;
  return record.source === FRAME_SOURCE && typeof record.kind === "string" ? record : null;
}

export const commandMessage = (command: FrameCommand) => ({ source: FRAME_SOURCE, ...command });
export const reportMessage = (report: FrameReport) => ({ source: FRAME_SOURCE, ...report });

export function parseCommand(data: unknown): FrameCommand | null {
  const m = envelope(data);
  if (!m) return null;
  switch (m.kind) {
    case "load":
      return typeof m.id === "string" && ID_PATTERNS.boxcast.test(m.id) && isSeconds(m.start)
        ? { kind: "load", id: m.id, start: m.start }
        : null;
    case "seek":
      return isSeconds(m.seconds) ? { kind: "seek", seconds: m.seconds } : null;
    case "play":
      return { kind: "play" };
    case "pause":
      return { kind: "pause" };
    case "time":
      return isRequestId(m.requestId) ? { kind: "time", requestId: m.requestId } : null;
    default:
      return null;
  }
}

export function parseReport(data: unknown): FrameReport | null {
  const m = envelope(data);
  if (!m) return null;
  switch (m.kind) {
    case "ready":
      return { kind: "ready" };
    case "time":
      return isRequestId(m.requestId) && (m.seconds === null || isSeconds(m.seconds))
        ? { kind: "time", requestId: m.requestId, seconds: m.seconds }
        : null;
    case "progress":
      return isSeconds(m.seconds) && (m.duration === null || isSeconds(m.duration))
        ? { kind: "progress", seconds: m.seconds, duration: m.duration }
        : null;
    case "error":
      return typeof m.message === "string" && ERROR_MESSAGE.test(m.message)
        ? { kind: "error", message: m.message }
        : null;
    default:
      return null;
  }
}
