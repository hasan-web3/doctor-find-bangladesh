-- DoctorBondhu schema (v2, multilingual).
-- All human-readable content is stored as JSONB {"bn": "...", "en": "..."}:
-- Bangla is required (default locale), English is optional and falls back to Bangla.
-- Plain Postgres only, so a pg_dump restores cleanly on any host.

-- ============ enums ============
DO $$ BEGIN
  CREATE TYPE appointment_status AS ENUM ('new', 'confirmed', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE promotion_plan AS ENUM ('basic', 'featured', 'premium');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE promotion_status AS ENUM ('active', 'expired', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE lead_type AS ENUM ('patient', 'doctor');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE lead_status AS ENUM ('new', 'in_progress', 'resolved');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE faq_scope AS ENUM ('home', 'specialty', 'area', 'hospital', 'doctor');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE admin_role AS ENUM ('super_admin', 'admin', 'editor');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ core auth ============
CREATE TABLE IF NOT EXISTS admin_users (
  id            BIGSERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          admin_role NOT NULL DEFAULT 'admin',
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============ site settings (key/value JSON) ============
CREATE TABLE IF NOT EXISTS site_settings (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============ taxonomy ============
CREATE TABLE IF NOT EXISTS specialties (
  id               BIGSERIAL PRIMARY KEY,
  slug             TEXT NOT NULL UNIQUE,
  name             JSONB NOT NULL,                 -- {"bn","en"}
  icon             TEXT NOT NULL DEFAULT 'activity',
  tint             SMALLINT NOT NULL DEFAULT 0,
  intro            JSONB NOT NULL DEFAULT '{}',    -- {"bn","en"}
  meta_title       JSONB NOT NULL DEFAULT '{}',
  meta_description JSONB NOT NULL DEFAULT '{}',
  active           BOOLEAN NOT NULL DEFAULT TRUE,
  sort             INT NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS areas (
  id               BIGSERIAL PRIMARY KEY,
  slug             TEXT NOT NULL UNIQUE,
  name             JSONB NOT NULL,
  district         JSONB NOT NULL DEFAULT '{"bn":"খুলনা","en":"Khulna"}',
  lat              DOUBLE PRECISION,
  lng              DOUBLE PRECISION,
  intro            JSONB NOT NULL DEFAULT '{}',
  meta_title       JSONB NOT NULL DEFAULT '{}',
  meta_description JSONB NOT NULL DEFAULT '{}',
  active           BOOLEAN NOT NULL DEFAULT TRUE,
  sort             INT NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============ hospitals ============
CREATE TABLE IF NOT EXISTS hospitals (
  id               BIGSERIAL PRIMARY KEY,
  slug             TEXT NOT NULL UNIQUE,
  name             JSONB NOT NULL,
  area_id          BIGINT REFERENCES areas(id) ON DELETE SET NULL,
  address          JSONB NOT NULL DEFAULT '{}',
  phone            TEXT,
  lat              DOUBLE PRECISION,
  lng              DOUBLE PRECISION,
  description      JSONB NOT NULL DEFAULT '{}',
  departments      JSONB NOT NULL DEFAULT '[]',    -- [{"bn","en"}]
  image_key        TEXT,                           -- R2 object key
  image_url        TEXT,
  gallery          JSONB NOT NULL DEFAULT '[]',    -- [{key, url}]
  meta_title       JSONB NOT NULL DEFAULT '{}',
  meta_description JSONB NOT NULL DEFAULT '{}',
  active           BOOLEAN NOT NULL DEFAULT TRUE,
  sort             INT NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============ doctors ============
CREATE TABLE IF NOT EXISTS doctors (
  id               BIGSERIAL PRIMARY KEY,
  slug             TEXT NOT NULL UNIQUE,
  name             JSONB NOT NULL,
  degrees          JSONB NOT NULL DEFAULT '{}',
  bio              JSONB NOT NULL DEFAULT '{}',
  gender           TEXT CHECK (gender IN ('male', 'female', 'other')),
  experience_years INT,
  patients_served  JSONB NOT NULL DEFAULT '{}',
  photo_key        TEXT,                           -- R2 object key
  photo_url        TEXT,
  verified         BOOLEAN NOT NULL DEFAULT FALSE,
  featured         BOOLEAN NOT NULL DEFAULT FALSE,
  active           BOOLEAN NOT NULL DEFAULT TRUE,
  meta_title       JSONB NOT NULL DEFAULT '{}',
  meta_description JSONB NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS doctor_specialties (
  doctor_id    BIGINT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  specialty_id BIGINT NOT NULL REFERENCES specialties(id) ON DELETE CASCADE,
  is_primary   BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (doctor_id, specialty_id)
);

CREATE TABLE IF NOT EXISTS chambers (
  id          BIGSERIAL PRIMARY KEY,
  doctor_id   BIGINT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  hospital_id BIGINT REFERENCES hospitals(id) ON DELETE SET NULL,
  name        JSONB NOT NULL,
  address     JSONB NOT NULL DEFAULT '{}',
  area_id     BIGINT REFERENCES areas(id) ON DELETE SET NULL,
  fee         INT NOT NULL DEFAULT 0,
  schedule    JSONB NOT NULL DEFAULT '[]',  -- [{days:{bn,en}, time:{bn,en}}]
  phone       TEXT,
  lat         DOUBLE PRECISION,
  lng         DOUBLE PRECISION,
  sort        INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chambers_doctor ON chambers(doctor_id);
CREATE INDEX IF NOT EXISTS idx_chambers_area ON chambers(area_id);

-- ============ appointments ============
CREATE TABLE IF NOT EXISTS appointments (
  id           BIGSERIAL PRIMARY KEY,
  serial_no    TEXT NOT NULL UNIQUE,
  doctor_id    BIGINT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  chamber_id   BIGINT REFERENCES chambers(id) ON DELETE SET NULL,
  patient_name TEXT NOT NULL,
  phone        TEXT NOT NULL,
  age          TEXT,
  problem      TEXT,
  visit_date   DATE NOT NULL,
  time_slot    TEXT NOT NULL,
  status       appointment_status NOT NULL DEFAULT 'new',
  note         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor ON appointments(doctor_id);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(visit_date);

-- ============ promotions / payments ============
CREATE TABLE IF NOT EXISTS promotions (
  id         BIGSERIAL PRIMARY KEY,
  doctor_id  BIGINT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  plan       promotion_plan NOT NULL,
  amount     INT NOT NULL DEFAULT 0,
  starts_on  DATE NOT NULL,
  ends_on    DATE NOT NULL,
  status     promotion_status NOT NULL DEFAULT 'active',
  notes      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_promotions_doctor ON promotions(doctor_id);
CREATE INDEX IF NOT EXISTS idx_promotions_status ON promotions(status, ends_on);

-- ============ leads ============
CREATE TABLE IF NOT EXISTS leads (
  id         BIGSERIAL PRIMARY KEY,
  type       lead_type NOT NULL,
  name       TEXT NOT NULL,
  phone      TEXT NOT NULL,
  message    TEXT,
  extra      JSONB NOT NULL DEFAULT '{}',
  status     lead_status NOT NULL DEFAULT 'new',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);

-- ============ blog ============
CREATE TABLE IF NOT EXISTS blog_categories (
  id   BIGSERIAL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name JSONB NOT NULL,
  sort INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS blog_posts (
  id               BIGSERIAL PRIMARY KEY,
  slug             TEXT NOT NULL UNIQUE,
  title            JSONB NOT NULL,
  excerpt          JSONB NOT NULL DEFAULT '{}',
  content          JSONB NOT NULL DEFAULT '{}',    -- {"bn": html, "en": html}
  category_id      BIGINT REFERENCES blog_categories(id) ON DELETE SET NULL,
  cover_key        TEXT,
  cover_url        TEXT,
  published        BOOLEAN NOT NULL DEFAULT FALSE,
  published_at     TIMESTAMPTZ,
  meta_title       JSONB NOT NULL DEFAULT '{}',
  meta_description JSONB NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_blog_published ON blog_posts(published, published_at DESC);

-- ============ reviews ============
CREATE TABLE IF NOT EXISTS reviews (
  id         BIGSERIAL PRIMARY KEY,
  doctor_id  BIGINT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  area_text  TEXT,
  rating     SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body       TEXT,
  published  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reviews_doctor ON reviews(doctor_id, published);

-- ============ homepage content ============
CREATE TABLE IF NOT EXISTS hero_slides (
  id        BIGSERIAL PRIMARY KEY,
  title     JSONB NOT NULL,
  text      JSONB NOT NULL DEFAULT '{}',
  icon      TEXT NOT NULL DEFAULT 'shield',
  cta_label JSONB NOT NULL DEFAULT '{}',
  cta_href  TEXT,
  image_key TEXT,
  image_url TEXT,
  sort      INT NOT NULL DEFAULT 0,
  active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS faqs (
  id       BIGSERIAL PRIMARY KEY,
  scope    faq_scope NOT NULL DEFAULT 'home',
  ref_id   BIGINT,
  question JSONB NOT NULL,
  answer   JSONB NOT NULL,
  sort     INT NOT NULL DEFAULT 0,
  active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_faqs_scope ON faqs(scope, ref_id, active);

CREATE TABLE IF NOT EXISTS testimonials (
  id        BIGSERIAL PRIMARY KEY,
  name      TEXT NOT NULL,
  area_text JSONB NOT NULL DEFAULT '{}',
  quote     JSONB NOT NULL,
  photo_key TEXT,
  photo_url TEXT,
  published BOOLEAN NOT NULL DEFAULT TRUE,
  sort      INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============ SEO ============
-- path is the locale-neutral (Bangla/root) path; locale variants derive from it.
CREATE TABLE IF NOT EXISTS seo_overrides (
  id               BIGSERIAL PRIMARY KEY,
  path             TEXT NOT NULL UNIQUE,
  meta_title       JSONB NOT NULL DEFAULT '{}',
  meta_description JSONB NOT NULL DEFAULT '{}',
  og_image_url     TEXT,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS redirects (
  id         BIGSERIAL PRIMARY KEY,
  from_path  TEXT NOT NULL UNIQUE,
  to_path    TEXT NOT NULL,
  permanent  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============ integrations (credentials encrypted at app layer) ============
CREATE TABLE IF NOT EXISTS integrations (
  key            TEXT PRIMARY KEY, -- smtp | sms | google_maps | ip_geo | analytics | recaptcha
  enabled        BOOLEAN NOT NULL DEFAULT FALSE,
  config_cipher  TEXT,
  status         TEXT NOT NULL DEFAULT 'never',
  status_message TEXT,
  last_tested_at TIMESTAMPTZ,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============ audit log ============
CREATE TABLE IF NOT EXISTS audit_log (
  id         BIGSERIAL PRIMARY KEY,
  actor_id   BIGINT,
  actor_name TEXT,
  action     TEXT NOT NULL,
  entity     TEXT NOT NULL,
  entity_id  TEXT,
  details    JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC);

-- ============ full text search (bn + en combined) ============
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS search_tsv tsvector
  GENERATED ALWAYS AS (
    to_tsvector('simple',
      coalesce(name->>'bn', '') || ' ' || coalesce(name->>'en', '') || ' ' ||
      coalesce(degrees->>'bn', '') || ' ' || coalesce(degrees->>'en', '')
    )
  ) STORED;
CREATE INDEX IF NOT EXISTS idx_doctors_tsv ON doctors USING GIN (search_tsv);
CREATE INDEX IF NOT EXISTS idx_doctors_flags ON doctors(active, featured);
