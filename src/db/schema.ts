// Drizzle schema for DoctorBondhu.
// Mirrors migrations/001_init.sql exactly so pg_dump remains portable.
// All human-readable content is JSONB {"bn","en"}; ML type comes from lib/utils.

import { relations, sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  boolean,
  check,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import type { ML } from "@/lib/utils";

// ------------- enums -------------
export const appointmentStatus = pgEnum("appointment_status", ["new", "confirmed", "completed", "cancelled"]);
export const promotionPlan = pgEnum("promotion_plan", ["basic", "featured", "premium"]);
export const promotionStatus = pgEnum("promotion_status", ["active", "expired", "cancelled"]);
export const leadType = pgEnum("lead_type", ["patient", "doctor"]);
export const leadStatus = pgEnum("lead_status", ["new", "in_progress", "resolved"]);
export const faqScope = pgEnum("faq_scope", ["home", "specialty", "area", "hospital", "doctor"]);
export const adminRole = pgEnum("admin_role", ["super_admin", "admin", "editor"]);

// ------------- helpers -------------
const mlEmpty = sql`'{}'::jsonb`;
const mlListEmpty = sql`'[]'::jsonb`;
const districtDefault = sql`'{"bn":"খুলনা","en":"Khulna"}'::jsonb`;

// ------------- core auth -------------
export const adminUsers = pgTable("admin_users", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: adminRole("role").notNull().default("admin"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ------------- site settings -------------
export const siteSettings = pgTable("site_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").$type<unknown>().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ------------- taxonomy -------------
export const specialties = pgTable("specialties", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  slug: text("slug").notNull().unique(),
  name: jsonb("name").$type<ML>().notNull(),
  icon: text("icon").notNull().default("activity"),
  tint: smallint("tint").notNull().default(0),
  intro: jsonb("intro").$type<ML>().notNull().default(mlEmpty),
  metaTitle: jsonb("meta_title").$type<ML>().notNull().default(mlEmpty),
  metaDescription: jsonb("meta_description").$type<ML>().notNull().default(mlEmpty),
  active: boolean("active").notNull().default(true),
  sort: integer("sort").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Districts are first-class since v2 so the admin can maintain them and
// area lookups cascade district → area.
export const districts = pgTable(
  "districts",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    slug: text("slug").notNull().unique(),
    name: jsonb("name").$type<ML>().notNull(),
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
    intro: jsonb("intro").$type<ML>().notNull().default(mlEmpty),
    metaTitle: jsonb("meta_title").$type<ML>().notNull().default(mlEmpty),
    metaDescription: jsonb("meta_description").$type<ML>().notNull().default(mlEmpty),
    active: boolean("active").notNull().default(true),
    sort: integer("sort").notNull().default(0),
    // Master switch for the district's curated doctor order. Off => the whole
    // district falls back to normal geo ranking even if rows exist in
    // district_doctor_priority, so an order can be paused without losing it.
    priorityEnabled: boolean("priority_enabled").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ activeIdx: index("idx_districts_active").on(t.active, t.sort) })
);

export const areas = pgTable(
  "areas",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    slug: text("slug").notNull().unique(),
    name: jsonb("name").$type<ML>().notNull(),
    // district JSONB kept for backwards compatibility during transition; new writes
    // populate district_id and read paths join through it.
    district: jsonb("district").$type<ML>().notNull().default(districtDefault),
    districtId: bigint("district_id", { mode: "number" }).references(() => districts.id, { onDelete: "set null" }),
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
    intro: jsonb("intro").$type<ML>().notNull().default(mlEmpty),
    metaTitle: jsonb("meta_title").$type<ML>().notNull().default(mlEmpty),
    metaDescription: jsonb("meta_description").$type<ML>().notNull().default(mlEmpty),
    active: boolean("active").notNull().default(true),
    sort: integer("sort").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ districtIdx: index("idx_areas_district").on(t.districtId) })
);

// ------------- hospitals -------------
export type GalleryItem = { key: string; url: string };

// Physician social profiles used to emit `sameAs` in the Physician JSON-LD
// (E-E-A-T + Knowledge Panel eligibility). All fields optional; only non-empty
// https URLs get serialized to schema.org sameAs.
export type SocialLinks = {
  website?: string;
  linkedin?: string;
  facebook?: string;
  twitter?: string;
  instagram?: string;
  youtube?: string;
  researchgate?: string;
};

