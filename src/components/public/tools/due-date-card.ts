// ---------------------------------------------------------------------------
// The pregnancy result, drawn as a shareable picture.
// ---------------------------------------------------------------------------
// Takes only finished strings. Every date, numeral and label is formatted and
// localized by the caller, so this file has no opinion about language — which
// is what keeps one drawing routine correct in both Bangla and English.
//
// Height is computed from the content (see dueDateCardHeight) rather than fixed,
// because the antenatal schedule is the tallest block and its row count is not
// a constant. A fixed canvas would either clip the last checkup or leave a band
// of empty white under a short one.
// ---------------------------------------------------------------------------

import {
  drawParagraph,
  fillRoundRect,
  loadImage,
  measuringCtx,
  setFont,
  wrapText,
  type Ctx,
} from "@/lib/tools/share-card";

export const CARD_W = 1080;

const P = 64;
const INNER = CARD_W - P * 2;

// ---- vertical rhythm ----
const HEADER_H = 520;
const STATS_TOP_GAP = 52;
const TILE_H = 156;
const GAP = 24;
const STATS_H = TILE_H * 2 + GAP;
const BLOCK_GAP = 44;
const SCHED_PAD = 36;
const SCHED_TITLE_H = 58;
const SCHED_ROW_H = 74;
const FOOTER_H = 96;

// ---- palette: the site's brand teal, not a one-off ----
// The header used to be rose, which read as a different product. These are the
// exact tokens from tailwind.config.ts, so the card and the site are the same
// brand at a glance.
const BRAND_900 = "#134E4A";
const BRAND_700 = "#0F766E";
const BRAND_500 = "#14B8A6";

const INK = "#0F172A";
const INK_MUTE = "#475569";
const INK_FAINT = "#64748B";
const INK_GHOST = "#94A3B8";
const PAGE = "#F8FAFC";
const LINE = "#E2E8F0";

// Checkup states, matching the on-page timeline exactly so the picture and the
// web result are visibly the same thing.
const ACCENT = "#22C55E";
const ACCENT_SOFT = "#ECFDF5";
const WARM = "#F97316";
const WARM_SOFT = "#FFF7ED";
const WARM_BORDER = "#FED7AA";
const WARM_TEXT = "#C2410C";

export type CheckupState = "done" | "next" | "upcoming";

export type CheckupRow = {
  /** "1st contact" */
  label: string;
  /** "12 weeks" */
  week: string;
  /** "27 October, 2026" */
  date: string;
  state: CheckupState;
};

export type DueDateCardData = {
  brand: string;
  /** Same-origin URL only — see loadImage()'s note on canvas tainting. */
  logoUrl?: string;
  /** "Estimated delivery date" */
  title: string;
  /** The date itself, already formatted for the locale. */
  edd: string;
  progressLabel: string;
  progressPct: number;
  /** Exactly four, drawn as a 2x2 grid. */
  stats: { label: string; value: string }[];
  scheduleTitle: string;
  checkups: CheckupRow[];
  /** Chip drawn beside the next checkup, e.g. "পরবর্তী". */
  nextBadge: string;
  /** Travels WITH the image — see the note where it is drawn. */
  disclaimer: string;
  footer: string;
};

function disclaimerLines(disclaimer: string): number {
  const m = measuringCtx();
  setFont(m, 500, 26);
  return wrapText(m, disclaimer, INNER - 56).length;
}

/** Total canvas height for this data. Must match what drawDueDateCard paints. */
export function dueDateCardHeight(data: Pick<DueDateCardData, "checkups" | "disclaimer">): number {
  const schedH = SCHED_PAD * 2 + SCHED_TITLE_H + data.checkups.length * SCHED_ROW_H;
  const discH = disclaimerLines(data.disclaimer) * 40 + 52;
  return (
    HEADER_H + STATS_TOP_GAP + STATS_H + BLOCK_GAP + schedH + BLOCK_GAP + discH + FOOTER_H
  );
}

