import type { Metadata } from "next";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { Breadcrumbs } from "@/components/public/breadcrumbs";
import { JsonLd } from "@/components/json-ld";
import { Icon } from "@/components/icons";
import { getHospitalBySlug, getFaqs, getSpecialties, searchDoctors, type EnrichedDoctor } from "@/lib/data";
import { db } from "@/db";
import { doctorSpecialties, specialties as specialtiesT } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { getSettings } from "@/lib/settings";
import { getEnabledConfig } from "@/lib/integrations";
import { detectArea } from "@/lib/geo";
import { sanitizeHtml } from "@/lib/sanitize";
import { HospitalGallery } from "@/components/public/hospital-gallery";
import { HospitalDoctorList } from "@/components/public/hospital-doctor-list";
import { buildMetadata, findRedirect } from "@/lib/seo";
import { ldMedicalClinic, ldFaq } from "@/lib/seo-utils";
import { getDict } from "@/lib/dict";
import { isLocale, localeHref, num, t, type Locale } from "@/lib/i18n";

type Props = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const h = await getHospitalBySlug(slug, locale);
  if (!h) return {};
  return buildMetadata({
    locale,
    path: `/hospitals/${h.slug}`,
    title: h.meta_title || `${h.name}, ${h.area || (locale === "bn" ? "খুলনা" : "Khulna")}`,
    description:
      h.meta_description ||
      (locale === "bn"
        ? `${h.name} এর ঠিকানা, বিভাগসমূহ, ডাক্তারদের তালিকা ও যোগাযোগের তথ্য। ${h.area || "খুলনা"}, খুলনা।`
        : `${h.name} address, departments, doctors and contact information. ${h.area || "Khulna"}, Khulna.`),
    ogTitle: h.name,
    ogSubtitle: `${h.area || "Khulna"}`,
    ogImage: h.image_url || undefined,
    noTemplate: Boolean(h.meta_title),
  });
}

const ml = (v: any, locale: Locale) => t(v, locale);

