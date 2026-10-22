"use client";

import { Card, CardHeader } from "@/components/ui/Card";
import { AlertIcon, CheckIcon, ShieldIcon } from "@/components/ui/icons";
import { Pill } from "@/components/ui/Pill";
import { Spinner } from "@/components/ui/Spinner";
import { cx } from "@/lib/cx";
import { COPY } from "../constants";
import { useStudio } from "../DraftStudioProvider";

export function SafetyPanel() {
  const { state } = useStudio();
  const { checks, checking, phase } = state;
  const writing = phase === "writing";
  const issues = checks.filter((c) => !c.passed).length;

  return (
    <Card aria-labelledby="safety-title">
      <CardHeader
        id="safety-title"
        title={COPY.safety.title}
        hint={COPY.safety.hint}
        action={
          checking ? (
            <span className="flex items-center gap-1.5 text-xs text-muted">
              <Spinner className="size-3" /> {COPY.safety.checking}
            </span>
          ) : checks.length ? (
            issues ? <Pill tone="warning">{COPY.safety.toLookAt(issues)}</Pill> : <Pill tone="success">{COPY.safety.allClear}</Pill>
          ) : null
        }
      />
      <div className="p-5 pt-4">
        {checks.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-muted">
            <ShieldIcon className="size-4 shrink-0" />
            {COPY.safety.empty}
          </p>
        ) : (
          <ul className={cx("space-y-3 transition-opacity", writing && "opacity-50")} aria-live="polite">
            {checks.map((check) => (
              <li key={check.key} className="flex gap-3">
                <span
                  className={cx(
                    "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full",
                    check.passed ? "bg-success-soft text-success" : "bg-warning-soft text-warning",
                  )}
                >
                  {check.passed ? <CheckIcon className="size-3.5" strokeWidth={2.6} /> : <AlertIcon className="size-3.5" strokeWidth={2.2} />}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-fg">
                    {check.label}
                    <span className="sr-only">: {check.passed ? "passed" : "needs a look"}</span>
                  </p>
                  <p className="text-sm text-muted [overflow-wrap:anywhere]">{check.message}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
