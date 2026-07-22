import { getSettings } from "@/lib/settings";
import { toML } from "@/lib/utils";
import { SettingsManager } from "./manager";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const settings = await getSettings();

  return (
    <div>
      <h1 className="mb-5 mt-0 font-heading text-2xl font-bold text-ink">সাইট সেটিংস</h1>
      <SettingsManager
        initial={{
          brand_name: toML(settings.brand_name),
          helpline: settings.helpline,
          helpline_bn: settings.helpline_bn,
          whatsapp: settings.whatsapp,
          email: settings.email,
          address: toML(settings.address),
          facebook: settings.facebook,
          youtube: settings.youtube,
          instagram: settings.instagram,
          logo_url: settings.logo_url,
          show_plans: settings.show_plans,
        }}
        plans={settings.plans.map((p) => ({
          key: p.key,
          name: toML(p.name),
          price: p.price,
          period: toML(p.period),
          popular: p.popular,
          feats: (p.feats || []).map(toML),
        }))}
        stats={settings.stats.map((s) => ({ value: s.value, suffix: s.suffix, label: toML(s.label) }))}
      />
    </div>
  );
}
