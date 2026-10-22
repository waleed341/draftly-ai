"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { CheckIcon, ClockIcon, MailIcon } from "@/components/ui/icons";
import { cx } from "@/lib/cx";
import { draftKeys, draftsApi } from "../api";
import { COPY } from "../constants";

const T = COPY.header.stats;

/** Workspace summary: draft counts and the share of drafts approved. */
export function StatsBar() {
  const { data } = useQuery({ queryKey: draftKeys.stats(), queryFn: draftsApi.stats });
  const total = data?.total ?? 0;
  const rate = total ? Math.round(((data?.approved ?? 0) / total) * 100) : 0;
  const tiles = [
    { label: T.total, value: data?.total, Icon: MailIcon, tone: "bg-accent-soft text-accent-text" },
    { label: T.needsReview, value: data?.needs_review, Icon: ClockIcon, tone: "bg-warning-soft text-warning" },
    { label: T.approved, value: data?.approved, Icon: CheckIcon, tone: "bg-success-soft text-success" },
  ];

  return (
    <section
      aria-labelledby="stats-title"
      className="animate-fade-up rounded-2xl border border-line bg-bg/60 p-5 backdrop-blur [animation-delay:120ms]"
    >
      <h2 id="stats-title" className="text-xs font-medium uppercase tracking-wide text-subtle">{T.title}</h2>
      <dl className="mt-4 grid grid-cols-3 gap-3">
        {tiles.map(({ label, value, Icon, tone }) => (
          <div key={label} className="flex flex-col rounded-xl border border-line bg-surface px-3 py-3">
            <span aria-hidden className={cx("grid size-7 place-items-center rounded-lg", tone)}>
              <Icon className="size-4" />
            </span>
            {/* Label first for screen readers, shown under the number. */}
            <dt className="order-last mt-1.5 truncate text-xs text-muted">{label}</dt>
            <dd className="mt-3 text-2xl font-semibold tabular-nums leading-none text-fg">
              {value === undefined ? "–" : <CountUp value={value} />}
            </dd>
          </div>
        ))}
      </dl>
      <div className="mt-4">
        <div className="flex items-baseline justify-between text-xs">
          <span className="text-muted">{total ? T.rate : T.rateEmpty}</span>
          {total > 0 && <span className="font-semibold tabular-nums text-fg">{rate}%</span>}
        </div>
        <div
          className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2"
          role="progressbar"
          aria-label={T.rate}
          aria-valuenow={rate}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-accent to-success transition-[width] duration-700 ease-out"
            style={{ width: `${rate}%` }}
          />
        </div>
      </div>
    </section>
  );
}

/** Counts up from the previous value whenever `value` changes. */
function CountUp({ value }: { value: number }) {
  const [shown, setShown] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    const start = from.current;
    const began = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - began) / 600);
      const next = Math.round(start + (value - start) * (1 - (1 - t) ** 3));
      setShown(next);
      if (t < 1) frame = requestAnimationFrame(step);
      else from.current = value;
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return <>{shown}</>;
}
