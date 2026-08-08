import { sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { searchClause } from "@/lib/admin-search";
import { getUnreadEntityIds, newFirstOrder } from "@/lib/notify";
import { DoctorFormsList, type FormRow } from "./list-client";

export const dynamic = "force-dynamic";

type SP = { q?: string; page?: string; perPage?: string };

// The list is one table over two sources, because the admin thinks in terms of
// "the doctor I'm waiting on", not in terms of which table a row lives in:
//
//   submitted  a filled-in form (doctor_submissions) — the actual lead.
//   pending    a link the admin generated and kept, to share by hand. It shows
//              up right away, flagged as not yet filled in, so a link shared
//              over WhatsApp is never invisible and can be re-copied later.
//
// A link that was EMAILED is deliberately absent until the form comes back: the
// sent mail is its record, and listing it would fill the table with rows that
// carry no information the inbox doesn't already have. The header counts those
// so nothing is both hidden and uncounted.
const ROWS_CTE = sql`
  WITH rows AS (
    SELECT
      'submitted'::text AS kind,
      s.id              AS row_id,
      s.created_at      AS created_at,
      s.client_name, s.client_phone, s.client_email,
      s.doctor_name_bn, s.doctor_name_en, s.hospital_bn, s.specialty_bn,
      s.district_bn, s.area_bn, s.serial_phone, s.fee, s.owner_email,
      s.photo_url, s.share_image_url, s.data,
      l.sent_at, l.created_by, l.client_email AS sent_to, l.token
    FROM doctor_submissions s
    LEFT JOIN doctor_form_links l ON l.id = s.link_id
    UNION ALL
    SELECT
      'pending'::text, l.id, l.created_at,
      l.client_name, l.client_phone, l.client_email,
      NULL::text, NULL::text, NULL::text, NULL::text,
      NULL::text, NULL::text, NULL::text, 0, NULL::text,
      NULL::text, NULL::text, '{}'::jsonb,
      l.sent_at, l.created_by, l.client_email, l.token
    FROM doctor_form_links l
    WHERE l.submitted_at IS NULL AND l.sent_at IS NULL
  )
`;

export default async function AdminDoctorFormsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const q = sp.q?.trim() || "";
  const page = Math.max(1, Number(sp.page) || 1);
  const perPage = Number(sp.perPage) || 30;

  const conds: SQL[] = [sql`TRUE`];
  // Searchable by the person we dealt with AND by the doctor they submitted —
  // whichever the admin remembers first. A pending row has no doctor columns
  // yet, so it matches on the client's own details.
  if (q) {
    conds.push(
      searchClause(q, [
        sql`client_name`,
        sql`client_phone`,
        sql`client_email`,
        sql`doctor_name_bn`,
        sql`doctor_name_en`,
        sql`serial_phone`,
        sql`hospital_bn`,
        sql`district_bn`,
        sql`area_bn`,
      ])
    );
  }
  const where = sql.join(conds, sql` AND `);

  // Only submitted rows can be "new" — a link the admin made themselves is
  // never news to them. The CASE keeps a pending link whose id happens to match
  // an unread submission id from floating to the top by accident.
  const unreadIds = await getUnreadEntityIds("doctor-forms");
  const newFirst = newFirstOrder("CASE WHEN kind = 'submitted' THEN row_id END", unreadIds);

  const [rowsRes, totalRes, emailedRes] = await Promise.all([
    db.execute<FormRow>(sql`
      ${ROWS_CTE}
      SELECT kind, row_id, created_at::text AS created_at,
             client_name, client_phone, client_email,
             doctor_name_bn, doctor_name_en, hospital_bn, specialty_bn,
             district_bn, area_bn, serial_phone, fee, owner_email,
             photo_url, share_image_url, data,
             sent_at::text AS sent_at, created_by, sent_to, token
        FROM rows
       WHERE ${where}
       ORDER BY ${newFirst} created_at DESC
       LIMIT ${perPage} OFFSET ${(page - 1) * perPage}
    `),
    db.execute<{ c: number }>(sql`${ROWS_CTE} SELECT COUNT(*)::int AS c FROM rows WHERE ${where}`),
    // Emailed but still not filled in — the only links the table does not show.
    db.execute<{ c: number }>(sql`
      SELECT COUNT(*)::int AS c FROM doctor_form_links
       WHERE submitted_at IS NULL AND sent_at IS NOT NULL
    `),
  ]);

  return (
    <DoctorFormsList
      rows={rowsRes.rows}
      total={totalRes.rows[0]?.c ?? 0}
      emailedPending={emailedRes.rows[0]?.c ?? 0}
      page={page}
      perPage={perPage}
      q={q}
    />
  );
}
