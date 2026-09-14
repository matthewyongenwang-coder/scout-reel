import { createHash } from "node:crypto";

/**
 * The BoxCast player page. The app loads it in an iframe sandboxed without same-origin
 * access, so BoxCast's scripts run with an opaque origin and cannot reach the app's
 * cookies or storage. It reads the broadcast id from its own URL and nothing else.
 */
const SCRIPT = `(function () {
  var SOURCE = "scout-reel-player";
  var id = new URLSearchParams(location.search).get("b") || "";
  var player = null;
  function send(message) {
    message.source = SOURCE;
    window.parent.postMessage(message, "*");
  }
  function fail(message) {
    send({ kind: "error", message: message });
  }
  function seconds(read) {
    try {
      var value = read();
      return typeof value === "number" && isFinite(value) && value >= 0 ? value : null;
    } catch (error) {
      return null;
    }
  }
  if (!/^[a-z0-9]{20}$/.test(id)) {
    fail("That BoxCast broadcast id is not valid");
    return;
  }
  if (typeof window.boxcast !== "function") {
    fail("The BoxCast player could not load");
    return;
  }
  window.addEventListener("message", function (event) {
    if (event.source !== window.parent || !player) return;
    var m = event.data;
    if (!m || typeof m !== "object" || m.source !== SOURCE) return;
    if (m.kind === "seek" && typeof m.seconds === "number" && isFinite(m.seconds) && m.seconds >= 0) player.seek(m.seconds);
    else if (m.kind === "play") player.play();
    else if (m.kind === "pause") player.pause();
    else if (m.kind === "time" && Number.isSafeInteger(m.requestId) && m.requestId >= 0) {
      send({ kind: "time", requestId: m.requestId, seconds: seconds(function () { return player.getCurrentTime(); }) });
    }
  });
  fetch("https://rest.boxcast.com/broadcasts/" + id, { credentials: "omit" })
    .then(function (response) {
      if (!response.ok) throw new Error("not found");
      return response.json();
    })
    .then(function (broadcast) {
      if (!broadcast || typeof broadcast.channel_id !== "string") throw new Error("no channel");
      window.boxcast("#player").loadChannel(broadcast.channel_id, {
        selectedBroadcastId: id,
        autoplay: false,
        showTitle: false,
        showDescription: false,
        showHighlights: false,
        showRelated: false,
        onLoadPlayer: function (loaded) {
          player = loaded;
          send({ kind: "ready" });
          setInterval(function () {
            var t = seconds(function () { return player.getCurrentTime(); });
            if (t === null) return;
            var d = seconds(function () { return player.getDuration(); });
            send({ kind: "progress", seconds: t, duration: d && d > 0 ? d : null });
          }, 500);
        },
      });
    })
    .catch(function () {
      fail("That BoxCast broadcast could not be loaded");
    });
})();`;

const SCRIPT_HASH = createHash("sha256").update(SCRIPT).digest("base64");

/**
 * Only the hosts BoxCast's player needs. Its player builds templates with eval, so this page
 * allows 'unsafe-eval'. That is acceptable only because the page runs in an opaque-origin
 * sandbox holding nothing of the app's: no cookies, storage or data beyond a broadcast id.
 * js.boxcast.com is written without a scheme because the SDK requests it scheme-relative.
 */
export const BOXCAST_FRAME_CSP = [
  "default-src 'none'",
  `script-src 'sha256-${SCRIPT_HASH}' 'unsafe-eval' https://js.boxcast.com`,
  "connect-src js.boxcast.com https://rest.boxcast.com https://play.boxcast.com https://recordings.boxcast.com https://metrics.boxcast.com",
  "media-src blob: https://play.boxcast.com https://recordings.boxcast.com",
  "img-src data: https://assets.boxcast.com https://recordings.boxcast.com",
  "font-src js.boxcast.com",
  "style-src 'unsafe-inline'",
  "worker-src blob:",
  "frame-ancestors 'self'",
  "base-uri 'none'",
  "form-action 'none'",
].join("; ");

const HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>BoxCast player</title>
<style>html, body, #player { margin: 0; height: 100%; background: #000; overflow: hidden; }</style>
</head>
<body>
<div id="player"></div>
<script src="https://js.boxcast.com/v3.min.js"></script>
<script>${SCRIPT}</script>
</body>
</html>`;

export function GET() {
  return new Response(HTML, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": BOXCAST_FRAME_CSP,
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      // Revalidate every time, so a changed Content Security Policy reaches browsers at once.
      "Cache-Control": "no-cache",
    },
  });
}
