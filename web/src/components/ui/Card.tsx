import type { ComponentProps, LabelHTMLAttributes, ReactNode } from "react";
import { cx } from "@/lib/cx";

export function Card({ className, ...props }: ComponentProps<"section">) {
  return (
    <section
      className={cx("rounded-2xl border border-line bg-surface shadow-card", className)}
      {...props}
    />
  );
}

export function CardHeader({ title, hint, action, id }: { title: string; hint?: ReactNode; action?: ReactNode; id?: string }) {
  return (
    <div className="flex items-start justify-between gap-3 px-5 pt-5">
      <div className="min-w-0">
        <h2 id={id} className="text-[15px] font-semibold tracking-tight text-fg">{title}</h2>
        {hint && <p className="mt-0.5 text-sm text-muted">{hint}</p>}
      </div>
      {action}
    </div>
  );
}

export const labelClass = "mb-2 block text-xs font-medium uppercase tracking-wide text-subtle";

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cx(labelClass, className)} {...props} />;
}
