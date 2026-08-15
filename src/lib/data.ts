import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { and, asc, desc, eq, exists, gte, ilike, inArray, isNull, lte, or, sql, type SQL } from "drizzle-orm";
import { haversineKm } from "./geo";
import { db } from "@/db";
import {
  areas as areasT,
  districts,
  blogCategories,
  blogPosts,
  chambers as chambersT,
  doctorSpecialties,
  doctors as doctorsT,
  faqs as faqsT,
  faqDisabled,
  heroSlides,
  hospitals as hospitalsT,
  promotions as promotionsT,
  reviews as reviewsT,
  specialties as specialtiesT,
  testimonials as testimonialsT,
  type SocialLinks,
} from "@/db/schema";
import { t, type Locale, type MLText } from "./i18n";
import type { GeoResult } from "./geo";
import type { FaqSeed } from "./faq-defaults";

// ==========================================================================
// Public data-layer readers. Everything here returns already-localized strings
// (English falls back to Bangla via `t()`). Drizzle keeps input types honest;
// output types are shaped by hand because we localize on the fly.
// ==========================================================================

// ---------- localized shapes ----------
export type Specialty = {
  id: number; slug: string; name: string; icon: string; tint: number;
  name_ml?: MLText;
  intro: string; meta_title: string; meta_description: string;
  active: boolean; sort: number; doctor_count: number;
};

export type Area = {
  id: number; slug: string; name: string; district_id: number | null; district: string;
  district_slug: string | null;
  lat: number | null; lng: number | null; intro: string;
  meta_title: string; meta_description: string; active: boolean; sort: number;
  doctor_count: number;
};

// The subset of `Area` that list views, filter dropdowns and link chips
// actually render. Deliberately excludes `intro` / `meta_title` /
// `meta_description`: those three JSONB columns are 89% of the `areas` table's
// byte weight (measured: 835 KB of 997 KB across 619 rows) and are rendered
// ONLY on the thana detail page, which reads a single row via getAreaBySlugs().
// Shipping them with every list read was the second-largest source of Supabase
// egress in the app.
export type AreaLight = {
  id: number; slug: string; name: string;
  district_id: number | null; district: string; district_slug: string | null;
  lat: number | null; lng: number | null;
};

export type District = {
  id: number;
  slug: string;
  name: string;
  lat: number | null;
  lng: number | null;
  intro: string;
  meta_title: string;
  meta_description: string;
  active: boolean;
  sort: number;
  thana_count: number;
  doctor_count: number;
};

export type Hospital = {
  id: number; slug: string; name: string; area_id: number | null; area: string; area_slug: string | null; district_slug: string | null;
  // Localized district NAME (the slug alone can't be printed). Needed so the
  // hospital page and its MedicalClinic JSON-LD can state a real locality
  // instead of the hard-coded "Khulna" they used to fall back to.
  district: string;
  address: string; phone: string | null; lat: number | null; lng: number | null;
  description: string; departments: string[]; map_url: string | null; image_url: string | null; image_key: string | null;
  gallery: { key: string; url: string }[]; meta_title: string; meta_description: string;
  active: boolean; doctor_count: number;
};

// The two verification badges a doctor can carry. They are mutually exclusive
// at the database level (see migrations/020_doctor_bmdc.sql), so the UI only
// ever has to render one — but `bmdc` is checked first everywhere regardless,
// so a row that somehow held both would still show the stronger, checkable
// claim rather than the weaker one.
export type DoctorCardData = {
  id: number; slug: string; name: string; degrees: string; photo_url: string | null;
  verified: boolean;
  bmdc_verified: boolean;
  // Only the number rides along on cards. Registration year and expiry are
  // profile-page detail and would be dead weight in every listing query.
  bmdc_no: string | null;
  specialty: string; specialty_slug: string | null;
  hospital: string; hospital_slug: string | null;
  chamber: string; area: string; area_slug: string | null; fee: number | null;
  // Phone of the doctor's first visible chamber that actually has one. Null
  // when the doctor has no visible chamber, or none of them carry a number —
  // callers then fall back to the site helpline.
  chamber_phone: string | null;
  // The doctor's district, resolved chamber-first then hospital. Drives the
  // dynamic place name in headings when the visitor's own district turns out
  // to have no doctors.
  district: string; district_slug: string | null;
  experience_years: number | null;
};

// DoctorFull overrides `hospital` to a full object (not the card's string).
export type DoctorFull = Omit<DoctorCardData, "hospital"> & {
  bio: string; gender: string | null; experience_years: number | null;
  patients_served: string; photo_key: string | null; active: boolean;
  // BMDC detail the profile shows and the explainer modal quotes. `bmdc_no`
  // and `bmdc_verified` come from DoctorCardData; these two are profile-only.
  // `bmdc_valid_till` is an ISO yyyy-mm-dd string, never a Date: the value is a
  // calendar day, and serialising it through a Date would shift it by a
  // timezone on the way to the client component.
  bmdc_reg_year: number | null;
  bmdc_valid_till: string | null;
  // Locale-resolved list of conditions this doctor treats (stored in DB as
  // bilingual `{ bn: [], en: [] }` JSONB). Empty array when unset.
  treated_conditions: string[];
  meta_title: string; meta_description: string;
  // Verified social profiles for JSON-LD `sameAs` (Knowledge Panel eligibility).
  social_links: SocialLinks;
  // Linked taxonomy specialties first, then this doctor's own free-text ones.
  // A null `slug` marks the free-text entries: they have no page, so the UI
  // renders them as plain text instead of a link. See DoctorInitial in the
  // admin doctor form and migrations/011_doctor_custom_specialties.sql.
  specialties: { id: number | null; slug: string | null; name: string }[];
  hospital: { id: number; slug: string; name: string } | null;
  chambers: {
    id: number; name: string; address: string; fee: number;
    area: string; area_slug: string | null; area_id: number | null;
    phone: string | null; lat: number | null; lng: number | null;
    map_url: string | null;
    schedule: { days: string; time: string }[];
  }[];
  reviews: { id: number; name: string; area_text: string | null; body: string | null; created_at: string }[];
};

const ml = (v: unknown, locale: Locale) => t(v as MLText, locale);

// ---------- doctor-card SELECT + LATERAL joins ----------
// A doctor "card" bundles: doctor row + primary specialty + top chamber +
// top-chamber area. Drizzle can't express LATERAL joins natively yet, so we
// compose the SQL with the `sql` builder and get typed row output.

type CardRow = {
  id: number; slug: string;
  name_ml: MLText; degrees_ml: MLText;
  photo_url: string | null; verified: boolean;
  bmdc_verified: boolean; bmdc_no: string | null;
  specialty_ml: MLText | null; specialty_slug: string | null;
  hospital_ml: MLText | null; hospital_slug: string | null;
  chamber_ml: MLText | null; area_ml: MLText | null; area_slug: string | null;
  district_ml: MLText | null; district_slug: string | null;
  fee: number | null;
  chamber_phone: string | null;
  experience_years: number | null;
};

const cardSelect = sql`
  d.id, d.slug, d.name AS name_ml, d.degrees AS degrees_ml, d.photo_url, d.verified,
  d.bmdc_verified, d.bmdc_no,
  -- Cards print ONE specialty. A doctor whose only specialty is free text has
  -- no row in doctor_specialties, so fall back to their first custom entry —
  -- otherwise their card renders with a blank specialty line. The ->0 lookup
  -- yields the same {bn,en} shape the taxonomy name has, and NULL when the
  -- array is empty.
  COALESCE(sp.name, d.custom_specialties->0) AS specialty_ml, sp.slug AS specialty_slug,
  hp.name AS hospital_ml, hp.slug AS hospital_slug,
  ch.name AS chamber_ml,
  -- Locality for the card, in the order the admin filled it in:
  --   1. the chamber's own free-text thana (tested on CONTENT, so a stored {}
  --      or {"bn":"","en":""} can't beat a real name),
  --   2. the chamber's linked thana,
  --   3. the hospital's thana — but ONLY for a doctor with no visible chamber.
  -- That last guard matters: a chamber that names a district and no thana used
  -- to borrow the hospital's thana, so the card could read "Khalishpur" (a
  -- Khulna thana) while the district beside it said "Dhaka". It also matches
  -- the area filter and getAreasForGeo, which have always treated the hospital
  -- as a fallback only when no visible chamber exists.
  CASE
    WHEN COALESCE(ch.custom_area->>'bn', '') <> '' OR COALESCE(ch.custom_area->>'en', '') <> ''
      THEN ch.custom_area
    WHEN ar.name IS NOT NULL THEN ar.name
    WHEN ch.name IS NULL THEN har.name
  END AS area_ml,
  -- Slug tracks the LINKED thana only: free text has no page to point at, and
  -- the card renders the area as plain text anyway.
  CASE
    WHEN ar.slug IS NOT NULL THEN ar.slug
    WHEN ch.name IS NULL THEN har.slug
  END AS area_slug,
  dist.name AS district_ml, dist.slug AS district_slug,
  ch.fee,
  chph.phone AS chamber_phone,
  d.experience_years`;

// A doctor resolves to exactly ONE place, and the priority is the same
// everywhere on the site: their first visible chamber, and only if they have
// none, their profile-linked hospital. Without the hospital backup a doctor
// whose chambers are all hidden (or who has none at all) renders with a blank
// area and no district, which is what made a Bhola visitor see Khulna doctors
// under a "Bhola" heading.
const cardFrom = sql`
  FROM doctors d
  LEFT JOIN LATERAL (
    SELECT s.name, s.slug FROM doctor_specialties ds
    JOIN specialties s ON s.id = ds.specialty_id
    WHERE ds.doctor_id = d.id
    ORDER BY ds.is_primary DESC, s.sort LIMIT 1
  ) sp ON TRUE
  LEFT JOIN hospitals hp ON hp.id = d.hospital_id
  LEFT JOIN LATERAL (
    SELECT c.name, c.fee, c.area_id, c.district_id, c.custom_area FROM chambers c
    WHERE c.doctor_id = d.id AND c.visible ORDER BY c.sort LIMIT 1
  ) ch ON TRUE
  -- Contact number shown on the card. Kept as its OWN lateral rather than
  -- reading ch.phone: the top chamber decides name/fee/area, but it may have
  -- been saved without a phone, and in that case the doctor's next visible
  -- chamber still has a perfectly good number to call. Falls back to NULL so
  -- the UI can drop to the site helpline.
  LEFT JOIN LATERAL (
    SELECT c.phone FROM chambers c
    WHERE c.doctor_id = d.id AND c.visible AND COALESCE(TRIM(c.phone), '') <> ''
    ORDER BY c.sort, c.id LIMIT 1
  ) chph ON TRUE
  LEFT JOIN areas ar ON ar.id = ch.area_id
  LEFT JOIN areas har ON har.id = hp.area_id
  -- ch.district_id sits between the two on purpose: a chamber where the admin
  -- chose a district but no thana has no area row to derive one from, and
  -- before it was stored such a doctor rendered with no district at all and
  -- fell out of that district's listing. The hospital's district stays a
  -- last resort for doctors with no visible chamber — same guard as area_ml.
  LEFT JOIN districts dist ON dist.id = COALESCE(
    ar.district_id,
    ch.district_id,
    CASE WHEN ch.name IS NULL THEN har.district_id END
  )`;

function mapDoctorCard(row: CardRow, locale: Locale): DoctorCardData {
  return {
    id: row.id,
    slug: row.slug,
    name: ml(row.name_ml, locale),
    degrees: ml(row.degrees_ml, locale),
    photo_url: row.photo_url ?? null,
    verified: row.verified,
    bmdc_verified: row.bmdc_verified,
    bmdc_no: row.bmdc_no ?? null,
    specialty: ml(row.specialty_ml, locale),
    specialty_slug: row.specialty_slug ?? null,
    hospital: ml(row.hospital_ml, locale),
    hospital_slug: row.hospital_slug ?? null,
    chamber: ml(row.chamber_ml, locale),
    area: ml(row.area_ml, locale),
    area_slug: row.area_slug ?? null,
    district: ml(row.district_ml, locale),
    district_slug: row.district_slug ?? null,
    fee: row.fee ?? null,
    chamber_phone: row.chamber_phone?.trim() || null,
    experience_years: row.experience_years ?? null,
  };
}

// ---------- taxonomy ----------
export const getSpecialties = unstable_cache(
  async (locale: Locale, raw = false) => {
    const doctorCount = sql<number>`(
      SELECT COUNT(*)::int FROM doctor_specialties ds
      JOIN doctors d ON d.id = ds.doctor_id AND d.active
      WHERE ds.specialty_id = "specialties"."id"
    )`.as("doctor_count");

    const rows = await db
      .select({
        id: specialtiesT.id,
        slug: specialtiesT.slug,
        name: specialtiesT.name,
        icon: specialtiesT.icon,
        tint: specialtiesT.tint,
        intro: specialtiesT.intro,
        metaTitle: specialtiesT.metaTitle,
        metaDescription: specialtiesT.metaDescription,
        active: specialtiesT.active,
        sort: specialtiesT.sort,
        doctorCount,
      })
      .from(specialtiesT)
      .where(eq(specialtiesT.active, true))
      .orderBy(asc(specialtiesT.sort), asc(specialtiesT.id));
    
    if (raw) return rows.map(s => ({
      ...s,
      name: ml(s.name, locale),
      name_ml: s.name,
      intro: ml(s.intro, locale),
      meta_title: ml(s.metaTitle, locale),
      meta_description: ml(s.metaDescription, locale),
      doctor_count: s.doctorCount
    }));

    return rows.map((s): Specialty => ({
      id: s.id, slug: s.slug,
      // Keep the raw bilingual name alongside the localized one. Filter
      // dropdowns need the other language to make their search box match
      // either script — see FilterOption.labelAlt.
      name_ml: s.name,
      name: ml(s.name, locale), icon: s.icon, tint: s.tint,
      intro: ml(s.intro, locale), meta_title: ml(s.metaTitle, locale),
      meta_description: ml(s.metaDescription, locale),
      active: s.active, sort: s.sort,
      doctor_count: s.doctorCount,
    }));
  },
  ["specialties-list"],
  // NOT tagged "doctors", despite carrying `doctor_count`. This reader is in the
  // shared layout (the footer's specialty links), and a page's cache entry
  // inherits every tag it reads — so a "doctors" tag here would make one doctor
  // edit invalidate every page on the site. The count is an informational
  // number next to a link; letting it lag is the right trade for keeping
  // invalidation targeted.
  //
  // `revalidate` is what makes that trade honest. Without it this entry is
  // INFINITE, and the page's own window cannot save it: a page re-render at
  // 24h re-reads the very same cached entry and gets the very same stale count.
  // So the count only moved when someone edited a specialty — adding fifty
  // doctors changed nothing. The number now self-heals within a day.
  //
  // Why exactly 86400 and not less: a page's revalidate is clamped to the
  // SHORTEST revalidate of any cache entry it reads (see searchDoctorsCached),
  // and this one is reached from the layout, so it clamps EVERY page. 86400
  // matches the longest page window on the site, which makes the clamp a no-op.
  // Lowering this silently shortens every route in the app.
  { revalidate: 86400, tags: ["specialties"] }
);

