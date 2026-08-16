# Doctors Find Bangladesh (ডক্টরস ফাইন্ড বাংলাদেশ)

A bilingual (Bangla + English) doctor directory for Bangladesh. Patients find verified doctors by specialty, district or area and book appointments; the owner runs everything from an admin dashboard.

**Stack:** Next.js 15 (App Router, RSC, TypeScript strict) · PostgreSQL with JSONB multilingual fields (Supabase or any standard Postgres) · Drizzle ORM · Cloudflare R2 (images) · Tailwind CSS

Brand name, helpline, logo, plans and all site copy live in the database (`/admin/settings`), not in the code.

---

## 1. Requirements

| Need | Version / where |
| --- | --- |
| Node.js | 20 or newer (22 recommended) |
| PostgreSQL | Supabase project, or any Postgres 14+ |
| Cloudflare R2 | One bucket with public access (r2.dev subdomain or custom domain) |

Nothing else is required to boot. Email, SMS, Maps, geolocation, analytics and reCAPTCHA are optional and configured later from the dashboard.

---

## 2. Run it locally

```bash
npm install
```

```bash
cp .env.example .env
```

Fill in `.env` — at minimum `DATABASE_URL`, `NEXT_PUBLIC_SITE_URL`, `APP_SECRET`, the four `R2_*` values, and `ADMIN_EMAIL` / `ADMIN_PASSWORD` for the first login. Generate the secret with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Create the schema, seed starter data and the first admin (idempotent, safe to re-run):

```bash
npm run setup
```

```bash
npm run dev
```

| URL | What |
| --- | --- |
| http://localhost:3000 | Public site, Bangla |
| http://localhost:3000/en | Public site, English |
| http://localhost:3000/admin-login | Admin login (unlisted URL) |

---

## 3. Environment variables

Only these are read from the environment. Everything else is stored in the database.

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | Postgres connection string. On Supabase use the **pooler** URL (port 6543) for serverless hosting; the direct URL (5432) also works. SSL is auto-enabled for every non-localhost host. |
| `NEXT_PUBLIC_SITE_URL` | yes | Public base URL, no trailing slash. Drives canonical URLs, hreflang, sitemap, OG images and JSON-LD. The build **fails in production** if it is missing. |
| `APP_SECRET` | yes | Signs admin session JWTs and encrypts integration credentials (AES-256-GCM). Changing it logs out all admins and makes saved integration keys unreadable. |
| `R2_ACCOUNT_ID` | yes | Cloudflare dashboard sidebar → Account ID. |
| `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | yes | R2 → Manage R2 API Tokens → Object Read & Write. |
| `R2_BUCKET` | yes | Bucket name. |
| `R2_PUBLIC_URL` | yes | Bucket public URL. Also becomes the allowed `next/image` host, so changing it needs a rebuild. |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME` | first run | Bootstrap super-admin, created once by `npm run setup`. Can be removed afterwards — later admins are added from `/admin/users`. |
| `GOOGLE_SITE_VERIFICATION` | no | Search Console meta token (the `content` value only). Set it on the live site until the domain is verified. |

---

## 4. First-run checklist (admin dashboard)

After `npm run setup`, log in at `/admin-login` and set these up — the site works without them, but this is what makes it complete:

1. **Settings** (`/admin/settings`) — site name, helpline, WhatsApp, email, address, logo, favicon, social links, pricing plans, stats.
2. **Integrations** (`/admin/integrations`) — each one has an enable toggle and a Test button; credentials are encrypted at rest:
   - **Resend** — transactional email (primary provider). **SMTP** — fallback provider.
   - **SMS**, **Google Maps** (chamber maps), **IP geolocation** (fallback when the browser denies GPS), **Analytics** (GA/GTM/Facebook/Cloudflare), **reCAPTCHA v3** (form spam, off by default).
3. **SEO** (`/admin/seo`) — bilingual default title/description, per-URL overrides, redirects, sitemap regeneration.
4. **Content** — districts and areas, specialties, hospitals, doctors, hero slides, FAQs, testimonials, blog, static pages.

Optional bulk data (run once, both idempotent):

```bash
npm run db:seed-bd-geo
```

```bash
npm run db:seed-bd-metro
```

---

## 5. Go live

Built and tested on Vercel; any Node host that runs `next build` / `next start` works.

**1. Run migrations against the production database first.** Point `DATABASE_URL` at the production DB and run:

```bash
npm run db:migrate
```

Do this *before* deploying — `next build` prerenders pages against the live schema.

**2. Set the environment variables on the host** (Vercel → Project → Settings → Environment Variables). They must exist for **Production, Preview and Build** — the build itself queries the database.

