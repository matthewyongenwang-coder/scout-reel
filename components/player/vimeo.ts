import { segmentStep, vimeoEmbedSrc } from "@/lib/video/embed";
import { sameVideo, type VideoRef } from "@/lib/video/platforms";
import { loadScript } from "./load-script";
import type { AdapterFactory, PlayerAdapter } from "./types";

type VimeoPlayer = {
  ready(): Promise<void>;
  play(): Promise<void>;
  pause(): Promise<void>;
  getCurrentTime(): Promise<number>;
  setCurrentTime(seconds: number): Promise<number>;
  getDuration(): Promise<number>;
  on(event: "timeupdate" | "loaded", callback: (data: { seconds: number; duration: number }) => void): void;
  destroy(): Promise<void>;
};

type VimeoNamespace = { Player: new (element: HTMLIFrameElement) => VimeoPlayer };

declare global {
  interface Window {
    Vimeo?: VimeoNamespace;
  }
}

const quiet = (promise: Promise<unknown> | undefined) => promise?.catch(() => undefined);

export const createVimeoAdapter: AdapterFactory = async (mount, first) => {
  await loadScript("https://player.vimeo.com/api/player.js");
  const Vimeo: VimeoNamespace | undefined = window.Vimeo;
  if (!Vimeo) throw new Error("Vimeo player did not load");

  let current: VideoRef = first;
  let iframe: HTMLIFrameElement | null = null;
  let player: VimeoPlayer | null = null;
  let lastDuration: number | null = null;
  // Each playSegment call gets a number, so a slower earlier call cannot start playback late.
  let segment: { start: number; end: number } | null = null;
  let segmentCount = 0;

  async function show(video: VideoRef) {
    void quiet(player?.destroy());
    iframe?.remove();
    current = video;
    lastDuration = null;
    segment = null;
    const frame = document.createElement("iframe");
    frame.src = vimeoEmbedSrc(video);
    frame.title = "Vimeo video player";
    frame.allow = "autoplay; fullscreen; picture-in-picture; encrypted-media";
    frame.className = "h-full w-full";
    mount.appendChild(frame);
    iframe = frame;
    // Built from our own iframe, so the SDK never fetches oEmbed data from vimeo.com.
    const created = new Vimeo!.Player(frame);
    player = created;
    created.on("loaded", ({ duration }) => {
      if (player === created && duration > 0) lastDuration = duration;
    });
    created.on("timeupdate", ({ seconds, duration }) => {
      if (player !== created) return;
      if (duration > 0) lastDuration = duration;
      if (!segment) return;
      const step = segmentStep(seconds, segment.start, segment.end);
      if (step === "pause") void quiet(created.pause());
      if (step !== "wait") segment = null;
    });
    await created.ready();
    const duration = await created.getDuration().catch(() => 0);
    if (player === created && duration > 0) lastDuration = duration;
  }

  await show(first);

  return {
    cue(video) {
      segmentCount++;
      segment = null;
      if (!sameVideo(video, current)) void quiet(show(video));
    },
    playSegment(video, start, end) {
      const id = ++segmentCount;
      segment = null;
      void (async () => {
        if (!sameVideo(video, current)) await show(video);
        if (id !== segmentCount || !player) return;
        await player.setCurrentTime(start);
        if (id !== segmentCount) return;
        segment = { start, end };
        // Browsers can refuse to start playback without a tap; the viewer can then press play.
        await player.play();
      })().catch(() => undefined);
    },
    async currentTime() {
      return player ? player.getCurrentTime().catch(() => null) : null;
    },
    duration: () => lastDuration,
    destroy() {
      segmentCount++;
      segment = null;
      void quiet(player?.destroy());
      iframe?.remove();
      player = null;
      iframe = null;
    },
  } satisfies PlayerAdapter;
};
