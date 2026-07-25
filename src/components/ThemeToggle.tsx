import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

import { applyTheme, getPreferences, updatePreferences, type Theme } from "@/lib/preferences";

export function ThemeToggle() {
  const [theme, setThemeState] = useState<Theme>("dark");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const t = getPreferences().theme;
    setThemeState(t);
    setHydrated(true);
  }, []);

  if (!hydrated) return <div className="h-11 w-11" aria-hidden />;

  const isDark =
    theme === "dark" ||
    (theme === "system" &&
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-color-scheme: dark)").matches);

  function toggle() {
    const next: Theme = isDark ? "light" : "dark";
    updatePreferences({ theme: next });
    applyTheme(next);
    setThemeState(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border/60 bg-card/60 text-foreground/80 backdrop-blur transition-colors hover:bg-card hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
