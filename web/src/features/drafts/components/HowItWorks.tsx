"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { CalendarIcon, LockIcon, ShieldIcon, SparkIcon } from "@/components/ui/icons";
import { COPY } from "../constants";

type HowKey = (typeof COPY.page.how)[number]["key"];

const ICONS = { write: SparkIcon, date: CalendarIcon, safety: ShieldIcon, control: LockIcon } as const;
const ART: Record<HowKey, () => React.JSX.Element> = { write: WriteArt, date: DateArt, safety: SafetyArt, control: ControlArt };

/** "How Draftly works": cards reveal on scroll, each with a looping illustration of its feature. */
export function HowItWorks() {
  const list = useRef<HTMLUListElement>(null);
  const [revealed, setRevealed] = useState(false);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const node = list.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setPlaying(entry.isIntersecting);
        if (entry.isIntersecting) setRevealed(true);
      },
      { threshold: 0.15 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const followPointer = (event: PointerEvent<HTMLLIElement>) => {
    const card = event.currentTarget;
    const box = card.getBoundingClientRect();
    card.style.setProperty("--mx", `${event.clientX - box.left}px`);
    card.style.setProperty("--my", `${event.clientY - box.top}px`);
  };

  return (
    <section aria-labelledby="how-title">
      <h2 id="how-title" className="text-lg font-semibold tracking-tight text-fg">{COPY.page.howTitle}</h2>
      <p className="mt-1 max-w-2xl text-sm text-muted">{COPY.page.howIntro}</p>
      <ul ref={list} className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {COPY.page.how.map((item, index) => {
          const Icon = ICONS[item.key];
          const Art = ART[item.key];
          return (
            <li
              key={item.key}
              className="how-card overflow-hidden rounded-2xl border border-line bg-surface"
              style={{ "--i": index } as React.CSSProperties}
              data-revealed={revealed}
              data-playing={playing}
              onPointerMove={followPointer}
            >
              <div className="how-art relative h-32 border-b border-line bg-surface-2/60" aria-hidden>
                <Art />
              </div>
              <div className="relative p-5">
                <span className="grid size-9 place-items-center rounded-xl bg-accent-soft text-accent-text">
                  <Icon className="size-[18px]" />
                </span>
                <h3 className="mt-3.5 text-[15px] font-semibold text-fg">{item.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{item.body}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

const svgProps = { viewBox: "0 0 240 112", className: "absolute inset-0 h-full w-full", preserveAspectRatio: "xMidYMid meet" };

/** An idea bubble sends a spark into an email that writes itself line by line. */
function WriteArt() {
  const lines = [
    { y: 44, w: 80, d: "0.35s" },
    { y: 54, w: 72, d: "0.6s" },
    { y: 64, w: 54, d: "0.85s" },
    { y: 80, w: 30, d: "1.1s" },
  ];
  return (
    <svg {...svgProps}>
      <rect x="14" y="40" width="66" height="32" rx="16" fill="var(--surface)" stroke="var(--border-strong)" className="how-breathe" />
      <rect x="27" y="50" width="40" height="4" rx="2" fill="var(--subtle)" opacity="0.6" />
      <rect x="27" y="58" width="26" height="4" rx="2" fill="var(--subtle)" opacity="0.6" />
      <circle cx="84" cy="56" r="3" fill="var(--accent)" className="how-fly" />
      <path d="M101 48 103 54 109 56 103 58 101 64 99 58 93 56 99 54Z" fill="var(--accent-text)" className="how-spin" />
      <rect x="122" y="16" width="104" height="80" rx="10" fill="var(--surface)" stroke="var(--border-strong)" />
      <rect x="134" y="27" width="58" height="6" rx="3" fill="var(--accent-text)" className="how-grow" style={{ animationDelay: "0.1s" }} />
      {lines.map((l) => (
        <rect key={l.y} x="134" y={l.y} width={l.w} height="4" rx="2" fill="var(--border-strong)" className="how-grow" style={{ animationDelay: l.d }} />
      ))}
    </svg>
  );
}

/** A ring hops from today to tomorrow and the new day lights up. */
function DateArt() {
  const cells = [];
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 7; col++) {
      cells.push(<rect key={`${row}-${col}`} x={71 + col * 15} y={44 + row * 13} width="9" height="8" rx="2" fill="var(--border)" />);
    }
  }
  return (
    <svg {...svgProps}>
      <rect x="60" y="14" width="120" height="90" rx="10" fill="var(--surface)" stroke="var(--border-strong)" />
      <path d="M60 24a10 10 0 0 1 10-10h100a10 10 0 0 1 10 10v12H60Z" fill="var(--accent-soft)" />
      <rect x="84" y="9" width="4" height="10" rx="2" fill="var(--accent-text)" />
      <rect x="152" y="9" width="4" height="10" rx="2" fill="var(--accent-text)" />
      <rect x="104" y="22" width="32" height="5" rx="2.5" fill="var(--accent-text)" opacity="0.7" />
      {cells}
      <rect x="116" y="57" width="9" height="8" rx="2" fill="var(--accent)" className="how-date-fill" />
      <rect x="98" y="54" width="15" height="14" rx="4" fill="none" stroke="var(--accent)" strokeWidth="1.6" className="how-date-ring" />
      <g className="how-date-tag">
        <rect x="104" y="74" width="34" height="13" rx="6.5" fill="var(--accent)" />
        <path d="M113 80.5h12m-3-3 3 3-3 3" stroke="var(--accent-fg)" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

/** A scan sweeps the draft, checks pop in, a blank glows, and the shield pulses. */
function SafetyArt() {
  const rows = [
    { y: 26, w: 84, ok: true, d: "0.5s" },
    { y: 40, w: 96, ok: false, d: "1s" },
    { y: 54, w: 76, ok: true, d: "1.5s" },
    { y: 68, w: 92, ok: true, d: "2s" },
  ];
  return (
    <svg {...svgProps}>
      <defs>
        <linearGradient id="how-scan-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--accent)" stopOpacity="0" />
          <stop offset="1" stopColor="var(--accent)" stopOpacity="0.35" />
        </linearGradient>
        <clipPath id="how-doc-clip">
          <rect x="18" y="14" width="138" height="84" rx="10" />
        </clipPath>
      </defs>
      <rect x="18" y="14" width="138" height="84" rx="10" fill="var(--surface)" stroke="var(--border-strong)" />
      {rows.map((r) => (
        <g key={r.y}>
          <rect x="30" y={r.y} width={r.w} height="4" rx="2" fill="var(--border-strong)" />
          <g className="how-pop" style={{ animationDelay: r.d }}>
            <circle cx="140" cy={r.y + 2} r="5.5" fill={r.ok ? "var(--success-soft)" : "var(--warning-soft)"} />
            {r.ok ? (
              <path d={`M137.5 ${r.y + 2}l1.8 1.8 3.2-3.4`} stroke="var(--success)" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            ) : (
              <path d={`M140 ${r.y - 0.5}v2.6m0 2v.1`} stroke="var(--warning)" strokeWidth="1.5" strokeLinecap="round" />
            )}
          </g>
        </g>
      ))}
      <rect x="92" y="37" width="32" height="10" rx="3" fill="var(--warning-soft)" stroke="var(--warning)" strokeWidth="0.8" className="how-blank" />
      <rect x="30" y="82" width="40" height="4" rx="2" fill="var(--border-strong)" />
      <g clipPath="url(#how-doc-clip)">
        <rect x="18" y="0" width="138" height="16" fill="url(#how-scan-grad)" className="how-scan" />
      </g>
      <circle cx="198" cy="56" r="22" fill="none" stroke="var(--accent)" className="how-ring" />
      <path d="M198 34l18 7v13c0 12-8 20-18 24-10-4-18-12-18-24V41Z" fill="var(--accent-soft)" stroke="var(--accent)" strokeWidth="1.4" />
      <path d="M190 56l5.5 5.5L207 50" stroke="var(--accent-text)" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" pathLength={1} className="how-tick" style={{ animationDelay: "0.4s" }} />
    </svg>
  );
}

/** A cursor ticks "I've read this", clicks Approve, and the approval lands. */
function ControlArt() {
  return (
    <svg {...svgProps}>
      <rect x="22" y="26" width="16" height="16" rx="4" fill="var(--surface)" stroke="var(--border-strong)" strokeWidth="1.2" />
      <path d="M26 34l3 3 6-7" stroke="var(--accent)" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" pathLength={1} className="how-tick-click" />
      <rect x="46" y="31" width="78" height="6" rx="3" fill="var(--border-strong)" />
      <rect x="22" y="60" width="112" height="28" rx="8" fill="var(--surface)" stroke="var(--border-strong)" />
      <rect x="22" y="60" width="112" height="28" rx="8" fill="var(--accent)" className="how-btn-fill" />
      <rect x="56" y="71" width="44" height="6" rx="3" fill="var(--subtle)" opacity="0.8" />
      <circle cx="182" cy="56" r="16" fill="none" stroke="var(--success)" strokeWidth="1.5" className="how-burst" />
      <g className="how-approved">
        <circle cx="182" cy="56" r="16" fill="var(--success-soft)" stroke="var(--success)" strokeWidth="1.2" />
        <path d="M175 56.5l4.5 4.5 9-9.5" stroke="var(--success)" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <path
        d="M0 0v15l4-4 3 7 2.6-1.1-3-6.9H12Z"
        fill="var(--text)"
        stroke="var(--surface)"
        strokeWidth="1.2"
        strokeLinejoin="round"
        className="how-cursor"
      />
    </svg>
  );
}
