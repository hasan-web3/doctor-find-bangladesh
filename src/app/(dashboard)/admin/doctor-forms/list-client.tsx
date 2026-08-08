"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FullPageModal } from "@/components/admin/full-page-modal";
import { DebouncedSearch } from "@/components/admin/debounced-search";
import { Pagination } from "@/components/admin/pagination";
import { StatusBadge } from "@/components/admin/ui";
import { NewFlag, useNewRows } from "@/components/admin/notifications";
import { deleteDoctorSubmission, discardIntakeLink } from "@/actions/admin-doctor-intake";
import { dateTime } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { DoctorSubmissionData } from "@/db/schema";
import { GenerateLinkModal } from "./generate-modal";

// Inbox for the client-facing doctor form. Two kinds of row share one table:
// a SUBMITTED form (the real lead) and a PENDING link the admin kept to share by
// hand, which shows immediately with a "not filled in yet" flag so it can be
// re-copied and is never silently lost. See the query in page.tsx for why an
// emailed link is not listed until it comes back.
//
// Numbers stay in Latin digits throughout (phones, emails, fees, dates): the
// admin copies them into a dialer, an email client or the doctor form, and
// Bangla numerals make that impossible.

export type FormRow = {
  kind: "submitted" | "pending";
  /** doctor_submissions.id for a submitted row, doctor_form_links.id for pending. */
  row_id: number;
  client_name: string;
  client_phone: string;
  client_email: string | null;
  doctor_name_bn: string | null;
  doctor_name_en: string | null;
  hospital_bn: string | null;
  specialty_bn: string | null;
  district_bn: string | null;
  area_bn: string | null;
  serial_phone: string | null;
  fee: number;
  owner_email: string | null;
  photo_url: string | null;
  share_image_url: string | null;
  data: DoctorSubmissionData;
  created_at: string;
  sent_at: string | null;
  created_by: string | null;
  sent_to: string | null;
  /** Only useful while pending — it is what the admin re-copies to re-share. */
  token: string | null;
};

const SOCIAL_LABELS: Record<string, string> = {
  website: "ওয়েবসাইট",
  facebook: "Facebook",
  youtube: "YouTube",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  twitter: "Twitter / X",
  researchgate: "ResearchGate",
};

const GENDER_LABELS: Record<string, string> = {
  male: "পুরুষ / Male",
  female: "নারী / Female",
  other: "অন্যান্য / Other",
};

/** One label + bn/en value pair in the detail view. */
function Pair({ label, bn, en }: { label: string; bn?: string; en?: string }) {
  if (!bn?.trim() && !en?.trim()) return null;
  return (
    <div className="border-b border-[#F1F5F9] py-2.5 last:border-b-0">
      <div className="mb-1 text-[12px] font-semibold text-ink-ghost">{label}</div>
      {bn?.trim() && <div className="text-[14.5px] text-ink">{bn}</div>}
      {en?.trim() && <div className="font-latin text-[13.5px] text-ink-mute">{en}</div>}
    </div>
  );
}

/** One label + single value row, printed in Latin when it is a number or link. */
function Line({ label, value, latin }: { label: string; value?: string | null; latin?: boolean }) {
  if (!value?.toString().trim()) return null;
  return (
    <div className="border-b border-[#F1F5F9] py-2.5 last:border-b-0">
      <div className="mb-1 text-[12px] font-semibold text-ink-ghost">{label}</div>
      <div className={cn("whitespace-pre-line text-[14.5px] text-ink", latin && "font-latin break-all")}>{value}</div>
    </div>
  );
}

