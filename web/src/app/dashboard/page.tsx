"use client";

import { useEffect, useState } from "react";
import { request } from "@/lib/http";

type Stats = { total: number; needs_review: number; approved: number };
export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  useEffect(() => { request<Stats>("/api/drafts/stats").then(setStats).catch(() => setStats(null)); }, []);
  return <main className="mx-auto min-h-screen max-w-5xl px-5 py-28 text-fg"><h1 className="text-3xl font-bold">Your Draftly dashboard</h1><p className="mt-2 text-muted">Review your drafts, connect Gmail, and manage scheduled sends.</p>
    <div className="mt-8 grid gap-4 sm:grid-cols-3">{[["Drafts", stats?.total], ["Needs review", stats?.needs_review], ["Approved", stats?.approved]].map(([label, count]) => <article key={label} className="rounded-xl border border-line bg-surface p-5"><p className="text-sm text-muted">{label}</p><p className="mt-2 text-3xl font-semibold">{count ?? "—"}</p></article>)}</div>
    <nav className="mt-8 grid gap-3 sm:grid-cols-2">{[["AI Email Writer", "/"], ["My Drafts", "/#history"], ["Gmail Drafts", "/dashboard/gmail-drafts"], ["Integrations", "/dashboard/integrations"], ["Scheduled Emails", "/dashboard/scheduled"], ["Sent Emails", "/dashboard/sent"], ["Failed Emails", "/dashboard/failed"], ["Settings", "/dashboard/settings"]].map(([label, href]) => <a className="rounded-xl border border-line bg-surface p-4 font-medium hover:border-accent" key={href} href={href}>{label} →</a>)}</nav></main>;
}
