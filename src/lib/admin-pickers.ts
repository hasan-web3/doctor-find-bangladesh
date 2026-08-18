import "server-only";
import { unstable_cache } from "next/cache";
import { sql } from "drizzle-orm";
import { db } from "@/db";

// ---------------------------------------------------------------------------
// Shared dropdown data for the dashboard.
//
// Five admin pages (/admin/doctors, /admin/doctors/new, /admin/doctors/[id],
// /admin/areas, /admin/hospitals) each need the same lookup lists to populate
// their selects, and each was issuing its own copy of the same four queries on
// every single page load — every pagination click, every search keystroke that
// changed the URL, every navigation back to the list. The dashboard is
// `force-dynamic` (it must be: it shows live rows), so none of that was cached.
//
// These lists change a handful of times a month. Caching them by TAG rather
// than by time means an admin who adds a specialty sees it in the dropdown on
// the very next render, because every mutation that can change one of these
// tables already purges the matching tag:
//
//   specialties  -> revalidateSpecialty() / quickCreateSpecialty()
//   hospitals    -> revalidateHospital()  / quickCreateHospital()
//   districts    -> revalidateDistrict()  / quickCreateDistrict()
//   areas        -> revalidateArea()      / quickCreateArea()
//
// No `revalidate` window is set on purpose. A time window here would clamp the
// ISR window of anything else that reads them (see the note above
// searchDoctorsCached in src/lib/data.ts); tag invalidation is both cheaper and
// exact.
//
// The ORDER BY carries an explicit `id` tie-break. The five copies these
// replace disagreed — three ordered by `sort` alone, two by `sort, id` — and
// `sort` is not unique, so the pages could list two equally-sorted rows in
// different orders on different loads. One deterministic order for all of them.
// ---------------------------------------------------------------------------

export type PickerOption = {
  id: number;
  name_bn: string;
  name_en: string | null;
};

// Areas carry their district so the client can filter the thana list by the
// district the admin picked, without a second round trip.
export type AreaPickerOption = PickerOption & {
  district_id: number | null;
  district_bn: string | null;
  district_en: string | null;
};

export const getSpecialtyOptions = unstable_cache(
  async (): Promise<PickerOption[]> =>
    (
      await db.execute<PickerOption>(sql`
        SELECT id, name->>'bn' AS name_bn, name->>'en' AS name_en
        FROM specialties WHERE active ORDER BY sort, id
      `)
    ).rows,
  ["admin-picker-specialties-v1"],
  { tags: ["specialties"] }
);

export const getHospitalPickerOptions = unstable_cache(
  async (): Promise<PickerOption[]> =>
    (
      await db.execute<PickerOption>(sql`
        SELECT id, name->>'bn' AS name_bn, name->>'en' AS name_en
        FROM hospitals WHERE active ORDER BY sort, id
      `)
    ).rows,
  ["admin-picker-hospitals-v1"],
  { tags: ["hospitals"] }
);

export const getDistrictOptions = unstable_cache(
  async (): Promise<PickerOption[]> =>
    (
      await db.execute<PickerOption>(sql`
        SELECT id, name->>'bn' AS name_bn, name->>'en' AS name_en
        FROM districts WHERE active ORDER BY sort, id
      `)
    ).rows,
  ["admin-picker-districts-v1"],
  { tags: ["districts"] }
);

// Tagged with BOTH tables it reads: renaming a district has to change the
// label shown beside every thana that belongs to it.
export const getAreaOptions = unstable_cache(
  async (): Promise<AreaPickerOption[]> =>
    (
      await db.execute<AreaPickerOption>(sql`
        SELECT a.id, a.name->>'bn' AS name_bn, a.name->>'en' AS name_en,
          a.district_id, d.name->>'bn' AS district_bn, d.name->>'en' AS district_en
        FROM areas a LEFT JOIN districts d ON d.id = a.district_id
        WHERE a.active ORDER BY a.sort, a.id
      `)
    ).rows,
  ["admin-picker-areas-v1"],
  { tags: ["areas", "districts"] }
);

/**
 * The full set, in one call, for the pages that need all four.
 *
 * Each member is independently cached, so this is four cache reads rather than
 * four queries once they are warm.
 */
export async function getDoctorFormPickers(): Promise<{
  specialties: PickerOption[];
  areas: AreaPickerOption[];
  hospitals: PickerOption[];
  districts: PickerOption[];
}> {
  const [specialties, areas, hospitals, districts] = await Promise.all([
    getSpecialtyOptions(),
    getAreaOptions(),
    getHospitalPickerOptions(),
    getDistrictOptions(),
  ]);
  return { specialties, areas, hospitals, districts };
}
