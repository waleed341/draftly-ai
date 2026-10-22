import { cx } from "@/lib/cx";

/** A filled stop square inside a spinning ring: "this is running, click to stop it". */
export function StopIndicator({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cx("relative inline-grid size-5 place-items-center", className)}>
      <svg viewBox="0 0 20 20" className="absolute inset-0 size-full animate-spin [animation-duration:1.4s] motion-reduce:animate-none">
        <circle cx="10" cy="10" r="8.5" fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="1.8" />
        <path d="M10 1.5a8.5 8.5 0 0 1 8.5 8.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      <span className="size-[7px] rounded-[2px] bg-current" />
    </span>
  );
}
