-- v2 relations: districts as first-class entity, doctor.hospital_id, chamber loses hospital_id.
--
-- Rationale: the previous model tied a doctor to a hospital only indirectly through
-- chambers, and areas carried a free-form JSONB district string. This migration
-- promotes districts to their own table (so admins can maintain them, area lookups
-- cascade from district → area, and district lat/lng powers geo search), and moves
-- the doctor↔hospital link onto the doctor row itself (chambers stay purely as
-- physical consultation locations: address + schedule + fee).
--
-- Data is preserved where possible: existing area.district JSONB values seed the
-- districts table, and each doctor's primary chamber's old hospital_id is copied
-- onto the doctor row before the column is dropped.

-- ============ districts ============
CREATE TABLE IF NOT EXISTS districts (
  id          BIGSERIAL PRIMARY KEY,
  slug        TEXT NOT NULL UNIQUE,
  name        JSONB NOT NULL DEFAULT '{}'::jsonb,
  lat         DOUBLE PRECISION,
  lng         DOUBLE PRECISION,
  intro       JSONB NOT NULL DEFAULT '{}'::jsonb,
  meta_title  JSONB NOT NULL DEFAULT '{}'::jsonb,
  meta_description JSONB NOT NULL DEFAULT '{}'::jsonb,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  sort        INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_districts_active ON districts(active, sort);

-- Seed the default Khulna district so existing Khulna areas have a home.
INSERT INTO districts (slug, name, lat, lng, sort)
VALUES ('khulna', '{"bn":"খুলনা","en":"Khulna"}'::jsonb, 22.8456, 89.5403, 0)
ON CONFLICT (slug) DO NOTHING;

-- Backfill: any distinct district value already living inside areas.district
-- becomes its own row. Uses lower-kebab of English (fallback Bangla) for the slug.
DO $$
DECLARE r RECORD; s TEXT;
BEGIN
  FOR r IN SELECT DISTINCT district FROM areas WHERE district IS NOT NULL AND district <> '{}'::jsonb LOOP
    s := lower(regexp_replace(coalesce(r.district->>'en', r.district->>'bn'), '[^a-zA-Z0-9]+', '-', 'g'));
    s := trim(both '-' from s);
    IF s <> '' THEN
      INSERT INTO districts (slug, name, sort)
      VALUES (s, r.district, 10)
      ON CONFLICT (slug) DO NOTHING;
    END IF;
  END LOOP;
END $$;

-- ============ areas.district_id ============
ALTER TABLE areas ADD COLUMN IF NOT EXISTS district_id BIGINT REFERENCES districts(id) ON DELETE SET NULL;

-- Match existing area.district JSONB to a seeded district row.
UPDATE areas a SET district_id = d.id
  FROM districts d
 WHERE a.district_id IS NULL
   AND (a.district->>'bn' = d.name->>'bn' OR a.district->>'en' = d.name->>'en');

-- Anything unmatched defaults to Khulna so no orphan areas remain.
UPDATE areas SET district_id = (SELECT id FROM districts WHERE slug = 'khulna')
 WHERE district_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_areas_district ON areas(district_id);

-- ============ doctors.hospital_id ============
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS hospital_id BIGINT REFERENCES hospitals(id) ON DELETE SET NULL;

-- Best-effort: bring across the doctor's existing primary chamber hospital.
UPDATE doctors d SET hospital_id = (
  SELECT c.hospital_id FROM chambers c
   WHERE c.doctor_id = d.id AND c.hospital_id IS NOT NULL
   ORDER BY c.sort ASC LIMIT 1
) WHERE d.hospital_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_doctors_hospital ON doctors(hospital_id);

-- ============ drop chambers.hospital_id ============
-- Chambers are now purely physical rooms + schedule; hospital lives on doctor.
ALTER TABLE chambers DROP COLUMN IF EXISTS hospital_id;
