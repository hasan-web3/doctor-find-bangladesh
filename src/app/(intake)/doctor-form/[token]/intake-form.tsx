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

// The client-facing intake form. One doctor, one chamber — that is what we sell
// and what the admin needs to build a profile; a doctor with a second chamber is
// a follow-up conversation, not a longer form.
//
// Every label is Bangla first with the English underneath, because the person
// filling this in may be the doctor, a chamber assistant, or an agent, and we
// cannot predict which they read more comfortably. Placeholders carry a real
// example rather than a restatement of the label — that is what actually stops
// people typing "Dhaka" into the thana field.
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
  children,
}: {
  id?: string;
  label: string;
  labelEn: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div id={id} className="scroll-mt-24">
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
 * The bilingual pair. Both halves are required for these fields because both
 * print on the public profile — the Bangla page shows the Bangla, the English
 * page shows the English, and a missing half leaves a visible hole.
 */
function MLPair({
  value,
  onChange,
  placeholderBn,
  placeholderEn,
  textarea = false,
  rows = 2,
}: {
  value: ML;
  onChange: (v: ML) => void;
  placeholderBn: string;
  placeholderEn: string;
  textarea?: boolean;
  rows?: number;
}) {
  const common = inputBase + (textarea ? " resize-y" : "");
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      <div>
        <div className="mb-1 text-[11.5px] font-bold text-brand-700">বাংলা</div>
        {textarea ? (
          <textarea
            rows={rows}
            className={common}
            value={value.bn}
            placeholder={placeholderBn}
            onChange={(e) => onChange({ ...value, bn: e.target.value })}
          />
        ) : (
          <input
            className={common}
            value={value.bn}
            placeholder={placeholderBn}
            onChange={(e) => onChange({ ...value, bn: e.target.value })}
          />
        )}
      </div>
      <div>
        <div className="mb-1 font-latin text-[11.5px] font-bold text-ink-faint">English</div>
        {textarea ? (
          <textarea
            rows={rows}
            className={common + " font-latin"}
            value={value.en}
            placeholder={placeholderEn}
            onChange={(e) => onChange({ ...value, en: e.target.value })}
          />
        ) : (
          <input
            className={common + " font-latin"}
            value={value.en}
            placeholder={placeholderEn}
            onChange={(e) => onChange({ ...value, en: e.target.value })}
          />
        )}
      </div>
    </div>
  );
}

/**
 * Picks an image and compresses it in the browser before it ever crosses the
 * Server Action boundary — a phone photo is 4–12 MB and the action body cap is
 * 4 MB for the whole form.
 *
 * Not the admin <ImageUpload>: that component lives in a module which also
 * exports the rich-text editor, so importing it here would pull the whole TipTap
 * bundle onto a page that has no editor.
 */