export const hospitals = pgTable("hospitals", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  slug: text("slug").notNull().unique(),
  name: jsonb("name").$type<ML>().notNull(),
  areaId: bigint("area_id", { mode: "number" }).references(() => areas.id, { onDelete: "set null" }),
  address: jsonb("address").$type<ML>().notNull().default(mlEmpty),
  phone: text("phone"),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  description: jsonb("description").$type<ML>().notNull().default(mlEmpty),
  departments: jsonb("departments").$type<ML[]>().notNull().default(mlListEmpty),
  mapUrl: text("map_url"),
  imageKey: text("image_key"),
  imageUrl: text("image_url"),
  gallery: jsonb("gallery").$type<GalleryItem[]>().notNull().default(mlListEmpty),
  metaTitle: jsonb("meta_title").$type<ML>().notNull().default(mlEmpty),
  metaDescription: jsonb("meta_description").$type<ML>().notNull().default(mlEmpty),
  active: boolean("active").notNull().default(true),
  sort: integer("sort").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ------------- doctors -------------
export const doctors = pgTable(
  "doctors",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    slug: text("slug").notNull().unique(),
    name: jsonb("name").$type<ML>().notNull(),
    degrees: jsonb("degrees").$type<ML>().notNull().default(mlEmpty),
    bio: jsonb("bio").$type<ML>().notNull().default(mlEmpty),
    gender: text("gender"),
    experienceYears: integer("experience_years"),
    patientsServed: jsonb("patients_served").$type<ML>().notNull().default(mlEmpty),
    // Bilingual list of conditions this doctor treats — rendered on the
    // public profile as a checkbox list. Shape: { bn: string[], en: string[] }.
    // Each locale's array is independent (counts may differ).
    treatedConditions: jsonb("treated_conditions").$type<{ bn?: string[]; en?: string[] }>().notNull().default(sql`'{}'::jsonb`),
    // Free-text specialties that belong to THIS doctor only — never added to
    // the shared `specialties` taxonomy, so they get no page, no filter entry
    // and never appear in another doctor's picker. Rendered on the public
    // profile as plain text beside the linked specialties.
    // See migrations/011_doctor_custom_specialties.sql.
    customSpecialties: jsonb("custom_specialties").$type<ML[]>().notNull().default(mlListEmpty),
    // Primary hospital affiliation (v2). Chambers stay independent physical locations.
    hospitalId: bigint("hospital_id", { mode: "number" }).references(() => hospitals.id, { onDelete: "set null" }),
    photoKey: text("photo_key"),
    photoUrl: text("photo_url"),
    verified: boolean("verified").notNull().default(false),
    active: boolean("active").notNull().default(true),
    metaTitle: jsonb("meta_title").$type<ML>().notNull().default(mlEmpty),
    metaDescription: jsonb("meta_description").$type<ML>().notNull().default(mlEmpty),
    // Physician social profiles → `sameAs` in JSON-LD for Knowledge Panel
    // eligibility. See SocialLinks type for the shape.
    socialLinks: jsonb("social_links").$type<SocialLinks>().notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    genderCk: check("doctors_gender_check", sql`${t.gender} IN ('male', 'female', 'other')`),
    hospitalIdx: index("idx_doctors_hospital").on(t.hospitalId),
  })
);

// Curated "these doctors first, in this order" list, scoped to one district.
// Replaces the old site-wide `doctors.featured` ranking tier, which could not
// say anything district-specific. See migrations/009_doctor_priority.sql.
export const districtDoctorPriority = pgTable(
  "district_doctor_priority",
  {
    districtId: bigint("district_id", { mode: "number" }).notNull().references(() => districts.id, { onDelete: "cascade" }),
    doctorId: bigint("doctor_id", { mode: "number" }).notNull().references(() => doctors.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
    // Per-doctor switch, so one entry can be parked without dragging it out of
    // the list and re-adding it later.
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.districtId, t.doctorId] }),
    positionIdx: index("idx_ddp_district_position").on(t.districtId, t.position),
    doctorIdx: index("idx_ddp_doctor").on(t.doctorId),
  })
);

