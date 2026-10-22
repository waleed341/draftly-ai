"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { COPY } from "@/features/drafts/constants";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  if (!ready) return <button className="theme-toggle" aria-label={COPY.header.themeToLight} disabled>Theme</button>;
  const light = resolvedTheme === "light";
  return <button className="theme-toggle" onClick={() => setTheme(light ? "dark" : "light")} aria-label={light ? COPY.header.themeToDark : COPY.header.themeToLight}>
    <span aria-hidden="true">{light ? "Moon" : "Sun"}</span><span>{light ? "Light" : "Dark"}</span>
  </button>;
}
