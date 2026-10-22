"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CalendarIcon, CopyIcon, MailIcon, PencilIcon, RefreshIcon, TrashIcon } from "@/components/ui/icons";
import { Pill } from "@/components/ui/Pill";
import { StopIndicator } from "@/components/ui/StopIndicator";
import { cx } from "@/lib/cx";
import { COPY, SOURCE_LABEL, STATUS_LABEL, STEPS } from "../constants";
import { useStudio } from "../DraftStudioProvider";
import { parsePartial } from "../parse";
import { ProgressSteps } from "./ProgressSteps";
import { ReviewPanel } from "./ReviewPanel";

/** How long after the person stops scrolling before the draft is brought back into view. */
const SCROLL_BACK_MS = 700;

export function DraftWorkspace() {
  const { state, dismiss, stop } = useStudio();
  const { phase, steps, date, error, notice, draft } = state;
  const writing = phase === "writing";
  const started = phase !== "idle" || Boolean(draft);
  const card = useRef<HTMLElement>(null);

  const refocus = useRef<() => void>(() => undefined);

  // While Draftly writes, keep the draft in view: bring it back after the person scrolls away,
  // and follow the text when it grows past the bottom of the screen.
  useEffect(() => {
    const node = card.current;
    if (!writing || !node) return;
    const behavior: ScrollBehavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
    const offset = parseFloat(getComputedStyle(node).scrollMarginTop) || 96;

    refocus.current = () => {
      const rect = node.getBoundingClientRect();
      if (rect.height <= window.innerHeight - offset) {
        if (Math.abs(rect.top - offset) > 24) node.scrollIntoView({ behavior, block: "start" });
        return;
      }
      // Taller than the screen: keep the end of the live text in view.
      const end = (node.querySelector(".writing-frame") ?? node).getBoundingClientRect().bottom;
      if (end > window.innerHeight - 16 || end < offset + 160) {
        window.scrollBy({ top: end - window.innerHeight + 32, behavior });
      }
    };

    let timer = 0;
    const onScroll = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => refocus.current(), SCROLL_BACK_MS);
    };
    node.scrollIntoView({ behavior, block: "start" });
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.clearTimeout(timer);
      refocus.current = () => undefined;
    };
  }, [writing]);

  // Follow the text as it streams in.
  const streamed = state.streamText.length;
  useEffect(() => {
    if (!writing || !streamed) return;
    const frame = requestAnimationFrame(() => refocus.current());
    return () => cancelAnimationFrame(frame);
  }, [writing, streamed]);

  return (
    <Card
      ref={card}
      className={cx(
        "flex min-w-0 flex-1 basis-[420px] scroll-mt-24 flex-col transition-[box-shadow,border-color] duration-500",
        writing && "border-accent/60! shadow-[0_0_0_4px_color-mix(in_srgb,var(--accent)_14%,transparent)]!",
      )}
      aria-labelledby="draft-title"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5">
        <div className="flex items-center gap-2">
          <h2 id="draft-title" className="text-[15px] font-semibold tracking-tight text-fg">{COPY.workspace.title}</h2>
          {draft && !writing && (
            <Pill tone={draft.status === "approved" ? "success" : "warning"}>{STATUS_LABEL[draft.status]}</Pill>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {date && (
            <Pill tone="accent" className="animate-fade-up">
              <CalendarIcon className="size-3.5" />
              <span className="sr-only">{COPY.workspace.dateLabel}: </span>
              {date}
            </Pill>
          )}
          {writing && (
            <Button
              variant="secondary"
              size="sm"
              onClick={stop}
              className="animate-fade-up border-accent/50! text-accent-text! hover:border-accent! hover:bg-accent-soft!"
            >
              <StopIndicator className="size-4" />
              {COPY.idea.stop}
            </Button>
          )}
        </div>
      </div>

      {started && (
        <div className="px-5 pt-4">
          <ProgressSteps steps={steps} live={writing} />
        </div>
      )}

      {(error || notice) && (
        <div
          role={error ? "alert" : "status"}
          className={cx(
            "mx-5 mt-4 flex items-start justify-between gap-3 rounded-xl px-4 py-3 text-sm animate-fade-up",
            error ? "bg-danger-soft text-danger" : "bg-surface-2 text-muted",
          )}
        >
          <span>
            {error && <strong className="font-semibold">{COPY.errors.title}. </strong>}
            {error ?? notice}
          </span>
          <button type="button" onClick={dismiss} className="shrink-0 font-medium underline-offset-2 hover:underline">
            {COPY.errors.dismiss}
          </button>
        </div>
      )}

      <div className="flex flex-1 flex-col p-5">
        {writing ? <LivePreview /> : draft ? <DraftView /> : <EmptyState />}
      </div>
    </Card>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-line px-6 py-14 text-center">
      <span className="grid size-12 place-items-center rounded-2xl bg-accent-soft text-accent-text">
        <MailIcon className="size-6" />
      </span>
      <p className="mt-4 font-semibold text-fg">{COPY.workspace.emptyTitle}</p>
      <p className="mt-1 max-w-sm text-sm text-muted">{COPY.workspace.emptyBody}</p>
    </div>
  );
}

function LivePreview() {
  const { state } = useStudio();
  const { subject, body } = parsePartial(state.streamText);
  const title = state.runMode === "rewrite" ? COPY.workspace.rewritingTitle : COPY.workspace.writingTitle;
  const active = STEPS.find((step) => state.steps[step.key] === "active");
  return (
    <div className="flex flex-1 flex-col" aria-busy="true">
      <p className="sr-only" role="status">{title}</p>
      {/* An animated light runs around the email while it is being written. */}
      <div className="writing-frame flex flex-1 flex-col">
        <div className="flex flex-1 flex-col overflow-hidden rounded-[15px] bg-surface">
          <div className="flex items-center justify-between gap-3 border-b border-line bg-accent-soft/50 px-4 py-2.5">
            <span className="flex min-w-0 items-center gap-2 text-xs font-medium text-accent-text">
              <span className="relative flex size-2 shrink-0">
                <span className="absolute inset-0 animate-ping rounded-full bg-accent opacity-60 motion-reduce:hidden" />
                <span className="relative size-2 rounded-full bg-accent" />
              </span>
              <span key={active?.key} className="truncate animate-fade-up">
                {active ? `${active.label} · ${active.detail}` : title}
              </span>
            </span>
            <span aria-hidden className="typing-dots flex gap-1">
              <span />
              <span />
              <span />
            </span>
          </div>
          <EmailFrame
            bare
            subject={subject ? <>{subject}{!body && <Caret />}</> : <span className="text-subtle">{title}</span>}
            body={
              body ? (
                <span className="text-[16px]">
                  {body}
                  <Caret />
                </span>
              ) : (
                <span className="block space-y-3" aria-hidden>
                  {[92, 100, 76, 0, 88, 64].map((w, i) => (
                    <span
                      key={i}
                      className="skeleton-shimmer block h-3 rounded"
                      style={{ width: `${w}%`, animationDelay: `${i * 120}ms` }}
                    />
                  ))}
                </span>
              )
            }
          />
        </div>
      </div>
    </div>
  );
}

function Caret() {
  return (
    <span
      aria-hidden
      className="ml-0.5 inline-block h-[1.1em] w-[2px] translate-y-[3px] animate-caret rounded-full bg-accent shadow-[0_0_8px_var(--accent)]"
    />
  );
}

function EmailFrame({ subject, body, bare = false }: { subject: ReactNode; body: ReactNode; bare?: boolean }) {
  return (
    <div className={cx("flex flex-1 flex-col overflow-hidden bg-surface", !bare && "rounded-2xl border border-line")}>
      <div className="border-b border-line px-4 py-3">
        <span className="text-xs font-medium uppercase tracking-wide text-subtle">{COPY.workspace.subject}</span>
        <p className="mt-0.5 font-semibold text-fg [overflow-wrap:anywhere]">{subject}</p>
      </div>
      <div className="min-h-[220px] flex-1 whitespace-pre-wrap px-4 py-4 text-[15px] leading-relaxed text-fg [overflow-wrap:anywhere]">
        {body}
      </div>
    </div>
  );
}

function highlightBlanks(text: string) {
  return text.split(/(\[[^[\]\n]{1,60}\])/g).map((part, i) =>
    i % 2 ? (
      <mark key={i} className="rounded bg-warning-soft px-1 text-warning">
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

function DraftView() {
  const { state, startEdit, rewrite, discard, viewVersion } = useStudio();
  const { draft, editing, viewing, busy } = state;
  const [rewriteOpen, setRewriteOpen] = useState(false);
  const [instructions, setInstructions] = useState("");
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [copied, setCopied] = useState(false);
  if (!draft) return null;

  const latest = draft.versions.at(-1);
  if (!latest) return <EmptyState />;
  const shown = draft.versions.find((v) => v.number === viewing) ?? latest;
  const older = shown.number !== latest.number;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`Subject: ${shown.subject}\n\n${shown.body}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-4">
      {draft.versions.length > 1 && (
        <div role="group" aria-label={COPY.workspace.versions} className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {draft.versions.map((v) => {
            const active = v.number === shown.number;
            return (
              <button
                key={v.number}
                type="button"
                aria-pressed={active}
                disabled={Boolean(editing)}
                onClick={() => viewVersion(v.number === latest.number ? null : v.number)}
                className={cx(
                  "shrink-0 rounded-lg border px-3 py-1.5 text-left text-xs transition-colors disabled:opacity-50",
                  active ? "border-accent bg-accent-soft text-accent-text" : "border-line text-muted hover:text-fg",
                )}
              >
                <span className="block font-semibold">{COPY.workspace.version(v.number)}</span>
                <span className="block">{SOURCE_LABEL[v.source]}</span>
              </button>
            );
          })}
        </div>
      )}

      {editing ? (
        <DraftEditor />
      ) : (
        <div key={shown.number} className="flex flex-1 animate-fade-up flex-col">
          {older && (
            <p className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface-2 px-4 py-2.5 text-sm text-muted">
              {COPY.workspace.olderVersion}
              <button type="button" onClick={() => viewVersion(null)} className="font-medium text-accent-text hover:underline">
                {COPY.workspace.showLatest}
              </button>
            </p>
          )}
          <EmailFrame
            subject={shown.subject ? highlightBlanks(shown.subject) : <span className="text-subtle">{COPY.workspace.noSubject}</span>}
            body={highlightBlanks(shown.body)}
          />
          {shown.note && <p className="mt-2 text-xs text-muted">“{shown.note}”</p>}
        </div>
      )}

      {!editing && (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" onClick={startEdit} disabled={busy}>
            <PencilIcon className="size-4" />
            {COPY.workspace.edit}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setRewriteOpen((open) => !open)}
            aria-expanded={rewriteOpen}
            aria-controls="rewrite-box"
            disabled={busy}
          >
            <RefreshIcon className="size-4" />
            {COPY.workspace.rewrite}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => void copy()}>
            <CopyIcon className="size-4" />
            <span aria-live="polite">{copied ? COPY.workspace.copied : COPY.workspace.copy}</span>
          </Button>
          <span className="flex-1" />
          {confirmDiscard ? (
            <span className="flex flex-wrap items-center gap-2 text-sm text-muted">
              {COPY.workspace.discardConfirm}
              <Button variant="danger" size="sm" onClick={() => void discard()} loading={busy}>
                {COPY.workspace.discard}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmDiscard(false)}>
                {COPY.workspace.cancel}
              </Button>
            </span>
          ) : (
            <Button variant="danger" size="sm" onClick={() => setConfirmDiscard(true)} disabled={busy}>
              <TrashIcon className="size-4" />
              {COPY.workspace.discard}
            </Button>
          )}
        </div>
      )}

      {rewriteOpen && !editing && (
        <form
          id="rewrite-box"
          className="animate-fade-up rounded-2xl border border-line p-4"
          onSubmit={(e) => {
            e.preventDefault();
            rewrite(instructions);
            setRewriteOpen(false);
            setInstructions("");
          }}
        >
          <label htmlFor="rewrite-note" className="text-sm font-medium text-fg">
            {COPY.workspace.rewriteTitle}
          </label>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              id="rewrite-note"
              value={instructions}
              maxLength={500}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder={COPY.workspace.rewritePlaceholder}
              className="h-10 min-w-0 flex-1 rounded-lg border border-line bg-surface-2 px-3 text-sm text-fg placeholder:text-subtle focus:border-accent focus:outline-none"
            />
            <Button type="submit">
              <RefreshIcon className="size-4" />
              {COPY.workspace.rewriteGo}
            </Button>
          </div>
        </form>
      )}

      <ReviewPanel />
    </div>
  );
}

function DraftEditor() {
  const { state, changeEdit, saveEdit, cancelEdit } = useStudio();
  const { editing, busy } = state;
  if (!editing) return null;
  const empty = !editing.subject.trim() || !editing.body.trim();
  return (
    <form
      className="flex flex-1 animate-fade-up flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!empty) void saveEdit();
      }}
    >
      <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-accent/60 bg-surface ring-2 ring-ring/15">
        <div className="border-b border-line px-4 py-3">
          <label htmlFor="edit-subject" className="text-xs font-medium uppercase tracking-wide text-subtle">
            {COPY.workspace.subject}
          </label>
          <input
            id="edit-subject"
            value={editing.subject}
            maxLength={300}
            onChange={(e) => changeEdit({ subject: e.target.value })}
            className="mt-0.5 block w-full bg-transparent font-semibold text-fg focus:outline-none"
          />
        </div>
        <label htmlFor="edit-body" className="sr-only">
          {COPY.workspace.message}
        </label>
        <textarea
          id="edit-body"
          value={editing.body}
          onChange={(e) => changeEdit({ body: e.target.value })}
          rows={12}
          className="min-h-[260px] flex-1 resize-y bg-transparent px-4 py-4 text-[15px] leading-relaxed text-fg focus:outline-none"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" loading={busy} disabled={empty}>
          {COPY.workspace.save}
        </Button>
        <Button variant="ghost" size="sm" onClick={cancelEdit} disabled={busy}>
          {COPY.workspace.cancel}
        </Button>
      </div>
    </form>
  );
}
