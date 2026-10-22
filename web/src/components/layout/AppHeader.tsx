import type { ReactNode } from "react";
import { Logo } from "./Logo";

interface AppHeaderProps {
  nav: readonly { label: string; href: string; onSelect?: () => void }[];
  actions: ReactNode;
  busy: boolean;
  homeLabel: string;
  navLabel: string;
}

export function AppHeader({ nav, actions, busy, homeLabel, navLabel }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-bg/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-6 px-4 sm:px-6">
        <a href="#" aria-label={homeLabel}>
          <Logo busy={busy} />
        </a>
        <nav aria-label={navLabel} className="hidden md:block">
          <ul className="flex items-center gap-1">
            {nav.map((item, i) => (
              <li key={item.label}>
                <a
                  href={item.href}
                  onClick={(event) => {
                    if (!item.onSelect) return;
                    event.preventDefault();
                    item.onSelect();
                  }}
                  aria-current={i === 0 ? "page" : undefined}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-muted transition-colors hover:text-fg aria-[current=page]:text-fg"
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="ml-auto flex items-center gap-2">{actions}</div>
      </div>
    </header>
  );
}
