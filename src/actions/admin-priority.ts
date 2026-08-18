"use server";

import { z } from "zod";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { requireSession } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { revalidatePublic } from "@/lib/revalidate";

// "Doctors Priority" — the curated per-district doctor order that replaced the
// old site-wide `featured` flag.
//
// A doctor belongs to the district of their FIRST VISIBLE CHAMBER, falling back
// to their linked hospital's district. That is the same resolution the public
// site uses for every place name and ranking decision, so the admin list here
// can never disagree with what a visitor sees.
const DOCTOR_DISTRICT = sql`COALESCE(ar.district_id, har.district_id)`;

const DOCTOR_JOINS = sql`
  FROM doctors d
  LEFT JOIN LATERAL (
    SELECT c.area_id FROM chambers c
    WHERE c.doctor_id = d.id AND c.visible
    ORDER BY c.sort LIMIT 1
  ) ch ON TRUE
  LEFT JOIN areas ar ON ar.id = ch.area_id
  LEFT JOIN hospitals hp ON hp.id = d.hospital_id
  LEFT JOIN areas har ON har.id = hp.area_id
`;

export type PriorityDistrictRow = {
  id: number;
  slug: string;
  name_bn: string;
  name_en: string | null;
  priority_enabled: boolean;
  doctor_count: number;
  pinned_count: number;
};

export type PriorityDoctorRow = {
  id: number;
  slug: string;
  name_bn: string;
  /** false = not published yet; shown dimmed and never rendered publicly. */
  active: boolean;
  verified: boolean;
  specialty_bn: string | null;
  place_bn: string | null;
  /** null when this doctor is not in the curated order. */
  position: number | null;
  enabled: boolean | null;
  // Latest payment record for this doctor. The dates on it decide how long the
  // pin stays live; `plan` is a descriptive label only and applies no rule.
  promo_id: number | null;
  promo_plan: "basic" | "featured" | "premium" | null;
  promo_amount: number | null;
  promo_starts_on: string | null;
  promo_ends_on: string | null;
  promo_notes: string | null;
  /** True when today falls inside that window — i.e. the pin is live now. */
  promo_live: boolean;
};

// Every district, with how many doctors resolve to it and how many are pinned.
export async function listPriorityDistricts(): Promise<PriorityDistrictRow[]> {
  await requireSession();
  const res = await db.execute<PriorityDistrictRow>(sql`
    SELECT
      dd.id,
      dd.slug,
      dd.name->>'bn' AS name_bn,
      dd.name->>'en' AS name_en,
      dd.priority_enabled,
      (
        SELECT COUNT(*)::int ${DOCTOR_JOINS} WHERE ${DOCTOR_DISTRICT} = dd.id
      ) AS doctor_count,
      (
        SELECT COUNT(*)::int FROM district_doctor_priority p
        WHERE p.district_id = dd.id AND p.enabled
      ) AS pinned_count
    FROM districts dd
    WHERE dd.active
    ORDER BY dd.sort, dd.name->>'en'
  `);
  return res.rows;
}

