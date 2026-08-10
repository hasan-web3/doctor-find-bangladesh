import { sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { searchClause } from "@/lib/admin-search";
import { DebouncedSearch } from "@/components/admin/debounced-search";
import { FaqsManager, type FaqRow } from "./manager";
import { ScopeGrid, EntityGrid, FaqCrumbs, FaqPagination, type EntityRow } from "./pickers";
import { FAQ_SCOPES, isFaqScope, scopeMeta, SCOPE_HINT, type FaqScope } from "./scopes";
import { seedsForEntity, faqEntityCounts, seedCountsForEntities } from "./seed-context";
import { FaqToggle } from "./faq-toggle";
import { getDisabledFaqKeys, FAQ_SCOPE_ALL } from "@/lib/data";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// FAQ admin, as a three-level drill-down.
//
//   /admin/faqs                       -> which scope?      (1 aggregate query)
//   /admin/faqs?scope=district        -> which district?   (1 query)
//   /admin/faqs?scope=district&ref=5  -> that district's FAQs (2 small queries)
//
// This page used to render every FAQ on the site in one list, and to do that it
// loaded, on every visit: all faqs, all specialties, all areas, all hospitals
// and the first 500 doctors. Five full-table reads to show a list nobody could
// scan once it passed a few dozen rows.
//
// Now each level fetches ONLY what that level draws, the entity lists are
// either bounded by the number of FAQs that exist or by a LIMIT on a search,
// and the doctor/area tables are never listed in full at all.
//
// State lives in the URL rather than in React, so the browser Back button
// walks back up the levels and a filtered view can be bookmarked or shared.
// ---------------------------------------------------------------------------

type SP = { scope?: string; ref?: string; q?: string; page?: string };

/**
 * Per-scope SQL. Table names cannot be parameterised, so each scope names its
 * own table and the columns worth searching and showing. `context` is the
 * second line on an entity chip: the district a thana belongs to, the
 * specialty a doctor practises. Returns null for `home`, which has no entity.
 */
function entitySource(scope: FaqScope): {
  table: SQL;
  /** Columns the admin search runs against. */
  searchCols: SQL[];
  /** Extra descriptive line, already aliased as `context`. */
  contextSelect: SQL;
  /** Anything the context needs joined in. */
  joins: SQL;
  order: SQL;
} | null {
  switch (scope) {
    case "specialty":
      return {
        table: sql`specialties e`,
        searchCols: [sql`e.name->>'bn'`, sql`e.name->>'en'`],
        contextSelect: sql`NULL::text AS context`,
        joins: sql``,
        order: sql`e.sort, e.id`,
      };
    case "district":
      return {
        table: sql`districts e`,
        searchCols: [sql`e.name->>'bn'`, sql`e.name->>'en'`],
        contextSelect: sql`NULL::text AS context`,
        joins: sql``,
        order: sql`e.sort, e.id`,
      };
    case "area":
      // Two thanas in different districts can share a name, so the district is
      // not decoration here — without it the picker is ambiguous.
      return {
        table: sql`areas e`,
        searchCols: [sql`e.name->>'bn'`, sql`e.name->>'en'`, sql`dist.name->>'bn'`],
        contextSelect: sql`dist.name->>'bn' AS context`,
        joins: sql`LEFT JOIN districts dist ON dist.id = e.district_id`,
        order: sql`e.sort, e.id`,
      };
    case "hospital":
      return {
        table: sql`hospitals e`,
        searchCols: [sql`e.name->>'bn'`, sql`e.name->>'en'`],
        contextSelect: sql`ha.name->>'bn' AS context`,
        joins: sql`LEFT JOIN areas ha ON ha.id = e.area_id`,
        order: sql`e.sort, e.id`,
      };
    case "doctor":
      return {
        table: sql`doctors e`,
        searchCols: [sql`e.name->>'bn'`, sql`e.name->>'en'`, sql`e.degrees->>'bn'`],
        contextSelect: sql`(
          SELECT s.name->>'bn' FROM doctor_specialties ds
          JOIN specialties s ON s.id = ds.specialty_id
          WHERE ds.doctor_id = e.id
          ORDER BY ds.is_primary DESC, s.sort LIMIT 1
        ) AS context`,
        joins: sql``,
        order: sql`e.name->>'bn'`,
      };
    default:
      return null;
  }
}

/**
 * "This entity has an FAQ block", expressed in SQL.
 *
 * Mirrors the gate inside each generator in faq-defaults.ts, which in turn
 * mirrors the sitemap's coverage chain: no doctors means no indexable page and
 * no generated FAQ. Hospitals are the documented exception and always qualify.
 */
function coveragePredicate(scope: FaqScope): SQL {
  switch (scope) {
    case "specialty":
      return sql`e.active AND EXISTS (
        SELECT 1 FROM doctor_specialties ds JOIN doctors d ON d.id = ds.doctor_id AND d.active
         WHERE ds.specialty_id = e.id)`;
    case "district":
      return sql`e.active AND EXISTS (
        SELECT 1 FROM doctors d WHERE d.active AND (
          EXISTS (SELECT 1 FROM chambers c LEFT JOIN areas ca ON ca.id = c.area_id
                   WHERE c.doctor_id = d.id AND c.visible
                     AND COALESCE(ca.district_id, c.district_id) = e.id)
          OR (NOT EXISTS (SELECT 1 FROM chambers cx WHERE cx.doctor_id = d.id AND cx.visible)
              AND EXISTS (SELECT 1 FROM hospitals h JOIN areas ha ON ha.id = h.area_id
                           WHERE h.id = d.hospital_id AND ha.district_id = e.id))))`;
    case "area":
      return sql`e.active AND EXISTS (
        SELECT 1 FROM doctors d WHERE d.active AND (
          EXISTS (SELECT 1 FROM chambers c WHERE c.doctor_id = d.id AND c.visible AND c.area_id = e.id)
          OR (NOT EXISTS (SELECT 1 FROM chambers cx WHERE cx.doctor_id = d.id AND cx.visible AND cx.area_id IS NOT NULL)
              AND EXISTS (SELECT 1 FROM hospitals h WHERE h.id = d.hospital_id AND h.area_id = e.id))))`;
    default:
      // Hospitals and doctors: the page itself is the content.
      return sql`e.active`;
  }
}

export default async function AdminFaqsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const scope: FaqScope | null = isFaqScope(sp.scope) ? sp.scope : null;
  const q = sp.q?.trim() || "";
  const refId = sp.ref && /^\d+$/.test(sp.ref) ? Number(sp.ref) : null;

  // The off-switch denylist. One cached read, shared by every level below.
  const disabled = await getDisabledFaqKeys();
  const scopeOff = scope ? disabled.has(`${scope}:${FAQ_SCOPE_ALL}`) : false;

  // ---- LEVEL 1: which scope? ----------------------------------------------
  if (!scope) {
    const [res, entityCounts] = await Promise.all([
      db.execute<{ scope: string; total: number; active: number }>(sql`
        SELECT scope,
               COUNT(*)::int AS total,
               COUNT(*) FILTER (WHERE active)::int AS active
          FROM faqs
         GROUP BY scope
      `),
      // How many PAGES have an FAQ block, generated ones included. Without this
      // every generated scope reported 0 even though its pages do show FAQs.
      faqEntityCounts(),
    ]);
    const stored: Record<string, { total: number; active: number }> = {};
    for (const r of res.rows) stored[r.scope] = { total: r.total, active: r.active };

    const counts: Record<string, { pages: number; stored: number }> = {};
    for (const s of FAQ_SCOPES) {
      counts[s.value] = {
        // The homepage is one page and its FAQs are all hand-written.
        pages: s.hasEntity ? entityCounts[s.value] ?? 0 : (stored.home?.active ?? 0) > 0 ? 1 : 0,
        stored: stored[s.value]?.total ?? 0,
      };
    }

    return (
      <div>
        <h1 className="mb-2 mt-0 font-heading text-2xl font-bold text-ink">FAQ</h1>
        <p className="mb-6 mt-0 max-w-[760px] text-sm text-ink-faint">
          FAQ হোমপেজ, নির্দিষ্ট বিভাগ, জেলা, এলাকা, হাসপাতাল বা ডাক্তারের পেজে যুক্ত করা যায়। প্রতিটি FAQ ওই পেজে
          JSON-LD (FAQPage) হিসেবেও যুক্ত হয়, যা Google-এ rich result পেতে সাহায্য করে। শুরু করতে নিচ থেকে একটি বেছে নিন।
        </p>
        <ScopeGrid
          counts={counts}
          disabledScopes={new Set(FAQ_SCOPES.filter((s) => disabled.has(`${s.value}:${FAQ_SCOPE_ALL}`)).map((s) => s.value))}
        />
      </div>
    );
  }

  const meta = scopeMeta(scope);

  // ---- home: no entity layer, straight to its FAQs -------------------------
  if (!meta.hasEntity) {
    const rows = await db.execute<FaqRow>(sql`
      SELECT id, scope, ref_id, question, answer, sort, active, auto_key
        FROM faqs WHERE scope = 'home' ORDER BY sort, id
    `);
    return (
      <div>
        <FaqCrumbs scope={scope} scopeLabel={meta.label} />
        <h1 className="mb-5 mt-0 font-heading text-2xl font-bold text-ink">হোমপেজের FAQ</h1>
        <FaqToggle
          scope="home"
          initialEnabled={!scopeOff}
          label="হোমপেজে FAQ দেখান"
          hint="বন্ধ করলে হোমপেজের FAQ অংশটি লুকিয়ে যাবে, কিছু মুছবে না।"
        />
        {/* The homepage has no entity to generate from, so it stays entirely
            hand-written — the only scope where that is still true. */}
        <FaqsManager rows={rows.rows} seeds={[]} scope="home" refId={null} refLabel="হোমপেজ" />
      </div>
    );
  }

  const src = entitySource(scope)!;

  // ---- LEVEL 3: one entity's FAQs -----------------------------------------
  if (refId !== null) {
    const [nameRes, faqRes, seeds] = await Promise.all([
      db.execute<{ name_bn: string | null }>(sql`
        SELECT e.name->>'bn' AS name_bn FROM ${src.table} WHERE e.id = ${refId} LIMIT 1
      `),
      // Inactive rows are included on purpose: one carrying an auto_key is a
      // tombstone for a deleted generated FAQ, and the dashboard has to show it
      // so the admin can restore it.
      db.execute<FaqRow>(sql`
        SELECT id, scope, ref_id, question, answer, sort, active, auto_key
          FROM faqs WHERE scope = ${scope} AND ref_id = ${refId} ORDER BY sort, id
      `),
      seedsForEntity(scope, refId),
    ]);
    const entityName = nameRes.rows[0]?.name_bn ?? `#${refId}`;

    return (
      <div>
        <FaqCrumbs scope={scope} scopeLabel={meta.label} entityName={entityName} />
        <h1 className="mb-1 mt-0 font-heading text-2xl font-bold text-ink">{entityName}</h1>
        <p className="mb-5 mt-0 text-sm text-ink-faint">
          {meta.label} স্কোপ · এই FAQ গুলো শুধু এই পেজে দেখাবে
        </p>
        <FaqToggle
          scope={scope}
          refId={refId}
          initialEnabled={!disabled.has(`${scope}:${refId}`)}
          scopeOff={scopeOff}
          label={`${entityName} এর পেজে FAQ দেখান`}
          hint="শুধু এই একটি পেজের জন্য। বন্ধ করলে কিছু মুছবে না, আবার চালু করলে সব ফিরে আসবে।"
        />
        <FaqsManager
          rows={faqRes.rows}
          seeds={seeds}
          scope={scope}
          refId={refId}
          refLabel={entityName}
        />
      </div>
    );
  }

  // ---- LEVEL 2: which entity? ---------------------------------------------
  // Paginated, so a scope with thousands of doctors reads one bounded page
  // rather than the whole table. Search narrows within the same coverage rule.
  const PER_PAGE = 24;
  const page = sp.page && /^\d+$/.test(sp.page) ? Math.max(1, Number(sp.page)) : 1;
  const offset = (page - 1) * PER_PAGE;

  // Coverage always applies; search is an extra filter on top of it, so a
  // search can never surface a page that has no FAQ block to edit.
  const where = q
    ? sql`${coveragePredicate(scope)} AND ${searchClause(q, src.searchCols)}`
    : coveragePredicate(scope);

  const [listRes, countRes] = await Promise.all([
    db.execute<EntityRow>(sql`
      SELECT e.id,
             e.name->>'bn' AS name_bn,
             ${src.contextSelect},
             0 AS faq_count
        FROM ${src.table}
        ${src.joins}
       WHERE ${where}
       ORDER BY ${src.order}
       LIMIT ${PER_PAGE} OFFSET ${offset}
    `),
    db.execute<{ total: number }>(sql`
      SELECT COUNT(*)::int AS total FROM ${src.table} ${src.joins} WHERE ${where}
    `),
  ]);

  const entities: EntityRow[] = listRes.rows;
  const total = countRes.rows[0]?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  // The number each card shows: generated FAQs for this page's entities, minus
  // any the admin deleted, plus their own hand-written ones. Two extra queries
  // for the whole page, regardless of how many entities are on it.
  const ids = entities.map((e) => Number(e.id));
  const [seedCounts, storedRows] = await Promise.all([
    seedCountsForEntities(scope, ids),
    ids.length > 0
      ? db.execute<{ ref_id: number; auto_key: string | null; active: boolean }>(sql`
          SELECT ref_id, auto_key, active FROM faqs
           WHERE scope = ${scope}
             AND ref_id IN (${sql.join(ids.map((i) => sql`${i}`), sql`, `)})
        `)
      : Promise.resolve({ rows: [] as { ref_id: number; auto_key: string | null; active: boolean }[] }),
  ]);

  const storedByRef = new Map<number, { suppressed: number; manual: number }>();
  for (const r of storedRows.rows) {
    const k = Number(r.ref_id);
    const acc = storedByRef.get(k) ?? { suppressed: 0, manual: 0 };
    if (r.auto_key) {
      // A tombstone removes one generated FAQ. An active override replaces one,
      // so it changes the text but not the count.
      if (!r.active) acc.suppressed += 1;
    } else if (r.active) {
      acc.manual += 1;
    }
    storedByRef.set(k, acc);
  }

  for (const e of entities) {
    const k = Number(e.id);
    const s = storedByRef.get(k) ?? { suppressed: 0, manual: 0 };
    e.faq_count = Math.max(0, (seedCounts.get(k) ?? 0) - s.suppressed) + s.manual;
  }

  return (
    <div>
      <FaqCrumbs scope={scope} scopeLabel={meta.label} />
      <h1 className="mb-1 mt-0 font-heading text-2xl font-bold text-ink">{meta.plural} অনুযায়ী FAQ</h1>
      <p className="mb-5 mt-0 text-sm text-ink-faint">{SCOPE_HINT[scope]}</p>

      {/* Scope-wide switch. Overrides every entity switch inside this scope. */}
      <FaqToggle
        scope={scope}
        initialEnabled={!scopeOff}
        label={`সব ${meta.plural} পেজে FAQ দেখান`}
        hint={`বন্ধ করলে প্রতিটি ${meta.label} পেজ থেকে FAQ অংশটি একসাথে লুকিয়ে যাবে, কিছু মুছবে না।`}
      />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <DebouncedSearch initial={q} placeholder={`${meta.label} খুঁজুন`} />
        <span className="text-[13px] text-ink-faint">
          মোট {total} টি {meta.label}
          {totalPages > 1 ? ` · পৃষ্ঠা ${page} / ${totalPages}` : ""}
        </span>
      </div>

      <EntityGrid scope={scope} rows={entities} searching={Boolean(q)} />

      <FaqPagination scope={scope} q={q} page={page} totalPages={totalPages} />
    </div>
  );
}
