// GENERATED — do not edit by hand. Regeneration snippet lives in the "Icons"
// note at the top of src/components/icons.tsx.
//
// Scope on purpose: these are the icon values PRESENT IN THE DATABASE, not the
// whole curated picker list. Two measured reasons:
//
//   1. icons.tsx is reached from the navbar and footer, so whatever it imports
//      lands in the chunk shared by EVERY route. Importing all 208 curated
//      icons put 34 kB on /privacy and /terms, pages that render no icon at
//      all — the shared bundle went 102 kB -> 136 kB.
//   2. A runtime lookup over lucide's full icon map (what this replaced) is
//      unshakeable and cost 419 KB raw on every page that renders an icon.
//
// So: the small set everyone pays for is the set actually in use, and an icon
// an admin picks later arrives through LucideLazy as its own chunk.

import type { LucideIcon } from "lucide-react";

import {
  Baby,
  Bed,
  Bone,
  Brain,
  BrainCircuit,
  BriefcaseMedical,
  Bug,
  Carrot,
  ContactRound,
  Droplets,
  Dumbbell,
  Feather,
  Glasses,
  Hand,
  Heart,
  HeartPulse,
  PersonStanding,
  Scan,
  Scissors,
  ShieldPlus,
  Siren,
  Smile,
  Snowflake,
  Sparkles,
  Stethoscope,
  Syringe,
  UserRound,
  UserX,
  Vault,
  Wind,
} from "lucide-react";

export const ICON_MAP: Record<string, LucideIcon> = {
  Baby,
  Bed,
  Bone,
  Brain,
  BrainCircuit,
  BriefcaseMedical,
  Bug,
  Carrot,
  ContactRound,
  Droplets,
  Dumbbell,
  Feather,
  Glasses,
  Hand,
  Heart,
  HeartPulse,
  PersonStanding,
  Scan,
  Scissors,
  ShieldPlus,
  Siren,
  Smile,
  Snowflake,
  Sparkles,
  Stethoscope,
  Syringe,
  UserRound,
  UserX,
  Vault,
  Wind,
};
