import { icons, type LucideProps } from "lucide-react";

// Legacy hard-coded icons for backward compatibility
const PATHS: Record<string, string[]> = {
  heart: ["M12 20s-6.6-4.4-9.1-8.1A5 5 0 0 1 12 6a5 5 0 0 1 9.1 5.9C18.6 15.6 12 20 12 20z"],
  brain: ["M9 4a2.5 2.5 0 0 0-2.5 2.5A3 3 0 0 0 6 12a3 3 0 0 0 3 3M9 4a2 2 0 0 1 3 1.7V17a2 2 0 0 1-3 1.7M15 4a2.5 2.5 0 0 1 2.5 2.5A3 3 0 0 1 18 12a3 3 0 0 1-3 3M15 4a2 2 0 0 0-3 1.7"],
  baby: ["M12 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4z", "M7 21v-2a5 5 0 0 1 10 0v2", "M9 12h.01", "M15 12h.01"],
  female: ["M12 3a5 5 0 1 0 0 10 5 5 0 0 0 0-10z", "M12 13v8", "M9 18h6"],
  eye: ["M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z", "M12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z"],
  tooth: ["M8 3c-2 0-4 1.4-4 4.6 0 2 .6 3.6 1.2 6C6 15.8 6.4 21 8 21c1.3 0 1.2-4.3 2-6.6.4-1.1 1.6-1.1 2 0C12.8 16.7 12.7 21 14 21c1.6 0 2-5.2 2.8-7.4C17.4 11.2 18 9.6 18 7.6 18 4.4 16 3 14 3c-1.4 0-2.5 1-3 1s-1.6-1-3-1z"],
  droplet: ["M12 3s6 6 6 11a6 6 0 0 1-12 0c0-5 6-11 6-11z"],
  activity: ["M3 12h4l2.5-7 4 15 2.5-8h5"],
  shield: ["M12 3l8 3v5c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6z", "M9 12l2 2 4-4"],
  ear: ["M18 8A6 6 0 1 0 6 8c0 2 1 3 1 5", "M9 13a3 3 0 0 1 6 0c0 3-2 3-2 6a3 3 0 0 1-3 0"],
  bone: ["M10 10l4 4", "M8 5a2 2 0 1 0-2 2 2 2 0 1 0 2-2z", "M18 17a2 2 0 1 0 2-2 2 2 0 1 0-2 2z"],
  cross: ["M12 4v16", "M4 12h16"],
  search: ["M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z", "M20 20l-3.5-3.5"],
  calendar: ["M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z", "M4 9h16", "M8 3v4", "M16 3v4"],
  phone: ["M4 5a2 2 0 0 1 2-2h2l2 5-2 1a11 11 0 0 0 5 5l1-2 5 2v2a2 2 0 0 1-2 2A16 16 0 0 1 4 5z"],
  pin: ["M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z", "M12 10a2 2 0 1 0 0-.01z"],
  mail: ["M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z", "m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"],
  user: ["M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", "M5 21a7 7 0 0 1 14 0"],
  chart: ["M4 20V10", "M10 20V4", "M16 20v-8", "M22 20H2"],
  building: ["M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16", "M16 8h2a2 2 0 0 1 2 2v11", "M8 7h2", "M8 11h2", "M8 15h2"],
  clock: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z", "M12 7v5l3 2"],
  book: ["M4 5a2 2 0 0 1 2-2h11v16H6a2 2 0 0 0-2 2z", "M17 3v16"],
  leaf: ["M4 20c0-8 6-14 16-14 0 10-6 16-16 14z", "M8 16c3-3 5-5 8-6"],
  apple: ["M12 8c-1-3-4-3-5-1s0 5 5 8c5-3 6-6 5-8s-4-2-5 1z", "M12 6c0-2 1-3 3-3"],
  run: ["M13 5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z", "M7 21l3-6 3 2 1 4", "M13 11l4 1", "M10 15l-2-3 4-3 3 3"],
  home: ["M3 11l9-8 9 8", "M5 10v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V10", "M10 21v-6h4v6"],
};

export const ICON_KEYS = Object.keys(PATHS);

export function Icon({ name, size = 26, className }: { name: string; size?: number; className?: string }) {
  // Check if the icon exists in the full lucide-react map first
  const LucideIcon = icons[name as keyof typeof icons];
  if (LucideIcon) {
    return <LucideIcon size={size} className={className} strokeWidth={1.7} />;
  }

  // Fallback to legacy hard-coded icons
  const paths = PATHS[name] || PATHS.cross;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}

export function Logo({ light = false, size = 34 }: { light?: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
      <path
        d="M16 2.5c-5.2 0-9.5 4-9.5 9.2 0 6.4 9.5 16.3 9.5 16.3s9.5-9.9 9.5-16.3c0-5.2-4.3-9.2-9.5-9.2z"
        fill={light ? "#5EEAD4" : "#0D9488"}
      />
      <path d="M16 7v9M11.5 11.5h9" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" />
    </svg>
  );
}
