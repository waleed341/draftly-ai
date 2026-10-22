"use client";

import { useEffect, useState } from "react";
import { request } from "@/lib/http";

type Event = { id: number; actor_user_id: number | null; action: string; target_type: string; target_id: string; created_at: string };
export default function AuditPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [error, setError] = useState("");
  useEffect(() => { request<Event[]>("/api/auth/admin/audit-logs").then(setEvents).catch((e) => setError(e.message)); }, []);
  return <main className="mx-auto min-h-screen max-w-5xl px-5 py-28 text-fg"><h1 className="text-3xl font-bold">Audit log</h1><p className="mt-2 text-muted">Security events contain account and action metadata, not message content or credentials.</p>{error && <p role="alert" className="mt-4 text-warning">{error}</p>}
    <ul className="mt-8 divide-y divide-line rounded-xl border border-line bg-surface">{events.map((item) => <li key={item.id} className="flex flex-wrap justify-between gap-2 p-4"><div><p className="font-medium">{item.action}</p><p className="text-xs text-muted">{item.target_type} {item.target_id} · user {item.actor_user_id ?? "removed"}</p></div><time className="text-sm text-muted">{new Date(item.created_at).toLocaleString()}</time></li>)}</ul></main>;
}
