"use client";

import { useCallback, useEffect, useState } from "react";
import { request } from "@/lib/http";

type AccessRequest = { id: number; user_id: number; email: string; created_at: string };
type AdminUser = { id: number; email: string; role: string; status: string; created_at: string };
export default function AdminPage() {
  const [items, setItems] = useState<AccessRequest[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [message, setMessage] = useState("");
  const load = useCallback(() => Promise.all([
    request<AccessRequest[]>("/api/auth/admin/access-requests").then(setItems),
    request<AdminUser[]>("/api/auth/admin/users").then(setUsers),
  ]).catch((e) => setMessage(e.message)), []);
  useEffect(() => { void load(); }, [load]);
  async function decide(id: number, choice: "approve" | "reject") {
    try { await request(`/api/auth/admin/access-requests/${id}/${choice}`, { method: "POST" }); await load(); }
    catch (e) { setMessage(e instanceof Error ? e.message : "Could not update request."); }
  }
  async function suspend(item: AdminUser) {
    const status = item.status === "suspended" ? "active" : "suspended";
    try { await request(`/api/auth/admin/users/${item.id}`, { method: "PATCH", body: JSON.stringify({ status }) }); await load(); }
    catch (e) { setMessage(e instanceof Error ? e.message : "Could not update user."); }
  }
  return <main className="mx-auto min-h-screen max-w-5xl px-5 py-28 text-fg"><h1 className="text-3xl font-bold">Super Admin</h1><p className="mt-2 text-muted">Approve access, suspend accounts, and review security activity.</p>{message && <p role="alert" className="mt-4 text-warning">{message}</p>}
    <h2 className="mt-8 text-xl font-semibold">Access requests</h2>
    <ul className="mt-4 space-y-3">{items.map((item) => <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface p-5"><div><p className="font-medium">{item.email}</p><p className="text-xs text-muted">Requested {new Date(item.created_at).toLocaleString()}</p></div><div className="flex gap-3"><button onClick={() => void decide(item.id, "approve")} className="text-sm text-success">Approve</button><button onClick={() => void decide(item.id, "reject")} className="text-sm text-warning">Reject</button></div></li>)}</ul>{!items.length && !message && <p className="mt-4 text-sm text-muted">No pending requests.</p>}
    <h2 className="mt-10 text-xl font-semibold">Users</h2><ul className="mt-4 space-y-3">{users.map((item) => <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface p-5"><div><p className="font-medium">{item.email}</p><p className="text-xs text-muted">{item.role} · {item.status}</p></div>{item.role !== "super_admin" && item.status !== "pending" && <button onClick={() => void suspend(item)} className="text-sm text-warning">{item.status === "suspended" ? "Restore access" : "Suspend"}</button>}</li>)}</ul>
    <a className="mt-6 inline-flex text-sm font-medium text-accent-text" href="/dashboard/admin/audit">View audit log →</a></main>;
}
