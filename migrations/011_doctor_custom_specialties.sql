-- Per-doctor free-text specialties.
--
-- The `specialties` table is shared taxonomy: every row gets its own public
-- page, shows up in filters, and appears in every doctor's picker. Some doctors
-- carry a niche title that is real but not worth a site-wide category — adding
-- it to the taxonomy would pollute the list for everyone and create a category
-- page with exactly one doctor in it.
--
-- These entries live on the doctor row instead: shown as plain text on the
-- profile next to the linked specialties, never listed, never linked, never
-- offered to another doctor.
--
-- Shape: [{"bn": "...", "en": "..."}, ...] — an array of ML pairs rather than
-- {bn: [], en: []} (the treated_conditions shape) because each entry is ONE
-- label whose two translations must stay paired; the lists can't drift apart.
-- Default [] keeps every existing row valid.

ALTER TABLE doctors
  ADD COLUMN IF NOT EXISTS custom_specialties jsonb NOT NULL DEFAULT '[]'::jsonb;
