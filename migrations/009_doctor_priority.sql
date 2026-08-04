-- Per-district manual doctor ordering ("Doctors Priority").
--
-- Replaces the old `doctors.featured` ranking tier. Featured was a single
-- site-wide flag owned by the promotions module, so it could not express
-- "in Khulna show these five first, in this order" — which is what the
-- directory actually needs. Ordering is therefore stored per (district,
-- doctor) pair rather than on the doctor.
--
-- Two switches, deliberately:
--   • `districts.priority_enabled` — the master. Off means the whole district
--     falls back to the normal geo ranking, no matter what is pinned inside
--     it, so an admin can disable a curated order without losing it.
--   • `district_doctor_priority.enabled` — per doctor, so one entry can be
--     parked without being dragged out of the list and re-added later.
--
-- A doctor belongs to exactly one district on the public site (their first
-- visible chamber, falling back to their linked hospital), so a doctor cannot
-- meaningfully be pinned in two districts at once. The composite primary key
-- enforces one row per pair; nothing stops an admin curating a doctor into a
-- district they later move out of, and that row simply stops matching.
--
-- Re-runnable: every statement is guarded, so replaying this file on a
-- database that already has it is a no-op.

CREATE TABLE IF NOT EXISTS district_doctor_priority (
  district_id bigint      NOT NULL REFERENCES districts(id) ON DELETE CASCADE,
  doctor_id   bigint      NOT NULL REFERENCES doctors(id)   ON DELETE CASCADE,
  -- Rank within the district, ascending. Gaps are fine; the admin panel
  -- rewrites the whole block on save, so these stay dense in practice.
  position    integer     NOT NULL DEFAULT 0,
  enabled     boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (district_id, doctor_id)
);

-- The public ranking looks up "pinned doctors of district X in order" on every
-- doctor listing, and the admin panel reads the same slice.
CREATE INDEX IF NOT EXISTS idx_ddp_district_position
  ON district_doctor_priority (district_id, position);

-- Reverse direction: used when deleting a doctor and when resolving a single
-- doctor's pinned state.
CREATE INDEX IF NOT EXISTS idx_ddp_doctor
  ON district_doctor_priority (doctor_id);

ALTER TABLE districts
  ADD COLUMN IF NOT EXISTS priority_enabled boolean NOT NULL DEFAULT false;
