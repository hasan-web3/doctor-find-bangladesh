import { NextRequest, NextResponse, type NextFetchEvent } from "next/server";
import { jwtVerify } from "jose";

// Runtime: EDGE (the default — deliberately not `nodejs`).
//
// This file used to `export const runtime = 'nodejs'`, which on Vercel makes
// middleware a Fluid compute invocation on every matched HTML and .rsc
// request — a continuous Active CPU cost independent of page rendering. Edge
// middleware is metered separately and is what this code was written for:
// `jose` is explicitly the edge-compatible JWT library (that is why it is used
// here instead of jsonwebtoken), and `fetch` is native on edge. Nothing below
// needs a Node built-in.
//
// If a future change here does need Node, prefer moving that work into a route
// handler over switching this whole file back.

// ---- locale strategy ----
// bn (default): served at root URLs (/doctors) via internal REWRITE to /bn/doctors.
// en: served under /en prefix (/en/doctors), passed through as-is.
// /bn/* in the address bar redirects to /* (no duplicate content for SEO).
// A NEXT_LOCALE cookie persists the user's explicit choice across visits;
// crawlers (no cookie) always get bn at root and en at /en.
//
// PERFORMANCE: this middleware never blocks on I/O. The redirect map is served
// from an in-memory snapshot and refreshed in the BACKGROUND via event.waitUntil
// (stale-while-revalidate), so a navigation is never delayed by a DB/fetch call.

const LOCALE_COOKIE = "NEXT_LOCALE";
const AREA_COOKIE = "db_area";

// Paths that are locale-neutral and must never be rewritten.
// `sitemap` (no extension anchor) covers both /sitemap.xml (legacy) and
// /sitemap/<id>.xml sub-sitemaps emitted by generateSitemaps() — the locale
// rewrite must never touch these or Google gets 404s.
const NEUTRAL = /^\/(admin|admin-login|api|_next|sitemap|robots\.txt|icon\.svg|favicon\.ico)/;

// Paths that should not trigger geo-detection (e.g. image assets)
const NO_GEO = /\.(jpg|jpeg|png|svg|webp|ico|txt)$/;

// ---- vulnerability-scanner paths ----
// This site is not PHP and has no WordPress. Every one of these is a bot
// probing for an exploit, and there are thousands of them a day. Without this
// guard `/wp-login.php` falls through NEUTRAL, gets rewritten to
// `/bn/wp-login.php` and renders the full not-found PAGE — a server render with
// layout data fetches, i.e. real Active CPU spent on a scanner. Answering with
// a bare 404 from the edge costs nothing and is checked before any other work.
//
// Nothing legitimate on this site starts with these segments or ends in these
// extensions; `/.well-known/*` is deliberately NOT listed (ACME/TLS needs it).
const SCANNER_PATH =
  /^\/(?:wp-admin|wp-includes|wp-content|wp-login|wp-json|wordpress|wp|xmlrpc|phpmyadmin|phpMyAdmin|pma|myadmin|adminer|cgi-bin|vendor|autodiscover|owa|solr|actuator|telescope|\.env|\.git|\.svn|\.aws|\.ssh|\.vscode|\.idea)(?:[/.]|$)|\.(?:php\d?|phtml|phar|asp|aspx|jsp|cgi|pl|sh|bak|sql|old|swp|ini|env)$/i;

// ---- stale-while-revalidate redirect cache ----
let redirectMap: Record<string, { to: string; permanent: boolean }> = {};
let redirectMapAt = 0;
let refreshing = false;

// How long an edge isolate keeps its snapshot before refreshing in the
// background. Every refresh is one request to /api/redirects, and Vercel runs
// many isolates in parallel, so a short TTL turned into a continuous stream of
// function invocations for a table that changes a few times a month. 15 minutes
// is safe because redirects are ALSO enforced at the page level (see below), so
// a stale snapshot can only ever mean "the 308 arrives one hop later", never a
// wrong page. Admin edits purge /api/redirects immediately anyway
// (revalidateRedirects() in src/lib/revalidate.ts).
const REDIRECT_TTL_MS = 15 * 60_000;

