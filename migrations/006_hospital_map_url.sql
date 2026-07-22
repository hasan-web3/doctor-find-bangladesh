-- Hospitals get the same freeform Google Maps URL treatment as chambers.
-- Admin pastes an iframe embed / share URL and the frontend renders it.
-- lat/lng remain for JSON-LD and other consumers.

ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS map_url TEXT;
COMMENT ON COLUMN hospitals.map_url IS 'Google Maps URL (share link or embed src). Frontend renders as iframe when non-null.';
