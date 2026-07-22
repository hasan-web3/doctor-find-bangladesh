-- Semantic rename: the `areas` table now represents Thana / Upazila (থানা / উপজেলা),
-- the sub-district administrative unit in Bangladesh. Urban regions are called
-- Thana, rural ones Upazila; both sit at the same level below District (জেলা).
--
-- The table + column names stay as-is to keep foreign keys, indexes, cached
-- Drizzle types, seed data, and existing URLs (/areas/<slug>) stable. Only the
-- human-facing labels move to "থানা / উপজেলা" throughout the UI.

COMMENT ON TABLE areas IS 'Thana / Upazila — sub-district administrative unit (below District). Kept as "areas" for schema stability; UI labels use "থানা / উপজেলা".';
COMMENT ON COLUMN areas.district_id IS 'FK to the parent District (জেলা). Cascade: District → Thana / Upazila (this row) → Chambers.';
