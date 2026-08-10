"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteFaq, saveFaq } from "@/actions/admin-content";
import { Toast, StatusBadge, ConfirmButton } from "@/components/admin/ui";
import { toML } from "@/lib/utils";
import type { ML } from "@/lib/utils";
import { FullPageModal } from "@/components/admin/full-page-modal";
import { FaqForm, emptyFaq, type FaqDraft } from "./form";
import type { FaqSeed } from "@/lib/faq-defaults";

export type FaqRow = {
  id: number; scope: string; ref_id: number | null; question: unknown; answer: unknown;
  sort: number; active: boolean; auto_key: string | null;
};

// How a single line in the list came to exist.
//   generated  — no row in the database; the text comes from faq-defaults.ts
//   edited     — a row carrying the same auto_key, replacing the generated text
//   deleted    — that row with active = false, suppressing the generated text
//   manual     — an ordinary hand-written FAQ (auto_key NULL)
//   superseded — a hand-written FAQ asks the same question, so the public page
//                shows that one instead of this generated twin
type Origin = "generated" | "edited" | "deleted" | "manual" | "superseded";

type Item = {
  key: string;
  /** null while the FAQ is still purely generated. */
  id: number | null;
  autoKey: string | null;
  question: ML;
  answer: ML;
  sort: number;
  active: boolean;
  origin: Origin;
};

const ORIGIN_BADGE: Record<Origin, { tone: "green" | "blue" | "amber" | "red" | "gray"; label: string }> = {
  generated: { tone: "blue", label: "স্বয়ংক্রিয়" },
  edited: { tone: "green", label: "সম্পাদিত" },
  deleted: { tone: "gray", label: "মুছে ফেলা" },
  manual: { tone: "amber", label: "নিজে লেখা" },
  superseded: { tone: "gray", label: "নিজের লেখা দিয়ে প্রতিস্থাপিত" },
};

