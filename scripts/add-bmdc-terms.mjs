// Append the BMDC verification section to the Terms page, in both languages.
//
// The terms copy is admin-editable content living in `static_pages`, not in the
// repo, so it cannot be changed by a migration or a code edit. This script is
// the equivalent for a one-off content addition.
//
// ADDITIVE AND IDEMPOTENT. It never rewrites or deletes existing copy: it
// inserts the new section immediately before the "Changes to these terms"
// heading (or appends it, if that heading has been renamed), and it exits
// without touching anything if the word BMDC already appears. Running it twice
// is a no-op, so it is safe to re-run after an admin has edited the page.
//
//   node scripts/add-bmdc-terms.mjs
//
// After it runs, open Admin > Static pages > Terms and press save once. The
// public page reads through unstable_cache tagged "static-pages", and only the
// admin save action purges that tag; a direct database write does not. Without
// the save the new section still appears, but not until the 24h ISR window
// expires.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const env = readFileSync(join(root, ".env"), "utf8");
const DATABASE_URL = env.match(/^DATABASE_URL\s*=\s*"?([^"\r\n]+)"?/m)?.[1];
if (!DATABASE_URL) {
  console.error("DATABASE_URL not found in .env");
  process.exit(1);
}

const VERIFY_URL = "https://verify.bmdc.org.bd";
const link = `<a href="${VERIFY_URL}" target="_blank" rel="noopener noreferrer nofollow">${VERIFY_URL}</a>`;

const SECTION = {
  bn: [
    "<h2>BMDC ভেরিফিকেশন</h2>",
    "<p>কোনো ডাক্তারের প্রোফাইলে “BMDC ভেরিফায়েড” ব্যাজ থাকার অর্থ হলো, আমরা তার বাংলাদেশ মেডিকেল অ্যান্ড ডেন্টাল কাউন্সিল (BMDC) রেজিস্ট্রেশন নম্বরটি কাউন্সিলের নিজস্ব রেজিস্টারে মিলিয়ে দেখেছি।</p>",
    "<p>আমরা যেভাবে যাচাই করি:</p>",
    "<ol>",
    "<li>ডাক্তার বা তার চেম্বার থেকে BMDC রেজিস্ট্রেশন নম্বরটি সংগ্রহ করা হয়।</li>",
    `<li>নম্বরটি BMDC এর অফিশিয়াল ভেরিফিকেশন সাইট ${link} এ খোঁজা হয়।</li>`,
    "<li>রেজিস্টারে থাকা নাম ও রেজিস্ট্রেশনের অবস্থা প্রোফাইলের তথ্যের সাথে মিলিয়ে দেখা হয়।</li>",
    "<li>সব মিলে গেলে তবেই প্রোফাইলে BMDC ভেরিফায়েড ব্যাজ যুক্ত হয়, এবং রেজিস্ট্রেশন নম্বর, রেজিস্ট্রেশনের বছর ও মেয়াদ প্রোফাইলে দেখানো হয়।</li>",
    "</ol>",
    "<p>এই ব্যাজ সম্পর্কে যা জানা জরুরি:</p>",
    "<ul>",
    "<li>ব্যাজটির অর্থ শুধু এটুকু যে যাচাইয়ের দিন রেজিস্ট্রেশনটি বৈধ ছিল। এটি ওই ডাক্তারের চিকিৎসার মান নিয়ে আমাদের কোনো মূল্যায়ন বা সুপারিশ নয়।</li>",
    `<li>BMDC রেজিস্টারের তথ্য যেকোনো সময় বদলাতে পারে। আমরা নিয়মিত হালনাগাদ করি, তবু সর্বশেষ অবস্থা জানতে আপনি নিজেই ${link} থেকে নম্বরটি দেখে নিতে পারেন।</li>`,
    "<li>একজন ডাক্তার একসাথে “ভেরিফায়েড” ও “BMDC ভেরিফায়েড” দুটি ব্যাজ পান না। BMDC ভেরিফায়েড ব্যাজটি বেশি শক্তিশালী, কারণ এটি কাউন্সিলের রেজিস্টারে মিলিয়ে দেখা।</li>",
    "<li>রেজিস্ট্রেশনের মেয়াদ শেষ হয়ে গেলে আমরা তথ্য হালনাগাদ করি। মেয়াদোত্তীর্ণ কোনো তথ্য চোখে পড়লে যোগাযোগ পেজ থেকে জানান।</li>",
    "<li>ডক্টরস ফাইন্ড বাংলাদেশ BMDC এর সাথে কোনোভাবে যুক্ত নয়। আমরা শুধু তাদের প্রকাশ্য রেজিস্টার ব্যবহার করে তথ্য মিলিয়ে দেখি।</li>",
    "</ul>",
  ].join(""),
  en: [
    "<h2>BMDC verification</h2>",
    "<p>A “BMDC Verified” badge on a doctor’s profile means we looked up their Bangladesh Medical &amp; Dental Council (BMDC) registration number on the Council’s own register.</p>",
    "<p>How we verify:</p>",
    "<ol>",
    "<li>We collect the BMDC registration number from the doctor or their chamber.</li>",
    `<li>We look that number up on BMDC’s official verification site, ${link}.</li>`,
    "<li>We match the name and registration status on the register against the profile.</li>",
    "<li>Only when they match does the profile get the BMDC Verified badge, and the registration number, registration year and validity date are shown on the profile.</li>",
    "</ol>",
    "<p>What this badge does and does not mean:</p>",
    "<ul>",
    "<li>It means only that the registration was valid on the day we checked it. It is not our assessment of, or a recommendation about, that doctor’s care.</li>",
    `<li>Entries on the BMDC register can change at any time. We update our records regularly, but you can always check the number yourself at ${link}.</li>`,
    "<li>A doctor never carries both the “Verified” and the “BMDC Verified” badge. BMDC Verified is the stronger of the two, because it was checked against the Council’s register.</li>",
    "<li>When a registration lapses we update our records. If you spot an out of date entry, please tell us through the contact page.</li>",
    "<li>Doctors Find Bangladesh is not affiliated with BMDC in any way. We only use their public register to check information.</li>",
    "</ul>",
  ].join(""),
};

