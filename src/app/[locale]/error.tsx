"use client";

import { ErrorView } from "@/components/error-view";

// Root-level error boundary: catches anything thrown below the root layout that
// no closer boundary handled. Locale is read from the URL inside ErrorView, so
// /en/* visitors get English even though this file sits outside [locale].
// The Error object is deliberately not surfaced to the visitor; Next.js still
// logs it server-side.
export default function RootError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorView reset={reset} />;
}
