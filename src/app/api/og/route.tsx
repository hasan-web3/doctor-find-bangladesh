import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

// Dynamic OG image with full Bangla glyph support (bundled Hind Siliguri TTFs).
export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// Why this route is aggressively cached
// ---------------------------------------------------------------------------
// This is the single most CPU-expensive handler in the app: every hit loads two
// TTFs, runs Satori to lay the card out, then rasterises and encodes a
// 1200x630 PNG. In Node runtime that is ~300-600 ms of pure Active CPU.
//
// It used to carry no cache directive at all, which for a route handler reading
// searchParams means "fully dynamic": nothing in front of it cached, so every
// crawler fetch, every Facebook/WhatsApp/Twitter unfurl and every repeat share
// of the same link re-rendered a byte-identical image. Cloudflare could not
// absorb it either — the path has no file extension AND no Cache-Control, so it
// fails both of its default cacheability tests.
//
// The response is a pure function of the query string (no DB, no cookies, no
// headers), so it is safe to treat as immutable. There is nothing to purge:
// the title is IN the URL, so renaming a doctor or editing a page title
// produces a different URL and therefore a different image automatically.
//
// The one thing the URL does NOT encode is the card's own DESIGN. That is what
// OG_CARD_VERSION in src/lib/seo.ts is for — bump it whenever the layout,
// colours or logo below change, and every share URL becomes a new cache key.
const OG_CACHE_CONTROL = "public, max-age=31536000, s-maxage=31536000, immutable";

let fontsPromise: Promise<{ regular: Buffer; bold: Buffer }> | null = null;
function loadFonts() {
  if (!fontsPromise) {
    const dir = join(process.cwd(), "src", "assets", "fonts");
    fontsPromise = Promise.all([
      readFile(join(dir, "HindSiliguri-Regular.ttf")),
      readFile(join(dir, "HindSiliguri-SemiBold.ttf")),
    ]).then(([regular, bold]) => ({ regular, bold }));
  }
  return fontsPromise;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const title = (searchParams.get("title") || "ডক্টরস ফাইন্ড বাংলাদেশ").slice(0, 90);
  const subtitle = (searchParams.get("subtitle") || "").slice(0, 80);
  const { regular, bold } = await loadFonts();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 64,
          background: "linear-gradient(135deg, #F0FDFA 0%, #FFFFFF 55%, #F0FDFA 100%)",
          fontFamily: "HindSiliguri",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -120,
            right: -120,
            width: 380,
            height: 380,
            borderRadius: 380,
            background: "#CCFBF1",
            opacity: 0.6,
            display: "flex",
          }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <svg width="56" height="56" viewBox="0 0 32 32" fill="none">
            <path
              d="M16 2.5c-5.2 0-9.5 4-9.5 9.2 0 6.4 9.5 16.3 9.5 16.3s9.5-9.9 9.5-16.3c0-5.2-4.3-9.2-9.5-9.2z"
              fill="#0D9488"
            />
            <path d="M16 7v9M11.5 11.5h9" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
          </svg>
          <div style={{ display: "flex", fontSize: 40, fontWeight: 600, color: "#0F172A" }}>
            ডক্টরস ফাইন্ড <span style={{ color: "#0D9488" }}>বাংলাদেশ</span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 1000 }}>
          <div style={{ display: "flex", fontSize: 64, fontWeight: 600, color: "#0F172A", lineHeight: 1.25 }}>
            {title}
          </div>
          {subtitle ? (
            <div style={{ display: "flex", fontSize: 32, color: "#0F766E" }}>{subtitle}</div>
          ) : null}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderTop: "3px solid #CCFBF1",
            paddingTop: 28,
          }}
        >
          <div style={{ display: "flex", fontSize: 26, color: "#475569" }}>
            খুলনার বিশ্বস্ত ডাক্তার ডিরেক্টরি
          </div>
          <div
            style={{
              display: "flex",
              background: "#0D9488",
              color: "#fff",
              fontSize: 24,
              fontWeight: 600,
              padding: "12px 28px",
              borderRadius: 14,
            }}
          >
            অ্যাপয়েন্টমেন্ট নিন
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: [
        { name: "HindSiliguri", data: regular, weight: 400 },
        { name: "HindSiliguri", data: bold, weight: 600 },
      ],
      headers: { "Cache-Control": OG_CACHE_CONTROL },
    }
  );
}
