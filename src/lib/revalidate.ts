import "server-only";
import { revalidatePath, revalidateTag } from "next/cache";

// Every dashboard mutation calls this so public pages update instantly.
// Tags cover cached data readers; layout-level path revalidation refreshes
// all rendered routes that consumed them.
export function revalidatePublic(tags: string[] = []) {
  for (const tag of tags) revalidateTag(tag);
  revalidateTag("sitemap");
  revalidatePath("/", "layout");
}
