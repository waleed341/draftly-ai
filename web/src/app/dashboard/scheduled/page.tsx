"use client";

import { useCallback, useEffect, useState } from "react";
import { request } from "@/lib/http";

type Job = { id: number; draft_id: number; recipient: string; subject: string; gmail_account: string; send_at: string; status: string; attempts: number; error: string | null };
export function ScheduleList({ status }: { status?: string }) {
  const [items, setItems] = useState<Job[]>([]);
  const [message, setMessage] = useState("");
  const [newTimes, setNewTimes] = useState<Record<number, string>>({});
  const load = useCallback(() => request<Job[]>(`/api/schedules${status ? `?status=${status}` : ""}`).then(setItems).catch((e) => setMessage(e.message)), [status]);
  useEffect(() => { void load(); const timer = window.setInterval(() => void load(), 15000); return () => window.clearInterval(timer); }, [load]);
  async function cancel(id: number) {
    try { await request(`/api/schedules/${id}`, { method: "DELETE" }); await load(); }
    catch (e) { setMessage(e instanceof Error ? e.message : "Could not cancel this email."); }
  }
  async function reschedule(id: number, value: string) {
    if (!value) return;
    try { await request(`/api/schedules/${id}`, { method: "PATCH", body: JSON.stringify({ send_at: new Date(value).toISOString() }) }); await load(); }
    catch (e) { setMessage(e instanceof Error ? e.message : "Could not reschedule this email."); }
  }
  async function retry(id: number) {
    try { await request(`/api/schedules/${id}/retry`, { method: "POST" }); await load(); }
    catch (e) { setMessage(e instanceof Error ? e.message : "Could not retry this email."); }
  }
  return <main className="mx-auto min-h-screen max-w-5xl px-5 py-28 text-fg"><h1 className="text-3xl font-bold">{status === "sent" ? "Sent Emails" : status === "failed" ? "Failed Emails" : "Scheduled Emails"}</h1><p className="mt-2 text-muted">Scheduled times display in your browser’s local time. Closing this page does not stop scheduled work.</p>{message && <p role="alert" className="mt-4 text-warning">{message}</p>}
    <ul className="mt-8 space-y-3">{items.map((item) => <li key={item.id} className="rounded-xl border border-line bg-surface p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{item.subject}</p><p className="mt-1 text-sm text-muted">To {item.recipient} via {item.gmail_account}</p><p className="mt-1 text-sm text-muted">{new Date(item.send_at).toLocaleString()} · {item.status}</p>{item.error && <p className="mt-2 text-sm text-warning">{item.error}</p>}</div>{item.status === "scheduled" && <div className="flex flex-wrap items-center gap-3"><input aria-label="Reschedule send time" type="datetime-local" value={newTimes[item.id] ?? ""} onChange={(e) => setNewTimes((old) => ({ ...old, [item.id]: e.target.value }))} className="rounded-lg border border-line bg-bg px-2 py-1 text-sm" /><button onClick={() => void reschedule(item.id, newTimes[item.id] ?? "")} className="text-sm text-accent-text">Reschedule</button><button onClick={() => void cancel(item.id)} className="text-sm text-warning">Cancel</button></div>}{status === "failed" && item.status === "failed" && <button onClick={() => void retry(item.id)} className="text-sm text-accent-text">Retry</button>}</div></li>)}</ul>{items.length === 0 && <p className="mt-8 rounded-xl border border-dashed border-line p-8 text-center text-muted">No scheduled emails yet.</p>}</main>;
}

export default function SchedulesPage() { return <ScheduleList />; }
