-- Switching FAQ blocks off, per scope or per entity.
--
-- Generated FAQs (migrations/018) appear on every qualifying page by default,
-- which is the point. This table is the exception list for when that is not
-- wanted: an admin can silence every district's FAQ at once, or just Khulna's,
-- without deleting anything and without touching the generator.
--
-- DENYLIST, not a settings table. A row means "off"; no row means "on". So the
-- table stays empty in the normal case and a lookup is a tiny indexed read,
-- rather than a row per district, thana, hospital and doctor on the site.
--
-- `ref_id = 0` is the SCOPE-WIDE switch. Entity ids come from bigserial columns
-- that start at 1, so 0 can never collide with a real row, and using a sentinel
-- instead of NULL keeps the primary key simple (NULLs are not comparable in a
-- PK and would let duplicate scope-wide rows accumulate).
--
--   ('district', 0)  -> every district page's FAQ is off
--   ('district', 7)  -> only district #7's FAQ is off
--
-- Deliberately NOT stored in site_settings: that tag triggers a layout-wide
-- cache purge on write, and this only needs the far narrower "faqs" tag.

CREATE TABLE IF NOT EXISTS faq_disabled (
  scope      faq_scope   NOT NULL,
  ref_id     bigint      NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (scope, ref_id)
);
