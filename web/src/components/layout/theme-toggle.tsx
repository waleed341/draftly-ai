"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { copy } from "@/features/drafts/constants";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  if (!ready) return <button className="theme-toggle" aria-label={copy.theme.change} disabled>◐</button>;
  const light = resolvedTheme === "light";
  return <button className="theme-toggle" onClick={() => setTheme(light ? "dark" : "light")} aria-label={light ? copy.theme.toDark : copy.theme.toLight}>
    {light ? "☾" : "☼"}<span>{light ? copy.theme.light : copy.theme.dark}</span>
  </button>;
}
