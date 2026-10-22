"use client";

import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Pill, type PillTone } from "@/components/ui/Pill";
import { cx } from "@/lib/cx";
import { timeAgo } from "@/lib/format";
import { draftKeys, draftsApi } from "../api";
import { COPY, STATUS_LABEL } from "../constants";
import { useStudio } from "../DraftStudioProvider";
import type { DraftStatus } from "../types";

const STATUS_TONE: Record<DraftStatus, PillTone> = {
  writing: "accent",
  needs_review: "warning",
  approved: "success",
  failed: "neutral",
};

export function HistoryPanel() {
  const { state, openDraft } = useStudio();
  const { data, isPending, isError, refetch } = useQuery({ queryKey: draftKeys.list(), queryFn: draftsApi.list });
  const writing = state.phase === "writing";

  return (
    <Card id="history" aria-labelledby="history-title">
      <CardHeader id="history-title" title={COPY.history.title} hint={COPY.history.hint} />
      <div className="p-3 pt-3">
        {isPending ? (
          <ul className="space-y-2 p-2" aria-hidden>
            {[0, 1, 2].map((i) => (
              <li key={i} className="h-12 animate-pulse rounded-lg bg-surface-2" />
            ))}
          </ul>
        ) : isError ? (
          <div className="flex items-center justify-between gap-3 p-2 text-sm text-muted">
            {COPY.history.error}
            <Button variant="secondary" size="sm" onClick={() => void refetch()}>
              {COPY.history.retry}
            </Button>
          </div>
        ) : data.length === 0 ? (
          <p className="p-2 text-sm text-muted">{COPY.history.empty}</p>
        ) : (
          <ul className="max-h-[360px] space-y-1 overflow-y-auto">
            {data.map((item) => {
              const title = item.subject || item.idea;
              const current = state.draft?.id === item.id;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    disabled={writing}
                    onClick={() => void openDraft(item.id)}
                    aria-label={COPY.history.open(title)}
                    aria-current={current || undefined}
                    className={cx(
                      "w-full rounded-xl px-3 py-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                      current ? "bg-accent-soft" : "hover:bg-surface-2",
                    )}
                  >
                    <span className="block truncate text-sm font-medium text-fg">{title}</span>
                    <span className="mt-1 flex items-center gap-2 text-xs text-muted">
                      <Pill tone={STATUS_TONE[item.status]} className="px-2 py-0">
                        {STATUS_LABEL[item.status]}
                      </Pill>
                      <span>{COPY.history.versions(item.version_count)}</span>
                      <span aria-hidden>·</span>
                      <time dateTime={item.updated_at}>{timeAgo(item.updated_at)}</time>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Card>
  );
}
