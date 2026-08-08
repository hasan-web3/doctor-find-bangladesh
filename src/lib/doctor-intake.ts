// Shape of the client-facing doctor intake form.
//
// Deliberately free of `server-only` and of zod: the public form component
// imports the draft type and the empty factory, and neither should drag a
// validator into the browser bundle. The zod schema that validates a submission
// lives next to the server action in src/actions/doctor-intake.ts.
//
// Field rules, straight from how the listing is sold:
//   • Names, hospital, specialty, chamber, address, district and thana are
//     BILINGUAL and both halves are required — every one of them prints on the
//     public profile in both locales.
//   • Degrees, bio and the treated-conditions list accept EITHER language, so
//     they are single fields; the label says so.
//   • Experience, patients served, chamber owner email, map URL, share image and
//     the social profiles are optional.
//   • The profile photo is required — a profile with no face does not convert.

import type { ML } from "@/lib/utils";
import type { SocialLinksDraft } from "@/lib/utils";
import { emptyML, EMPTY_SOCIAL_LINKS } from "@/lib/utils";

/** Same { days, time } pair chambers.schedule stores, produced by ScheduleDayPicker. */
export type IntakeSchedule = { days: ML; time: ML };

export type DoctorIntakeDraft = {
  name: ML;
  /** Either language. */
  degrees: string;
  /** Either language, free text. */
  bio: string;
  gender: "" | "male" | "female" | "other";
  /** Kept as a string so the input can be empty; coerced on the server. */
  experience_years: string;
  patients_served: ML;
  /** Either language, one condition per line. */
  treated_conditions: string;
  hospital: ML;
  specialty: ML;
  chamber_name: ML;
  address: ML;
  district: ML;
  /** Town / village / thana. */
  area: ML;
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
  patients_served: { ...emptyML },
  treated_conditions: "",
  hospital: { ...emptyML },
  specialty: { ...emptyML },
  chamber_name: { ...emptyML },
  address: { ...emptyML },
  district: { ...emptyML },
  area: { ...emptyML },
  fee: "",
  serial_phone: "",
  owner_email: "",
  map_url: "",
  schedule: [],
  social_links: EMPTY_SOCIAL_LINKS(),
});

/** What the public form posts. Images travel as compressed data URLs. */
export type DoctorIntakePayload = {
  token: string;
  draft: DoctorIntakeDraft;
  photo_data?: string;
  share_image_data?: string;
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
