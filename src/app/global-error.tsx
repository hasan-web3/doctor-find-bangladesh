"use client";

// Last-resort boundary: catches failures in the ROOT LAYOUT itself. When this
// renders, the root layout never ran, so globals.css and next/font are NOT
// applied and no locale header is available. Everything here is therefore
// inline-styled, dependency-free, and printed in Bangla and English so it
// reads correctly whichever URL the visitor was on.
//
// Without this file Next.js falls back to its own unstyled English-only
// "Application error" screen, which must never reach a visitor.

const S = {
  body: {
    margin: 0,
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "40px 20px",
    background: "#F8FAFC",
    color: "#0F172A",
    fontFamily:
      "'Hind Siliguri', 'Noto Sans Bengali', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
    textAlign: "center" as const,
  },
  card: { maxWidth: 460, width: "100%" },
  icon: {
    width: 64,
    height: 64,
    margin: "0 auto 18px",
    borderRadius: 16,
    background: "#FFF7ED",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 30,
    lineHeight: 1,
  },
  h1: { margin: "0 0 10px", fontSize: 23, fontWeight: 700, lineHeight: 1.4 },
  p: { margin: 0, fontSize: 15.5, lineHeight: 1.7, color: "#475569" },
  rule: { margin: "20px auto", width: 48, height: 1, background: "#E2E8F0", border: 0 },
  h2: { margin: "0 0 10px", fontSize: 20, fontWeight: 700, lineHeight: 1.4 },
  actions: {
    marginTop: 26,
    display: "flex",
    flexWrap: "wrap" as const,
    gap: 12,
    justifyContent: "center",
  },
  primary: {
    padding: "13px 26px",
    borderRadius: 12,
    border: 0,
    background: "#0B7F75",
    color: "#fff",
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  secondary: {
    padding: "13px 26px",
    borderRadius: 12,
    border: "1.5px solid #0B7F75",
    background: "#fff",
    color: "#0F766E",
    fontSize: 15,
    fontWeight: 600,
    textDecoration: "none",
    display: "inline-block",
    fontFamily: "inherit",
  },
};

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    // lang="bn" matches the primary copy; the English block is marked
    // separately so screen readers switch voices correctly.
    <html lang="bn">
      <body style={S.body}>
        <div style={S.card}>
          <div style={S.icon} aria-hidden>
            ⚠️
          </div>

          <h1 style={S.h1}>সাইটটি এখন দেখানো যাচ্ছে না</h1>
          <p style={S.p}>সাময়িক একটি সমস্যা হয়েছে। কিছুক্ষণ পরে আবার চেষ্টা করুন।</p>

          <hr style={S.rule} />

          <div lang="en">
            <h2 style={S.h2}>The site is temporarily unavailable</h2>
            <p style={S.p}>Something went wrong on our side. Please try again in a moment.</p>
          </div>

          <div style={S.actions}>
            <button type="button" onClick={reset} style={S.primary}>
              আবার চেষ্টা করুন / Try again
            </button>
            <a href="/" style={S.secondary}>
              হোম / Home
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
