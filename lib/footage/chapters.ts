import type { MatchTiming } from "@/config/seasons";
import { autonClip, type Clip, driverClip } from "./seek";

export type Chapters = { autonStartS: number | null; driverStartS: number | null };

/**
 * Auton and driver segments inside a per-match clip. Chapter times are exact
 * when the uploader added them; otherwise estimate from the start of the clip.
 */
export function segmentsFromChapters(chapters: Chapters, timing: MatchTiming): { auton: Clip; driver: Clip } {
  const autonStart = chapters.autonStartS ?? 0;
  const driver =
    chapters.driverStartS != null
      ? {
          start: Math.max(0, chapters.driverStartS - timing.leadS),
          end: chapters.driverStartS + timing.driverS + timing.leadS,
        }
      : driverClip(autonStart, timing);
  return { auton: autonClip(autonStart, timing), driver };
}
