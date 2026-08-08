-- The intake form now asks for ONE value per field instead of a Bangla/English
-- pair, for everything except the doctor's own name.
--
-- Why: a chamber assistant filling this in on a phone will not translate seven
-- fields, and a half-translated pair is worse than a single good answer — the
-- admin can write the second language when they build the real profile. Only
-- the doctor's name stays bilingual, because it prints as a heading on both
-- locale pages.
--
-- The columns held single-language text already, so this is a rename, not a
-- rewrite. Wrapped in an existence check because RENAME COLUMN (unlike ADD/DROP)
-- has no IF EXISTS form and would abort the whole migration on a second run.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_name = 'doctor_submissions' AND column_name = 'hospital_bn') THEN
    ALTER TABLE doctor_submissions RENAME COLUMN hospital_bn TO hospital;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_name = 'doctor_submissions' AND column_name = 'specialty_bn') THEN
    ALTER TABLE doctor_submissions RENAME COLUMN specialty_bn TO specialty;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_name = 'doctor_submissions' AND column_name = 'district_bn') THEN
    ALTER TABLE doctor_submissions RENAME COLUMN district_bn TO district;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_name = 'doctor_submissions' AND column_name = 'area_bn') THEN
    ALTER TABLE doctor_submissions RENAME COLUMN area_bn TO area;
  END IF;
END $$;

-- The share image is gone from the form: it asked a client to think about how a
-- link looks on Facebook, which is our job, not theirs. No submission had ever
-- used it, so nothing is orphaned in R2 by dropping these.
ALTER TABLE doctor_submissions DROP COLUMN IF EXISTS share_image_key;
ALTER TABLE doctor_submissions DROP COLUMN IF EXISTS share_image_url;