export const doctorSpecialties = pgTable(
  "doctor_specialties",
  {
    doctorId: bigint("doctor_id", { mode: "number" }).notNull().references(() => doctors.id, { onDelete: "cascade" }),
    specialtyId: bigint("specialty_id", { mode: "number" }).notNull().references(() => specialties.id, { onDelete: "cascade" }),
    isPrimary: boolean("is_primary").notNull().default(false),
  },
  (t) => ({ pk: primaryKey({ columns: [t.doctorId, t.specialtyId] }) })
);

export type ChamberSchedule = { days: ML; time: ML };

export const chambers = pgTable(
  "chambers",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    doctorId: bigint("doctor_id", { mode: "number" }).notNull().references(() => doctors.id, { onDelete: "cascade" }),
    // Hospital moved to doctors.hospital_id in v2. Chambers are pure physical rooms + schedule.
    name: jsonb("name").$type<ML>().notNull(),
    address: jsonb("address").$type<ML>().notNull().default(mlEmpty),
    areaId: bigint("area_id", { mode: "number" }).references(() => areas.id, { onDelete: "set null" }),
    // The admin picks a district first, then a thana inside it. Stored in its
    // own column instead of being re-derived from `areaId` so a chamber with a
    // district but no thana yet still has a place. Kept in sync on save: when a
    // thana IS chosen, this mirrors that thana's district.
    districtId: bigint("district_id", { mode: "number" }).references(() => districts.id, { onDelete: "set null" }),
    // Free-text thana for this chamber only — never joins the `areas` taxonomy.
    // Wins over the linked area for display. See migration 012.
    customArea: jsonb("custom_area").$type<ML>().notNull().default(mlEmpty),
    fee: integer("fee").notNull().default(0),
    schedule: jsonb("schedule").$type<ChamberSchedule[]>().notNull().default(mlListEmpty),
    phone: text("phone"),
    // Per-chamber appointment-email routing (migration 014). Each chamber owns
    // its own sender/recipients, so editing one never affects another.
    // `bccEmail` is comma separated and also decides whether a booking is
    // written to the database at all — see submitAppointment.
    ownerEmail: text("owner_email"),
    bccEmail: text("bcc_email"),
    fromEmail: text("from_email"),
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
    mapUrl: text("map_url"),
    // Public-visibility toggle. New chambers start hidden (form default) so
    // an admin can finish setting up before exposing; existing rows keep the
    // pre-migration behavior (default true) so nothing goes dark on deploy.
    visible: boolean("visible").notNull().default(true),
    sort: integer("sort").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    doctorIdx: index("idx_chambers_doctor").on(t.doctorId),
    areaIdx: index("idx_chambers_area").on(t.areaId),
    districtIdx: index("idx_chambers_district").on(t.districtId),
  })
);

// ------------- appointments -------------
export const appointments = pgTable(
  "appointments",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    serialNo: text("serial_no").notNull().unique(),
    doctorId: bigint("doctor_id", { mode: "number" }).notNull().references(() => doctors.id, { onDelete: "cascade" }),
    chamberId: bigint("chamber_id", { mode: "number" }).references(() => chambers.id, { onDelete: "set null" }),
    patientName: text("patient_name").notNull(),
    phone: text("phone").notNull(),
    // Optional: only when the patient supplied one on the booking form.
    email: text("email"),
    age: text("age"),
    problem: text("problem"),
    visitDate: date("visit_date").notNull(),
    timeSlot: text("time_slot").notNull(),
    status: appointmentStatus("status").notNull().default("new"),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    doctorIdx: index("idx_appointments_doctor").on(t.doctorId),
    statusIdx: index("idx_appointments_status").on(t.status),
    dateIdx: index("idx_appointments_date").on(t.visitDate),
  })
);

// ------------- promotions / payments -------------
export const promotions = pgTable(
  "promotions",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    doctorId: bigint("doctor_id", { mode: "number" }).notNull().references(() => doctors.id, { onDelete: "cascade" }),
    plan: promotionPlan("plan").notNull(),
    amount: integer("amount").notNull().default(0),
    startsOn: date("starts_on").notNull(),
    endsOn: date("ends_on").notNull(),
    status: promotionStatus("status").notNull().default("active"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    doctorIdx: index("idx_promotions_doctor").on(t.doctorId),
    statusIdx: index("idx_promotions_status").on(t.status, t.endsOn),
  })
);