// Insert before the "changes to these terms" heading so the new section reads
// as part of the body rather than trailing after the contact details. Falls
// back to appending when the heading has been renamed by an admin.
const ANCHOR = { bn: "<h2>শর্তাবলি পরিবর্তন</h2>", en: "<h2>Changes to these terms</h2>" };

function withSection(html, locale) {
  const body = html || "";
  const anchor = ANCHOR[locale];
  const at = body.indexOf(anchor);
  if (at === -1) return body + SECTION[locale];
  return body.slice(0, at) + SECTION[locale] + body.slice(at);
}

const client = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  const { rows } = await client.query("SELECT content FROM static_pages WHERE slug = 'terms'");
  if (rows.length === 0) {
    console.error("No 'terms' row in static_pages. Seed the page first.");
    process.exit(1);
  }
  const content = rows[0].content || {};

  if (/BMDC/i.test(JSON.stringify(content))) {
    console.log("• Terms already mention BMDC. Nothing to do.");
    process.exit(0);
  }

  const next = {
    ...content,
    bn: withSection(content.bn, "bn"),
    en: withSection(content.en, "en"),
  };

  await client.query(
    "UPDATE static_pages SET content = $1::jsonb, updated_at = now() WHERE slug = 'terms'",
    [JSON.stringify(next)]
  );

  console.log("✓ BMDC section added to the Terms page.");
  console.log(`  bn: ${(content.bn || "").length} -> ${next.bn.length} chars`);
  console.log(`  en: ${(content.en || "").length} -> ${next.en.length} chars`);
  console.log("  Next: open Admin > Static pages > Terms and press save once to purge the cache.");
} finally {
  await client.end();
}