// Doctors of one district. Unpublished ones are included on purpose: the admin
// needs to be able to place a doctor in the order before switching them live,
// and hiding them here would make the list silently disagree with the doctors
// dashboard. The UI dims them.
export async function listDistrictDoctors(districtId: number): Promise<PriorityDoctorRow[]> {
  await requireSession();
  const res = await db.execute<PriorityDoctorRow>(sql`
    SELECT
      d.id,
      d.slug,
      d.name->>'bn' AS name_bn,
      d.active,
      d.verified,
      (
        SELECT s.name->>'bn' FROM doctor_specialties ds
        JOIN specialties s ON s.id = ds.specialty_id
        WHERE ds.doctor_id = d.id
        ORDER BY ds.is_primary DESC, s.sort LIMIT 1
      ) AS specialty_bn,
      COALESCE(ar.name->>'bn', har.name->>'bn', hp.name->>'bn') AS place_bn,
      p.position,
      p.enabled,
      pr.id AS promo_id,
      pr.plan AS promo_plan,
      pr.amount AS promo_amount,
      to_char(pr.starts_on, 'YYYY-MM-DD') AS promo_starts_on,
      to_char(pr.ends_on, 'YYYY-MM-DD') AS promo_ends_on,
      pr.notes AS promo_notes,
      COALESCE(
        pr.status = 'active' AND CURRENT_DATE BETWEEN pr.starts_on AND pr.ends_on,
        false
      ) AS promo_live
    ${DOCTOR_JOINS}
    LEFT JOIN district_doctor_priority p
      ON p.doctor_id = d.id AND p.district_id = ${districtId}
    -- Most recent payment only. Older rows stay in the table for the revenue
    -- history the dashboard reports on; the panel edits the current one.
    LEFT JOIN LATERAL (
      SELECT pr2.* FROM promotions pr2
      WHERE pr2.doctor_id = d.id
      ORDER BY pr2.ends_on DESC, pr2.id DESC
      LIMIT 1
    ) pr ON TRUE
    WHERE ${DOCTOR_DISTRICT} = ${districtId}
    ORDER BY (p.position IS NULL), p.position, d.name->>'bn'
  `);
  return res.rows;
}

const promoSchema = z.object({
  // The doctor is implied by the row the admin opened, never chosen in the
  // dialog — so there is no doctor picker to get wrong.
  doctorId: z.coerce.number().int().positive(),
  id: z.coerce.number().int().positive().nullable().optional(),
  plan: z.enum(["basic", "featured", "premium"]),
  amount: z.coerce.number().min(0),
  starts_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "শুরুর তারিখ দিন"),
  ends_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "মেয়াদ শেষের তারিখ দিন"),
  notes: z.string().max(500).optional().default(""),
});

// Save the payment attached to a pinned doctor.
//
// `status` is not part of this form: it is derived. A record whose window has
// already passed is stored as expired immediately, so the dashboard totals and
// the public ranking agree the moment the admin presses save rather than
// waiting for the next lazy sweep.
export async function savePriorityPromotion(input: z.infer<typeof promoSchema>) {
  await requireSession();
  const parsed = promoSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message || "তথ্য যাচাই ব্যর্থ" };
  }
  const p = parsed.data;
  if (p.ends_on < p.starts_on) {
    return { ok: false, message: "মেয়াদ শেষের তারিখ শুরুর তারিখের আগে হতে পারে না।" };
  }

  const status = sql`CASE WHEN ${p.ends_on}::date < CURRENT_DATE THEN 'expired'::promotion_status
                          ELSE 'active'::promotion_status END`;

  if (p.id) {
    await db.execute(sql`
      UPDATE promotions SET
        plan = ${p.plan}::promotion_plan, amount = ${p.amount},
        starts_on = ${p.starts_on}::date, ends_on = ${p.ends_on}::date,
        status = ${status}, notes = ${p.notes || null}, updated_at = now()
      WHERE id = ${p.id} AND doctor_id = ${p.doctorId}
    `);
  } else {
    await db.execute(sql`
      INSERT INTO promotions (doctor_id, plan, amount, starts_on, ends_on, status, notes)
      VALUES (${p.doctorId}, ${p.plan}::promotion_plan, ${p.amount},
              ${p.starts_on}::date, ${p.ends_on}::date, ${status}, ${p.notes || null})
    `);
  }

  await audit("priority_promotion.save", "promotions", p.id ?? null, {
    doctor_id: p.doctorId, plan: p.plan, amount: p.amount,
  });
  // Curated ORDER only. No URL is created, removed or renamed here, so the
  // sitemap keeps serving from cache and rolls over on its own 24 h window.
  revalidatePublic(["doctors", "districts"], { sitemap: false });
  return { ok: true, message: "পেমেন্ট সংরক্ষণ হয়েছে।" };
}

const saveSchema = z.object({
  districtId: z.coerce.number().int().positive(),
  // Full replacement of the district's curated block, in display order.
  entries: z
    .array(z.object({ doctorId: z.coerce.number().int().positive(), enabled: z.boolean() }))
    .max(500),
});