// ------------- leads -------------
export const leads = pgTable(
  "leads",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    type: leadType("type").notNull(),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    // Optional: the contact form only asks for it so we can send the visitor a
    // confirmation. Null for every lead created before migration 013.
    email: text("email"),
    message: text("message"),
    extra: jsonb("extra").$type<Record<string, unknown>>().notNull().default(mlEmpty),
    status: leadStatus("status").notNull().default("new"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ statusIdx: index("idx_leads_status").on(t.status) })
);

// ------------- doctor intake forms -------------
// One-time links the admin generates and sends to a paying doctor, plus the
// forms those links produce. See migrations/015_doctor_intake_forms.sql for the
// reasoning behind the two-table split and the single-use claim.
export const doctorFormLinks = pgTable(
  "doctor_form_links",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    // 32 random URL-safe bytes — the page has no login, so this IS the credential.
    token: text("token").notNull().unique(),
    clientName: text("client_name").notNull(),
    clientPhone: text("client_phone").notNull(),
    // The address the link was emailed to; null when it was only saved and
    // shared over WhatsApp / Messenger instead.
    clientEmail: text("client_email"),
    fromEmail: text("from_email"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    // Null => still open. Set exactly once, by the atomic claim in
    // submitDoctorIntake, which is what makes the link single-use.
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    openIdx: index("idx_doctor_form_links_open").on(t.token).where(sql`${t.submittedAt} IS NULL`),
  })
);

// Only the doctor's NAME is bilingual. Every other text field takes whichever
// language the client is comfortable in (see migration 016) — the admin fills in
// the second language when they turn this into a real profile.
export type DoctorSubmissionData = {
  name?: ML;
  degrees?: string;
  bio?: string;
  gender?: string;
  experience_years?: number | null;
  patients_served?: string;
  /** One condition per line. */
  treated_conditions?: string;
  hospital?: string;
  specialty?: string;
  chamber_name?: string;
  address?: string;
  district?: string;
  area?: string;
  fee?: number;
  serial_phone?: string;
  owner_email?: string;
  map_url?: string;
  /** Same { days, time } shape as chambers.schedule, straight from the picker. */
  schedule?: ChamberSchedule[];
  social_links?: SocialLinks;
};

export const doctorSubmissions = pgTable(
  "doctor_submissions",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    linkId: bigint("link_id", { mode: "number" }).references(() => doctorFormLinks.id, { onDelete: "cascade" }),
    // Copied off the link rather than joined: the lead has to stay readable and
    // searchable as one row.
    clientName: text("client_name").notNull(),
    clientPhone: text("client_phone").notNull(),
    clientEmail: text("client_email"),
    // Flattened for the list + search only; `data` is the source of truth.
    doctorNameBn: text("doctor_name_bn"),
    doctorNameEn: text("doctor_name_en"),
    hospital: text("hospital"),
    specialty: text("specialty"),
    district: text("district"),
    area: text("area"),
    serialPhone: text("serial_phone"),
    fee: integer("fee").notNull().default(0),
    ownerEmail: text("owner_email"),
    photoKey: text("photo_key"),
    photoUrl: text("photo_url"),
    data: jsonb("data").$type<DoctorSubmissionData>().notNull().default(mlEmpty),
    ip: text("ip"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ createdIdx: index("idx_doctor_submissions_created").on(t.createdAt.desc()) })
);

// ------------- blog -------------
export const blogCategories = pgTable("blog_categories", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  slug: text("slug").notNull().unique(),
  name: jsonb("name").$type<ML>().notNull(),
  sort: integer("sort").notNull().default(0),
});

export const blogPosts = pgTable(
  "blog_posts",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    slug: text("slug").notNull().unique(),
    title: jsonb("title").$type<ML>().notNull(),
    excerpt: jsonb("excerpt").$type<ML>().notNull().default(mlEmpty),
    content: jsonb("content").$type<ML>().notNull().default(mlEmpty),
    categoryId: bigint("category_id", { mode: "number" }).references(() => blogCategories.id, { onDelete: "set null" }),
    coverKey: text("cover_key"),
    coverUrl: text("cover_url"),
    published: boolean("published").notNull().default(false),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    metaTitle: jsonb("meta_title").$type<ML>().notNull().default(mlEmpty),
    metaDescription: jsonb("meta_description").$type<ML>().notNull().default(mlEmpty),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ publishedIdx: index("idx_blog_published").on(t.published, t.publishedAt) })
);

