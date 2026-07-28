import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ---------- multilingual (bn + en) utilities ----------
export type ML = { bn: string; en: string };
export const emptyML: ML = { bn: "", en: "" };
export const toML = (v: unknown): ML => {
  const obj = (v || {}) as { bn?: string; en?: string };
  return { bn: obj.bn || "", en: obj.en || "" };
};

// ---------- select option lists ----------
// Adds an option to a dropdown's local list unless it is already there. The
// quick-create actions reuse an existing row when the name already exists, so
// the returned row is not guaranteed to be new — pushing it blindly would show
// the same hospital / district twice.
export function withOption<T extends { id: number }>(list: T[], item: T): T[] {
  return list.some((o) => o.id === item.id) ? list : [...list, item];
}

// ---------- doctor socials ----------
export type SocialLinksDraft = {
  website: string;
  linkedin: string;
  facebook: string;
  twitter: string;
  instagram: string;
  youtube: string;
  researchgate: string;
};

export const EMPTY_SOCIAL_LINKS = (): SocialLinksDraft => ({
  website: "",
  linkedin: "",
  facebook: "",
  twitter: "",
  instagram: "",
  youtube: "",
  researchgate: "",
});