// Replaces the whole curated block for one district in a single transaction.
//
// Full replacement rather than per-row patching: the admin drags an order and
// presses save, so the payload IS the desired end state. Diffing would leave
// room for a stale row to survive a reorder and quietly outrank everything.
export async function saveDistrictPriority(input: z.infer<typeof saveSchema>) {
  await requireSession();
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "তথ্য সঠিক নয়।" };
  const { districtId, entries } = parsed.data;

  // A doctor can only be pinned in the district they actually belong to —
  // otherwise a stale tab could pin a Khulna doctor into Bhola and their card
  // would appear under a heading naming a district they have no chamber in.
  const valid = await db.execute<{ id: number }>(sql`
    SELECT d.id ${DOCTOR_JOINS} WHERE ${DOCTOR_DISTRICT} = ${districtId}
  `);
  const allowed = new Set(valid.rows.map((r) => Number(r.id)));
  const clean = entries.filter((e) => allowed.has(e.doctorId));

  await db.transaction(async (tx) => {
    await tx.execute(sql`DELETE FROM district_doctor_priority WHERE district_id = ${districtId}`);
    if (clean.length > 0) {
      const values = sql.join(
        clean.map(
          (e, i) => sql`(${districtId}, ${e.doctorId}, ${i}, ${e.enabled}, now(), now())`
        ),
        sql`, `
      );
      await tx.execute(sql`
        INSERT INTO district_doctor_priority
          (district_id, doctor_id, position, enabled, created_at, updated_at)
        VALUES ${values}
      `);

      // Every pinned doctor gets a validity. A doctor added straight from the
      // list has never been through the payment dialog, so give them the
      // default one-month window here — otherwise they would sit at the top of
      // the district forever with no expiry and nothing on screen saying so.
      // Guarded by NOT EXISTS, so re-saving an order never stacks up records
      // and never overwrites a real payment.
      const ids = sql.join(clean.map((e) => sql`${e.doctorId}`), sql`, `);
      await tx.execute(sql`
        INSERT INTO promotions (doctor_id, plan, amount, starts_on, ends_on, status)
        SELECT d.id, 'basic'::promotion_plan, 0,
               CURRENT_DATE, CURRENT_DATE + INTERVAL '1 month', 'active'::promotion_status
        FROM doctors d
        WHERE d.id IN (${ids})
          AND NOT EXISTS (SELECT 1 FROM promotions pr WHERE pr.doctor_id = d.id)
      `);
    }
  });

  await audit("district_priority.save", "districts", districtId, {
    count: clean.length,
  });
  // Curated ORDER only. No URL is created, removed or renamed here, so the
  // sitemap keeps serving from cache and rolls over on its own 24 h window.
  revalidatePublic(["doctors", "districts"], { sitemap: false });
  return { ok: true, message: "ক্রম সংরক্ষণ হয়েছে।" };
}

const toggleSchema = z.object({
  districtId: z.coerce.number().int().positive(),
  enabled: z.boolean(),
});

// The district master switch. Off leaves every pinned row intact but stops the
// public ranking consulting them, so a curated order can be paused and resumed
// without being rebuilt.
export async function toggleDistrictPriority(input: z.infer<typeof toggleSchema>) {
  await requireSession();
  const parsed = toggleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "তথ্য সঠিক নয়।" };
  const { districtId, enabled } = parsed.data;

  await db.execute(sql`
    UPDATE districts SET priority_enabled = ${enabled}, updated_at = now()
    WHERE id = ${districtId}
  `);

  await audit("district_priority.toggle", "districts", districtId, { enabled });
  // Curated ORDER only. No URL is created, removed or renamed here, so the
  // sitemap keeps serving from cache and rolls over on its own 24 h window.
  revalidatePublic(["doctors", "districts"], { sitemap: false });
  return { ok: true, message: enabled ? "এই জেলার ক্রম চালু হয়েছে।" : "এই জেলার ক্রম বন্ধ হয়েছে।" };
}
