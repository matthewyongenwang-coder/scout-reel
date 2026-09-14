"use client";

import { type Ref, useEffect, useImperativeHandle, useRef } from "react";

type YTPlayer = {
  cueVideoById(id: string): void;
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

export type PlayerHandle = {
  /** Seek to `start`, play, and pause at `end` unless the viewer moves elsewhere. */
  playSegment(start: number, end: number): void;
  currentTime(): number | null;
  duration(): number | null;
};

export function YouTubePlayer({ videoId, ref }: { videoId: string | null; ref?: Ref<PlayerHandle> }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const readyRef = useRef(false);
  const loadedIdRef = useRef<string | null>(null);
  const stopTimerRef = useRef<number | null>(null);

  useEffect(() => {
    // Any clip still being watched belongs to the previous video or player.
    if (stopTimerRef.current !== null) {
      window.clearInterval(stopTimerRef.current);
      stopTimerRef.current = null;
    }
    if (!videoId) {
      playerRef.current?.destroy();
      playerRef.current = null;
      readyRef.current = false;
      loadedIdRef.current = null;
      return;
    }
    if (playerRef.current) {
      if (loadedIdRef.current !== videoId) {
        playerRef.current.cueVideoById(videoId);
        loadedIdRef.current = videoId;
      }
      return;
    }
    let cancelled = false;
    loadYouTubeApi().then((YT) => {
      if (cancelled || !mountRef.current || playerRef.current) return;
      const target = document.createElement("div");
      mountRef.current.appendChild(target);
      playerRef.current = new YT.Player(target, {
        host: "https://www.youtube-nocookie.com",
        videoId,
        width: "100%",
        height: "100%",
        playerVars: { rel: 0, playsinline: 1 },
        events: {
          onReady: () => {
            readyRef.current = true;
          },
        },
      });
      loadedIdRef.current = videoId;
    });
    return () => {
      cancelled = true;
    };
  }, [videoId]);

  useEffect(
    () => () => {
      if (stopTimerRef.current !== null) window.clearInterval(stopTimerRef.current);
      playerRef.current?.destroy();
      playerRef.current = null;
    },
    [],
  );

  useImperativeHandle(
    ref,
    () => ({
      playSegment(start, end) {
        const player = playerRef.current;
        if (!player || !readyRef.current) return;
        if (stopTimerRef.current !== null) window.clearInterval(stopTimerRef.current);
        player.seekTo(start, true);
        player.playVideo();
        stopTimerRef.current = window.setInterval(() => {
          const t = player.getCurrentTime();
          const movedAway = t < start - 2 || t > end + 5;
          if (t >= end && !movedAway) player.pauseVideo();
          if (t >= end || movedAway) {
            if (stopTimerRef.current !== null) window.clearInterval(stopTimerRef.current);
            stopTimerRef.current = null;
          }
        }, 250);
      },
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
      {videoId ? (
        <div ref={mountRef} className="absolute inset-0 [&_iframe]:h-full [&_iframe]:w-full" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-stone-300">
          Paste the event livestream link below to watch this team&apos;s matches.
        </div>
      )}
    </div>
  );
}