// The thana list every listing page, filter dropdown and link chip reads.
//
// This replaced a reader that also selected `intro`, `meta_title` and
// `meta_description` for all 619 rows — 1.6 KB per row where ~130 B is used, so
// roughly 1 MB per call to render a set of name+slug chips. Those three columns
// now travel only on the single-row detail reads below.
//
// NOT tagged "doctors" any more either, because it no longer carries a
// doctor_count: nothing here changes when a doctor is edited, and the old tag
// meant every doctor mutation threw away a megabyte-sized entry that several
// pages then re-fetched. Ordering is unchanged (`sort`, then `id`) so callers
// that slice the head of this list see exactly what they saw before.
export const getAreasLight = unstable_cache(
  async (locale: Locale): Promise<AreaLight[]> => {
    const rows = await db
      .select({
        id: areasT.id,
        slug: areasT.slug,
        name: areasT.name,
        districtId: areasT.districtId,
        district: areasT.district,
        districtSlug: districts.slug,
        lat: areasT.lat,
        lng: areasT.lng,
      })
      .from(areasT)
      .leftJoin(districts, eq(areasT.districtId, districts.id))
      .where(eq(areasT.active, true))
      .orderBy(asc(areasT.sort), asc(areasT.id));

    return rows.map((a): AreaLight => ({
      id: a.id, slug: a.slug,
      name: ml(a.name, locale),
      district_id: a.districtId, district: ml(a.district, locale),
      district_slug: a.districtSlug,
      lat: a.lat, lng: a.lng,
    }));
  },
  ["areas-light-v1"],
  { revalidate: 86400, tags: ["areas", "districts"] }
);

// Active thana slugs, for the sitemap's "can this URL actually resolve?" check.
// Same tag as the readers the pages use, so the two stay in lockstep — but ~12 KB
// instead of the 1 MB the full list used to cost for a Set of strings.
export const getAllActiveAreaSlugs = unstable_cache(
  async () =>
    (await db.select({ slug: areasT.slug }).from(areasT).where(eq(areasT.active, true)))
      .map((r) => r.slug),
  ["all-active-area-slugs-v1"],
  { tags: ["areas"] }
);

export const getSpecialtyBySlug = async (slug: string, locale: Locale) =>
  (await getSpecialties(locale)).find((s) => s.slug === slug) ?? null;

// ---------- single-row detail reads ----------
// These used to load all 619 areas and `.find()` the one wanted. `areas.slug`
// carries a UNIQUE constraint (src/db/schema.ts), so the slug lookup resolves to
// at most one row and the filter belongs in SQL. Full column set here — the
// detail page renders `intro` and both meta fields — but for ONE row that is
// ~1.6 KB rather than ~1 MB.
const areaDoctorCountSql = sql<number>`(
  SELECT COUNT(DISTINCT c.doctor_id)::int FROM chambers c
  JOIN doctors d ON d.id = c.doctor_id AND d.active
  WHERE c.area_id = "areas"."id" AND c.visible
)`.as("doctor_count");

async function selectAreaRow(where: SQL | undefined, locale: Locale): Promise<Area | null> {
  const [a] = await db
    .select({
      id: areasT.id,
      slug: areasT.slug,
      name: areasT.name,
      districtId: areasT.districtId,
      district: areasT.district,
      districtSlug: districts.slug,
      lat: areasT.lat,
      lng: areasT.lng,
      intro: areasT.intro,
      metaTitle: areasT.metaTitle,
      metaDescription: areasT.metaDescription,
      active: areasT.active,
      sort: areasT.sort,
      doctorCount: areaDoctorCountSql,
    })
    .from(areasT)
    .leftJoin(districts, eq(areasT.districtId, districts.id))
    .where(where)
    .limit(1);

  if (!a) return null;
  return {
    id: a.id, slug: a.slug,
    name: ml(a.name, locale), district_id: a.districtId, district: ml(a.district, locale),
    district_slug: a.districtSlug,
    lat: a.lat, lng: a.lng,
    intro: ml(a.intro, locale), meta_title: ml(a.metaTitle, locale),
    meta_description: ml(a.metaDescription, locale),
    active: a.active, sort: a.sort,
    doctor_count: a.doctorCount,
  };
}

export const getAreaBySlug = unstable_cache(
  async (slug: string, locale: Locale) =>
    selectAreaRow(and(eq(areasT.slug, slug), eq(areasT.active, true)), locale),
  ["area-by-slug-v1"],
  // Safe to tag "doctors" here (unlike the list readers): these detail readers
  // are reached only from the thana pages, never from the shared layout, so the
  // tag cannot cascade a doctor edit across the whole site. Matches the
  // freshness the previous getAreas-backed lookup had.
  { revalidate: 86400, tags: ["areas", "districts", "doctors"] }
);

export const getAreaBySlugs = unstable_cache(
  async (districtSlug: string, areaSlug: string, locale: Locale) =>
    selectAreaRow(
      and(
        eq(areasT.slug, areaSlug),
        eq(areasT.active, true),
        eq(districts.slug, districtSlug),
      ),
      locale,
    ),
  ["area-by-slugs-v1"],
  { revalidate: 86400, tags: ["areas", "districts", "doctors"] }
);

// One district, by slug.
//
// This was the single largest egress consumer in the application: a bare
// `db.select()` (which Drizzle expands to ALL 13 columns, including the three
// fat SEO JSONB fields) over ALL 64 active districts, filtered in JS with
// `.find()`, uncached, and called twice per render — once in generateMetadata
// and once in the page body. Measured at ~200 KB transferred per page render to
// deliver ~1.6 KB of useful data.
//
// `districts.slug` is UNIQUE, so the lookup is a one-row index hit. `cache()`
// wraps the cached reader so the metadata call and the body call share one
// result within a single render.
export const getDistrictBySlug = cache(
  unstable_cache(
    async (slug: string, locale: Locale) => {
      const [d] = await db
        .select({
          id: districts.id,
          slug: districts.slug,
          name: districts.name,
          lat: districts.lat,
          lng: districts.lng,
          intro: districts.intro,
          metaTitle: districts.metaTitle,
          metaDescription: districts.metaDescription,
          // Dropped vs the old `select()`: active (implied by the WHERE),
          // sort, priority_enabled, created_at, updated_at — none are read by
          // any caller.
        })
        .from(districts)
        .where(and(eq(districts.slug, slug), eq(districts.active, true)))
        .limit(1);

      if (!d) return null;
      return {
        id: d.id,
        slug: d.slug,
        lat: d.lat,
        lng: d.lng,
        name: ml(d.name, locale),
        intro: ml(d.intro, locale),
        meta_title: ml(d.metaTitle, locale),
        meta_description: ml(d.metaDescription, locale),
      };
    },
    ["district-by-slug-v1"],
    // Not layout-reachable, so "districts" cannot cascade site-wide.
    // revalidateDistrict() purges this tag on every admin edit.
    { revalidate: 86400, tags: ["districts"] }
  )
);

// Lightweight district + thana list for the hero search bar. Bangla + English
// names both sent so the client-side SearchableSelect matches either.
export const getDistrictsForSearch = unstable_cache(
  async () => {
    const res = await db.execute<{
      slug: string; name_bn: string; name_en: string | null;
    }>(sql`
      SELECT slug, name->>'bn' AS name_bn, name->>'en' AS name_en
      FROM districts WHERE active
      ORDER BY sort, name->>'en'
    `);
    return res.rows;
  },
  ["districts-for-search"],
  { tags: ["districts"] }
);

export const getThanasForSearch = unstable_cache(
  async () => {
    const res = await db.execute<{
      slug: string; name_bn: string; name_en: string | null; district_slug: string | null;
    }>(sql`
      SELECT a.slug,
        a.name->>'bn' AS name_bn,
        a.name->>'en' AS name_en,
        d.slug AS district_slug
      FROM areas a LEFT JOIN districts d ON d.id = a.district_id
      WHERE a.active
      ORDER BY a.name->>'en'
    `);
    return res.rows;
  },
  ["thanas-for-search"],
  { tags: ["areas", "districts"] }
);

// Areas with coords + active-doctor count. Used by geo detection to:
//   1. Match visitor's IP city to a named area, OR
//   2. Fall back to the nearest area (by lat/lng) that actually has doctors.
export const getAreasForGeo = unstable_cache(
  async () => {
    // Raw SQL: coalesce the thana's own lat/lng with its district's, so rural
    // upazilas without hand-curated coords still participate in the nearest-
    // thana ranking (they inherit the district-office coordinate). This lets
    // the geo cascade work nationwide, not just in seeded metro areas.
    const res = await db.execute<{
      id: number; slug: string; name: MLText;
      district_id: number | null; district_slug: string | null; district_name: MLText | null;
      lat: number | null; lng: number | null; doctorCount: number;
    }>(sql`
      SELECT
        a.id,
        a.slug,
        a.name,
        a.district_id,
        d.slug AS district_slug,
        d.name AS district_name,
        COALESCE(a.lat, d.lat) AS lat,
        COALESCE(a.lng, d.lng) AS lng,
        (
          -- A doctor belongs to this thana in EITHER of two ways: a visible
          -- chamber here, or their linked hospital sits here. Counting only
          -- chambers reported zero for every thana on datasets where doctors
          -- are attached through hospitals, which silently emptied the picker,
          -- the "nearest area with doctors" fallback in geo.ts, and the
          -- prerender list built from this reader.
          -- Same rule as getBusiestAreaByDistrict and searchDoctors' area filter.
          SELECT COUNT(DISTINCT doc.id)::int
          FROM doctors doc
          WHERE doc.active AND (
            EXISTS (
              SELECT 1 FROM chambers c
              WHERE c.doctor_id = doc.id AND c.visible AND c.area_id = a.id
            )
            OR (
              -- Hospital is a FALLBACK, not an alternative: it only applies to
              -- a doctor with no visible chamber anywhere. Without this guard a
              -- doctor with a Dhaka chamber and a Khulna hospital counted for
              -- both districts, while their card said Dhaka.
              NOT EXISTS (SELECT 1 FROM chambers cx WHERE cx.doctor_id = doc.id AND cx.visible)
              AND EXISTS (
                SELECT 1 FROM hospitals h
                WHERE h.id = doc.hospital_id AND h.area_id = a.id
              )
            )
          )
        ) AS "doctorCount"
      FROM areas a
      LEFT JOIN districts d ON d.id = a.district_id
      WHERE a.active
      ORDER BY a.sort
    `);
    return res.rows;
  },
  // Key bumped (v4 -> v5): the count query changed, and unstable_cache is keyed
  // by this string, so reusing it would keep serving the old chamber-only
  // numbers until something happened to revalidate the tag.
  ["geo-areas-v6"],
  // Same reasoning as getSpecialties above: this feeds the district/area picker
  // rendered in the shared layout, so tagging it "doctors" would let a single
  // doctor edit purge every cached page. The doctor counts shown in the picker
  // lag until an area/district edit or the route's revalidate window.
  { tags: ["areas", "districts"] }
);

// Districts with coords + active-doctor count. Feeds the "which district are
// you in?" prompt: the visitor picks one and that choice — not their IP —
// becomes the location for the whole site. Deliberately district-level only;
// a thana list would be 500+ rows and is more than we need to ask a stranger.
export const getDistrictsForGeo = unstable_cache(
  async () => {
    const res = await db.execute<{
      id: number; slug: string; name: MLText;
      lat: number | null; lng: number | null; doctorCount: number;
    }>(sql`
      SELECT
        d.id,
        d.slug,
        d.name,
        d.lat,
        d.lng,
        (
          -- Chamber-in-this-district OR hospital-in-this-district, the same
          -- two-way rule getAreasForGeo uses. Chamber-only counting showed "0
          -- জন ডাক্তার" against every district in the picker whenever doctors
          -- were linked through hospitals, and made the no-doctors substitution
          -- notice fire for districts that do in fact have doctors.
          SELECT COUNT(DISTINCT doc.id)::int
          FROM doctors doc
          WHERE doc.active AND (
            EXISTS (
              -- COALESCE so a chamber saved with a district but no thana counts
              -- for that district, matching what the district listing returns.
              SELECT 1 FROM chambers c
              LEFT JOIN areas ca ON ca.id = c.area_id
              WHERE c.doctor_id = doc.id AND c.visible
                AND COALESCE(ca.district_id, c.district_id) = d.id
            )
            OR (
              -- Fallback only; see getAreasForGeo above.
              NOT EXISTS (SELECT 1 FROM chambers cx WHERE cx.doctor_id = doc.id AND cx.visible)
              AND EXISTS (
                SELECT 1 FROM hospitals h
                JOIN areas ha ON ha.id = h.area_id
                WHERE h.id = doc.hospital_id AND ha.district_id = d.id
              )
            )
          )
        ) AS "doctorCount"
      FROM districts d
      WHERE d.active
      ORDER BY d.sort, d.name->>'en'
    `);
    return res.rows;
  },
  // Key bumped (v1 -> v2) for the same reason as geo-areas above.
  ["geo-districts-v3"],
  // Not tagged "doctors" — this is the district list the shared layout hands to
  // <LocationProvider>/<GeoShell>, so a "doctors" tag here would make one doctor
  // edit invalidate every cached page. See getSpecialties for the full argument.
  //
  // Same reason for `revalidate` as getSpecialties: `doctorCount` here is the
  // "X জন ডাক্তার" shown against each district in the picker, and an untagged
  // infinite entry meant that number never moved when doctors were added. It
  // also feeds the no-doctors substitution notice, so a stale zero told a
  // visitor their district was empty when it was not. 86400 for the clamp
  // reason documented on getSpecialties.
  { revalidate: 86400, tags: ["districts", "areas"] }
);

// The thana with the most doctors in each district, used to preselect the
// hero search once we know the visitor's district.
//
// Counts a doctor as belonging to a thana in the same two ways the public
// area listing does — a visible chamber here, OR their linked hospital sits
// here. `getAreasLight`/`getAreasForGeo` count chambers only, which reports zero
// everywhere on datasets where doctors are attached through hospitals, so
// neither can be reused for this.
export const getBusiestAreaByDistrict = unstable_cache(
  async () => {
    const res = await db.execute<{
      district_id: number | string; district_slug: string; slug: string; doctor_count: number;
    }>(sql`
      SELECT DISTINCT ON (a.district_id)
        a.district_id,
        dd.slug AS district_slug,
        a.slug,
        (
          SELECT COUNT(DISTINCT doc.id)::int
          FROM doctors doc
          WHERE doc.active AND (
            EXISTS (
              SELECT 1 FROM chambers c
              WHERE c.doctor_id = doc.id AND c.visible AND c.area_id = a.id
            )
            OR (
              -- Hospital is a FALLBACK, not an alternative: it only applies to
              -- a doctor with no visible chamber anywhere. Without this guard a
              -- doctor with a Dhaka chamber and a Khulna hospital counted for
              -- both districts, while their card said Dhaka.
              NOT EXISTS (SELECT 1 FROM chambers cx WHERE cx.doctor_id = doc.id AND cx.visible)
              AND EXISTS (
                SELECT 1 FROM hospitals h
                WHERE h.id = doc.hospital_id AND h.area_id = a.id
              )
            )
          )
        ) AS doctor_count
      FROM areas a
      JOIN districts dd ON dd.id = a.district_id
      WHERE a.active AND a.district_id IS NOT NULL
      ORDER BY a.district_id, doctor_count DESC, a.sort, a.id
    `);
    // district_id is bigint; the pool parses it to a number, but coerce so a
    // driver-level change can never turn this into a silent no-match.
    return res.rows.map((r) => ({ ...r, district_id: Number(r.district_id) }));
  },
  ["busiest-area-by-district-v2"],
  { tags: ["areas", "doctors", "hospitals", "districts"] }
);

// ---------- hospitals ----------

