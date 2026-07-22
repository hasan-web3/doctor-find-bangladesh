import Link from "next/link";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { StatusBadge } from "@/components/admin/ui";
import { CategoriesManager } from "./categories";
import { DeletePostButton } from "./delete-button";
import { bnDate } from "@/lib/bn";

export const dynamic = "force-dynamic";

export default async function AdminBlogPage() {
  const [postsRes, catsRes] = await Promise.all([
    db.execute<{
      id: number; slug: string; title_bn: string; published: boolean;
      published_at: string | null; category_bn: string | null;
    }>(sql`
      SELECT p.id, p.slug, p.title->>'bn' AS title_bn, p.published, p.published_at::text,
        c.name->>'bn' AS category_bn
      FROM blog_posts p LEFT JOIN blog_categories c ON c.id = p.category_id
      ORDER BY p.updated_at DESC LIMIT 100
    `),
    db.execute<{ id: number; slug: string; name_bn: string; name_en: string | null; post_count: number }>(sql`
      SELECT c.id, c.slug, c.name->>'bn' AS name_bn, c.name->>'en' AS name_en,
        (SELECT COUNT(*)::int FROM blog_posts p WHERE p.category_id=c.id) AS post_count
      FROM blog_categories c ORDER BY c.sort, c.id
    `),
  ]);
  const posts = postsRes.rows;
  const categories = catsRes.rows;

  return (
    <div>
      <h1 className="mb-5 mt-0 font-heading text-2xl font-bold text-ink">ব্লগ</h1>

      <div className="mb-4 flex justify-end">
        <Link href="/admin/blog/new" className="rounded-[10px] bg-brand-600 px-[18px] py-2.5 text-sm font-bold text-white hover:bg-brand-700">
          + নতুন আর্টিকেল
        </Link>
      </div>

      <div className="mb-6 overflow-x-auto rounded-2xl border border-line bg-white p-1.5">
        <table className="w-full min-w-[560px] border-collapse">
          <thead>
            <tr>
              {["শিরোনাম", "ক্যাটাগরি", "প্রকাশ", "স্ট্যাটাস", "অ্যাকশন"].map((h) => (
                <th key={h} className="border-b border-line px-3.5 py-3 text-left text-[12.5px] font-semibold text-ink-ghost">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {posts.map((p) => (
              <tr key={p.id}>
                <td className="border-b border-[#F1F5F9] px-3.5 py-3 text-sm font-semibold text-ink">
                  <Link href={`/admin/blog/${p.id}`} className="hover:text-brand-600">{p.title_bn}</Link>
                </td>
                <td className="border-b border-[#F1F5F9] px-3.5 py-3 text-[13.5px] text-ink-mute">{p.category_bn || "..."}</td>
                <td className="border-b border-[#F1F5F9] px-3.5 py-3 text-[13px] text-ink-faint">
                  {p.published_at ? bnDate(p.published_at) : "..."}
                </td>
                <td className="border-b border-[#F1F5F9] px-3.5 py-3">
                  <StatusBadge tone={p.published ? "green" : "amber"}>{p.published ? "প্রকাশিত" : "খসড়া"}</StatusBadge>
                </td>
                <td className="border-b border-[#F1F5F9] px-3.5 py-3">
                  <div className="flex gap-1.5">
                    <Link href={`/admin/blog/${p.id}`} className="rounded-lg border border-line bg-white px-[11px] py-1.5 text-[12.5px] font-semibold text-brand-600">
                      এডিট
                    </Link>
                    {p.published && (
                      <Link href={`/blog/${p.slug}`} target="_blank" className="rounded-lg border border-line bg-white px-[11px] py-1.5 text-[12.5px] text-ink-mute">
                        দেখুন
                      </Link>
                    )}
                    <DeletePostButton id={p.id} />
                  </div>
                </td>
              </tr>
            ))}
            {posts.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-ink-ghost">কোনো আর্টিকেল নেই।</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <CategoriesManager categories={categories} />
    </div>
  );
}