/** Shrink a headline until it fits, rather than letting it run off the card. */
function fitText(ctx: Ctx, text: string, maxWidth: number, start: number, min: number): number {
  let size = start;
  setFont(ctx, 800, size);
  while (ctx.measureText(text).width > maxWidth && size > min) {
    size -= 3;
    setFont(ctx, 800, size);
  }
  return size;
}

export async function drawDueDateCard(ctx: Ctx, data: DueDateCardData) {
  const W = CARD_W;
  const H = dueDateCardHeight(data);

  // The logo is fetched before anything is painted, so a slow image cannot
  // leave a half-drawn card. A null result just means no logo.
  const logo = data.logoUrl ? await loadImage(data.logoUrl) : null;

  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, W, H);

  // ---- header ----
  const grad = ctx.createLinearGradient(0, 0, W, HEADER_H);
  grad.addColorStop(0, BRAND_900);
  grad.addColorStop(0.55, BRAND_700);
  grad.addColorStop(1, BRAND_500);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, HEADER_H);

  // Soft circles for depth, so the header does not read as a flat rectangle
  // at thumbnail size.
  ctx.save();
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = "#FFFFFF";
  ctx.beginPath();
  ctx.arc(W - 90, 90, 190, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(70, HEADER_H - 40, 130, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";

  // Brand mark. The logo sits on a white pill rather than straight on the
  // gradient: the uploaded logo may be dark-on-transparent (it is designed for
  // a white navbar), and the pill guarantees it stays legible whichever
  // variant an admin uploads.
  if (logo) {
    const logoH = 52;
    const logoW = (logo.naturalWidth / logo.naturalHeight) * logoH;
    const pillW = Math.min(logoW + 40, INNER);
    const pillH = 84;
    fillRoundRect(ctx, P, 48, pillW, pillH, 20, "#FFFFFF");
    ctx.drawImage(logo, P + 20, 48 + (pillH - logoH) / 2, pillW - 40, logoH);
  } else {
    ctx.fillStyle = "rgba(255,255,255,0.82)";
    setFont(ctx, 700, 34);
    ctx.fillText(data.brand, P, 104);
  }

  ctx.fillStyle = "rgba(255,255,255,0.9)";
  setFont(ctx, 600, 38);
  ctx.fillText(data.title, P, 208);

  const size = fitText(ctx, data.edd, INNER, 92, 46);
  ctx.fillStyle = "#FFFFFF";
  setFont(ctx, 800, size);
  ctx.fillText(data.edd, P, 320);

  const barY = 422;
  setFont(ctx, 600, 28);
  ctx.fillStyle = "rgba(255,255,255,0.82)";
  ctx.fillText(data.progressLabel, P, barY - 22);
  ctx.textAlign = "right";
  ctx.fillText(`${data.progressPct}%`, W - P, barY - 22);
  ctx.textAlign = "left";

  fillRoundRect(ctx, P, barY, INNER, 22, 11, "rgba(255,255,255,0.25)");
  const filled = Math.max(22, (INNER * Math.min(100, Math.max(0, data.progressPct))) / 100);
  fillRoundRect(ctx, P, barY, filled, 22, 11, "#FFFFFF");

  // ---- stats, 2x2 ----
  let y = HEADER_H + STATS_TOP_GAP;
  const tileW = (INNER - GAP) / 2;

  data.stats.slice(0, 4).forEach((stat, i) => {
    const x = P + (i % 2) * (tileW + GAP);
    const ty = y + Math.floor(i / 2) * (TILE_H + GAP);

    fillRoundRect(ctx, x, ty, tileW, TILE_H, 22, PAGE);
    ctx.strokeStyle = LINE;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = INK_FAINT;
    setFont(ctx, 600, 27);
    ctx.fillText(stat.label, x + 30, ty + 54);

    // Value shrinks to fit its own tile: "18 August, 2026" is far wider than
    // "First", and both land in this same box.
    let vSize = 46;
    setFont(ctx, 800, vSize);
    while (ctx.measureText(stat.value).width > tileW - 60 && vSize > 24) {
      vSize -= 2;
      setFont(ctx, 800, vSize);
    }
    ctx.fillStyle = INK;
    ctx.fillText(stat.value, x + 30, ty + 116);
  });

  y += STATS_H + BLOCK_GAP;

  // ---- antenatal schedule ----
  // The whole timeline, not just the next visit. This is the part a visitor
  // actually wants on their phone: the dates they have to remember for the rest
  // of the pregnancy, in one picture they can show at the clinic.
  const schedH = SCHED_PAD * 2 + SCHED_TITLE_H + data.checkups.length * SCHED_ROW_H;
  fillRoundRect(ctx, P, y, INNER, schedH, 26, "#FFFFFF");
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = INK;
  setFont(ctx, 800, 36);
  ctx.fillText(data.scheduleTitle, P + SCHED_PAD, y + SCHED_PAD + 36);

  const railX = P + SCHED_PAD + 16;
  const textX = railX + 46;
  const rowsTop = y + SCHED_PAD + SCHED_TITLE_H;

  data.checkups.forEach((row, i) => {
    const ry = rowsTop + i * SCHED_ROW_H;
    const cy = ry + 26;

    const dot =
      row.state === "done" ? ACCENT : row.state === "next" ? WARM : LINE;
    const ring =
      row.state === "done" ? ACCENT_SOFT : row.state === "next" ? WARM_SOFT : PAGE;

    // connector to the row below, drawn first so the dot sits on top
    if (i < data.checkups.length - 1) {
      ctx.strokeStyle = row.state === "done" ? "rgba(34,197,94,0.45)" : LINE;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(railX, cy + 14);
      ctx.lineTo(railX, ry + SCHED_ROW_H + 12);
      ctx.stroke();
    }

    ctx.fillStyle = ring;
    ctx.beginPath();
    ctx.arc(railX, cy, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = dot;
    ctx.beginPath();
    ctx.arc(railX, cy, 11, 0, Math.PI * 2);
    ctx.fill();

    // label
    ctx.fillStyle =
      row.state === "next" ? WARM_TEXT : row.state === "done" ? INK : INK_FAINT;
    setFont(ctx, 800, 30);
    ctx.fillText(row.label, textX, ry + 30);
    const labelW = ctx.measureText(row.label).width;

    // week, immediately after the label
    ctx.fillStyle = INK_GHOST;
    setFont(ctx, 600, 25);
    ctx.fillText(row.week, textX + labelW + 14, ry + 30);
    const weekW = ctx.measureText(row.week).width;

    // "next" chip
    if (row.state === "next") {
      const chipX = textX + labelW + 14 + weekW + 16;
      setFont(ctx, 700, 22);
      const chipW = ctx.measureText(data.nextBadge).width + 26;
      fillRoundRect(ctx, chipX, ry + 8, chipW, 30, 15, WARM_SOFT);
      ctx.strokeStyle = WARM_BORDER;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = WARM_TEXT;
      ctx.fillText(data.nextBadge, chipX + 13, ry + 30);
    }

    // date
    ctx.fillStyle = row.state === "upcoming" ? INK_GHOST : INK_MUTE;
    setFont(ctx, 600, 26);
    ctx.fillText(row.date, textX, ry + 62);
  });

  y += schedH + BLOCK_GAP;

  // ---- disclaimer ----
  // On the card, not just on the page. The picture is going to be forwarded
  // into a group chat with none of the surrounding context, so the one line
  // that says this is an estimate and not a diagnosis has to travel with it.
  // An image that loses that line the moment it is shared would be worse than
  // no image at all.
  const discH = disclaimerLines(data.disclaimer) * 40 + 52;
  fillRoundRect(ctx, P, y, INNER, discH, 20, PAGE);
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = INK_FAINT;
  setFont(ctx, 500, 26);
  drawParagraph(ctx, data.disclaimer, P + 28, y + 46, INNER - 56, 40);

  // ---- footer ----
  ctx.textAlign = "center";
  ctx.fillStyle = INK_FAINT;
  setFont(ctx, 600, 28);
  ctx.fillText(data.footer, W / 2, H - 56);
  ctx.textAlign = "left";
}
