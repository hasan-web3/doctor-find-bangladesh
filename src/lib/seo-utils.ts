import { localeHref, type Locale, type MLText } from "./i18n";
import { BMDC_VERIFY_URL } from "./bmdc";
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

// NAP (Name, Address, Phone) for the site's own entity.
//
// The phone was always declared, but the address only ever existed as footer
// text — so the single most important local-SEO triple was never available to
// Google in machine-readable form. `settings.address` is one free-text field
// (e.g. "Sonadanga, Khulna, Bangladesh"), so it goes into PostalAddress as
// `streetAddress` with the country pinned to BD rather than being guessed at by
// splitting the string on commas, which would mislabel it the moment an admin
// types the parts in a different order.
function ldPostalAddress(address: string): JsonLd | undefined {
  const value = address.trim();
  if (!value) return undefined;
  return { "@type": "PostalAddress", streetAddress: value, addressCountry: "BD" };
}

// ---------------------------------------------------------------------------
// WHY THIS IS `Organization` AND NOT `MedicalOrganization`.
//
// It was briefly typed `["MedicalOrganization", "Organization"]` on the theory
// that a health site should say so. That was wrong on two counts:
//
//   1. schema.org defines MedicalOrganization as a body that PROVIDES care —
//      a hospital, clinic or institution. This site is a directory. Its own
//      About page states, in both languages, that it runs no chamber and gives
//      no medical care, so the markup contradicted the page.
//   2. MedicalOrganization is a subtype of LocalBusiness, so declaring it put
//      the site through Google's local-business validation and invited it to be
//      read as one physical business at one address. This directory covers
//      every district in Bangladesh; being pinned to the office's own city is
//      the opposite of what it needs.
//
// Plain `Organization` describes a publisher accurately. `knowsAbout` carries
// the topical expertise that MedicalOrganization was reached for, without
// claiming to be a care provider, and `areaServed` states the national scope.
// The office address stays — it is a real trust signal and Organization.address
// means "where the company is", not "where the site applies".
// ---------------------------------------------------------------------------
export function ldOrganization(input: {
  identity: BrandIdentity;
  helpline: string;
  logoUrl: string;
  /** Already localized `settings.address`. Omitted from the graph when blank. */
  address?: string;
  email?: string;
  /** Official brand profiles (Facebook / YouTube / Instagram) for sameAs. */
  socialUrls?: string[];
  /** Already localized site description. */
  description?: string;
  /** Brand card (the site-wide OG image); falls back to the logo. */
  imageUrl?: string;
  /** Localized subject-matter labels for `knowsAbout`. */
  knowsAbout?: string[];
}): JsonLd {
  const { name, alternateName } = input.identity;
  const address = ldPostalAddress(input.address || "");
  const email = (input.email || "").trim();
  const description = (input.description || "").trim();
  const logo = input.logoUrl || siteUrl("/icon.svg");
  const image = (input.imageUrl || "").trim() || logo;
  const knowsAbout = (input.knowsAbout || []).map((v) => v.trim()).filter(Boolean);
  const sameAs = (input.socialUrls || [])
    .map((u) => (typeof u === "string" ? u.trim() : ""))
    .filter((u) => /^https?:\/\//i.test(u));
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": ORG_ID(),
    name,
    ...(alternateName.length > 0 ? { alternateName } : {}),
    url: siteUrl("/"),
    logo,
    // `logo` feeds the knowledge panel; `image` is the generic one Google's
    // Organization validator asks for. Same asset is fine and expected.
    image,
    ...(description ? { description } : {}),
    // Duplicated at the top level as well as inside contactPoint: Google reads
    // Organization.telephone/email directly, and several validators do not
    // descend into contactPoint for the NAP check.
    telephone: `+88${input.helpline}`,
    ...(email ? { email } : {}),
    ...(address ? { address } : {}),
    ...(sameAs.length > 0 ? { sameAs } : {}),
    ...(knowsAbout.length > 0 ? { knowsAbout } : {}),
    areaServed: { "@type": "Country", name: "Bangladesh" },
    contactPoint: {
      "@type": "ContactPoint",
      telephone: `+88${input.helpline}`,
      ...(email ? { email } : {}),
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

/**
 * The doctors a listing page actually renders, as an ItemList.
 *
 * A listing page used to declare only a BreadcrumbList, which says where the
 * page sits but nothing about what is on it. ItemList states plainly that this
 * URL is a ranked list of N physicians and names each one with its canonical
 * URL, which is both a content signal for the hub itself and an extra
 * discovery path to the profile pages.
 *
 * Only the doctors present in the cached HTML are listed — the client-side
 * filter/pagination results are deliberately NOT included, because structured
 * data must describe what the page really shows.
 */
export function ldItemList(
  name: string,
  doctors: { slug: string; name: string }[],
  locale: Locale
): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    numberOfItems: doctors.length,
    itemListOrder: "https://schema.org/ItemListOrderDescending",
    itemListElement: doctors.map((doc, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: doc.name,
      url: siteUrl(localeHref(locale, `/doctors/${doc.slug}`)),
    })),
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
    // addressLocality used to fall back to a hard-coded "Khulna", which put a
    // wrong city into the structured data of every doctor outside Khulna. The
    // doctor row already carries a resolved `district` (chamber first, then
    // hospital — see cardSelect in data.ts), so that is the correct fallback;
    // when even that is empty the field is simply omitted, because a missing
    // locality is a gap while a wrong one is a factual error about a real
    // person's practice.
    address: doc.chambers.length > 0
      ? doc.chambers.map((c) => {
          const locality = c.area || doc.district || "";
          return {
            "@type": "PostalAddress",
            streetAddress: c.address || c.name,
            ...(locality ? { addressLocality: locality } : {}),
            ...(doc.district && locality !== doc.district ? { addressRegion: doc.district } : {}),
            addressCountry: "BD",
          };
        })
      : undefined,
    priceRange: doc.chambers[0] ? priceTier(doc.chambers[0].fee) : undefined,
    // sameAs anchors Google's Knowledge Graph to this physician's canonical
    // profiles (LinkedIn, ResearchGate, verified socials). Big E-E-A-T signal
    // for medical entities — emitted only when at least one URL is present.
    ...(sameAs.length > 0 ? { sameAs } : {}),
    // BMDC registration as a machine-readable credential.
    //
    // A doctor directory is YMYL: Google weighs whether the site can show its
    // practitioners are who it says they are. A registration number issued by
    // the national medical council is the strongest such signal available, and
    // `identifier` / PropertyValue is the property schema.org provides for
    // exactly this.
    //
    // GATED ON `bmdc_verified` AND on the number existing, which are the same
    // two conditions the visible badge on the profile is gated on. That
    // matters: Google's structured-data policy is that markup must reflect
    // content the reader can also see. Emitting a registration number that the
    // page does not display would be marking up invisible content, which is a
    // spam-policy violation rather than a trust signal. The two must move
    // together, so if the badge is ever made conditional on something else,
    // this has to follow.
    ...(doc.bmdc_verified && doc.bmdc_no
      ? {
          identifier: {
            "@type": "PropertyValue",
            // Named as the register calls it, not as our UI labels it, so the
            // value is interpretable without our page for context.
            name: "BMDC Registration Number",
            value: doc.bmdc_no,
            // The authority that issued it. Without this the number is just a
            // string; with it, it points at a register that can be checked.
            url: BMDC_VERIFY_URL,
          },
        }
      : {}),
  };
  // Reviews are emitted as testimonial-style Review nodes. schema.org's Review
  // type requires reviewRating, so without a rating we can't emit them — the
  // rich-result would fail validation. Review text is kept in the DB for the
  // on-page section only.
  return ld;
}

