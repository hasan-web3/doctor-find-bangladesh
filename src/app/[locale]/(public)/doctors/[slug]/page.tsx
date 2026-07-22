import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { getDoctorBySlug, getFaqs, searchDoctors } from "@/lib/data";
import { getSettings } from "@/lib/settings";
import { buildMetadata, findRedirect } from "@/lib/seo";
import { ldPhysician, ldFaq } from "@/lib/seo-utils";
import { getEnabledConfig } from "@/lib/integrations";
import { detectArea } from "@/lib/geo";
import { sanitizeHtml } from "@/lib/sanitize";
import { JsonLd } from "@/components/json-ld";
import { Breadcrumbs } from "@/components/public/breadcrumbs";
import { DoctorSlider } from "@/components/public/doctor-slider";
import { DoctorPhoto } from "@/components/public/doctor-photo";
import {
  Facebook,
  GraduationCap,
  Globe,
  Instagram,
  Linkedin,
  Twitter,
  Youtube,
} from "lucide-react";
import { getDict } from "@/lib/dict";
import { isLocale, localeHref, num, date as fmtDate, type Locale } from "@/lib/i18n";

type Props = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const doc = await getDoctorBySlug(slug, locale);
  if (!doc) return {};
  const specialty = doc.specialties[0]?.name || (locale === "bn" ? "বিশেষজ্ঞ" : "Specialist");
  const area = doc.chambers[0]?.area || (locale === "bn" ? "খুলনা" : "Khulna");
  return buildMetadata({
    locale,
    path: `/doctors/${doc.slug}`,
    title: doc.meta_title || `${doc.name}, ${specialty}, ${area}`,
    description:
      doc.meta_description ||
      (locale === "bn"
        ? `${doc.name} (${doc.degrees || specialty})। চেম্বার: ${doc.chambers[0]?.name || "খুলনা"}, ${area}। সময়সূচি, ভিজিট ফি ও অ্যাপয়েন্টমেন্ট এখানে।`
        : `${doc.name} (${doc.degrees || specialty}). Chamber: ${doc.chambers[0]?.name || "Khulna"}, ${area}. Schedule, visit fee and appointments here.`),
    ogTitle: doc.name,
    ogSubtitle: `${specialty} · ${area}`,
    ogImage: doc.photo_url || undefined,
    noTemplate: Boolean(doc.meta_title),
  });
}

