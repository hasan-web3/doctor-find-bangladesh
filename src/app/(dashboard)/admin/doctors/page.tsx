import { sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { searchClause } from "@/lib/admin-search";
import { DoctorsList } from "./list-client";

export const dynamic = "force-dynamic";

type SP = { q?: string; page?: string; filter?: string; perPage?: string };

export default async function AdminDoctorsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const q = sp.q?.trim() || "";
  const page = Math.max(1, Number(sp.page) || 1);
  const perPage = Number(sp.perPage) || 30;

  const conds: SQL[] = [sql`TRUE`];
  if (q) conds.push(searchClause(q, [sql`d.name->>'bn'`, sql`d.name->>'en'`, sql`d.slug`]));
  if (sp.filter === "inactive") conds.push(sql`NOT d.active`);
  const where = sql.join(conds, sql` AND `);

  const [rowsRes, totalRes, spRes, arRes, hoRes, diRes] = await Promise.all([
    db.execute<{
      id: number; slug: string; name_bn: string; verified: boolean; active: boolean;
      bmdc_verified: boolean; bmdc_valid_till: string | null;
      specialty_bn: string | null; area_bn: string | null; promo_ends: string | null;
    }>(sql`
      SELECT d.id, d.slug, d.name->>'bn' AS name_bn, d.verified, d.active,
        d.bmdc_verified,
        -- to_char, not the raw date: the driver would hand back a JS Date built
        -- in the server's timezone, and the list colours cells by how close the
        -- date is to today, so a one-day shift is a wrong warning.
        to_char(d.bmdc_valid_till, 'YYYY-MM-DD') AS bmdc_valid_till,
        -- Same fallback the public card uses: a doctor whose only specialty is
        -- free text has no doctor_specialties row, so show their first custom
        -- entry instead of an empty cell.
        COALESCE(
          (SELECT s.name->>'bn' FROM doctor_specialties ds JOIN specialties s ON s.id=ds.specialty_id
           WHERE ds.doctor_id=d.id ORDER BY ds.is_primary DESC LIMIT 1),
          d.custom_specialties->0->>'bn',
          d.custom_specialties->0->>'en'
        ) AS specialty_bn,
        -- First chamber that resolves to SOME locality: its free-text thana if
        -- the admin typed one, otherwise the linked thana. Chambers with
        -- neither are skipped so the column still falls through to the next
        -- chamber, exactly as the plain JOIN used to.
        (SELECT COALESCE(NULLIF(c.custom_area->>'bn', ''), NULLIF(c.custom_area->>'en', ''), a.name->>'bn')
           FROM chambers c LEFT JOIN areas a ON a.id=c.area_id
          WHERE c.doctor_id=d.id
            AND COALESCE(NULLIF(c.custom_area->>'bn', ''), NULLIF(c.custom_area->>'en', ''), a.name->>'bn') IS NOT NULL
          ORDER BY c.sort LIMIT 1) AS area_bn,
        (SELECT p.ends_on::text FROM promotions p WHERE p.doctor_id=d.id AND p.status='active'
         ORDER BY p.ends_on DESC LIMIT 1) AS promo_ends
      FROM doctors d WHERE ${where}
      ORDER BY d.updated_at DESC LIMIT ${perPage} OFFSET ${(page - 1) * perPage}
    `),
    db.execute<{ c: number }>(sql`SELECT COUNT(*)::int AS c FROM doctors d WHERE ${where}`),
    db.execute<{ id: number; name_bn: string; name_en: string | null }>(
      sql`SELECT id, name->>'bn' AS name_bn, name->>'en' AS name_en FROM specialties WHERE active ORDER BY sort`
    ),
    db.execute<{
      id: number; name_bn: string; name_en: string | null;
      district_id: number | null; district_bn: string | null; district_en: string | null;
    }>(sql`
      SELECT a.id, a.name->>'bn' AS name_bn, a.name->>'en' AS name_en,
        a.district_id, d.name->>'bn' AS district_bn, d.name->>'en' AS district_en
      FROM areas a LEFT JOIN districts d ON d.id = a.district_id
      WHERE a.active ORDER BY a.sort
    `),
    db.execute<{ id: number; name_bn: string; name_en: string | null }>(
      sql`SELECT id, name->>'bn' AS name_bn, name->>'en' AS name_en FROM hospitals WHERE active ORDER BY sort`
    ),
    db.execute<{ id: number; name_bn: string; name_en: string | null }>(
      sql`SELECT id, name->>'bn' AS name_bn, name->>'en' AS name_en FROM districts WHERE active ORDER BY sort`
    ),
  ]);
  const rows = rowsRes.rows;
  const totalRow = totalRes.rows[0];
  const total = totalRow?.c ?? 0;

  return (
    <DoctorsList
      rows={rows}
      total={total}
      page={page}
      perPage={perPage}
      q={q}
      filter={sp.filter}
      specialties={spRes.rows}
      areas={arRes.rows}
      hospitals={hoRes.rows}
      districts={diRes.rows}
    />
  );
}
