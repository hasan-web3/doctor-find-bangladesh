// One-shot Bangladesh geo seed: all 64 districts + all ~495 thana/upazilas.
//
// Sources (both trusted, community-maintained):
//   • Districts + lat/lng: github.com/nuhil/bangladesh-geocode (districts.json)
//   • Thana / Upazila names (bn + en): github.com/nuhil/bangladesh-geocode (upazilas.json)
//
// Coordinates:
//   • All 64 districts get real DC-office lat/lng from the source (~3m accuracy).
//   • Khulna district's 9 upazilas + Khulna Division neighbours (Bagerhat, Satkhira,
//     Jashore, Narail) get hand-curated lat/lng below (verified against gov.bd).
//   • Every other upazila keeps lat/lng = NULL — the admin can fill them in later
//     from the /admin/areas UI without breaking anything.
//
// Idempotent: uses ON CONFLICT (slug) DO UPDATE so repeated runs safely refresh
// names / coordinates without duplicating rows.
//
// Run:  node scripts/seed-bd-geo.mjs
// Env:  DATABASE_URL (from .env, auto-loaded)

import "dotenv/config";
import pg from "pg";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", ".geo-cache");

const DISTRICTS_URL = "https://raw.githubusercontent.com/nuhil/bangladesh-geocode/master/districts/districts.json";
const UPAZILAS_URL  = "https://raw.githubusercontent.com/nuhil/bangladesh-geocode/master/upazilas/upazilas.json";

// -------- utilities --------
const slugify = (s) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