// Everything the hospital FILTER dropdowns and the homepage hospital rail
// render — and nothing else.
//
// Three public pages (homepage, /doctors, /districts/<slug>/doctors) used to
// call `searchHospitals({}, locale)` for this. That reader selects
// `description`, `departments`, `gallery`, `address`, `map_url` and both meta
// fields: 7,375 bytes per hospital row (measured), against the ~200 B these
// surfaces actually use. It also ran an unused `count(*)` on every call.
//
// searchHospitals() itself is unchanged and still backs /hospitals and
// /api/hospitals, which genuinely render the heavy fields.
export type HospitalOption = {
  id: number; slug: string; name: string;
  area: string; area_slug: string | null; district_slug: string | null;
  image_url: string | null; lat: number | null; lng: number | null;
  doctor_count: number;
};

export const getHospitalOptions = unstable_cache(
  async (locale: Locale): Promise<HospitalOption[]> => {
    const doctorCount = sql<number>`(
      SELECT COUNT(*)::int FROM doctors d
      WHERE d.hospital_id = "hospitals"."id" AND d.active
    )`.as("doctor_count");

    const rows = await db
      .select({
        id: hospitalsT.id,
        slug: hospitalsT.slug,
        name: hospitalsT.name,
        imageUrl: hospitalsT.imageUrl,
        lat: hospitalsT.lat,
        lng: hospitalsT.lng,
        areaMl: areasT.name,
        areaSlug: areasT.slug,
        districtSlug: districts.slug,
        doctorCount,
      })
      .from(hospitalsT)
      .leftJoin(areasT, eq(areasT.id, hospitalsT.areaId))
      .leftJoin(districts, eq(districts.id, areasT.districtId))
      .where(eq(hospitalsT.active, true))
      // Same order searchHospitals uses with no geo, so the homepage rail and
      // the filter lists keep the order they had.
      .orderBy(asc(hospitalsT.sort), asc(hospitalsT.id));

    return rows.map((h): HospitalOption => ({
      id: h.id,
      slug: h.slug,
      name: ml(h.name, locale),
      area: ml(h.areaMl, locale),
      area_slug: h.areaSlug ?? null,
      district_slug: h.districtSlug ?? null,
      image_url: h.imageUrl,
      lat: h.lat,
      lng: h.lng,
      doctor_count: h.doctorCount,
    }));
  },
  ["hospital-options-v1"],
  // Not layout-reachable, so "doctors" is safe here and keeps doctor_count
  // accurate; revalidateHospital() purges both tags.
  { revalidate: 86400, tags: ["hospitals", "doctors"] }
);

export async function searchHospitals(
  p: { page?: number; perPage?: number },
  locale: Locale,
  geo?: GeoResult
): Promise<{ rows: Hospital[]; total: number }> {
  const perPage = Math.min(p.perPage || 12, 48);
  const offset = (Math.max(p.page || 1, 1) - 1) * perPage;

  const where = eq(hospitalsT.active, true);

  const orderClauses = [asc(hospitalsT.sort), asc(hospitalsT.id)];
  if (geo?.lat != null && geo?.lng != null) {
    // Same coordinate fallback idea as the doctor ranking: a hospital without
    // its own lat/lng borrows its thana's, then its district's, so it still
    // participates in nearest-first ordering instead of sinking to the bottom.
    // acos() clamped to [-1, 1] — float rounding on an exact coordinate match
    // otherwise makes Postgres raise "input is out of range".
    const distanceSql = sql`(
      SELECT 6371 * acos(LEAST(1, GREATEST(-1,
          cos(radians(${geo.lat})) * cos(radians(hpt.lat))
          * cos(radians(hpt.lng) - radians(${geo.lng}))
          + sin(radians(${geo.lat})) * sin(radians(hpt.lat))
      )))
      FROM (
        SELECT
          COALESCE(hh.lat, ha.lat, hd.lat) AS lat,
          COALESCE(hh.lng, ha.lng, hd.lng) AS lng
        FROM hospitals hh
        LEFT JOIN areas ha ON ha.id = hh.area_id
        LEFT JOIN districts hd ON hd.id = ha.district_id
        WHERE hh.id = "hospitals"."id"
      ) hpt
      WHERE hpt.lat IS NOT NULL AND hpt.lng IS NOT NULL
    )`;
    orderClauses.unshift(sql`${distanceSql} ASC NULLS LAST`);
  }

  // A hospital with doctors listed outranks one without, ahead of BOTH the
  // distance and the curated sort. This listing was the only one on the site
  // with no doctors-first tier at all, so an empty hospital could sit at
  // position one purely because of its `sort` value or its coordinates.
  //
  // Note this is ordering, not filtering: an empty hospital page is still
  // worth visiting (address, departments, phone, map) and stays reachable and
  // indexable. It simply stops outranking hospitals you can book in.
  orderClauses.unshift(
    sql`((SELECT COUNT(*) FROM doctors d WHERE d.hospital_id = "hospitals"."id" AND d.active) > 0) DESC`
  );

  const doctorCountSubquery = sql<number>`(
      SELECT COUNT(*)::int FROM doctors d
      WHERE d.hospital_id = "hospitals"."id" AND d.active
    )`.as("doctor_count");

  const rowsPromise = db
    .select({
      id: hospitalsT.id,
      slug: hospitalsT.slug,
      name: hospitalsT.name,
      areaId: hospitalsT.areaId,
      address: hospitalsT.address,
      phone: hospitalsT.phone,
      lat: hospitalsT.lat,
      lng: hospitalsT.lng,
      description: hospitalsT.description,
      departments: hospitalsT.departments,
      mapUrl: hospitalsT.mapUrl,
      imageKey: hospitalsT.imageKey,
      imageUrl: hospitalsT.imageUrl,
      gallery: hospitalsT.gallery,
      metaTitle: hospitalsT.metaTitle,
      metaDescription: hospitalsT.metaDescription,
      active: hospitalsT.active,
      areaMl: areasT.name,
      areaSlug: areasT.slug,
      districtSlug: districts.slug,
      districtMl: districts.name,
      doctorCount: doctorCountSubquery,
    })
    .from(hospitalsT)
    .leftJoin(areasT, eq(areasT.id, hospitalsT.areaId))
    .leftJoin(districts, eq(districts.id, areasT.districtId))
    .where(where)
    .orderBy(...orderClauses)
    .limit(perPage)
    .offset(offset);

  const totalPromise = db
    .select({ count: sql<number>`count(*)::int` })
    .from(hospitalsT)
    .where(where);

  const [rows, totalResult] = await Promise.all([rowsPromise, totalPromise]);
  const total = totalResult[0].count;
  
  const mappedRows = rows.map((h): Hospital => ({
    id: h.id, slug: h.slug, name: ml(h.name, locale),
    area_id: h.areaId, area: ml(h.areaMl, locale), area_slug: h.areaSlug ?? null,
    district_slug: h.districtSlug ?? null, district: ml(h.districtMl, locale),
    address: ml(h.address, locale), phone: h.phone,
    lat: h.lat, lng: h.lng,
    description: ml(h.description, locale),
    departments: (h.departments ?? []).map((d) => t(d, locale)).filter(Boolean),
    map_url: h.mapUrl,
    image_url: h.imageUrl, image_key: h.imageKey,
    gallery: h.gallery ?? [],
    meta_title: ml(h.metaTitle, locale), meta_description: ml(h.metaDescription, locale),
    active: h.active, doctor_count: h.doctorCount,
  }));

  return { rows: mappedRows, total };
}

// The thana and district are JOINed rather than left blank. They used to be
// hard-coded as `area: ""`, which is why the hospital page's title, description
// and MedicalClinic JSON-LD all fell through to a literal "Khulna" — wrong for
// every hospital outside it, and a duplicated locality for every one inside.
export const getHospitalBySlug = async (slug: string, locale: Locale) =>
  (await db
    .select({
      h: hospitalsT,
      areaMl: areasT.name,
      areaSlug: areasT.slug,
      districtMl: districts.name,
      districtSlug: districts.slug,
    })
    .from(hospitalsT)
    .leftJoin(areasT, eq(areasT.id, hospitalsT.areaId))
    .leftJoin(districts, eq(districts.id, areasT.districtId))
    .where(eq(hospitalsT.slug, slug))
    .limit(1)
  ).map(({ h, areaMl, areaSlug, districtMl, districtSlug }) => ({
    id: h.id, slug: h.slug, name: ml(h.name, locale),
    area_id: h.areaId, area: ml(areaMl, locale), area_slug: areaSlug ?? null,
    district: ml(districtMl, locale), district_slug: districtSlug ?? null,
    address: ml(h.address, locale), phone: h.phone,
    lat: h.lat, lng: h.lng,
    description: ml(h.description, locale),
    departments: (h.departments ?? []).map((d) => t(d, locale)).filter(Boolean),
    map_url: h.mapUrl,
    image_url: h.imageUrl, image_key: h.imageKey,
    gallery: h.gallery ?? [],
    meta_title: ml(h.metaTitle, locale), meta_description: ml(h.metaDescription, locale),
    active: h.active, doctor_count: 0,
  }))[0] ?? null;

export async function getHospitalDoctors(hospitalId: number, geo: GeoResult, locale: Locale): Promise<DoctorCardData[]> {
  // This function now uses the same core query-building logic as searchDoctors
  // to ensure consistent sorting rules everywhere. We pass in the hospitalId
  // and the user's geo-location preferences.
  const results = await searchDoctors({
    hospitalId,
    perPage: 24,
    ...(await geoSearchPrefs(geo, locale)),
  }, locale);
  return results.rows;
}

export type EnrichedDoctor = DoctorCardData & { all_specialties: string[] };

export async function getHospitalDoctorsWithSpecialties(hospitalId: number, geo: GeoResult, locale: Locale): Promise<EnrichedDoctor[]> {
  const doctors = await getHospitalDoctors(hospitalId, geo, locale);
  const doctorIds = doctors.map((d) => d.id);
  if (doctorIds.length === 0) {
    return doctors.map((d) => ({ ...d, all_specialties: [d.specialty].filter(Boolean) as string[] }));
  }

  const specialtyLinks = await db
    .select({
      doctorId: doctorSpecialties.doctorId,
      specialtyName: specialtiesT.name,
    })
    .from(doctorSpecialties)
    .innerJoin(specialtiesT, eq(specialtiesT.id, doctorSpecialties.specialtyId))
    .where(inArray(doctorSpecialties.doctorId, doctorIds));

  const specialtyMap = new Map<number, string[]>();
  for (const link of specialtyLinks) {
    const names = specialtyMap.get(link.doctorId) || [];
    const translatedName = ml(link.specialtyName, locale);
    if (translatedName && !names.includes(translatedName)) {
      names.push(translatedName);
    }
    specialtyMap.set(link.doctorId, names);
  }

  return doctors.map((doc) => ({
    ...doc,
    all_specialties: specialtyMap.get(doc.id) || [doc.specialty].filter(Boolean) as string[],
  }));
}

// ---------- doctors ----------

export async function getHomepageDoctors(
  geo: GeoResult,
  locale: Locale,
  limit = 12
): Promise<DoctorCardData[]> {
  // The homepage now uses the main search function to ensure logic is unified.
  // We pass the geo-preferences and a limit.
  const results = await searchDoctors({
    perPage: limit,
    ...(await geoSearchPrefs(geo, locale)),
  }, locale);
  return results.rows;
}

// The district to NAME in page copy — which is not always the district the
// visitor is in.
//
// If their own district has doctors, we say their district. If it does not,
// every list on the page falls back to doctors from elsewhere, and labelling
// those "ভোলার জনপ্রিয় ডাক্তার" when every card is a Khulna doctor is simply
// wrong. In that case we name the district of the doctor the site actually
// ranks first — resolved through the same chamber-then-hospital chain — so the
// heading always describes the results underneath it.
//
// Ranking preferences are passed through unchanged, so this asks the exact
// question the listings ask and cannot disagree with the first card.
//
// `cache`d per request: several surfaces (metadata + page body + footer) need
// this and must not each run the ranking query.
export type DisplayDistrict = {
  id: number | null;
  slug: string | null;
  name: string;
  /** True when we had to move off the visitor's own district to find doctors. */
  substituted: boolean;
};

export const resolveDisplayDistrict = cache(
  async (geo: GeoResult, locale: Locale): Promise<DisplayDistrict | null> => {
    const ownName = geo.districtName ? ml(geo.districtName, locale) : null;
    const own: DisplayDistrict | null = ownName
      ? { id: geo.districtId, slug: geo.districtSlug, name: ownName, substituted: false }
      : null;

    if (geo.districtId) {
      const busiest = await getBusiestAreaByDistrict();
      const hit = busiest.find((b) => b.district_id === geo.districtId);
      if (hit && hit.doctor_count > 0) return own;
    }

    // Raw geo, deliberately not geoSearchPrefs(): that helper calls this
    // function, and no curated order can apply yet — we are still working out
    // which district's order would even be the right one.
    const { rows } = await searchDoctors(
      {
        perPage: 1,
        preferLat: geo.lat,
        preferLng: geo.lng,
        preferAreaId: geo.areaId,
        preferDistrictId: geo.districtId,
      },
      locale
    );
    const top = rows[0];
    // No doctors anywhere, or the top one has neither chamber nor hospital
    // location — keep the visitor's own district rather than going blank.
    if (!top?.district || !top.district_slug) return own;
    if (top.district_slug === geo.districtSlug) return own;

    // Every caller also needs the id (to filter thanas by district), which the
    // doctor card does not carry.
    const districts = await getDistrictsForGeo();
    const match = districts.find((x) => x.slug === top.district_slug);
    return {
      id: match?.id ?? null,
      slug: top.district_slug,
      name: top.district,
      substituted: true,
    };
  }
);

// The geo-derived half of a doctor search, resolved once and spread into every
// listing so no surface can drift from the others.
//
// `preferDistrictId` and `priorityDistrictId` are both the DISPLAY district on
// purpose: we rank around the district whose doctors we are actually showing,
// and we apply that same district's curated order. Splitting them would let a
// page rank by Khulna but pin by Bhola.
export const geoSearchPrefs = cache(
  async (
    geo: GeoResult,
    locale: Locale
  ): Promise<Pick<DoctorSearchParams,
    "preferLat" | "preferLng" | "preferAreaId" | "preferDistrictId" | "priorityDistrictId">> => {
    const display = await resolveDisplayDistrict(geo, locale);
    const districtId = display?.id ?? geo.districtId;
    return {
      preferLat: geo.lat,
      preferLng: geo.lng,
      preferAreaId: geo.areaId,
      preferDistrictId: districtId,
      priorityDistrictId: districtId,
    };
  }
);

export type DoctorSearchParams = {
  q?: string;
  specialty?: string | string[];
  area?: string | string[];
  district?: string | string[];
  hospital?: string | string[];
  hospitalId?: number;
  gender?: string;
  maxFee?: number;
  sort?: "fee_asc" | "fee_desc" | "experience";
  page?: number;
  perPage?: number;
  excludeId?: number;
  preferAreaId?: number | null;
  preferDistrictId?: number | null;
  // When set, results are ordered by chamber distance from these coordinates
  // (nearest first). Comes from the visitor's IP lookup.
  preferLat?: number | null;
  preferLng?: number | null;
  // District whose curated "Doctors Priority" order should be applied. This is
  // the DISPLAY district (see resolveDisplayDistrict) — when a visitor's own
  // district has no doctors we show another district's list, and the order
  // that belongs to it has to come along or the top of the list is arbitrary.
  priorityDistrictId?: number | null;
};

