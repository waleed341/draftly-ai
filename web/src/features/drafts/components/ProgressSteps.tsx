"use client";

import { CheckIcon } from "@/components/ui/icons";
import { cx } from "@/lib/cx";
import { COPY, STEPS } from "../constants";
import type { StepStatus } from "../state";
import type { Step } from "../types";

export function ProgressSteps({ steps, live }: { steps: Record<Step, StepStatus>; live: boolean }) {
  const active = STEPS.find((s) => steps[s.key] === "active");
  return (
    <div>
      <ol aria-label={COPY.workspace.progressLabel} className="grid grid-cols-5 gap-1.5 sm:gap-2">
        {STEPS.map((step, index) => {
          const status = steps[step.key];
          return (
            <li key={step.key} className="min-w-0" aria-current={status === "active" ? "step" : undefined}>
              <div
                className={cx(
                  "h-1.5 overflow-hidden rounded-full transition-colors duration-500",
                  status === "done" ? "bg-accent" : "bg-surface-2",
                )}
              >
                {/* "Your review" waits on the person, so it is shown as reached rather than busy. */}
                {status === "active" &&
                  (step.key === "review" ? (
                    <div className="h-full w-full rounded-full bg-accent/40" />
                  ) : (
                    <div className="h-full w-2/5 animate-progress rounded-full bg-accent" />
                  ))}
              </div>
              <div className="mt-2 flex items-center gap-1.5">
                <span
                  aria-hidden
                  className={cx(
                    "grid size-4 shrink-0 place-items-center rounded-full text-[10px] font-semibold transition-colors",
                    status === "done" && "bg-accent text-accent-fg",
                    status === "active" && "animate-pulse-soft bg-accent-soft text-accent-text ring-1 ring-accent",
                    status === "pending" && "bg-surface-2 text-subtle",
                  )}
                >
                  {status === "done" ? <CheckIcon className="size-3" strokeWidth={3} /> : index + 1}
                </span>
                <span
                  className={cx(
                    "truncate text-xs font-medium",
                    status === "pending" ? "text-subtle" : "text-fg",
                    "max-sm:sr-only",
                  )}
                >
                  {step.label}
                  <span className="sr-only">: {status === "done" ? "done" : status === "active" ? "in progress" : "not started"}</span>
                </span>
              </div>
            </li>
          );
        })}
      </ol>
      <p className="mt-2 text-sm text-muted sm:sr-only" aria-live="polite">
        {live && active ? `${active.label}: ${active.detail}` : ""}
      </p>
    </div>
  );
}
