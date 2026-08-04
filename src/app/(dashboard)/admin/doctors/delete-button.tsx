"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { deleteDoctor } from "@/actions/admin-doctors";
import { ConfirmButton } from "@/components/admin/ui";

export function DeleteDoctorButton({ id }: { id: number }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  return (
    <ConfirmButton
      onConfirm={() =>
        startTransition(async () => {
          await deleteDoctor(id);
          router.refresh();
        })
      }
    />
  );
}