// The heaviest query in the app — trigram `word_similarity` matching across
// doctors, doctor_specialties, specialties, chambers and hospitals plus four
// correlated EXISTS subqueries — and the only major reader that was not cached.
// It runs on the homepage, /doctors, every detail page's "suggested" rail, the
// listing APIs and the suggestions endpoint.
//
// Free-text queries are deliberately NOT cached: `q` has unbounded cardinality,
// so caching it would fill the data cache with single-use entries. Everything
// else — the filter/sort/pagination combinations, which repeat heavily — is
// cached and tagged "doctors", so any doctor mutation drops it immediately.
// NOTE: no `revalidate` here, deliberately. A page's own revalidate window is
// clamped to the SHORTEST revalidate of any cache entry it reads, and the
// public layout reaches this function through Footer -> resolveDisplayDistrict.
// A 600s TTL here therefore silently rewrote every page in the app to 10
// minutes — /about included — overriding the per-route windows. Tag
// invalidation is the right mechanism anyway: "doctors" is purged by every
// doctor mutation, so the entry is never meaningfully stale.
const searchDoctorsCached = unstable_cache(
  async (paramsJson: string, locale: Locale) =>
    searchDoctorsUncached(JSON.parse(paramsJson) as DoctorSearchParams, locale),
  // Version suffix, and it must be bumped whenever the SQL below changes.
  // Next persists the Data Cache across builds and across Vercel deployments,
  // so an unchanged key keeps serving answers computed by the OLD query: after
  // the chamber-first fix, /districts/dhaka/doctors still rendered 0 doctors
  // from a pre-fix entry while a fresh param combination returned 1.
  ["search-doctors-v2"],
  { tags: ["doctors"] }
);

export async function searchDoctors(
  p: DoctorSearchParams,
  locale: Locale
): Promise<{ rows: DoctorCardData[]; total: number }> {
  if (p.q) return searchDoctorsUncached(p, locale);
  // Sorted keys so {a,b} and {b,a} resolve to the same cache entry rather than
  // two identical-but-separate ones.
  return searchDoctorsCached(JSON.stringify(p, Object.keys(p).sort()), locale);
}

async function searchDoctorsUncached(
  p: DoctorSearchParams,
  locale: Locale
): Promise<{ rows: DoctorCardData[]; total: number }> {
  const buildQueryParts = (params: DoctorSearchParams) => {
    const conditions = [sql`d.active`];
    if (params.excludeId) {
      conditions.push(sql`d.id != ${params.excludeId}`);
    }
    if (params.hospitalId) {
      conditions.push(sql`d.hospital_id = ${params.hospitalId}`);
    }

    if (params.q) {
      const raw = params.q.trim();
      const like = `%${raw}%`;
      conditions.push(sql`(
        d.name->>'bn' ILIKE ${like} OR d.name->>'en' ILIKE ${like}
        OR word_similarity(${raw}, d.name->>'bn') > 0.4
        OR word_similarity(${raw}, d.name->>'en') > 0.4
        OR d.degrees->>'bn' ILIKE ${like} OR d.degrees->>'en' ILIKE ${like}
        OR EXISTS (SELECT 1 FROM doctor_specialties ds2 JOIN specialties s2 ON s2.id = ds2.specialty_id
          WHERE ds2.doctor_id = d.id AND (
            s2.name->>'bn' ILIKE ${like} OR s2.name->>'en' ILIKE ${like}
            OR word_similarity(${raw}, s2.name->>'bn') > 0.4
            OR word_similarity(${raw}, s2.name->>'en') > 0.4
          ))
        OR EXISTS (SELECT 1 FROM jsonb_array_elements(d.custom_specialties) cs
          WHERE cs->>'bn' ILIKE ${like} OR cs->>'en' ILIKE ${like})
        OR EXISTS (SELECT 1 FROM chambers c2 WHERE c2.doctor_id = d.id AND c2.visible
          AND (c2.name->>'bn' ILIKE ${like} OR c2.name->>'en' ILIKE ${like}))
        OR EXISTS (SELECT 1 FROM hospitals hf2 WHERE hf2.id = d.hospital_id
          AND (hf2.name->>'bn' ILIKE ${like} OR hf2.name->>'en' ILIKE ${like}
            OR word_similarity(${raw}, hf2.name->>'bn') > 0.4
            OR word_similarity(${raw}, hf2.name->>'en') > 0.4))
      )`);
    }
    if (params.specialty && params.specialty.length > 0) {
      const specs = Array.isArray(params.specialty) ? params.specialty : [params.specialty];
      const list = sql.join(specs.map((s) => sql`${s}`), sql`, `);
      conditions.push(sql`EXISTS (
        SELECT 1 FROM doctor_specialties ds3 JOIN specialties s3 ON s3.id = ds3.specialty_id
        WHERE ds3.doctor_id = d.id AND s3.slug IN (${list})
      )`);
    }
    if (params.area && params.area.length > 0) {
      const ars = Array.isArray(params.area) ? params.area : [params.area];
      const list = sql.join(ars.map((s) => sql`${s}`), sql`, `);
      // A doctor belongs to this thana through their visible chambers, and ONLY
      // if they have none, through their profile hospital. Chamber-first with a
      // hospital fallback — the same priority the card display uses
      // (COALESCE(chamber_area, hospital_area) in cardFrom), so the list a
      // doctor appears in always agrees with the address printed on their card.
      conditions.push(sql`(
        EXISTS (SELECT 1 FROM chambers c3 JOIN areas a3 ON a3.id = c3.area_id
                WHERE c3.doctor_id = d.id AND c3.visible AND a3.slug IN (${list}))
        OR (NOT EXISTS (SELECT 1 FROM chambers cx WHERE cx.doctor_id = d.id AND cx.visible)
            AND EXISTS (SELECT 1 FROM hospitals ha JOIN areas aa ON aa.id = ha.area_id
                        WHERE ha.id = d.hospital_id AND aa.slug IN (${list})))
      )`);
    }
    if (params.district && params.district.length > 0) {
      const ds = Array.isArray(params.district) ? params.district : [params.district];
      const list = sql.join(ds.map((s) => sql`${s}`), sql`, `);
      conditions.push(sql`(
        -- LEFT JOIN on areas + COALESCE, so a chamber that carries only a
        -- district (no thana picked) still puts its doctor in that district's
        -- listing. The thana, when present, stays authoritative.
        EXISTS (SELECT 1 FROM chambers cd
                LEFT JOIN areas ad ON ad.id = cd.area_id
                JOIN districts dd ON dd.id = COALESCE(ad.district_id, cd.district_id)
                WHERE cd.doctor_id = d.id AND cd.visible AND dd.slug IN (${list}))
        OR (NOT EXISTS (SELECT 1 FROM chambers cx WHERE cx.doctor_id = d.id AND cx.visible)
            AND EXISTS (SELECT 1 FROM hospitals hd JOIN areas hda ON hda.id = hd.area_id
                        JOIN districts hdd ON hdd.id = hda.district_id
                        WHERE hd.id = d.hospital_id AND hdd.slug IN (${list})))
      )`);
    }
    if (params.hospital && params.hospital.length > 0) {
      const hs = Array.isArray(params.hospital) ? params.hospital : [params.hospital];
      const list = sql.join(hs.map((s) => sql`${s}`), sql`, `);
      conditions.push(sql`EXISTS (
        SELECT 1 FROM hospitals hf WHERE hf.id = d.hospital_id AND hf.slug IN (${list})
      )`);
    }
    if (params.gender) conditions.push(sql`d.gender = ${params.gender}`);
    if (params.maxFee) {
      conditions.push(sql`EXISTS (SELECT 1 FROM chambers c4 WHERE c4.doctor_id = d.id AND c4.visible AND c4.fee <= ${params.maxFee})`);
    }
    const whereSql = sql.join(conditions, sql` AND `);

    let orderSql;
    const userLat = params.preferLat;
    const userLng = params.preferLng;
    const userAreaId = params.preferAreaId;

    // Rank of this doctor in the visitor's district's curated order, or a
    // sentinel that sorts last for everyone not pinned. Both switches have to
    // be on: the district master (`districts.priority_enabled`) and the row's
    // own `enabled`.
    //
    // Emitted as a plain scalar subquery so it can lead ANY ordering — pinned
    // doctors come first by position, and everyone else stays tied at the
    // sentinel so the ranking underneath decides their order untouched.
    // Distance is deliberately not consulted for pinned doctors: a curated
    // order that distance could reshuffle would not be an order at all.
    // A pin also has to be inside its paid window. Doctors with no payment
    // record at all stay pinned indefinitely — an admin can curate without
    // money changing hands — but once a doctor HAS a promotion, the dates on
    // it govern, so an expired sponsorship drops out on its own with no cron
    // job and no manual cleanup.
    const priorityRankSql = params.priorityDistrictId
      ? sql`COALESCE((
          SELECT p.position
          FROM district_doctor_priority p
          JOIN districts pdd ON pdd.id = p.district_id
          WHERE p.doctor_id = d.id
            AND p.district_id = ${params.priorityDistrictId}
            AND p.enabled
            AND pdd.priority_enabled
            AND (
              NOT EXISTS (SELECT 1 FROM promotions pr WHERE pr.doctor_id = d.id)
              OR EXISTS (
                SELECT 1 FROM promotions pr
                WHERE pr.doctor_id = d.id
                  AND pr.status = 'active'
                  AND CURRENT_DATE BETWEEN pr.starts_on AND pr.ends_on
              )
            )
        ), 2147483647) ASC`
      : null;

    // The doctor's badge, strongest claim first.
    //
    // BMDC registration outranks our own `verified` tick because it is the one
    // a visitor can check for themselves against the public register, which is
    // exactly what the badge on the card tells them. The two are mutually
    // exclusive at the database level (migrations/020_doctor_bmdc.sql); the
    // CASE still tests bmdc first so a row that somehow carried both ranks by
    // the stronger claim, the same way every other surface renders it.
    const badgeRankSql = sql`(CASE WHEN d.bmdc_verified THEN 1 WHEN d.verified THEN 2 ELSE 3 END)`;

    // "Is this doctor in the visitor's own district?"
    //
    // This tier sits above every quality signal on purpose: a plain doctor the
    // visitor can reach today is worth more to them than a BMDC-registered one
    // in the next district. Without it the ranking was distance-only, and since
    // neighbouring district capitals sit well inside the 100 km band, a
    // Barguna visitor got Khulna's verified doctors ahead of Barguna's own.
    //
    // Reads `dist.id` — the district `cardFrom` already resolved for the card
    // (chamber's thana, else the chamber's own district, else the hospital's
    // thana for a doctor with no visible chamber). Re-deriving it here is what
    // let the two disagree: the old ranking located a doctor by their profile
    // hospital's coordinates while their card, and the district listing they
    // appear in, named the district of their chamber.
    const ownDistrictSql = params.preferDistrictId
      ? sql`(CASE WHEN dist.id = ${params.preferDistrictId} THEN 0 ELSE 1 END) ASC`
      : null;

    // If a specific sort order is requested (e.g., by fee), use it.
    if (params.sort) {
      const orderParts = [];
      // A curated order outranks even an explicit sort: the admin pinned these
      // doctors to the top of this district on purpose, and a visitor sorting
      // by fee still expects to see them first.
      if (priorityRankSql) orderParts.push(priorityRankSql);
      switch (params.sort) {
        case "fee_asc": orderParts.push(sql`ch.fee ASC NULLS LAST`); break;
        case "fee_desc": orderParts.push(sql`ch.fee DESC NULLS LAST`); break;
        case "experience": orderParts.push(sql`d.experience_years DESC NULLS LAST`); break;
      }
      // Even with an explicit sort, we still use quality signals as a tie-breaker.
      // No own-district tier here: /api/doctors already drops `preferDistrict`
      // when the visitor picks a sort, because someone who asked for "cheapest
      // first" means it, and a district tier above the sort would silently
      // re-group the list they just ordered.
      orderParts.push(badgeRankSql);
      orderParts.push(sql`d.updated_at DESC`);
      orderParts.push(sql`d.id DESC`);
      orderSql = sql.join(orderParts, sql`, `);
    }
    // If no explicit sort, use the location-aware ranking logic.
    else if (userLat != null && userLng != null) {
      // Distance from the visitor to the doctor's ONE canonical location.
      //
      // Location = the doctor's FIRST visible chamber (lowest `sort`, then
      // lowest id). A chamber with the public toggle off is invisible here, so
      // a doctor whose only chamber is hidden is treated as having no chamber
      // and falls through to their profile hospital.
      //
      // Coordinate fallback chain, in the product's priority order:
      //   1. chamber's own lat/lng  (auto-extracted from the pasted Google Map)
      //   2. chamber's thana / upazila
      //   3. doctor's profile-linked hospital
      //   4. chamber's district
      //   5/6. that hospital's own thana / district (last resort)
      //
      // Deliberately NOT a MIN() across every chamber + the hospital: that let
      // a doctor with a far-away chamber but a nearby linked hospital score as
      // "nearby", which is how a Cumilla chamber was ranking top for Khulna
      // visitors. One doctor resolves to exactly one point.
      //
      // acos() is clamped to [-1, 1] — float rounding on identical coordinates
      // can push the dot product just past 1.0, which makes Postgres raise
      // "input is out of range" and kill the whole query.
      const minDistanceSql = sql`(
        SELECT 6371 * acos(LEAST(1, GREATEST(-1,
            cos(radians(${userLat})) * cos(radians(pt.lat))
            * cos(radians(pt.lng) - radians(${userLng}))
            + sin(radians(${userLat})) * sin(radians(pt.lat))
        )))
        FROM (
          SELECT
            COALESCE(fc.lat, fa.lat, dh.lat, fd.lat, dha.lat, dhd.lat) AS lat,
            COALESCE(fc.lng, fa.lng, dh.lng, fd.lng, dha.lng, dhd.lng) AS lng
          FROM doctors dd
          LEFT JOIN LATERAL (
            SELECT ch.lat, ch.lng, ch.area_id, ch.district_id
            FROM chambers ch
            WHERE ch.doctor_id = dd.id AND ch.visible
            ORDER BY ch.sort ASC, ch.id ASC
            LIMIT 1
          ) fc ON TRUE
          LEFT JOIN areas     fa  ON fa.id  = fc.area_id
          -- District coords are the last-resort location for this doctor. A
          -- chamber with only a district still has one, so read it from the
          -- chamber when the thana is blank.
          LEFT JOIN districts fd  ON fd.id  = COALESCE(fa.district_id, fc.district_id)
          LEFT JOIN hospitals dh  ON dh.id  = dd.hospital_id
          LEFT JOIN areas     dha ON dha.id = dh.area_id
          LEFT JOIN districts dhd ON dhd.id = dha.district_id
          WHERE dd.id = d.id
        ) pt
        WHERE pt.lat IS NOT NULL AND pt.lng IS NOT NULL
      )`;

      // Priority ladder:
      //   0. Pinned in this district's curated order (by position)
      //   1. In the visitor's own district
      //   2. Badge, banded by distance:
      //        BMDC ≤ 100 km, verified ≤ 100 km, normal ≤ 100 km,
      //        then the same three > 100 km (or unknown distance)
      //   3. Distance
      //
      // The band is what keeps the badge from dragging a far doctor up: outside
      // the visitor's district a BMDC doctor 300 km away must not outrank a
      // verified one 90 km away, so the badge only orders doctors already in
      // the same distance band. Inside the visitor's own district every doctor
      // is in the near band anyway, so there the ladder reads exactly as asked:
      // BMDC, then verified, then normal.
      //
      // Within each tier, ORDER BY distance ASC so the physically closest
      // doctor bubbles to the top. `NULLS LAST` keeps doctors with no usable
      // coord out of the way. The user's IP-derived coords come from the
      // geo cookie / Vercel edge headers, so this executes without any extra
      // IP-API fetch per request.
      orderSql = sql`
        ${priorityRankSql ? sql`${priorityRankSql},` : sql``}
        ${ownDistrictSql ? sql`${ownDistrictSql},` : sql``}
        CASE
          WHEN (${minDistanceSql}) <= 100 THEN ${badgeRankSql}
          ELSE 3 + ${badgeRankSql}
        END ASC,
        (${minDistanceSql}) ASC NULLS LAST,
        d.updated_at DESC,
        d.id DESC
      `;
    } else {
      // Fallback if no coordinates are available, but we have area/district IDs.
      //
      // Same ladder as above minus the distance steps: own district, then own
      // thana inside it, then badge. This branch used to interleave place and
      // badge (verified-in-district above normal-in-thana), which contradicted
      // the rule the geo branch follows — place first, quality second — so the
      // same visitor could get a different order purely because their
      // coordinates failed to resolve.
      //
      // The district test now goes through `dist.id` like everywhere else; the
      // hand-rolled chamber-only COALESCE it replaced could not see a doctor
      // whose district comes from their hospital.
      orderSql = sql`
        ${priorityRankSql ? sql`${priorityRankSql},` : sql``}
        ${ownDistrictSql ? sql`${ownDistrictSql},` : sql``}
        CASE WHEN EXISTS (
          SELECT 1 FROM chambers cg
          WHERE cg.doctor_id = d.id AND cg.visible AND cg.area_id = ${userAreaId ?? null}
        ) THEN 0 ELSE 1 END ASC,
        ${badgeRankSql} ASC,
        d.updated_at DESC,
        d.id DESC
      `;
    }
    return { whereSql, orderSql };
  };

  const perPage = Math.min(p.perPage || 12, 48);
  const offset = (Math.max(p.page || 1, 1) - 1) * perPage;

  const { whereSql, orderSql } = buildQueryParts(p);

  const [rowsRes, countRes] = await Promise.all([
    db.execute<CardRow>(sql`
      SELECT ${cardSelect} ${cardFrom}
      WHERE ${whereSql}
      ORDER BY ${orderSql}
      LIMIT ${perPage} OFFSET ${offset}
    `),
    db.execute<{ c: number }>(sql`SELECT COUNT(*)::int AS c FROM doctors d WHERE ${whereSql}`),
  ]);

  const rows = (rowsRes.rows as CardRow[]).map((r) => mapDoctorCard(r, locale));
  const total = (countRes.rows[0] as { c: number } | undefined)?.c ?? rows.length;
  return { rows, total };
}