function initials(name: string) {
  return name.replace(/^(ডা\.?|Dr\.?)\s*/i, "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("");
}

export default async function DoctorDetailPage({ params }: Props) {
  const { locale: raw, slug } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const d = getDict(locale);
  const L = (path: string) => localeHref(locale, path);

  const [doc, settings, geo] = await Promise.all([
    getDoctorBySlug(slug, locale), getSettings(), detectArea(),
  ]);

  if (!doc || !doc.active) {
    const hit = await findRedirect(`/doctors/${slug}`);
    if (hit) {
      const target = L(hit.to_path);
      if (hit.permanent) permanentRedirect(target);
      redirect(target);
    }
    notFound();
  }

  const socials = [
    { key: "website", Icon: Globe, label: "Website" },
    { key: "linkedin", Icon: Linkedin, label: "LinkedIn" },
    { key: "facebook", Icon: Facebook, label: "Facebook" },
    { key: "twitter", Icon: Twitter, label: "Twitter" },
    { key: "instagram", Icon: Instagram, label: "Instagram" },
    { key: "youtube", Icon: Youtube, label: "YouTube" },
    { key: "researchgate", Icon: GraduationCap, label: "ResearchGate" },
  ]
    .map((s) => ({ ...s, url: doc.social_links[s.key as keyof typeof doc.social_links] }))
    .filter((s) => s.url);


  const docFaqs = await getFaqs("doctor", doc.id, locale);
  const primaryChamber = doc.chambers[0];
  const fee = primaryChamber?.fee;
  const helplineDisplay = locale === "bn" ? settings.helpline_bn : settings.helpline;

  // Suggested doctors: geo-preferred (featured-first within visitor's area), excluding this one.
  const suggested = (await searchDoctors(
    {
      preferLat: geo.lat,
      preferLng: geo.lng,
      preferAreaId: geo.areaId,
      preferDistrictId: geo.districtId,
      perPage: 12,
      excludeId: doc.id,
    },
    locale
  )).rows;

  return (
    <div className="bg-page">
      <JsonLd
        data={[
          ldPhysician(doc, locale),
          ...(docFaqs.length > 0 ? [ldFaq(docFaqs)] : []),
        ]}
      />

      <div className="mx-auto max-w-site px-5 pb-[100px] pt-[26px]">
        <Breadcrumbs
          locale={locale}
          items={[
            { name: d.breadcrumb_home, path: "/" },
            { name: d.breadcrumb_doctors, path: "/doctors" },
            { name: doc.name },
          ]}
        />

        {/* profile header card — photo + info + appointment button at bottom */}
        <div className="rounded-[20px] border border-line bg-white p-[26px]">
          <div className="flex flex-wrap items-start gap-5 sm:gap-7">
            <div className="w-full sm:w-auto mx-auto sm:mx-0">
              <DoctorPhoto
                src={doc.photo_url}
                alt={doc.name}
                initials={initials(doc.name)}
                closeLabel={d.close}
              />
            </div>
            <div className="min-w-[220px] flex-1">
              <div className="mb-1 flex flex-wrap items-center gap-2.5">
                <h1 className="m-0 font-heading text-[26px] font-bold text-ink">{doc.name}</h1>
                {doc.verified && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-bold text-accent-text">
                    {d.verified_badge}
                  </span>
                )}
              </div>
              {doc.specialties.length > 0 && (
                <div className="mb-2 text-base font-semibold text-brand-600">
                  {doc.specialties.map((s, i) => (
                    <span key={s.id}>
                      {i > 0 && ", "}
                      <Link href={L(`/specialties/${s.slug}`)} className="hover:underline">{s.name}</Link>
                    </span>
                  ))}{" "}
                  {d.specialist}
                </div>
              )}
              {doc.hospital && (
                <div className="mb-2 flex items-center gap-2 text-sm">
                  <span aria-hidden className="text-[15px]">🏥</span>
                  <Link href={L(`/hospitals/${doc.hospital.slug}`)} className="font-semibold text-brand-700 hover:underline">
                    {doc.hospital.name}
                  </Link>
                </div>
              )}
              {doc.degrees && <div className="mb-3 text-[14.5px] md:text-[17px] text-ink-mute">{doc.degrees}</div>}
              
              <div className="flex flex-wrap gap-5 text-sm md:text-[15.5px] text-ink-mute">
                {doc.experience_years != null && (
                  <span>{d.experience}: <b className="text-ink">{num(doc.experience_years, locale)}{d.years_plus}</b></span>
                )}
                {doc.patients_served && (
                  <span>{d.patients_served_label}: <b className="text-ink">{doc.patients_served}</b></span>
                )}
              </div>

              {socials.length > 0 && (
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  {socials.map(({ key, url, Icon, label }) => (
                    <a
                      key={key}
                      href={url!}
                      title={label}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-slate-50/50 text-slate-500 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:scale-105 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-600 hover:shadow-md"
                    >
                      <Icon className="h-5 w-5" />
                    </a>
                  ))}
                </div>
              )}
            </div>
            
            <div className="w-full shrink-0 basis-full md:ml-auto md:w-auto md:basis-auto">
              <Link
                href={L(`/appointment/${doc.slug}`)}
                className="block w-full rounded-xl bg-accent px-8 py-3 text-center font-bold text-white transition-colors hover:bg-accent-hover"
              >
                {d.book_appointment}
              </Link>
            </div>

          </div>
        </div>
        

        {/* content card */}
        <div className="mt-4 rounded-2xl border border-line bg-white p-6">
              {doc.bio && (
                <>
                  <h2 className="mb-3 font-heading text-[22px] md:text-[26px] font-bold text-ink">{d.about_doctor}</h2>
                  <div
                    className="prose-bn mb-5"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(doc.bio) }}
                  />
                </>
              )}
        </div>
        
        <div className="mt-4 rounded-2xl border border-line bg-white p-6">
              <h2 className="mb-4 mt-0 font-heading text-[22px] md:text-[26px] font-bold text-ink">{d.chambers_schedule}</h2>
              {doc.chambers.length > 0 ? (
                doc.chambers.map((c) => (
                  <div key={c.id} className="mb-5 rounded-[14px] border border-line p-6">
                    <div className="mb-4 text-[22px] font-bold text-ink">{c.name}</div>
                    <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-ink-mute md:text-[18px]">
                      {(c.address || c.area) && (
                        <div className="flex items-center gap-2">
                          <span className="text-lg text-brand-600">◉</span>
                          <span className="leading-snug">
                            {c.address}
                            {c.address && c.area ? ", " : ""}
                            {c.area}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-ink">{d.fee}:</span>
                        <span className="font-bold text-brand-700">
                          {num(c.fee, locale)} {d.taka}
                        </span>
                      </div>
                      {c.phone && (
                        <a href={`tel:${c.phone}`} className="flex items-center gap-1.5 font-semibold text-brand-600 hover:underline">
                          <span className="text-base">✆</span>
                          <span>{num(c.phone, locale)}</span>
                        </a>
                      )}
                    </div>
                    {c.schedule.length > 0 && (
                      <div className="flex flex-col gap-2.5">
                        {c.schedule.map((s, i) => (
                          <div key={i} className="flex flex-col gap-1.5 rounded-[10px] bg-page px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                            <span className="text-base font-semibold text-ink">{s.days}</span>
                            <span className="text-base font-bold text-brand-700">{s.time}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <ChamberMap mapUrl={c.map_url} lat={c.lat} lng={c.lng} name={c.name} />
                    {/* Per-chamber CTA — pre-selects this chamber in the appointment form. */}
                    <div className="mt-4 flex justify-center md:justify-start">
                      <Link
                        href={L(`/appointment/${doc.slug}?chamber=${c.id}`)}
                        className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-[14px] font-bold text-white transition-colors hover:bg-accent-hover"
                      >
                        {d.book_appointment}
                      </Link>
                    </div>
                  </div>
                ))
              ) : (
                <p className="mb-4 text-sm text-ink-faint">{d.chamber_info_soon}</p>
              )}

              {docFaqs.length > 0 && (
                <>
                  <h2 className="mb-3 font-heading text-lg font-bold text-ink">{d.faq_title}</h2>
                  <div className="mb-5 flex flex-col gap-3">
                    {docFaqs.map((f) => (
                      <div key={f.id} className="rounded-[14px] border border-line p-4">
                        <div className="mb-1.5 text-[15px] font-semibold text-ink">{f.question}</div>
                        <p className="m-0 text-sm leading-relaxed text-ink-mute">{f.answer}</p>
                      </div>
                    ))}
                  </div>
                </>
              )}
        </div>

        <div className="mt-4 rounded-2xl border border-line bg-white p-6">
              <h2 className="mb-3 font-heading text-[22px] md:text-[26px] font-bold text-ink">{d.patient_reviews}</h2>
              {doc.reviews.length > 0 ? (
                <div className="flex flex-col gap-3.5">
                  {doc.reviews.map((r) => (
                    <div key={r.id} className="rounded-[14px] border border-line p-4">
                      <div className="mb-2 flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 font-heading text-[15px] font-semibold text-brand-700">
                          {initials(r.name)}
                        </div>
                        <div className="flex-1">
                          <div className="text-[14.5px] font-bold text-ink">{r.name}</div>
                          <div className="text-[12.5px] text-ink-ghost">
                            {r.area_text ? `${r.area_text} · ` : ""}{fmtDate(r.created_at, locale)}
                          </div>
                        </div>
                      </div>
                      {r.body && <p className="m-0 text-[14.5px] leading-relaxed text-ink-mute">{r.body}</p>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-ink-faint">{d.no_reviews}</p>
              )}
        </div>

        {/* suggested doctors — geo-aware (visitor's area first, then nearest) */}
        {suggested.length > 0 && (
          <div className="mt-4 rounded-2xl border border-line bg-white p-6">
            <div className="mb-6 flex flex-col gap-3.5 md:flex-row md:items-center md:justify-between">
              <h2 className="m-0 font-heading text-[22px] md:text-[26px] font-bold text-ink">
                {d.similar_doctors_sub}
              </h2>
              <Link
                href={L("/doctors")}
                className="inline-flex items-center justify-center rounded-[10px] border-[1.5px] border-brand-600 bg-white px-4 py-2.5 text-sm font-bold text-brand-700 transition-colors hover:bg-brand-50 whitespace-nowrap w-full md:w-auto text-center"
              >
                {d.view_all}
              </Link>
            </div>
            <DoctorSlider slides={suggested} helpline={settings.helpline} locale={locale} d={d} />
          </div>
        )}

    </div>

    </div>
  );
}

// Chamber map: prefer the admin-pasted URL (Google Maps embed src, share URL,
// or a maps.app.goo.gl link) — falls back to lat/lng + our own API key only if
// there is no pasted URL. Returns null when nothing is available so the section
// disappears cleanly from the DOM.
async function ChamberMap({
  mapUrl,
  lat,
  lng,
  name,
}: {
  mapUrl: string | null;
  lat: number | null;
  lng: number | null;
  name: string;
}) {
  // Case 1: admin pasted a URL. Only treat it as a map if it actually looks
  // like Google Maps — arbitrary strings would just produce the world-view
  // embed, which is misleading. `output=embed` is the share-URL fallback;
  // `/maps/embed` is the official embed src.
  const trimmed = mapUrl?.trim() || "";
  const looksLikeMap =
    trimmed &&
    (trimmed.includes("google.com/maps") ||
      trimmed.includes("maps.app.goo.gl") ||
      trimmed.includes("goo.gl/maps") ||
      trimmed.includes("maps.google.com"));
  if (looksLikeMap) {
    const src = trimmed.includes("/maps/embed")
      ? trimmed
      : `https://www.google.com/maps?output=embed&q=${encodeURIComponent(trimmed)}`;
    return (
      <div className="mt-3.5 overflow-hidden rounded-xl border border-line">
        <iframe
          title={name}
          src={src}
          className="h-[260px] w-full border-0"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>
    );
  }

  // Case 2: no pasted URL, but coordinates are set + API key is configured.
  if (lat != null && lng != null) {
    const maps = await getEnabledConfig("google_maps");
    if (maps?.api_key) {
      return (
        <div className="mt-3.5 overflow-hidden rounded-xl border border-line">
          <iframe
            title={name}
            src={`https://www.google.com/maps/embed/v1/place?key=${maps.api_key}&q=${lat},${lng}`}
            className="h-[220px] w-full border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      );
    }
  }

  return null;
}
