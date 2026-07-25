-- Doctor "treated conditions" — a bilingual list of ailments each doctor
-- routinely handles, rendered on the public profile as a checkbox list so
-- patients can self-match before booking. Stored as JSONB { bn: [...], en: [...] }
-- rather than a text[] because line counts diverge between locales and each
-- locale list needs its own ordering.
--
-- Default {} keeps existing rows valid; the API resolves to the current
-- locale's array and falls back to [] when the object is empty.

ALTER TABLE doctors
  ADD COLUMN IF NOT EXISTS treated_conditions jsonb NOT NULL DEFAULT '{}'::jsonb;
