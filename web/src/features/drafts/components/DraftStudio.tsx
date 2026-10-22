"use client";

import { AppHeader } from "@/components/layout/AppHeader";
import { BrandOutline } from "@/components/layout/BrandOutline";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { CalendarIcon, LockIcon, ShieldIcon } from "@/components/ui/icons";
import { cx } from "@/lib/cx";
import { COPY } from "../constants";
import { DraftStudioProvider, useStudio } from "../DraftStudioProvider";
import { ComingSoonPanel } from "./ComingSoonPanel";
import { DraftWorkspace } from "./DraftWorkspace";
import { HistoryPanel } from "./HistoryPanel";
import { HowItWorks } from "./HowItWorks";
import { IdeaPanel } from "./IdeaPanel";
import { SafetyPanel } from "./SafetyPanel";
import { StatsBar } from "./StatsBar";

const BADGE_ICONS = { date: CalendarIcon, safety: ShieldIcon, control: LockIcon } as const;

/** Scroll to a section below the sticky header and, optionally, put the cursor in a field. */
function goTo(id: string, focusId?: string) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.getElementById(id)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  if (focusId) document.getElementById(focusId)?.focus({ preventScroll: true });
  history.replaceState(null, "", `#${id}`);
}

const NAV = [
  { label: COPY.header.nav[0], href: "#studio", onSelect: () => goTo("studio", "idea") },
  { label: COPY.header.nav[1], href: "#history", onSelect: () => goTo("history") },
  { label: COPY.header.nav[2], href: "#help", onSelect: () => goTo("help") },
];

export function DraftStudio() {
  return (
    <DraftStudioProvider>
      <Studio />
    </DraftStudioProvider>
  );
}

function Studio() {
  const { state } = useStudio();
  const writing = state.phase === "writing";
  return (
    <div className="min-h-dvh">
      <AppHeader
        nav={NAV}
        busy={state.phase === "writing"}
        homeLabel={COPY.header.home}
        navLabel={COPY.header.navLabel}
        actions={<ThemeToggle lightLabel={COPY.header.themeToLight} darkLabel={COPY.header.themeToDark} />}
      />
      <main className="mx-auto max-w-[1440px] px-4 pb-16 pt-6 sm:px-6">
        <section className="hero-band relative mb-6 overflow-hidden rounded-3xl border border-line bg-surface px-5 py-8 sm:px-10 sm:py-10">
          <div className="relative grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-12">
            <div className="animate-fade-up">
              <h1 className="text-balance text-[30px] font-semibold leading-[1.12] tracking-tight text-fg sm:text-[42px]">
                {COPY.page.titleLead} <span className="hero-highlight">{COPY.page.titleHighlight}</span>
              </h1>
              <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-muted sm:text-base">{COPY.page.subtitle}</p>
              <ul className="mt-6 flex flex-wrap gap-2.5">
                {COPY.page.badges.map((badge) => {
                  const Icon = BADGE_ICONS[badge.key];
                  return (
                    <li
                      key={badge.key}
                      className="flex items-center gap-2 rounded-full border border-line bg-surface-2/70 py-1.5 pl-2 pr-3.5 text-sm font-medium text-fg"
                    >
                      <span className="grid size-6 place-items-center rounded-full bg-accent-soft text-accent-text">
                        <Icon className="size-3.5" />
                      </span>
                      {badge.label}
                    </li>
                  );
                })}
              </ul>
            </div>
            <StatsBar />
          </div>
        </section>
        <div id="studio" className="flex scroll-mt-24 flex-wrap items-start gap-5">
          <div className={cx("w-full transition-opacity duration-500 lg:w-[340px] lg:shrink-0", writing && "opacity-60 hover:opacity-100")}>
            <IdeaPanel />
          </div>
          <DraftWorkspace />
          <aside
            className={cx(
              "flex w-full flex-col gap-5 transition-opacity duration-500 xl:w-[320px] xl:shrink-0",
              writing && "opacity-40 hover:opacity-100",
            )}
            aria-label={COPY.page.aside}
          >
            <SafetyPanel />
            <HistoryPanel />
            <ComingSoonPanel />
          </aside>
        </div>
        <footer id="help" className="mt-12 scroll-mt-24 border-t border-line pt-10 text-sm text-muted">
          <HowItWorks />
          <BrandOutline active={state.phase === "writing"} className="mt-12" />
          <p className="mt-4 text-xs text-subtle">{COPY.page.copyright(new Date().getFullYear())}</p>
        </footer>
      </main>
    </div>
  );
}
