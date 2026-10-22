"use client";

import { useId, useRef, type PointerEvent } from "react";
import { cx } from "@/lib/cx";

const WIDTH = 966;
const HEIGHT = 240;
const SPOT_RADIUS = 170;

/**
 * Large outlined mark + wordmark for empty space. Three layers:
 * a quiet outline that draws itself in, a light band that sweeps across (faster while `active`),
 * and a spotlight that follows the pointer.
 */
export function BrandOutline({ active = false, className }: { active?: boolean; className?: string }) {
  const id = useId().replace(/:/g, "");
  const spot = useRef<SVGCircleElement>(null);
  const svg = useRef<SVGSVGElement>(null);

  const moveSpot = (event: PointerEvent<SVGSVGElement>) => {
    const box = svg.current?.getBoundingClientRect();
    if (!box || !spot.current) return;
    const scale = WIDTH / box.width;
    spot.current.setAttribute("cx", String((event.clientX - box.left) * scale));
    spot.current.setAttribute("cy", String((event.clientY - box.top) * scale));
    spot.current.setAttribute("r", String(SPOT_RADIUS));
  };
  const hideSpot = () => spot.current?.setAttribute("r", "0");

  const shapes = (props: { className?: string; draw?: boolean }) => (
    <g className={props.className}>
      {/* The mark: rounded tile, envelope flap, open edge, pen stroke (same geometry as the logo, 32 → 192). */}
      <g transform="translate(8 16) scale(6)" strokeWidth={0.22} strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="1" width="30" height="30" rx="8.5" pathLength={1} className={cx(props.draw && "brand-draw")} />
        <path d="M9 11.5 16 17l7-5.5" pathLength={1} className={cx(props.draw && "brand-draw brand-delay-1")} />
        <path
          d="M23 18.5v2.5a2 2 0 0 1-2 2H11a2 2 0 0 1-2-2V11a2 2 0 0 1 2-2h7"
          pathLength={1}
          className={cx(props.draw && "brand-draw brand-delay-1")}
        />
        <path d="m21.5 7.5 3 3" pathLength={1} className={cx(props.draw && "brand-draw brand-delay-2")} />
      </g>
      <text
        x="228"
        y="196"
        strokeWidth={1.4}
        className={cx("brand-word", props.draw && "brand-draw-text")}
      >
        Draftly
      </text>
    </g>
  );

  return (
    <div className={cx("pointer-events-none relative select-none overflow-hidden", className)} aria-hidden>
      <svg
        ref={svg}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="pointer-events-auto block h-auto w-full"
        onPointerMove={moveSpot}
        onPointerLeave={hideSpot}
      >
        <defs>
          <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--surface-2)" stopOpacity="0.9" />
            <stop offset="1" stopColor="var(--bg)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`${id}-band`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#fff" stopOpacity="0" />
            <stop offset="0.5" stopColor="#fff" stopOpacity="1" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <radialGradient id={`${id}-spot`}>
            <stop offset="0" stopColor="#fff" stopOpacity="1" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
          <mask id={`${id}-sweep`} maskUnits="userSpaceOnUse" x="0" y="0" width={WIDTH} height={HEIGHT}>
            <rect
              x="-360"
              y="-40"
              width="360"
              height={HEIGHT + 80}
              fill={`url(#${id}-band)`}
              className={cx("brand-sweep", active && "brand-sweep-fast")}
            />
          </mask>
          <mask id={`${id}-spotmask`} maskUnits="userSpaceOnUse" x="0" y="0" width={WIDTH} height={HEIGHT}>
            <circle ref={spot} cx="0" cy="0" r="0" fill={`url(#${id}-spot)`} className="brand-spot" />
          </mask>
        </defs>

        {/* 1. Quiet base: soft fill and a faint outline that draws in. */}
        <g fill={`url(#${id}-fill)`} stroke="var(--border-strong)">
          {shapes({ draw: true })}
        </g>
        {/* 2. Light band sweeping across the outline. */}
        <g fill="none" stroke="var(--accent-text)" mask={`url(#${id}-sweep)`} className={cx("brand-glow", active && "brand-glow-active")}>
          {shapes({})}
        </g>
        {/* 3. Spotlight under the pointer. */}
        <g fill="var(--accent-soft)" fillOpacity="0.35" stroke="var(--accent)" mask={`url(#${id}-spotmask)`}>
          {shapes({})}
        </g>
      </svg>
      {/* Fade the bottom edge so the wordmark sinks into the page. */}
      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-b from-transparent to-bg" />
    </div>
  );
}
