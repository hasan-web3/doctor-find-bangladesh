import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDoctorBySlug } from "@/lib/data";
import { buildMetadata } from "@/lib/seo";
import { Breadcrumbs } from "@/components/public/breadcrumbs";
import { BookingWizard } from "@/components/public/booking-wizard";
import { DoctorPhoto } from "@/components/public/doctor-photo";
import { getDict } from "@/lib/dict";
import { isLocale, num, localeHref, type Locale } from "@/lib/i18n";

type Props = {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const doc = await getDoctorBySlug(slug, locale);
  if (!doc) return {};
  return buildMetadata({
    locale,
    path: `/appointment/${doc.slug}`,
    title: locale === "bn" ? `অ্যাপয়েন্টমেন্ট বুকিং: ${doc.name}` : `Book Appointment: ${doc.name}`,
    description:
      locale === "bn"
        ? `${doc.name} এর অ্যাপয়েন্টমেন্ট অনলাইনে বুক করুন।`
        : `Book an appointment with ${doc.name} online.`,
    noindex: true,
  });
}

function initials(name: string) {
  return name.replace(/^(ডা\.?|Dr\.?)\s*/i, "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("");
}

export default async function AppointmentPage({ params, searchParams }: Props) {
  const { locale: raw, slug } = await params;
  const sp = await searchParams;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const d = getDict(locale);
  const L = (path: string) => localeHref(locale, path);

  const doc = await getDoctorBySlug(slug, locale);
  if (!doc || !doc.active) notFound();

  const preselectedChamber = sp.chamber ? Number(sp.chamber) : null;

  return (
    <div className="mx-auto max-w-site px-5 pb-[70px] pt-[26px]">
      <Breadcrumbs locale={locale} items={[
        { name: d.breadcrumb_home, path: "/" },
        { name: d.breadcrumb_doctors, path: "/doctors" },
        { name: doc.name, path: `/doctors/${doc.slug}` },
        { name: d.booking_title }
      ]} />
      
      <h1 className="mb-5 font-heading text-[clamp(24px,4vw,30px)] font-bold text-ink">{d.booking_title}</h1>

      {/* selected doctor summary — matching doctor details profile card but without CTA / fee */}
      <div className="mb-6 rounded-[20px] border border-line bg-white p-[26px]">
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
          </div>
        </div>
      </div>

      <BookingWizard
        doctorSlug={doc.slug}
        doctorName={doc.name}
        chambers={doc.chambers}
        initialChamberId={preselectedChamber}
        locale={locale}
        d={d}
      />
    </div>
  );
}
