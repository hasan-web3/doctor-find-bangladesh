"use client";

import { useState, useCallback, useRef } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { RichTextEditor } from "./rich-text";

// ---------- shared form primitives ----------
export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <label className="mb-1.5 block text-[13px] font-semibold text-ink-soft">{label}</label>
      {children}
      {hint && <div className="mt-1 text-xs text-ink-ghost">{hint}</div>}
    </div>
  );
}

export const inputCls =
  "w-full rounded-[10px] border border-line bg-white px-[13px] py-[11px] text-[14.5px] outline-none focus:border-brand-600";

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-sm text-ink-mute">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-6 w-11 rounded-full transition-colors",
          checked ? "bg-brand-600" : "bg-line"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all",
            checked ? "left-[22px]" : "left-0.5"
          )}
        />
      </button>
      {label}
    </label>
  );
}

export function StatusBadge({ tone, children }: { tone: "green" | "blue" | "amber" | "red" | "gray"; children: React.ReactNode }) {
  const tones = {
    green: "bg-accent-soft text-accent-text",
    blue: "bg-[#EFF6FF] text-[#2563EB]",
    amber: "bg-[#FFFBEB] text-[#B45309]",
    red: "bg-[#FEF2F2] text-[#DC2626]",
    gray: "bg-[#F1F5F9] text-ink-mute",
  };
  return (
    <span className={cn("inline-block whitespace-nowrap rounded-full px-[11px] py-1 text-xs font-bold", tones[tone])}>
      {children}
    </span>
  );
}

export function Toast({ result }: { result: { ok: boolean; message: string } | null }) {
  if (!result) return null;
  return (
    <div
      className={cn(
        "mb-4 rounded-xl border px-4 py-3 text-sm font-semibold",
        result.ok
          ? "border-[#86EFAC] bg-accent-soft text-accent-text"
          : "border-[#FECACA] bg-[#FEF2F2] text-[#DC2626]"
      )}
    >
      {result.message}
    </div>
  );
}

export function ConfirmButton({
  onConfirm,
  label = "মুছুন",
  confirmLabel = "নিশ্চিত?",
  className,
}: {
  onConfirm: () => void;
  label?: string;
  confirmLabel?: string;
  className?: string;
}) {
  const [arm, setArm] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        if (arm) { onConfirm(); setArm(false); }
        else { setArm(true); setTimeout(() => setArm(false), 2500); }
      }}
      className={cn(
        "rounded-lg border px-[11px] py-1.5 text-[12.5px] font-semibold",
        arm ? "border-[#DC2626] bg-[#DC2626] text-white" : "border-line bg-white text-[#DC2626]",
        className
      )}
    >
      {arm ? confirmLabel : label}
    </button>
  );
}

import { type ML } from "@/lib/utils";

// Side-by-side Bangla (required) + English (optional) text inputs.
// Set `richText` for a full HTML editor (bold, lists, links, headings) on both sides.
export function MLInput({
  label,
  value,
  onChange,
  required = false,
  textarea = false,
  richText = false,
  rows = 3,
  hint,
}: {
  label: string;
  value: ML;
  onChange: (v: ML) => void;
  required?: boolean;
  textarea?: boolean;
  richText?: boolean;
  rows?: number;
  hint?: string;
}) {
  const common = inputCls + (textarea ? " resize-y font-body" : "");
  return (
    <div>
      <label className="mb-1.5 block text-[13px] font-semibold text-ink-soft">
        {label}
        {required && <span className="mr-1 text-[#DC2626]"> *</span>}
      </label>
      <div className={`grid grid-cols-1 gap-2 sm:grid-cols-2`}>
        <div>
          <div className="mb-1 text-[11px] font-bold text-brand-600">বাংলা {required ? "(আবশ্যক)" : ""}</div>
          {richText ? (
            <RichTextEditor value={value.bn} onChange={(html) => onChange({ ...value, bn: html })} />
          ) : textarea ? (
            <textarea rows={rows} className={common} value={value.bn} onChange={(e) => onChange({ ...value, bn: e.target.value })} />
          ) : (
            <input className={common} value={value.bn} onChange={(e) => onChange({ ...value, bn: e.target.value })} />
          )}
        </div>
        <div>
          <div className="mb-1 text-[11px] font-bold text-ink-ghost">English (optional)</div>
          {richText ? (
            <RichTextEditor value={value.en} onChange={(html) => onChange({ ...value, en: html })} />
          ) : textarea ? (
            <textarea rows={rows} className={common + " font-latin"} value={value.en} onChange={(e) => onChange({ ...value, en: e.target.value })} />
          ) : (
            <input className={common + " font-latin"} value={value.en} onChange={(e) => onChange({ ...value, en: e.target.value })} />
          )}
        </div>
      </div>
      {hint && <div className="mt-1 text-xs text-ink-ghost">{hint}</div>}
    </div>
  );
}

// ---------- reusable image upload (drag & drop / click) ----------
// Emits a data URL upward; the server action uploads to Cloudinary and
// destroys the previous asset. Used across all admin forms.
export function ImageUpload({
  currentUrl,
  onChange,
  onRemove,
  label = "ছবি",
  aspect = "aspect-square",
}: {
  currentUrl: string | null;
  onChange: (dataUrl: string) => void;
  onRemove?: () => void;
  label?: string;
  aspect?: string;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const readFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith("image/")) return;
      if (file.size > 8 * 1024 * 1024) {
        alert("ছবির সাইজ সর্বোচ্চ ৮ মেগাবাইট হতে পারবে");
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = String(reader.result);
        setPreview(dataUrl);
        onChange(dataUrl);
      };
      reader.readAsDataURL(file);
    },
    [onChange]
  );

  const shown = preview || currentUrl;

  return (
    <div>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          const file = e.dataTransfer.files?.[0];
          if (file) readFile(file);
        }}
        className={cn(
          "relative flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed transition-colors",
          aspect,
          drag ? "border-brand-600 bg-brand-50" : "border-line bg-page hover:border-brand-300"
        )}
      >
        {shown ? (
          // Data URLs can't go through next/image optimization; plain img is correct here.
          // eslint-disable-next-line @next/next/no-img-element
          preview ? (
            <img src={preview} alt={label} className="h-full w-full object-cover" />
          ) : (
            <Image src={shown} alt={label} fill sizes="300px" className="object-cover" />
          )
        ) : (
          <div className="p-4 text-center text-[13px] text-ink-ghost">
            {label} আপলোড করতে ক্লিক করুন
            <br />
            <span className="text-xs">অথবা টেনে এনে ছাড়ুন</span>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) readFile(file);
            e.target.value = "";
          }}
        />
      </div>
      {shown && onRemove && (
        <button
          type="button"
          onClick={() => { setPreview(null); onRemove(); }}
          className="mt-2 text-[12.5px] font-semibold text-[#DC2626]"
        >
          ছবি মুছে ফেলুন
        </button>
      )}
    </div>
  );
}
