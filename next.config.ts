import type { NextConfig } from "next";

// Allow the R2 public bucket host (r2.dev subdomain or custom domain).
const r2Host = process.env.R2_PUBLIC_URL
  ? new URL(process.env.R2_PUBLIC_URL).hostname
  : "*.r2.dev";

// ---------------------------------------------------------------------------
// Content Security Policy
// ---------------------------------------------------------------------------
// Built as a directive map so it stays readable and diff-friendly. Notes on
// each allowance:
//   - 'unsafe-inline' + 'unsafe-eval' in script-src: Next.js ships small inline
//     bootstrap scripts (RSC payload, self.__next_f pushes) and hydration
//     glue that require inline execution. Nonces are the "right" fix but need
//     coordinated middleware work; that's a future upgrade.
//   - 'unsafe-inline' in style-src: Tailwind + Next.js inject styles inline
//     during SSR/hydration; without it every page renders unstyled.
//   - Google Maps, reCAPTCHA v3, Vercel Analytics + Speed Insights each need
//     their own script/connect/frame sources — listed explicitly below.
//   - R2 hosts are allow-listed on img-src via https:, so any current or
//     future bucket URL works without editing this file.
//   - report-uri intentionally omitted: no reporting endpoint yet, and dev
//     mode already surfaces violations in the browser console.
const cspDirectives: Record<string, string[]> = {
  "default-src": ["'self'"],
  "base-uri": ["'self'"],
  "form-action": ["'self'"],
  "frame-ancestors": ["'self'"],
  "object-src": ["'none'"],
  "img-src": [
    "'self'",
    "data:",
    "blob:",
    "https:",
  ],
  "media-src": ["'self'", "data:", "blob:", "https:"],
  "script-src": [
    "'self'",
    "'unsafe-inline'",
    "'unsafe-eval'",
    "https://maps.googleapis.com",
    "https://maps.gstatic.com",
    "https://www.google.com",
    "https://www.gstatic.com",
    "https://www.googletagmanager.com",
    "https://www.google-analytics.com",
    "https://connect.facebook.net",
    "https://va.vercel-scripts.com",
    "https://vercel.live",
  ],
  "style-src": [
    "'self'",
    "'unsafe-inline'",
    "https://fonts.googleapis.com",
  ],
  "font-src": [
    "'self'",
    "data:",
    "https://fonts.gstatic.com",
  ],
  "connect-src": [
    "'self'",
    "https:",
    "wss:",
  ],
  "frame-src": [
    "'self'",
    "https://www.google.com",
    "https://recaptcha.google.com",
    "https://vercel.live",
  ],
  "worker-src": ["'self'", "blob:"],
  "manifest-src": ["'self'"],
  "upgrade-insecure-requests": [],
};

function buildCsp(directives: Record<string, string[]>): string {
  return Object.entries(directives)
    .map(([k, v]) => (v.length ? `${k} ${v.join(" ")}` : k))
    .join("; ");
}

// Standard security headers applied to every response.
const securityHeaders = [
  { key: "Content-Security-Policy", value: buildCsp(cspDirectives) },
  // Stop MIME-sniffing.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Disallow the site being framed by others (clickjacking).
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // Send only the origin as referrer to cross-origin destinations.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Lock down powerful browser features. `geolocation=(self)` lets the site
  // itself request coordinates if we ever need to; third-party frames still
  // can't. Camera/microphone/payment stay fully off.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self), payment=()" },
  // Force HTTPS for two years (only meaningful once served over HTTPS in prod).
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

const nextConfig: NextConfig = {
  allowedDevOrigins: ["*.ngrok-free.app"],
  images: {
    // Serve both a custom R2 domain (if configured) and any pub-*.r2.dev bucket
    // fallback, so images keep resolving whether the env var is set or not.
    remotePatterns: [
      { protocol: "https", hostname: r2Host },
      { protocol: "https", hostname: "*.r2.dev" },
      { protocol: "https", hostname: "*.r2.cloudflarestorage.com" },
    ],
    // Modern formats — Next serves AVIF when the browser accepts it, WebP otherwise.
    // Cuts LCP image bytes ~30–50% vs the JPEG/PNG originals.
    formats: ["image/avif", "image/webp"],
    // Cache the optimized variant for a year — the URLs are content-hashed by
    // Next, so a re-uploaded R2 object under the same key still busts via query.
    minimumCacheTTL: 60 * 60 * 24 * 365,
  },
  poweredByHeader: false, // don't advertise "X-Powered-By: Next.js"
  // Server-only Node packages that don't need webpack bundling. Leaving them
  // external means Next.js `require`s them straight from node_modules at
  // runtime, which:
  //   1. Kills the "Cannot find module ./vendor-chunks/drizzle-orm.js"
  //      race in dev (static-paths-worker forks a child process that reads
  //      .next mid-write; if the vendor chunk hasn't been flushed yet, it
  //      500s. Externals never enter the vendor chunk pipeline).
  //   2. Cuts server bundle size + cold-start time in prod.
  //   3. Avoids ESM/CJS interop bugs that these libs (drizzle, pg, aws-sdk)
  //      still occasionally hit when bundled.
  serverExternalPackages: [
    "drizzle-orm",
    "drizzle-kit",
    "pg",
    "@aws-sdk/client-s3",
    "@aws-sdk/s3-request-presigner",
    "jose",
    "bcryptjs",
    "nodemailer",
  ],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
