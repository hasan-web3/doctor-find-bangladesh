import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { and, asc, desc, eq, exists, gte, ilike, inArray, isNull, lte, or, sql } from "drizzle-orm";
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
  address: string; phone: string | null; lat: number | null; lng: number | null;
  description: string; departments: string[]; map_url: string | null; image_url: string | null; image_key: string | null;
  gallery: { key: string; url: string }[]; meta_title: string; meta_description: string;
  active: boolean; doctor_count: number;
};

export type DoctorCardData = {
  id: number; slug: string; name: string; degrees: string; photo_url: string | null;
  verified: boolean; featured: boolean;
  specialty: string; specialty_slug: string | null;
  hospital: string; hospital_slug: string | null;
  chamber: string; area: string; area_slug: string | null; fee: number | null;
  experience_years: number | null;
};

// DoctorFull overrides `hospital` to a full object (not the card's string).
export type DoctorFull = Omit<DoctorCardData, "hospital"> & {
  bio: string; gender: string | null; experience_years: number | null;
  patients_served: string; photo_key: string | null; active: boolean;
  // Locale-resolved list of conditions this doctor treats (stored in DB as
  // bilingual `{ bn: [], en: [] }` JSONB). Empty array when unset.
  treated_conditions: string[];
  meta_title: string; meta_description: string;
  // Verified social profiles for JSON-LD `sameAs` (Knowledge Panel eligibility).
  social_links: SocialLinks;
  specialties: { id: number; slug: string; name: string }[];
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
  photo_url: string | null; verified: boolean; featured: boolean;
  specialty_ml: MLText | null; specialty_slug: string | null;
  hospital_ml: MLText | null; hospital_slug: string | null;
  chamber_ml: MLText | null; area_ml: MLText | null; area_slug: string | null;
  fee: number | null;
  experience_years: number | null;
};

const cardSelect = sql`
  d.id, d.slug, d.name AS name_ml, d.degrees AS degrees_ml, d.photo_url, d.verified, d.featured,
  sp.name AS specialty_ml, sp.slug AS specialty_slug,
  hp.name AS hospital_ml, hp.slug AS hospital_slug,
  ch.name AS chamber_ml, ar.name AS area_ml, ar.slug AS area_slug, ch.fee,
  d.experience_years`;

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
    SELECT c.name, c.fee, c.area_id FROM chambers c
    WHERE c.doctor_id = d.id AND c.visible ORDER BY c.sort LIMIT 1
  ) ch ON TRUE
  LEFT JOIN areas ar ON ar.id = ch.area_id`;

function mapDoctorCard(row: CardRow, locale: Locale): DoctorCardData {
  return {
    id: row.id,
    slug: row.slug,
    name: ml(row.name_ml, locale),
    degrees: ml(row.degrees_ml, locale),
    photo_url: row.photo_url ?? null,
    verified: row.verified,
    featured: row.featured,
    specialty: ml(row.specialty_ml, locale),
    specialty_slug: row.specialty_slug ?? null,
    hospital: ml(row.hospital_ml, locale),
    hospital_slug: row.hospital_slug ?? null,
    chamber: ml(row.chamber_ml, locale),
    area: ml(row.area_ml, locale),
    area_slug: row.area_slug ?? null,
    fee: row.fee ?? null,
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
  { tags: ["specialties", "doctors"] }
);

export const getAreas = unstable_cache(
  async (locale: Locale, raw = false) => {
    const doctorCount = sql<number>`(
      SELECT COUNT(DISTINCT c.doctor_id)::int FROM chambers c
      JOIN doctors d ON d.id = c.doctor_id AND d.active
      WHERE c.area_id = "areas"."id" AND c.visible
    )`.as("doctor_count");

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
        intro: areasT.intro,
        metaTitle: areasT.metaTitle,
        metaDescription: areasT.metaDescription,
        active: areasT.active,
        sort: areasT.sort,
        doctorCount,
      })
      .from(areasT)
      .leftJoin(districts, eq(areasT.districtId, districts.id))
      .where(eq(areasT.active, true))
      .orderBy(asc(areasT.sort), asc(areasT.id));

    if (raw) return rows.map(a => ({ ...a, name_ml: a.name, district_ml: a.district }));

    return rows.map((a): Area => ({
      id: a.id, slug: a.slug,
      name: ml(a.name, locale), district_id: a.districtId, district: ml(a.district, locale),
      district_slug: a.districtSlug,
      lat: a.lat, lng: a.lng,
      intro: ml(a.intro, locale), meta_title: ml(a.metaTitle, locale),
      meta_description: ml(a.metaDescription, locale),
      active: a.active, sort: a.sort,
      doctor_count: a.doctorCount,
    }));
  },
  ["areas-list"],
  { tags: ["areas", "doctors"] }
);

export const getSpecialtyBySlug = async (slug: string, locale: Locale) =>
  (await getSpecialties(locale)).find((s) => s.slug === slug) ?? null;

export const getAreaBySlug = async (slug: string, locale: Locale) =>
  (await getAreas(locale) as Area[]).find((a) => a.slug === slug) ?? null;

export const getAreaBySlugs = async (districtSlug: string, areaSlug: string, locale: Locale) =>
  (await getAreas(locale) as Area[]).find((a) => a.slug === areaSlug && a.district_slug === districtSlug) ?? null;

export const getDistrictBySlug = async (slug: string, locale: Locale) => {
  const allDistricts = await db.select().from(districts).where(eq(districts.active, true));
  const district = allDistricts.find(d => d.slug === slug);
  if (!district) return null;

  return {
    ...district,
    name: ml(district.name, locale),
    intro: ml(district.intro, locale),
    meta_title: ml(district.metaTitle, locale),
    meta_description: ml(district.metaDescription, locale),
  };
};

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
          SELECT COUNT(DISTINCT c.doctor_id)::int
          FROM chambers c JOIN doctors dr ON dr.id = c.doctor_id
          WHERE c.area_id = a.id AND c.visible AND dr.active
        ) AS "doctorCount"
      FROM areas a
      LEFT JOIN districts d ON d.id = a.district_id
      WHERE a.active
      ORDER BY a.sort
    `);
    return res.rows;
  },
  ["geo-areas-v4"],
  { tags: ["areas", "doctors", "districts"] }
);

