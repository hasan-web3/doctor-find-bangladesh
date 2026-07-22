"use client";

import { useEffect } from "react";
import Script from "next/script";

// Lightweight reCAPTCHA v3 bootstrapper.
// When mounted with a site key, it loads the Google script and swaps every
// form-submit into: fetch fresh token -> inject hidden `recaptcha_token` field
// -> submit. All existing forms keep working unchanged; when reCAPTCHA is
// disabled in admin, this component renders nothing and forms submit as-is.
declare global {
  interface Window {
    grecaptcha?: {
      ready: (cb: () => void) => void;
      execute: (siteKey: string, opts: { action: string }) => Promise<string>;
    };
  }
}

export function RecaptchaGuard({ siteKey }: { siteKey: string | null }) {
  useEffect(() => {
    if (!siteKey) return;

    const handler = (ev: SubmitEvent) => {
      const form = ev.target as HTMLFormElement | null;
      if (!form || !(form instanceof HTMLFormElement)) return;
      // Only intercept forms whose action is a Next.js server action.
      // React server actions submit with a function reference on `form.action`
      // internally, but the DOM `action` attribute is empty — that's our signal.
      if (form.dataset.recaptchaDone === "1") return;

      const grecaptcha = window.grecaptcha;
      if (!grecaptcha) return;

      ev.preventDefault();
      grecaptcha.ready(() => {
        grecaptcha
          .execute(siteKey, { action: "submit" })
          .then((token) => {
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
          })
          .catch(() => {
            // If the token can't be fetched, let the form submit anyway;
            // the server treats a missing token as a fail-open only when the
            // integration is off, otherwise it rejects.
            form.dataset.recaptchaDone = "1";
            form.requestSubmit();
          });
      });
    };

    document.addEventListener("submit", handler, true);
    return () => document.removeEventListener("submit", handler, true);
  }, [siteKey]);

  if (!siteKey) return null;
  return (
    <Script src={`https://www.google.com/recaptcha/api.js?render=${siteKey}`} strategy="afterInteractive" />
  );
}