function DetailView({ row }: { row: FormRow }) {
  const d = row.data || {};
  const schedule = d.schedule ?? [];
  const socials = Object.entries(d.social_links ?? {}).filter(([, v]) => !!v);

  return (
    <div className="p-5 sm:p-6">
      <div className="flex flex-col gap-5">
        {/* who sent it */}
        <div className="rounded-2xl border border-brand-200 bg-brand-50 p-5">
          <div className="mb-2 font-heading text-[15px] font-bold text-brand-700">যিনি ফর্মটি জমা দিয়েছেন</div>
          <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
            <Line label="নাম" value={row.client_name} />
            <Line label="ফোন" value={row.client_phone} latin />
            <Line label="ইমেইল" value={row.client_email} latin />
            <Line label="জমার সময়" value={dateTime(row.created_at, "en")} latin />
            <Line label="লিংক তৈরি করেছেন" value={row.created_by} />
            <Line label="লিংক পাঠানো হয়েছিল" value={row.sent_to} latin />
          </div>
        </div>

        {/* images */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-[200px_1fr]">
          <div>
            <div className="mb-1.5 text-[12px] font-semibold text-ink-ghost">ডাক্তারের ছবি</div>
            {row.photo_url ? (
              <a href={row.photo_url} target="_blank" rel="noreferrer" className="block">
                <Image
                  src={row.photo_url}
                  alt={row.doctor_name_bn || "doctor"}
                  width={200}
                  height={200}
                  className="aspect-square w-full rounded-xl border border-line object-cover"
                />
              </a>
            ) : (
              <div className="rounded-xl border border-dashed border-line p-6 text-center text-[13px] text-ink-ghost">
                ছবি নেই
              </div>
            )}
          </div>
          <div>
            <div className="mb-1.5 text-[12px] font-semibold text-ink-ghost">শেয়ার ছবি</div>
            {row.share_image_url ? (
              <a href={row.share_image_url} target="_blank" rel="noreferrer" className="block">
                <Image
                  src={row.share_image_url}
                  alt="share"
                  width={600}
                  height={315}
                  className="w-full rounded-xl border border-line object-cover"
                />
              </a>
            ) : (
              <div className="rounded-xl border border-dashed border-line p-6 text-center text-[13px] text-ink-ghost">
                দেওয়া হয়নি
              </div>
            )}
          </div>
        </div>

        {/* doctor */}
        <div className="rounded-2xl border border-line bg-white p-5">
          <div className="mb-2 font-heading text-[15px] font-bold text-ink">ডাক্তারের তথ্য</div>
          <Pair label="নাম" bn={d.name?.bn} en={d.name?.en} />
          <Line label="ডিগ্রি ও পদবি" value={d.degrees} />
          <Line label="লিঙ্গ" value={d.gender ? GENDER_LABELS[d.gender] ?? d.gender : ""} />
          <Line
            label="অভিজ্ঞতা (বছর)"
            value={d.experience_years != null ? String(d.experience_years) : ""}
            latin
          />
          <Pair label="রোগী দেখেছেন" bn={d.patients_served?.bn} en={d.patients_served?.en} />
          <Line label="পরিচিতি" value={d.bio} />
          <Line label="যে সকল রোগের চিকিৎসা করা হয়" value={d.treated_conditions} />
        </div>

        {/* hospital + specialty */}
        <div className="rounded-2xl border border-line bg-white p-5">
          <div className="mb-2 font-heading text-[15px] font-bold text-ink">হাসপাতাল ও বিভাগ</div>
          <Pair label="প্রধান হাসপাতাল" bn={d.hospital?.bn} en={d.hospital?.en} />
          <Pair label="বিশেষজ্ঞ বিভাগ" bn={d.specialty?.bn} en={d.specialty?.en} />
        </div>

        {/* chamber */}
        <div className="rounded-2xl border border-line bg-white p-5">
          <div className="mb-2 font-heading text-[15px] font-bold text-ink">চেম্বার</div>
          <Pair label="চেম্বারের নাম" bn={d.chamber_name?.bn} en={d.chamber_name?.en} />
          <Pair label="ঠিকানা" bn={d.address?.bn} en={d.address?.en} />
          <Pair label="জেলা" bn={d.district?.bn} en={d.district?.en} />
          <Pair label="শহর / গ্রাম / থানা" bn={d.area?.bn} en={d.area?.en} />
          <Line label="ভিজিট ফি (টাকা)" value={row.fee ? String(row.fee) : ""} latin />
          <Line label="সিরিয়াল নম্বর" value={row.serial_phone} latin />
          <Line label="চেম্বার মালিকের ইমেইল" value={row.owner_email} latin />
          <Line label="গুগল ম্যাপ" value={d.map_url} latin />
        </div>

        {/* schedule */}
        <div className="rounded-2xl border border-line bg-white p-5">
          <div className="mb-3 font-heading text-[15px] font-bold text-ink">সময়সূচি</div>
          {schedule.length === 0 ? (
            <div className="text-[13.5px] text-ink-ghost">দেওয়া হয়নি</div>
          ) : (
            <table className="w-full border-collapse">
              <tbody>
                {schedule.map((s, i) => (
                  <tr key={i}>
                    <td className="w-40 border-b border-[#F1F5F9] py-2 pr-3 text-[14px] font-semibold text-ink">
                      {s.days?.bn || s.days?.en}
                      <span className="block font-latin text-[12px] font-normal text-ink-ghost">{s.days?.en}</span>
                    </td>
                    <td className="border-b border-[#F1F5F9] py-2 text-[14px] text-ink-mute">
                      {s.time?.bn}
                      <span className="block font-latin text-[12.5px] text-ink-ghost">{s.time?.en}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* socials */}
        {socials.length > 0 && (
          <div className="rounded-2xl border border-line bg-white p-5">
            <div className="mb-2 font-heading text-[15px] font-bold text-ink">সামাজিক প্রোফাইল</div>
            {socials.map(([key, url]) => (
              <div key={key} className="border-b border-[#F1F5F9] py-2.5 last:border-b-0">
                <div className="mb-1 text-[12px] font-semibold text-ink-ghost">{SOCIAL_LABELS[key] ?? key}</div>
                <a
                  href={url as string}
                  target="_blank"
                  rel="noreferrer"
                  className="break-all font-latin text-[13.5px] text-brand-700 underline"
                >
                  {url as string}
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function DoctorFormsList({
  rows,
  total,
  emailedPending,
  page,
  perPage,
  q,
}: {
  rows: FormRow[];
  total: number;
  emailedPending: number;
  page: number;
  perPage: number;
  q: string;
}) {
  const router = useRouter();
  const newRows = useNewRows("doctor-forms");
  const [open, setOpen] = useState<FormRow | null>(null);
  const [generating, setGenerating] = useState(false);
  const [confirm, setConfirm] = useState<FormRow | null>(null);
  const [deleting, startDelete] = useTransition();
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const openRow = (row: FormRow) => {
    if (row.kind !== "submitted") return;
    // Opening the form is what counts as having seen it, same rule the leads and
    // appointments panels follow.
    newRows.markRead(row.row_id);
    setOpen(row);
  };

  /** Re-copy a pending link so it can be shared again without regenerating. */
  const copyLink = async (row: FormRow) => {
    if (!row.token) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/doctor-form/${row.token}`);
      setCopiedId(row.row_id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Clipboard blocked (insecure origin / permission): nothing useful to do
      // beyond leaving the button unchanged.
    }
  };

  const performDelete = () => {
    if (!confirm) return;
    const { kind, row_id } = confirm;
    startDelete(async () => {
      // A pending row has no submission behind it — only the link is thrown
      // away, and discardIntakeLink refuses to touch one that was submitted.
      if (kind === "submitted") await deleteDoctorSubmission(row_id);
      else await discardIntakeLink(row_id);
      setConfirm(null);
      setOpen(null);
      router.refresh();
    });
  };

  const totalPages = Math.ceil(total / perPage);

  return (
    <div>
      <h1 className="mb-1 mt-0 font-heading text-2xl font-bold text-ink">ডাক্তার ফর্ম</h1>
      <p className="mb-5 mt-0 text-[13.5px] text-ink-faint">
        ক্লায়েন্টকে পাঠানো লিংক থেকে জমা পড়া ডাক্তারের তথ্য। এখান থেকে দেখে ডাক্তার প্রোফাইল তৈরি করুন।
        সংরক্ষণ করা লিংকগুলোও নিচে থাকে, ক্লায়েন্ট জমা না দেওয়া পর্যন্ত আলাদা চিহ্ন দিয়ে দেখানো হয়।
      </p>

      <div className="mb-[18px] flex flex-wrap items-center justify-between gap-3">
        <DebouncedSearch initial={q} placeholder="ক্লায়েন্ট, ফোন, ইমেইল বা ডাক্তারের নাম" />
        <div className="flex flex-wrap items-center gap-2">
          {emailedPending > 0 && (
            <span className="rounded-full border border-line bg-white px-3.5 py-2 text-[12.5px] font-semibold text-ink-mute">
              ইমেইলে পাঠানো, জমা পড়েনি: <span className="font-latin">{emailedPending}</span>
            </span>
          )}
          <button
            type="button"
            onClick={() => setGenerating(true)}
            className="rounded-[10px] bg-brand-600 px-[18px] py-2.5 text-sm font-bold text-white hover:bg-brand-700"
          >
            + ডাক্তার ফর্ম লিংক তৈরি করুন
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-line bg-white p-1.5">
        <table className="w-full min-w-[820px] border-collapse">
          <thead>
            <tr>
              {["ডাক্তার", "ক্লায়েন্ট", "এলাকা", "ভিজিট ফি", "অবস্থা", "অ্যাকশন"].map((h) => (
                <th
                  key={h}
                  className="border-b border-line px-3.5 py-3 text-left text-[12.5px] font-semibold text-ink-ghost"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const pending = r.kind === "pending";
              const isNew = !pending && newRows.isNew(r.row_id);
              return (
                <tr
                  key={`${r.kind}-${r.row_id}`}
                  className={cn(isNew && "bg-brand-100", pending && "bg-warm-soft/50")}
                >
                  <td className="border-b border-[#F1F5F9] px-3.5 py-3">
                    {pending ? (
                      // Nothing to open yet — the doctor's details are exactly
                      // what this row is still waiting for.
                      <span className="text-[13.5px] font-semibold text-warm-heavy">
                        ফর্ম এখনো পূরণ করেনি
                        <span className="block text-[12px] font-normal text-ink-faint">
                          লিংক তৈরি: {dateTime(r.created_at, "en")}
                        </span>
                      </span>
                    ) : (
                      <button onClick={() => openRow(r)} className="text-left">
                        <span className="text-sm font-bold text-ink hover:text-brand-600">
                          {r.doctor_name_bn || r.doctor_name_en || "নাম নেই"}
                        </span>
                        {isNew && <span className="ml-2 inline-block align-middle"><NewFlag /></span>}
                        <span className="block text-[12.5px] text-ink-faint">
                          {r.specialty_bn || "..."}
                          {r.hospital_bn ? ` • ${r.hospital_bn}` : ""}
                        </span>
                      </button>
                    )}
                  </td>
                  <td className="border-b border-[#F1F5F9] px-3.5 py-3">
                    <span className="text-[13.5px] font-semibold text-ink-soft">{r.client_name}</span>
                    <a href={`tel:${r.client_phone}`} className="block font-latin text-[12.5px] text-brand-700">
                      {r.client_phone}
                    </a>
                    {r.client_email && (
                      <a href={`mailto:${r.client_email}`} className="block font-latin text-[12px] text-ink-ghost">
                        {r.client_email}
                      </a>
                    )}
                  </td>
                  <td className="border-b border-[#F1F5F9] px-3.5 py-3 text-[13.5px] text-ink-mute">
                    {[r.area_bn, r.district_bn].filter(Boolean).join(", ") || "..."}
                  </td>
                  <td className="border-b border-[#F1F5F9] px-3.5 py-3 font-latin text-[13.5px] text-ink-mute">
                    {r.fee ? r.fee : "..."}
                  </td>
                  <td className="border-b border-[#F1F5F9] px-3.5 py-3">
                    {pending ? (
                      <StatusBadge tone="amber">জমা পড়েনি</StatusBadge>
                    ) : (
                      <>
                        <StatusBadge tone="green">জমা হয়েছে</StatusBadge>
                        <span className="mt-1 block font-latin text-[12px] text-ink-faint">
                          {dateTime(r.created_at, "en")}
                        </span>
                      </>
                    )}
                  </td>
                  <td className="border-b border-[#F1F5F9] px-3.5 py-3">
                    <div className="flex gap-1.5">
                      {pending ? (
                        <button
                          type="button"
                          onClick={() => copyLink(r)}
                          className="rounded-lg border border-line bg-white px-[11px] py-1.5 text-[12.5px] font-semibold text-brand-600"
                        >
                          {copiedId === r.row_id ? "কপি হয়েছে" : "লিংক কপি"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openRow(r)}
                          className="rounded-lg border border-line bg-white px-[11px] py-1.5 text-[12.5px] font-semibold text-brand-600"
                        >
                          দেখুন
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setConfirm(r)}
                        className="rounded-lg border border-line bg-white px-[11px] py-1.5 text-[12.5px] font-semibold text-[#DC2626]"
                      >
                        মুছুন
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-ink-ghost">
                  এখনো কিছু নেই। উপরের বাটন থেকে লিংক তৈরি করে ক্লায়েন্টকে পাঠান।
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} totalPages={totalPages} locale="bn" perPage={perPage} showPerPageSelector={true} />
      <div className="mt-2 text-[13px] text-ink-ghost">
        মোট <span className="font-latin">{total}</span> টি সারি
      </div>

      <FullPageModal
        isOpen={!!open}
        onClose={() => setOpen(null)}
        title={open ? `ফর্ম: ${open.doctor_name_bn || open.doctor_name_en || ""}` : ""}
      >
        {open && <DetailView row={open} />}
      </FullPageModal>

      {generating && (
        <GenerateLinkModal
          onClose={() => {
            setGenerating(false);
            // A link saved (or simply closed) in the modal becomes a pending row,
            // so the table behind it has to be re-read.
            router.refresh();
          }}
        />
      )}

      {/* Permanent delete. For a submitted form the row, its link and both R2
          images are destroyed; for a pending row only the unused link goes.
          Neither is recoverable, so it asks first. */}
      {confirm && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => !deleting && setConfirm(null)}
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4"
        >
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="mb-2 mt-0 font-heading text-lg font-bold text-ink">নিশ্চিত মুছবেন?</h3>
            {confirm.kind === "pending" ? (
              <p className="mb-4 mt-0 text-sm leading-relaxed text-ink-mute">
                <b>{confirm.client_name}</b> এর জন্য তৈরি করা লিংকটি মুছে যাবে এবং আর কাজ করবে না। ক্লায়েন্টকে আগে
                পাঠিয়ে থাকলে তিনি আর ফর্মটি খুলতে পারবেন না।
              </p>
            ) : (
              <p className="mb-4 mt-0 text-sm leading-relaxed text-ink-mute">
                <b>{confirm.doctor_name_bn || confirm.doctor_name_en}</b> এর জমা দেওয়া ফর্ম, ক্লায়েন্টের তথ্য এবং ছবিগুলো
                ডেটাবেজ ও স্টোরেজ থেকে সম্পূর্ণভাবে মুছে যাবে। এটি আর ফেরানো যাবে না।
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setConfirm(null)}
                className="rounded-lg border border-line bg-white px-4 py-2 text-sm font-semibold text-ink-mute hover:bg-page disabled:opacity-50"
              >
                না
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={performDelete}
                className="rounded-lg bg-[#DC2626] px-4 py-2 text-sm font-bold text-white hover:bg-[#B91C1C] disabled:opacity-60"
              >
                {deleting ? "মুছছি..." : "হ্যাঁ, মুছে ফেলুন"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
