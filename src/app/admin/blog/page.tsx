import { sql } from "drizzle-orm";
import { db } from "@/db";
import { CategoriesManager } from "./categories";
import { BlogList } from "./list-client";

export const dynamic = "force-dynamic";

type SP = { page?: string; perPage?: string };

export default async function AdminBlogPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const perPage = Number(sp.perPage) || 30;

  const [postsRes, totalRes, catsRes] = await Promise.all([
    db.execute<{
      id: number; slug: string; title: string; published: boolean;
      published_at: string | null; category: string | null; views: number;
    }>(sql`
      SELECT p.id, p.slug, p.title->>'bn' AS title, p.published, p.published_at::text,
        c.name->>'bn' AS category, 0 AS views
      FROM blog_posts p LEFT JOIN blog_categories c ON c.id = p.category_id
      ORDER BY p.updated_at DESC
      LIMIT ${perPage} OFFSET ${(page - 1) * perPage}
    `),
    db.execute<{ c: number }>(sql`SELECT COUNT(*)::int AS c FROM blog_posts`),
    db.execute<{ id: number; slug: string; name: unknown; post_count: number }>(sql`
      SELECT c.id, c.slug, c.name,
        (SELECT COUNT(*)::int FROM blog_posts p WHERE p.category_id=c.id) AS post_count
      FROM blog_categories c ORDER BY c.sort, c.id
    `),
  ]);
  const posts = postsRes.rows;
  const categories = catsRes.rows.map(c => ({
    id: c.id,
    slug: c.slug,
    name_bn: (c.name as any)?.bn || '',
    name_en: (c.name as any)?.en || null,
    post_count: c.post_count
  }));
  const totalCount = totalRes.rows[0]?.c ?? 0;
  const totalPages = Math.ceil(totalCount / perPage);

  return (
    <div>
      <h1 className="mb-5 mt-0 font-heading text-2xl font-bold text-ink">ব্লগ</h1>
      <BlogList
        rows={posts}
        categories={categories.map(c => ({id: c.id, name_bn: c.name_bn}))}
        page={page}
        perPage={perPage}
        totalPages={totalPages}
      />
      <div className="mt-8">
        <CategoriesManager categories={categories} />
      </div>
    </div>
  );
}
