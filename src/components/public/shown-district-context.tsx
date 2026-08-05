"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

// Which district the doctor list on screen is ACTUALLY showing.
//
// On /doctors the <h1> sits above the filter grid while the cards live inside
// it, so the two cannot be one component without moving the heading. This
// carries the value between them instead.
//
// Why it is not simply the visitor's district: `preferDistrict` on /api/doctors
// is a ranking preference, not a filter. A visitor in a district with no
// doctors still gets results — the nearest district's — so naming their own
// district would caption another district's cards. The list publishes the
// district of its first row, exactly as resolveDisplayDistrict does on the
// server, and the heading reads it back.

type ShownDistrict = {
  name: string | null;
  setName: (name: string | null) => void;
};

const ShownDistrictContext = createContext<ShownDistrict>({ name: null, setName: () => {} });

export function useShownDistrict() {
  return useContext(ShownDistrictContext);
}

export function ShownDistrictProvider({
  /** The district the server named in the cached HTML. */
  initial,
  children,
}: {
  initial: string | null;
  children: React.ReactNode;
}) {
  const [name, setNameState] = useState<string | null>(initial);
  // Stable identity so a list that re-publishes the same district cannot loop.
  const setName = useCallback((next: string | null) => {
    setNameState((prev) => (prev === next ? prev : next ?? initial));
  }, [initial]);

  const value = useMemo(() => ({ name, setName }), [name, setName]);
  return <ShownDistrictContext.Provider value={value}>{children}</ShownDistrictContext.Provider>;
}
