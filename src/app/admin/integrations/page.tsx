import { getIntegration, INTEGRATION_FIELDS, type IntegrationKey } from "@/lib/integrations";
import { IntegrationsManager, type IntegrationView } from "./manager";

export const dynamic = "force-dynamic";

export default async function AdminIntegrationsPage() {
  const keys = Object.keys(INTEGRATION_FIELDS) as IntegrationKey[];
  const items: IntegrationView[] = [];

  for (const key of keys) {
    const row = await getIntegration(key);
    const def = INTEGRATION_FIELDS[key];
    items.push({
      key,
      label_bn: def.label_bn,
      desc_bn: def.desc_bn,
      fields: def.fields,
      enabled: row?.enabled ?? false,
      status: row?.status ?? "never",
      status_message: row?.status_message ?? null,
      last_tested_at: row?.last_tested_at ?? null,
      // Secrets are masked before reaching the client; saving keeps old values
      // for untouched masked fields.
      config: Object.fromEntries(
        def.fields.map((f) => {
          const value = row?.config?.[f.name] || "";
          return [f.name, f.secret && value ? "••••••••" : value];
        })
      ),
    });
  }

  return (
    <div>
      <h1 className="mb-1 mt-0 font-heading text-2xl font-bold text-ink">ইন্টিগ্রেশন</h1>
      <p className="mb-6 mt-0 text-sm text-ink-faint">
        তৃতীয় পক্ষের সার্ভিসের API কী এখানে যোগ, টেস্ট ও আপডেট করুন। সব ক্রেডেনশিয়াল ডাটাবেসে এনক্রিপ্ট করে রাখা হয়। কোনো ইন্টিগ্রেশন বন্ধ থাকলেও সাইট স্বাভাবিকভাবে চলবে।
      </p>
      <IntegrationsManager items={items} />
    </div>
  );
}
