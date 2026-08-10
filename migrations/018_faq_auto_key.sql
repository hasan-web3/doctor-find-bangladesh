-- Auto-generated FAQs.
--
-- Writing an FAQ block by hand for every district, thana, specialty, hospital
-- and doctor does not scale: the moment a new district gains its first doctor
-- it becomes indexable, and the one thing it needs most (supporting content)
-- is the one thing nobody has time to write.
--
-- So the default FAQs are no longer rows at all. They are GENERATED at render
-- time from the entity's own data (see src/lib/faq-defaults.ts), which means:
--   * nothing to seed, nothing to backfill, nothing to keep in sync
--   * a district that gains a doctor gets its FAQ block on the next
--     revalidation, and loses it again if the last doctor is removed
--   * the answers name the real thanas, specialties and hospitals of that
--     entity, so two districts never publish the same paragraph
--
-- This column is what lets the admin still edit and delete them. A generated
-- FAQ carries a stable `auto_key` ("fees", "areas", ...). Saving one from the
-- dashboard inserts a row with that key, which OVERRIDES the generated text;
-- deleting one inserts the same row with active = false, which SUPPRESSES it.
-- Rows with auto_key IS NULL are ordinary hand-written FAQs and behave exactly
-- as they always have.
--
-- The partial unique index keeps one override per key per entity while leaving
-- hand-written rows (auto_key NULL) unconstrained, since NULLs are excluded.

ALTER TABLE faqs
  ADD COLUMN IF NOT EXISTS auto_key text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_faqs_auto_key
  ON faqs (scope, ref_id, auto_key)
  WHERE auto_key IS NOT NULL;
