"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

// Which district the doctor list on screen is ACTUALLY showing.
//
// Every place name on a page has to agree with the doctors listed on it, and
// those two things are computed in different components: the list fetches, the
// headings and area chips only render. This carries the answer between them.
//
// Why it is not simply the visitor's district: `preferDistrict` on /api/doctors
// is a ranking preference, not a filter. A visitor in a district with no
// doctors still gets results — the nearest district's — so naming their own
// district would caption another district's cards. The list publishes the
// district of its first row, exactly as resolveDisplayDistrict does on the
// server, and everything else reads it back.
//
// Both halves travel together: `name` for copy, `slug` for links.

export type ShownDistrictValue = {
  name: string | null;
  slug: string | null;
  set: (next: { name: string | null; slug: string | null }) => void;
};

const ShownDistrictContext = createContext<ShownDistrictValue>({
  name: null,
  slug: null,
  set: () => {},
});

export function useShownDistrict() {
  return useContext(ShownDistrictContext);
}

export function ShownDistrictProvider({
  /** District the server named in the cached HTML. */
  initialName,
  initialSlug = null,
  children,
}: {
  initialName: string | null;
  initialSlug?: string | null;
  children: React.ReactNode;
}) {
  const [state, setState] = useState<{ name: string | null; slug: string | null }>({
    name: initialName,
    slug: initialSlug,
  });

  // Falls back to the server's values rather than going blank, and bails out
  // when nothing changed so a list re-publishing the same district cannot loop.
  const set = useCallback(
    (next: { name: string | null; slug: string | null }) => {
      setState((prev) => {
        const name = next.name ?? initialName;
        const slug = next.slug ?? initialSlug;
        if (prev.name === name && prev.slug === slug) return prev;
        return { name, slug };
      });
    },
    [initialName, initialSlug]
  );

  const value = useMemo<ShownDistrictValue>(
    () => ({ name: state.name, slug: state.slug, set }),
    [state.name, state.slug, set]
  );

  return <ShownDistrictContext.Provider value={value}>{children}</ShownDistrictContext.Provider>;
}