// "Does this landing page have anything to show?" — the noindex probe.
//
// Location and specialty landing pages exist for every row in the DB, but only
// some have doctors. An empty one is thin content: Google crawls it, indexes
// nothing, and it lands in "Discovered/Crawled – currently not indexed". The
// sitemap already withholds them, but /areas links to all 619 thanas, so
// Googlebot still finds them by following internal links. Marking the empty
// ones noindex is what actually stops them accumulating.
//
// perPage 1 keeps the row fetch trivial — only `total` is used. React cache()
// dedupes repeat calls with identical args inside one request; the page body's
// own searchDoctors() call passes different args (perPage, geo prefs), so this
// does cost one extra COUNT per render of these routes. Cheap, and it buys the
// noindex decision at metadata time, before any HTML is flushed.
//
// Self-healing: assign a doctor and total flips above 0, so the noindex lifts
// on the next revalidation — the same trigger that adds the URL to the sitemap.
export const countDoctorsFor = cache(
  async (p: Pick<DoctorSearchParams, "specialty" | "area" | "district">): Promise<number> =>
    (await searchDoctors({ ...p, page: 1, perPage: 1 }, "bn")).total,
);

export const getDoctorBySlug = unstable_cache(
  async (slug: string, locale: Locale): Promise<DoctorFull | null> => {
    const docRes = await db.execute<CardRow & {
      bio_ml: MLText; gender: string | null; experience_years: number | null;
      patients_ml: MLText; photo_key: string | null; active: boolean;
      mt_ml: MLText; md_ml: MLText; hospital_id: number | null;
      social_links: SocialLinks | null;
      treated_conditions: { bn?: string[]; en?: string[] } | null;
      custom_specialties: MLText[] | null;
      bmdc_reg_year: number | null;
      bmdc_valid_till: string | null;
    }>(sql`
      SELECT ${cardSelect},
        d.bio AS bio_ml, d.gender, d.experience_years, d.patients_served AS patients_ml, d.photo_key,
        d.active, d.hospital_id, d.meta_title AS mt_ml, d.meta_description AS md_ml,
        d.social_links,
        d.treated_conditions,
        d.custom_specialties,
        d.bmdc_reg_year,
        -- Cast to text so the driver hands back "2029-12-31" rather than a
        -- Date built in the server's timezone, which can land a day early or
        -- late once it is serialised down to the client.
        d.bmdc_valid_till::text AS bmdc_valid_till
      ${cardFrom} WHERE d.slug = ${slug}
    `);
    const doc = docRes.rows[0];
    if (!doc) return null;
    const id = doc.id;

    const [specialtyRows, chamberRows, reviewRows] = await Promise.all([
      db
        .select({
          id: specialtiesT.id,
          slug: specialtiesT.slug,
          name: specialtiesT.name,
        })
        .from(doctorSpecialties)
        .innerJoin(specialtiesT, eq(specialtiesT.id, doctorSpecialties.specialtyId))
        .where(eq(doctorSpecialties.doctorId, id))
        .orderBy(desc(doctorSpecialties.isPrimary), asc(specialtiesT.sort)),

      db
        .select({
          id: chambersT.id,
          name: chambersT.name,
          address: chambersT.address,
          fee: chambersT.fee,
          phone: chambersT.phone,
          lat: chambersT.lat,
          lng: chambersT.lng,
          mapUrl: chambersT.mapUrl,
          schedule: chambersT.schedule,
          areaId: chambersT.areaId,
          areaMl: areasT.name,
          areaSlug: areasT.slug,
          customArea: chambersT.customArea,
        })
        .from(chambersT)
        .leftJoin(areasT, eq(areasT.id, chambersT.areaId))
        // Public detail page only sees chambers the admin has toggled visible.
        // A doctor with all chambers hidden still renders (their profile is
        // public) — the chambers section just becomes empty.
        .where(and(eq(chambersT.doctorId, id), eq(chambersT.visible, true)))
        .orderBy(asc(chambersT.sort), asc(chambersT.id)),

      db
        .select({
          id: reviewsT.id,
          name: reviewsT.name,
          area_text: reviewsT.areaText,
          body: reviewsT.body,
          created_at: sql<string>`${reviewsT.createdAt}::text`,
        })
        .from(reviewsT)
        .where(and(eq(reviewsT.doctorId, id), eq(reviewsT.published, true)))
        .orderBy(desc(reviewsT.createdAt))
        .limit(20),
    ]);

    // Drop the `hospital` string from the card spread — DoctorFull carries a full object.
    const { hospital: _hospitalStr, ...card } = mapDoctorCard(doc, locale);
    void _hospitalStr;
    return {
      ...card,
      bio: ml(doc.bio_ml, locale),
      gender: doc.gender,
      experience_years: doc.experience_years,
      patients_served: ml(doc.patients_ml, locale),
      // Locale-resolved conditions list; fall back to the other locale so a
      // doctor who only entered Bangla still shows something on /en/.
      treated_conditions: (() => {
        const tc = doc.treated_conditions ?? {};
        const primary = (locale === "bn" ? tc.bn : tc.en) ?? [];
        if (primary.length) return primary.filter(Boolean);
        const fallback = (locale === "bn" ? tc.en : tc.bn) ?? [];
        return fallback.filter(Boolean);
      })(),
      photo_key: doc.photo_key,
      active: doc.active,
      bmdc_reg_year: doc.bmdc_reg_year ?? null,
      bmdc_valid_till: doc.bmdc_valid_till ?? null,
      meta_title: ml(doc.mt_ml, locale),
      meta_description: ml(doc.md_ml, locale),
      social_links: doc.social_links ?? {},
      specialties: [
        ...specialtyRows.map((s) => ({
          id: s.id as number | null,
          slug: s.slug as string | null,
          name: ml(s.name, locale),
        })),
        // Doctor-only free-text entries, appended so a linked specialty always
        // stays the primary one (meta titles read specialties[0]). No id and no
        // slug — there is nothing to link to. `ml()` already falls back to the
        // other locale, so an entry typed in one language still renders.
        ...(doc.custom_specialties ?? [])
          .map((c) => ({ id: null, slug: null, name: ml(c, locale) }))
          .filter((c) => c.name),
      ],
      hospital:
        doc.hospital_ml && doc.hospital_slug && doc.hospital_id
          ? {
              id: doc.hospital_id,
              slug: doc.hospital_slug,
              name: ml(doc.hospital_ml, locale),
            }
          : null,
      chambers: chamberRows.map((c) => ({
        id: c.id,
        name: ml(c.name, locale),
        address: ml(c.address, locale),
        fee: c.fee,
        phone: c.phone,
        lat: c.lat,
        lng: c.lng,
        map_url: c.mapUrl,
        area_id: c.areaId,
        // Free text the admin typed for THIS chamber wins over the linked
        // thana, matching the card. It carries no slug, so the profile (which
        // prints the area as plain text anyway) and the JSON-LD address both
        // pick it up without anything to link to.
        area: ml(c.customArea, locale) || ml(c.areaMl, locale),
        area_slug: c.areaSlug ?? null,
        schedule: (c.schedule ?? []).map((s) => ({
          days: t(s.days, locale),
          time: t(s.time, locale),
        })),
      })),
      reviews: reviewRows,
    };
  },
  ["doctor-by-slug"],
  { tags: ["doctors", "reviews"] }
);

// ---------- homepage content ----------
export const getHeroSlides = unstable_cache(
  async (locale: Locale) => {
    const rows = await db
      .select({
        id: heroSlides.id,
        title: heroSlides.title,
        text: heroSlides.text,
        icon: heroSlides.icon,
        imageUrl: heroSlides.imageUrl,
      })
      .from(heroSlides)
      .where(eq(heroSlides.active, true))
      .orderBy(asc(heroSlides.sort), asc(heroSlides.id));

    return rows.map((s) => ({
      id: s.id,
      title: ml(s.title, locale),
      text: ml(s.text, locale),
      icon: s.icon,
      image_url: s.imageUrl,
    }));
  },
  ["hero-slides"],
  { tags: ["slides"] }
);

export const getFaqs = unstable_cache(
  async (scope: string, refId: number | null, locale: Locale) => {
    const rows = await db
      .select({ id: faqsT.id, question: faqsT.question, answer: faqsT.answer })
      .from(faqsT)
      .where(
        and(
          eq(faqsT.scope, scope as "home" | "specialty" | "area" | "hospital" | "doctor" | "district"),
          eq(faqsT.active, true),
          refId ? eq(faqsT.refId, refId) : isNull(faqsT.refId)
        )
      )
      .orderBy(asc(faqsT.sort), asc(faqsT.id));

    return rows.map((f) => ({
      id: f.id,
      question: ml(f.question, locale),
      answer: ml(f.answer, locale),
    }));
  },
  ["faqs"],
  { tags: ["faqs"] }
);

// ---------------------------------------------------------------------------
// Raw FAQ rows for one entity, INCLUDING inactive ones.
//
// getFaqs() above filters to `active`, which is right for hand-written FAQs but
// wrong here: an inactive row carrying an `auto_key` is a TOMBSTONE. It is how
// the dashboard deletes a generated FAQ, and dropping it would let the deleted
// answer come straight back on the next render.
// ---------------------------------------------------------------------------
// EVERY stored FAQ row, in ONE cached read.
//
// This used to be keyed per entity, which meant a separate cache entry and a
// separate query for every district, thana, specialty, hospital and doctor on
// the site. A full build of a few thousand doctor pages issued a few thousand
// queries to fetch, almost always, nothing at all — because generated FAQs have
// no rows and only overrides and hand-written entries are stored here.
//
// The table is small BY DESIGN (it holds exceptions, not defaults), so reading
// it whole once and filtering in memory collapses all of that into a single
// query per revalidation. If it ever grows past a few thousand rows, revisit
// this — but that would mean an admin had hand-edited most FAQs on the site.
const getAllFaqRows = unstable_cache(
  async () => {
    return db
      .select({
        id: faqsT.id,
        scope: faqsT.scope,
        refId: faqsT.refId,
        question: faqsT.question,
        answer: faqsT.answer,
        sort: faqsT.sort,
        active: faqsT.active,
        auto_key: faqsT.autoKey,
      })
      .from(faqsT)
      .orderBy(asc(faqsT.sort), asc(faqsT.id));
  },
  ["faq-rows-all-v1"],
  { tags: ["faqs"] }
);

export async function getFaqRows(scope: string, refId: number | null) {
  const all = await getAllFaqRows();
  return all.filter((r) => r.scope === scope && (refId === null ? r.refId === null : r.refId === refId));
}

/**
 * `ref_id` value that means "the whole scope" in the `faq_disabled` denylist.
 * Entity ids are bigserial and start at 1, so 0 can never be a real entity.
 */
export const FAQ_SCOPE_ALL = 0;

/**
 * Every FAQ block that has been switched off, as a `"scope:refId"` key set.
 *
 * A denylist, so this is empty until an admin actually turns something off and
 * the common case costs one tiny indexed read. Cached under the "faqs" tag, so
 * toggling purges FAQ consumers and nothing else — deliberately not stored in
 * site_settings, whose tag forces a layout-wide purge of the entire site.
 */
// Returns an ARRAY, not a Set. `unstable_cache` round-trips its result through
// JSON, and a Set serialises to `{}` — the cached value then had no `.has`
// method and every prerender of a doctor page died with "f.has is not a
// function". The Set is rebuilt by the caller below.
const getDisabledFaqList = unstable_cache(
  async (): Promise<string[]> => {
    try {
      const rows = await db.select({ scope: faqDisabled.scope, refId: faqDisabled.refId }).from(faqDisabled);
      return rows.map((r) => `${r.scope}:${r.refId}`);
    } catch {
      // Table arrives in migrations/019. Before it is applied, nothing is
      // disabled, which is the correct default.
      return [];
    }
  },
  ["faq-disabled-v1"],
  { tags: ["faqs"] }
);

export async function getDisabledFaqKeys(): Promise<Set<string>> {
  return new Set(await getDisabledFaqList());
}

export type ResolvedFaq = { id: number; question: string; answer: string };

/**
 * The FAQ list a public page should render: generated defaults, with the
 * admin's edits and deletions applied on top.
 *
 *   seed with no matching row      -> the generated answer
 *   row with the seed's auto_key   -> that row REPLACES the generated answer
 *   same row with active = false   -> the generated answer is SUPPRESSED
 *   row with auto_key NULL         -> an ordinary hand-written FAQ, appended
 *
 * Generated entries keep the seed order so the sequence is predictable across
 * every entity of a scope; hand-written ones follow, in the admin's own sort.
 * Virtual entries get negative ids, which are only ever used as React keys and
 * can never collide with a real row.
 */
