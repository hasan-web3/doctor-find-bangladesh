# DoctorBondhu (ডক্টরবন্ধু)

A bilingual (Bangla + English) paid doctor directory for Khulna, Bangladesh. Patients find verified doctors by specialty or area and book appointments; the site owner manages everything from a full admin dashboard.

**Stack:** Next.js 15 (App Router, RSC, TypeScript strict) · PostgreSQL with JSONB multilingual fields (Supabase or any standard Postgres) · Cloudflare R2 (images, S3-compatible) · Tailwind CSS

---

## 1. Quick start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
#    Fill in: DATABASE_URL, APP_SECRET, ADMIN_EMAIL/PASSWORD, R2 credentials

# 3. One-shot setup: runs migrations, seeds bilingual Khulna data, creates admin
npm run setup
#    (upgrading from an older single-language schema? use: node scripts/setup.mjs --fresh)

# 4. Start
npm run dev
```

Open http://localhost:3000 (Bangla), http://localhost:3000/en (English) and http://localhost:3000/admin-login (admin panel, hidden URL).

### Environment variables (`.env`)

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string. Supabase: Project Settings → Database → Connection string. Works with any standard Postgres. |
| `NEXT_PUBLIC_SITE_URL` | Public base URL (canonical URLs, hreflang, sitemap, OG images). No trailing slash. |
| `APP_SECRET` | Signs admin sessions AND encrypts integration credentials. Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME` | Bootstrap admin account, created once by `npm run setup`. |
| `R2_ACCOUNT_ID` | Cloudflare dashboard sidebar → Account ID. |
| `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | R2 → Manage R2 API Tokens → Create API token (Object Read & Write). |
| `R2_BUCKET` | Your R2 bucket name (create it in Cloudflare → R2). |
| `R2_PUBLIC_URL` | The bucket's public URL: enable the r2.dev subdomain on the bucket, or attach a custom domain. |

---

## 2. Internationalization (i18n)

### URL strategy (SEO-first)
- **Bangla (default):** clean root URLs — `mysite.com/doctors`, `mysite.com/specialties/neurology/khalishpur`
- **English:** `/en` prefix — `mysite.com/en/doctors`
- `/bn/*` never exists publicly (308 → root) so there is no duplicate content.
- Every page emits `hreflang` alternates (`bn-BD`, `en`, `x-default`) and both versions ship in the sitemap, so Google ranks the Bangla page for Bangla queries and the English page for English queries.

### How it works
- `src/middleware.ts` internally **rewrites** root URLs to the hidden `/[locale]` segment (`/doctors` → `/bn/doctors`) — the address bar stays clean. `/en/*` passes through.
- A `NEXT_LOCALE` cookie persists the visitor's explicit choice (set by the navbar flag switcher). A returning visitor with `en` gets 307-redirected from root URLs to `/en/...`. Crawlers (no cookie) always see the canonical structure.
- The navbar switcher (`components/public/lang-switcher.tsx`) swaps locales with a soft SPA navigation (no full reload) and sets the cookie for a year.

### Content model
- All human-readable DB fields are **JSONB**: `{"bn": "…", "en": "…"}`. Bangla is required, English optional — missing English falls back to Bangla everywhere (`t()` in `src/lib/i18n.ts`).
- Admin forms show side-by-side **বাংলা (required)** and **English (optional)** inputs (`MLInput`), including separate meta title/description per language and a language-tabbed rich-text editor for blog posts.
- Static UI strings live in `src/lib/dict.ts` (bn + en dictionaries).

### Instant navigation (no click delay)
`loading.tsx` shimmer skeletons at `[locale]/(public)/loading.tsx` and `admin/loading.tsx` stream immediately on every route transition (0ms UI feedback) while the server renders — no design changes, just Suspense streaming.

---

## 3. What's included

### Public site (bn + en)
Homepage (hero slider, search, specialty grid, geo-sorted featured doctors, hospitals, testimonials, blog, FAQ, helpline) · `/doctors` filterable listing (bilingual search) · `/doctors/[slug]` profile with chambers/schedules/reviews + `Physician` JSON-LD · 3-step booking wizard · SEO landing pages `/specialties/[slug]`, `/area/doctors/[district]/[area]` and programmatic combo money pages `/specialties/[slug]/[area]` · hospitals, blog (`Article` JSON-LD), for-doctors plans, contact, about, terms, privacy, 404.

### Admin dashboard (`/admin`)
Overview (stats, revenue chart, expiring promotions, audit trail) · Doctors (photo, multi-specialty, multi-chamber, per-language SEO) · Specialties · Areas · Hospitals (gallery) · Appointments · Promotions (auto-expiry auto-unfeatures) · Leads · Blog (bn/en rich text) · Reviews · Hero slides · FAQs · Testimonials · SEO settings (bilingual defaults, per-URL overrides, redirects, sitemap regenerate) · Integrations (SMTP/SMS/Maps/GeoIP/Analytics/reCAPTCHA with test buttons, AES-256 encrypted) · Site settings · Users. Every mutation audits + instantly revalidates public pages, metadata, JSON-LD and sitemap.

### Cloudflare R2 image pipeline
- Uploads go to R2 via the S3 API (`src/lib/storage.ts`); DB stores only the object `key` + public `url`.
- **Replacing an image permanently deletes the previous R2 object first** — the bucket never accumulates orphans. Deleting doctors/hospitals/posts/slides/testimonials also deletes their objects (gallery included).
- Objects are served with immutable cache headers from your r2.dev/custom domain (free egress).

### Geo personalization
Visitor IP → area match (ip-api.com free by default, ipinfo.io configurable in Integrations). Matching-area doctors sort first with a dismissible banner and manual override. Never blocks anyone.

### Security (production-grade)
- **HTTP headers** on every response: `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (camera/mic/geo/payment locked), `Strict-Transport-Security` (HSTS 2y), `X-Powered-By` removed.
- **SQL injection:** every query is parameterised with `$1`; user input never enters an SQL string.
- **Admin auth:** bcrypt password hash + JWT (HS256) in an `httpOnly` + `sameSite=lax` + `secure`-in-prod cookie; enforced by middleware AND by `requireSession()` in every server action.
- **Integration credentials:** AES-256-GCM encrypted at rest with `APP_SECRET` — a DB dump alone can't leak SMTP/API keys.
- **Form validation:** Zod on every server action + IP rate limiting (login, booking, leads).
- **HTML sanitization:** blog article HTML is sanitized with DOMPurify at render time (allow-listed tag/attribute set, no `<script>` / event handlers / `javascript:` URLs), even though only admins can write it.
- **reCAPTCHA v3:** when enabled in Integrations, `RecaptchaGuard` in the public layout intercepts every form submit and injects a fresh token; the server rejects submissions with a missing/invalid token or a score below 0.5. Off by default — enable it once you have keys, no code change needed.
- **CSRF:** covered by Next.js server actions' built-in origin/host check.

---

## 4. Database portability

Plain Postgres only (tables, enums, JSONB, GIN index) — no host-specific features. Admin auth lives in the `admin_users` table (bcrypt + JWT), so one dump restores the entire system.

```bash
# export
pg_dump "$DATABASE_URL" --no-owner --no-privileges -Fc -f doctorbondhu.dump
# restore anywhere (DigitalOcean, RDS, ...)
pg_restore --no-owner --no-privileges -d "postgresql://USER:PASS@NEW_HOST:5432/db" doctorbondhu.dump
# then just change DATABASE_URL in .env — nothing else.
```

## 5. Scripts

| Command | Does |
| --- | --- |
| `npm run setup` | Migrations + bilingual seed (15 areas, 17 specialties, 6 hospitals, FAQs, slides, settings) + bootstrap admin. Idempotent. |
| `node scripts/setup.mjs --fresh` | **Drops everything** and rebuilds from scratch (use when upgrading the schema). |
| `npm run db:migrate` / `db:seed` | Individual steps. |
| `npm run db:generate` | Diff `src/db/schema.ts` against the DB and emit a new SQL migration under `migrations/drizzle`. |
| `npm run db:push` | Push schema changes directly to the DB (fast prototyping — skip for production). |
| `npm run db:studio` | Open Drizzle Studio (browser UI) to inspect and edit rows. |
| `npm run dev` / `build` / `start` | Standard Next.js. |

### Drizzle ORM

The data layer is fully Drizzle. Schema lives at `src/db/schema.ts` — one file mirroring the whole PostgreSQL schema (21 tables, 7 enums, indexes, CHECK constraints, JSONB `$type<ML>()`, and a full `relations()` graph for the query API). The client (`src/db/index.ts`) is a lazy Proxy so build never opens a DB connection. Everything imports from `@/db`:

```ts
import { db, doctors, chambers } from "@/db";
import { eq } from "drizzle-orm";

const [doc] = await db.select().from(doctors).where(eq(doctors.slug, slug)).limit(1);
```

Escape hatch for LATERAL joins, DISTINCT ON, or raw SQL: `db.execute<Row>(sql\`...\`)` — Drizzle-parameterized, still safe.

**Workflow for schema changes:** edit `src/db/schema.ts` → `npm run db:generate` → review the SQL under `migrations/drizzle/` → `npm run db:push` (dev) or commit and run in prod. `pg_dump`/`pg_restore` portability is unchanged — Drizzle sits on the same standard Postgres.

## 6. Project layout

```
migrations/001_init.sql   Multilingual JSONB schema (plain Postgres)
scripts/setup.mjs         Setup runner (--fresh to drop & rebuild)
src/
  middleware.ts           Locale rewrite/redirect + cookie persistence + admin guard + 308 slug redirects
  lib/i18n.ts             Locale core: t(), localeHref(), num(), date()
  lib/dict.ts             UI string dictionaries (bn/en)
  lib/storage.ts          Cloudflare R2 upload/permanent-delete
  lib/{data,seo,settings,geo,auth,crypto,integrations,mailer}.ts
  app/[locale]/(public)/  All public pages (+ loading.tsx shimmer)
  app/admin/              Dashboard (+ loading.tsx) · app/admin-login/
  app/api/og/             Bangla-font OG image generator · sitemap.ts (both locales, hreflang)
  components/public/      Navbar (with flag LangSwitcher), cards, sliders, forms
  components/admin/       MLInput (bn+en dual inputs), ImageUpload, rich text
design-template/          Original Claude Design bundle (reference only)
```
