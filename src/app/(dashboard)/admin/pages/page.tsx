import { getStaticPageRaw, STATIC_PAGE_SLUGS, type StaticPageSlug } from "@/lib/static-pages";
import { PagesManager } from "./manager";
import { toML } from "@/lib/utils";

export const dynamic = "force-dynamic";

// Fetch every editable static page and hand them to the client manager in a
// single payload so tab switching stays instant (no per-tab load).
export default async function AdminPagesIndex() {
  const rows = await Promise.all(
    STATIC_PAGE_SLUGS.map(async (slug) => {
      const row = await getStaticPageRaw(slug);
      return {
        slug: slug as StaticPageSlug,
        title: toML(row?.title as unknown),
        meta_description: toML(row?.metaDescription as unknown),
        content: toML(row?.content as unknown),
        updated_at: row?.updatedAt ? row.updatedAt.toISOString() : null,
      };
    })
  );

  return (
    <div>
      <h1 className="mb-1 mt-0 font-heading text-2xl font-bold text-ink">স্ট্যাটিক পেজ / Static Pages</h1>
      <p className="mb-5 text-sm text-ink-mute">
        Privacy Policy, Terms &amp; Conditions — সাইটের ফুটার থেকে লিঙ্ক করা পেজগুলো এখান থেকে সম্পাদনা করুন।
      </p>
      <PagesManager pages={rows} />
    </div>
  );
}