export async function getFaqsWithDefaults(
  scope: string,
  refId: number | null,
  seeds: FaqSeed[],
  locale: Locale
): Promise<ResolvedFaq[]> {
  // Off switches first: no point resolving anything the page will not render.
  // Scope-wide beats per-entity, and either one silences the block completely,
  // generated and hand-written alike.
  const disabled = await getDisabledFaqKeys();
  if (disabled.has(`${scope}:${FAQ_SCOPE_ALL}`)) return [];
  if (refId !== null && disabled.has(`${scope}:${refId}`)) return [];

  let rows: Awaited<ReturnType<typeof getFaqRows>>;
  try {
    rows = await getFaqRows(scope, refId);
  } catch {
    // The `district` enum value and the `auto_key` column each arrive in a
    // migration. If this code is live before one of them is applied, degrade to
    // the generated defaults instead of taking the page down with it.
    rows = [];
  }

  const overrides = new Map<string, (typeof rows)[number]>();
  const manual: typeof rows = [];
  for (const r of rows) {
    if (r.auto_key) overrides.set(r.auto_key, r);
    else if (r.active) manual.push(r);
  }

  // A hand-written FAQ that asks the same question as a generated one WINS, and
  // the generated twin is dropped. Without this the two sit side by side: the
  // district page shipped fifteen entries with five questions repeated
  // verbatim, in the visible list and in the FAQPage JSON-LD, which is worse
  // than either version alone. The admin wrote theirs deliberately, so theirs
  // is the one that survives.
  const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

  // Two hand-written FAQs can ask the same question as each other, not just as
  // a generated one — the same answer twice on the page and twice inside the
  // FAQPage JSON-LD. First one wins, the rest are dropped.
  const seenManual = new Set<string>();
  const manualLocalized: ResolvedFaq[] = [];
  for (const r of manual) {
    const question = ml(r.question, locale);
    const key = norm(question);
    if (!key || seenManual.has(key)) continue;
    seenManual.add(key);
    manualLocalized.push({ id: r.id, question, answer: ml(r.answer, locale) });
  }
  const manualQuestions = seenManual;

  const out: ResolvedFaq[] = [];
  seeds.forEach((seed, i) => {
    const hit = overrides.get(seed.key);
    if (hit) {
      if (!hit.active) return; // tombstone: admin deleted this generated FAQ
      out.push({ id: hit.id, question: ml(hit.question, locale), answer: ml(hit.answer, locale) });
      return;
    }
    if (manualQuestions.has(norm(ml(seed.question, locale)))) return; // superseded
    out.push({ id: -(i + 1), question: ml(seed.question, locale), answer: ml(seed.answer, locale) });
  });

  out.push(...manualLocalized);

  // An answer that localized to an empty string would render a blank card and,
  // worse, an empty acceptedAnswer in the FAQPage JSON-LD.
  return out.filter((f) => f.question.trim() && f.answer.trim());
}

export const getTestimonials = unstable_cache(
  async (locale: Locale) => {
    const rows = await db
      .select({
        id: testimonialsT.id,
        name: testimonialsT.name,
        areaText: testimonialsT.areaText,
        quote: testimonialsT.quote,
        photoUrl: testimonialsT.photoUrl,
      })
      .from(testimonialsT)
      .where(eq(testimonialsT.published, true))
      .orderBy(asc(testimonialsT.sort), asc(testimonialsT.id))
      .limit(6);

    return rows.map((x) => ({
      id: x.id,
      name: x.name,
      area_text: ml(x.areaText, locale),
      quote: ml(x.quote, locale),
      photo_url: x.photoUrl,
    }));
  },
  ["testimonials"],
  { tags: ["testimonials"] }
);

// ---------- blog ----------
export type BlogPostCard = {
  id: number; slug: string; title: string; excerpt: string; cover_url: string | null;
  category: string; category_slug: string | null; published_at: string | null;
};

export async function getBlogPosts(
  locale: Locale,
  params: {
    page?: number;
    perPage?: number;
    category?: string;
  }
): Promise<{ rows: BlogPostCard[]; total: number }> {
  const { page = 1, perPage = 12, category } = params;
  const offset = (page - 1) * perPage;

  const where = and(
    eq(blogPosts.published, true),
    category ? eq(blogCategories.slug, category) : undefined
  );

  const rowsPromise = db
    .select({
      id: blogPosts.id,
      slug: blogPosts.slug,
      title: blogPosts.title,
      excerpt: blogPosts.excerpt,
      coverUrl: blogPosts.coverUrl,
      categoryMl: blogCategories.name,
      categorySlug: blogCategories.slug,
      publishedAt: sql<string | null>`${blogPosts.publishedAt}::text`,
    })
    .from(blogPosts)
    .leftJoin(blogCategories, eq(blogCategories.id, blogPosts.categoryId))
    .where(where)
    .orderBy(sql`${blogPosts.publishedAt} DESC NULLS LAST`)
    .limit(perPage)
    .offset(offset);

  const totalPromise = db
    .select({ total: sql<number>`count(*)::int` })
    .from(blogPosts)
    .leftJoin(blogCategories, eq(blogCategories.id, blogPosts.categoryId))
    .where(where);

  const [rows, totalResult] = await Promise.all([rowsPromise, totalPromise]);

  const total = totalResult[0].total;
  const mappedRows = rows.map(
    (b): BlogPostCard => ({
      id: b.id,
      slug: b.slug,
      title: ml(b.title, locale),
      excerpt: ml(b.excerpt, locale),
      cover_url: b.coverUrl,
      category: ml(b.categoryMl, locale),
      category_slug: b.categorySlug ?? null,
      published_at: b.publishedAt,
    })
  );

  return { rows: mappedRows, total };
}

export const getBlogPostBySlug = unstable_cache(
  async (slug: string, locale: Locale) => {
    const [p] = await db
      .select({
        id: blogPosts.id,
        slug: blogPosts.slug,
        title: blogPosts.title,
        excerpt: blogPosts.excerpt,
        coverUrl: blogPosts.coverUrl,
        content: blogPosts.content,
        metaTitle: blogPosts.metaTitle,
        metaDescription: blogPosts.metaDescription,
        updatedAt: sql<string>`${blogPosts.updatedAt}::text`,
        categoryMl: blogCategories.name,
        categorySlug: blogCategories.slug,
        publishedAt: sql<string | null>`${blogPosts.publishedAt}::text`,
      })
      .from(blogPosts)
      .leftJoin(blogCategories, eq(blogCategories.id, blogPosts.categoryId))
      .where(and(eq(blogPosts.slug, slug), eq(blogPosts.published, true)))
      .limit(1);

    if (!p) return null;
    return {
      id: p.id, slug: p.slug,
      title: ml(p.title, locale), excerpt: ml(p.excerpt, locale),
      content_html: ml(p.content, locale),
      cover_url: p.coverUrl,
      category: ml(p.categoryMl, locale),
      category_slug: p.categorySlug ?? null,
      published_at: p.publishedAt,
      updated_at: p.updatedAt,
      meta_title: ml(p.metaTitle, locale),
      meta_description: ml(p.metaDescription, locale),
    };
  },
  ["blog-post"],
  { tags: ["blog"] }
);

export const getBlogCategories = unstable_cache(
  async (locale: Locale) => {
    const rows = await db
      .select({ id: blogCategories.id, slug: blogCategories.slug, name: blogCategories.name })
      .from(blogCategories)
      // Only categories that actually hold a published post get a chip. A chip
      // for an empty category is a dead end — it filters the feed down to
      // nothing — and admins create categories before writing for them, so the
      // row exists long before any post does. EXISTS rather than a join +
      // GROUP BY: we only need "is there at least one", and Postgres can stop
      // at the first matching row.
      .where(
        exists(
          db
            .select({ one: sql`1` })
            .from(blogPosts)
            .where(and(eq(blogPosts.categoryId, blogCategories.id), eq(blogPosts.published, true)))
        )
      )
      .orderBy(asc(blogCategories.sort), asc(blogCategories.id));
    return rows.map((c) => ({ id: c.id, slug: c.slug, name: ml(c.name, locale) }));
  },
  ["blog-categories"],
  { tags: ["blog"] }
);

// ---------- promotions auto-expiry ----------
export async function expirePromotions() {
  const expired = await db
    .update(promotionsT)
    .set({ status: "expired", updatedAt: new Date() })
    .where(and(eq(promotionsT.status, "active"), sql`${promotionsT.endsOn} < CURRENT_DATE`))
    .returning({ doctorId: promotionsT.doctorId });

  // One doctor can have several promotions expire in the same sweep, and a row
  // could carry a null doctor_id, so narrow the list before it reaches SQL. An
  // empty list would render `IN ()` — a syntax error — so the whole statement is
  // skipped in that case.
  const doctorIds = [...new Set(expired.map((e) => e.doctorId).filter((id): id is number => id != null))];

  if (doctorIds.length > 0) {
    // Switch the curated-order entry off, so the admin panel visibly shows
    // the doctor as deselected instead of leaving a ticked box that the public
    // ranking silently ignores. The ranking already excludes them by date; this
    // is what makes the expiry legible to a human.
    //
    // The ids are joined into an IN list rather than interpolated as one value:
    // `ANY(${doctorIds})` made Drizzle expand the JS array into a row
    // constructor — `ANY(($1, $2))` — and Postgres rejected it with
    // "op ANY/ALL (array) requires array on right side", which took the whole
    // /admin dashboard down on load.
    const idList = sql.join(doctorIds.map((id) => sql`${id}`), sql`, `);
    await db.execute(sql`
      UPDATE district_doctor_priority p
      SET enabled = false, updated_at = now()
      WHERE p.doctor_id IN (${idList})
        AND p.enabled
        AND NOT EXISTS (
          SELECT 1 FROM promotions pr
          WHERE pr.doctor_id = p.doctor_id
            AND pr.status = 'active'
            AND CURRENT_DATE BETWEEN pr.starts_on AND pr.ends_on
        )
    `);
  }
  return expired.length;
}

const getNearbyAreasUncached = async (
  locale: Locale,
  districtId: number | null,
  lat: number | null,
  lng: number | null
): Promise<{ id: number; slug: string; name: string, district_slug: string | null }[]> => {
  // Primary path: If a district is detected, find the best areas within it.
  if (districtId) {
    // Same "belongs to this thana" rule as the public area listing: a visible
    // chamber here, or the doctor's linked hospital sits here.
    const areaDoctorCount = sql<number>`(
      SELECT COUNT(DISTINCT doc.id)::int
      FROM doctors doc
      WHERE doc.active AND (
        EXISTS (
          SELECT 1 FROM chambers c
          WHERE c.doctor_id = doc.id AND c.visible AND c.area_id = "areas"."id"
        )
        OR (
          -- Fallback only; see getAreasForGeo.
          NOT EXISTS (SELECT 1 FROM chambers cx WHERE cx.doctor_id = doc.id AND cx.visible)
          AND EXISTS (
            SELECT 1 FROM hospitals h
            WHERE h.id = doc.hospital_id AND h.area_id = "areas"."id"
          )
        )
      )
    )`.as("doctor_count");

    const areasInDistrict = await db
      .select({
        id: areasT.id,
        slug: areasT.slug,
        name: areasT.name,
        districtSlug: districts.slug,
        lat: areasT.lat,
        lng: areasT.lng,
        sort: areasT.sort,
        doctorCount: areaDoctorCount,
      })
      .from(areasT)
      .leftJoin(districts, eq(districts.id, areasT.districtId))
      .where(and(eq(areasT.active, true), eq(areasT.districtId, districtId)));

    if (areasInDistrict.length === 0) return [];

    // Areas that actually have doctors come first, nearest within each group.
    // Distance alone used to surface empty thanas above the ones a visitor can
    // actually book in — the link looked local and then led to an empty page.
    const ranked = areasInDistrict
      .map((a) => ({
        ...a,
        dist: lat && lng && a.lat && a.lng ? haversineKm(lat, lng, a.lat, a.lng) : Infinity,
      }))
      .sort(
        (a, b) =>
          Number(b.doctorCount > 0) - Number(a.doctorCount > 0) ||
          a.dist - b.dist ||
          a.sort - b.sort
      );

    return ranked.slice(0, 6).map((a) => ({
      id: a.id,
      slug: a.slug,
      name: ml(a.name, locale),
      district_slug: a.districtSlug
    }));
  }

  // Fallback path: If no location is detected, show the most popular areas site-wide.
  //
  // Counts a doctor as belonging to a thana the same two ways the rest of the
  // site does — a visible chamber here, OR their linked hospital sits here.
  // Chambers alone returns zero for every thana on a dataset where doctors are
  // attached through hospitals, and the `doctorCount > 0` filter below then
  // emptied the entire footer column.
  const doctorCount = sql<number>`(
      SELECT COUNT(DISTINCT doc.id)::int
      FROM doctors doc
      WHERE doc.active AND (
        EXISTS (
          SELECT 1 FROM chambers c
          WHERE c.doctor_id = doc.id AND c.visible AND c.area_id = "areas"."id"
        )
        OR (
          -- Fallback only; see getAreasForGeo.
          NOT EXISTS (SELECT 1 FROM chambers cx WHERE cx.doctor_id = doc.id AND cx.visible)
          AND EXISTS (
            SELECT 1 FROM hospitals h
            WHERE h.id = doc.hospital_id AND h.area_id = "areas"."id"
          )
        )
      )
    )`.as("doctor_count");

  const popularAreas = await db
    .select({
      id: areasT.id,
      slug: areasT.slug,
      name: areasT.name,
      districtSlug: districts.slug,
      doctorCount,
    })
    .from(areasT)
    .leftJoin(districts, eq(districts.id, areasT.districtId))
    .where(eq(areasT.active, true))
    .orderBy(desc(doctorCount), asc(areasT.sort))
    .limit(6);

  return popularAreas
    .filter((a) => a.doctorCount > 0)
    .map((a) => ({
      id: a.id,
      slug: a.slug,
      name: ml(a.name, locale),
      district_slug: a.districtSlug
    }));
};

// This was a bare async function — the only reader in the shared layout that
// was not cached at all. The footer calls it on EVERY page, so every ISR
// re-render of every route ran the correlated doctor-count subquery above
// against Postgres. Harmless for Active CPU (it runs per render, not per
// request) but it was pointless load on Supabase, and the result is identical
// for every visitor.
//
// Cache key includes the arguments, and the argument space is small and
// bounded: the footer passes (locale, null, null, null), the homepage passes
// STATIC_GEO's fixed coordinates, and /api/districts/[slug]/areas passes a
// district id with null coords. Nothing here is per-visitor, so this cannot
// fill the data cache with single-use entries.
//
// Tags deliberately exclude "doctors" even though the ranking depends on
// doctor counts — this is layout-reachable, and see getSpecialties for what a
// "doctors" tag in the layout does to site-wide invalidation. `revalidate`
// covers the count drift instead, at 86400 for the clamp reason documented
// there.
export const getNearbyAreas = unstable_cache(
  getNearbyAreasUncached,
  ["nearby-areas-v1"],
  { revalidate: 86400, tags: ["areas", "districts"] }
);


export type AreaSearchParams = {
  q?: string;
  page?: number;
  perPage?: number;
  preferLat?: number | null;
  preferLng?: number | null;
  // The visitor's own thana / district, from their IP. Used to float an exact
  // match to the very top before falling back to raw distance.
  preferAreaId?: number | null;
  preferDistrictId?: number | null;
};

