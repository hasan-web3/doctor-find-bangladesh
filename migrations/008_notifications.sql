-- Admin notification inbox.
--
-- One row per event the dashboard should surface as an unread badge. Two kinds
-- of writes feed it, and both share the same rule: notify only when the change
-- happened somewhere the owning panel can't see.
--
--   • Public form submissions (appointments, leads). Nobody in the admin made
--     them, so every one is news.
--   • Inline "quick create" rows — hospital / specialty / district / thana
--     added from ANOTHER panel's form (e.g. a hospital created inside the
--     doctor form). The hospital dashboard would otherwise never show that a
--     row appeared. Rows created from a panel's own dashboard write nothing:
--     the admin is already looking at the list they just added to.
--
-- `panel` is the /admin route segment that owns the row, which is exactly what
-- the sidebar groups its unread counts by — so clearing a badge is a single
-- UPDATE on one panel. `read_at IS NULL` is the unread test; the partial index
-- keeps the per-panel count query small no matter how much read history piles
-- up. `title` / `body` are bilingual JSONB like every other content column.

CREATE TABLE IF NOT EXISTS notifications (
  id          bigserial PRIMARY KEY,
  panel       text NOT NULL,
  kind        text NOT NULL,
  entity_id   text,
  title       jsonb NOT NULL DEFAULT '{}'::jsonb,
  body        jsonb NOT NULL DEFAULT '{}'::jsonb,
  href        text,
  source      text,
  read_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_unread
  ON notifications (panel) WHERE read_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_created
  ON notifications (created_at DESC);