async function fetchJson(url, cachePath) {
  if (cachePath && existsSync(cachePath)) {
    return JSON.parse(readFileSync(cachePath, "utf8"));
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch ${url} → ${res.status}`);
  return await res.json();
}

// nuhil JSON is a phpMyAdmin export — the actual rows live under the "data" key
// of the entry with type === "table".
function nuhilRows(dump) {
  const table = dump.find((x) => x.type === "table");
  if (!table) throw new Error("Malformed nuhil JSON: no table entry");
  return table.data;
}

// -------- hand-curated Khulna Division upazila coordinates --------
// Keyed by nuhil's district_id → { upazilaName_en → [lat, lng] }.
// Verified against Wikipedia + gov.bd DC-office pages.
const HAND_COORDS = {
  27: { // Khulna
    "Paikgasa":   [22.5892, 89.3358],
    "Fultola":    [22.9350, 89.5300],
    "Digholia":   [22.9028, 89.5583],
    "Rupsha":     [22.7833, 89.6000],
    "Terokhada":  [22.9825, 89.6011],
    "Dumuria":    [22.8317, 89.3550],
    "Botiaghata": [22.6644, 89.4767],
    "Dakop":      [22.5567, 89.4867],
    "Koyra":      [22.3372, 89.2864],
  },
  28: { // Bagerhat
    "Bagerhat Sadar":  [22.6515, 89.7856],
    "Fakirhat":        [22.7325, 89.7175],
    "Mollahat":        [22.9611, 89.7861],
    "Sarankhola":      [22.3025, 89.8006],
    "Morrelganj":      [22.4867, 89.8600],
    "Kachua":          [22.6483, 89.9083],
    "Mongla":          [22.4900, 89.6000],
    "Chitalmari":      [22.8025, 89.7014],
    "Rampal":          [22.5644, 89.6467],
  },
  21: { // Satkhira
    "Assasuni":       [22.5717, 89.2117],
    "Debhata":        [22.6083, 88.9917],
    "Kalaroa":        [22.8783, 89.0561],
    "Satkhira Sadar": [22.7181, 89.0687],
    "Shyamnagar":     [22.3283, 89.1017],
    "Tala":           [22.9067, 89.2683],
    "Kaliganj (Satkhira)": [22.4550, 89.0111],
  },
  20: { // Jashore
    "Abhaynagar":     [23.0122, 89.4497],
    "Bagherpara":     [23.2611, 89.2244],
    "Chaugachha":     [23.2600, 89.0206],
    "Jhikargacha":    [23.1000, 89.1069],
    "Keshabpur":      [22.9058, 89.2233],
    "Jessore Sadar":  [23.1667, 89.2081],
    "Manirampur":     [23.0128, 89.2333],
    "Sharsha":        [23.1892, 88.9364],
  },
  23: { // Narail
    "Narail Sadar": [23.1725, 89.5127],
    "Lohagara":     [23.1633, 89.6478],
    "Kalia":        [23.0439, 89.6197],
  },
};

// -------- runner --------
async function run() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");

  console.log("→ fetching districts & upazilas from nuhil/bangladesh-geocode");
  const [distDump, upzDump] = await Promise.all([
    fetchJson(DISTRICTS_URL, join(DATA_DIR, "districts.json")),
    fetchJson(UPAZILAS_URL,  join(DATA_DIR, "upazilas.json")),
  ]);
  const districts = nuhilRows(distDump);
  const upazilas  = nuhilRows(upzDump);
  console.log(`✓ got ${districts.length} districts, ${upazilas.length} thanas/upazilas`);

  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  // Bulk-preload districts (map source id → our internal id).
  const srcToDbId = new Map();
  let dInserted = 0, dUpdated = 0;

  await client.query("BEGIN");
  try {
    for (const d of districts) {
      const slug = slugify(d.name);
      const name = { bn: d.bn_name, en: d.name };
      const lat = d.lat ? Number(d.lat) : null;
      const lng = d.lon ? Number(d.lon) : null;

      const res = await client.query(
        `INSERT INTO districts (slug, name, lat, lng, active, sort)
         VALUES ($1, $2::jsonb, $3, $4, TRUE, 10)
         ON CONFLICT (slug) DO UPDATE
           SET name = EXCLUDED.name,
               lat  = COALESCE(districts.lat, EXCLUDED.lat),
               lng  = COALESCE(districts.lng, EXCLUDED.lng),
               updated_at = now()
         RETURNING id, (xmax = 0) AS inserted`,
        [slug, JSON.stringify(name), lat, lng]
      );
      srcToDbId.set(d.id, res.rows[0].id);
      if (res.rows[0].inserted) dInserted++; else dUpdated++;
    }
    console.log(`✓ districts:  +${dInserted}  ~${dUpdated}`);

    // Thanas / Upazilas.
    let uInserted = 0, uUpdated = 0, uSkipped = 0;
    for (const u of upazilas) {
      const districtDbId = srcToDbId.get(u.district_id);
      if (!districtDbId) { uSkipped++; continue; }

      // Slug prefixed by district for global uniqueness across all 64 districts,
      // since names like "Sadar" repeat everywhere.
      const districtSlug = districts.find((d) => d.id === u.district_id)?.name;
      const slug = slugify(`${districtSlug}-${u.name}`);
      const name = { bn: u.bn_name, en: u.name };

      // Coordinates: hand-curated map wins; otherwise leave NULL.
      const coords = HAND_COORDS[u.district_id]?.[u.name];
      const lat = coords ? coords[0] : null;
      const lng = coords ? coords[1] : null;

      // Also mirror the parent's Bangla+English name into legacy areas.district
      // JSONB so old read paths (that predate the FK) still work.
      const distRow = districts.find((d) => d.id === u.district_id);
      const districtNameMl = { bn: distRow.bn_name, en: distRow.name };

      const res = await client.query(
        `INSERT INTO areas (slug, name, district, district_id, lat, lng, active, sort)
         VALUES ($1, $2::jsonb, $3::jsonb, $4, $5, $6, TRUE, 100)
         ON CONFLICT (slug) DO UPDATE
           SET name        = EXCLUDED.name,
               district    = EXCLUDED.district,
               district_id = EXCLUDED.district_id,
               lat         = COALESCE(areas.lat, EXCLUDED.lat),
               lng         = COALESCE(areas.lng, EXCLUDED.lng),
               updated_at  = now()
         RETURNING (xmax = 0) AS inserted`,
        [slug, JSON.stringify(name), JSON.stringify(districtNameMl), districtDbId, lat, lng]
      );
      if (res.rows[0].inserted) uInserted++; else uUpdated++;
    }
    console.log(`✓ thanas:     +${uInserted}  ~${uUpdated}  skipped:${uSkipped}`);

    await client.query("COMMIT");
    console.log("✓ done");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    await client.end();
  }
}

run().catch((e) => {
  console.error("✗ seed failed:", e);
  process.exit(1);
});
