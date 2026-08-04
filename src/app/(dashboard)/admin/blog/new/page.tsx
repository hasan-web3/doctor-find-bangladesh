import { sql } from "drizzle-orm";
import { db } from "@/db";
import { PostForm } from "../post-form";

export const dynamic = "force-dynamic";

const emptyML = { bn: "", en: "" };

export default async function NewPostPage() {
  const { rows: categories } = await db.execute<{ id: number; name_bn: string }>(
    sql`SELECT id, name->>'bn' AS name_bn FROM blog_categories ORDER BY sort, id`
  );
  return (
    <div>
      <h1 className="mb-5 mt-0 font-heading text-2xl font-bold text-ink">নতুন আর্টিকেল</h1>
      <PostForm
        initial={{
          slug: "", title: { ...emptyML }, excerpt: { ...emptyML }, content: { ...emptyML },
          category_id: null, published: false, meta_title: { ...emptyML }, meta_description: { ...emptyML },
          cover_url: null,
        }}
        categories={categories}
      />
    </div>
  );
}
