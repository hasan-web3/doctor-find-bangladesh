import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import {
  getDistrictHubLinks,
  getSpecialtiesInArea,
  getAreasForSpecialty,
  countDoctorsFor,
} from "@/lib/data";
import {
  districtFaqSeeds,
  areaFaqSeeds,
  specialtyFaqSeeds,
  hospitalFaqSeeds,
  doctorFaqSeeds,
  type FaqSeed,
} from "@/lib/faq-defaults";
/**
 * `(1, 2, 3)` as bound parameters.
 *
 * Embedding a JS array straight into a `sql` template binds it as ONE value,
 * which produces `IN $1` and fails against a bigint column. Each id has to be
 * its own placeholder.
 */
function idList(ids: number[]) {
  return sql`(${sql.join(ids.map((i) => sql`${i}`), sql`, `)})`;
}
import type { FaqScope } from "./scopes";

/**
 * How many PAGES of each scope currently carry an FAQ block.
 *
 * The dashboard used to count rows in the `faqs` table, which showed 0 against
 * every scope whose FAQs are generated — misleading, since those pages do have
 * FAQs, just not stored ones. This counts qualifying ENTITIES instead, using
 * the same coverage rule as the generators and the sitemap.
 *
 * One round trip: five scalar subqueries in a single statement, rather than
 * five separate reads. `doctor_area` mirrors sitemap-core.ts, which is what
 * keeps this count in step with what actually renders.
 */
export async function faqEntityCounts(): Promise<Record<string, number>> {
  try {
    const res = await db.execute<{
      specialty: number; district: number; area: number; hospital: number; doctor: number;
    }>(sql`
      WITH doctor_area AS (
        SELECT DISTINCT c.doctor_id, c.area_id
          FROM chambers c WHERE c.visible AND c.area_id IS NOT NULL
        UNION
        SELECT DISTINCT d.id, h.area_id
          FROM doctors d JOIN hospitals h ON h.id = d.hospital_id
         WHERE h.area_id IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM chambers cx
                            WHERE cx.doctor_id = d.id AND cx.visible AND cx.area_id IS NOT NULL)
      )
      SELECT
        (SELECT COUNT(*)::int FROM specialties s
          WHERE s.active AND EXISTS (
            SELECT 1 FROM doctor_specialties ds JOIN doctors d ON d.id = ds.doctor_id AND d.active
             WHERE ds.specialty_id = s.id)) AS specialty,
        (SELECT COUNT(DISTINCT dist.id)::int
           FROM doctor_area da JOIN doctors d ON d.id = da.doctor_id AND d.active
           JOIN areas a ON a.id = da.area_id AND a.active
           JOIN districts dist ON dist.id = a.district_id AND dist.active) AS district,
        (SELECT COUNT(DISTINCT a.id)::int
           FROM doctor_area da JOIN doctors d ON d.id = da.doctor_id AND d.active
           JOIN areas a ON a.id = da.area_id AND a.active) AS area,
        (SELECT COUNT(*)::int FROM hospitals WHERE active) AS hospital,
        (SELECT COUNT(*)::int FROM doctors WHERE active) AS doctor
    `);
    const r = res.rows[0];
    return r ? { specialty: r.specialty, district: r.district, area: r.area, hospital: r.hospital, doctor: r.doctor } : {};
  } catch (err) {
    console.error("FAQ entity counts failed:", err);
    return {};
  }
}

/**
 * How many FAQs each listed entity's page actually shows.
 *
 * The dashboard cards used to print the number of STORED rows, which is 0 for
 * anything whose FAQs are generated — so every doctor read "0" while its page
 * showed six. This returns the real number.
 *
 * Two design choices worth knowing:
 *
 *  1. ONE query per page of entities, not one per entity. It fetches only the
 *     facts the generators branch on (does this doctor have chambers? does this
 *     district have hospitals?), for every id at once.
 *
 *  2. It then calls the REAL generators from faq-defaults.ts, passing a
 *     one-element placeholder array wherever a fact is "yes". The generators
 *     only test `.length > 0` on those lists, so the resulting COUNT is exact
 *     while the question of WHICH seeds exist stays answered in exactly one
 *     place. Re-deriving the seed list here in SQL would drift the first time
 *     somebody edits a generator.
 */
