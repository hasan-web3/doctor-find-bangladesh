"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import Script from "next/script";
import { ScheduleDayPicker } from "@/components/admin/schedule-picker";
import { compressImage } from "@/lib/image-compress";
import { submitDoctorIntake } from "@/actions/doctor-intake";
import {
  EMPTY_INTAKE_DRAFT,
  type DoctorIntakeDraft,
  type IntakeSchedule,
} from "@/lib/doctor-intake";
import type { ML } from "@/lib/utils";

// The client-facing intake form. One doctor, one chamber: that is what we sell
// and what the admin needs to build a profile; a doctor with a second chamber is
// a follow-up conversation, not a longer form.
//
// Only the doctor's NAME asks for Bangla and English, because it is the heading
// of the profile in both locales. Every other field takes one answer in either
// language. The earlier bilingual-everything version asked a chamber assistant
// to translate seven fields on a phone, and a half-translated pair is worse than
// one good answer the admin can translate later.
//
// Labels stay Bangla-first with the English underneath: the person filling this
// in may be the doctor, an assistant or an agent, and we cannot predict which
// they read more comfortably. Placeholders carry a real example rather than a
// restatement of the label, which is what actually stops people typing "Dhaka"
// into the thana field.
//
// The schedule picker is imported from the admin components on purpose: the
// chamber schedule has to arrive in exactly the { days, time } shape the admin
// chamber editor produces, and the surest way to guarantee that is to use the
// same component. It carries no server or admin-only dependency.

// The v3 SDK, read through a cast rather than a `declare global`: the public
// site's <RecaptchaGuard> already augments Window with this shape, and two
// separate augmentations of the same property are a merge conflict waiting to
// happen.
type Grecaptcha = {
  ready: (cb: () => void) => void;
  execute: (siteKey: string, opts: { action: string }) => Promise<string>;
};
const grecaptchaOf = (): Grecaptcha | undefined =>
  (window as unknown as { grecaptcha?: Grecaptcha }).grecaptcha;

type Errors = Partial<Record<string, string>>;

const inputBase =
  "w-full rounded-[11px] border border-line bg-white px-3.5 py-3 text-[15px] outline-none transition-colors focus:border-brand-600";

/** Field shell: Bangla label, English sub-label, optional hint, error slot. */
function Field({
  id,
  label,
  labelEn,
  required,
  hint,
  error,
  wide,
  children,
}: {
  id?: string;
  label: string;
  labelEn: string;
  required?: boolean;
  hint?: string;
  error?: string;
  /** Spans both columns of the section grid, for textareas and long rows. */
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div id={id} className={"scroll-mt-28" + (wide ? " lg:col-span-2" : "")}>
      <label className="mb-1 block">
        <span className="text-[14.5px] font-bold text-ink">{label}</span>
        {required ? (
          <span className="text-[#DC2626]"> *</span>
        ) : (
          <span className="ml-1 text-[12px] font-semibold text-ink-ghost">(ঐচ্ছিক / optional)</span>
        )}
        <span className="block font-latin text-[12px] text-ink-ghost">{labelEn}</span>
      </label>
      {hint && <p className="mb-1.5 mt-0 text-[12.5px] leading-relaxed text-ink-faint">{hint}</p>}
      {children}
      {error && <p className="mt-1 mb-0 text-[12.5px] font-semibold text-[#DC2626]">{error}</p>}
    </div>
  );
}

/**
 * The one remaining bilingual pair, used for the doctor's name only. Both halves
 * are required: the Bangla page prints the Bangla, the English page prints the
 * English, and a missing half leaves a visible hole in a heading.
 */
function MLPair({
  value,
  onChange,
  placeholderBn,
  placeholderEn,
}: {
  value: ML;
  onChange: (v: ML) => void;
  placeholderBn: string;
  placeholderEn: string;
}) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      <div>
        <div className="mb-1 text-[11.5px] font-bold text-brand-700">বাংলা</div>
        <input
          className={inputBase}
          value={value.bn}
          placeholder={placeholderBn}
          onChange={(e) => onChange({ ...value, bn: e.target.value })}
        />
      </div>
      <div>
        <div className="mb-1 font-latin text-[11.5px] font-bold text-ink-faint">English</div>
        <input
          className={inputBase + " font-latin"}
          value={value.en}
          placeholder={placeholderEn}
          onChange={(e) => onChange({ ...value, en: e.target.value })}
        />
      </div>
    </div>
  );
}

