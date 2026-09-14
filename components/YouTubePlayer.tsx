"use client";

import { type Ref, type RefObject, useEffect, useImperativeHandle, useRef } from "react";

type YTPlayer = {
  cueVideoById(id: string): void;
  loadVideoById(options: { videoId: string; startSeconds?: number; endSeconds?: number }): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  playVideo(): void;
  pauseVideo(): void;
  getCurrentTime(): number;
  getDuration(): number;
  destroy(): void;
};

type YTNamespace = {
  Player: new (element: HTMLElement, options: Record<string, unknown>) => YTPlayer;
};

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<YTNamespace> | null = null;

function loadYouTubeApi(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  apiPromise ??= new Promise((resolve) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      if (window.YT) resolve(window.YT);
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    document.head.appendChild(script);
  });
  return apiPromise;
}

/** Play `videoId` from `start` and pause at `end`. A new nonce replays the same segment. */
export type PlayRequest = { videoId: string; start: number; end: number; nonce: number };

export type PlayerHandle = {
  currentTime(): number | null;
  duration(): number | null;
};

function clearStopTimer(stopTimer: RefObject<number | null>) {
  if (stopTimer.current !== null) {
    window.clearInterval(stopTimer.current);
    stopTimer.current = null;
  }
}

function playRequest(
  player: YTPlayer,
  request: PlayRequest,
  loadedId: RefObject<string | null>,
  stopTimer: RefObject<number | null>,
) {
  clearStopTimer(stopTimer);
  if (loadedId.current === request.videoId) {
    player.seekTo(request.start, true);
    player.playVideo();
  } else {
    player.loadVideoById({ videoId: request.videoId, startSeconds: request.start, endSeconds: request.end });
    loadedId.current = request.videoId;
  }
  stopTimer.current = window.setInterval(() => {
    const t = player.getCurrentTime();
    // A freshly loaded video reports 0 until playback begins.
    if (t === 0) return;
    const movedAway = t < request.start - 2 || t > request.end + 5;
    if (t >= request.end && !movedAway) player.pauseVideo();
    if (t >= request.end || movedAway) clearStopTimer(stopTimer);
  }, 250);
}

export function YouTubePlayer({
  videoId,
  request,
  ref,
}: {
  /** Video shown when nothing has been requested, such as the event livestream. */
  videoId: string | null;
  request: PlayRequest | null;
  ref?: Ref<PlayerHandle>;
}) {
  const shownId = request?.videoId ?? videoId;
  const mountRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const readyRef = useRef(false);
  const loadedIdRef = useRef<string | null>(null);
  const stopTimerRef = useRef<number | null>(null);
  const pendingRef = useRef<PlayRequest | null>(null);

  // Declared before the video effect so a requested clip is loaded once, not cued and then loaded.
  useEffect(() => {
    if (!request) {
      // A cancelled request must not play later when the player finishes loading.
      pendingRef.current = null;
      return;
    }
    const player = playerRef.current;
    if (player && readyRef.current) playRequest(player, request, loadedIdRef, stopTimerRef);
    else pendingRef.current = request;
  }, [request]);

  useEffect(() => {
    if (!shownId) {
      clearStopTimer(stopTimerRef);
      playerRef.current?.destroy();
      playerRef.current = null;
      readyRef.current = false;
      loadedIdRef.current = null;
      pendingRef.current = null;
      return;
    }
    if (playerRef.current) {
      if (loadedIdRef.current !== shownId && request?.videoId !== shownId) {
        clearStopTimer(stopTimerRef);
        playerRef.current.cueVideoById(shownId);
        loadedIdRef.current = shownId;
      }
      return;
    }
    let cancelled = false;
    loadYouTubeApi().then((YT) => {
      if (cancelled || !mountRef.current || playerRef.current) return;
      const target = document.createElement("div");
      mountRef.current.appendChild(target);
      loadedIdRef.current = shownId;
      playerRef.current = new YT.Player(target, {
        host: "https://www.youtube-nocookie.com",
        videoId: shownId,
        width: "100%",
        height: "100%",
        playerVars: { rel: 0, playsinline: 1 },
        events: {
          onReady: () => {
            readyRef.current = true;
            const pending = pendingRef.current;
            pendingRef.current = null;
            if (pending && playerRef.current) playRequest(playerRef.current, pending, loadedIdRef, stopTimerRef);
          },
        },
      });
    });
    return () => {
      cancelled = true;
    };
  }, [shownId, request?.videoId]);

  useEffect(
    () => () => {
      clearStopTimer(stopTimerRef);
      playerRef.current?.destroy();
      playerRef.current = null;
    },
    [],
  );

  useImperativeHandle(
    ref,
    () => ({
      currentTime() {
        return readyRef.current && playerRef.current ? playerRef.current.getCurrentTime() : null;
      },
      duration() {
        const d = readyRef.current && playerRef.current ? playerRef.current.getDuration() : 0;
        return d > 0 ? d : null;
      },
    }),
    [],
  );

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-md border border-line bg-black">
      {shownId ? (
        <div ref={mountRef} className="absolute inset-0 [&_iframe]:h-full [&_iframe]:w-full" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-stone-300">
          Press Auton or Driver on a match with a clip, or paste the event livestream link below.
        </div>
      )}
    </div>
  );
}
