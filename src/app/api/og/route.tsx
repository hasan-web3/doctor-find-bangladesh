import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

// Dynamic OG image with full Bangla glyph support (bundled Hind Siliguri TTFs).
export const runtime = "nodejs";

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
  const title = (searchParams.get("title") || "ডক্টরবন্ধু").slice(0, 90);
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
            ডক্টর<span style={{ color: "#0D9488" }}>বন্ধু</span>
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
    }
  );
}
