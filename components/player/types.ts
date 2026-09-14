import type { VideoRef } from "@/lib/video/platforms";

/**
 * One adapter per video platform. VideoPlayer talks only to this interface, so the
 * sync flow (Set start here, Auton, Driver) works the same on every platform.
 */
export interface PlayerAdapter {
  /** Show a video at its start without playing. */
  cue(video: VideoRef): void;
  /** Play `start` to `end` of a video, loading it first if needed, and pause at `end`. */
  playSegment(video: VideoRef, start: number, end: number): void;
  /** The exact playback position. Async because some platforms only answer through messages. */
  currentTime(): Promise<number | null>;
  /** Last known duration in seconds, or null before the video reports one. */
  duration(): number | null;
  destroy(): void;
}

/** Creates a player inside `mount` showing `video`, resolving once it accepts commands. */
export type AdapterFactory = (mount: HTMLElement, video: VideoRef) => Promise<PlayerAdapter>;
