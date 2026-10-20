"use client";

import { FormEvent, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { copy } from "@/features/drafts/constants";
import { draftApi } from "@/features/drafts/api";
import { parseEmail } from "@/features/drafts/parse";
import { initialStudioState, studioReducer } from "@/features/drafts/state";
import { Check, Draft, StepName, StreamEvent } from "@/features/drafts/types";

const draftKeys = { all: ["drafts"] as const, history: () => ["drafts", "history"] as const };
const stepKeys: StepName[] = ["understand", "date_check", "writing", "checking", "your_review"];

export default function Home() {
  const [studio, dispatch] = useReducer(studioReducer, initialStudioState);
  const [idea, setIdea] = useState("");
  const [rewriteInstruction, setRewriteInstruction] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [safetyChecks, setSafetyChecks] = useState<Check[]>([]);
  const [reviewed, setReviewed] = useState(false);
  const [error, setError] = useState("");
  const [copyLabel, setCopyLabel] = useState<string>(copy.copy);
  const controller = useRef<AbortController | null>(null);
  const safetyRequest = useRef(0);
  const queryClient = useQueryClient();
  const historyQuery = useQuery({ queryKey: draftKeys.history(), queryFn: draftApi.history });
  const livePreview = useMemo(() => parseEmail(studio.streamText), [studio.streamText]);
  const writing = studio.phase === "writing";
  const isReview = !!draft && (studio.phase === "review" || studio.phase === "approved");
  const dirty = !!draft && (subject !== draft.subject || body !== draft.body);
  const checks = isReview ? safetyChecks : [];
  const allChecksPassed = checks.every((check) => check.passed);

  useEffect(() => {
    if (!isReview || !draft) return;
    const requestNumber = ++safetyRequest.current;
    const timer = window.setTimeout(async () => {
      try {
        const result = await draftApi.safety(`${subject}\n${body}`);
        if (requestNumber === safetyRequest.current) setSafetyChecks(result.checks);
      } catch (reason) {
        if (requestNumber === safetyRequest.current) setSafetyChecks([{ key: "input", label: copy.safetyTitle, passed: false,
          message: reason instanceof Error ? reason.message : copy.errors.generic }]);
      }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [body, subject, draft, isReview]);

  function receiveEvent(event: StreamEvent, errorPhase: "idle" | "review") {
    if (event.type === "step") dispatch({ type: "step", step: event.step, state: event.state });
    if (event.type === "token") dispatch({ type: "token", text: event.text });
    if (event.type === "reset") dispatch({ type: "reset" });
    if (event.type === "ready") {
      setDraft(event.draft); setSubject(event.draft.subject); setBody(event.draft.body);
      setSafetyChecks(event.draft.checks); setReviewed(false); dispatch({ type: "phase", phase: "review" });
      void queryClient.invalidateQueries({ queryKey: draftKeys.all });
    }
    if (event.type === "error") { setError(event.message); dispatch({ type: "phase", phase: errorPhase }); }
  }

  async function runDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!idea.trim() || writing) return;
    setError(""); setDraft(null); setSubject(""); setBody(""); setSafetyChecks([]); setReviewed(false);
    dispatch({ type: "start" });
    const aborter = new AbortController(); controller.current = aborter;
    let ready = false;
    try {
      await draftApi.create(idea.trim(), (item) => { receiveEvent(item, "idle"); ready ||= item.type === "ready"; }, aborter.signal);
      if (!ready) dispatch({ type: "phase", phase: "idle" });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : copy.errors.generic); dispatch({ type: "phase", phase: "idle" });
    } finally { controller.current = null; }
  }

  async function rewrite() {
    if (!draft || writing || dirty) return;
    setError(""); dispatch({ type: "start" }); setReviewed(false);
    const aborter = new AbortController(); controller.current = aborter;
    let ready = false;
    try {
      await draftApi.rewrite(draft.id, rewriteInstruction.trim(), (item) => { receiveEvent(item, "review"); ready ||= item.type === "ready"; }, aborter.signal);
      if (!ready) dispatch({ type: "phase", phase: "review" });
      setRewriteInstruction("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : copy.errors.generic); dispatch({ type: "phase", phase: "review" });
    } finally { controller.current = null; }
  }

  const saveMutation = useMutation({
    mutationFn: () => draftApi.edit(draft!.id, { subject, body }),
    onSuccess: (updated) => { setDraft(updated); setSubject(updated.subject); setBody(updated.body); setSafetyChecks(updated.checks); setReviewed(false); dispatch({ type: "phase", phase: "review" }); void queryClient.invalidateQueries({ queryKey: draftKeys.all }); },
    onError: (reason) => setError(reason instanceof Error ? reason.message : copy.errors.generic),
  });
  const approveMutation = useMutation({
    mutationFn: () => draftApi.approve(draft!.id),
    onSuccess: (updated) => { setDraft(updated); dispatch({ type: "phase", phase: "approved" }); void queryClient.invalidateQueries({ queryKey: draftKeys.all }); },
    onError: (reason) => setError(reason instanceof Error ? reason.message : copy.errors.generic),
  });

  async function openDraft(id: string) {
    setError(""); dispatch({ type: "clear" });
    try {
      const selected = await draftApi.get(id);
      setDraft(selected); setSubject(selected.subject); setBody(selected.body); setSafetyChecks(selected.checks);
      setReviewed(selected.status === "approved"); dispatch({ type: "phase", phase: selected.status === "approved" ? "approved" : "review" });
    } catch (reason) { setError(reason instanceof Error ? reason.message : copy.errors.generic); }
  }

  async function discard() {
    if (!draft || !window.confirm(copy.discardConfirm)) return;
    try {
      await draftApi.discard(draft.id); setDraft(null); setSubject(""); setBody(""); setSafetyChecks([]); setReviewed(false);
      dispatch({ type: "clear" }); void queryClient.invalidateQueries({ queryKey: draftKeys.all });
    } catch (reason) { setError(reason instanceof Error ? reason.message : copy.errors.generic); }
  }

  async function copyDraft() {
    await navigator.clipboard.writeText(`${copy.subject}: ${subject}\n\n${body}`);
    setCopyLabel(copy.copied); window.setTimeout(() => setCopyLabel(copy.copy), 1600);
  }

  return <main className="app-shell">
    <header className="app-header">
      <a className="brand" href="#" aria-label={copy.homeLabel}><span className="brand-mark">d<span>.</span></span><span>{copy.brand}</span></a>
      <div className="header-center"><span className="header-dot" />{copy.tagline}</div>
      <ThemeToggle />
    </header>

    <section className="welcome-row">
      <div><div className="eyebrow"><span>✳</span> {copy.introEyebrow}</div><h1>{copy.headlineFirst}<br /><em>{copy.headlineSecond}</em></h1>
        <p>{copy.introText}</p></div>
      {writing && <div className="progress-card" aria-live="polite"><span className="progress-orbit" />
        <div><strong>{copy.steps.find((_, index) => studio.steps[stepKeys[index]] === "running") ?? copy.writingHeadline}</strong><small>{copy.writingSubhead}</small></div>
        <button type="button" className="stop-button" onClick={() => controller.current?.abort()}>{copy.stop}</button>
      </div>}
    </section>

    <div className="studio-grid" aria-label={copy.workAreaLabel}>
      <section className="panel idea-panel">
        <div className="panel-heading"><div><span className="step-tag">01</span><h2>{copy.ideaLabel}</h2></div><span className="private-label">⌑ &nbsp;{copy.privateDraft}</span></div>
        <form onSubmit={runDraft}>
          <label className="sr-only" htmlFor="idea">{copy.emailInputLabel}</label>
          <textarea id="idea" value={idea} onChange={(event) => setIdea(event.target.value)} placeholder={copy.ideaPlaceholder} maxLength={10000} rows={6} required />
          <div className="idea-actions"><span className="helper-copy">{copy.helper}</span><button className="primary-button" type="submit" disabled={writing || !idea.trim()}>{writing ? <><span className="spinner" />{copy.writing}</> : <>{copy.generate} <span>↗</span></>}</button></div>
        </form>
        <div className="progress-steps" aria-live="polite">{stepKeys.map((key, index) => <div className={`progress-step ${studio.steps[key] ?? ""}`} key={key}>
          <span>{studio.steps[key] === "complete" ? "✓" : String(index + 1).padStart(2, "0")}</span>{copy.steps[index]}
        </div>)}</div>
        <p className="control-note">♧ &nbsp;{copy.noAutoSend}</p>
      </section>

      <section className={`panel draft-panel ${writing ? "is-writing" : ""}`} aria-live="polite">
        <div className="panel-heading"><div><span className="step-tag">02</span><h2>{isReview ? copy.yourEmailDraft : copy.yourDraft}</h2></div>
          {(isReview || writing) && <button className="quiet-button" type="button" onClick={copyDraft} disabled={!isReview}>{copyLabel} ↗</button>}
        </div>
        {writing ? <div className="stream-preview">
          {livePreview.subject && <p className="subject-preview"><span>{copy.subjectPreview}</span>{livePreview.subject}</p>}
          <p>{livePreview.body || copy.streamLoading}<span className="caret" /></p>
        </div> : isReview ? <div className="draft-editor">
          <label htmlFor="subject">{copy.subject}</label><input id="subject" value={subject} onChange={(event) => { setSubject(event.target.value); setReviewed(false); }} placeholder={copy.addSubject} maxLength={500} />
          <label htmlFor="draft-body">{copy.email}</label><textarea id="draft-body" value={body} onChange={(event) => { setBody(event.target.value); setReviewed(false); }} rows={11} maxLength={20000} />
          <div className="draft-actions">
            <button type="button" className="text-button" onClick={discard}>{copy.delete}</button>
            <div className="right-actions"><button type="button" className="secondary-button" onClick={rewrite} disabled={writing || dirty}>{copy.rewrite}</button>
              {dirty && <button type="button" className="secondary-button" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>{saveMutation.isPending ? copy.saving : copy.save}</button>}</div>
          </div>
          <label className="review-confirm"><input type="checkbox" checked={reviewed} onChange={(event) => setReviewed(event.target.checked)} />
            <span>{copy.reviewLabel}</span></label>
          <button className="approve-button" type="button" disabled={!reviewed || !allChecksPassed || approveMutation.isPending || studio.phase === "approved"} onClick={() => approveMutation.mutate()}>
            {studio.phase === "approved" ? copy.approvedButton : approveMutation.isPending ? copy.approving : copy.approveButton}
          </button>
        </div> : <div className="empty-draft"><span className="envelope">✉</span><p>{copy.emptyDraft}</p></div>}
        {error && <p className="error-message" role="alert">{error}</p>}
      </section>

      <aside className="right-rail">
        <section className="panel safety-panel"><div className="panel-heading"><h2>{copy.safetyTitle}</h2><span className="check-count">{checks.filter((item) => item.passed).length}/{checks.length || 3}</span></div>
          <div className="check-list" aria-live="polite">{(checks.length ? checks : [
            { key: "personal_details", label: copy.checks[0], passed: true, message: copy.safetyTeaser.personal },
            { key: "blanks", label: copy.checks[1], passed: true, message: copy.safetyTeaser.blanks },
            { key: "review", label: copy.checks[2], passed: true, message: copy.safetyTeaser.review },
          ]).map((check) => <div className="check-row" key={check.key}><span className={`check-icon ${check.passed ? "passed" : "needs-attention"}`}>{check.passed ? "✓" : "!"}</span>
            <div><strong>{check.label}</strong><small>{check.message}</small></div></div>)}</div>
          {draft && <div className="rewrite-hint"><label htmlFor="rewrite-instruction">{copy.rewriteIdea}</label><input id="rewrite-instruction" value={rewriteInstruction} onChange={(event) => setRewriteInstruction(event.target.value)} placeholder={copy.prompt} /><button onClick={rewrite} type="button" disabled={writing || dirty}>{copy.rewriteAction}</button></div>}
        </section>

        <section className="panel history-panel"><div className="panel-heading"><h2>{copy.history}</h2><span className="history-count">{historyQuery.data?.length ?? 0}</span></div>
          {historyQuery.isLoading ? <p className="muted-line">{copy.loadingHistory}</p> : historyQuery.data?.length ? <ul className="history-list">{historyQuery.data.map((item) => <li key={item.id}>
            <button type="button" className={`history-item ${draft?.id === item.id ? "selected" : ""}`} onClick={() => openDraft(item.id)} disabled={writing}>
              <span className="history-subject">{item.subject || item.idea}</span><span className={`status-pill ${item.status}`}>{item.status === "approved" ? copy.reviewedStatus : item.status === "writing" ? copy.writingStatus : copy.draftStatus}</span>
              <small>{new Date(item.updated_at).toLocaleDateString()}</small>
            </button></li>)}</ul> : <p className="muted-line">{copy.emptyHistory}</p>}
        </section>

        <section className="connector-card"><div className="connector-mark">G</div><div><strong>{copy.connector}</strong><small>{copy.connectorDetail}</small></div><span className="lock-mark">↗</span></section>
      </aside>
    </div>
    <footer className="app-footer"><span>{copy.footer}</span><span>{copy.inControl} <b>✳</b></span></footer>
  </main>;
}
