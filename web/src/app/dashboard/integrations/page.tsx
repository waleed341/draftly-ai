"use client";

import { useCallback, useEffect, useState } from "react";
import { API_URL, request } from "@/lib/http";

type Connection = { id: number; email: string; connected_at: string };
type Connector = { key: string; status: "available" | "coming_soon" };
export default function IntegrationsPage() {
  const [items, setItems] = useState<Connection[]>([]);
  const [configured, setConfigured] = useState(false);
  const [message, setMessage] = useState("");
  const load = useCallback(() => request<Connection[]>("/api/gmail/connections").then(setItems).catch((e) => setMessage(e.message)), []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { request<Connector[]>("/api/connectors").then((values) => setConfigured(values.some((value) => value.key === "gmail" && value.status === "available"))).catch(() => setConfigured(false)); }, []);
  async function disconnect(id: number) {
    try { await request<void>(`/api/gmail/connections/${id}`, { method: "DELETE" }); await load(); }
    catch (e) { setMessage(e instanceof Error ? e.message : "Could not disconnect account."); }
  }
  return <main className="mx-auto min-h-screen max-w-4xl px-5 py-28 text-fg"><h1 className="text-3xl font-bold">Integrations</h1><p className="mt-2 text-muted">Gmail access is used only to save approved drafts and send emails you explicitly schedule.</p>
    <section className="mt-8 rounded-2xl border border-line bg-surface p-6"><h2 className="text-xl font-semibold">Gmail</h2><p className="mt-1 text-sm text-muted">OAuth grants Draftly permission to manage drafts and send scheduled emails on this account.</p>
      {configured ? <a className="mt-4 inline-flex rounded-lg bg-accent px-4 py-2 font-semibold text-white" href={`${API_URL}/api/gmail/connect`}>Connect Gmail</a> : <p className="mt-4 rounded-lg border border-line bg-bg p-3 text-sm text-muted">Add Google OAuth client credentials and a Fernet token key to the API environment to enable Gmail.</p>}
      {items.length > 0 && <ul className="mt-5 divide-y divide-line">{items.map((item) => <li key={item.id} className="flex items-center justify-between py-3"><div><p className="font-medium">{item.email}</p><p className="text-xs text-muted">Connected {new Date(item.connected_at).toLocaleString()}</p></div><button className="text-sm text-warning" onClick={() => void disconnect(item.id)}>Disconnect</button></li>)}</ul>}
      {message && <p role="status" className="mt-4 text-sm text-warning">{message}</p>}
    </section></main>;
}
