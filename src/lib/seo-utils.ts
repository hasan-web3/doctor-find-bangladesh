import { localeHref, type Locale } from "./i18n";
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

export function ldOrganization(input: { brandName: string; helpline: string; logoUrl: string }): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: input.brandName,
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

export function ldWebsite(brandName: string, locale: Locale): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: brandName,
    url: siteUrl(localeHref(locale, "/")),
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
}, brandName: string, locale: Locale): JsonLd {
  const url = siteUrl(localeHref(locale, `/blog/${post.slug}`));
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
    publisher: { "@type": "Organization", name: brandName },
    author: { "@type": "Organization", name: brandName },
  };
}