export default async function HospitalPage({ params }: Props) {
  const { locale: raw, slug } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const d = getDict(locale);

  const h = await getHospitalBySlug(slug, locale);
  if (!h) {
    const hit = await findRedirect(`/hospitals/${slug}`);
    if (hit) {
      const target = localeHref(locale, hit.to_path);
      if (hit.permanent) permanentRedirect(target);
      redirect(target);
    }
    notFound();
  }

  const geo = await detectArea();
  const [settings, faqs, initialDoctorData, maps, allSpecialties] = await Promise.all([
    getSettings(),
    getFaqs("hospital", h.id, locale),
    searchDoctors({ hospitalId: h.id, page: 1, perPage: 12 }, locale),
    getEnabledConfig("google_maps"),
    getSpecialties(locale, true),
  ]);

  const departmentDetails = h.departments
    .map(deptName => {
      const spec = allSpecialties.find(s => s.name === deptName);
      return spec ? { name: spec.name, slug: spec.slug } : null;
    })
    .filter((d): d is { name: string; slug: string } => d !== null);

  // Enrich doctors with all their specialties for the client-side filter
  const doctorIds = initialDoctorData.rows.map((d) => d.id);
  const specialtyLinks = doctorIds.length > 0 ? await db
    .select({
      doctorId: doctorSpecialties.doctorId,
      specialtyName: specialtiesT.name,
    })
    .from(doctorSpecialties)
    .innerJoin(specialtiesT, eq(specialtiesT.id, doctorSpecialties.specialtyId))
    .where(inArray(doctorSpecialties.doctorId, doctorIds)) : [];

  const specialtyMap = new Map<number, string[]>();
  for (const link of specialtyLinks) {
    const names = specialtyMap.get(link.doctorId) || [];
    const translatedName = ml(link.specialtyName, locale);
    if (translatedName && !names.includes(translatedName)) {
      names.push(translatedName);
    }
    specialtyMap.set(link.doctorId, names);
  }

  const enrichedInitialDoctors = initialDoctorData.rows.map((doc) => ({
    ...doc,
    all_specialties: specialtyMap.get(doc.id) || [doc.specialty].filter(Boolean) as string[],
  }));

  return (
    <div className="mx-auto max-w-site px-5 pb-[60px] pt-[26px]">
      <JsonLd data={[ldMedicalClinic(h, locale), ...(faqs.length > 0 ? [ldFaq(faqs)] : [])]} />
      <Breadcrumbs
        locale={locale}
        items={[{ name: d.breadcrumb_home, path: "/" }, { name: d.nav_hospitals, path: "/hospitals" }, { name: h.name }]}
      />

      {/* Map at the very top */}
      {(() => {
        const trimmed = h.map_url?.trim() || "";
        const looksLikeMap =
          trimmed &&
          (trimmed.includes("google.com/maps") ||
            trimmed.includes("maps.app.goo.gl") ||
            trimmed.includes("goo.gl/maps") ||
            trimmed.includes("maps.google.com"));
        let src: string | null = null;
        if (looksLikeMap) {
          src = trimmed.includes("/maps/embed")
            ? trimmed
            : `https://www.google.com/maps?output=embed&q=${encodeURIComponent(trimmed)}`;
        } else if (maps?.api_key && h.lat && h.lng) {
          src = `https://www.google.com/maps/embed/v1/place?key=${maps.api_key}&q=${h.lat},${h.lng}`;
        }
        if (!src) return null;
        return (
          <div className="mb-6 overflow-hidden rounded-2xl border border-line">
            <iframe
              title={h.name}
              src={src}
              className="h-[260px] w-full border-0 sm:h-[340px] min-[900px]:h-[380px]"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        );
      })()}

      {/* Gallery */}
      {(() => {
        const items = h.gallery.length > 0
          ? h.gallery
          : (h.image_url ? [{ key: "main", url: h.image_url }] : []);
        if (items.length === 0) {
          return (
            <div className="mb-6 flex h-[240px] w-full items-center justify-center overflow-hidden rounded-2xl border border-line bg-brand-50 text-brand-300">
              <Icon name="building" size={72} />
            </div>
          );
        }
        return (
          <div className="mb-6">
            <HospitalGallery
              items={items}
              alt={h.name}
              closeLabel={d.close}
            />
          </div>
        );
      })()}

      {/* Header */}
      <div className="mb-6 rounded-[20px] border border-line bg-white p-[26px]">
        <h1 className="mb-2 mt-0 font-heading text-[clamp(24px,4vw,32px)] font-bold text-ink">{h.name}</h1>
        <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-[14.5px] text-ink-mute">
          <span className="flex items-center gap-1.5">
            <span className="text-brand-600">◉</span>
            {h.address}{h.address && h.area ? ", " : ""}{h.area || d.khulna}
          </span>
          {h.phone && (
            <a href={`tel:${h.phone}`} className="font-semibold text-brand-600">✆ {num(h.phone, locale)}</a>
          )}
        </div>
        {h.description && (
          <div
            className="prose-bn mt-3 max-w-none text-[15px] leading-[1.8] text-ink-mute"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(h.description) }}
          />
        )}
      </div>
      
      <HospitalDoctorList
        departments={departmentDetails}
        settings={settings}
        locale={locale}
        d={d}
        initialDoctors={enrichedInitialDoctors}
        initialTotal={initialDoctorData.total}
      />

      {faqs.length > 0 && (
        <div className="mt-10">
          <h2 className="mb-3.5 mt-0 font-heading text-xl font-bold text-ink">{d.faq_title}</h2>
          <div className="flex flex-col gap-3">
            {faqs.map((f) => (
              <div key={f.id} className="rounded-[14px] border border-line bg-white px-5 py-[18px]">
                <div className="mb-[7px] text-base font-semibold text-ink">{f.question}</div>
                <p className="m-0 text-[14.5px] leading-relaxed text-ink-mute">{f.answer}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
