-- Normalise bmdc_valid_till to the last day of its month.
--
-- Migration 020 introduced the column as a full date, and the admin form asked
-- for a day. But BMDC's own register publishes validity at MONTH precision
-- ("Reg. Valid Till 07/2029"), so a day was a precision the source never gave
-- us, and admins had to invent one. The form now asks for the month only.
--
-- The column stays a `date` and now holds the LAST day of the month, because
-- "valid till 07/2029" means valid THROUGH July. Rows entered under the old
-- form hold whatever day was typed, which would retire a badge early: a row
-- saved as 2029-07-15 would read as expired for the second half of a month the
-- register still considers valid.
--
-- date_trunc to the first of the month, add a month, subtract a day. That is
-- the last day of the original month with no special cases for February or for
-- 30 vs 31 day months.
--
-- Idempotent: a value already sitting on its month end maps to itself, so
-- re-running changes nothing. The WHERE clause keeps it to the rows that
-- actually move.

UPDATE doctors
SET bmdc_valid_till =
      (date_trunc('month', bmdc_valid_till) + INTERVAL '1 month - 1 day')::date
WHERE bmdc_valid_till IS NOT NULL
  AND bmdc_valid_till
      <> (date_trunc('month', bmdc_valid_till) + INTERVAL '1 month - 1 day')::date;
