"use client";

import { type FormEvent, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { MatchTiming } from "@/config/seasons";
import { autonClip, driverClip, seekSeconds } from "@/lib/footage/seek";
import { streamStartFromAnchor } from "@/lib/footage/sync";
import { parseYouTubeVideoId } from "@/lib/footage/youtube-url";
import { formatClock } from "@/lib/format";
import type { TeamMatch } from "@/lib/vex/matches";
import { inputClass, primaryButtonClass, secondaryButtonClass } from "./ui";
import { type PlayerHandle, YouTubePlayer } from "./YouTubePlayer";

export type ScoutMatch = TeamMatch & { nextStart: string | null };

type SyncState = { videoId: string; streamStart: string | null };

const CHANGE_EVENT = "scout-reel-sync-change";
const storageKey = (sku: string) => `scout-reel.sync.v1.${sku}`;

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

function readRaw(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function parseSync(raw: string | null): SyncState | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<SyncState>;
    if (typeof value.videoId !== "string" || !parseYouTubeVideoId(value.videoId)) return null;
    const streamStart =
      typeof value.streamStart === "string" && !Number.isNaN(Date.parse(value.streamStart)) ? value.streamStart : null;
    return { videoId: value.videoId, streamStart };
  } catch {
    return null;
  }
}

function resultText(m: ScoutMatch): string {
  if (m.result === "unplayed") return "Not played yet";
  const verb = m.result === "win" ? "Won" : m.result === "loss" ? "Lost" : "Tied";
  return `${verb} ${m.score} to ${m.opponentScore}`;
}

