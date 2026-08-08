-- Per-chamber email routing for appointment notifications, plus an optional
-- patient email on the booking itself.
--
-- Every chamber owns its own sender, owner inbox and BCC list, so changing one
-- chamber never touches another. Defaults are applied to existing rows too, so
-- an admin who never opens the chamber form still gets notifications.
--
-- NOTE ON THE BCC DEFAULT: appointment persistence is now conditional — a
-- chamber WITH a BCC address is notified by email and the booking is not written
-- to the database (see submitAppointment). Backfilling this default therefore
-- switches existing chambers over to the email-only flow. Clear a chamber's BCC
-- to put it back on the dashboard.
ALTER TABLE chambers ADD COLUMN IF NOT EXISTS owner_email TEXT;
ALTER TABLE chambers ADD COLUMN IF NOT EXISTS bcc_email   TEXT DEFAULT 'hasan25042019@gmail.com';
ALTER TABLE chambers ADD COLUMN IF NOT EXISTS from_email  TEXT DEFAULT 'noreply@doctorsfindbd.com';

-- Optional: only set when the patient chose to give an address on the booking
-- form, and only stored when the booking is persisted at all.
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS email TEXT;
