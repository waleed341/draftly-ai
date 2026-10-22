"use client";

import { useState, type FormEvent } from "react";
import { request } from "@/lib/http";
export default function SettingsPage() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [message, setMessage] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    try { await request<void>("/api/auth/change-password", { method: "POST", body: JSON.stringify({ current_password: current, new_password: next }) }); setCurrent(""); setNext(""); setMessage("Password updated. Other sessions have been signed out."); }
    catch (e) { setMessage(e instanceof Error ? e.message : "Could not update password."); }
  }
  return <main className="mx-auto min-h-screen max-w-3xl px-5 py-28 text-fg"><h1 className="text-3xl font-bold">Settings</h1><form onSubmit={submit} className="mt-8 space-y-4 rounded-xl border border-line bg-surface p-6"><h2 className="text-xl font-semibold">Change password</h2><label className="block text-sm">Current password<input type="password" required value={current} onChange={(e) => setCurrent(e.target.value)} className="mt-1 w-full rounded-lg border border-line bg-bg p-2" /></label><label className="block text-sm">New password (12+ characters)<input type="password" minLength={12} required value={next} onChange={(e) => setNext(e.target.value)} className="mt-1 w-full rounded-lg border border-line bg-bg p-2" /></label><button className="rounded-lg bg-accent px-4 py-2 font-semibold text-white">Update password</button>{message && <p role="status" className="text-sm text-muted">{message}</p>}</form></main>;
}