function PhotoPicker({
  value,
  onChange,
  aspect,
  cta,
}: {
  value: string | null;
  onChange: (dataUrl: string | null) => void;
  aspect: string;
  cta: string;
}) {
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
        className={`relative flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-line bg-page transition-colors hover:border-brand-300 ${aspect}`}
      >
        {value ? (
          // A data URL cannot go through next/image; a plain img is correct here.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="px-3 py-6 text-center text-[13px] leading-relaxed text-ink-ghost">
            {cta}
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
    <section className="rounded-2xl border border-line bg-white p-5 sm:p-6">
      <div className="mb-1 font-heading text-[17px] font-bold text-ink">{title}</div>
      <div className="mb-1 font-latin text-[12.5px] text-ink-ghost">{titleEn}</div>
      {note && <p className="mb-4 mt-1.5 text-[13px] leading-relaxed text-ink-faint">{note}</p>}
      <div className={note ? "flex flex-col gap-4" : "mt-4 flex flex-col gap-4"}>{children}</div>
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
  const [shareImage, setShareImage] = useState<string | null>(null);
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

  const bothRequired: { key: keyof DoctorIntakeDraft; label: string }[] = [
    { key: "name", label: "ডাক্তারের নাম" },
    { key: "hospital", label: "প্রধান হাসপাতাল" },
    { key: "specialty", label: "বিশেষজ্ঞ বিভাগ" },
    { key: "chamber_name", label: "চেম্বারের নাম" },
    { key: "address", label: "ঠিকানা" },
    { key: "district", label: "জেলা" },
    { key: "area", label: "শহর / গ্রাম / থানা" },
  ];

  const validate = (): Errors => {
    const e: Errors = {};
    for (const { key, label } of bothRequired) {
      const v = draft[key] as ML;
      if (!v.bn.trim() && !v.en.trim()) e[key] = `${label} বাংলা ও ইংরেজি দুটোই লিখুন`;
      else if (!v.bn.trim()) e[key] = `${label} বাংলায় লিখুন`;
      else if (!v.en.trim()) e[key] = `${label} ইংরেজিতে লিখুন`;
    }
    if (draft.degrees.trim().length < 2) e.degrees = "ডিগ্রি ও পদবি লিখুন";
    if (draft.bio.trim().length < 10) e.bio = "পরিচিতি একটু বিস্তারিত লিখুন";
    if (!draft.gender) e.gender = "লিঙ্গ নির্বাচন করুন";
    if (draft.treated_conditions.trim().length < 2) e.treated_conditions = "অন্তত একটি রোগ বা সমস্যা লিখুন";
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
        share_image_data: shareImage ?? undefined,
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
      <main className="mx-auto max-w-xl px-4 py-14 sm:px-6">
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
    <main className="mx-auto max-w-3xl px-4 py-7 sm:px-6">
      {recaptchaSiteKey && (
        <Script src={`https://www.google.com/recaptcha/api.js?render=${recaptchaSiteKey}`} strategy="afterInteractive" />
      )}

      <div className="mb-5 rounded-2xl border border-brand-200 bg-brand-50 p-5">
        <h1 className="mb-1.5 mt-0 font-heading text-[21px] font-bold text-ink">ডাক্তারের তথ্য ফর্ম</h1>
        <p className="mb-2 mt-0 text-[14.5px] leading-relaxed text-ink-mute">
          {clientName ? `${clientName}, ` : ""}নিচের তথ্যগুলো দিলে আমরা {brandName}-এ ডাক্তারের প্রোফাইলটি তৈরি করে দেব।
          যেখানে বাংলা ও ইংরেজি দুটো ঘর আছে, দুটোই পূরণ করতে হবে, কারণ প্রোফাইলের দুই ভাষার পাতায় আলাদা করে দেখানো হয়।
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
        <Section
          title="ডাক্তারের পরিচয়"
          titleEn="Doctor's identity"
          note="ছবিটি প্রোফাইলের সবচেয়ে উপরে দেখাবে, তাই পরিষ্কার একটি ছবি দিন।"
        >
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-[190px_1fr]">
            <Field
              id="f-photo"
              label="ডাক্তারের ছবি"
              labelEn="Doctor's photo"
              required
              error={errors.photo}
              hint="মুখ স্পষ্ট দেখা যায় এমন ছবি, সোজা করে তোলা।"
            >
              <PhotoPicker value={photo} onChange={setPhoto} aspect="aspect-square" cta="ছবি যুক্ত করুন" />
            </Field>
            <div className="flex flex-col gap-4">
              <Field id="f-name" label="ডাক্তারের নাম" labelEn="Doctor's full name" required error={errors.name}>
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
                hint="বাংলা বা ইংরেজি, যেটাতে সুবিধা হয় সেই ভাষায় লিখলেই হবে।"
              >
                <textarea
                  rows={3}
                  className={inputBase + " resize-y"}
                  value={draft.degrees}
                  placeholder="MBBS (DMC), FCPS (Medicine), সহযোগী অধ্যাপক, খুলনা মেডিকেল কলেজ"
                  onChange={(e) => set("degrees", e.target.value)}
                />
              </Field>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
            <Field id="f-experience_years" label="অভিজ্ঞতা (বছর)" labelEn="Years of experience">
              <input
                inputMode="numeric"
                className={inputBase + " font-latin"}
                value={draft.experience_years}
                placeholder="১২ / 12"
                onChange={(e) => set("experience_years", e.target.value)}
              />
            </Field>
            <Field id="f-patients_served" label="রোগী দেখেছেন" labelEn="Patients treated">
              <MLPair
                value={draft.patients_served}
                onChange={(v) => set("patients_served", v)}
                placeholderBn="১০,০০০+"
                placeholderEn="10,000+"
              />
            </Field>
          </div>
        </Section>

        {/* ---------------- bio + conditions ---------------- */}
        <Section title="পরিচিতি ও চিকিৎসা" titleEn="About & treatments">
          <Field
            id="f-bio"
            label="পরিচিতি"
            labelEn="About the doctor"
            required
            error={errors.bio}
            hint="বাংলা বা ইংরেজি, যেকোনো একটিতে লিখলেই হবে। কোথায় পড়াশোনা, কোথায় কাজ করেন, কী নিয়ে কাজ করেন, এই ধরনের কথা লিখুন।"
          >
            <textarea
              rows={6}
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
            hint="প্রতি লাইনে একটি রোগ বা সমস্যা লিখুন। বাংলা বা ইংরেজি, যেকোনো একটিতে লিখলেই হবে।"
          >
            <textarea
              rows={7}
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
          <Field id="f-hospital" label="প্রধান হাসপাতাল" labelEn="Primary hospital" required error={errors.hospital}>
            <MLPair
              value={draft.hospital}
              onChange={(v) => set("hospital", v)}
              placeholderBn="খুলনা মেডিকেল কলেজ হাসপাতাল"
              placeholderEn="Khulna Medical College Hospital"
            />
          </Field>
          <Field
            id="f-specialty"
            label="বিশেষজ্ঞ বিভাগ"
            labelEn="Specialty"
            required
            error={errors.specialty}
            hint="একাধিক হলে কমা দিয়ে লিখুন।"
          >
            <MLPair
              value={draft.specialty}
              onChange={(v) => set("specialty", v)}
              placeholderBn="মেডিসিন, ডায়াবেটিস ও হরমোন"
              placeholderEn="Medicine, Diabetes & Endocrinology"
            />
          </Field>
        </Section>

        {/* ---------------- chamber ---------------- */}
        <Section
          title="চেম্বারের তথ্য"
          titleEn="Chamber details"
          note="রোগী যেখানে গিয়ে ডাক্তার দেখাবেন, সেই জায়গার তথ্য।"
        >
          <Field id="f-chamber_name" label="চেম্বারের নাম" labelEn="Chamber name" required error={errors.chamber_name}>
            <MLPair
              value={draft.chamber_name}
              onChange={(v) => set("chamber_name", v)}
              placeholderBn="ইসলামী ব্যাংক হাসপাতাল, খুলনা"
              placeholderEn="Islami Bank Hospital, Khulna"
            />
          </Field>
          <Field
            id="f-address"
            label="ঠিকানা"
            labelEn="Full address"
            required
            error={errors.address}
            hint="বাড়ি বা ভবনের নাম, রোড আর এলাকা, রোগী যেন সহজে খুঁজে পায়।"
          >
            <MLPair
              value={draft.address}
              onChange={(v) => set("address", v)}
              placeholderBn="১২৩ কে.ডি.এ. অ্যাভিনিউ, শিববাড়ি মোড়, খুলনা"
              placeholderEn="123 KDA Avenue, Shibbari More, Khulna"
              textarea
              rows={2}
            />
          </Field>
          <div className="grid grid-cols-1 gap-4">
            <Field id="f-district" label="জেলা" labelEn="District" required error={errors.district}>
              <MLPair
                value={draft.district}
                onChange={(v) => set("district", v)}
                placeholderBn="খুলনা"
                placeholderEn="Khulna"
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
              <MLPair
                value={draft.area}
                onChange={(v) => set("area", v)}
                placeholderBn="সোনাডাঙ্গা"
                placeholderEn="Sonadanga"
              />
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
          </div>
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
            <textarea
              rows={2}
              className={inputBase + " resize-y font-latin"}
              value={draft.map_url}
              placeholder="https://maps.app.goo.gl/xxxxxxxx"
              onChange={(e) => set("map_url", e.target.value)}
            />
          </Field>
        </Section>

        {/* ---------------- schedule ---------------- */}
        <Section
          title="চেম্বারের সময়সূচি"
          titleEn="Chamber schedule"
          note="যে দিনগুলোতে ডাক্তার বসেন, সেই দিনগুলো বেছে নিন, তারপর প্রতিটি দিনের শুরু ও শেষ সময় বসান। একই দিনে দুই বেলা বসলে সেই দিনে আরেকটি সময় যোগ করুন।"
        >
          <div id="f-schedule" className="scroll-mt-24">
            <ScheduleDayPicker
              value={draft.schedule as IntakeSchedule[]}
              onChange={(next) => set("schedule", next)}
            />
            {errors.schedule && (
              <p className="mt-1.5 mb-0 text-[12.5px] font-semibold text-[#DC2626]">{errors.schedule}</p>
            )}
          </div>
        </Section>

        {/* ---------------- socials + share image ---------------- */}
        <Section
          title="সামাজিক প্রোফাইল ও শেয়ার ছবি"
          titleEn="Social profiles & share image"
          note="সবগুলোই ঐচ্ছিক। যেগুলো আছে শুধু সেগুলোই দিন, পুরো লিংক (https:// সহ) দিলে কাজ করবে।"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
          </div>
          <Field
            id="f-share_image"
            label="শেয়ার ছবি"
            labelEn="Share image"
            hint="ফেসবুক বা হোয়াটসঅ্যাপে প্রোফাইলের লিংক শেয়ার করলে যে চওড়া ছবিটি দেখাবে। না দিলেও চলবে, তবে দিলে শেয়ার করা লিংকটি অনেক সুন্দর দেখায়। চওড়া ছবি দিন, মোটামুটি ১২০০ × ৬৩০ পিক্সেল হলে সবচেয়ে ভালো।"
          >
            <div className="max-w-md">
              <PhotoPicker
                value={shareImage}
                onChange={setShareImage}
                aspect="aspect-[1200/630]"
                cta="শেয়ার ছবি যুক্ত করুন"
              />
            </div>
          </Field>
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

        <div className="rounded-2xl border border-line bg-white p-5 sm:p-6">
          <p className="mb-3 mt-0 text-[13.5px] leading-relaxed text-ink-faint">
            জমা দেওয়ার পর এই ফর্মটি আর খোলা যাবে না। কিছু বাদ পড়ে গেলে বা ভুল হলে আমাদের ফোন করে জানালেই আমরা ঠিক করে দেব।
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
    </main>
  );
}
