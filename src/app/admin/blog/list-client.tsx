"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { getPost } from "@/actions/admin-content";
import { type PostInitial, PostForm } from "./post-form";
import { FullPageModal } from "@/components/admin/full-page-modal";
import { StatusBadge } from "@/components/admin/ui";
import { Pagination } from "@/components/admin/pagination";
import { bnDate, bnNum } from "@/lib/bn";
import { DeletePostButton } from "./delete-button";
import { emptyML } from "@/lib/utils";

const NEW_POST: PostInitial = {
    slug: "", title: { ...emptyML }, excerpt: { ...emptyML }, content: { ...emptyML },
    category_id: null, published: false, meta_title: { ...emptyML }, meta_description: { ...emptyML },
    cover_url: null,
};

type Row = {
  id: number;
  slug: string;
  title: string;
  published: boolean;
  published_at: string | null;
  category: string | null;
  views: number;
};

export function BlogList({
  rows,
  categories,
  page,
  perPage,
  totalPages,
}: {
  rows: Row[];
  categories: { id: number; name_bn: string }[];
  page: number;
  perPage: number;
  totalPages: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<PostInitial | null>(null);

  const handleAddNew = () => {
    setEditingPost(NEW_POST);
    setModalOpen(true);
  };

  const handleEdit = (id: number) => {
    startTransition(async () => {
      const post = await getPost(id);
      if (post) {
        setEditingPost(post);
        setModalOpen(true);
      }
    });
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingPost(null);
  };
  
  const handleFinished = () => {
    handleCloseModal();
    router.refresh();
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
          <button
            type="button"
            onClick={handleAddNew}
            className="rounded-[10px] bg-brand-600 px-[18px] py-2.5 text-sm font-bold text-white hover:bg-brand-700"
          >
            + নতুন আর্টিকেল
          </button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-line bg-white p-1.5">
        <table className="w-full min-w-[680px] border-collapse">
            <thead>
            <tr>
                {["আর্টিকেল", "ক্যাটাগরি", "প্রকাশের তারিখ", "ভিউ", "স্ট্যাটাস", "অ্যাকশন"].map((h) => (
                <th key={h} className="border-b border-line px-3.5 py-3 text-left text-[12.5px] font-semibold text-ink-ghost">{h}</th>
                ))}
            </tr>
            </thead>
            <tbody>
            {rows.map((p) => (
                <tr key={p.id}>
                    <td className="border-b border-[#F1F5F9] px-3.5 py-3 text-sm font-semibold text-ink">
                        <button onClick={() => handleEdit(p.id)} className="hover:text-brand-600 text-left">
                            {p.title}
                        </button>
                    </td>
                    <td className="border-b border-[#F1F5F9] px-3.5 py-3 text-[13.5px] text-ink-mute">{p.category || "..."}</td>
                    <td className="border-b border-[#F1F5F9] px-3.5 py-3 text-[13.5px] text-ink-mute">
                        {p.published_at ? bnDate(p.published_at) : "..."}
                    </td>
                    <td className="border-b border-[#F1F5F9] px-3.5 py-3 text-[13.5px] text-ink-mute">{bnNum(p.views)}</td>
                    <td className="border-b border-[#F1F5F9] px-3.5 py-3">
                        <StatusBadge tone={p.published ? "green" : "gray"}>{p.published ? "প্রকাশিত" : "ড্রাফট"}</StatusBadge>
                    </td>
                    <td className="border-b border-[#F1F5F9] px-3.5 py-3">
                        <div className="flex gap-1.5">
                            <button
                                type="button"
                                onClick={() => handleEdit(p.id)}
                                className="rounded-lg border border-line bg-white px-[11px] py-1.5 text-[12.5px] font-semibold text-brand-600"
                            >
                                এডিট
                            </button>
                            <Link
                                href={`/blog/${p.slug}`}
                                target="_blank"
                                className="rounded-lg border border-line bg-white px-[11px] py-1.5 text-[12.5px] text-ink-mute"
                            >
                                দেখুন
                            </Link>
                            <DeletePostButton id={p.id} />
                        </div>
                    </td>
                </tr>
            ))}
            </tbody>
        </table>
      </div>

      <Pagination
        page={page}
        totalPages={totalPages}
        perPage={perPage}
        showPerPageSelector={true}
      />

      <FullPageModal
        isOpen={modalOpen}
        onClose={handleCloseModal}
        title={editingPost?.id ? "আর্টিকেল এডিট" : "নতুন আর্টিকেল"}
        hideHeader={true}
      >
        {(isPending && !editingPost) && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/70">
                <p>Loading...</p>
            </div>
        )}
        {editingPost && (
          <PostForm
            initial={editingPost}
            categories={categories}
            onFinished={handleFinished}
          />
        )}
      </FullPageModal>
    </div>
  );
}
