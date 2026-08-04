import { listPriorityDistricts } from "@/actions/admin-priority";
import { PriorityManager } from "./manager";

export const dynamic = "force-dynamic";

export default async function DoctorsPriorityPage() {
  const districts = await listPriorityDistricts();

  return (
    <div>
      <h1 className="mb-5 mt-0 font-heading text-2xl font-bold text-ink">Doctors Priority</h1>
      <p className="mb-5 mt-0 text-sm text-ink-faint">
        জেলা অনুযায়ী ডাক্তারের ক্রম ঠিক করুন। কোনো জেলায় ক্রম চালু থাকলে সেই জেলার
        নির্বাচিত ডাক্তাররা সাইটের সব জায়গায় আগে দেখাবে — দূরত্ব হিসাব ছাড়াই। বাকি
        ডাক্তাররা আগের নিয়মেই (এলাকা ও দূরত্ব অনুযায়ী) সাজবে।
      </p>
      <PriorityManager districts={districts} />
    </div>
  );
}
