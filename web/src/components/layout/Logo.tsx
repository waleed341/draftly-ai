import { cx } from "@/lib/cx";

/** Mark + wordmark. While `busy`, the pen in the mark moves as if writing. */
export function Logo({ busy = false }: { busy?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <svg viewBox="0 0 32 32" className={cx("size-8 shrink-0 transition-transform", busy && "scale-105")} aria-hidden>
        <rect width="32" height="32" rx="9" className="fill-accent" />
        <path d="M9 11.5 16 17l7-5.5" fill="none" className="stroke-accent-fg" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M23 18.5v2.5a2 2 0 0 1-2 2H11a2 2 0 0 1-2-2V11a2 2 0 0 1 2-2h7" fill="none" className="stroke-accent-fg" strokeWidth="2.2" strokeLinecap="round" />
        <path d="m21.5 7.5 3 3" className={cx("stroke-accent-fg", busy && "logo-pen")} strokeWidth="2.2" strokeLinecap="round" />
      </svg>
      <span className="text-lg font-semibold tracking-tight text-fg">Draftly</span>
    </span>
  );
}
