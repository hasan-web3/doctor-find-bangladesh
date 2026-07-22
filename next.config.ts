import type { NextConfig } from "next";

// Allow the R2 public bucket host (r2.dev subdomain or custom domain).
const r2Host = process.env.R2_PUBLIC_URL
  ? new URL(process.env.R2_PUBLIC_URL).hostname
  : "*.r2.dev";

// Standard security headers applied to every response.
const securityHeaders = [
  // Stop MIME-sniffing.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Disallow the site being framed by others (clickjacking).
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // Send only the origin as referrer to cross-origin destinations.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Lock down powerful browser features the site doesn't use.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  // Force HTTPS for two years (only meaningful once served over HTTPS in prod).
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

const nextConfig: NextConfig = {
  allowedDevOrigins: ["*.ngrok-free.app"],
  images: {
    remotePatterns: [{ protocol: "https", hostname: r2Host }],
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
