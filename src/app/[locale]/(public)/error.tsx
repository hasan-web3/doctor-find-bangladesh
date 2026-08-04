"use client";

import { ErrorView } from "@/components/error-view";

// Public-segment boundary. It sits inside PublicLayout, so a failing page keeps
// the navbar, footer and bottom nav and the visitor can navigate away instead
// of landing on a bare error screen. Errors in the layout itself fall through
// to src/app/error.tsx.
export default function PublicError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorView reset={reset} />;
}
