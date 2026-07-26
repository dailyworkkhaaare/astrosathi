import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { LayoutGrid, MessageCircle, Sun, User } from "lucide-react";
import { useTranslation } from "react-i18next";

import { BrandMark } from "@/components/BrandMark";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import { readStoredLanguage, setLanguage } from "@/i18n";
import { applyTheme, bindSystemThemeListener, getPreferences } from "@/lib/preferences";
import { useAuthSession } from "@/lib/auth";

type NavItem = {
  to: "/home" | "/today" | "/settings";
  labelKey: string;
  icon: typeof LayoutGrid;
};

const NAV_ITEMS: NavItem[] = [
  { to: "/home", labelKey: "nav.home", icon: LayoutGrid },
  { to: "/today", labelKey: "nav.today", icon: Sun },
  { to: "/settings", labelKey: "nav.settings", icon: User },
];

export function AppShell({ children }: { children: ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    const stored = readStoredLanguage();
    if (stored) setLanguage(stored);
    applyTheme(getPreferences().theme);
    bindSystemThemeListener();
    setHydrated(true);
  }, []);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user } = useAuthSession();
  const logoTo = user ? "/home" : "/";
  const showNav = !!user;
  // The /chat route owns its own full-screen ChatGPT-style shell
  // (collapsible sidebar + slim top bar), so it renders bare — without
  // the standard app header or centered max-width wrapper.
  if (pathname === "/auth" || pathname === "/language") {
    return (
      <div className="min-h-screen bg-background text-foreground">
        {hydrated ? children : <HydrationSkeleton />}
      </div>
    );
  }
  const isChat = pathname === "/chat";
  return (
    <div className="min-h-screen bg-background text-foreground md:flex">
      {showNav && <DesktopRail pathname={pathname} />}
      <div className="flex min-w-0 flex-1 flex-col">
        {!isChat && !showNav && (
          <header
            className="sticky top-0 z-10 border-b border-border/60 bg-background/80 backdrop-blur"
            style={{ paddingTop: "env(safe-area-inset-top)" }}
          >
            <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
              <Link
                to={logoTo}
                className="focus:outline-none focus:ring-2 focus:ring-ring rounded-md min-h-11 min-w-11 grid place-items-center"
              >
                <BrandMark />
              </Link>
              <div className="flex items-center gap-2">
                <ThemeToggle />
                <LanguageSwitcher />
              </div>
            </div>
          </header>
        )}
        <main
          className={
            isChat
              ? "flex min-h-0 flex-1 flex-col"
              : "mx-auto w-full max-w-4xl px-4 pb-8 " +
                "pt-[calc(2.5rem+env(safe-area-inset-top))] md:pt-12 " +
                (showNav ? "pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-8" : "")
          }
        >
          {hydrated ? children : <HydrationSkeleton />}
        </main>
        {showNav && <MobileTabBar pathname={pathname} />}
        {showNav && !isChat && <FloatingChatButton />}
      </div>
    </div>
  );
}

function HydrationSkeleton() {
  return (
    <div className="w-full space-y-6 animate-pulse p-2" aria-busy="true">
      <div className="flex items-center justify-between">
        <div className="h-8 w-48 rounded-lg bg-primary/10" />
        <div className="h-8 w-24 rounded-full bg-primary/10" />
      </div>
      <div className="h-32 w-full rounded-2xl bg-primary/10" />
      <div className="flex gap-2 overflow-x-auto pb-1">
        <div className="h-10 w-28 shrink-0 rounded-full bg-primary/10" />
        <div className="h-10 w-28 shrink-0 rounded-full bg-primary/10" />
        <div className="h-10 w-28 shrink-0 rounded-full bg-primary/10" />
        <div className="h-10 w-28 shrink-0 rounded-full bg-primary/10" />
      </div>
      <div className="h-72 w-full rounded-2xl bg-primary/10" />
    </div>
  );
}

function isActive(pathname: string, to: string) {
  if (to === "/home") return pathname === "/home" || pathname.startsWith("/home/");
  if (to === "/settings") return pathname === "/settings" || pathname.startsWith("/settings/");
  return pathname === to;
}

function DesktopRail({ pathname }: { pathname: string }) {
  const { t } = useTranslation();
  return (
    <aside className="sticky top-0 hidden h-screen w-20 shrink-0 flex-col items-center border-r border-border/60 bg-background/60 py-4 backdrop-blur md:flex">
      <Link
        to="/home"
        className="mb-4 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-11 min-w-11 grid place-items-center [&_svg]:h-7 [&_svg]:w-7"
        aria-label="Home"
      >
        <BrandMark withWordmark={false} />
      </Link>
      <nav aria-label="Primary" className="flex w-full flex-1 flex-col items-center gap-2">
        {NAV_ITEMS.map(({ to, labelKey, icon: Icon }) => {
          const active = isActive(pathname, to);
          const label = t(labelKey);
          return (
            <Link
              key={to}
              to={to}
              title={label}
              aria-label={label}
              aria-current={active ? "page" : undefined}
              className={
                "tap-press flex h-11 w-11 items-center justify-center rounded-xl text-sm font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
                (active
                  ? "bg-accent/15 text-accent"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground")
              }
            >
              <Icon size={20} aria-hidden="true" className={active ? "text-accent" : ""} />
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

function MobileTabBar({ pathname }: { pathname: string }) {
  const { t } = useTranslation();
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-border/60 bg-background/95 backdrop-blur md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-around px-2 pt-1.5 pb-1.5">
        {NAV_ITEMS.map(({ to, labelKey, icon: Icon }) => {
          const active = isActive(pathname, to);
          return (
            <li key={to} className="flex-1">
              <Link
                to={to}
                aria-current={active ? "page" : undefined}
                className={
                  "tap-press flex min-h-[48px] flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-1 text-xs font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
                  (active
                    ? "text-accent font-semibold"
                    : "text-muted-foreground hover:text-foreground")
                }
                style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
              >
                <span
                  className={
                    "flex h-8 w-14 items-center justify-center rounded-full transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] " +
                    (active ? "bg-accent/15" : "")
                  }
                >
                  <Icon size={20} aria-hidden="true" />
                </span>
                <span>{t(labelKey)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function FloatingChatButton() {
  const { t } = useTranslation();
  return (
    <Link
      to="/chat"
      aria-label={t("nav.chat")}
      title={t("nav.chat")}
      className="tap-press fixed right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-lg ring-1 ring-accent/40 transition-transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring bottom-[calc(5rem+env(safe-area-inset-bottom))] md:bottom-6"
    >
      <MessageCircle size={24} aria-hidden="true" />
    </Link>
  );
}