// ---------- hospitals ----------
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
    district_slug: h.districtSlug ?? null,
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

export const getHospitalBySlug = async (slug: string, locale: Locale) =>
  (await db.select().from(hospitalsT).where(eq(hospitalsT.slug, slug)).limit(1)).map(h => ({
    id: h.id, slug: h.slug, name: ml(h.name, locale),
    area_id: h.areaId, area: "", area_slug: null, // Simplified for this context
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
    preferLat: geo.lat,
    preferLng: geo.lng,
    preferAreaId: geo.areaId,
    preferDistrictId: geo.districtId,
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
export const getFeaturedDoctors = unstable_cache(
  async (locale: Locale, limit = 8) => {
    const res = await db.execute<CardRow>(sql`
      SELECT ${cardSelect} ${cardFrom}
      WHERE d.active AND d.featured
      ORDER BY d.updated_at DESC LIMIT ${limit}
    `);
    return (res.rows as CardRow[]).map((r) => mapDoctorCard(r, locale));
  },
  ["featured-doctors"],
  { tags: ["doctors", "reviews"] }
);

export async function getHomepageDoctors(
  geo: GeoResult,
  locale: Locale,
  limit = 12
): Promise<DoctorCardData[]> {
  // The homepage now uses the main search function to ensure logic is unified.
  // We pass the geo-preferences and a limit.
  const results = await searchDoctors({
    perPage: limit,
    preferLat: geo.lat,
    preferLng: geo.lng,
    preferAreaId: geo.areaId,
    preferDistrictId: geo.districtId,
  }, locale);
  return results.rows;
}

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
};

export async function searchDoctors(
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
      // Include doctors linked to this thana either through a visible chamber
      // OR through their profile hospital — mirror of the district filter so
      // the "must have a chamber" rule doesn't hide hospital-only doctors.
      conditions.push(sql`(
        EXISTS (SELECT 1 FROM chambers c3 JOIN areas a3 ON a3.id = c3.area_id
                WHERE c3.doctor_id = d.id AND c3.visible AND a3.slug IN (${list}))
        OR EXISTS (SELECT 1 FROM hospitals ha JOIN areas aa ON aa.id = ha.area_id
                   WHERE ha.id = d.hospital_id AND aa.slug IN (${list}))
      )`);
    }
    if (params.district && params.district.length > 0) {
      const ds = Array.isArray(params.district) ? params.district : [params.district];
      const list = sql.join(ds.map((s) => sql`${s}`), sql`, `);
      conditions.push(sql`(
        EXISTS (SELECT 1 FROM chambers cd JOIN areas ad ON ad.id = cd.area_id
                JOIN districts dd ON dd.id = ad.district_id
                WHERE cd.doctor_id = d.id AND cd.visible AND dd.slug IN (${list}))
        OR EXISTS (SELECT 1 FROM hospitals hd JOIN areas hda ON hda.id = hd.area_id
                   JOIN districts hdd ON hdd.id = hda.district_id
                   WHERE hd.id = d.hospital_id AND hdd.slug IN (${list}))
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
    const userDistrictId = params.preferDistrictId;

    // If a specific sort order is requested (e.g., by fee), use it.
    if (params.sort) {
      const orderParts = [];
      switch (params.sort) {
        case "fee_asc": orderParts.push(sql`ch.fee ASC NULLS LAST`); break;
        case "fee_desc": orderParts.push(sql`ch.fee DESC NULLS LAST`); break;
        case "experience": orderParts.push(sql`d.experience_years DESC NULLS LAST`); break;
      }
      // Even with an explicit sort, we still use quality signals as a tie-breaker.
      orderParts.push(sql`(CASE WHEN d.featured THEN 1 WHEN d.verified THEN 2 ELSE 3 END)`);
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
            SELECT ch.lat, ch.lng, ch.area_id
            FROM chambers ch
            WHERE ch.doctor_id = dd.id AND ch.visible
            ORDER BY ch.sort ASC, ch.id ASC
            LIMIT 1
          ) fc ON TRUE
          LEFT JOIN areas     fa  ON fa.id  = fc.area_id
          LEFT JOIN districts fd  ON fd.id  = fa.district_id
          LEFT JOIN hospitals dh  ON dh.id  = dd.hospital_id
          LEFT JOIN areas     dha ON dha.id = dh.area_id
          LEFT JOIN districts dhd ON dhd.id = dha.district_id
          WHERE dd.id = d.id
        ) pt
        WHERE pt.lat IS NOT NULL AND pt.lng IS NOT NULL
      )`;

      // Priority ladder matches the product spec:
      //   1. Featured  ≤ 100 km
      //   2. Verified  ≤ 100 km
      //   3. Normal    ≤ 100 km
      //   4. Featured  > 100 km (or unknown distance)
      //   5. Verified  > 100 km
      //   6. Normal    > 100 km
      // Within each tier, ORDER BY distance ASC so the physically closest
      // doctor bubbles to the top. `NULLS LAST` keeps doctors with no usable
      // coord out of the way. The user's IP-derived coords come from the
      // geo cookie / Vercel edge headers, so this executes without any extra
      // IP-API fetch per request.
      orderSql = sql`
        CASE
          WHEN d.featured AND (${minDistanceSql}) <= 100 THEN 1
          WHEN d.verified AND (${minDistanceSql}) <= 100 THEN 2
          WHEN (${minDistanceSql}) <= 100 THEN 3
          WHEN d.featured THEN 4
          WHEN d.verified THEN 5
          ELSE 6
        END ASC,
        (${minDistanceSql}) ASC NULLS LAST,
        d.updated_at DESC,
        d.id DESC
      `;
    } else {
      // Fallback if no coordinates are available, but we have area/district IDs.
      orderSql = sql`
        CASE
          -- 1. Featured in user's area
          WHEN d.featured AND EXISTS (SELECT 1 FROM chambers cg WHERE cg.doctor_id = d.id AND cg.visible AND cg.area_id = ${userAreaId ?? null}) THEN 1
          -- 2. Featured in user's district
          WHEN d.featured AND EXISTS (SELECT 1 FROM chambers cd JOIN areas ad ON ad.id = cd.area_id WHERE cd.doctor_id = d.id AND cd.visible AND ad.district_id = ${userDistrictId ?? null}) THEN 2
          -- 3. Verified in user's area
          WHEN d.verified AND EXISTS (SELECT 1 FROM chambers cg WHERE cg.doctor_id = d.id AND cg.visible AND cg.area_id = ${userAreaId ?? null}) THEN 3
          -- 4. Verified in user's district
          WHEN d.verified AND EXISTS (SELECT 1 FROM chambers cd JOIN areas ad ON ad.id = cd.area_id WHERE cd.doctor_id = d.id AND cd.visible AND ad.district_id = ${userDistrictId ?? null}) THEN 4
          -- 5. Normal in user's area
          WHEN d.active AND EXISTS (SELECT 1 FROM chambers cg WHERE cg.doctor_id = d.id AND cg.visible AND cg.area_id = ${userAreaId ?? null}) THEN 5
          -- 6. Normal in user's district
          WHEN d.active AND EXISTS (SELECT 1 FROM chambers cd JOIN areas ad ON ad.id = cd.area_id WHERE cd.doctor_id = d.id AND cd.visible AND ad.district_id = ${userDistrictId ?? null}) THEN 6
          -- 7. Other featured
          WHEN d.featured THEN 7
          -- 8. Other verified
          WHEN d.verified THEN 8
          -- 9. Anything else
          ELSE 9
        END ASC,
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
    }>(sql`
      SELECT ${cardSelect},
        d.bio AS bio_ml, d.gender, d.experience_years, d.patients_served AS patients_ml, d.photo_key,
        d.active, d.hospital_id, d.meta_title AS mt_ml, d.meta_description AS md_ml,
        d.social_links,
        d.treated_conditions
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
      meta_title: ml(doc.mt_ml, locale),
      meta_description: ml(doc.md_ml, locale),
      social_links: doc.social_links ?? {},
      specialties: specialtyRows.map((s) => ({
        id: s.id, slug: s.slug, name: ml(s.name, locale),
      })),
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
        area: ml(c.areaMl, locale),
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
          eq(faqsT.scope, scope as "home" | "specialty" | "area" | "hospital" | "doctor"),
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

  if (expired.length > 0) {
    const doctorIds = expired.map((e) => e.doctorId);
    await db
      .update(doctorsT)
      .set({ featured: false, updatedAt: new Date() })
      .where(
        and(
          inArray(doctorsT.id, doctorIds),
          sql`NOT EXISTS (
            SELECT 1 FROM promotions p WHERE p.doctor_id = ${doctorsT.id}
            AND p.status = 'active' AND p.plan IN ('featured','premium')
          )`
        )
      );
  }
  return expired.length;
}

export const getNearbyAreas = async (
  locale: Locale,
  districtId: number | null,
  lat: number | null,
  lng: number | null
): Promise<{ id: number; slug: string; name: string, district_slug: string | null }[]> => {
  // Primary path: If a district is detected, find the nearest areas within it.
  if (districtId) {
    const areasInDistrict = await db
      .select({
        id: areasT.id,
        slug: areasT.slug,
        name: areasT.name,
        districtSlug: districts.slug,
        lat: areasT.lat,
        lng: areasT.lng,
        sort: areasT.sort,
      })
      .from(areasT)
      .leftJoin(districts, eq(districts.id, areasT.districtId))
      .where(and(eq(areasT.active, true), eq(areasT.districtId, districtId)));

    if (areasInDistrict.length === 0) return [];

    if (lat && lng) {
      const ranked = areasInDistrict
        .map((a) => ({
          ...a,
          dist: a.lat && a.lng ? haversineKm(lat, lng, a.lat, a.lng) : Infinity,
        }))
        .sort((a, b) => a.dist - b.dist);

      return ranked.slice(0, 6).map((a) => ({
        id: a.id,
        slug: a.slug,
        name: ml(a.name, locale),
        district_slug: a.districtSlug
      }));
    }

    // Fallback sort if no coords within the district
    return areasInDistrict
      .sort((a, b) => a.sort - b.sort)
      .slice(0, 6)
      .map((a) => ({
        id: a.id,
        slug: a.slug,
        name: ml(a.name, locale),
        district_slug: a.districtSlug
      }));
  }

  // Fallback path: If no location is detected, show the most popular areas site-wide.
  const doctorCount = sql<number>`(
      SELECT COUNT(DISTINCT c.doctor_id)::int FROM chambers c
      JOIN doctors d ON d.id = c.doctor_id AND d.active
      WHERE c.area_id = "areas"."id" AND c.visible
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


export async function getDoctorsByAreaSlug(
  slug: string,
  locale: Locale
): Promise<(DoctorCardData & { specialtySlugs: string[] })[]> {
  const rows = await db.execute<CardRow & { specialty_slugs: string[] }>(sql`
    SELECT
      d.id, d.slug, d.name AS name_ml, d.degrees AS degrees_ml, d.photo_url, d.verified, d.featured,
      sp.name AS specialty_ml, sp.slug AS specialty_slug,
      hp.name AS hospital_ml, hp.slug AS hospital_slug,
      ch.name AS chamber_ml, ar.name AS area_ml, ar.slug AS area_slug, ch.fee,
      (
        SELECT array_agg(s_inner.slug)
        FROM doctor_specialties ds_inner
        JOIN specialties s_inner ON s_inner.id = ds_inner.specialty_id
        WHERE ds_inner.doctor_id = d.id
      ) as specialty_slugs
    FROM doctors d
    JOIN chambers c ON c.doctor_id = d.id
    JOIN areas a ON a.id = c.area_id AND a.slug = ${slug}
    LEFT JOIN LATERAL (
      SELECT s.name, s.slug FROM doctor_specialties ds
      JOIN specialties s ON s.id = ds.specialty_id
      WHERE ds.doctor_id = d.id AND ds.is_primary = TRUE
      LIMIT 1
    ) sp ON TRUE
    LEFT JOIN hospitals hp ON hp.id = d.hospital_id
    LEFT JOIN LATERAL (
      SELECT c2.name, c2.fee, c2.area_id FROM chambers c2
      WHERE c2.doctor_id = d.id AND c2.visible ORDER BY c2.sort LIMIT 1
    ) ch ON TRUE
    LEFT JOIN areas ar ON ar.id = ch.area_id
    WHERE d.active
    GROUP BY d.id, sp.name, sp.slug, hp.name, hp.slug, ch.name, ch.fee, ch.area_id, ar.name, ar.slug
    ORDER BY d.featured DESC, d.verified DESC, d.updated_at DESC
  `);

  return rows.rows.map(r => ({
    ...mapDoctorCard(r, locale),
    specialtySlugs: r.specialty_slugs || [],
  }));
}


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

  // Count doctors "belonging" to this thana in either of two ways:
  //   1. They run a visible chamber in this thana.
  //   2. They have no chamber at all (or all hidden) but their profile-linked
  //      hospital sits in this thana.
  // DISTINCT so a doctor with BOTH still counts once.
  const doctorCountSubquery = sql`(
    SELECT COUNT(DISTINCT doc.id)::int
    FROM doctors doc
    WHERE doc.active AND (
      EXISTS (
        SELECT 1 FROM chambers c
        WHERE c.doctor_id = doc.id AND c.visible AND c.area_id = a.id
      )
      OR EXISTS (
        SELECT 1 FROM hospitals h
        WHERE h.id = doc.hospital_id AND h.area_id = a.id
      )
    )
  )`;

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
  const orderParts = [];

  // District ranking uses ONLY district coordinates — no chamber, no hospital.
  // The visitor's own district pins to the top, then nearest-first.
  if (p.preferDistrictId != null) {
    orderParts.push(sql`CASE WHEN districts.id = ${p.preferDistrictId} THEN 0 ELSE 1 END ASC`);
  }
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

  const thanaCountSubquery = sql`(
    SELECT COUNT(*)::int FROM ${areasT}
    WHERE ${areasT.districtId} = districts.id AND ${areasT.active}
  )`;

  // Count doctors "belonging" to this district in either of two ways:
  //   1. They run a visible chamber in a thana of this district.
  //   2. They have no chamber (or all hidden) but their profile-linked
  //      hospital sits in a thana of this district.
  // DISTINCT so a doctor with BOTH still counts once.
  const doctorCountSubquery = sql`(
    SELECT COUNT(DISTINCT doc.id)::int
    FROM ${doctorsT} doc
    WHERE doc.active AND (
      EXISTS (
        SELECT 1 FROM ${chambersT} c
        JOIN ${areasT} a ON a.id = c.area_id
        WHERE c.doctor_id = doc.id AND c.visible AND a.district_id = districts.id
      )
      OR EXISTS (
        SELECT 1 FROM ${hospitalsT} h
        JOIN ${areasT} a2 ON a2.id = h.area_id
        WHERE h.id = doc.hospital_id AND a2.district_id = districts.id
      )
    )
  )`;

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

