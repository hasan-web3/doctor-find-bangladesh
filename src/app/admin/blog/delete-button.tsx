"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteBlogPost } from "@/actions/admin-content";
import { ConfirmButton } from "@/components/admin/ui";

export function DeletePostButton({ id }: { id: number }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  return (
    <ConfirmButton
      onConfirm={() =>
        startTransition(async () => {
          await deleteBlogPost(id);
          router.refresh();
        })
      }
    />
  );
}
