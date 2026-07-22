import Link from "next/link";
import Image from "next/image";
import type { DoctorCardData } from "@/lib/data";
import { localeHref, num, type Locale } from "@/lib/i18n";
import type { Dict } from "@/lib/dict";

const TONES = [
  { bg: "#F0FDFA", fg: "#0F766E" },
  { bg: "#ECFDF5", fg: "#059669" },
  { bg: "#FFF7ED", fg: "#EA580C" },
  { bg: "#EFF6FF", fg: "#2563EB" },
  { bg: "#FDF4FF", fg: "#A21CAF" },
];

function initials(name: string) {
  const words = name.replace(/^(ডা\.?|Dr\.?)\s*/i, "").split(/\s+/).filter(Boolean);
  return words.slice(0, 2).map((w) => w[0]).join("");
}

// Vertical card: portrait-style photo occupies the entire upper half, meta stacks below.
// Featured status is a backend ranking signal only — never shown on the card.
export function DoctorCard({
  doctor,
  helpline,
  locale,
  d,
}: {
  doctor: DoctorCardData;
  helpline: string;
  locale: Locale;
  d: Pick<Dict, "verified_badge" | "new_profile" | "fee" | "taka" | "details" | "book_appointment" | "call_short">;
}) {
  const tone = TONES[doctor.id % TONES.length];
  const L = (path: string) => localeHref(locale, path);
  const detailsHref = L(`/doctors/${doctor.slug}`);

  return (
    <div className="group flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-card transition-all duration-200 hover:-translate-y-1 hover:shadow-cardhover">
      {/* Photo — 16:10 keeps cards compact, degrees stay one line, buttons stack in a tidy T. */}
      <Link href={detailsHref} aria-label={doctor.name} className="relative block aspect-[16/10] w-full overflow-hidden">
        {doctor.photo_url ? (
          <Image
            src={doctor.photo_url}
            alt={doctor.name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 900px) 50vw, (max-width: 1200px) 33vw, 25vw"
            className="object-cover object-top transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center" style={{ background: tone.bg }}>
            <span className="font-heading text-[56px] font-semibold" style={{ color: tone.fg }}>
              {initials(doctor.name)}
            </span>
          </div>
        )}
        {doctor.verified && (
          <span className="absolute right-3 top-3 inline-flex items-center rounded-full bg-white/95 px-2.5 py-1 text-[11.5px] font-bold text-accent-text shadow-[0_2px_6px_rgba(15,23,42,.12)] backdrop-blur">
            {d.verified_badge}
          </span>
        )}
      </Link>

      {/* Meta */}
      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <Link
          href={detailsHref}
          className="font-heading text-[17px] font-semibold leading-snug text-ink hover:text-brand-700"
        >
          {doctor.name}
        </Link>
        {doctor.specialty && (
          <div className="mt-1 text-[13.5px] font-semibold text-brand-600">{doctor.specialty}</div>
        )}
        {doctor.degrees && (
          <div className="mt-1.5 line-clamp-1 text-[13px] leading-relaxed text-ink-mute">{doctor.degrees}</div>
        )}

        <div className="mt-3 flex flex-col gap-1.5 border-t border-line pt-3">
          {doctor.hospital && (
            <div className="flex items-center gap-1.5 text-[13.5px] font-semibold text-brand-700">
              <span aria-hidden className="text-[13px]">🏥</span>
              <span className="line-clamp-1">{doctor.hospital}</span>
            </div>
          )}
          {(doctor.chamber || doctor.area) && (
            <div className="flex items-center gap-1.5 text-[13.5px] text-ink-mute">
              <span aria-hidden className="text-[13px] text-brand-600">◉</span>
              <span className="line-clamp-1">
                {doctor.chamber}
                {doctor.chamber && doctor.area ? ", " : ""}
                {doctor.area}
              </span>
            </div>
          )}
          <div className="mt-0.5 flex items-center justify-between">
            <span className="text-[12.5px] font-normal text-ink-ghost">
              {doctor.verified ? "" : d.new_profile}
            </span>
            {doctor.fee != null && (
              <div className="text-sm font-semibold text-ink">
                {d.fee} {num(doctor.fee, locale)} {d.taka}
              </div>
            )}
          </div>
        </div>

        {/* Actions: Call CTA on top full-width, secondary details + appointment split below. */}
        <div className="mt-auto flex flex-col gap-2 pt-4">
          <a
            href={`tel:${helpline}`}
            className="flex w-full items-center justify-center gap-1.5 rounded-[10px] border-[1.5px] border-warm-border bg-warm-soft py-2.5 text-sm font-bold text-warm no-underline transition-colors hover:bg-warm/10"
          >
            <span aria-hidden>✆</span> {num(helpline, locale)}
          </a>
          <div className="flex gap-2">
            <Link
              href={detailsHref}
              className="w-[35%] shrink-0 inline-flex items-center justify-center rounded-[10px] border-[1.5px] border-brand-600 bg-white px-3 py-2 text-center text-sm font-semibold text-brand-700 transition-colors hover:bg-brand-50"
            >
              {d.details}
            </Link>
            <Link
              href={L(`/appointment/${doctor.slug}`)}
              className="flex-1 inline-flex items-center justify-center rounded-[10px] bg-accent px-3 py-2 text-center text-sm font-bold text-white transition-colors hover:bg-accent-hover"
            >
              {d.book_appointment}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