export async function searchAreas(
  p: AreaSearchParams,
  locale: Locale
): Promise<{ rows: Area[]; total: number }> {
  const conditions = [sql`a.active`];

  if (p.q) {
    const raw = p.q.trim();
    const like = `%${raw}%`;
    conditions.push(sql`(
      a.name->>'bn' ILIKE ${like} OR a.name->>'en' ILIKE ${like}
      OR word_similarity(${raw}, a.name->>'bn') > 0.4
      OR word_similarity(${raw}, a.name->>'en') > 0.4
      OR d.name->>'bn' ILIKE ${like} OR d.name->>'en' ILIKE ${like}
      OR word_similarity(${raw}, d.name->>'bn') > 0.4
      OR word_similarity(${raw}, d.name->>'en') > 0.4
    )`);
  }
  
  const whereSql = sql.join(conditions, sql` AND `);
  // Count doctors "belonging" to this thana in either of two ways:
  //   1. They run a visible chamber in this thana.
  //   2. They have no chamber at all (or all hidden) but their profile-linked
  //      hospital sits in this thana.
  // DISTINCT so a doctor with BOTH still counts once.
  // Declared before the ORDER BY because the ranking below reuses it.
  const doctorCountSubquery = sql`(
    SELECT COUNT(DISTINCT doc.id)::int
    FROM doctors doc
    WHERE doc.active AND (
      EXISTS (
        SELECT 1 FROM chambers c
        WHERE c.doctor_id = doc.id AND c.visible AND c.area_id = a.id
      )
      OR (
        -- Fallback only, which is what the comment above always described.
        NOT EXISTS (SELECT 1 FROM chambers cx WHERE cx.doctor_id = doc.id AND cx.visible)
        AND EXISTS (
          SELECT 1 FROM hospitals h
          WHERE h.id = doc.hospital_id AND h.area_id = a.id
        )
      )
    )
  )`;

  const orderParts = [];

  // Thana ranking uses ONLY thana geography — never a doctor's chamber or a
  // hospital. Tier first (visitor's own thana, then own district, then the
  // rest), distance second.
  if (p.preferAreaId != null || p.preferDistrictId != null) {
    orderParts.push(sql`
      CASE
        WHEN a.id = ${p.preferAreaId ?? null} THEN 0
        WHEN a.district_id = ${p.preferDistrictId ?? null} THEN 1
        ELSE 2
      END ASC`);
  }
  // Within a tier, a thana somebody can actually book in outranks an empty
  // one. Distance alone put thanas with no doctors at the top of the list,
  // where every click led to an empty page.
  orderParts.push(sql`(${doctorCountSubquery} > 0) DESC`);
  if (p.preferLat != null && p.preferLng != null) {
    // A thana with no coordinates of its own borrows its district's, so it
    // still ranks instead of sinking below every coordinate-bearing thana.
    // acos() clamped to [-1, 1] — float rounding on an exact coordinate match
    // otherwise makes Postgres raise "input is out of range" and fail the query.
    orderParts.push(sql`
      6371 * acos(LEAST(1, GREATEST(-1,
        cos(radians(${p.preferLat})) * cos(radians(COALESCE(a.lat, d.lat)))
        * cos(radians(COALESCE(a.lng, d.lng)) - radians(${p.preferLng}))
        + sin(radians(${p.preferLat})) * sin(radians(COALESCE(a.lat, d.lat)))
      ))
    ) ASC NULLS LAST`);
  }
  orderParts.push(sql`a.sort ASC`);
  orderParts.push(sql`a.id ASC`);

  const orderSql = sql.join(orderParts, sql`, `);

  const perPage = Math.min(p.perPage || 50, 100);
  const offset = (Math.max(p.page || 1, 1) - 1) * perPage;

  const rowsQuery = db.execute<{
    id: number; slug: string; name: MLText; district_id: number | null; district: MLText; district_slug: string | null;
    lat: number | null; lng: number | null; intro: MLText;
    meta_title: MLText; meta_description: MLText; active: boolean; sort: number;
    doctor_count: number;
  }>(sql`
    SELECT 
      a.id, a.slug, a.name, a.district_id, a.district, d.slug as district_slug, a.lat, a.lng, a.intro,
      a.meta_title, a.meta_description, a.active, a.sort,
      ${doctorCountSubquery} AS doctor_count
    FROM areas a
    LEFT JOIN districts d ON d.id = a.district_id
    WHERE ${whereSql}
    ORDER BY ${orderSql}
    LIMIT ${perPage} OFFSET ${offset}
  `);

  const countQuery = db.execute<{ c: number }>(sql`
    SELECT COUNT(*)::int AS c 
    FROM areas a
    LEFT JOIN districts d ON d.id = a.district_id
    WHERE ${whereSql}
  `);

  const [rowsRes, countRes] = await Promise.all([rowsQuery, countQuery]);

  const rows = rowsRes.rows.map((a): Area => ({
      id: a.id, slug: a.slug,
      name: ml(a.name, locale), district_id: a.district_id, district: ml(a.district, locale),
      district_slug: a.district_slug,
      lat: a.lat, lng: a.lng,
      intro: ml(a.intro, locale), meta_title: ml(a.meta_title, locale),
      meta_description: ml(a.meta_description, locale),
      active: a.active, sort: a.sort,
      doctor_count: a.doctor_count,
  }));

  const total = (countRes.rows[0] as { c: number } | undefined)?.c ?? rows.length;
  return { rows, total };
}

export type DistrictSearchParams = {
  q?: string;
  page?: number;
  perPage?: number;
  preferLat?: number | null;
  preferLng?: number | null;
  // The visitor's own district, from their IP — floated to the top.
  preferDistrictId?: number | null;
};

export async function searchDistricts(
  p: DistrictSearchParams,
  locale: Locale
): Promise<{ rows: District[]; total: number }> {
  const conditions = [sql`districts.active`];

  if (p.q) {
    const raw = p.q.trim();
    const like = `%${raw}%`;
    conditions.push(sql`(
      districts.name->>'bn' ILIKE ${like} OR districts.name->>'en' ILIKE ${like}
      OR word_similarity(${raw}, districts.name->>'bn') > 0.4
      OR word_similarity(${raw}, districts.name->>'en') > 0.4
    )`);
  }
  
  const whereSql = sql.join(conditions, sql` AND `);

  const thanaCountSubquery = sql`(
    SELECT COUNT(*)::int FROM ${areasT}
    WHERE ${areasT.districtId} = districts.id AND ${areasT.active}
  )`;

  // Count doctors "belonging" to this district in either of two ways:
  //   1. They run a visible chamber in a thana of this district.
  //   2. They have no chamber (or all hidden) but their profile-linked
  //      hospital sits in a thana of this district.
  // DISTINCT so a doctor with BOTH still counts once.
  //
  // Declared BEFORE the ORDER BY is assembled because the ordering now uses it
  // (see the tier below); it used to sit further down, which is why this
  // listing was the only one with no doctors-first ranking at all.
  const doctorCountSubquery = sql`(
    SELECT COUNT(DISTINCT doc.id)::int
    FROM ${doctorsT} doc
    WHERE doc.active AND (
      EXISTS (
        -- COALESCE: same rule as the district listing — a chamber with only a
        -- district still belongs to it.
        SELECT 1 FROM ${chambersT} c
        LEFT JOIN ${areasT} a ON a.id = c.area_id
        WHERE c.doctor_id = doc.id AND c.visible
          AND COALESCE(a.district_id, c.district_id) = districts.id
      )
      OR (
        -- Fallback only, which is what the comment above always described.
        NOT EXISTS (SELECT 1 FROM ${chambersT} cx WHERE cx.doctor_id = doc.id AND cx.visible)
        AND EXISTS (
          SELECT 1 FROM ${hospitalsT} h
          JOIN ${areasT} a2 ON a2.id = h.area_id
          WHERE h.id = doc.hospital_id AND a2.district_id = districts.id
        )
      )
    )
  )`;

  const orderParts = [];

  // District ranking uses ONLY district coordinates — no chamber, no hospital.
  // The visitor's own district pins to the top, then nearest-first.
  if (p.preferDistrictId != null) {
    orderParts.push(sql`CASE WHEN districts.id = ${p.preferDistrictId} THEN 0 ELSE 1 END ASC`);
  }
  // A district somebody can actually book in outranks an empty one, exactly as
  // searchAreas already does. Deliberately AFTER the visitor's own district
  // pin: someone browsing /districts wants to find their own district in the
  // list whether or not it has doctors yet, and the card now says so plainly
  // rather than looking like a listing that failed to load.
  orderParts.push(sql`(${doctorCountSubquery} > 0) DESC`);
  if (p.preferLat != null && p.preferLng != null) {
    // acos() clamped to [-1, 1] — see the note in searchAreas.
    orderParts.push(sql`
      6371 * acos(LEAST(1, GREATEST(-1,
        cos(radians(${p.preferLat})) * cos(radians(districts.lat))
        * cos(radians(districts.lng) - radians(${p.preferLng}))
        + sin(radians(${p.preferLat})) * sin(radians(districts.lat))
      ))
    ) ASC NULLS LAST`);
  }
  orderParts.push(sql`districts.sort ASC`);
  orderParts.push(sql`districts.id ASC`);

  const orderSql = sql.join(orderParts, sql`, `);

  const perPage = Math.min(p.perPage || 24, 48);
  const offset = (Math.max(p.page || 1, 1) - 1) * perPage;

  const rowsQuery = db.execute<{
    id: number; slug: string; name: MLText;
    lat: number | null; lng: number | null; intro: MLText;
    meta_title: MLText; meta_description: MLText; active: boolean; sort: number;
    thana_count: number;
    doctor_count: number;
  }>(sql`
    SELECT 
      districts.id, districts.slug, districts.name, districts.lat, districts.lng, districts.intro,
      districts.meta_title, districts.meta_description, districts.active, districts.sort,
      ${thanaCountSubquery} AS thana_count,
      ${doctorCountSubquery} AS doctor_count
    FROM ${districts}
    WHERE ${whereSql}
    ORDER BY ${orderSql}
    LIMIT ${perPage} OFFSET ${offset}
  `);

  const countQuery = db.execute<{ c: number }>(sql`
    SELECT COUNT(*)::int AS c 
    FROM ${districts}
    WHERE ${whereSql}
  `);

  const [rowsRes, countRes] = await Promise.all([rowsQuery, countQuery]);

  const rows = rowsRes.rows.map((d): District => ({
      id: d.id, slug: d.slug,
      name: ml(d.name, locale),
      lat: d.lat, lng: d.lng,
      intro: ml(d.intro, locale), meta_title: ml(d.meta_title, locale),
      meta_description: ml(d.meta_description, locale),
      active: d.active, sort: d.sort,
      thana_count: d.thana_count,
      doctor_count: d.doctor_count,
  }));

  const total = (countRes.rows[0] as { c: number } | undefined)?.c ?? rows.length;
  return { rows, total };
}


// ---------------------------------------------------------------------------
// Slug enumerations for generateStaticParams()
// ---------------------------------------------------------------------------
// A dynamic segment that generateStaticParams() does not enumerate is rendered
// on EVERY request — verified against a production `next start`: routes whose
// params were prebuilt answer with `s-maxage`, routes whose params were not
// answer with `private, no-store`. Returning an empty array is not enough.
//
// So each detail route enumerates its slugs here and gets prerendered at build.
// `dynamicParams` stays at its default (true), so a slug created after the last
// deploy still resolves — it renders once and is then cached like the rest.
//
// Tagged with the same tags as the listings, so an admin mutation drops these
// alongside the pages that consume them.

export const getAllDoctorSlugs = unstable_cache(
  async () =>
    (await db.select({ slug: doctorsT.slug }).from(doctorsT).where(eq(doctorsT.active, true)))
      .map((r) => r.slug),
  ["all-doctor-slugs"],
  { tags: ["doctors"] }
);

export const getAllHospitalSlugs = unstable_cache(
  async () =>
    (await db.select({ slug: hospitalsT.slug }).from(hospitalsT).where(eq(hospitalsT.active, true)))
      .map((r) => r.slug),
  ["all-hospital-slugs"],
  { tags: ["hospitals"] }
);

export const getAllSpecialtySlugs = unstable_cache(
  async () =>
    (await db.select({ slug: specialtiesT.slug }).from(specialtiesT).where(eq(specialtiesT.active, true)))
      .map((r) => r.slug),
  ["all-specialty-slugs"],
  { tags: ["specialties"] }
);

export const getAllBlogSlugs = unstable_cache(
  async () =>
    (await db.select({ slug: blogPosts.slug }).from(blogPosts).where(eq(blogPosts.published, true)))
      .map((r) => r.slug),
  ["all-blog-slugs"],
  { tags: ["blog"] }
);

export const getAllDistrictSlugs = unstable_cache(
  async () =>
    (await db.select({ slug: districts.slug }).from(districts).where(eq(districts.active, true)))
      .map((r) => r.slug),
  ["all-district-slugs"],
  { tags: ["districts"] }
);

/**
 * `{ district, area }` pairs for /area/doctors/[district]/[area].
 *
 * Only thanas that actually HAVE a doctor. Prebuilding all ~1,240 combinations
 * spent most of the build rendering empty pages that `generateMetadata` already
 * marks `noindex` — they are not in the sitemap and Google is told to ignore
 * them. An empty thana still resolves on demand (dynamicParams is true) and
 * starts being prebuilt automatically as soon as it gains a doctor.
 *
 * Reuses getAreasForGeo(), which counts a doctor through EITHER a visible
 * chamber in the thana or a hospital located in it, so this adds no extra
 * query. That two-way rule matters here specifically: while that reader counted
 * chambers only, every thana on a hospital-linked dataset reported zero and
 * this list came back empty — meaning no thana page was prerendered at all and
 * all of them fell back to rendering per request.
 */
export const getAllAreaSlugPairs = unstable_cache(
  async () => {
    const areas = await getAreasForGeo();
    return areas
      .filter((a) => a.doctorCount > 0 && a.slug && a.district_slug)
      .map((a) => ({ area: a.slug, district: a.district_slug as string }));
  },
  // Bumped alongside geo-areas-v5 — this list is derived from those counts.
  ["all-area-slug-pairs-v3"],
  { tags: ["areas", "districts", "doctors"] }
);

// ==========================================================================
// INTERNAL LINKING — crawlable link sets for the hub pages.
//
// Every landing page the sitemap advertises has to be REACHABLE by following
// links, not just listed in an XML file. Before these readers existed, the
// /specialties/<spec>/<thana> combination pages (a whole sitemap section) had
// zero inbound links from anywhere on the site: the only navigation into them
// was the filter sidebar, which is client-side state and renders no anchors at
// all. Googlebot does not operate <select> elements, so those pages were
// orphans — indexed at best, never given any link equity.
//
// COVERAGE RULE. `doctor_area` below is byte-for-byte the rule used by
// src/lib/sitemap-core.ts, and that is the point: a link is only emitted when
// the page behind it has at least one doctor to show. The sitemap uses the rule
// to decide which URLs to advertise; these readers use it to decide which URLs
// to link. The two therefore agree by construction, so no link here can ever
// point at a page that generateMetadata() has marked `noindex` for being empty.
//
//   doctor -> visible chamber -> thana
//   doctor -> profile hospital -> thana   (ONLY when they have no such chamber)
// ==========================================================================

const DOCTOR_AREA_CTE = sql`
  doctor_area AS (
    SELECT DISTINCT c.doctor_id, c.area_id
      FROM chambers c
     WHERE c.visible AND c.area_id IS NOT NULL
    UNION
    SELECT DISTINCT d.id AS doctor_id, h.area_id
      FROM doctors d
      JOIN hospitals h ON h.id = d.hospital_id
     WHERE h.area_id IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM chambers cx
          WHERE cx.doctor_id = d.id AND cx.visible AND cx.area_id IS NOT NULL
       )
  )`;

