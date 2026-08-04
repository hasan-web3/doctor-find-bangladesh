-- Drop the dead `doctors.featured` flag.
--
-- It was a single site-wide boolean that promoted a doctor everywhere at once.
-- Migration 009 replaced it with `district_doctor_priority`, which expresses
-- the same intent per district AND in a chosen order, and the paid window now
-- lives on the `promotions` row that drives it.
--
-- Safe to drop: after this change nothing in the application reads or writes
-- the column. Sponsorship history is NOT lost — every payment, plan, amount
-- and date range stays in `promotions`, which this migration does not touch.
-- The column only ever held a derived true/false recomputed from those rows.
--
-- The index goes first: dropping the column would take it along anyway, but
-- naming it here keeps the intent obvious to anyone reading the history.
-- Re-runnable: both statements are IF EXISTS.

DROP INDEX IF EXISTS idx_doctors_flags;

ALTER TABLE doctors DROP COLUMN IF EXISTS featured;