- `NEXT_PUBLIC_SITE_URL` = the real `https://` domain, no trailing slash. Never leave a localhost or ngrok URL here; it ends up in every canonical tag and sitemap entry.
- `DATABASE_URL` = the **pooler** connection string (port 6543). The direct connection can exhaust the connection limit during a parallel build.
- `APP_SECRET`, `R2_*` as in the table above.
- `ADMIN_*` are not needed in production once the admin exists.

**3. Deploy.**

```bash
npm run build
```

```bash
npm start
```

On Vercel, push to `main` and it builds automatically.

**4. Point the domain** at the host, then confirm HTTPS is live before announcing the URL — the session cookie is `secure` in production and will not survive plain HTTP.

**Post-launch verification**

- [ ] `https://yourdomain.com` (Bangla) and `/en` both render.
- [ ] `/admin-login` works, and `/admin` redirects there when logged out.
- [ ] A doctor photo uploaded from the admin appears on the public profile (proves R2 + image host).
- [ ] `https://yourdomain.com/sitemap.xml` and `/robots.txt` return the real domain.
- [ ] View source on a doctor profile: canonical URL, hreflang alternates and `Physician` JSON-LD all use the live domain.
- [ ] Submit a test appointment and a contact message — confirm the email arrives (Integrations → Resend enabled and its domain verified).
- [ ] Submit the sitemap in Google Search Console.

**Publishing content later:** public pages are ISR-cached and every admin mutation revalidates the pages it touches automatically. No redeploy is needed to publish a doctor, post or setting change.

---

## 6. Database

### Migrations

SQL files in `migrations/` run in filename order and are tracked in the `_migrations` table.

> **Migrations are forward-only and not re-runnable.** Several of them drop or rename the columns they read (002 in particular). If a migration is applied but its row is missing from `_migrations`, `db:migrate` will try it again and fail. Check the ledger before touching a live database:
>
> ```bash
> psql "$DATABASE_URL" -c "select name, applied_at from _migrations order by name"
> ```

`node scripts/setup.mjs --fresh` **drops every table and type** and rebuilds from scratch. Development only.

### Backup / restore

Plain Postgres only — tables, enums, JSONB, GIN indexes. Admin accounts live in the `admin_users` table, so one dump carries the entire system.

```bash
pg_dump "$DATABASE_URL" --no-owner --no-privileges -Fc -f backup.dump
```

```bash
pg_restore --no-owner --no-privileges -d "postgresql://USER:PASS@NEW_HOST:5432/db" backup.dump
```

Then change `DATABASE_URL` — nothing else.

### Schema changes (Drizzle)

The schema lives in `src/db/schema.ts` (one file: tables, enums, indexes, CHECK constraints, JSONB `$type<ML>()`, full `relations()` graph). The client is a lazy Proxy, so a build never opens a connection it doesn't need.

```ts
import { db, doctors } from "@/db";
import { eq } from "drizzle-orm";

const [doc] = await db.select().from(doctors).where(eq(doctors.slug, slug)).limit(1);
```

Workflow: edit `src/db/schema.ts` → `npm run db:generate` → review the SQL in `migrations/drizzle/` → `npm run db:push` (dev) or commit and migrate (prod). Raw escape hatch for LATERAL joins and tsvector search: `db.execute<Row>(sql\`…\`)`, still parameterized.

---

## 7. Scripts

| Command | Does |
| --- | --- |
| `npm run dev` / `build` / `start` | Standard Next.js. |
| `npm run setup` | Migrations + seed + bootstrap admin. Idempotent. |
| `npm run db:migrate` | Migrations only. |
| `npm run db:seed` | Seed only (starter areas, specialties, hospitals, FAQs, slides, settings). |
| `npm run db:seed-bd-geo` | All 64 districts + ~495 upazilas with lat/lng. |
| `npm run db:seed-bd-metro` | Metropolitan police thanas for all 8 metro cities. |
| `npm run db:generate` | Diff `src/db/schema.ts` against the DB, emit a new SQL migration. |
| `npm run db:push` | Push schema changes straight to the DB (dev prototyping). |
| `npm run db:studio` | Drizzle Studio — browse and edit rows. |
| `node scripts/backfill-seo.mjs` | Fill empty intro / meta fields on specialties, districts, areas, hospitals from the bilingual templates. Non-destructive. |
| `node scripts/setup.mjs --fresh` | **Drops everything** and rebuilds. Dev only. |

---

## 8. Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| Build error: `NEXT_PUBLIC_SITE_URL must be set in production` | The variable is missing on the host, or not exposed to the Build environment. |
| `DATABASE_URL is not set` during build | Same — the build queries the DB, so the variable must exist at build time, not just at runtime. |
| Build fails with `max client connections reached` | Use the Supabase **pooler** URL (port 6543) instead of the direct 5432 connection. |
| Images 404, or `next/image` rejects the source | `R2_PUBLIC_URL` doesn't match the host in the stored image URL, or the bucket isn't public. Fix the value and rebuild — the image allowlist is baked in at build time. |
| Admin login loops back to the login page | `APP_SECRET` changed (old cookies are invalid — log in again), or the site is being served over plain HTTP in production. |
| Migration fails on a column that "does not exist" | The `_migrations` ledger has drifted from the real schema. Compare the ledger with the applied schema before re-running anything. |
| Emails not sending | Integrations → Resend (or SMTP) must be **enabled**, and the sending domain verified in Resend. Use the Test button. |
| Canonical URLs point at localhost or an ngrok host | A stale `NEXT_PUBLIC_SITE_URL` was used for the production build. Fix it and rebuild. |