export function ldMedicalClinic(h: {
  name: string; slug: string; address: string; area: string;
  district?: string | null;
  phone: string | null; image_url: string | null; lat: number | null; lng: number | null;
}, locale: Locale): JsonLd {
  // Same rule as ldPhysician: no hard-coded city. The hospital's own thana, then
  // its district, then nothing at all rather than a wrong locality.
  const locality = h.area || h.district || "";
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
      ...(locality ? { addressLocality: locality } : {}),
      ...(h.district && locality !== h.district ? { addressRegion: h.district } : {}),
      addressCountry: "BD",
    },
    geo: h.lat && h.lng ? { "@type": "GeoCoordinates", latitude: h.lat, longitude: h.lng } : undefined,
  };
}

// ---------------------------------------------------------------------------
// HEALTH TOOLS (/tools)
// ---------------------------------------------------------------------------
// Two nodes per tool page, because they answer two different questions.
//
//   MedicalWebPage  — "what is this page about, and can it be trusted?"
//                     This is the YMYL type. `lastReviewed` and `citation` are
//                     the properties Google's own quality guidance for health
//                     content asks for, and they are the reason the standard
//                     each calculator implements is recorded in the registry
//                     rather than left in a comment.
//
//   WebApplication  — "what does this page DO?"
//                     A calculator is a tool, not an article. Declaring it as
//                     a free browser application with a HealthApplication
//                     category is what makes it eligible to be understood as
//                     one rather than as a thin content page.
//
// Neither is marked up with anything the visitor cannot also see on the page:
// the description, the standard and the disclaimer are all rendered. Marking up
// invisible content is a structured-data spam violation, and on a health site
// it is also just dishonest.
// ---------------------------------------------------------------------------

export function ldMedicalWebPage(input: {
  name: string;
  description: string;
  url: string;
  locale: Locale;
  /** The subject, e.g. "Body Mass Index". Rendered on the page as the H1 topic. */
  about: string;
  /** Plain-language name of the standard the maths comes from. */
  citation: string;
  identity: BrandIdentity;
  /** ISO date the content was last checked against its source. */
  lastReviewed?: string;
}): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "MedicalWebPage",
    name: input.name,
    description: input.description,
    url: input.url,
    mainEntityOfPage: { "@type": "WebPage", "@id": input.url },
    inLanguage: input.locale,
    about: { "@type": "MedicalEntity", name: input.about },
    citation: input.citation,
    ...(input.lastReviewed ? { lastReviewed: input.lastReviewed } : {}),
    // `audience` distinguishes a page written for the public from one written
    // for clinicians. Getting this wrong is how health pages end up being
    // assessed against the wrong bar entirely.
    audience: { "@type": "Audience", audienceType: "Patient" },
    isAccessibleForFree: true,
    publisher: { "@id": ORG_ID() },
  };
}

export function ldHealthTool(input: {
  name: string;
  description: string;
  url: string;
  identity: BrandIdentity;
}): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: input.name,
    description: input.description,
    url: input.url,
    applicationCategory: "HealthApplication",
    // No install, no account, no payment — say all three, because "free" on a
    // health tool is a question visitors and crawlers both actually have.
    operatingSystem: "Any",
    browserRequirements: "Requires JavaScript",
    isAccessibleForFree: true,
    offers: { "@type": "Offer", price: "0", priceCurrency: "BDT" },
    provider: { "@id": ORG_ID() },
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
