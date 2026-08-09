-- District-scoped FAQs.
--
-- `faq_scope` already covered home / specialty / area / hospital / doctor, so
-- every landing page on the site could carry an FAQ block (and the FAQPage
-- JSON-LD that rides along with it) EXCEPT the district listing —
-- /districts/<slug>/doctors. That is the page targeting the highest-volume
-- query pattern on the site ("doctor in <district>"), and it was the only hub
-- with no way to add supporting content at all.
--
-- Adding the enum value is the whole change: `faqs.ref_id` already points at
-- whichever table the scope names, so a district FAQ is just ref_id ->
-- districts.id, exactly like an area FAQ is ref_id -> areas.id.
--
-- ALTER TYPE ... ADD VALUE is allowed inside a transaction from PostgreSQL 12
-- onward as long as the new value is not USED in the same transaction — this
-- file only declares it, so the setup script's BEGIN/COMMIT wrapper is fine.
-- IF NOT EXISTS keeps the file safe to re-apply against a drifted ledger.

ALTER TYPE faq_scope ADD VALUE IF NOT EXISTS 'district';
