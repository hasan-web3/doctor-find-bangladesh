"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

// Doctor profile photo that opens a full-screen lightbox on click.
// Falls back to initials when no photo. Esc + backdrop-click close the modal.
export function DoctorPhoto({
  src,
  alt,
  initials,
  closeLabel,
}: {
  src: string | null;
  alt: string;
  initials: string;
  closeLabel: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => src && setOpen(true)}
        aria-label={src ? alt : undefined}
        className={`relative block aspect-square w-full max-w-[400px] mx-auto overflow-hidden rounded-[22px] bg-brand-50 shadow-card sm:h-[220px] sm:w-[220px] sm:max-w-none ${
          src ? "cursor-zoom-in transition-transform duration-200 hover:scale-[1.02]" : "cursor-default"
        }`}
      >
        {src ? (
          <Image src={src} alt={alt} fill sizes="(max-width: 640px) 100vw, (max-width: 900px) 60vw, 220px" className="object-cover" priority />
        ) : (
          <span className="flex h-full w-full items-center justify-center font-heading text-[64px] font-semibold text-brand-700">
            {initials}
          </span>
        )}
      </button>

      {open && src && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
        >
          <button
            type="button"
            aria-label={closeLabel}
            onClick={() => setOpen(false)}
            className="absolute right-5 top-5 flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-2xl text-white transition-colors hover:bg-white/25"
          >
            ✕
          </button>
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative flex max-h-[90vh] w-full max-w-[720px] items-center justify-center"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={alt}
              className="max-h-[90vh] w-auto max-w-full rounded-2xl object-contain shadow-[0_20px_50px_rgba(0,0,0,.5)]"
            />
          </div>
        </div>
      )}
    </>
  );
}