async function refreshRedirects(origin: string) {
  if (refreshing) return;
  refreshing = true;
  try {
    // /api/redirects is a cached route handler, so this normally never reaches
    // a function at all — it is served from the CDN. (Do NOT put `no-store`
    // back here: that forces every refresh to the origin, which is exactly the
    // invocation storm this cache exists to avoid.) It also runs in the
    // background via waitUntil — never on the hot path.
    const res = await fetch(`${origin}/api/redirects`);
    if (res.ok) {
      redirectMap = await res.json();
      redirectMapAt = Date.now();
    }
  } catch {
    // DB/app not reachable yet (first setup): keep serving the current snapshot.
  } finally {
    refreshing = false;
  }
}

export async function middleware(req: NextRequest, event: NextFetchEvent) {
  const { pathname } = req.nextUrl;

  // ---- scanner paths: cheapest possible exit, before ANY other work ----
  // Deliberately the first statement in the function: no DB, no geo, no JWT, no
  // rewrite. `Cache-Control` lets the edge absorb repeat probes of the same URL.
  if (SCANNER_PATH.test(pathname)) {
    return new NextResponse(null, {
      status: 404,
      headers: {
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
        "X-Robots-Tag": "noindex",
      },
    });
  }

  // ---- admin guard (locale-neutral) ----
  if (pathname.startsWith("/admin") && !pathname.startsWith("/admin-login")) {
    const token = req.cookies.get("db_admin_session")?.value;
    let ok = false;
    if (token && process.env.APP_SECRET) {
      try {
        await jwtVerify(token, new TextEncoder().encode(process.env.APP_SECRET));
        ok = true;
      } catch {
        ok = false;
      }
    }
    if (!ok) {
      const url = req.nextUrl.clone();
      url.pathname = "/admin-login";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  if (NEUTRAL.test(pathname)) return NextResponse.next();

  // ---- refresh redirect snapshot in the background if stale (non-blocking) ----
  if (req.method === "GET" && Date.now() - redirectMapAt > REDIRECT_TTL_MS) {
    event.waitUntil(refreshRedirects(req.nextUrl.origin));
  }

  // ---- apply a redirect from the current snapshot (no await, no blocking) ----
  // Entity slug-change redirects are ALSO enforced at the page level, so even a
  // cold first request (empty snapshot) never misses an entity redirect.
  if (req.method === "GET") {
    const neutralPath =
      pathname === "/en" ? "/" : pathname.startsWith("/en/") ? pathname.slice(3) : pathname;
    const hit = redirectMap[neutralPath];
    if (hit && hit.to !== neutralPath) {
      const url = req.nextUrl.clone();
      url.pathname = pathname.startsWith("/en") ? `/en${hit.to === "/" ? "" : hit.to}` : hit.to;
      return NextResponse.redirect(url, hit.permanent ? 308 : 307);
    }
  }

  // ---- static canonicalisations (real 308s) ----
  // A `permanentRedirect()` inside a streamed server component does NOT emit a
  // 308 — Next flushes the shell first and falls back to
  // `<meta http-equiv="refresh">` with a 200. Google treats that as a soft
  // redirect and may index the redirecting URL as its own page. These two
  // rewrites need no DB lookup, so middleware can answer them properly.
  if (req.method === "GET") {
    const p = pathname.startsWith("/en/") || pathname === "/en" ? pathname.slice(3) || "/" : pathname;
    // /area (the bare index only — /area/doctors/... is a real route) -> /areas
    // The two rendered identical pages with different canonical tags.
    let target: string | null = p === "/area" ? "/areas" : null;
    // /districts/<slug> -> /districts/<slug>/doctors (the canonical listing)
    const dm = p.match(/^\/districts\/([^/]+)$/);
    if (dm) target = `/districts/${dm[1]}/doctors`;
    if (target) {
      const url = req.nextUrl.clone();
      url.pathname = pathname.startsWith("/en") ? `/en${target}` : target;
      return NextResponse.redirect(url, 308);
    }
  }

  // ---- /bn/* must not exist publicly: canonicalize to root ----
  // Root Bangla URLs are internally rewritten to /bn/* below. Next runs the
  // middleware again for that rewritten request, so identify that internal
  // pass explicitly; otherwise /doctors -> /bn/doctors -> /doctors loops
  // forever and client-side navigation never completes.
  if (pathname === "/bn" || pathname.startsWith("/bn/")) {
    if (req.headers.get("x-internal-locale-rewrite") === "bn") {
      return NextResponse.next();
    }
    const url = req.nextUrl.clone();
    url.pathname = pathname.slice(3) || "/";
    return NextResponse.redirect(url, 308);
  }

  const cookieLocale = req.cookies.get(LOCALE_COOKIE)?.value;
  const isEnglishPath = pathname === "/en" || pathname.startsWith("/en/");

  // ---- persistence: an explicit "en" choice redirects root visits to /en ----
  if (!isEnglishPath && cookieLocale === "en" && req.method === "GET") {
    const url = req.nextUrl.clone();
    url.pathname = `/en${pathname === "/" ? "" : pathname}` || "/en";
    return NextResponse.redirect(url, 307); // temporary: user preference, not canonical
  }

  // ---- i18n Handling ----
  // Geo detection is intentionally NOT done here: middleware runs in a context
  // where next/cache's unstable_cache has no incrementalCache and throws on
  // Vercel. IP-based area lookup is performed lazily in detectArea() (server
  // components) instead. We only forward the client IP so that path can use it.
  const requestHeaders = new Headers(req.headers);
  // Same priority as getClientIp() in src/lib/geo.ts, and for the same reason:
  // this site sits behind Cloudflare, so `x-forwarded-for` as Vercel presents
  // it is the Cloudflare PoP, not the visitor. `cf-connecting-ip` is the only
  // header here that carries the person.
  // `true-client-ip` is not listed: Cloudflare only sends it on Enterprise.
  const clientIp =
    req.headers.get("cf-connecting-ip")?.trim() ||
    req.headers.get("x-real-ip")?.trim() ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "";
  if (clientIp && !NO_GEO.test(pathname)) {
    requestHeaders.set("x-client-ip", clientIp);
  }

  let response: NextResponse;
  if (isEnglishPath) {
    requestHeaders.set("x-locale", "en");
    response = NextResponse.next({ request: { headers: requestHeaders } });
  } else {
    const url = req.nextUrl.clone();
    url.pathname = `/bn${pathname === "/" ? "" : pathname}`;
    requestHeaders.set("x-locale", "bn");
    requestHeaders.set("x-internal-locale-rewrite", "bn");
    response = NextResponse.rewrite(url, { request: { headers: requestHeaders } });
  }

  // No geo cookie is written here. Vercel's `x-vercel-ip-*` headers arrive on
  // every request for free, so `detectArea()` reads them fresh server-side —
  // caching them in a cookie only served a stale city after the visitor moved
  // or switched VPN. The one expensive path (external IP-geo, used when those
  // headers are absent) is cached for 30 minutes per IP inside lookupIp().
  return response;
}

// Everything this middleware does is for HTML navigations: the admin guard, the
// locale rewrite and the canonical redirects. Anything it cannot act on should
// never reach it, because on Vercel every match is a billed invocation.
//
// Additions over the previous matcher:
//   - `api` — middleware did nothing for /api/* except fall through the NEUTRAL
//     test and return next(). Excluding it is safe: the only thing it forwarded
//     was `x-client-ip`, and geo.ts already falls back to `x-forwarded-for`.
//   - `robots.txt`, `sitemap`, `icon.svg` — matched NEUTRAL and returned next().
//   - `avif`, `gif`, fonts, `css`, `js`, `map`, `json`, `pdf`, `mp4` — the
//     previous list stopped at png/jpg/jpeg/svg/webp/ico/txt/xml.
//
// The `.rsc` / `_next/data` suffixes are intentionally still matched: client
// side navigations request those and they need the same locale rewrite as the
// document request, or a soft navigation would resolve to a different tree.
export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap|icon.svg|.*\\.(?:png|jpg|jpeg|gif|avif|webp|svg|ico|css|js|map|json|txt|xml|pdf|mp4|woff|woff2|ttf|otf|eot)$).*)",
  ],
};
