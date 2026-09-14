import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

const contentSecurityPolicy = [
  "default-src 'self'",
  // Next inlines its bootstrap scripts, and each video player loads its platform's script.
  // YouTube, Vimeo and Twitch scripts are the platforms' official players and run in this origin.
  // BoxCast's player also loads analytics and payment code, so it only runs in the sandboxed
  // /player/boxcast frame. Revisit if the others start loading tracking or ad code.
  // Dev also needs eval for React debugging and a websocket for hot reload.
  `script-src 'self' 'unsafe-inline' https://www.youtube.com https://player.vimeo.com https://player.twitch.tv${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https://i.ytimg.com",
  "font-src 'self'",
  `connect-src 'self'${isDev ? " ws:" : ""}`,
  // YouTube's privacy-enhanced embed, the Vimeo and Twitch players, and this site's sandboxed BoxCast page.
  "frame-src 'self' https://www.youtube-nocookie.com https://player.vimeo.com https://player.twitch.tv",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Older browsers that ignore frame-ancestors.
  { key: "X-Frame-Options", value: "DENY" },
  ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]),
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  // Scripts always run from the repo root; pinning it stops Next picking up lockfiles in parent folders.
  turbopack: { root: process.cwd() },
  async headers() {
    return [
      // The BoxCast player page sends its own narrower policy, which lets this site frame it.
      { source: "/:path((?!player/boxcast$).*)", headers: securityHeaders },
    ];
  },
};

export default nextConfig;