export async function seedCountsForEntities(
  scope: FaqScope,
  ids: number[]
): Promise<Map<number, number>> {
  const out = new Map<number, number>();
  if (scope === "home" || ids.length === 0) return out;

  const some = (yes: boolean) => (yes ? ["x"] : []);

  try {
    if (scope === "doctor") {
      const res = await db.execute<{
        id: number; has_specialty: boolean; has_chamber: boolean; has_schedule: boolean; fee: number | null;
      }>(sql`
        SELECT d.id,
               EXISTS (SELECT 1 FROM doctor_specialties ds WHERE ds.doctor_id = d.id) AS has_specialty,
               EXISTS (SELECT 1 FROM chambers c WHERE c.doctor_id = d.id AND c.visible) AS has_chamber,
               EXISTS (SELECT 1 FROM chambers c WHERE c.doctor_id = d.id AND c.visible
                        AND jsonb_array_length(COALESCE(c.schedule, '[]'::jsonb)) > 0) AS has_schedule,
               (SELECT c.fee FROM chambers c WHERE c.doctor_id = d.id AND c.visible ORDER BY c.sort LIMIT 1) AS fee
          FROM doctors d WHERE d.id IN ${idList(ids)}
      `);
      for (const r of res.rows) {
        out.set(Number(r.id), doctorFaqSeeds({
          name: "x", specialty: r.has_specialty ? "x" : "", district: "",
          chamberNames: some(r.has_chamber), hasSchedule: r.has_schedule, fee: r.fee,
        }).length);
      }
      return out;
    }

    if (scope === "district") {
      const res = await db.execute<{
        id: number; doctor_count: number; has_thanas: boolean; has_specialties: boolean; has_hospitals: boolean;
      }>(sql`
        WITH doctor_area AS (
          SELECT DISTINCT c.doctor_id, c.area_id FROM chambers c WHERE c.visible AND c.area_id IS NOT NULL
          UNION
          SELECT DISTINCT d.id, h.area_id FROM doctors d JOIN hospitals h ON h.id = d.hospital_id
           WHERE h.area_id IS NOT NULL
             AND NOT EXISTS (SELECT 1 FROM chambers cx WHERE cx.doctor_id = d.id AND cx.visible AND cx.area_id IS NOT NULL)
        )
        SELECT dist.id,
               (SELECT COUNT(DISTINCT d.id)::int FROM doctor_area da
                  JOIN doctors d ON d.id = da.doctor_id AND d.active
                  JOIN areas a ON a.id = da.area_id AND a.active
                 WHERE a.district_id = dist.id) AS doctor_count,
               EXISTS (SELECT 1 FROM doctor_area da JOIN doctors d ON d.id = da.doctor_id AND d.active
                        JOIN areas a ON a.id = da.area_id AND a.active WHERE a.district_id = dist.id) AS has_thanas,
               EXISTS (SELECT 1 FROM doctor_area da JOIN doctors d ON d.id = da.doctor_id AND d.active
                        JOIN doctor_specialties ds ON ds.doctor_id = d.id
                        JOIN areas a ON a.id = da.area_id AND a.active WHERE a.district_id = dist.id) AS has_specialties,
               EXISTS (SELECT 1 FROM hospitals h JOIN areas a ON a.id = h.area_id
                        JOIN doctors d ON d.hospital_id = h.id AND d.active
                       WHERE h.active AND a.district_id = dist.id) AS has_hospitals
          FROM districts dist WHERE dist.id IN ${idList(ids)}
      `);
      for (const r of res.rows) {
        out.set(Number(r.id), districtFaqSeeds({
          name: "x", doctorCount: r.doctor_count,
          thanas: some(r.has_thanas), specialties: some(r.has_specialties), hospitals: some(r.has_hospitals),
        }).length);
      }
      return out;
    }

    if (scope === "area") {
      // `has_specialties` must use the SAME chamber-or-hospital rule as
      // getSpecialtiesInArea, which is what the generator actually calls.
      // Checking chambers alone under-reported by one on every thana whose
      // doctors are attached through a hospital.
      const res = await db.execute<{ id: number; doctor_count: number; has_specialties: boolean }>(sql`
        WITH doctor_area AS (
          SELECT DISTINCT c.doctor_id, c.area_id FROM chambers c WHERE c.visible AND c.area_id IS NOT NULL
          UNION
          SELECT DISTINCT d.id, h.area_id FROM doctors d JOIN hospitals h ON h.id = d.hospital_id
           WHERE h.area_id IS NOT NULL
             AND NOT EXISTS (SELECT 1 FROM chambers cx WHERE cx.doctor_id = d.id AND cx.visible AND cx.area_id IS NOT NULL)
        )
        SELECT a.id,
               (SELECT COUNT(DISTINCT d.id)::int FROM doctor_area da
                  JOIN doctors d ON d.id = da.doctor_id AND d.active
                 WHERE da.area_id = a.id) AS doctor_count,
               EXISTS (SELECT 1 FROM doctor_area da
                        JOIN doctors d ON d.id = da.doctor_id AND d.active
                        JOIN doctor_specialties ds ON ds.doctor_id = d.id
                        JOIN specialties s ON s.id = ds.specialty_id AND s.active
                       WHERE da.area_id = a.id) AS has_specialties
          FROM areas a WHERE a.id IN ${idList(ids)}
      `);
      for (const r of res.rows) {
        out.set(Number(r.id), areaFaqSeeds({
          name: "x", district: "x", doctorCount: r.doctor_count, specialties: some(r.has_specialties),
        }).length);
      }
      return out;
    }

    if (scope === "specialty") {
      // Same correction as `area` above: getAreasForSpecialty resolves a doctor
      // to a thana through a chamber OR their hospital, so a chamber-only test
      // here under-counted by one.
      const res = await db.execute<{ id: number; doctor_count: number; has_areas: boolean }>(sql`
        WITH doctor_area AS (
          SELECT DISTINCT c.doctor_id, c.area_id FROM chambers c WHERE c.visible AND c.area_id IS NOT NULL
          UNION
          SELECT DISTINCT d.id, h.area_id FROM doctors d JOIN hospitals h ON h.id = d.hospital_id
           WHERE h.area_id IS NOT NULL
             AND NOT EXISTS (SELECT 1 FROM chambers cx WHERE cx.doctor_id = d.id AND cx.visible AND cx.area_id IS NOT NULL)
        )
        SELECT s.id,
               (SELECT COUNT(DISTINCT d.id)::int FROM doctor_specialties ds
                  JOIN doctors d ON d.id = ds.doctor_id AND d.active WHERE ds.specialty_id = s.id) AS doctor_count,
               EXISTS (SELECT 1 FROM doctor_specialties ds
                        JOIN doctors d ON d.id = ds.doctor_id AND d.active
                        JOIN doctor_area da ON da.doctor_id = d.id
                        JOIN areas a ON a.id = da.area_id AND a.active
                        JOIN districts dist ON dist.id = a.district_id AND dist.active
                       WHERE ds.specialty_id = s.id) AS has_areas
          FROM specialties s WHERE s.id IN ${idList(ids)}
      `);
      for (const r of res.rows) {
        out.set(Number(r.id), specialtyFaqSeeds({
          name: "x", doctorCount: r.doctor_count, areas: some(r.has_areas),
        }).length);
      }
      return out;
    }

    if (scope === "hospital") {
      const res = await db.execute<{
        id: number; doctor_count: number; has_place: boolean; has_departments: boolean;
      }>(sql`
        SELECT h.id,
               (SELECT COUNT(*)::int FROM doctors d WHERE d.hospital_id = h.id AND d.active) AS doctor_count,
               (a.id IS NOT NULL) AS has_place,
               (jsonb_array_length(COALESCE(h.departments, '[]'::jsonb)) > 0) AS has_departments
          FROM hospitals h LEFT JOIN areas a ON a.id = h.area_id
         WHERE h.id IN ${idList(ids)}
      `);
      for (const r of res.rows) {
        out.set(Number(r.id), hospitalFaqSeeds({
          name: "x", area: r.has_place ? "x" : "", district: "",
          doctorCount: r.doctor_count, departments: some(r.has_departments),
        }).length);
      }
      return out;
    }
  } catch (err) {
    console.error("FAQ seed counts failed:", err);
  }

  return out;
}