/**
 * Picks an image and compresses it in the browser before it ever crosses the
 * Server Action boundary: a phone photo is 4 to 12 MB and the action body cap is
 * 4 MB for the whole form.
 *
 * Not the admin <ImageUpload>: that component lives in a module which also
 * exports the rich-text editor, so importing it here would pull the whole TipTap
 * bundle onto a page that has no editor.
 */
function PhotoPicker({ value, onChange }: { value: string | null; onChange: (dataUrl: string | null) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const read = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) return;
      if (file.size > 15 * 1024 * 1024) {
        alert("ছবির সাইজ সর্বোচ্চ ১৫ মেগাবাইট হতে পারবে");
        return;
      }
      setBusy(true);
      try {
        onChange(await compressImage(file, { maxWidth: 1400, maxHeight: 1400 }));
      } catch {
        alert("ছবিটি নেওয়া যায়নি। অন্য একটি ছবি দিয়ে চেষ্টা করুন।");
      } finally {
        setBusy(false);
      }
    },
    [onChange]
  );

  return (
    <div>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files?.[0];
          if (file) read(file);
        }}
        className="relative flex aspect-square w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-line bg-page transition-colors hover:border-brand-300"
      >
        {value ? (
          // A data URL cannot go through next/image; a plain img is correct here.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="px-3 py-6 text-center text-[13px] leading-relaxed text-ink-ghost">
            ছবি যুক্ত করুন
            <br />
            <span className="text-[11.5px]">ক্লিক করুন বা টেনে আনুন</span>
          </div>
        )}
        {busy && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/75 text-[12.5px] font-semibold text-brand-700">
            ছবি প্রস্তুত হচ্ছে…
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) read(file);
            e.target.value = "";
          }}
        />
      </div>
      {value && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="mt-2 text-[12.5px] font-semibold text-[#DC2626]"
        >
          ছবি সরিয়ে ফেলুন
        </button>
      )}
    </div>
  );
}

function Section({
  title,
  titleEn,
  note,
  children,
}: {
  title: string;
  titleEn: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-line bg-white p-5 sm:p-7">
      <div className="mb-1 font-heading text-[18px] font-bold text-ink">{title}</div>
      <div className="font-latin text-[12.5px] text-ink-ghost">{titleEn}</div>
      {note && <p className="mb-0 mt-2 max-w-3xl text-[13.5px] leading-relaxed text-ink-faint">{note}</p>}
      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">{children}</div>
    </section>
  );
}

const SOCIALS: { key: keyof DoctorIntakeDraft["social_links"]; label: string; placeholder: string }[] = [
  { key: "website", label: "ওয়েবসাইট / Website", placeholder: "https://drrahman.com" },
  { key: "facebook", label: "ফেসবুক / Facebook", placeholder: "https://www.facebook.com/drrahman" },
  { key: "youtube", label: "ইউটিউব / YouTube", placeholder: "https://www.youtube.com/@drrahman" },
  { key: "instagram", label: "ইনস্টাগ্রাম / Instagram", placeholder: "https://www.instagram.com/drrahman" },
  { key: "linkedin", label: "LinkedIn", placeholder: "https://www.linkedin.com/in/drrahman" },
  { key: "twitter", label: "Twitter / X", placeholder: "https://x.com/drrahman" },
  { key: "researchgate", label: "ResearchGate", placeholder: "https://www.researchgate.net/profile/drrahman" },
];

/** Shown under every single-language field so the rule is never in doubt. */
const ANY_LANGUAGE = "বাংলা বা ইংরেজি, যেকোনো এক ভাষায় লিখলেই হবে।";

