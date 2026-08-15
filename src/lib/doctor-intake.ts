// Shape of the client-facing doctor intake form.
//
// Deliberately free of `server-only` and of zod: the public form component
// imports the draft type and the empty factory, and neither should drag a
// validator into the browser bundle. The zod schema that validates a submission
// lives next to the server action in src/actions/doctor-intake.ts.
//
// Field rules, straight from how the listing is sold:
//   • The doctor's NAME is the only bilingual field, and both halves are
//     required: it is the heading of the profile on both locale pages.
//   • Everything else takes ONE value in whichever language the client prefers.
//     Asking a chamber assistant to translate seven fields on a phone produced
//     half-filled pairs; one good answer plus the admin's own translation at
//     profile-build time is strictly better.
//   • Experience, patients served, chamber owner email, map URL and the social
//     profiles are optional.
//   • The profile photo is required — a profile with no face does not convert.

import type { ML } from "@/lib/utils";
import type { SocialLinksDraft } from "@/lib/utils";
import { emptyML, EMPTY_SOCIAL_LINKS } from "@/lib/utils";

/** Same { days, time } pair chambers.schedule stores, produced by ScheduleDayPicker. */
export type IntakeSchedule = { days: ML; time: ML };

export type DoctorIntakeDraft = {
  name: ML;
  degrees: string;
  bio: string;
  gender: "" | "male" | "female" | "other";
  /** Kept as a string so the input can be empty; coerced on the server. */
  experience_years: string;
  patients_served: string;
  /**
   * BMDC registration number, as the doctor writes it.
   *
   * A CLAIM, not a verification. Nothing the doctor types here can switch on
   * the public BMDC badge by itself: the admin looks the number up on
   * verify.bmdc.org.bd and sets the badge from the admin form. This field only
   * saves them hunting for the number later. See src/lib/bmdc.ts.
   */
  bmdc_no: string;
  /** One condition per line. */
  treated_conditions: string;
  hospital: string;
  specialty: string;
  chamber_name: string;
  address: string;
  district: string;
  /** Town / village / thana. */
  area: string;
  fee: string;
  serial_phone: string;
  owner_email: string;
  map_url: string;
  schedule: IntakeSchedule[];
  social_links: SocialLinksDraft;
};

export const EMPTY_INTAKE_DRAFT = (): DoctorIntakeDraft => ({
  name: { ...emptyML },
  degrees: "",
  bio: "",
  gender: "",
  experience_years: "",
  patients_served: "",
  bmdc_no: "",
  treated_conditions: "",
  hospital: "",
  specialty: "",
  chamber_name: "",
  address: "",
  district: "",
  area: "",
  fee: "",
  serial_phone: "",
  owner_email: "",
  map_url: "",
  schedule: [],
  social_links: EMPTY_SOCIAL_LINKS(),
});

/** What the public form posts. The photo travels as a compressed data URL. */
export type DoctorIntakePayload = {
  token: string;
  draft: DoctorIntakeDraft;
  photo_data?: string;
  /** reCAPTCHA v3 token, empty when the integration is off. */
  recaptcha_token?: string;
  /** Honeypot — must stay empty. Bots fill every input they can see. */
  trap?: string;
  /** Milliseconds the form was on screen before submit. Bots answer instantly. */
  elapsed_ms?: number;
};

export type IntakeResult = { ok: boolean; message: string };

/** Bangladeshi mobile numbers, normalised to 01XXXXXXXXX. Mirrors actions/public.ts. */
export function normalizeBdPhone(raw: string): string {
  let s = String(raw || "").replace(/[০-৯]/g, (d) => String("০১২৩৪৫৬৭৮৯".indexOf(d)));
  s = s.replace(/\D/g, "");
  if (s.startsWith("00880")) s = s.slice(4);
  else if (s.startsWith("880")) s = s.slice(2);
  if (s.length === 10 && s.startsWith("1")) s = "0" + s;
  return s;
}

/** Bangla digits in a number-ish string become Latin, so "১২০০" saves as 1200. */
export function toLatinDigits(raw: string): string {
  return String(raw || "").replace(/[০-৯]/g, (d) => String("০১২৩৪৫৬৭৮৯".indexOf(d)));
}