// Rebuilds the SAME generated FAQs the public page will render, so the
// dashboard shows exactly what a visitor sees rather than a separate guess.
//
// Every branch goes through the same seed builders as the public pages. The
// only difference is the starting point: the dashboard has the entity's id
// while the public routes have its slug, so each branch resolves the slug first
// and then reuses the readers that already exist.
//
// Bangla is used throughout because the dashboard is Bangla-only; the seeds
// carry both languages and the public page picks per locale.
export async function seedsForEntity(scope: FaqScope, refId: number | null): Promise<FaqSeed[]> {
  if (scope === "home" || refId === null) return [];

  try {
    if (scope === "district") {
      const [row] = (
        await db.execute<{ slug: string; name_bn: string }>(
          sql`SELECT slug, name->>'bn' AS name_bn FROM districts WHERE id = ${refId} LIMIT 1`
        )
      ).rows;
      if (!row) return [];
      const [hub, count] = await Promise.all([
        getDistrictHubLinks(row.slug, "bn"),
        countDoctorsFor({ district: row.slug }),
      ]);
      return districtFaqSeeds({
        name: row.name_bn,
        doctorCount: count,
        thanas: hub.thanas.map((x) => x.name),
        specialties: hub.specialties.map((x) => x.name),
        hospitals: hub.hospitals.map((x) => x.name),
      });
    }

    if (scope === "area") {
      const [row] = (
        await db.execute<{ slug: string; name_bn: string; district_bn: string | null }>(sql`
          SELECT a.slug, a.name->>'bn' AS name_bn, d.name->>'bn' AS district_bn
            FROM areas a LEFT JOIN districts d ON d.id = a.district_id
           WHERE a.id = ${refId} LIMIT 1
        `)
      ).rows;
      if (!row) return [];
      const [specialties, count] = await Promise.all([
        getSpecialtiesInArea(row.slug, "bn"),
        countDoctorsFor({ area: row.slug }),
      ]);
      return areaFaqSeeds({
        name: row.name_bn,
        district: row.district_bn || "",
        doctorCount: count,
        specialties: specialties.map((s) => s.name),
      });
    }

    if (scope === "specialty") {
      const [row] = (
        await db.execute<{ slug: string; name_bn: string }>(
          sql`SELECT slug, name->>'bn' AS name_bn FROM specialties WHERE id = ${refId} LIMIT 1`
        )
      ).rows;
      if (!row) return [];
      const [areas, count] = await Promise.all([
        getAreasForSpecialty(row.slug, "bn"),
        countDoctorsFor({ specialty: row.slug }),
      ]);
      return specialtyFaqSeeds({
        name: row.name_bn,
        doctorCount: count,
        areas: areas.map((a) => a.name),
      });
    }

    if (scope === "hospital") {
      const [row] = (
        await db.execute<{
          name_bn: string; area_bn: string | null; district_bn: string | null;
          departments: unknown; doctor_count: number;
        }>(sql`
          SELECT h.name->>'bn' AS name_bn,
                 a.name->>'bn' AS area_bn,
                 d.name->>'bn' AS district_bn,
                 h.departments,
                 (SELECT COUNT(*)::int FROM doctors doc WHERE doc.hospital_id = h.id AND doc.active) AS doctor_count
            FROM hospitals h
            LEFT JOIN areas a ON a.id = h.area_id
            LEFT JOIN districts d ON d.id = a.district_id
           WHERE h.id = ${refId} LIMIT 1
        `)
      ).rows;
      if (!row) return [];
      const departments = Array.isArray(row.departments)
        ? (row.departments as { bn?: string; en?: string }[])
            .map((x) => (x?.bn || x?.en || "").trim())
            .filter(Boolean)
        : [];
      return hospitalFaqSeeds({
        name: row.name_bn,
        area: row.area_bn || "",
        district: row.district_bn || "",
        doctorCount: row.doctor_count,
        departments,
      });
    }

    if (scope === "doctor") {
      const [row] = (
        await db.execute<{
          name_bn: string; specialty_bn: string | null; district_bn: string | null;
          chamber_names: string[] | null; has_schedule: boolean; fee: number | null;
        }>(sql`
          SELECT d.name->>'bn' AS name_bn,
                 (SELECT s.name->>'bn' FROM doctor_specialties ds
                    JOIN specialties s ON s.id = ds.specialty_id
                   WHERE ds.doctor_id = d.id
                   ORDER BY ds.is_primary DESC, s.sort LIMIT 1) AS specialty_bn,
                 (SELECT dist.name->>'bn' FROM chambers c
                    LEFT JOIN areas ca ON ca.id = c.area_id
                    JOIN districts dist ON dist.id = COALESCE(ca.district_id, c.district_id)
                   WHERE c.doctor_id = d.id AND c.visible
                   ORDER BY c.sort LIMIT 1) AS district_bn,
                 ARRAY(SELECT c.name FROM chambers c
                        WHERE c.doctor_id = d.id AND c.visible
                        ORDER BY c.sort) AS chamber_names,
                 EXISTS (SELECT 1 FROM chambers c
                          WHERE c.doctor_id = d.id AND c.visible
                            AND jsonb_array_length(COALESCE(c.schedule, '[]'::jsonb)) > 0) AS has_schedule,
                 (SELECT c.fee FROM chambers c
                   WHERE c.doctor_id = d.id AND c.visible
                   ORDER BY c.sort LIMIT 1) AS fee
            FROM doctors d WHERE d.id = ${refId} LIMIT 1
        `)
      ).rows;
      if (!row) return [];
      return doctorFaqSeeds({
        name: row.name_bn,
        specialty: row.specialty_bn || "",
        district: row.district_bn || "",
        chamberNames: (row.chamber_names || []).filter(Boolean),
        hasSchedule: Boolean(row.has_schedule),
        fee: row.fee,
      });
    }
  } catch (err) {
    // A missing migration or an entity that has since been deleted must not
    // take the dashboard down; the admin simply sees no generated FAQs.
    console.error("FAQ seed context failed:", err);
  }

  return [];
}