export function TeamScout({
  eventSku,
  matches,
  timing,
}: {
  eventSku: string;
  matches: ScoutMatch[];
  timing: MatchTiming;
}) {
  const key = storageKey(eventSku);
  const player = useRef<PlayerHandle>(null);
  const raw = useSyncExternalStore(
    subscribe,
    () => readRaw(key),
    () => null,
  );
  // Fallback when the browser blocks storage, so syncing still works for this visit.
  const [memorySync, setMemorySync] = useState<SyncState | null | undefined>(undefined);
  const storedSync = useMemo(() => parseSync(raw), [raw]);
  const sync = memorySync !== undefined ? memorySync : storedSync;

  const [link, setLink] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<number | null>(null);

  function save(next: SyncState | null) {
    try {
      if (next) window.localStorage.setItem(key, JSON.stringify(next));
      else window.localStorage.removeItem(key);
      window.dispatchEvent(new Event(CHANGE_EVENT));
    } catch {
      // Storage unavailable; keep the value in memory for this visit instead.
      setMemorySync(next);
    }
  }

  function loadVideo(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const videoId = parseYouTubeVideoId(link);
    if (!videoId) {
      setLinkError("That is not a YouTube video link.");
      return;
    }
    setLinkError(null);
    setLink("");
    setMessage("Video loaded. Play it to the moment any match below starts, then press Set start on that match.");
    save({ videoId, streamStart: sync?.videoId === videoId ? sync.streamStart : null });
  }

  function setStart(m: ScoutMatch) {
    const t = player.current?.currentTime();
    if (!sync || t == null || !m.started) {
      setMessage("Start playing the video first, then press Set start here.");
      return;
    }
    const streamStart = streamStartFromAnchor(m.started, t);
    if (!streamStart) return;
    save({ videoId: sync.videoId, streamStart });
    setActiveId(m.id);
    setMessage(`Synced. ${m.name} starts at ${formatClock(t)} in this video. Auton and Driver buttons now jump to each match.`);
  }

  function play(m: ScoutMatch, part: "auton" | "driver") {
    if (!sync?.streamStart) return;
    const seek = seekSeconds(m.started, sync.streamStart);
    const duration = player.current?.duration() ?? null;
    if (seek === null || (duration !== null && seek > duration)) {
      setMessage(`${m.name} is not in this video. It may be on a different stream or day.`);
      return;
    }
    const clip =
      part === "auton"
        ? autonClip(seek, timing)
        : driverClip(seek, timing, { nextMatchSeek: seekSeconds(m.nextStart, sync.streamStart) });
    setActiveId(m.id);
    setMessage(null);
    player.current?.playSegment(clip.start, clip.end);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
      <div className="flex flex-col gap-4">
        <div className="sticky top-0 z-10 bg-background pb-2 lg:static lg:pb-0">
          <YouTubePlayer videoId={sync?.videoId ?? null} ref={player} />
        </div>

        <section className="flex flex-col gap-3 rounded-md border border-line bg-panel p-4" aria-labelledby="sync-heading">
          <h2 id="sync-heading" className="font-semibold">
            Livestream
          </h2>
          <p className="text-sm text-muted">
            Automatic stream finding is coming next. For now, paste the event&apos;s livestream link (usually on the
            Webcast tab of the event page), play it to the start of any match, and press Set start here on that match.
          </p>
          <form onSubmit={loadVideo} className="flex flex-col gap-2 sm:flex-row">
            <label htmlFor="video-link" className="sr-only">
              YouTube livestream link
            </label>
            <input
              id="video-link"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              className={inputClass}
              autoComplete="off"
              aria-invalid={linkError ? true : undefined}
              aria-describedby={linkError ? "video-link-error" : undefined}
            />
            <button type="submit" className={primaryButtonClass}>
              Load video
            </button>
          </form>
          {linkError ? (
            <p id="video-link-error" role="alert" className="text-sm text-alliance-red">
              {linkError}
            </p>
          ) : null}
          <p className="text-sm">
            {!sync
              ? "No video loaded."
              : sync.streamStart
                ? "Synced. Clips are ready."
                : "Video loaded, not synced yet."}
          </p>
          {sync ? (
            <button type="button" onClick={() => save(null)} className={`${secondaryButtonClass} self-start`}>
              Remove video
            </button>
          ) : null}
          {message ? (
            <p className="text-sm text-muted" aria-live="polite">
              {message}
            </p>
          ) : null}
        </section>
      </div>

      <section className="flex flex-col gap-3" aria-labelledby="matches-heading">
        <h2 id="matches-heading" className="text-lg font-semibold">
          Matches at this event <span className="font-normal text-muted">({matches.length})</span>
        </h2>
        {matches.length === 0 ? (
          <p className="text-sm text-muted">This team has no matches at this event yet.</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {matches.map((m) => {
              const canPlay = Boolean(sync?.streamStart && m.started);
              // No clock time: the API stamps every match in US Eastern time, not the venue's timezone.
              const when = m.field ?? "";
              return (
                <li
                  key={m.id}
                  className={`rounded-md border bg-panel p-3 ${activeId === m.id ? "border-accent" : "border-line"}`}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-medium">{m.name}</span>
                    <span className="text-xs text-muted">{when}</span>
                  </div>
                  <p className="text-sm">
                    <span className={m.color === "red" ? "text-alliance-red" : "text-alliance-blue"}>
                      {m.color === "red" ? "Red" : "Blue"}
                    </span>
                    {m.partners.length ? ` with ${m.partners.join(" and ")}` : ""}
                    {m.opponents.length ? ` against ${m.opponents.join(" and ")}` : ""}
                  </p>
                  <p className="text-sm text-muted">
                    {resultText(m)}
                    {m.started ? "" : ", no start time recorded"}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={secondaryButtonClass}
                      disabled={!canPlay}
                      onClick={() => play(m, "auton")}
                    >
                      Auton
                    </button>
                    <button
                      type="button"
                      className={secondaryButtonClass}
                      disabled={!canPlay}
                      onClick={() => play(m, "driver")}
                    >
                      Driver
                    </button>
                    <button
                      type="button"
                      className={secondaryButtonClass}
                      disabled={!sync || !m.started}
                      onClick={() => setStart(m)}
                    >
                      Set start here
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}
