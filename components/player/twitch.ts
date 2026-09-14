import { segmentStep, twitchOptions } from "@/lib/video/embed";
import { sameVideo, type VideoRef } from "@/lib/video/platforms";
import { loadScript } from "./load-script";
import type { AdapterFactory, PlayerAdapter } from "./types";

type TwitchPlayer = {
  play(): void;
  pause(): void;
  seek(seconds: number): void;
  setVideo(videoId: string, timestamp: number): void;
  getCurrentTime(): number;
  getDuration(): number;
  addEventListener(event: string, callback: () => void): void;
};

type TwitchNamespace = {
  Player: { new (elementId: string, options: Record<string, unknown>): TwitchPlayer; READY: string };
};

declare global {
  interface Window {
    Twitch?: TwitchNamespace;
  }
}

let playerCount = 0;

export const createTwitchAdapter: AdapterFactory = async (mount, first) => {
  await loadScript("https://player.twitch.tv/js/embed/v1.js");
  const Twitch: TwitchNamespace | undefined = window.Twitch;
  if (!Twitch) throw new Error("Twitch player did not load");

  let current: VideoRef = first;
  let host: HTMLDivElement | null = null;
  let player: TwitchPlayer | null = null;
  let timer: number | null = null;
  const stopTimer = () => {
    if (timer !== null) window.clearInterval(timer);
    timer = null;
  };

  // Twitch documents no way to show a video without playing it, so a cued video gets a new, paused player.
  function create(video: VideoRef): Promise<void> {
    host?.remove();
    current = video;
    const element = document.createElement("div");
    element.id = `twitch-player-${++playerCount}`;
    element.className = "h-full w-full";
    mount.appendChild(element);
    host = element;
    const created = new Twitch!.Player(element.id, twitchOptions(video, window.location.hostname));
    player = created;
    return new Promise((resolve) => created.addEventListener(Twitch!.Player.READY, () => resolve()));
  }

  await create(first);

  return {
    cue(video) {
      stopTimer();
      if (!sameVideo(video, current)) void create(video);
    },
    playSegment(video, start, end) {
      stopTimer();
      const active = player;
      if (!active) return;
      if (sameVideo(video, current)) {
        active.seek(start);
        active.play();
      } else {
        active.setVideo(`v${video.id}`, start);
        current = video;
      }
      timer = window.setInterval(() => {
        const step = segmentStep(active.getCurrentTime(), start, end);
        if (step === "pause") active.pause();
        if (step !== "wait") stopTimer();
      }, 250);
    },
    currentTime: () => Promise.resolve(player ? player.getCurrentTime() : null),
    duration() {
      const d = player?.getDuration() ?? 0;
      return d > 0 ? d : null;
    },
    destroy() {
      stopTimer();
      host?.remove();
      host = null;
      player = null;
    },
  } satisfies PlayerAdapter;
};
