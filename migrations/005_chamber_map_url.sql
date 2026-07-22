-- Per-chamber Google Maps location. Admins paste any Google Maps URL —
-- share link, embed src, or ?q=lat,lng — and the frontend renders it as an
-- iframe when set. When null, the map section is hidden entirely.
--
-- Kept as freeform TEXT (not lat/lng) so admins don't have to fish coordinates
-- out of Google Maps: just click "Share → Embed" and paste the URL. The
-- existing lat/lng columns stay put and continue to feed JSON-LD.

ALTER TABLE chambers ADD COLUMN IF NOT EXISTS map_url TEXT;

COMMENT ON COLUMN chambers.map_url IS 'Google Maps URL (share link or embed src). Frontend renders as an iframe when non-null.';
