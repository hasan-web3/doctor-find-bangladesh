-- Chamber location, two fixes.
--
-- 1. district_id
--    The admin form has always asked for a district BEFORE the thana, but only
--    the thana was ever stored — the district was re-derived on read through
--    areas.district_id. So a chamber where the admin picked a district and left
--    the thana blank lost the district completely: the card printed no place,
--    the doctor dropped out of that district's listing, and the geo ranking
--    could not see them. This column makes the admin's answer durable.
--    Backfilled from the linked area, so every existing row keeps exactly the
--    district it already resolved to.
--
-- 2. custom_area
--    A free-text thana / upazila for THIS chamber only — same idea as
--    doctors.custom_specialties (see migration 011): it never enters the shared
--    `areas` taxonomy, so it gets no page, no filter entry and never appears in
--    another chamber's dropdown. Plain text on the public profile and in the
--    chamber's JSON-LD address, nothing more.
--    Shape: {"bn": "...", "en": "..."} — one label, same as chambers.address.
--    When set it WINS over the linked area for display, so an admin can print a
--    more precise locality ("মুজগুন্নী আবাসিক এলাকা") while the selected thana
--    still does the filtering and linking underneath.

ALTER TABLE chambers
  ADD COLUMN IF NOT EXISTS district_id bigint REFERENCES districts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS custom_area jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE chambers c
   SET district_id = a.district_id
  FROM areas a
 WHERE a.id = c.area_id
   AND c.district_id IS DISTINCT FROM a.district_id;

CREATE INDEX IF NOT EXISTS idx_chambers_district ON chambers(district_id);
