"use client";

import { type Ref, useEffect, useImperativeHandle, useRef, useState } from "react";
import { PLATFORM_NAMES, type Platform, type VideoRef } from "@/lib/video/platforms";
import type { AdapterFactory, PlayerAdapter } from "./player/types";

/** Play `video` from `start` and pause at `end`. A new nonce replays the same segment. */
export type PlayRequest = { video: VideoRef; start: number; end: number; nonce: number };

export type PlayerHandle = {
  currentTime(): Promise<number | null>;
  duration(): number | null;
};

// Each platform's code and third-party script only load when a video from it is shown.
const FACTORIES: Record<Platform, () => Promise<AdapterFactory>> = {
  youtube: () => import("./player/youtube").then((m) => m.createYouTubeAdapter),
  twitch: () => import("./player/twitch").then((m) => m.createTwitchAdapter),
  vimeo: () => import("./player/vimeo").then((m) => m.createVimeoAdapter),
  boxcast: () => import("./player/boxcast").then((m) => m.createBoxCastAdapter),
};

const videoKey = (v: VideoRef | null) => (v ? `${v.platform}:${v.id}:${v.hash ?? ""}` : "");

export function VideoPlayer({
  video,
  request,
  ref,
}: {
  /** Video shown when nothing has been requested, such as the event livestream. */
  video: VideoRef | null;
  request: PlayRequest | null;
  ref?: Ref<PlayerHandle>;
}) {
  const shown = request?.video ?? video;
  const shownKey = videoKey(shown);
  const mountRef = useRef<HTMLDivElement>(null);
  const adapterRef = useRef<{ platform: Platform; adapter: PlayerAdapter } | null>(null);
  const creatingRef = useRef<Platform | null>(null);
  const generationRef = useRef(0);
  const appliedNonceRef = useRef<number | null>(null);
  const latestRef = useRef<{ shown: VideoRef | null; request: PlayRequest | null }>({ shown, request });
  const [failed, setFailed] = useState<Platform | null>(null);

  useEffect(() => {
    latestRef.current = { shown, request };

    function apply(adapter: PlayerAdapter) {
      const { shown: target, request: latest } = latestRef.current;
      if (latest) {
        if (appliedNonceRef.current === latest.nonce) return;
        appliedNonceRef.current = latest.nonce;
        adapter.playSegment(latest.video, latest.start, latest.end);
      } else if (target) {
        adapter.cue(target);
      }
    }

    function teardown() {
      generationRef.current++;
      adapterRef.current?.adapter.destroy();
      adapterRef.current = null;
      creatingRef.current = null;
    }

    if (!request) appliedNonceRef.current = null;
    if (!shown) {
      teardown();
      return;
    }
    if (adapterRef.current?.platform === shown.platform) {
      apply(adapterRef.current.adapter);
      return;
    }
    // A player for this platform is still starting; it applies the latest video when ready.
    if (creatingRef.current === shown.platform) return;

    teardown();
    setFailed(null);
    const platform = shown.platform;
    const generation = generationRef.current;
    creatingRef.current = platform;
    FACTORIES[platform]()
      .then((create) => {
        const mount = mountRef.current;
        // The video may have changed while the platform code loaded; start with the latest one.
        const target = latestRef.current.shown;
        if (generation !== generationRef.current || !mount || target?.platform !== platform) return null;
        return create(mount, target);
      })
      .then((adapter) => {
        if (!adapter) return;
        if (generation !== generationRef.current) {
          adapter.destroy();
          return;
        }
        creatingRef.current = null;
        adapterRef.current = { platform, adapter };
        apply(adapter);
      })
      .catch(() => {
        if (generation !== generationRef.current) return;
        creatingRef.current = null;
        setFailed(platform);
      });
    // shownKey stands in for `shown`, which is a new object on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shownKey, request]);

  useEffect(
    () => () => {
      generationRef.current++;
      adapterRef.current?.adapter.destroy();
      adapterRef.current = null;
    },
    [],
  );

  useImperativeHandle(
    ref,
    () => ({
      currentTime: () => adapterRef.current?.adapter.currentTime() ?? Promise.resolve(null),
      duration: () => adapterRef.current?.adapter.duration() ?? null,
    }),
    [],
  );

  const overlay = "absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-stone-300";
  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-md border border-line bg-black">
      <div ref={mountRef} className="absolute inset-0 [&_iframe]:h-full [&_iframe]:w-full" hidden={!shown} />
      {!shown ? (
        <div className={overlay}>Press Auton or Driver on a match with a clip, or paste the event livestream link below.</div>
      ) : failed === shown.platform ? (
        <div className={`${overlay} bg-black`} role="alert">
          {`The ${PLATFORM_NAMES[failed]} player could not load this video. Check that the link is right and the video is public.`}
        </div>
      ) : null}
    </div>
  );
}
