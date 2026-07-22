import { NextRequest, NextResponse, type NextFetchEvent } from "next/server";
import { jwtVerify } from "jose";
import { detectAreaByIp } from "./lib/geo";

export const runtime = 'nodejs';

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
const NEUTRAL = /^\/(admin|admin-login|api|_next|sitemap\.xml|robots\.txt|icon\.svg|favicon\.ico)/;

// Paths that should not trigger geo-detection (e.g. image assets)
const NO_GEO = /\.(jpg|jpeg|png|svg|webp|ico|txt)$/;

// ---- stale-while-revalidate redirect cache ----
let redirectMap: Record<string, { to: string; permanent: boolean }> = {};
let redirectMapAt = 0;
let refreshing = false;

async function refreshRedirects(origin: string) {
  if (refreshing) return;
  refreshing = true;
  try {
    // /api/redirects is unstable_cache-backed (tag: redirects), so this is a
    // cheap cached hit, and it runs in the background — never on the hot path.
    const res = await fetch(`${origin}/api/redirects`, { cache: "no-store" });
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
  if (req.method === "GET" && Date.now() - redirectMapAt > 60_000) {
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

  // ---- Geolocation and i18n Handling ----
  const requestHeaders = new Headers(req.headers);
  const GEO_CACHE_COOKIE = "geo-location-cache";

  // 1. Geolocation Detection
  let areaSlug: string | null = null;
  let geoSource: string = "none";
  let lat: number | null = null;
  let lng: number | null = null;
  let setGeoCookie = false;

  if (!NO_GEO.test(pathname)) {
    const geoCookie = req.cookies.get(GEO_CACHE_COOKIE)?.value;
    if (geoCookie) {
      try {
        const parsed = JSON.parse(geoCookie);
        areaSlug = parsed.areaSlug;
        geoSource = "cookie";
        lat = parsed.lat;
        lng = parsed.lng;
      } catch (e) { /* ignore invalid cookie */ }
    }
  }

  if (!areaSlug && !NO_GEO.test(pathname)) {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "";
    const geo = await detectAreaByIp(ip);
    if (geo.areaSlug) {
      areaSlug = geo.areaSlug;
      geoSource = geo.source;
      lat = geo.lat;
      lng = geo.lng;
      setGeoCookie = true; // Mark that we need to set the cache cookie
    }
  }

  requestHeaders.set("x-geo-area-slug", areaSlug || "");
  requestHeaders.set("x-geo-source", geoSource);
  requestHeaders.set("x-geo-lat", lat ? String(lat) : "");
  requestHeaders.set("x-geo-lng", lng ? String(lng) : "");
  
  // 2. Locale-based Response Generation
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

  // 3. Set geo-cache cookie if needed
  if (setGeoCookie && areaSlug) {
    response.cookies.set(GEO_CACHE_COOKIE, JSON.stringify({ areaSlug, source: geoSource, lat, lng }), {
      maxAge: 30 * 60, // 30 minutes
      path: "/",
      httpOnly: true,
      sameSite: "lax",
    });
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico|txt)).*)"],
};
