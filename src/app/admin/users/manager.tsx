"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveUser, deleteUser } from "@/actions/admin-system";
import { Field, inputCls, Toggle, Toast, StatusBadge, ConfirmButton } from "@/components/admin/ui";
import { bnDate } from "@/lib/bn";

type Row = { id: number; name: string; email: string; role: string; active: boolean; created_at: string };
type Draft = { id?: number; name: string; email: string; password: string; role: string; active: boolean };

const ROLE_LABEL: Record<string, string> = { super_admin: "সুপার অ্যাডমিন", admin: "অ্যাডমিন", editor: "এডিটর" };

export function UsersManager({ rows, isSuperAdmin, selfId }: { rows: Row[]; isSuperAdmin: boolean; selfId: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [editing, setEditing] = useState<Draft | null>(null);

  const submit = () => {
    if (!editing) return;
    startTransition(async () => {
      const res = await saveUser(editing);
      setResult(res);
      if (res.ok) { setEditing(null); router.refresh(); }
    });
  };

  return (
    <div className="max-w-[760px]">
      <Toast result={result} />
      {!isSuperAdmin && (
        <div className="mb-4 rounded-xl bg-[#FFFBEB] px-4 py-3 text-sm text-[#B45309]">
          ইউজার যোগ বা পরিবর্তন করতে সুপার অ্যাডমিন অ্যাকাউন্ট প্রয়োজন।
        </div>
      )}

      {isSuperAdmin && (
        <div className="mb-4 flex justify-end">
          <button
            onClick={() => setEditing({ name: "", email: "", password: "", role: "admin", active: true })}
            className="rounded-[10px] bg-brand-600 px-[18px] py-2.5 text-sm font-bold text-white hover:bg-brand-700"
          >
            + নতুন ইউজার
          </button>
        </div>
      )}

      {editing && (
        <div className="mb-5 rounded-2xl border border-brand-200 bg-white p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="নাম">
              <input className={inputCls} value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            </Field>
            <Field label="ইমেইল">
              <input type="email" className={inputCls + " font-latin"} value={editing.email} onChange={(e) => setEditing({ ...editing, email: e.target.value })} />
            </Field>
            <Field label={editing.id ? "নতুন পাসওয়ার্ড (খালি রাখলে অপরিবর্তিত)" : "পাসওয়ার্ড (কমপক্ষে ৮ অক্ষর)"}>
              <input type="password" className={inputCls} value={editing.password} onChange={(e) => setEditing({ ...editing, password: e.target.value })} />
            </Field>
            <Field label="রোল">
              <select className={inputCls} value={editing.role} onChange={(e) => setEditing({ ...editing, role: e.target.value })}>
                <option value="admin">অ্যাডমিন</option>
                <option value="editor">এডিটর</option>
                <option value="super_admin">সুপার অ্যাডমিন</option>
              </select>
            </Field>
          </div>
          <div className="mt-4">
            <Toggle checked={editing.active} onChange={(v) => setEditing({ ...editing, active: v })} label="সক্রিয়" />
          </div>
          <div className="mt-5 flex gap-3">
            <button onClick={submit} disabled={pending} className="rounded-[10px] bg-brand-600 px-6 py-2.5 text-sm font-bold text-white disabled:opacity-60">
              {pending ? "সংরক্ষণ হচ্ছে..." : "সংরক্ষণ করুন"}
            </button>
            <button onClick={() => setEditing(null)} className="rounded-[10px] border border-line bg-white px-6 py-2.5 text-sm text-ink-mute">বাতিল</button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-line bg-white p-1.5">
        <table className="w-full min-w-[560px] border-collapse">
          <thead>
            <tr>
              {["নাম", "ইমেইল", "রোল", "স্ট্যাটাস", "তৈরি", "অ্যাকশন"].map((h) => (
                <th key={h} className="border-b border-line px-3.5 py-3.5 text-right text-[12.5px] font-semibold text-ink-ghost">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id}>
                <td className="border-b border-[#F1F5F9] px-3.5 py-3 text-sm font-semibold text-ink">
                  {u.name}{u.id === selfId ? " (আপনি)" : ""}
                </td>
                <td className="border-b border-[#F1F5F9] px-3.5 py-3 font-latin text-[13px] text-ink-mute">{u.email}</td>
                <td className="border-b border-[#F1F5F9] px-3.5 py-3 text-[13.5px] text-ink-mute">{ROLE_LABEL[u.role] || u.role}</td>
                <td className="border-b border-[#F1F5F9] px-3.5 py-3">
                  <StatusBadge tone={u.active ? "green" : "gray"}>{u.active ? "সক্রিয়" : "নিষ্ক্রিয়"}</StatusBadge>
                </td>
                <td className="border-b border-[#F1F5F9] px-3.5 py-3 text-[13px] text-ink-faint">{bnDate(u.created_at)}</td>
                <td className="border-b border-[#F1F5F9] px-3.5 py-3">
                  {isSuperAdmin && (
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => setEditing({ id: u.id, name: u.name, email: u.email, password: "", role: u.role, active: u.active })}
                        className="rounded-lg border border-line bg-white px-[11px] py-1.5 text-[12.5px] font-semibold text-brand-600"
                      >
                        এডিট
                      </button>
                      {u.id !== selfId && (
                        <ConfirmButton
                          onConfirm={() =>
                            startTransition(async () => {
                              const res = await deleteUser(u.id);
                              setResult(res);
                              router.refresh();
                            })
                          }
                        />
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
