// ---------------------------------------------------------------------------
// SHARE CARDS — turn a calculator result into a picture, entirely in the browser.
// ---------------------------------------------------------------------------
// Drawn on a <canvas> by hand rather than screenshotting the DOM.
//
// WHY NOT html2canvas / dom-to-image:
//   1. Weight. Those libraries are 50-200 KB, on a section whose whole selling
//      point is that a tool page adds about 5 KB to the bundle.
//   2. Fonts. They rasterise by rebuilding the DOM inside an SVG <foreignObject>,
//      and a webfont that is not inlined as a data URI silently falls back —
//      which on this site means every Bangla glyph turns into tofu. Canvas
//      fillText uses the real, already-loaded font.
//   3. A screenshot of a page is not a good picture. A card designed to be
//      shared can be portrait, self-contained and readable at thumbnail size,
//      which a cropped web page never is.
//
// WHY NOT A SERVER ROUTE (/api/og style): every one of these calculators
// promises, in writing on the page, that what the visitor types never leaves
// their browser. Posting a due date to an image endpoint to render it would
// make that line false. This is the constraint that decides the approach, not
// a preference.
//
// PNG rather than PDF: a PDF needs a library, and the thing people actually do
// with a result like this is send it to a relative on WhatsApp or imo, or keep
// it in their gallery to show at the next appointment. Both want an image.
// ---------------------------------------------------------------------------

export type Ctx = CanvasRenderingContext2D;

/**
 * The font stack the page is actually painting with.
 *
 * next/font generates a hashed family name (`__notoSansBengali_a1b2c3`), so it
 * cannot be hard-coded — and `var(--font-noto-bengali)` is not valid inside a
 * canvas font shorthand. Reading the computed style off <body> gets the
 * resolved list, which is exactly what the rest of the site renders with, so
 * the card and the page cannot drift apart.
 */
let cachedFamily: string | null = null;
export function cardFontFamily(): string {
  if (cachedFamily) return cachedFamily;
  if (typeof window === "undefined") return "sans-serif";
  const resolved = getComputedStyle(document.body).fontFamily;
  cachedFamily = resolved && resolved.trim() ? resolved : "system-ui, sans-serif";
  return cachedFamily;
}

export function setFont(ctx: Ctx, weight: number, size: number) {
  ctx.font = `${weight} ${size}px ${cardFontFamily()}`;
}

export function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

export function fillRoundRect(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: string,
) {
  ctx.fillStyle = fill;
  roundRect(ctx, x, y, w, h, r);
  ctx.fill();
}

/** Greedy word wrap. Bangla breaks on spaces, same as Latin. */
export function wrapText(ctx: Ctx, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth || !line) {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Draw wrapped text and return the y coordinate just past the last line. */
export function drawParagraph(
  ctx: Ctx,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
): number {
  const lines = wrapText(ctx, text, maxWidth);
  let cursor = y;
  for (const line of lines) {
    ctx.fillText(line, x, cursor);
    cursor += lineHeight;
  }
  return cursor;
}

/** A throwaway 2D context, for measuring text before the real canvas exists. */
export function measuringCtx(): Ctx {
  const c = document.createElement("canvas").getContext("2d");
  if (!c) throw new Error("canvas unavailable");
  return c;
}

/**
 * Load an image for drawing onto the card, or `null` if it cannot be used.
 *
 * ---------------------------------------------------------------------------
 * THE TAINTING TRAP. Drawing a cross-origin image onto a canvas silently marks
 * that canvas as tainted, and every later toBlob() throws SecurityError — so a
 * logo fetched straight from the R2 bucket would not make the card prettier, it
 * would break the download completely.
 *
 * The bucket at pub-*.r2.dev serves no Access-Control-Allow-Origin header
 * (verified with curl), so `crossOrigin = "anonymous"` cannot rescue it either.
 *
 * The fix is not to load it cross-origin at all: callers pass the logo through
 * Next's own /_next/image route, which is same-origin, and same-origin images
 * never taint. `crossOrigin` is still set as a belt-and-braces guard — if a
 * caller ever passes a raw remote URL, the image fails to LOAD (and we skip it)
 * instead of loading and poisoning the canvas.
 *
 * Failure is always non-fatal. A missing logo costs a little polish; a thrown
 * error costs the whole feature.
 * ---------------------------------------------------------------------------
 */
export function loadImage(url: string, timeoutMs = 6000): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (!url) return resolve(null);
    const img = new Image();
    img.crossOrigin = "anonymous";
    let settled = false;
    const done = (v: HTMLImageElement | null) => {
      if (settled) return;
      settled = true;
      resolve(v);
    };
    const timer = setTimeout(() => done(null), timeoutMs);
    img.onload = () => {
      clearTimeout(timer);
      done(img.naturalWidth > 0 ? img : null);
    };
    img.onerror = () => {
      clearTimeout(timer);
      done(null);
    };
    img.src = url;
  });
}

/**
 * Render the card and save it as a PNG file.
 *
 * Download only, deliberately. An earlier version tried navigator.share first
 * so a phone would open the native share sheet, but that puts a system dialog
 * between the visitor and the thing they asked for, and on desktop it is not
 * available at all — so the same button did two different things depending on
 * the device. Saving the file every time is predictable, and every platform's
 * share sheet is one tap away from the saved image anyway.
 *
 * `draw` may be async so it can await assets (the brand logo) before painting.
 *
 * Fonts are awaited before drawing. Without that the first export after a cold
 * load rasterises in the fallback face, and on this site that means a card full
 * of boxes instead of Bangla.
 */
export async function exportCard(opts: {
  width: number;
  height: number;
  draw: (ctx: Ctx, width: number, height: number) => void | Promise<void>;
  filename: string;
}): Promise<void> {
  if (typeof document !== "undefined" && document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {
      // A font-loading failure is not a reason to refuse the download; the
      // card still renders, just in the fallback face.
    }
  }

  const canvas = document.createElement("canvas");
  canvas.width = opts.width;
  canvas.height = opts.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas unavailable");

  await opts.draw(ctx, opts.width, opts.height);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/png"),
  );
  if (!blob) throw new Error("encode failed");

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = opts.filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoked on a delay, not immediately: Safari reads the blob asynchronously
  // after the click and a same-tick revoke kills the download.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
