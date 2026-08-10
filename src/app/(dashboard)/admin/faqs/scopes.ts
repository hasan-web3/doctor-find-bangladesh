// The FAQ scope table, shared by the page, the pickers and the form.
//
// Keep in sync with the `faq_scope` enum in src/db/schema.ts and `faqSchema`
// in src/actions/admin-content.ts. `home` is the only scope with no entity
// behind it — its FAQs hang off the homepage and carry ref_id = NULL.

export const FAQ_SCOPES = [
  { value: "home", label: "হোমপেজ", plural: "হোমপেজ", hasEntity: false },
  { value: "specialty", label: "বিভাগ", plural: "বিশেষজ্ঞ বিভাগ", hasEntity: true },
  { value: "district", label: "জেলা", plural: "জেলা", hasEntity: true },
  { value: "area", label: "থানা / উপজেলা", plural: "থানা / উপজেলা", hasEntity: true },
  { value: "hospital", label: "হাসপাতাল", plural: "হাসপাতাল", hasEntity: true },
  { value: "doctor", label: "ডাক্তার", plural: "ডাক্তার", hasEntity: true },
] as const;

export type FaqScope = (typeof FAQ_SCOPES)[number]["value"];

export function isFaqScope(v: string | undefined | null): v is FaqScope {
  return !!v && FAQ_SCOPES.some((s) => s.value === v);
}

export function scopeMeta(scope: FaqScope) {
  return FAQ_SCOPES.find((s) => s.value === scope)!;
}

export function scopeLabel(scope: string): string {
  return FAQ_SCOPES.find((s) => s.value === scope)?.label ?? scope;
}

/** Short instruction shown above the entity picker for each scope. */
export const SCOPE_HINT: Record<FaqScope, string> = {
  home: "হোমপেজের FAQ সরাসরি এখানে যোগ করুন।",
  specialty: "যে বিভাগের পেজে FAQ দেখাতে চান সেটি বেছে নিন।",
  district: "যে জেলার পেজে FAQ দেখাতে চান সেটি বেছে নিন।",
  area: "যে থানা বা উপজেলার পেজে FAQ দেখাতে চান সেটি বেছে নিন।",
  hospital: "যে হাসপাতালের পেজে FAQ দেখাতে চান সেটি বেছে নিন।",
  doctor: "যে ডাক্তারের প্রোফাইলে FAQ দেখাতে চান সেটি বেছে নিন।",
};