// ------------- reviews -------------
export const reviews = pgTable(
  "reviews",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    doctorId: bigint("doctor_id", { mode: "number" }).notNull().references(() => doctors.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    areaText: text("area_text"),
    body: text("body"),
    published: boolean("published").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    doctorIdx: index("idx_reviews_doctor").on(t.doctorId, t.published),
  })
);

// ------------- homepage content -------------
export const heroSlides = pgTable("hero_slides", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  title: jsonb("title").$type<ML>().notNull(),
  text: jsonb("text").$type<ML>().notNull().default(mlEmpty),
  icon: text("icon").notNull().default("shield"),
  ctaLabel: jsonb("cta_label").$type<ML>().notNull().default(mlEmpty),
  ctaHref: text("cta_href"),
  imageKey: text("image_key"),
  imageUrl: text("image_url"),
  sort: integer("sort").notNull().default(0),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const faqs = pgTable(
  "faqs",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    scope: faqScope("scope").notNull().default("home"),
    refId: bigint("ref_id", { mode: "number" }),
    question: jsonb("question").$type<ML>().notNull(),
    answer: jsonb("answer").$type<ML>().notNull(),
    sort: integer("sort").notNull().default(0),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ scopeIdx: index("idx_faqs_scope").on(t.scope, t.refId, t.active) })
);