export function FaqsManager({
  rows,
  seeds,
  scope,
  refId,
  refLabel,
}: {
  rows: FaqRow[];
  /** Generated defaults for this entity, in their canonical order. */
  seeds: FaqSeed[];
  scope: string;
  refId: number | null;
  refLabel: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [editing, setEditing] = useState<FaqDraft | null>(null);

  // Merge exactly the way the public page does (getFaqsWithDefaults in
  // data.ts), so what the dashboard lists is what visitors get. The one
  // difference is that suppressed entries are still SHOWN here, greyed out,
  // because the admin needs a way to bring them back.
  const items = useMemo<Item[]>(() => {
    const byKey = new Map<string, FaqRow>();
    const manual: FaqRow[] = [];
    for (const r of rows) {
      if (r.auto_key) byKey.set(r.auto_key, r);
      else manual.push(r);
    }

    // Same rule the public page applies (getFaqsWithDefaults in data.ts): a
    // hand-written FAQ asking the same question replaces its generated twin.
    const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();
    const manualQuestions = new Set(manual.filter((r) => r.active).map((r) => norm(toML(r.question).bn || "")));

    const out: Item[] = (seeds.map((seed, i) => {
      const hit = byKey.get(seed.key);
      // Deleted generated FAQs are gone for good: the tombstone row keeps them
      // from coming back, but nothing in the dashboard offers to restore them.
      if (hit && !hit.active) return null;
      if (!hit && manualQuestions.has(norm(seed.question.bn))) {
        return {
          key: seed.key, id: null, autoKey: seed.key,
          question: { ...seed.question }, answer: { ...seed.answer },
          sort: i, active: false, origin: "superseded",
        };
      }
      if (hit) {
        return {
          key: seed.key,
          id: hit.id,
          autoKey: seed.key,
          question: toML(hit.question),
          answer: toML(hit.answer),
          sort: hit.sort,
          active: hit.active,
          origin: "edited" as Origin,
        };
      }
      return {
        key: seed.key,
        id: null,
        autoKey: seed.key,
        question: { ...seed.question },
        answer: { ...seed.answer },
        sort: i,
        active: true,
        origin: "generated" as Origin,
      };
    }).filter(Boolean) as Item[]);

    // An override whose seed no longer exists (the generator changed, or the
    // entity lost the data that produced it). Surfaced rather than hidden so it
    // can be cleaned up instead of lingering invisibly. Tombstones are skipped
    // for the same reason as above: a deletion is final.
    const seedKeys = new Set(seeds.map((s) => s.key));
    for (const [key, r] of byKey) {
      if (seedKeys.has(key) || !r.active) continue;
      out.push({
        key: `orphan-${key}`,
        id: r.id,
        autoKey: key,
        question: toML(r.question),
        answer: toML(r.answer),
        sort: r.sort,
        active: r.active,
        origin: "edited",
      });
    }

    for (const r of manual) {
      out.push({
        key: `manual-${r.id}`,
        id: r.id,
        autoKey: null,
        question: toML(r.question),
        answer: toML(r.answer),
        sort: r.sort,
        active: r.active,
        origin: "manual",
      });
    }
    return out;
  }, [rows, seeds]);

  const run = (fn: () => Promise<{ ok: boolean; message: string }>) =>
    startTransition(async () => {
      const res = await fn();
      setResult(res);
      router.refresh();
    });

  // Deleting a generated FAQ cannot be a DELETE: there is no row to remove.
  // It writes a tombstone instead (the same content with active = false), which
  // both suppresses the answer publicly and records what was removed.
  const suppress = (item: Item) =>
    run(() =>
      saveFaq({
        id: item.id ?? undefined,
        scope,
        ref_id: refId,
        auto_key: item.autoKey,
        question: item.question,
        answer: item.answer,
        sort: item.sort,
        active: false,
      })
    );

  // Restoring, and resetting an edited FAQ back to the generated text, are the
  // same operation: drop the override row and let the generator take over.
  const resetToGenerated = (item: Item) => run(() => deleteFaq(item.id!));

  const startNew = () => setEditing(emptyFaq(scope, refId, seeds.length + rows.length));

  const generatedCount = items.filter((i) => i.origin === "generated").length;

  return (
    <div>
      <Toast result={result} />

      <div className="mb-4 rounded-[14px] border border-brand-200 bg-brand-50/50 p-4 text-[13.5px] leading-relaxed text-ink-mute">
        নীল <b>স্বয়ংক্রিয়</b> FAQ গুলো এই পেজের নিজের তথ্য থেকে নিজে থেকেই তৈরি হয়েছে, কিছু লিখতে হয়নি। এগুলো এডিট
        করলে আপনার লেখা স্থায়ী হয়ে যায়, আর মুছলে ওই পেজে দেখানো বন্ধ হয়। যেকোনো সময় আবার আগের অবস্থায় ফেরানো যায়।
      </div>

      <div className="mb-4 flex items-center justify-between gap-3">
        <span className="text-sm text-ink-faint">
          {items.length > 0
            ? `${items.length} টি FAQ${generatedCount > 0 ? ` · ${generatedCount} টি স্বয়ংক্রিয়` : ""}`
            : "এখনো কোনো FAQ নেই"}
        </span>
        <button
          onClick={startNew}
          className="rounded-[10px] bg-brand-600 px-[18px] py-2.5 text-sm font-bold text-white hover:bg-brand-700"
        >
          + নতুন FAQ
        </button>
      </div>

      <FullPageModal
        isOpen={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? "FAQ এডিট" : "নতুন FAQ"}
        hideHeader={true}
      >
        {editing && (
          <FaqForm
            initial={editing}
            refLabel={refLabel}
            onFinished={() => {
              setEditing(null);
              router.refresh();
            }}
          />
        )}
      </FullPageModal>

      {items.length === 0 ? (
        <div className="rounded-[14px] border border-dashed border-line bg-white p-10 text-center">
          <p className="mb-4 text-sm text-ink-faint">
            এই পেজে এখনো কোনো ডাক্তার নেই, তাই স্বয়ংক্রিয় FAQ তৈরি হয়নি। ডাক্তার যুক্ত হলে নিজে থেকেই চলে আসবে।
            চাইলে এখনই নিজে লিখেও যোগ করতে পারেন।
          </p>
          <button
            onClick={startNew}
            className="rounded-[10px] bg-brand-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-700"
          >
            + FAQ যোগ করুন
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((item) => {
            const badge = ORIGIN_BADGE[item.origin];
            const muted = item.origin === "deleted" || !item.active;
            return (
              <div
                key={item.key}
                className={`flex flex-wrap items-start gap-3.5 rounded-[14px] border border-line bg-white p-[18px] ${muted ? "opacity-60" : ""}`}
              >
                <div className="min-w-[220px] flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className="text-[15px] font-semibold text-ink">{item.question.bn}</span>
                    <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>
                    {!item.answer.en?.trim() && <StatusBadge tone="amber">ইংরেজি নেই</StatusBadge>}
                  </div>
                  <p className="m-0 text-sm text-ink-mute">{item.answer.bn}</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {item.origin === "superseded" ? (
                    <span className="max-w-[220px] text-[12.5px] leading-snug text-ink-faint">
                      নিচে আপনার নিজের লেখা একই প্রশ্ন আছে, তাই পেজে সেটিই দেখাচ্ছে
                    </span>
                  ) : (
                    <>
                      <button
                        onClick={() =>
                          setEditing({
                            id: item.id ?? undefined,
                            scope,
                            ref_id: refId,
                            auto_key: item.autoKey,
                            question: item.question,
                            answer: item.answer,
                            sort: item.sort,
                            active: item.active,
                          })
                        }
                        className="rounded-[9px] border border-line bg-white px-3.5 py-2 text-[13px] font-semibold text-brand-600"
                      >
                        এডিট
                      </button>

                      {item.origin === "edited" && (
                        <button
                          disabled={pending}
                          onClick={() => resetToGenerated(item)}
                          className="rounded-[9px] border border-line bg-white px-3.5 py-2 text-[13px] font-semibold text-ink-mute disabled:opacity-60"
                          title="নিজের লেখা বাদ দিয়ে স্বয়ংক্রিয় লেখায় ফিরে যান"
                        >
                          রিসেট
                        </button>
                      )}

                      {item.autoKey ? (
                        <ConfirmButton onConfirm={() => suppress(item)} />
                      ) : (
                        <ConfirmButton onConfirm={() => run(() => deleteFaq(item.id!))} />
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
