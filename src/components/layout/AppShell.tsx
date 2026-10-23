import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  History,
  LayoutGrid,
  MessageCircle,
  Orbit,
  PanelLeftClose,
  PanelLeftOpen,
  Sun,
  UsersRound,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { AstroArt } from "@/components/AstroArt";
import { BrandMark } from "@/components/BrandMark";
import { ContextDock } from "@/components/layout/ContextDock";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { readStoredLanguage, setLanguage } from "@/i18n";
import { mockAuth, useAuthSession, type MockUser } from "@/lib/auth";
import type { SignKey } from "@/lib/chart-types";
import {
  getAppPlatform,
  syncNativeSystemBars,
  triggerHaptic,
  type AppPlatform,
} from "@/lib/native-device";
import { applyTheme, bindSystemThemeListener, getPreferences } from "@/lib/preferences";
import { useChartGatewayCacheControls, usePlanets } from "@/lib/queries";

type MobileWorldItem = {
  to: "/home" | "/today" | "/chat" | "/journey" | "/people";
  labelKey: string;
  accessibleLabelKey: string;
  icon: typeof LayoutGrid;
  emphasis?: "ask";
};

const MOBILE_WORLD_ITEMS: MobileWorldItem[] = [
  { to: "/today", labelKey: "nav.today", accessibleLabelKey: "nav.today", icon: Sun },
  { to: "/home", labelKey: "nav.cosmos", accessibleLabelKey: "nav.myCosmos", icon: Orbit },
  {
    to: "/chat",
    labelKey: "nav.ask",
    accessibleLabelKey: "nav.ask",
    icon: MessageCircle,
    emphasis: "ask",
  },
  { to: "/journey", labelKey: "nav.journey", accessibleLabelKey: "nav.journey", icon: History },
  {
    to: "/people",
    labelKey: "nav.people",
    accessibleLabelKey: "nav.connections",
    icon: UsersRound,
  },
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
  useEffect(() => {
    const root = document.documentElement;
    const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!themeColor) return;

    const syncThemeColor = () => {
      const color = getComputedStyle(root).getPropertyValue("--as-color-surface-canvas").trim();
      if (color) themeColor.content = color;
      syncNativeSystemBars(root.classList.contains("dark"));
    };

    syncThemeColor();
    const observer = new MutationObserver(syncThemeColor);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user } = useAuthSession();
  const logoTo = user ? "/home" : "/";
  const isOnboarding = pathname.startsWith("/onboarding/");
  const showNav = !!user && !isOnboarding;
  // The /chat route owns its own full-screen ChatGPT-style shell
  // (collapsible sidebar + slim top bar), so it renders bare — without
  // the standard app header or centered max-width wrapper.
  if (
    pathname === "/auth" ||
    pathname === "/auth/callback" ||
    pathname === "/language" ||
    pathname === "/reset-password"
  ) {
    return (
      <div className="as-atmosphere min-h-dvh bg-background text-foreground">
        {hydrated ? children : <HydrationSkeleton />}
      </div>
    );
  }
  const isChat = pathname === "/chat";
  const isLanding = pathname === "/";
  return (
    <div className="as-atmosphere min-h-dvh bg-background text-foreground md:flex">
      {showNav && <DesktopRail pathname={pathname} />}
      <div className="flex min-w-0 flex-1 flex-col">
        {!isChat && !showNav && (
          <header
            className="sticky top-0 z-10 border-b border-border/60 bg-background/80 backdrop-blur"
            style={{ paddingTop: "env(safe-area-inset-top)" }}
          >
            <div
              className={
                "mx-auto flex items-center justify-between px-4 py-3 sm:px-6 " +
                (isLanding ? "max-w-[90rem]" : "max-w-4xl")
              }
            >
              <Link
                to={logoTo}
                className="focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md min-h-11 min-w-11 grid place-items-center"
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
              : "relative mx-auto w-full px-4 pb-8 sm:px-6 " +
                (isLanding ? "max-w-[94rem] " : "max-w-4xl ") +
                "pt-[calc(2.5rem+var(--as-safe-top))] md:pt-12 " +
                (showNav
                  ? "pb-[calc(var(--mobile-tabbar-h)+var(--as-safe-bottom)+1rem)] md:pb-8"
                  : "")
          }
        >
          {hydrated ? (
            <>
              {showNav && user && !isChat && <MobileProfileLauncher user={user} />}
              {showNav && !isChat && supportsContextDock(pathname) ? (
                <ContextDock pathname={pathname} />
              ) : null}
              {children}
            </>
          ) : (
            <HydrationSkeleton />
          )}
        </main>
        {showNav && <MobileTabBar pathname={pathname} />}
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
  if (to === "/today") return pathname === "/today" || pathname.startsWith("/today/");
  if (to === "/chat") return pathname === "/chat" || pathname.startsWith("/chat/");
  if (to === "/journey")
    return (
      pathname === "/journey" ||
      pathname.startsWith("/journey/") ||
      pathname === "/life" ||
      pathname.startsWith("/life/") ||
      pathname === "/journal"
    );
  if (to === "/people") return pathname === "/people" || pathname.startsWith("/people/");
  return false;
}

function supportsContextDock(pathname: string) {
  return (
    pathname === "/home" ||
    pathname.startsWith("/home/") ||
    pathname === "/today" ||
    pathname.startsWith("/today/") ||
    pathname === "/journey" ||
    pathname.startsWith("/journey/") ||
    pathname === "/life" ||
    pathname.startsWith("/life/") ||
    pathname === "/journal" ||
    pathname === "/people" ||
    pathname.startsWith("/people/")
  );
}

function DesktopRail({ pathname }: { pathname: string }) {
  const { t } = useTranslation();
  const { user } = useAuthSession();
  const [expanded, setExpanded] = useState(false);
  const toggleLabel = t(expanded ? "nav.collapseNavigation" : "nav.expandNavigation");

  return (
    <aside
      className={
        "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-border/60 bg-background/60 py-4 backdrop-blur transition-[width] duration-300 md:flex " +
        (expanded ? "w-64 px-3" : "w-20 items-center px-3")
      }
    >
      <div
        className={
          "mb-5 flex w-full items-center " + (expanded ? "justify-between" : "justify-center")
        }
      >
        <Link
          to="/home"
          className="grid min-h-11 min-w-11 place-items-center rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={t("nav.myCosmos")}
        >
          <BrandMark withWordmark={expanded} className="h-7 w-7" />
        </Link>
        <button
          type="button"
          aria-label={toggleLabel}
          aria-controls="desktop-world-nav"
          aria-expanded={expanded}
          title={toggleLabel}
          onClick={() => setExpanded((current) => !current)}
          className={
            "tap-press grid h-11 w-11 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
            (expanded ? "" : "absolute top-4")
          }
        >
          {expanded ? (
            <PanelLeftClose size={18} aria-hidden="true" />
          ) : (
            <PanelLeftOpen size={18} aria-hidden="true" />
          )}
        </button>
      </div>
      <nav
        id="desktop-world-nav"
        aria-label="Primary"
        className={
          "flex w-full flex-1 flex-col gap-2 " + (expanded ? "items-stretch" : "items-center")
        }
      >
        {MOBILE_WORLD_ITEMS.map(({ to, labelKey, accessibleLabelKey, icon: Icon, emphasis }) => {
          const active = isActive(pathname, to);
          const isAsk = emphasis === "ask";
          const label = t(labelKey);
          const accessibleLabel = t(accessibleLabelKey);
          return (
            <Link
              key={to}
              to={to}
              title={expanded ? undefined : accessibleLabel}
              aria-label={accessibleLabel}
              aria-current={active ? "page" : undefined}
              className={
                "tap-press flex min-h-11 items-center gap-3 rounded-xl text-sm font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
                (expanded ? "w-full px-3" : "h-11 w-11 justify-center") +
                " " +
                (active
                  ? isAsk
                    ? "bg-[var(--as-color-action-intelligence)] text-white shadow-[var(--as-elevation-glow)]"
                    : "bg-accent/15 text-accent"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground")
              }
            >
              <Icon
                size={20}
                aria-hidden="true"
                className={active && !isAsk ? "text-accent" : ""}
              />
              {expanded ? <span className="truncate">{label}</span> : null}
            </Link>
          );
        })}
      </nav>
      {user ? <DesktopProfileLauncher user={user} expanded={expanded} /> : null}
    </aside>
  );
}

const SIGN_GLYPHS: Record<SignKey, string> = {
  aries: "♈",
  taurus: "♉",
  gemini: "♊",
  cancer: "♋",
  leo: "♌",
  virgo: "♍",
  libra: "♎",
  scorpio: "♏",
  sagittarius: "♐",
  capricorn: "♑",
  aquarius: "♒",
  pisces: "♓",
};

function avatarFallback(user: MockUser) {
  return (user.name?.trim()[0] ?? user.email.trim()[0] ?? "?").toUpperCase();
}

function useMoonSignAvatar(user: MockUser) {
  const { t } = useTranslation();
  const planetsQuery = usePlanets();
  const moonSignKey =
    planetsQuery.data?.planets.find((planet) => planet.key === "moon")?.signKey ?? null;
  const moonSignLabel = moonSignKey ? t(`signs.${moonSignKey}`) : null;
  const moonLabel = moonSignLabel
    ? t("settings.profile.moonSignAvatar", { sign: moonSignLabel })
    : null;

  return {
    label: moonLabel ? `${t("nav.profileSettings")} · ${moonLabel}` : t("nav.profileSettings"),
    title: moonLabel ?? t("nav.profileSettings"),
    value: moonSignKey ? SIGN_GLYPHS[moonSignKey] : avatarFallback(user),
    moonSignKey,
    hasMoonSign: !!moonSignKey,
  };
}

function MoonSignAvatar({
  avatar,
  size = "default",
}: {
  avatar: ReturnType<typeof useMoonSignAvatar>;
  size?: "default" | "mobile";
}) {
  if (avatar.moonSignKey) {
    // The gold Moon-sign coin replaces the text glyph, which some platforms
    // render as a colour emoji.
    return (
      <span className="relative shrink-0" aria-hidden="true" title={avatar.title}>
        <AstroArt
          kind="sign"
          name={avatar.moonSignKey}
          size={size === "mobile" ? 40 : 32}
          priority
        />
      </span>
    );
  }
  return (
    <span
      className={
        "relative grid shrink-0 place-items-center rounded-full bg-accent/15 font-display text-accent ring-1 ring-accent/20 " +
        (size === "mobile" ? "h-8 w-8 text-xl" : "h-7 w-7 text-lg")
      }
      aria-hidden="true"
      title={avatar.title}
    >
      <span className="leading-none">{avatar.value}</span>
      {avatar.hasMoonSign ? (
        <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-primary shadow-[0_0_0_2px_hsl(var(--card))]" />
      ) : null}
    </span>
  );
}

function ProfileIdentity({ user }: { user: MockUser }) {
  const { t } = useTranslation();
  return (
    <div className="min-w-0">
      <p className="truncate text-sm font-semibold text-foreground">
        {user.name?.trim() || t("settings.profile.nameFallback")}
      </p>
      <p className="truncate text-xs text-muted-foreground">{user.email}</p>
    </div>
  );
}

function DesktopProfileLauncher({ user, expanded }: { user: MockUser; expanded: boolean }) {
  const { t } = useTranslation();
  const cache = useChartGatewayCacheControls();
  const avatar = useMoonSignAvatar(user);
  const onSignOut = () => {
    cache.clear();
    void mockAuth.signOut();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={avatar.label}
          title={expanded ? undefined : avatar.title}
          className={
            "tap-press mt-4 flex min-h-11 items-center rounded-xl border border-border/70 bg-card/60 text-foreground transition-colors hover:bg-card focus:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
            (expanded ? "w-full gap-3 px-3 text-left" : "h-11 w-11 justify-center")
          }
        >
          <MoonSignAvatar avatar={avatar} />
          {expanded ? (
            <span className="truncate text-sm font-medium">{t("nav.profile")}</span>
          ) : null}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        side="right"
        className="w-64 rounded-2xl border-border bg-popover p-2 shadow-[var(--shadow-elevated)]"
      >
        <DropdownMenuLabel className="px-3 py-2">
          <ProfileIdentity user={user} />
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <ProfileMenuLinks />
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={onSignOut}
          className="min-h-11 rounded-xl px-3 text-destructive-strong focus:bg-destructive/10 focus:text-destructive-strong"
        >
          {t("settings.account.signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ProfileMenuLinks() {
  const { t } = useTranslation();
  const itemClass =
    "min-h-11 cursor-pointer rounded-xl px-3 text-foreground focus:bg-muted focus:text-foreground";
  return (
    <>
      <DropdownMenuItem asChild className={itemClass}>
        <Link to="/onboarding/birth">{t("settings.profile.editBirth")}</Link>
      </DropdownMenuItem>
      <DropdownMenuItem asChild className={itemClass}>
        <Link to="/settings">{t("settings.title")}</Link>
      </DropdownMenuItem>
      <DropdownMenuItem asChild className={itemClass}>
        <Link to="/settings/memory">{t("settings.profile.memory")}</Link>
      </DropdownMenuItem>
    </>
  );
}

function MobileProfileLauncher({ user }: { user: MockUser }) {
  const { t } = useTranslation();
  const cache = useChartGatewayCacheControls();
  const avatar = useMoonSignAvatar(user);
  const onSignOut = () => {
    cache.clear();
    void mockAuth.signOut();
  };

  return (
    <div className="absolute right-[calc(1rem+var(--as-safe-right))] top-[calc(var(--as-safe-top)+2.5rem)] z-40 sm:right-6 md:hidden">
      <Drawer>
        <DrawerTrigger asChild>
          <button
            type="button"
            aria-label={avatar.label}
            title={avatar.title}
            className={
              "tap-press grid h-11 w-11 place-items-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
              (avatar.hasMoonSign
                ? ""
                : "border border-border/70 bg-card/85 shadow-[var(--shadow-soft)] backdrop-blur")
            }
          >
            <MoonSignAvatar avatar={avatar} size="mobile" />
          </button>
        </DrawerTrigger>
        <DrawerContent className="rounded-t-[1.75rem] border-border bg-background px-4 pb-[calc(1rem+var(--as-safe-bottom))]">
          <DrawerHeader className="px-1 pb-4 pt-6 text-left">
            <DrawerTitle>{t("nav.profileSettings")}</DrawerTitle>
            <DrawerDescription asChild>
              <ProfileIdentity user={user} />
            </DrawerDescription>
          </DrawerHeader>
          <div className="space-y-2">
            <MobileProfileLink to="/onboarding/birth" label={t("settings.profile.editBirth")} />
            <MobileProfileLink to="/settings" label={t("settings.title")} />
            <MobileProfileLink to="/settings/memory" label={t("settings.profile.memory")} />
            <button
              type="button"
              onClick={onSignOut}
              className="tap-press flex min-h-11 w-full items-center rounded-xl px-4 text-left text-sm font-medium text-destructive-strong hover:bg-destructive/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {t("settings.account.signOut")}
            </button>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

function MobileProfileLink({
  to,
  label,
}: {
  to: "/onboarding/birth" | "/settings" | "/settings/memory";
  label: string;
}) {
  return (
    <DrawerClose asChild>
      <Link
        to={to}
        className="tap-press flex min-h-11 items-center rounded-xl bg-card/60 px-4 text-sm font-medium text-foreground hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {label}
      </Link>
    </DrawerClose>
  );
}

function MobileTabBar({ pathname }: { pathname: string }) {
  const { t } = useTranslation();
  const [platform, setPlatform] = useState<AppPlatform>("web");
  useEffect(() => setPlatform(getAppPlatform()), []);
  const android = platform === "android";
  const worlds = MOBILE_WORLD_ITEMS.filter((item) => item.emphasis !== "ask");
  const ask = MOBILE_WORLD_ITEMS.find((item) => item.emphasis === "ask");

  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-10 h-[calc(7rem+var(--as-safe-bottom))] bg-gradient-to-t from-background via-background/80 to-transparent md:hidden"
      />
      <nav
        aria-label="Primary"
        data-platform={platform}
        className="fixed inset-x-0 bottom-0 z-20 px-4 md:hidden"
        style={{ paddingBottom: "max(var(--as-safe-bottom), 0.75rem)" }}
      >
        <div className="mx-auto flex max-w-md items-center gap-2.5">
          <ul
            className={
              "flex min-w-0 flex-1 items-stretch " +
              (android
                ? "h-[68px] rounded-[34px] bg-surface-raised px-1 shadow-[var(--as-elevation-2)]"
                : "glass-specular h-[62px] rounded-full border border-border-strong/40 p-1 shadow-[var(--as-elevation-3)]")
            }
            style={
              android
                ? undefined
                : {
                    backgroundColor: "var(--as-glass-control-fill)",
                    backdropFilter:
                      "blur(var(--as-glass-control-blur)) saturate(var(--as-glass-control-saturate))",
                    WebkitBackdropFilter:
                      "blur(var(--as-glass-control-blur)) saturate(var(--as-glass-control-saturate))",
                  }
            }
          >
            {worlds.map(({ to, labelKey, accessibleLabelKey, icon: Icon }) => {
              const active = isActive(pathname, to);
              return (
                <li key={to} className="flex min-w-0 flex-1">
                  <Link
                    to={to}
                    aria-current={active ? "page" : undefined}
                    aria-label={t(accessibleLabelKey)}
                    onClick={() => void triggerHaptic(active ? "light" : "selection")}
                    className={
                      "tap-press flex min-w-0 flex-1 flex-col items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
                      (android
                        ? "gap-1 rounded-[30px] text-xs " +
                          (active
                            ? "font-semibold text-foreground"
                            : "font-medium text-muted-foreground")
                        : "motion-morph gap-0.5 rounded-full text-[10px] " +
                          (active
                            ? "bg-foreground/[0.12] font-semibold text-accent"
                            : "font-medium text-muted-foreground hover:text-foreground"))
                    }
                    style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
                  >
                    {android ? (
                      <span
                        className={
                          "motion-morph flex h-[30px] w-[52px] items-center justify-center rounded-full " +
                          (active ? "bg-accent/20 text-accent" : "")
                        }
                      >
                        <Icon size={22} aria-hidden="true" />
                      </span>
                    ) : (
                      <Icon size={22} aria-hidden="true" />
                    )}
                    <span className="max-w-full truncate px-1">{t(labelKey)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
          {ask ? (
            <Link
              to={ask.to}
              aria-current={isActive(pathname, ask.to) ? "page" : undefined}
              aria-label={t(ask.accessibleLabelKey)}
              onClick={() => void triggerHaptic(isActive(pathname, ask.to) ? "light" : "selection")}
              className={
                "tap-press flex shrink-0 flex-col items-center justify-center gap-0.5 bg-[var(--as-color-action-ask)] font-semibold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background " +
                (android
                  ? "h-16 w-16 rounded-[20px] text-[11px] shadow-[var(--as-elevation-2)]"
                  : "glass-specular h-[62px] w-[62px] rounded-full border border-white/25 text-[10px] shadow-[var(--as-elevation-3)]")
              }
              style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
            >
              <ask.icon size={android ? 24 : 22} aria-hidden="true" />
              <span>{t(ask.labelKey)}</span>
            </Link>
          ) : null}
        </div>
      </nav>
    </>
  );
}
