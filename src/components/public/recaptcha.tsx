"use client";

import { useEffect, useState } from "react";
import Script from "next/script";

// reCAPTCHA v3 bootstrapper. Two responsibilities:
//   1. Load Google's ~200KB SDK ONLY on pages that actually host a <form>,
//      so listing/detail pages don't pay the network + main-thread cost.
//   2. Intercept form submits, fetch a fresh token, and inject it before
//      React's server-action handler sees the FormData.
//
// The interception uses `stopImmediatePropagation` on a document-capture
// submit listener. Naive `preventDefault` alone would still let React's
// action fire (React reads FormData via its own submit handler, not via
// the browser's native submission), causing the FIRST submit to hit the
// server without a token — the exact failure that produced the previous
// "স্প্যাম যাচাই ব্যর্থ" errors on the contact page.

declare global {
  interface Window {
    grecaptcha?: {
      ready: (cb: () => void) => void;
      execute: (siteKey: string, opts: { action: string }) => Promise<string>;
    };
  }
}

export function RecaptchaGuard({ siteKey }: { siteKey: string | null }) {
  // Gate script loading on the presence of a <form>. Set true either
  // immediately (form already in DOM on mount) or via MutationObserver
  // (a client-rendered form appearing later).
  const [needsScript, setNeedsScript] = useState(false);

  useEffect(() => {
    if (!siteKey) return;
    if (document.querySelector("form")) {
      setNeedsScript(true);
      return;
    }
    const mo = new MutationObserver(() => {
      if (document.querySelector("form")) {
        setNeedsScript(true);
        mo.disconnect();
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, [siteKey]);

  useEffect(() => {
    if (!siteKey || !needsScript) return;

    const handler = (ev: SubmitEvent) => {
      const form = ev.target as HTMLFormElement | null;
      if (!form || !(form instanceof HTMLFormElement)) return;
      if (form.dataset.recaptchaDone === "1") return;

      const grecaptcha = window.grecaptcha;
      if (!grecaptcha) return; // script still loading; let React handle it — worst case is a "reload" hint

      // Kill BOTH the browser default AND React's synthetic submit handler
      // in one shot. Without stopImmediatePropagation, React's server-action
      // pipeline fires this event unchanged (no token) then again after our
      // async requestSubmit() — the first hit fails verification.
      ev.preventDefault();
      ev.stopImmediatePropagation();

      grecaptcha.ready(() => {
        grecaptcha
          .execute(siteKey, { action: "submit" })
          .then((token) => attachTokenAndResubmit(form, token))
          .catch(() => attachTokenAndResubmit(form, ""));
      });
    };

    document.addEventListener("submit", handler, true);
    return () => document.removeEventListener("submit", handler, true);
  }, [siteKey, needsScript]);

  if (!siteKey || !needsScript) return null;
  return (
    <Script
      src={`https://www.google.com/recaptcha/api.js?render=${siteKey}`}
      strategy="afterInteractive"
    />
  );
}

function attachTokenAndResubmit(form: HTMLFormElement, token: string) {
  let input = form.querySelector<HTMLInputElement>('input[name="recaptcha_token"]');
  if (!input) {
    input = document.createElement("input");
    input.type = "hidden";
    input.name = "recaptcha_token";
    form.appendChild(input);
  }
  input.value = token;
  form.dataset.recaptchaDone = "1";
  form.requestSubmit();
}