---

## 9. How it works

### Bilingual URLs (SEO-first)
- **Bangla (default):** clean root URLs — `/doctors`, `/specialties/neurology/khalishpur`
- **English:** `/en` prefix — `/en/doctors`
- `/bn/*` never exists publicly (308 → root), so there is no duplicate content.
- `src/middleware.ts` internally rewrites root URLs to the hidden `/[locale]` segment; the address bar stays clean. A `NEXT_LOCALE` cookie remembers an explicit choice from the navbar switcher. Crawlers (no cookie) always see the canonical structure.
- Every page emits `hreflang` alternates (`bn-BD`, `en`, `x-default`), and both versions ship in the sitemap.

### Content model
All human-readable DB fields are JSONB `{"bn": "…", "en": "…"}`. Bangla is required, English optional and falls back to Bangla (`t()` in `src/lib/i18n.ts`). Admin forms show side-by-side বাংলা / English inputs, including per-language meta title and description. Static UI strings live in `src/lib/dict.ts`.

### Public site
Homepage (hero slider, search, specialty grid, location-sorted doctors, hospitals, testimonials, blog, FAQ, helpline) · filterable `/doctors` · doctor profile with chambers, schedules, BMDC badge, reviews and `Physician` JSON-LD · booking wizard · SEO landing pages for specialty, district and area, plus programmatic specialty × area combos · hospitals · blog with `Article` JSON-LD · about, contact, terms, privacy · token-based doctor self-intake form at `/doctor-form/[token]`.

### Admin dashboard (`/admin`)
Overview · Doctors (photo, multi-specialty, multi-chamber, priority ordering, BMDC registration, per-language SEO) · Doctor intake forms · Specialties · Districts · Areas · Hospitals · Appointments · Leads · Blog · Reviews · Hero slides · FAQs · Testimonials · Static pages · SEO · Integrations · Settings · Users. Every mutation is audited and revalidates the public pages, metadata, JSON-LD and sitemap it affects.

### Images
Uploads go to R2 over the S3 API (`src/lib/storage.ts`); the DB stores only the object key and public URL. Replacing an image deletes the previous object first, and deleting a record deletes its objects (galleries included) — the bucket never accumulates orphans.

### Location
Browser GPS first (with permission), IP geolocation as the fallback. Nearby doctors sort first behind a dismissible banner with a manual override. It never blocks anyone.

### Security
Security headers and a CSP on every response (`next.config.ts`) · every query parameterized · bcrypt + JWT (HS256) admin sessions in an `httpOnly`, `sameSite=lax`, `secure`-in-prod cookie, enforced by middleware *and* by `requireSession()` in every server action · integration credentials AES-256-GCM encrypted with `APP_SECRET` · Zod validation plus IP rate limiting on login, booking and leads · blog HTML sanitized at render · optional reCAPTCHA v3 on all public forms · CSRF covered by the server actions origin check.

---

## 10. Project layout

```
migrations/               Forward-only SQL migrations (001 → 021), tracked in _migrations
scripts/setup.mjs         Migrate + seed + bootstrap admin (--fresh to drop & rebuild)
scripts/seed-bd-*.mjs     Bangladesh districts, upazilas and metro thanas
scripts/backfill-seo.mjs  Fill empty SEO fields from bilingual templates
src/
  middleware.ts           Locale rewrite/redirect + cookie + admin guard + 308 slug redirects
  db/schema.ts            Full Drizzle schema · db/index.ts lazy client
  lib/i18n.ts             t(), localeHref(), num(), date()
  lib/dict.ts             UI string dictionaries (bn/en)
  lib/seo.ts              Server-only SEO helpers · lib/seo-utils.ts shared builders (kept separate)
  lib/storage.ts          R2 upload / permanent delete
  lib/{data,settings,geo,location,auth,crypto,integrations,resend,mailer,notify,bmdc}.ts
  app/[locale]/(public)/  Public pages (+ loading.tsx shimmers)
  app/(dashboard)/        admin/ dashboard and admin-login/
  app/(intake)/           Token-based doctor self-service form
  app/api/                OG images, search, redirects, geo lookups · sitemap (sharded)
  components/public/      Navbar with LangSwitcher, cards, sliders, forms
  components/admin/       MLInput (bn+en), ImageUpload, rich text editor
design-template/          Original design bundle (reference only)
```
