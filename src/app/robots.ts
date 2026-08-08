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
        //
        // `/doctor-form` is deliberately NOT listed, even though it is private.
        // Two reasons, and they point the same way:
        //   1. robots.txt stops CRAWLING, not indexing. A disallowed URL can
        //      still be listed by Google from links alone, and because the
        //      crawler never fetches the page it never sees the `noindex` that
        //      would actually keep it out. Allowing the fetch is what makes the
        //      noindex effective.
        //   2. Link-preview fetchers (WhatsApp, Messenger, Facebook) honour
        //      this file too, so blocking it left the shared link with no card
        //      at all — just a bare host name.
        // The page itself sends `noindex, nofollow, noarchive, nosnippet`, which
        // is the real gate. Tokens are unguessable, single-use and linked from
        // nowhere, so there is nothing here for a crawler to find on its own.
        disallow: ["/admin", "/admin-login", "/api", "/appointment"],
      },
    ],
    sitemap: siteUrl("/sitemap.xml"),
    host: siteUrl("/"),
  };
}
