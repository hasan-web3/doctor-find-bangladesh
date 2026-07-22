import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { Breadcrumbs } from "@/components/public/breadcrumbs";
import { DoctorCard } from "@/components/public/doctor-card";
import { getSpecialtyBySlug, getAreaBySlug, getAreas, searchDoctors, type Area } from "@/lib/data";
import { getSettings } from "@/lib/settings";
import { buildMetadata, findRedirect } from "@/lib/seo";
import { Pagination } from "@/components/public/pagination";
import { getDict } from "@/lib/dict";
import { isLocale, localeHref, type Locale } from "@/lib/i18n";

// The combination "money pages": /specialties/neurology/khalishpur
type Props = { params: Promise<{ locale: string; slug: string; area: string }>; searchParams: Promise<{ page?: string; perPage?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug, area } = await params;
  if (!isLocale(locale)) return {};
  const [spec, areaRow] = await Promise.all([getSpecialtyBySlug(slug, locale), getAreaBySlug(area, locale)]);
  if (!spec || !areaRow) return {};
  const short = spec.name.split(" (")[0];
  return buildMetadata({
    locale,
    path: `/specialties/${spec.slug}/${areaRow.slug}`,
    title: locale === "bn"
      ? `${areaRow.name} এলাকার ${short} ডাক্তার`
      : `${short} Doctors in ${areaRow.name}, Khulna`,
    description: locale === "bn"
      ? `${areaRow.name}, খুলনার অভিজ্ঞ ${spec.name} বিশেষজ্ঞ ডাক্তারদের তালিকা। চেম্বারের ঠিকানা, সময়সূচি ও ভিজিট ফি দেখে সহজে অ্যাপয়েন্টমেন্ট নিন।`
      : `Experienced ${spec.name} specialists in ${areaRow.name}, Khulna. See chamber addresses, schedules and fees, then book easily.`,
    ogTitle: locale === "bn" ? `${areaRow.name}র ${short} ডাক্তার` : `${short} Doctors in ${areaRow.name}`,
    ogSubtitle: locale === "bn" ? "খুলনা" : "Khulna",
  });
}

export default async function SpecialtyAreaPage({ params, searchParams }: Props) {
  const { locale: raw, slug, area } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const d = getDict(locale);
  const L = (path: string) => localeHref(locale, path);
  const sp = await searchParams;

  const [spec, areaRow] = await Promise.all([getSpecialtyBySlug(slug, locale), getAreaBySlug(area, locale)]);
  if (!spec || !areaRow) {
    const hit = await findRedirect(`/specialties/${slug}/${area}`);
    if (hit) {
      const target = L(hit.to_path);
      if (hit.permanent) permanentRedirect(target);
      redirect(target);
    }
    notFound();
  }

  const page = sp.page ? Math.max(1, Number(sp.page)) : 1;
  const perPageOptions = [12, 24, 48, 96];
  const perPage = sp.perPage ? Math.max(1, Number(sp.perPage)) : 12;
  const sanitizedPerPage = perPageOptions.includes(perPage) ? perPage : 12;

  const [settings, { rows, total }] = await Promise.all([
    getSettings(),
    searchDoctors({ specialty: spec.slug, area: areaRow.slug, page, perPage: sanitizedPerPage }, locale),
  ]);
  const totalPages = Math.ceil(total / sanitizedPerPage);
  const short = spec.name.split(" (")[0];

  const pageTitle = locale === "bn"
    ? `${areaRow.name} এলাকার ${short} ডাক্তার`
    : `${short} Doctors in ${areaRow.name}, Khulna`;
  const intro = locale === "bn"
    ? `খুলনার ${areaRow.name} এলাকায় ${spec.name} বিশেষজ্ঞ অভিজ্ঞ ডাক্তারদের তালিকা, চেম্বারের ঠিকানা ও সময়সূচি এক জায়গায়। আপনার কাছের ডাক্তার বেছে নিয়ে সহজে অ্যাপয়েন্টমেন্ট নিন।`
    : `A complete list of experienced ${spec.name} specialists in ${areaRow.name}, Khulna, with chamber addresses and schedules. Pick a doctor near you and book easily.`;

  return (
    <div>
      <div className="[background:linear-gradient(180deg,#F0FDFA,#F8FAFC)]">
        <div className="mx-auto max-w-site px-5 pb-10 pt-[26px]">
          <Breadcrumbs
            locale={locale}
            items={[
              { name: d.breadcrumb_home, path: "/" },
              { name: spec.name, path: `/specialties/${spec.slug}` },
              { name: areaRow.name },
            ]}
          />
          <h1 className="mb-3.5 font-heading text-[clamp(28px,4.5vw,40px)] font-bold text-ink">{pageTitle}</h1>
          <p className="m-0 max-w-[760px] text-base leading-[1.8] text-ink-mute">{intro}</p>
        </div>
      </div>

      <div className="mx-auto max-w-site px-5 py-9">
        {rows.length > 0 ? (
          <>
            <div className="grid grid-cols-1 gap-[18px] sm:grid-cols-2 min-[900px]:grid-cols-3">
              {rows.map((doc) => (
                <DoctorCard key={doc.id} doctor={doc} helpline={settings.helpline} locale={locale} d={d} />
              ))}
            </div>
            <Pagination
              page={page}
              totalPages={totalPages}
              locale={locale}
              perPage={sanitizedPerPage}
              showPerPageSelector
            />
          </>
        ) : (
          <div className="rounded-2xl border border-dashed border-line bg-white p-10 text-center">
            <p className="mb-3 text-ink-faint">
              {locale === "bn"
                ? `${areaRow.name} ${d.no_combo_doctors_1} ${short} ${d.no_combo_doctors_2}`
                : `${areaRow.name} ${d.no_combo_doctors_1} ${short} ${d.no_combo_doctors_2}`}
            </p>
            <Link href={L(`/specialties/${spec.slug}`)} className="font-semibold text-brand-600">
              {d.see_all_spec_prefix} {short} {d.see_all_spec_suffix}
            </Link>
          </div>
        )}

      </div>
    </div>
  );
}
