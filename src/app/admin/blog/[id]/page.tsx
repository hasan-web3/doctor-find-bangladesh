import { notFound } from "next/navigation";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { toML } from "@/lib/utils";
import { PostForm } from "../post-form";

export const dynamic = "force-dynamic";

type MLRaw = { bn?: string; en?: string } | null;

export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const postId = Number(id);
  if (!Number.isFinite(postId)) notFound();

  const [postRes, catRes] = await Promise.all([
    db.execute<{
      id: number; slug: string; title: MLRaw; excerpt: MLRaw; content: MLRaw;
      category_id: number | null; published: boolean; meta_title: MLRaw;
      meta_description: MLRaw; cover_url: string | null;
    }>(sql`SELECT * FROM blog_posts WHERE id=${postId}`),
    db.execute<{ id: number; name_bn: string }>(sql`SELECT id, name->>'bn' AS name_bn FROM blog_categories ORDER BY sort, id`),
  ]);
  const post = postRes.rows[0];
  const categories = catRes.rows;
  if (!post) notFound();

  return (
    <div>
      <h1 className="mb-5 mt-0 font-heading text-2xl font-bold text-ink">আর্টিকেল এডিট</h1>
      <PostForm
        initial={{
          id: post.id, slug: post.slug, title: toML(post.title), excerpt: toML(post.excerpt),
          content: toML(post.content), category_id: post.category_id, published: post.published,
          meta_title: toML(post.meta_title), meta_description: toML(post.meta_description),
          cover_url: post.cover_url,
        }}
        categories={categories}
      />
    </div>
  );
}
