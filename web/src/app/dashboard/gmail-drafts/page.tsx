"use client";

import { useCallback, useEffect, useState } from "react";
import { request } from "@/lib/http";

type DraftLink = { id: number; draft_id: number; gmail_draft_id: string; subject: string; updated_at: string };
export default function GmailDraftsPage() {
  const [items, setItems] = useState<DraftLink[]>([]);
  const [message, setMessage] = useState("");
  const load = useCallback(() => request<DraftLink[]>("/api/gmail/drafts").then(setItems).catch((e) => setMessage(e.message)), []);
  useEffect(() => { void load(); }, [load]);
  async function remove(id: number) {
    try { await request<void>(`/api/gmail/drafts/${id}`, { method: "DELETE" }); await load(); }
    catch (e) { setMessage(e instanceof Error ? e.message : "Could not delete the Gmail draft."); }
  }
  return <main className="mx-auto min-h-screen max-w-5xl px-5 py-28 text-fg"><h1 className="text-3xl font-bold">Gmail Drafts</h1><p className="mt-2 text-muted">These are Gmail drafts created from approved Draftly versions.</p>{message && <p role="alert" className="mt-4 text-warning">{message}</p>}
    <ul className="mt-8 space-y-3">{items.map((item) => <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface p-5"><div><p className="font-medium">{item.subject}</p><p className="text-sm text-muted">Updated {new Date(item.updated_at).toLocaleString()}</p></div><button onClick={() => void remove(item.id)} className="text-sm text-warning">Delete from Gmail</button></li>)}</ul>{!items.length && !message && <p className="mt-8 text-muted">No saved Gmail drafts yet.</p>}</main>;
}
