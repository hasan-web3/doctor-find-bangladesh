import { getSettings } from "@/lib/settings";
import { TOOLS, isToolOn } from "@/lib/tools/registry";
import { ToolsManager, type ToolRow } from "./manager";

export const dynamic = "force-dynamic";

export default async function AdminToolsPage() {
  const settings = await getSettings();

  // `enabled` is the RESOLVED state, not the raw stored value: a tool the admin
  // has never touched has no row in tools_enabled and falls back to the
  // registry's own default. Showing the raw value would render every untouched
  // tool as "off" while the public site happily serves it.
  const rows: ToolRow[] = TOOLS.map((t) => ({
    key: t.key,
    slug: t.slug,
    name: t.name.bn || t.name.en,
    nameEn: t.name.en,
    tagline: t.tagline.bn || t.tagline.en,
    source: t.source.bn || t.source.en,
    icon: t.icon,
    bg: t.bg,
    fg: t.fg,
    status: t.status,
    enabled: isToolOn(t, settings.tools_enabled),
    // A planned tool has no calculator behind it, so the switch is inert.
    lockedReason: t.status === "planned" ? "এখনো তৈরি হয়নি" : null,
  })).sort((a, b) => Number(a.status === "planned") - Number(b.status === "planned"));

  return (
    <div>
      <h1 className="mb-1 mt-0 font-heading text-2xl font-bold text-ink">স্বাস্থ্য টুলস</h1>
      <p className="mb-5 mt-0 max-w-[720px] text-sm leading-relaxed text-ink-mute">
        কোন টুলগুলো সাইটে দেখা যাবে তা এখান থেকে ঠিক করুন। বন্ধ করলে টুলটির পেজ, মেনুর তালিকা এবং
        sitemap থেকে সাথে সাথেই সরে যাবে।
      </p>
      <ToolsManager rows={rows} />
    </div>
  );
}
