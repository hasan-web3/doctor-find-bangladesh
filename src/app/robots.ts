import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/seo-utils";

// Single master URL — /sitemap.xml is a sitemap-index (see
// src/app/sitemap.xml/route.ts) that lists every shard emitted by
// generateSitemaps(). Google follows the index and picks up all sub-sitemaps
// automatically, so any new entity type added to sitemap.ts is discovered
// without touching this file.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Admin, auth, API, and booking flow are not crawlable content.
        // `/doctor-form` is the private one-time intake form we email to a
        // doctor — it carries a token in the URL and must never be crawled,
        // cached by a search engine, or indexed. The page also sends
        // `noindex, nofollow` itself; this is the belt to that braces.
        disallow: ["/admin", "/admin-login", "/api", "/appointment", "/doctor-form"],
      },
    ],
    sitemap: siteUrl("/sitemap.xml"),
    host: siteUrl("/"),
  };
}