export const testimonials = pgTable("testimonials", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  name: text("name").notNull(),
  areaText: jsonb("area_text").$type<ML>().notNull().default(mlEmpty),
  quote: jsonb("quote").$type<ML>().notNull(),
  photoKey: text("photo_key"),
  photoUrl: text("photo_url"),
  published: boolean("published").notNull().default(true),
  sort: integer("sort").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ------------- static pages (Privacy, Terms, etc.) -------------
// Slug-keyed table for editable legal / info pages. Slugs are set by seed
// (`privacy`, `terms`, `about`) and matched by the public route. Content is
// sanitized HTML from the rich-text editor.
export const staticPages = pgTable("static_pages", {
  slug: text("slug").primaryKey(),
  title: jsonb("title").$type<ML>().notNull().default(mlEmpty),
  metaDescription: jsonb("meta_description").$type<ML>().notNull().default(mlEmpty),
  content: jsonb("content").$type<ML>().notNull().default(mlEmpty),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ------------- SEO -------------
export const seoOverrides = pgTable("seo_overrides", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  path: text("path").notNull().unique(),
  metaTitle: jsonb("meta_title").$type<ML>().notNull().default(mlEmpty),
  metaDescription: jsonb("meta_description").$type<ML>().notNull().default(mlEmpty),
  ogImageUrl: text("og_image_url"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const redirects = pgTable("redirects", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  fromPath: text("from_path").notNull().unique(),
  toPath: text("to_path").notNull(),
  permanent: boolean("permanent").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ------------- integrations -------------
export const integrations = pgTable("integrations", {
  key: text("key").primaryKey(),
  enabled: boolean("enabled").notNull().default(false),
  configCipher: text("config_cipher"),
  status: text("status").notNull().default("never"),
  statusMessage: text("status_message"),
  lastTestedAt: timestamp("last_tested_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ------------- admin notifications -------------
// Unread badge feed for the dashboard. `panel` is the /admin route segment that
// owns the row, so the sidebar can group unread counts by it and clear one
// panel with a single UPDATE. `source` records which panel the write came from
// — when it equals `panel` no row is written at all (see lib/notify.ts), since
// an admin adding a hospital from the hospital dashboard needs no telling.
export const notifications = pgTable(
  "notifications",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    panel: text("panel").notNull(),
    kind: text("kind").notNull(),
    entityId: text("entity_id"),
    title: jsonb("title").$type<ML>().notNull().default(mlEmpty),
    body: jsonb("body").$type<ML>().notNull().default(mlEmpty),
    href: text("href"),
    source: text("source"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    // Partial index — only unread rows are ever counted.
    unreadIdx: index("idx_notifications_unread").on(t.panel).where(sql`${t.readAt} IS NULL`),
    createdIdx: index("idx_notifications_created").on(t.createdAt.desc()),
  })
);

// ------------- audit log -------------
export const auditLog = pgTable(
  "audit_log",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    actorId: bigint("actor_id", { mode: "number" }),
    actorName: text("actor_name"),
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    entityId: text("entity_id"),
    details: jsonb("details").$type<Record<string, unknown>>().notNull().default(mlEmpty),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ createdIdx: index("idx_audit_created").on(t.createdAt) })
);

// ============ relations (for query.with() API) ============
export const doctorsRelations = relations(doctors, ({ one, many }) => ({
  hospital: one(hospitals, { fields: [doctors.hospitalId], references: [hospitals.id] }),
  specialties: many(doctorSpecialties),
  chambers: many(chambers),
  reviews: many(reviews),
  appointments: many(appointments),
  promotions: many(promotions),
}));

export const districtsRelations = relations(districts, ({ many }) => ({
  areas: many(areas),
}));

export const specialtiesRelations = relations(specialties, ({ many }) => ({
  doctors: many(doctorSpecialties),
}));

export const doctorSpecialtiesRelations = relations(doctorSpecialties, ({ one }) => ({
  doctor: one(doctors, { fields: [doctorSpecialties.doctorId], references: [doctors.id] }),
  specialty: one(specialties, { fields: [doctorSpecialties.specialtyId], references: [specialties.id] }),
}));

export const areasRelations = relations(areas, ({ one, many }) => ({
  district: one(districts, { fields: [areas.districtId], references: [districts.id] }),
  chambers: many(chambers),
  hospitals: many(hospitals),
}));

export const hospitalsRelations = relations(hospitals, ({ one, many }) => ({
  area: one(areas, { fields: [hospitals.areaId], references: [areas.id] }),
  doctors: many(doctors),
  chambers: many(chambers),
}));

export const chambersRelations = relations(chambers, ({ one }) => ({
  doctor: one(doctors, { fields: [chambers.doctorId], references: [doctors.id] }),
  area: one(areas, { fields: [chambers.areaId], references: [areas.id] }),
}));

export const reviewsRelations = relations(reviews, ({ one }) => ({
  doctor: one(doctors, { fields: [reviews.doctorId], references: [doctors.id] }),
}));

export const appointmentsRelations = relations(appointments, ({ one }) => ({
  doctor: one(doctors, { fields: [appointments.doctorId], references: [doctors.id] }),
  chamber: one(chambers, { fields: [appointments.chamberId], references: [chambers.id] }),
}));

export const promotionsRelations = relations(promotions, ({ one }) => ({
  doctor: one(doctors, { fields: [promotions.doctorId], references: [doctors.id] }),
}));

export const blogPostsRelations = relations(blogPosts, ({ one }) => ({
  category: one(blogCategories, { fields: [blogPosts.categoryId], references: [blogCategories.id] }),
}));

export const blogCategoriesRelations = relations(blogCategories, ({ many }) => ({
  posts: many(blogPosts),
}));

// ============ inferred types (single source of truth) ============
export type AdminUser = typeof adminUsers.$inferSelect;
export type Specialty = typeof specialties.$inferSelect;
export type Area = typeof areas.$inferSelect;
export type District = typeof districts.$inferSelect;
export type Hospital = typeof hospitals.$inferSelect;
export type Doctor = typeof doctors.$inferSelect;
export type Chamber = typeof chambers.$inferSelect;
export type Appointment = typeof appointments.$inferSelect;
export type Promotion = typeof promotions.$inferSelect;
export type Lead = typeof leads.$inferSelect;
export type BlogPost = typeof blogPosts.$inferSelect;
export type BlogCategory = typeof blogCategories.$inferSelect;
export type Review = typeof reviews.$inferSelect;
export type HeroSlide = typeof heroSlides.$inferSelect;
export type Faq = typeof faqs.$inferSelect;
export type Testimonial = typeof testimonials.$inferSelect;
export type SeoOverride = typeof seoOverrides.$inferSelect;
export type Redirect = typeof redirects.$inferSelect;
export type StaticPage = typeof staticPages.$inferSelect;
export type Integration = typeof integrations.$inferSelect;
export type AuditEntry = typeof auditLog.$inferSelect;
export type NotificationRow = typeof notifications.$inferSelect;
export type DoctorFormLink = typeof doctorFormLinks.$inferSelect;
export type DoctorSubmission = typeof doctorSubmissions.$inferSelect;
export type SiteSetting = typeof siteSettings.$inferSelect;
