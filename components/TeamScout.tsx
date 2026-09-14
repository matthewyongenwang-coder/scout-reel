"use client";

import { type FormEvent, Suspense, use, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { MatchTiming } from "@/config/seasons";
import { segmentsFromChapters } from "@/lib/footage/chapters";
import { autonClip, driverClip, seekSeconds } from "@/lib/footage/seek";
import { streamStartFromAnchor } from "@/lib/footage/sync";
import { formatClock, formatEventDates } from "@/lib/format";
import { parseVideoLink } from "@/lib/video/parse";
import { sameVideo, type VideoRef } from "@/lib/video/platforms";
import { readSync, type StoredSync, writeSync } from "@/lib/video/sync-storage";
import type { TeamMatch } from "@/lib/vex/matches";
import { inputClass, primaryButtonClass, secondaryButtonClass } from "./ui";
import { type PlayerHandle, type PlayRequest, VideoPlayer } from "./VideoPlayer";

export type MatchClip = { videoId: string; autonStartS: number | null; driverStartS: number | null };
export type ClipsResult = { status: "ready" | "unavailable"; clips: Record<number, MatchClip> };
export type ScoutEvent = { sku: string; name: string; start: string | null; end: string | null; matches: TeamMatch[] };

type Part = "auton" | "driver";
type Syncs = Record<string, StoredSync | null>;

type RowActions = {
  onPlay: (match: TeamMatch, part: Part, event: ScoutEvent, clip: MatchClip | null) => void;
  onSetStart: (match: TeamMatch, event: ScoutEvent) => void;
};

const CHANGE_EVENT = "scout-reel-sync-change";
const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

function storedSync(sku: string): StoredSync | null {
  try {
    return readSync(window.localStorage, sku);
  } catch {
    return null;
  }
}

function resultText(m: TeamMatch): string {
  if (m.result === "unplayed") return "Not played yet";
  const verb = m.result === "win" ? "Won" : m.result === "loss" ? "Lost" : "Tied";
  return `${verb} ${m.score} to ${m.opponentScore}`;
}

function eventSummary(event: ScoutEvent): string {
  const played = event.matches.filter((m) => m.result !== "unplayed");
  const wins = played.filter((m) => m.result === "win").length;
  const losses = played.filter((m) => m.result === "loss").length;
  const ties = played.length - wins - losses;
  const parts = [formatEventDates(event.start, event.end), count(event.matches.length, "match", "matches")];
  if (played.length > 0) {
    parts.push(count(wins, "win", "wins"), count(losses, "loss", "losses"));
    if (ties > 0) parts.push(count(ties, "tie", "ties"));
  }
  return parts.join(", ");
}

export function TeamScout({
  events,
  timing,
  focusSku,
  clipsPromise,
}: {
  /** Events this team has played this season, newest first. */
  events: ScoutEvent[];
  timing: MatchTiming;
  /** The event being scouted for, if the team was opened from an event page. */
  focusSku: string | null;
  clipsPromise: Promise<ClipsResult>;
}) {
  const skus = useMemo(() => events.map((e) => e.sku), [events]);
  // A string snapshot, so the store only reports a change when stored values really change.
  const snapshot = useSyncExternalStore(
    subscribe,
    () => JSON.stringify(skus.map(storedSync)),
    () => "[]",
  );
  // Fallback when the browser blocks storage, so syncing still works for this visit.
  const [memory, setMemory] = useState<Syncs>({});
  const syncs = useMemo(() => {
    const stored = JSON.parse(snapshot) as (StoredSync | null)[];
    const result: Syncs = {};
    skus.forEach((sku, i) => {
      result[sku] = sku in memory ? memory[sku] : (stored[i] ?? null);
    });
    return result;
  }, [snapshot, skus, memory]);

  const [streamSku, setStreamSku] = useState<string | null>(
    focusSku && skus.includes(focusSku) ? focusSku : (skus[0] ?? null),
  );
  const streamEvent = events.find((e) => e.sku === streamSku) ?? null;
  const streamSync = streamSku ? (syncs[streamSku] ?? null) : null;

  const [request, setRequest] = useState<PlayRequest | null>(null);
  const [link, setLink] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<number | null>(null);
  const player = useRef<PlayerHandle>(null);
  const linkInput = useRef<HTMLInputElement>(null);

  const currentVideo = request?.video ?? streamSync?.video ?? null;
  const matchCount = events.reduce((n, e) => n + e.matches.length, 0);

  function save(sku: string, next: StoredSync | null) {
    try {
      writeSync(window.localStorage, sku, next);
      window.dispatchEvent(new Event(CHANGE_EVENT));
    } catch {
      // Storage unavailable; keep the value in memory for this visit instead.
      setMemory((prev) => ({ ...prev, [sku]: next }));
    }
  }

  function startPlayback(video: VideoRef, start: number, end: number) {
    setRequest((prev) => ({ video, start, end, nonce: (prev?.nonce ?? 0) + 1 }));
  }

  function chooseStreamEvent(sku: string) {
    setStreamSku(sku);
    setRequest(null);
    setLinkError(null);
  }

  function loadVideo(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!streamSku || !streamEvent) return;
    const parsed = parseVideoLink(link);
    if (!parsed.ok) {
      setLinkError(parsed.error);
      return;
    }
    setLinkError(null);
    setLink("");
    setRequest(null);
    setMessage(
      `Livestream loaded for ${streamEvent.name}. Play it to the moment any of its matches starts, then press Set start here on that match.`,
    );
    const keepStart = sameVideo(streamSync?.video, parsed.video) ? (streamSync?.streamStart ?? null) : null;
    save(streamSku, { video: parsed.video, streamStart: keepStart });
  }

  async function setStart(m: TeamMatch, event: ScoutEvent) {
    if (!m.started) return;
    const sync = syncs[event.sku];
    if (event.sku !== streamSku || !sync) {
      chooseStreamEvent(event.sku);
      if (sync) {
        setMessage(`Showing the livestream for ${event.name}. Play it to the start of ${m.name}, then press Set start here again.`);
      } else {
        setMessage(`Paste the livestream link for ${event.name} in the Watch from a livestream box first.`);
        linkInput.current?.focus();
      }
      return;
    }
    if (!sameVideo(currentVideo, sync.video)) {
      setRequest(null);
      setMessage(`Switched back to the livestream. Play it to the start of ${m.name}, then press Set start here again.`);
      return;
    }
    const t = (await player.current?.currentTime()) ?? null;
    if (t == null) {
      setMessage("Start playing the livestream first, then press Set start here.");
      return;
    }
    const streamStart = streamStartFromAnchor(m.started, t);
    if (!streamStart) return;
    save(event.sku, { video: sync.video, streamStart });
    setActiveId(m.id);
    setMessage(`Synced. ${m.name} starts at ${formatClock(t)} in this video, so the other matches from ${event.name} now line up.`);
  }

  function play(m: TeamMatch, part: Part, event: ScoutEvent, clip: MatchClip | null) {
    if (clip) {
      const segment = segmentsFromChapters(clip, timing)[part];
      setActiveId(m.id);
      setMessage(null);
      startPlayback({ platform: "youtube", id: clip.videoId }, segment.start, segment.end);
      return;
    }
    const sync = syncs[event.sku];
    if (event.sku !== streamSku) setStreamSku(event.sku);
    if (!sync?.streamStart) {
      setRequest(null);
      if (sync) {
        setMessage(
          `The livestream for ${event.name} is loaded but not synced. Play it to the start of any of its matches and press Set start here on that match.`,
        );
      } else {
        setMessage(
          `${m.name} has no clip. To watch it, paste the livestream link for ${event.name} in the Watch from a livestream box and sync it once.`,
        );
        linkInput.current?.focus();
      }
      return;
    }
    const seek = seekSeconds(m.started, sync.streamStart);
    const duration = sameVideo(currentVideo, sync.video) ? (player.current?.duration() ?? null) : null;
    if (seek === null || (duration !== null && seek > duration)) {
      setMessage(`${m.name} is not in this livestream. It may be on a different stream or day of ${event.name}.`);
      return;
    }
    const segment = part === "auton" ? autonClip(seek, timing) : driverClip(seek, timing);
    setActiveId(m.id);
    setMessage(null);
    startPlayback(sync.video, segment.start, segment.end);
  }

  const actions: RowActions = {
    onPlay: play,
    onSetStart: (m, event) => {
      void setStart(m, event);
    },
  };
  const listProps = { events, syncs, activeId, focusSku, actions };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px] lg:grid-rows-[auto_1fr]">
      <div className="sticky top-0 z-10 bg-background pb-2 lg:static lg:col-start-1 lg:row-start-1 lg:pb-0">
        <VideoPlayer video={streamSync?.video ?? null} request={request} ref={player} />
        {message ? (
          <p className="mt-2 text-sm text-muted" aria-live="polite">
            {message}
          </p>
        ) : null}
      </div>

      <section aria-labelledby="matches-heading" className="flex flex-col gap-3 lg:col-start-2 lg:row-span-2 lg:row-start-1">
        <h2 id="matches-heading" className="text-lg font-semibold">
          Matches this season <span className="font-normal text-muted">({matchCount})</span>
        </h2>
        {events.length === 0 ? (
          <p className="text-sm text-muted">No matches have been recorded for this team this season yet.</p>
        ) : (
          <Suspense fallback={<SeasonMatches {...listProps} result={null} />}>
            <SeasonMatchesWithClips {...listProps} promise={clipsPromise} />
          </Suspense>
        )}
      </section>

      {events.length > 0 ? (
        <section
          aria-labelledby="stream-heading"
          className="flex flex-col gap-3 rounded-md border border-line bg-panel p-4 lg:col-start-1 lg:row-start-2 lg:self-start"
        >
          <h2 id="stream-heading" className="font-semibold">
            Watch from a livestream
          </h2>
          <p className="text-sm text-muted">
            Robot Stats clips cover most Signature event matches. For any other match, load that event&apos;s livestream
            here, play it to the moment one of its matches starts, and press Set start here on that match. The other
            matches from that event on the same stream then line up.
          </p>
          <p className="text-sm text-muted">
            Links that work: YouTube videos and livestreams, Twitch past broadcasts, Vimeo videos, and BoxCast
            broadcasts.
          </p>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Event</span>
            <select
              value={streamSku ?? ""}
              onChange={(e) => chooseStreamEvent(e.target.value)}
              className={inputClass}
            >
              {events.map((e) => (
                <option key={e.sku} value={e.sku}>
                  {e.name}
                </option>
              ))}
            </select>
          </label>
          <form onSubmit={loadVideo} className="flex flex-col gap-2 sm:flex-row">
            <label htmlFor="video-link" className="sr-only">
              Livestream link for the selected event
            </label>
            <input
              ref={linkInput}
              id="video-link"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="Paste a YouTube, Twitch, Vimeo or BoxCast link"
              className={inputClass}
              autoComplete="off"
              aria-invalid={linkError ? true : undefined}
              aria-describedby={linkError ? "video-link-error" : undefined}
            />
            <button type="submit" className={primaryButtonClass}>
              Load livestream
            </button>
          </form>
          {linkError ? (
            <p id="video-link-error" role="alert" className="text-sm text-alliance-red">
              {linkError}
            </p>
          ) : null}
          <p className="text-sm">
            {!streamSync
              ? "No livestream loaded for this event."
              : streamSync.streamStart
                ? "Livestream synced for this event."
                : "Livestream loaded for this event, not synced yet."}
          </p>
          {streamSync && streamSku ? (
            <button
              type="button"
              onClick={() => {
                save(streamSku, null);
                setRequest(null);
              }}
              className={`${secondaryButtonClass} self-start`}
            >
              Remove livestream
            </button>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

type SeasonMatchesProps = {
  events: ScoutEvent[];
  syncs: Syncs;
  activeId: number | null;
  focusSku: string | null;
  actions: RowActions;
};

function SeasonMatchesWithClips({ promise, ...props }: SeasonMatchesProps & { promise: Promise<ClipsResult> }) {
  const result = use(promise);
  return <SeasonMatches {...props} result={result} />;
}

function eventVideoNote(event: ScoutEvent, result: ClipsResult | null, synced: boolean): string | null {
  if (event.matches.length === 0) return null;
  if (synced) return "Livestream synced. Matches without a clip play from it.";
  if (!result || result.status !== "ready") return null;
  const withClip = event.matches.filter((m) => result.clips[m.id]).length;
  if (withClip === event.matches.length) return "Every match here has a Robot Stats clip.";
  if (withClip === 0) {
    return "No Robot Stats clips for this event. To watch these matches, load its livestream in the Watch from a livestream box.";
  }
  return `${withClip} of ${count(event.matches.length, "match", "matches")} here ${withClip === 1 ? "has" : "have"} a Robot Stats clip. Load the event livestream to watch the rest.`;
}

function SeasonMatches({
  events,
  syncs,
  activeId,
  focusSku,
  actions,
  result,
}: SeasonMatchesProps & { result: ClipsResult | null }) {
  const total = events.reduce((n, e) => n + e.matches.length, 0);
  const withClip = result ? Object.keys(result.clips).length : 0;
  const summary = !result
    ? "Checking Robot Stats for match clips"
    : result.status === "unavailable"
      ? "Match clips could not be checked right now. Livestream sync still works."
      : `${withClip} of ${count(total, "match", "matches")} ${withClip === 1 ? "has" : "have"} a Robot Stats clip`;

  return (
    <>
      <p className="text-sm text-muted" aria-live="polite">
        {summary}
      </p>
      <div className="flex flex-col gap-3">
        {events.map((event, index) => {
          const synced = Boolean(syncs[event.sku]?.streamStart);
          const note = eventVideoNote(event, result, synced);
          return (
            <details
              key={event.sku}
              open={index === 0 || event.sku === focusSku}
              className="rounded-md border border-line"
            >
              <summary className="cursor-pointer px-3 py-2">
                <span className="font-medium">{event.name}</span>
                <span className="block text-xs text-muted">{eventSummary(event)}</span>
              </summary>
              {note ? <p className="px-3 pb-2 text-sm text-muted">{note}</p> : null}
              {event.matches.length === 0 ? (
                <p className="px-3 pb-3 text-sm text-muted">No match results were published for this team at this event.</p>
              ) : (
                <ol className="flex flex-col gap-2 px-3 pb-3">
                  {event.matches.map((m) => (
                    <MatchRow
                      key={m.id}
                      match={m}
                      event={event}
                      clip={result?.clips[m.id] ?? null}
                      active={activeId === m.id}
                      actions={actions}
                    />
                  ))}
                </ol>
              )}
            </details>
          );
        })}
      </div>
    </>
  );
}

function MatchRow({
  match: m,
  event,
  clip,
  active,
  actions,
}: {
  match: TeamMatch;
  event: ScoutEvent;
  clip: MatchClip | null;
  active: boolean;
  actions: RowActions;
}) {
  const playable = Boolean(clip) || Boolean(m.started);
  const note = clip ? "Robot Stats clip" : !m.started ? "No start time recorded, so this match cannot be found in a livestream" : null;

  return (
    <li className={`rounded-md border bg-panel p-3 ${active ? "border-accent" : "border-line"}`}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-medium">{m.name}</span>
        {/* No clock time: the API stamps every match in US Eastern time, not the venue's timezone. */}
        <span className="text-xs text-muted">{m.field ?? ""}</span>
      </div>
      <p className="text-sm">
        <span className={m.color === "red" ? "text-alliance-red" : "text-alliance-blue"}>
          {m.color === "red" ? "Red" : "Blue"}
        </span>
        {m.partners.length ? ` with ${m.partners.join(" and ")}` : ""}
        {m.opponents.length ? ` against ${m.opponents.join(" and ")}` : ""}
      </p>
      <p className="text-sm text-muted">{resultText(m)}</p>
      {note ? <p className="text-xs text-muted">{note}</p> : null}
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          className={secondaryButtonClass}
          disabled={!playable}
          aria-label={`Auton, ${m.name}, ${event.name}`}
          onClick={() => actions.onPlay(m, "auton", event, clip)}
        >
          Auton
        </button>
        <button
          type="button"
          className={secondaryButtonClass}
          disabled={!playable}
          aria-label={`Driver, ${m.name}, ${event.name}`}
          onClick={() => actions.onPlay(m, "driver", event, clip)}
        >
          Driver
        </button>
        {!clip && m.started ? (
          <button
            type="button"
            className={secondaryButtonClass}
            aria-label={`Set start here, ${m.name}, ${event.name}`}
            onClick={() => actions.onSetStart(m, event)}
          >
            Set start here
          </button>
        ) : null}
      </div>
    </li>
  );
}
