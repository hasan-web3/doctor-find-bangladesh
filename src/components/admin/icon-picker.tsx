"use client";

import { useState, useMemo } from "react";
import { icons, type LucideProps } from "lucide-react";
import { MEDICAL_ICONS } from "./medical-icons";

interface IconPickerProps {
  value: string;
  onChange: (icon: string) => void;
  className?: string;
}

const iconNames = Object.keys(icons);
// Guard against a typo in the curated list: silently drop names lucide no
// longer ships so the picker never renders a blank square.
const CURATED = MEDICAL_ICONS.filter((m) => m.name in icons);

const LucideIcon = ({ name, ...props }: { name: string } & LucideProps) => {
  const Icon = icons[name as keyof typeof icons];
  if (!Icon) return null;
  return <Icon {...props} />;
};

export function IconPicker({ value, onChange, className }: IconPickerProps) {
  const [search, setSearch] = useState("");

  // Normalize legacy lowercase values (e.g. "brain" -> "Brain") so old rows
  // still highlight and re-save cleanly.
  const normalizedValue = useMemo(() => {
    if (!value) return "";
    if (icons[value as keyof typeof icons]) return value;
    const lower = value.toLowerCase();
    return iconNames.find((key) => key.toLowerCase() === lower) || value;
  }, [value]);

  const filteredIcons = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) {
      const list = CURATED.map((m) => m.name);
      if (normalizedValue && icons[normalizedValue as keyof typeof icons]) {
        return [normalizedValue, ...list.filter((n) => n.toLowerCase() !== normalizedValue.toLowerCase())];
      }
      return list;
    }
    // Rank by best match: name-startsWith beats name-contains beats tag-match.
    const scored: { name: string; score: number }[] = [];
    for (const m of CURATED) {
      const nameLower = m.name.toLowerCase();
      let score = 0;
      if (nameLower === q) score = 100;
      else if (nameLower.startsWith(q)) score = 60;
      else if (nameLower.includes(q)) score = 40;
      else if (m.tags.some((t) => t.toLowerCase().includes(q))) score = 20;
      if (score > 0) scored.push({ name: m.name, score });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.map((s) => s.name);
  }, [search, normalizedValue]);

  const activeValue = normalizedValue && icons[normalizedValue as keyof typeof icons] ? normalizedValue : value;

  return (
    <div className={className}>
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="আইকন খুঁজুন — heart, kidney, dental, চোখ..."
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
      />

      <div className="h-60 w-full rounded-md border mt-2 overflow-y-auto">
        <div className="grid grid-cols-8 gap-2 p-3">
          {filteredIcons.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => onChange(key)}
              title={key}
              className={`flex items-center justify-center rounded-lg border-2 p-2 transition-colors ${
                activeValue === key
                  ? "border-brand-600 bg-brand-50 text-brand-700"
                  : "border-transparent text-slate-500 hover:bg-slate-100"
              }`}
              aria-label={key}
            >
              <LucideIcon name={key} size={22} />
            </button>
          ))}
          {search && filteredIcons.length === 0 && (
            <div className="col-span-8 py-4 text-center text-sm text-slate-500">
              &quot;{search}&quot; এর জন্য কোনো আইকন নেই।
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
