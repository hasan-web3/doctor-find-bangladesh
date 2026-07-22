-- Typo-tolerant search on the public site: enables pg_trgm and adds trigram
-- indexes on the JSONB text we search in `searchDoctors`. With pg_trgm, the
-- `%` operator ("is similar to") and `similarity()` return matches even when
-- the query has a swapped/dropped/mistyped character.
--
-- pg_trgm ships with every mainstream Postgres install (Supabase, RDS, DO,
-- self-hosted). Safe to run repeatedly.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Doctor names: primary target for typo-tolerant search.
CREATE INDEX IF NOT EXISTS idx_doctors_name_bn_trgm ON doctors USING GIN ((name->>'bn') gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_doctors_name_en_trgm ON doctors USING GIN ((name->>'en') gin_trgm_ops);

-- Degrees, specialty, chamber, area — also matched in searchDoctors's OR block.
CREATE INDEX IF NOT EXISTS idx_doctors_degrees_bn_trgm ON doctors USING GIN ((degrees->>'bn') gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_doctors_degrees_en_trgm ON doctors USING GIN ((degrees->>'en') gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_specialties_name_bn_trgm ON specialties USING GIN ((name->>'bn') gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_specialties_name_en_trgm ON specialties USING GIN ((name->>'en') gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_areas_name_bn_trgm ON areas USING GIN ((name->>'bn') gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_areas_name_en_trgm ON areas USING GIN ((name->>'en') gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_hospitals_name_bn_trgm ON hospitals USING GIN ((name->>'bn') gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_hospitals_name_en_trgm ON hospitals USING GIN ((name->>'en') gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_chambers_name_bn_trgm ON chambers USING GIN ((name->>'bn') gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_chambers_name_en_trgm ON chambers USING GIN ((name->>'en') gin_trgm_ops);
