import { localeHref, type Locale, type MLText } from "./i18n";
import type { DoctorFull } from "./data";

export function siteUrl(path = ""): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL;
  if (!env && process.env.NODE_ENV === "production") {
    throw new Error("NEXT_PUBLIC_SITE_URL must be set in production for canonical URLs and JSON-LD.");
  }
  const base = (env || "http://localhost:3000").replace(/\/$/, "");
  return `${base}${path}`;
}

// ---------- JSON-LD builders (values arrive already localized) ----------
type JsonLd = Record<string, unknown>;

// Stable node ids so Organization and WebSite reference one entity across every
// page instead of Google seeing two unrelated blobs per URL.
const ORG_ID = () => siteUrl("/#organization");
const SITE_ID = () => siteUrl("/#website");

// The SERP "site name" (the line above the blue title) is NOT localized on
// purpose. Google picks ONE name per domain from the homepage's WebSite JSON-LD
// `name`, `og:site_name` and <title>, and falls back to the bare domain
// ("doctorsfindbd.com") when those candidates disagree — which is exactly what
// happened while bn pages advertised "ডক্টরস ফাইন্ড বাংলাদেশ" and en pages
// "Doctors Find Bangladesh". So every page now declares the Latin brand (it
// also visibly matches the domain, another signal Google weighs) and the Bangla
// name rides along as `alternateName`. Titles, descriptions and all on-page
// copy stay bilingual as before — this only affects the site's identity fields.
// `fallback` covers an admin blanking the SEO site name: an empty site name is
// worse than an imperfect one, so we drop back to the brand name rather than
// emit name:"".
export type BrandIdentity = { name: string; alternateName: string[] };

export function brandIdentity(brand: MLText, fallback?: MLText): BrandIdentity {
  const pick = (b: MLText) => ({ en: (b?.en || "").trim(), bn: (b?.bn || "").trim() });
  let { en, bn } = pick(brand);
  if (!en && !bn && fallback) ({ en, bn } = pick(fallback));
  const name = en || bn;
  return { name, alternateName: bn && bn !== name ? [bn] : [] };
}

export function ldOrganization(input: { identity: BrandIdentity; helpline: string; logoUrl: string }): JsonLd {
  const { name, alternateName } = input.identity;
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": ORG_ID(),
    name,
    ...(alternateName.length > 0 ? { alternateName } : {}),
    url: siteUrl("/"),
    logo: input.logoUrl || siteUrl("/icon.svg"),
    contactPoint: {
      "@type": "ContactPoint",
      telephone: `+88${input.helpline}`,
      contactType: "customer service",
      areaServed: "BD",
      availableLanguage: ["Bengali", "English"],
    },
  };
}

export function ldWebsite(identity: BrandIdentity, locale: Locale): JsonLd {
  const { name, alternateName } = identity;
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": SITE_ID(),
    name,
    ...(alternateName.length > 0 ? { alternateName } : {}),
    // Must be the domain root, never the /en variant: Google only accepts the
    // site-name signal from a WebSite whose `url` is the homepage of the site.
    url: siteUrl("/"),
    publisher: { "@id": ORG_ID() },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: siteUrl(localeHref(locale, "/doctors")) + "?q={search_term_string}",
      },
      "query-input": "required name=search_term_string",
    },
  };
}

export function ldBreadcrumb(items: { name: string; path: string }[], locale: Locale): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => {
      const el: JsonLd = { "@type": "ListItem", position: i + 1, name: item.name };
      // Schema.org: last crumb (current page) may omit `item`. Emitting a URL
      // when `path` is empty would incorrectly link the current-page crumb to
      // the homepage, so skip it.
      if (item.path) el.item = siteUrl(localeHref(locale, item.path));
      return el;
    }),
  };
}

function priceTier(fee: number): string {
  if (fee < 500) return "৳";
  if (fee < 1500) return "৳৳";
  return "৳৳৳";
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

// Physician social profiles → sameAs URLs. Only valid https(s) URLs make it in
// so a bad admin paste (bare handle, javascript:) never reaches JSON-LD.
function sameAsUrls(links: DoctorFull["social_links"]): string[] {
  return Object.values(links || {})
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter((v): v is string => /^https?:\/\//i.test(v));
}

export function ldPhysician(doc: DoctorFull, locale: Locale): JsonLd {
  const descRaw = doc.meta_description || (doc.bio ? stripHtml(doc.bio) : "") || doc.degrees || "";
  const description = descRaw.length > 300 ? descRaw.slice(0, 297) + "..." : descRaw || undefined;
  const sameAs = sameAsUrls(doc.social_links);
  const ld: JsonLd = {
    "@context": "https://schema.org",
    "@type": "Physician",
    name: doc.name,
    url: siteUrl(localeHref(locale, `/doctors/${doc.slug}`)),
    image: doc.photo_url || undefined,
    description,
    medicalSpecialty: doc.specialties.map((s: { name: string }) => s.name),
    address: doc.chambers.length > 0
      ? doc.chambers.map((c) => ({
          "@type": "PostalAddress",
          streetAddress: c.address || c.name,
          addressLocality: c.area || (locale === "bn" ? "খুলনা" : "Khulna"),
          addressCountry: "BD",
        }))
      : undefined,
    priceRange: doc.chambers[0] ? priceTier(doc.chambers[0].fee) : undefined,
    // sameAs anchors Google's Knowledge Graph to this physician's canonical
    // profiles (LinkedIn, ResearchGate, verified socials). Big E-E-A-T signal
    // for medical entities — emitted only when at least one URL is present.
    ...(sameAs.length > 0 ? { sameAs } : {}),
  };
  // Reviews are emitted as testimonial-style Review nodes. schema.org's Review
  // type requires reviewRating, so without a rating we can't emit them — the
  // rich-result would fail validation. Review text is kept in the DB for the
  // on-page section only.
  return ld;
}

export function ldMedicalClinic(h: {
  name: string; slug: string; address: string; area: string;
  phone: string | null; image_url: string | null; lat: number | null; lng: number | null;
}, locale: Locale): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "MedicalClinic",
    name: h.name,
    url: siteUrl(localeHref(locale, `/hospitals/${h.slug}`)),
    image: h.image_url || undefined,
    telephone: h.phone || undefined,
    address: {
      "@type": "PostalAddress",
      streetAddress: h.address || h.name,
      addressLocality: h.area || (locale === "bn" ? "খুলনা" : "Khulna"),
      addressCountry: "BD",
    },
    geo: h.lat && h.lng ? { "@type": "GeoCoordinates", latitude: h.lat, longitude: h.lng } : undefined,
  };
}

export function ldFaq(faqs: { question: string; answer: string }[]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };
}

export function ldArticle(post: {
  title: string; slug: string; excerpt: string; cover_url: string | null;
  published_at: string | Date | null; updated_at: string | Date;
}, identity: BrandIdentity, locale: Locale): JsonLd {
  const url = siteUrl(localeHref(locale, `/blog/${post.slug}`));
  // Publisher/author point at the one Organization node (same @id, same name)
  // so article pages reinforce the site identity instead of introducing a
  // second, locale-specific publisher name.
  const publisher = { "@type": "Organization", "@id": ORG_ID(), name: identity.name };
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.excerpt || undefined,
    image: post.cover_url || undefined,
    url,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    datePublished: post.published_at ? new Date(post.published_at).toISOString() : undefined,
    dateModified: new Date(post.updated_at).toISOString(),
    inLanguage: locale,
    publisher,
    author: publisher,
  };
}
