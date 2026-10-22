"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { AlertIcon, CheckIcon, LockIcon, UserIcon } from "@/components/ui/icons";
import { cx } from "@/lib/cx";
import { COPY } from "../constants";
import { useStudio } from "../DraftStudioProvider";
import { API_URL, request } from "@/lib/http";
import { draftsApi } from "../api";

type Connection = { id: number; email: string };
type Connector = { key: string; status: "available" | "coming_soon" };

export function ReviewPanel() {
  const { state, setReviewed, approve } = useStudio();
  const { phase, reviewed, blanks, busy, editing, checking } = state;
  const [connections, setConnections] = useState<Connection[]>([]);
  const [gmailConfigured, setGmailConfigured] = useState(false);
  const [connectionId, setConnectionId] = useState("");
  const [recipients, setRecipients] = useState("");
  const [sendAt, setSendAt] = useState("");
  const [notice, setNotice] = useState("");
  const [working, setWorking] = useState(false);

  useEffect(() => {
    request<Connection[]>("/api/gmail/connections").then((items) => {
      setConnections(items);
      setConnectionId((old) => old || String(items[0]?.id ?? ""));
    }).catch(() => setConnections([]));
    request<Connector[]>("/api/connectors").then((items) => {
      setGmailConfigured(items.some((item) => item.key === "gmail" && item.status === "available"));
    }).catch(() => setGmailConfigured(false));
  }, []);

  async function saveGmailDraft() {
    if (!state.draft || !connectionId) return;
    setWorking(true);
    try { await draftsApi.saveGmailDraft(state.draft.id, Number(connectionId)); setNotice("Saved to Gmail drafts."); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Could not save the draft."); }
    finally { setWorking(false); }
  }

  async function schedule() {
    if (!state.draft?.approval_id || !sendAt) return;
    setWorking(true);
    try {
      await draftsApi.schedule(state.draft.approval_id, new Date(sendAt).toISOString());
      setNotice("Email scheduled. Draftly will send it at the selected time.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not schedule this email."); }
    finally { setWorking(false); }
  }

  if (phase === "approved") {
    return (
      <div className="animate-fade-up space-y-4 rounded-2xl border border-success/30 bg-success-soft p-4">
        <div className="flex gap-3" role="status"><span className="grid size-8 shrink-0 place-items-center rounded-full bg-success text-surface"><CheckIcon className="size-4" strokeWidth={2.6} /></span>
          <div><p className="font-semibold text-fg">{COPY.control.approvedTitle}</p><p className="text-sm text-muted">{COPY.control.approvedBody}</p></div></div>
        {connections.length === 0 ? (gmailConfigured ? <a href={`${API_URL}/api/gmail/connect`} className="text-sm font-medium text-accent-text">Connect Gmail to continue</a> : <p className="text-sm text-muted">Gmail needs Google OAuth configuration in the API environment.</p>) : <>
          <Button onClick={() => void saveGmailDraft()} disabled={working}>{working ? "Working…" : "Save to Gmail drafts"}</Button>
          <div className="grid gap-3 border-t border-success/20 pt-3">
            <label className="text-sm text-fg">Schedule this approved email<textarea value={recipients} readOnly className="mt-1 w-full resize-none rounded-lg border border-line bg-bg px-3 py-2 text-muted" rows={2} /></label>
            <label className="text-sm text-fg">Send at<input aria-label="Send at" type="datetime-local" value={sendAt} onChange={(e) => setSendAt(e.target.value)} className="mt-1 block w-full rounded-lg border border-line bg-bg px-3 py-2" /></label>
            <Button onClick={() => void schedule()} disabled={working || !sendAt || !state.draft?.approval_id}>{working ? "Working…" : "Schedule send"}</Button>
            <p className="text-xs text-muted">The saved approval covers this exact version and its recipient list. Scheduling is explicit; nothing is sent until the scheduled time.</p>
          </div>
        </>}
        {notice && <p role="status" className="text-sm text-accent-text">{notice}</p>}
      </div>
    );
  }

  const hasBlanks = blanks.length > 0;
  const locked = Boolean(editing) || hasBlanks;
  return (
    <section aria-labelledby="control-title" className="animate-fade-up rounded-2xl border border-line bg-surface-2/60 p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent-soft text-accent-text">
          <UserIcon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 id="control-title" className="font-semibold text-fg">{COPY.control.title}</h3>
          <p className="text-sm text-muted">{COPY.control.hint}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className={cx("flex cursor-pointer items-start gap-2.5 text-sm text-fg", locked && "cursor-not-allowed opacity-60")}>
          <input
            type="checkbox"
            checked={reviewed}
            disabled={locked}
            onChange={(e) => setReviewed(e.target.checked)}
            className="mt-0.5 size-4 shrink-0 accent-[var(--accent)]"
          />
          {COPY.control.confirm}
        </label>
        <Button onClick={() => {
          const to = recipients.split(/[\n,;]/).map((item) => item.trim()).filter(Boolean);
          if (!connectionId || !to.length) { setNotice("Select a connected Gmail account and enter at least one recipient."); return; }
          setNotice(""); void approve({ to, gmail_connection_id: Number(connectionId) });
        }} disabled={!reviewed || locked || checking} loading={busy && reviewed} className="sm:shrink-0">
          {locked ? <LockIcon className="size-4" /> : <CheckIcon className="size-4" />}
          {COPY.control.approve}
        </Button>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {connections.length ? <label className="text-sm text-fg">Gmail account<select value={connectionId} onChange={(e) => setConnectionId(e.target.value)} className="mt-1 w-full rounded-lg border border-line bg-bg px-3 py-2">{connections.map((item) => <option key={item.id} value={item.id}>{item.email}</option>)}</select></label> : gmailConfigured ? <a href={`${API_URL}/api/gmail/connect`} className="self-end text-sm font-medium text-accent-text">Connect Gmail</a> : <p className="self-end text-xs text-muted">Google OAuth credentials have not been configured.</p>}
        <label className="text-sm text-fg">Recipient email(s)<textarea value={recipients} onChange={(e) => setRecipients(e.target.value)} placeholder="name@example.com" rows={2} className="mt-1 w-full rounded-lg border border-line bg-bg px-3 py-2" /></label>
      </div>
      {notice && <p role="status" className="mt-3 text-sm text-warning">{notice}</p>}
      {hasBlanks && !editing && (
        <p className="mt-3 flex items-center gap-2 text-sm text-warning">
          <AlertIcon className="size-4 shrink-0" />
          {COPY.control.blanks(blanks.length)}
        </p>
      )}
    </section>
  );
}