export type HubLink = {
  slug: string;
  name: string;
  /** Second line on the chip — the thana for a hospital, the district for a thana. */
  context?: string | null;
  district_slug?: string | null;
  /**
   * Second path segment for destinations that need two slugs, e.g. the
   * specialty × thana combination pages (`/specialties/<slug>/<slug2>`).
   */
  slug2?: string | null;
  doctor_count: number;
};

type NameRow = { slug: string; name_ml: MLText; doctor_count: number };

/**
 * Everything a district listing page can legitimately link OUT to: the thanas
 * inside it, the specialties practised in it, and the hospitals located in it.
 *
 * This is what turns /districts/khulna/doctors from a dead end into a hub. It
 * gives the page real supporting content AND hands Googlebot a crawl path down
 * into the long tail (thana pages, which in turn link to the specialty × thana
 * combinations — see getSpecialtiesInArea below).
 */
export const getDistrictHubLinks = unstable_cache(
  async (
    districtSlug: string,
    locale: Locale
  ): Promise<{ thanas: HubLink[]; specialties: HubLink[]; hospitals: HubLink[] }> => {
    const [thanaRes, specRes, hospRes] = await Promise.all([
      db.execute<NameRow>(sql`
        WITH ${DOCTOR_AREA_CTE}
        SELECT a.slug, a.name AS name_ml, COUNT(DISTINCT d.id)::int AS doctor_count
          FROM doctor_area da
          JOIN doctors d ON d.id = da.doctor_id AND d.active
          JOIN areas a ON a.id = da.area_id AND a.active
          JOIN districts dist ON dist.id = a.district_id AND dist.active
         WHERE dist.slug = ${districtSlug}
         GROUP BY a.slug, a.name, a.sort
         ORDER BY doctor_count DESC, a.sort, a.slug
      `),
      db.execute<NameRow>(sql`
        WITH ${DOCTOR_AREA_CTE}
        SELECT s.slug, s.name AS name_ml, COUNT(DISTINCT d.id)::int AS doctor_count
          FROM doctor_area da
          JOIN doctors d ON d.id = da.doctor_id AND d.active
          JOIN doctor_specialties ds ON ds.doctor_id = d.id
          JOIN specialties s ON s.id = ds.specialty_id AND s.active
          JOIN areas a ON a.id = da.area_id AND a.active
          JOIN districts dist ON dist.id = a.district_id AND dist.active
         WHERE dist.slug = ${districtSlug}
         GROUP BY s.slug, s.name, s.sort
         ORDER BY doctor_count DESC, s.sort, s.slug
      `),
      db.execute<NameRow & { area_ml: MLText }>(sql`
        SELECT h.slug, h.name AS name_ml, a.name AS area_ml,
               COUNT(DISTINCT d.id)::int AS doctor_count
          FROM hospitals h
          JOIN doctors d ON d.hospital_id = h.id AND d.active
          JOIN areas a ON a.id = h.area_id AND a.active
          JOIN districts dist ON dist.id = a.district_id AND dist.active
         WHERE h.active AND dist.slug = ${districtSlug}
         GROUP BY h.slug, h.name, a.name, h.sort
         ORDER BY doctor_count DESC, h.sort, h.slug
      `),
    ]);

    return {
      thanas: thanaRes.rows.map((r) => ({
        slug: r.slug,
        name: ml(r.name_ml, locale),
        district_slug: districtSlug,
        doctor_count: r.doctor_count,
      })),
      specialties: specRes.rows.map((r) => ({
        slug: r.slug,
        name: ml(r.name_ml, locale),
        doctor_count: r.doctor_count,
      })),
      hospitals: hospRes.rows.map((r) => ({
        slug: r.slug,
        name: ml(r.name_ml, locale),
        context: ml(r.area_ml, locale) || null,
        doctor_count: r.doctor_count,
      })),
    };
  },
  ["district-hub-links-v1"],
  { tags: ["districts", "areas", "specialties", "hospitals", "doctors"] }
);

export type DistrictSpecialtyPair = {
  district_slug: string;
  specialty_slug: string;
  doctor_count: number;
  updated_at: string | null;
};

/**
 * Every district × specialty pairing that actually has doctors.
 *
 * These are the highest-intent pages on the site: "খুলনায় হৃদরোগ বিশেষজ্ঞ" is
 * how people search, far more than by thana. The thana equivalent
 * (getSpecialtiesInArea, feeding /specialties/<spec>/<thana>) covers the long
 * tail below this.
 *
 * Same coverage chain as everything else, so a pairing exists here if and only
 * if its page has doctors to show, which is what keeps the sitemap, the
 * `noindex` rule and the internal links agreeing with each other.
 */
export const getDistrictSpecialtyPairs = unstable_cache(
  async (): Promise<DistrictSpecialtyPair[]> => {
    const res = await db.execute<DistrictSpecialtyPair>(sql`
      WITH ${DOCTOR_AREA_CTE}
      SELECT dist.slug AS district_slug,
             s.slug AS specialty_slug,
             COUNT(DISTINCT d.id)::int AS doctor_count,
             GREATEST(MAX(d.updated_at), MAX(dist.updated_at)) AS updated_at
        FROM doctor_area da
        JOIN doctors d ON d.id = da.doctor_id AND d.active
        JOIN doctor_specialties ds ON ds.doctor_id = d.id
        JOIN specialties s ON s.id = ds.specialty_id AND s.active
        JOIN areas a ON a.id = da.area_id AND a.active
        JOIN districts dist ON dist.id = a.district_id AND dist.active
       GROUP BY dist.slug, s.slug, dist.sort, s.sort
       ORDER BY doctor_count DESC, dist.sort, s.sort
    `);
    return res.rows;
  },
  ["district-specialty-pairs-v1"],
  { tags: ["districts", "areas", "specialties", "doctors"] }
);

/**
 * The districts where ONE specialty has doctors.
 *
 * Rendered on /specialties/<slug> as links down to
 * /districts/<district>/<slug>. This is the reverse of the specialty cloud on
 * the district page, so the two page types point at each other instead of the
 * district version being reachable from one direction only.
 */
export const getDistrictsForSpecialty = unstable_cache(
  async (specialtySlug: string, locale: Locale): Promise<HubLink[]> => {
    const res = await db.execute<{ slug: string; name_ml: MLText; doctor_count: number }>(sql`
      WITH ${DOCTOR_AREA_CTE}
      SELECT dist.slug, dist.name AS name_ml, COUNT(DISTINCT d.id)::int AS doctor_count
        FROM doctor_area da
        JOIN doctors d ON d.id = da.doctor_id AND d.active
        JOIN doctor_specialties ds ON ds.doctor_id = d.id
        JOIN specialties s ON s.id = ds.specialty_id AND s.active
        JOIN areas a ON a.id = da.area_id AND a.active
        JOIN districts dist ON dist.id = a.district_id AND dist.active
       WHERE s.slug = ${specialtySlug}
       GROUP BY dist.slug, dist.name, dist.sort
       ORDER BY doctor_count DESC, dist.sort
    `);
    return res.rows.map((r) => ({
      slug: r.slug,
      name: ml(r.name_ml, locale),
      district_slug: r.slug,
      doctor_count: r.doctor_count,
    }));
  },
  ["districts-for-specialty-v1"],
  { tags: ["districts", "areas", "specialties", "doctors"] }
);

/**
 * Every district that has doctors, as link chips, busiest first.
 *
 * Rendered on /doctors so the main listing links to every district landing page
 * that has something on it. This block is deliberately NOT geo-aware: it is the
 * same for every visitor and for Googlebot, which is what makes it a reliable
 * crawl path to the district hubs from the site's most-linked listing.
 *
 * Reuses getDistrictsForGeo(), which the shared layout already reads on every
 * request, so this costs no additional query and inherits its tags — notably
 * NOT "doctors", so it cannot cascade a doctor edit across the site.
 */
export const getDistrictLinks = async (locale: Locale): Promise<HubLink[]> => {
  const rows = await getDistrictsForGeo();
  return rows
    .filter((r) => r.doctorCount > 0)
    .sort((a, b) => b.doctorCount - a.doctorCount)
    .map((r) => ({
      slug: r.slug,
      name: ml(r.name, locale),
      doctor_count: r.doctorCount,
    }));
};

/**
 * The busiest specialty × thana combinations site-wide.
 *
 * Rendered on /doctors as "popular searches". Two reasons it earns its place:
 *
 *   1. It states, in the page's own words, what people actually look for here
 *      ("Cardiologist in Boyra"), which is supporting content the bare listing
 *      never had.
 *   2. It is a ONE-hop link from the site's most-linked listing straight to the
 *      combination pages. Without it the only route is
 *      /doctors -> district -> thana -> combination, three hops deep, which is
 *      where crawl budget goes to die.
 *
 * Same coverage chain as everything else, so every pair listed has doctors.
 */
export const getPopularCombos = unstable_cache(
  async (locale: Locale, limit = 24): Promise<HubLink[]> => {
    const res = await db.execute<{
      specialty_slug: string; specialty_ml: MLText;
      area_slug: string; area_ml: MLText;
      doctor_count: number;
    }>(sql`
      WITH ${DOCTOR_AREA_CTE}
      SELECT s.slug AS specialty_slug, s.name AS specialty_ml,
             a.slug AS area_slug, a.name AS area_ml,
             COUNT(DISTINCT d.id)::int AS doctor_count
        FROM doctor_area da
        JOIN doctors d ON d.id = da.doctor_id AND d.active
        JOIN doctor_specialties ds ON ds.doctor_id = d.id
        JOIN specialties s ON s.id = ds.specialty_id AND s.active
        JOIN areas a ON a.id = da.area_id AND a.active
        JOIN districts dist ON dist.id = a.district_id AND dist.active
       GROUP BY s.slug, s.name, s.sort, a.slug, a.name, a.sort
       ORDER BY doctor_count DESC, s.sort, a.sort
       LIMIT ${limit}
    `);
    return res.rows.map((r) => ({
      slug: r.specialty_slug,
      slug2: r.area_slug,
      name: ml(r.specialty_ml, locale),
      context: ml(r.area_ml, locale) || null,
      doctor_count: r.doctor_count,
    }));
  },
  ["popular-combos-v1"],
  { tags: ["specialties", "areas", "doctors"] }
);

/**
 * Most recently updated doctor profiles.
 *
 * A freshness signal that is true rather than manufactured: it reflects real
 * edits, and it hands crawlers a short, always-current list of profile URLs
 * from a page they visit often. Ordered exactly like the `doctors` sitemap
 * section, so the two never disagree about what changed last.
 */
export const getRecentlyUpdatedDoctors = unstable_cache(
  async (locale: Locale, limit = 12): Promise<HubLink[]> => {
    const res = await db.execute<{
      slug: string; name_ml: MLText; specialty_ml: MLText;
    }>(sql`
      SELECT d.slug, d.name AS name_ml,
             (SELECT s.name FROM doctor_specialties ds
                JOIN specialties s ON s.id = ds.specialty_id
               WHERE ds.doctor_id = d.id
               ORDER BY ds.is_primary DESC, s.sort LIMIT 1) AS specialty_ml
        FROM doctors d
       WHERE d.active
       ORDER BY d.updated_at DESC, d.slug
       LIMIT ${limit}
    `);
    return res.rows.map((r) => ({
      slug: r.slug,
      name: ml(r.name_ml, locale),
      context: ml(r.specialty_ml, locale) || null,
      doctor_count: 0,
    }));
  },
  ["recent-doctors-v1"],
  { tags: ["doctors"] }
);

/**
 * Sibling thanas: the other thanas of a district that have doctors.
 *
 * Rendered on a thana page so neighbouring thanas link to each other instead of
 * every one of them being reachable only from its district. Excludes the thana
 * being viewed so a page never links to itself.
 */
export const getSiblingAreas = async (
  districtSlug: string,
  excludeAreaSlug: string,
  locale: Locale
): Promise<HubLink[]> => {
  const hub = await getDistrictHubLinks(districtSlug, locale);
  return hub.thanas.filter((a) => a.slug !== excludeAreaSlug);
};

/**
 * The specialties actually practised inside ONE thana.
 *
 * Rendered on /area/doctors/<district>/<thana> as links to
 * /specialties/<specialty>/<thana> — the combination pages. This is the primary
 * fix for those pages being orphans: every combination page the sitemap lists
 * is reachable in exactly two clicks from the homepage
 * (home -> district -> thana -> combination), and each link comes from the most
 * topically relevant page that could possibly point at it.
 */
export const getSpecialtiesInArea = unstable_cache(
  async (areaSlug: string, locale: Locale): Promise<HubLink[]> => {
    const res = await db.execute<NameRow>(sql`
      WITH ${DOCTOR_AREA_CTE}
      SELECT s.slug, s.name AS name_ml, COUNT(DISTINCT d.id)::int AS doctor_count
        FROM doctor_area da
        JOIN doctors d ON d.id = da.doctor_id AND d.active
        JOIN doctor_specialties ds ON ds.doctor_id = d.id
        JOIN specialties s ON s.id = ds.specialty_id AND s.active
        JOIN areas a ON a.id = da.area_id AND a.active
       WHERE a.slug = ${areaSlug}
       GROUP BY s.slug, s.name, s.sort
       ORDER BY doctor_count DESC, s.sort, s.slug
    `);
    return res.rows.map((r) => ({
      slug: r.slug,
      name: ml(r.name_ml, locale),
      doctor_count: r.doctor_count,
    }));
  },
  ["specialties-in-area-v1"],
  { tags: ["areas", "specialties", "doctors"] }
);

/**
 * The thanas where ONE specialty actually has doctors.
 *
 * Rendered on /specialties/<specialty> as links to
 * /specialties/<specialty>/<thana>. Same destinations as getSpecialtiesInArea,
 * approached from the other axis — so the combination pages sit in a proper
 * two-way link graph (hub -> combination -> hub) instead of hanging off one
 * thread, which is what "Internal Linking" actually asks for.
 */
export const getAreasForSpecialty = unstable_cache(
  async (specialtySlug: string, locale: Locale): Promise<HubLink[]> => {
    const res = await db.execute<NameRow & { district_slug: string; district_ml: MLText }>(sql`
      WITH ${DOCTOR_AREA_CTE}
      SELECT a.slug, a.name AS name_ml,
             dist.slug AS district_slug, dist.name AS district_ml,
             COUNT(DISTINCT d.id)::int AS doctor_count
        FROM doctor_area da
        JOIN doctors d ON d.id = da.doctor_id AND d.active
        JOIN doctor_specialties ds ON ds.doctor_id = d.id
        JOIN specialties s ON s.id = ds.specialty_id AND s.active
        JOIN areas a ON a.id = da.area_id AND a.active
        JOIN districts dist ON dist.id = a.district_id AND dist.active
       WHERE s.slug = ${specialtySlug}
       GROUP BY a.slug, a.name, a.sort, dist.slug, dist.name
       ORDER BY doctor_count DESC, a.sort, a.slug
    `);
    return res.rows.map((r) => ({
      slug: r.slug,
      name: ml(r.name_ml, locale),
      context: ml(r.district_ml, locale) || null,
      district_slug: r.district_slug,
      doctor_count: r.doctor_count,
    }));
  },
  ["areas-for-specialty-v1"],
  { tags: ["areas", "districts", "specialties", "doctors"] }
);