export function IntakeForm({
  token,
  clientName,
  brandName,
  helpline,
  helplineDial,
  recaptchaSiteKey,
}: {
  token: string;
  clientName: string;
  brandName: string;
  helpline: string;
  helplineDial: string;
  recaptchaSiteKey: string | null;
}) {
  const [draft, setDraft] = useState<DoctorIntakeDraft>(EMPTY_INTAKE_DRAFT());
  const [photo, setPhoto] = useState<string | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Honeypot + how long the form was on screen. A script that posts straight to
  // the action never renders this component, so both are cheap signals that cost
  // a real person nothing.
  const [trap, setTrap] = useState("");
  const mountedAt = useRef(Date.now());

  const set = <K extends keyof DoctorIntakeDraft>(key: K, value: DoctorIntakeDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  /** Every single-language field that has to be filled in, with its message. */
  const REQUIRED_TEXT: { key: keyof DoctorIntakeDraft; message: string; min?: number }[] = [
    { key: "degrees", message: "ডিগ্রি ও পদবি লিখুন" },
    { key: "bio", message: "পরিচিতি একটু বিস্তারিত লিখুন", min: 10 },
    { key: "treated_conditions", message: "অন্তত একটি রোগ বা সমস্যা লিখুন" },
    { key: "hospital", message: "প্রধান হাসপাতালের নাম লিখুন" },
    { key: "specialty", message: "বিশেষজ্ঞ বিভাগ লিখুন" },
    { key: "chamber_name", message: "চেম্বারের নাম লিখুন" },
    { key: "address", message: "চেম্বারের ঠিকানা লিখুন" },
    { key: "district", message: "জেলার নাম লিখুন" },
    { key: "area", message: "শহর / গ্রাম / থানার নাম লিখুন" },
  ];

  const validate = (): Errors => {
    const e: Errors = {};
    if (!draft.name.bn.trim() && !draft.name.en.trim()) e.name = "ডাক্তারের নাম বাংলা ও ইংরেজি দুটোই লিখুন";
    else if (!draft.name.bn.trim()) e.name = "ডাক্তারের নাম বাংলায় লিখুন";
    else if (!draft.name.en.trim()) e.name = "ডাক্তারের নাম ইংরেজিতে লিখুন";

    for (const { key, message, min } of REQUIRED_TEXT) {
      if ((draft[key] as string).trim().length < (min ?? 2)) e[key] = message;
    }
    if (!draft.gender) e.gender = "লিঙ্গ নির্বাচন করুন";
    if (!draft.fee.trim()) e.fee = "ভিজিট ফি লিখুন";
    if (draft.serial_phone.trim().length < 6) e.serial_phone = "সিরিয়াল নম্বর লিখুন";
    if (draft.owner_email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(draft.owner_email.trim())) {
      e.owner_email = "ইমেইল ঠিকানাটি ঠিকভাবে লিখুন";
    }
    if (draft.schedule.length === 0) e.schedule = "চেম্বারের দিন ও সময় দিন";
    if (!photo) e.photo = "ডাক্তারের ছবি যুক্ত করুন";
    return e;
  };

  /** reCAPTCHA v3 token, or "" when the integration is off / the SDK is late. */
  const captchaToken = async (): Promise<string> => {
    const grecaptcha = recaptchaSiteKey ? grecaptchaOf() : undefined;
    if (!recaptchaSiteKey || !grecaptcha) return "";
    try {
      return await new Promise<string>((resolve) => {
        grecaptcha.ready(() => {
          grecaptcha
            .execute(recaptchaSiteKey, { action: "doctor_form" })
            .then(resolve)
            .catch(() => resolve(""));
        });
      });
    } catch {
      return "";
    }
  };

  const submit = () => {
    const found = validate();
    setErrors(found);
    setFailure(null);
    const firstKey = Object.keys(found)[0];
    if (firstKey) {
      document.getElementById(`f-${firstKey}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    startTransition(async () => {
      const res = await submitDoctorIntake({
        token,
        draft,
        photo_data: photo ?? undefined,
        recaptcha_token: await captchaToken(),
        trap,
        elapsed_ms: Date.now() - mountedAt.current,
      });
      if (res.ok) {
        setDone(res.message);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        setFailure(res.message);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
  };

  if (done) {
    return (
      <main className="mx-auto max-w-xl px-5 py-14">
        <div className="rounded-2xl border border-[#86EFAC] bg-accent-soft p-7 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent text-2xl text-white">
            ✓
          </div>
          <h1 className="mb-2 mt-0 font-heading text-xl font-bold text-accent-text">ফর্মটি জমা হয়েছে</h1>
          <p className="mb-1 text-[14.5px] leading-relaxed text-ink-mute">{done}</p>
          <p className="mb-0 text-[13.5px] leading-relaxed text-ink-faint">
            এই লিংক দিয়ে আর ফর্ম জমা দেওয়া যাবে না। কিছু বদলাতে হলে আমাদের জানালেই আমরা ব্যবস্থা করে দেব।
          </p>
          {helpline && (
            <a
              href={helplineDial ? `tel:${helplineDial}` : undefined}
              className="mt-5 inline-block rounded-xl bg-brand-600 px-5 py-3 text-[15px] font-bold text-white"
            >
              ☎ {helpline}
            </a>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-site px-5 py-7">
      {recaptchaSiteKey && (
        <Script src={`https://www.google.com/recaptcha/api.js?render=${recaptchaSiteKey}`} strategy="afterInteractive" />
      )}

      <div className="mb-5 rounded-2xl border border-brand-200 bg-brand-50 p-5 sm:p-7">
        <h1 className="mb-1.5 mt-0 font-heading text-[22px] font-bold text-ink">ডাক্তারের তথ্য ফর্ম</h1>
        <p className="mb-2 mt-0 max-w-4xl text-[15px] leading-relaxed text-ink-mute">
          {clientName ? `${clientName}, ` : ""}নিচের তথ্যগুলো দিলে আমরা {brandName}-এ ডাক্তারের প্রোফাইলটি তৈরি করে দেব।
          শুধু ডাক্তারের নামটি বাংলা ও ইংরেজি দুটোতেই লাগবে, বাকি সব ঘরে যেকোনো এক ভাষায় লিখলেই হবে।
        </p>
        <p className="mb-0 mt-0 text-[13.5px] font-semibold leading-relaxed text-brand-700">
          ফর্মটি একবারই জমা দেওয়া যাবে। জমা দেওয়ার আগে তথ্যগুলো একবার দেখে নিন।
        </p>
      </div>

      {failure && (
        <div className="mb-5 rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-[14px] font-semibold text-[#DC2626]">
          {failure}
        </div>
      )}
      {Object.keys(errors).length > 0 && (
        <div className="mb-5 rounded-xl border border-warm-border bg-warm-soft px-4 py-3 text-[14px] font-semibold text-warm-heavy">
          কয়েকটি ঘর বাকি আছে। লাল লেখা দেখানো ঘরগুলো পূরণ করুন।
        </div>
      )}

      <div className="flex flex-col gap-5">
        {/* ---------------- doctor ---------------- */}
        <section className="rounded-2xl border border-line bg-white p-5 sm:p-7">
          <div className="mb-1 font-heading text-[18px] font-bold text-ink">ডাক্তারের পরিচয়</div>
          <div className="font-latin text-[12.5px] text-ink-ghost">Doctor&rsquo;s identity</div>
          <p className="mb-0 mt-2 max-w-3xl text-[13.5px] leading-relaxed text-ink-faint">
            ছবিটি প্রোফাইলের সবচেয়ে উপরে দেখাবে, তাই পরিষ্কার একটি ছবি দিন।
          </p>

          <div className="mt-5 grid grid-cols-1 gap-6 sm:grid-cols-[220px_1fr]">
            <Field
              id="f-photo"
              label="ডাক্তারের ছবি"
              labelEn="Doctor's photo"
              required
              error={errors.photo}
              hint="মুখ স্পষ্ট দেখা যায় এমন ছবি, সোজা করে তোলা।"
            >
              <PhotoPicker value={photo} onChange={setPhoto} />
            </Field>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <Field
                id="f-name"
                label="ডাক্তারের নাম"
                labelEn="Doctor's full name"
                required
                error={errors.name}
                hint="এই একটি ঘরেই বাংলা ও ইংরেজি দুটোই লাগবে।"
                wide
              >
                <MLPair
                  value={draft.name}
                  onChange={(v) => set("name", v)}
                  placeholderBn="ডা. আব্দুর রহমান"
                  placeholderEn="Dr. Abdur Rahman"
                />
              </Field>
              <Field
                id="f-degrees"
                label="ডিগ্রি ও পদবি"
                labelEn="Degrees & designation"
                required
                error={errors.degrees}
                hint={ANY_LANGUAGE}
                wide
              >
                <textarea
                  rows={3}
                  className={inputBase + " resize-y"}
                  value={draft.degrees}
                  placeholder="MBBS (DMC), FCPS (Medicine), সহযোগী অধ্যাপক, খুলনা মেডিকেল কলেজ"
                  onChange={(e) => set("degrees", e.target.value)}
                />
              </Field>
              <Field id="f-gender" label="লিঙ্গ" labelEn="Gender" required error={errors.gender}>
                <select
                  className={inputBase}
                  value={draft.gender}
                  onChange={(e) => set("gender", e.target.value as DoctorIntakeDraft["gender"])}
                >
                  <option value="">নির্বাচন করুন / Select</option>
                  <option value="male">পুরুষ / Male</option>
                  <option value="female">নারী / Female</option>
                  <option value="other">অন্যান্য / Other</option>
                </select>
              </Field>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <Field id="f-experience_years" label="অভিজ্ঞতা (বছর)" labelEn="Years of experience">
                  <input
                    inputMode="numeric"
                    className={inputBase + " font-latin"}
                    value={draft.experience_years}
                    placeholder="১২ / 12"
                    onChange={(e) => set("experience_years", e.target.value)}
                  />
                </Field>
                <Field
                  id="f-patients_served"
                  label="রোগী দেখেছেন"
                  labelEn="Patients treated"
                  hint="বাংলা বা ইংরেজি সংখ্যা, যেকোনোটাই চলবে।"
                >
                  <input
                    className={inputBase}
                    value={draft.patients_served}
                    placeholder="১০,০০০+ / 10,000+"
                    onChange={(e) => set("patients_served", e.target.value)}
                  />
                </Field>
              </div>
            </div>
          </div>
        </section>

        {/* ---------------- bio + conditions ---------------- */}
        <Section title="পরিচিতি ও চিকিৎসা" titleEn="About & treatments">
          <Field
            id="f-bio"
            label="পরিচিতি"
            labelEn="About the doctor"
            required
            error={errors.bio}
            hint={`${ANY_LANGUAGE} কোথায় পড়াশোনা, কোথায় কাজ করেন, কী নিয়ে কাজ করেন, এই ধরনের কথা লিখুন।`}
          >
            <textarea
              rows={9}
              className={inputBase + " resize-y"}
              value={draft.bio}
              placeholder="ডা. আব্দুর রহমান ঢাকা মেডিকেল কলেজ থেকে এমবিবিএস শেষ করে মেডিসিনে এফসিপিএস করেছেন। ১২ বছর ধরে ডায়াবেটিস, উচ্চ রক্তচাপ ও হরমোনজনিত রোগের চিকিৎসা করছেন। বর্তমানে খুলনা মেডিকেল কলেজ হাসপাতালে কর্মরত আছেন।"
              onChange={(e) => set("bio", e.target.value)}
            />
          </Field>
          <Field
            id="f-treated_conditions"
            label="যে সকল রোগের চিকিৎসা করা হয়"
            labelEn="Conditions treated"
            required
            error={errors.treated_conditions}
            hint={`প্রতি লাইনে একটি রোগ বা সমস্যা লিখুন। ${ANY_LANGUAGE}`}
          >
            <textarea
              rows={9}
              className={inputBase + " resize-y"}
              value={draft.treated_conditions}
              placeholder={"ডায়াবেটিস\nউচ্চ রক্তচাপ\nথাইরয়েড সমস্যা\nগ্যাস্ট্রিক ও আলসার\nজ্বর ও সংক্রমণ"}
              onChange={(e) => set("treated_conditions", e.target.value)}
            />
          </Field>
        </Section>

        {/* ---------------- hospital + specialty ---------------- */}
        <Section
          title="হাসপাতাল ও বিশেষজ্ঞ বিভাগ"
          titleEn="Hospital & specialty"
          note="ডাক্তার মূলত যে হাসপাতালে কর্মরত, সেটির নাম দিন। বিভাগ মানে ডাক্তার কোন বিষয়ের বিশেষজ্ঞ।"
        >
          <Field
            id="f-hospital"
            label="প্রধান হাসপাতাল"
            labelEn="Primary hospital"
            required
            error={errors.hospital}
            hint={ANY_LANGUAGE}
          >
            <input
              className={inputBase}
              value={draft.hospital}
              placeholder="খুলনা মেডিকেল কলেজ হাসপাতাল / Khulna Medical College Hospital"
              onChange={(e) => set("hospital", e.target.value)}
            />
          </Field>
          <Field
            id="f-specialty"
            label="বিশেষজ্ঞ বিভাগ"
            labelEn="Specialty"
            required
            error={errors.specialty}
            hint={`একাধিক হলে কমা দিয়ে লিখুন। ${ANY_LANGUAGE}`}
          >
            <input
              className={inputBase}
              value={draft.specialty}
              placeholder="মেডিসিন, ডায়াবেটিস ও হরমোন / Medicine, Diabetes"
              onChange={(e) => set("specialty", e.target.value)}
            />
          </Field>
        </Section>

        {/* ---------------- chamber ---------------- */}
        <Section
          title="চেম্বারের তথ্য"
          titleEn="Chamber details"
          note="রোগী যেখানে গিয়ে ডাক্তার দেখাবেন, সেই জায়গার তথ্য।"
        >
          <Field
            id="f-chamber_name"
            label="চেম্বারের নাম"
            labelEn="Chamber name"
            required
            error={errors.chamber_name}
            hint={ANY_LANGUAGE}
          >
            <input
              className={inputBase}
              value={draft.chamber_name}
              placeholder="ইসলামী ব্যাংক হাসপাতাল, খুলনা / Islami Bank Hospital, Khulna"
              onChange={(e) => set("chamber_name", e.target.value)}
            />
          </Field>
          <Field
            id="f-address"
            label="ঠিকানা"
            labelEn="Full address"
            required
            error={errors.address}
            hint={`বাড়ি বা ভবনের নাম, রোড আর এলাকা, রোগী যেন সহজে খুঁজে পায়। ${ANY_LANGUAGE}`}
          >
            <input
              className={inputBase}
              value={draft.address}
              placeholder="১২৩ কে.ডি.এ. অ্যাভিনিউ, শিববাড়ি মোড়, খুলনা"
              onChange={(e) => set("address", e.target.value)}
            />
          </Field>
          <Field id="f-district" label="জেলা" labelEn="District" required error={errors.district} hint={ANY_LANGUAGE}>
            <input
              className={inputBase}
              value={draft.district}
              placeholder="খুলনা / Khulna"
              onChange={(e) => set("district", e.target.value)}
            />
          </Field>
          <Field
            id="f-area"
            label="শহর / গ্রাম / থানা"
            labelEn="Town / village / thana"
            required
            error={errors.area}
            hint="চেম্বারটি ঠিক কোন এলাকায়, সেটি লিখুন, জেলার নাম নয়।"
          >
            <input
              className={inputBase}
              value={draft.area}
              placeholder="সোনাডাঙ্গা / Sonadanga"
              onChange={(e) => set("area", e.target.value)}
            />
          </Field>
          <Field id="f-fee" label="ভিজিট ফি (টাকা)" labelEn="Visit fee (BDT)" required error={errors.fee}>
            <input
              inputMode="numeric"
              className={inputBase + " font-latin"}
              value={draft.fee}
              placeholder="৮০০ / 800"
              onChange={(e) => set("fee", e.target.value)}
            />
          </Field>
          <Field
            id="f-serial_phone"
            label="সিরিয়াল নম্বর"
            labelEn="Serial / appointment phone"
            required
            error={errors.serial_phone}
            hint="রোগী এই নম্বরে ফোন করে সিরিয়াল নেবে।"
          >
            <input
              inputMode="tel"
              className={inputBase + " font-latin"}
              value={draft.serial_phone}
              placeholder="01712345678"
              onChange={(e) => set("serial_phone", e.target.value)}
            />
          </Field>
          <Field
            id="f-owner_email"
            label="চেম্বার মালিকের ইমেইল"
            labelEn="Chamber owner's email"
            error={errors.owner_email}
            hint="দিলে সুবিধা: কেউ ওয়েবসাইট থেকে অনলাইনে সিরিয়াল নিলে সাথে সাথে এই ইমেইলে খবর চলে যাবে।"
          >
            <input
              type="email"
              inputMode="email"
              className={inputBase + " font-latin"}
              value={draft.owner_email}
              placeholder="chamber@example.com"
              onChange={(e) => set("owner_email", e.target.value)}
            />
          </Field>
          <Field
            id="f-map_url"
            label="চেম্বারের গুগল ম্যাপ লিংক"
            labelEn="Google Maps link"
            hint="দিলে ভালো হয়, প্রোফাইলে ম্যাপ দেখানো যায় আর রোগী সহজে চেম্বার খুঁজে পায়। গুগল ম্যাপে চেম্বারটি বের করে Share বাটন থেকে লিংক কপি করে এখানে বসিয়ে দিন।"
          >
            <input
              className={inputBase + " font-latin"}
              value={draft.map_url}
              placeholder="https://maps.app.goo.gl/xxxxxxxx"
              onChange={(e) => set("map_url", e.target.value)}
            />
          </Field>
        </Section>

        {/* ---------------- schedule ---------------- */}
        <section className="rounded-2xl border border-line bg-white p-5 sm:p-7">
          <div className="mb-1 font-heading text-[18px] font-bold text-ink">চেম্বারের সময়সূচি</div>
          <div className="font-latin text-[12.5px] text-ink-ghost">Chamber schedule</div>
          <p className="mb-0 mt-2 max-w-3xl text-[13.5px] leading-relaxed text-ink-faint">
            যে দিনগুলোতে ডাক্তার বসেন, সেই দিনগুলো বেছে নিন, তারপর প্রতিটি দিনের শুরু ও শেষ সময় বসান। একই দিনে দুই বেলা
            বসলে সেই দিনে আরেকটি সময় যোগ করুন।
          </p>
          <div id="f-schedule" className="mt-5 scroll-mt-28">
            <ScheduleDayPicker
              value={draft.schedule as IntakeSchedule[]}
              onChange={(next) => set("schedule", next)}
            />
            {errors.schedule && (
              <p className="mt-1.5 mb-0 text-[12.5px] font-semibold text-[#DC2626]">{errors.schedule}</p>
            )}
          </div>
        </section>

        {/* ---------------- socials ---------------- */}
        <Section
          title="সামাজিক প্রোফাইল"
          titleEn="Social profiles"
          note="এই লিংকগুলো গুগলে ডাক্তারের প্রোফাইলের র‍্যাংকিং বাড়াতে সাহায্য করে, তাই যেগুলো আছে দিয়ে দিলে ভালো হয়। সবগুলোই ঐচ্ছিক। পুরো লিংক (https:// সহ) দিলে কাজ করবে।"
        >
          {SOCIALS.map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="mb-1 block text-[13.5px] font-semibold text-ink-soft">{label}</label>
              <input
                type="url"
                className={inputBase + " font-latin"}
                value={draft.social_links[key]}
                placeholder={placeholder}
                onChange={(e) => set("social_links", { ...draft.social_links, [key]: e.target.value })}
              />
            </div>
          ))}
        </Section>

        {/* Honeypot. Hidden from people, irresistible to form-filling scripts. */}
        <div aria-hidden className="hidden">
          <label>
            Company
            <input
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={trap}
              onChange={(e) => setTrap(e.target.value)}
            />
          </label>
        </div>

        <div className="rounded-2xl border border-line bg-white p-5 sm:p-7">
          <div className="mx-auto max-w-2xl">
            <p className="mb-3 mt-0 text-center text-[13.5px] leading-relaxed text-ink-faint">
              জমা দেওয়ার পর এই ফর্মটি আর খোলা যাবে না। কিছু বাদ পড়ে গেলে বা ভুল হলে আমাদের ফোন করে জানালেই আমরা ঠিক করে
              দেব।
            </p>
            <button
              type="button"
              onClick={submit}
              disabled={pending}
              className="w-full rounded-xl bg-brand-600 px-5 py-4 text-[16px] font-bold text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
            >
              {pending ? "জমা হচ্ছে…" : "ফর্মটি জমা দিন"}
            </button>
            {helpline && (
              <p className="mb-0 mt-3 text-center text-[13px] text-ink-faint">
                সাহায্য দরকার হলে কল করুন{" "}
                <a href={helplineDial ? `tel:${helplineDial}` : undefined} className="font-bold text-brand-700">
                  {helpline}
                </a>
              </p>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
