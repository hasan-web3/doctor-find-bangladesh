-- Client-facing doctor intake form: one-time links + the submissions they produce.
--
-- The business flow this supports: a doctor (or their chamber staff) pays to be
-- listed, so instead of the admin transcribing details over the phone we send
-- them a private form link and they fill it in themselves.
--
-- Two tables, and the split matters:
--
--   doctor_form_links       one row per generated link. Created the moment the
--                           admin generates it (the URL has to be valid before
--                           it can be shared), but deliberately NOT surfaced on
--                           the dashboard until `submitted_at` is set — a link
--                           that was only generated is not a lead yet.
--
--   doctor_submissions      the filled-in form. The client's own contact details
--                           are COPIED onto this row rather than only joined
--                           from the link, so the lead survives as one readable
--                           record and searching never needs the join.
--
-- Single use is enforced by claiming the link atomically on submit:
--   UPDATE doctor_form_links SET submitted_at = now()
--    WHERE token = $1 AND submitted_at IS NULL RETURNING id
-- A second submit (double click, replayed request, forwarded link) updates zero
-- rows and is rejected. There is no login on the client side — the token itself
-- is the only credential, so it is 32 random URL-safe bytes and the page is
-- noindex + disallowed in robots.txt.

CREATE TABLE IF NOT EXISTS doctor_form_links (
  id            BIGSERIAL PRIMARY KEY,
  token         TEXT NOT NULL UNIQUE,
  -- Who the link was made for. Captured in the generate modal, and carried onto
  -- the submission so the lead is searchable by the person we dealt with.
  client_name   TEXT NOT NULL,
  client_phone  TEXT NOT NULL,
  -- The address the link was emailed to. NULL when the admin only generated /
  -- saved the link and shared it another way (WhatsApp, Messenger).
  client_email  TEXT,
  from_email    TEXT,
  -- NULL => generated but never emailed from the dashboard.
  sent_at       TIMESTAMPTZ,
  -- NULL => still open. Set once, by the atomic claim above.
  submitted_at  TIMESTAMPTZ,
  created_by    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The only hot lookup: resolve a token that has not been used yet.
CREATE INDEX IF NOT EXISTS idx_doctor_form_links_open
  ON doctor_form_links (token) WHERE submitted_at IS NULL;

CREATE TABLE IF NOT EXISTS doctor_submissions (
  id             BIGSERIAL PRIMARY KEY,
  -- CASCADE: deleting a lead from the dashboard is a permanent delete of both
  -- halves, which is the requested behaviour.
  link_id        BIGINT REFERENCES doctor_form_links(id) ON DELETE CASCADE,

  -- ---- lead (the person who filled it in / whom we billed) ----
  client_name    TEXT NOT NULL,
  client_phone   TEXT NOT NULL,
  client_email   TEXT,

  -- ---- flat copies of the fields the list and the search need ----
  -- Everything else lives in `data`; these exist so the admin list can render
  -- and search without unpacking JSONB on every row.
  doctor_name_bn TEXT,
  doctor_name_en TEXT,
  hospital_bn    TEXT,
  specialty_bn   TEXT,
  district_bn    TEXT,
  area_bn        TEXT,
  serial_phone   TEXT,
  fee            INTEGER NOT NULL DEFAULT 0,
  owner_email    TEXT,

  -- ---- images (Cloudflare R2, same pipeline as the admin forms) ----
  photo_key        TEXT,
  photo_url        TEXT,
  share_image_key  TEXT,
  share_image_url  TEXT,

  -- The complete submitted payload: bilingual fields, schedule entries in the
  -- exact { days, time } shape chambers.schedule uses, and social profiles.
  data           JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Light forensics for abuse triage. Never shown to the client.
  ip             TEXT,
  user_agent     TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_doctor_submissions_created
  ON doctor_submissions (created_at DESC);
