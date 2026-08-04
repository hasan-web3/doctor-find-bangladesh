import { sql } from "drizzle-orm";
import { db } from "@/db";
import { getSettings } from "@/lib/settings";
import { toML } from "@/lib/utils";
import { SeoManager } from "./manager";

export const dynamic = "force-dynamic";

export default async function AdminSeoPage() {
  const [settings, overridesRes, redirectsRes] = await Promise.all([
    getSettings(),
    db.execute<{ id: number; path: string; meta_title: unknown; meta_description: unknown; og_image_url: string | null }>(
      sql`SELECT * FROM seo_overrides ORDER BY path`
    ),
    db.execute<{ id: number; from_path: string; to_path: string; permanent: boolean }>(
      sql`SELECT id, from_path, to_path, permanent FROM redirects ORDER BY created_at DESC LIMIT 200`
    ),
  ]);
  const overrides = overridesRes.rows;
  const redirects = redirectsRes.rows;

  return (
    <div>
      <h1 className="mb-5 mt-0 font-heading text-2xl font-bold text-ink">SEO সেটিংস</h1>
      <SeoManager
        defaults={{
          seo_title_template: toML(settings.seo_title_template),
          seo_default_title: toML(settings.seo_default_title),
          seo_default_description: toML(settings.seo_default_description),
          seo_default_og_image: settings.seo_default_og_image,
        }}
        overrides={overrides.map((o) => ({
          id: o.id,
          path: o.path,
          meta_title: toML(o.meta_title),
          meta_description: toML(o.meta_description),
          og_image_url: o.og_image_url,
        }))}
        redirects={redirects}
      />
    </div>
  );
}
