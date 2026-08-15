-- BMDC registration as a second, stronger verification tier.
--
-- The site already had `doctors.verified`, which means "we checked this
-- profile's details". BMDC verification is a different and much stronger claim:
-- the doctor's registration was looked up on the Bangladesh Medical & Dental
-- Council's own register at https://verify.bmdc.org.bd and found valid. On a
-- medical directory that is a YMYL trust signal, so it gets its own flag rather
-- than being folded into the existing one.
--
-- THE TWO FLAGS ARE MUTUALLY EXCLUSIVE, and the constraint below is what makes
-- that true. The admin form also enforces it, but a form is a convenience, not
-- a guarantee: the intake pipeline and any future import would otherwise be
-- free to set both and leave the profile advertising two different badges.
--
-- Nullable, not defaulted:
--   bmdc_no          registration number exactly as printed on the register
--   bmdc_reg_year    year of first registration
--   bmdc_valid_till  the date the registration lapses; the admin list warns as
--                    it approaches, and the public badge is not a promise that
--                    outlives it
-- A doctor who is not BMDC-verified has all three NULL, which is why none of
-- them carry a default.

ALTER TABLE doctors
  ADD COLUMN IF NOT EXISTS bmdc_verified   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bmdc_no         text,
  ADD COLUMN IF NOT EXISTS bmdc_reg_year   integer,
  ADD COLUMN IF NOT EXISTS bmdc_valid_till date;

-- One badge or the other, never both. Written as NOT (a AND b) so that
-- "neither" stays legal: a profile still being researched has no badge at all.
ALTER TABLE doctors
  DROP CONSTRAINT IF EXISTS doctors_single_verification_check;
ALTER TABLE doctors
  ADD CONSTRAINT doctors_single_verification_check
  CHECK (NOT (verified AND bmdc_verified));

-- A BMDC badge with no number behind it is exactly the unfounded trust claim
-- this feature exists to avoid, so the number is required whenever the flag is
-- on. Applied as a separate constraint from the one above so a violation names
-- which rule was broken.
ALTER TABLE doctors
  DROP CONSTRAINT IF EXISTS doctors_bmdc_no_required_check;
ALTER TABLE doctors
  ADD CONSTRAINT doctors_bmdc_no_required_check
  CHECK (NOT bmdc_verified OR (bmdc_no IS NOT NULL AND length(btrim(bmdc_no)) > 0));

-- The admin list sorts and colours by expiry, and the public profile reads the
-- flag on every doctor page. Partial index: only BMDC-verified rows are ever
-- filtered on here, and they are the minority.
CREATE INDEX IF NOT EXISTS idx_doctors_bmdc_valid_till
  ON doctors (bmdc_valid_till)
  WHERE bmdc_verified;
