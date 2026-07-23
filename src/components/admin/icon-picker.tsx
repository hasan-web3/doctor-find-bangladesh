"use client";

import { useState, useMemo } from "react";
import { icons, type LucideProps } from "lucide-react";

interface IconPickerProps {
  value: string;
  onChange: (icon: string) => void;
  className?: string;
}

const iconNames = Object.keys(icons);

const LucideIcon = ({ name, ...props }: { name: string } & LucideProps) => {
  const Icon = icons[name as keyof typeof icons];
  if (!Icon) {
    return null; // Or a fallback icon
  }
  return <Icon {...props} />;
};

export function IconPicker({ value, onChange, className }: IconPickerProps) {
  const [search, setSearch] = useState("");

  // Normalize case (e.g. legacy 'brain' -> 'Brain') so that we can find it in Lucide-react
  const normalizedValue = useMemo(() => {
    if (!value) return "";
    if (icons[value as keyof typeof icons]) return value;
    const lower = value.toLowerCase();
    return iconNames.find((key) => key.toLowerCase() === lower) || value;
  }, [value]);

  const filteredIcons = useMemo(() => {
    if (!search) {
      // Display a curated list of 30+ highly relevant medical and general icons by default on first load
      const curated = [
        "Activity", "Heart", "Brain", "Baby", "Eye", "Stethoscope", "Syringe", "Thermometer", 
        "Pill", "BriefcaseMedical", "Plus", "Shield", "Ear", "Bone", "Clock", "Home", 
        "Phone", "MapPin", "Mail", "User", "Smile", "Star", "Check", "X", 
        "Search", "Settings", "Calendar", "Sparkles", "ClipboardList", "FileText", 
        "Building", "Users", "AlertCircle", "HelpCircle", "LogOut", "Info"
      ];
      
      // If there is an active selected icon, prepend it to the front of the curated list, removing duplicates
      if (normalizedValue && icons[normalizedValue as keyof typeof icons]) {
        return [
          normalizedValue,
          ...curated.filter((icon) => icon.toLowerCase() !== normalizedValue.toLowerCase())
        ];
      }
      
      return curated;
    }
    return iconNames
      .filter((key) => key.toLowerCase().includes(search.toLowerCase()))
      .slice(0, 50); // Limit results for performance
  }, [search, normalizedValue]);

  // When selected icon matches in rendering list, make sure to pass normalized value to onChange on render
  const activeValue = normalizedValue && icons[normalizedValue as keyof typeof icons] ? normalizedValue : value;

  return (
    <div className={className}>
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search for icons..."
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
      />

      <div className="h-60 w-full rounded-md border mt-2 overflow-y-auto">
        <div className="grid grid-cols-8 gap-2 p-3">
          {filteredIcons.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => onChange(key)}
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
              No icons found for &quot;{search}&quot;.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
