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
