"use client";

import { cx } from "@/lib/cx";

interface Option<T extends string> {
  value: T;
  label: string;
}

interface SegmentedProps<T extends string> {
  label: string;
  value: T;
  options: readonly Option<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
  variant?: "segments" | "chips";
}

/** A group of toggle buttons. `chips` wraps onto several lines; `segments` stays one row. */
export function Segmented<T extends string>({ label, value, options, onChange, disabled, variant = "segments" }: SegmentedProps<T>) {
  const chips = variant === "chips";
  return (
    <div
      role="group"
      aria-label={label}
      className={cx(chips ? "flex flex-wrap gap-2" : "grid auto-cols-fr grid-flow-col gap-1 rounded-xl bg-surface-2 p-1")}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={cx(
              "text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60",
              chips
                ? cx(
                    "h-8 rounded-full border px-3",
                    active ? "border-accent bg-accent-soft text-accent-text" : "border-line text-muted hover:border-line-strong hover:text-fg",
                  )
                : cx(
                    "h-8 rounded-lg px-2",
                    active ? "bg-surface text-fg shadow-sm" : "text-muted hover:text-fg",
                  ),
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
