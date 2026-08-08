-- Optional email address on contact-form leads.
--
-- The contact form asks for name, phone and message (all required) plus an
-- OPTIONAL email. When the visitor gives one we send them an automatic Bangla
-- confirmation, so the address has to be stored alongside the lead rather than
-- only passed through to the mailer — support staff replying later need it too.
--
-- Nullable on purpose: the field is optional on the form and every historic row
-- predates it. IF NOT EXISTS keeps this safe to re-run.
ALTER TABLE leads ADD COLUMN IF NOT EXISTS email TEXT;
