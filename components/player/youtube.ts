import { segmentStep } from "@/lib/video/embed";
import type { VideoRef } from "@/lib/video/platforms";
import type { AdapterFactory, PlayerAdapter } from "./types";

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
  apiPromise ??= new Promise((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      if (window.YT) resolve(window.YT);
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = () => {
      apiPromise = null;
      script.remove();
      reject(new Error("Could not load www.youtube.com"));
    };
    document.head.appendChild(script);
  });
  return apiPromise;
}

export const createYouTubeAdapter: AdapterFactory = async (mount, first) => {
  const YT = await loadYouTubeApi();
  const target = document.createElement("div");
  mount.appendChild(target);

  return new Promise<PlayerAdapter>((resolve) => {
    let loadedId = first.id;
    let timer: number | null = null;
    const stopTimer = () => {
      if (timer !== null) window.clearInterval(timer);
      timer = null;
    };

    const adapter: PlayerAdapter = {
      cue(video: VideoRef) {
        stopTimer();
        if (video.id === loadedId) return;
        player.cueVideoById(video.id);
        loadedId = video.id;
      },
      playSegment(video, start, end) {
        stopTimer();
        if (video.id === loadedId) {
          player.seekTo(start, true);
          player.playVideo();
        } else {
          player.loadVideoById({ videoId: video.id, startSeconds: start, endSeconds: end });
          loadedId = video.id;
        }
        timer = window.setInterval(() => {
          const step = segmentStep(player.getCurrentTime(), start, end);
          if (step === "pause") player.pauseVideo();
          if (step !== "wait") stopTimer();
        }, 250);
      },
      currentTime: () => Promise.resolve(player.getCurrentTime()),
      duration() {
        const d = player.getDuration();
        return d > 0 ? d : null;
      },
      destroy() {
        stopTimer();
        player.destroy();
        target.remove();
      },
    };

    const player = new YT.Player(target, {
      host: "https://www.youtube-nocookie.com",
      videoId: first.id,
      width: "100%",
      height: "100%",
      playerVars: { rel: 0, playsinline: 1 },
      events: { onReady: () => resolve(adapter) },
    });
  });
};
