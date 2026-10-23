type HapticKind = "selection" | "light" | "success" | "warning" | "error";

export const HAPTICS_STORAGE_KEY = "astrosaathi.haptics";

type CapacitorListener = { remove: () => void | Promise<void> };
type CapacitorPlugins = {
  App?: {
    addListener?: (
      eventName: string,
      callback: (event: { isActive?: boolean; url?: string; canGoBack?: boolean }) => void,
    ) => CapacitorListener | Promise<CapacitorListener>;
  };
  Haptics?: {
    selectionChanged?: () => Promise<void>;
    impact?: (options: { style: "LIGHT" | "MEDIUM" | "HEAVY" }) => Promise<void>;
    notification?: (options: { type: "SUCCESS" | "WARNING" | "ERROR" }) => Promise<void>;
  };
  StatusBar?: {
    setStyle?: (options: { style: "LIGHT" | "DARK" }) => Promise<void>;
    setBackgroundColor?: (options: { color: string }) => Promise<void>;
  };
  NavigationBar?: {
    setColor?: (options: { color: string; darkButtons: boolean }) => Promise<void>;
    setNavigationBarColor?: (options: { color: string; darkButtons: boolean }) => Promise<void>;
  };
};

function plugins(): CapacitorPlugins {
  const root = globalThis as typeof globalThis & {
    Capacitor?: { Plugins?: CapacitorPlugins };
  };
  return root.Capacitor?.Plugins ?? {};
}

export type AppPlatform = "ios" | "android" | "web";

/**
 * Which native conventions the shell should follow. Capacitor knows for sure;
 * in a browser, Android user agents get Material chrome and everything else
 * (iOS Safari, desktop) gets the iOS-style chrome, reported as "web".
 */
export function getAppPlatform(): AppPlatform {
  const root = globalThis as typeof globalThis & {
    Capacitor?: { getPlatform?: () => string };
  };
  const native = root.Capacitor?.getPlatform?.();
  if (native === "ios" || native === "android") return native;
  const userAgent = typeof navigator === "undefined" ? "" : navigator.userAgent;
  return /Android/i.test(userAgent) ? "android" : "web";
}

function reducedMotion() {
  return (
    typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

function hapticsEnabled() {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(HAPTICS_STORAGE_KEY) !== "false";
  } catch {
    return true;
  }
}

function ignoreNativeError(operation: Promise<void> | void | undefined) {
  void Promise.resolve(operation).catch(() => {});
}

export function syncNativeSystemBars(isDark: boolean) {
  const color = isDark ? "#201B2B" : "#FBF8F0";
  const statusBar = plugins().StatusBar;
  const navigationBar = plugins().NavigationBar;

  // These plugins only exist after the Capacitor wrapper installs them. The
  // web app keeps its normal browser theme-color behaviour when they are absent.
  ignoreNativeError(statusBar?.setStyle?.({ style: isDark ? "LIGHT" : "DARK" }));
  ignoreNativeError(statusBar?.setBackgroundColor?.({ color }));
  if (navigationBar?.setColor) {
    ignoreNativeError(navigationBar.setColor({ color, darkButtons: !isDark }));
  } else {
    ignoreNativeError(navigationBar?.setNavigationBarColor?.({ color, darkButtons: !isDark }));
  }
}

export async function triggerHaptic(kind: HapticKind = "light") {
  if (!hapticsEnabled()) return;
  try {
    const haptics = plugins().Haptics;
    if (haptics) {
      if (kind === "selection" && haptics.selectionChanged) {
        await haptics.selectionChanged();
        return;
      }
      if (kind === "success" || kind === "warning" || kind === "error") {
        await haptics.notification?.({
          type: kind.toUpperCase() as "SUCCESS" | "WARNING" | "ERROR",
        });
        return;
      }
      await haptics.impact?.({ style: kind === "selection" ? "LIGHT" : "MEDIUM" });
      return;
    }

    if (!reducedMotion() && typeof navigator !== "undefined" && "vibrate" in navigator) {
      const pattern =
        kind === "success"
          ? [8, 24, 12]
          : kind === "warning" || kind === "error"
            ? [18, 36, 18]
            : 8;
      navigator.vibrate(pattern);
    }
  } catch {
    // Native affordances must never interrupt the core reading flow.
  }
}

export async function shareNative(payload: { title?: string; text: string; url?: string }) {
  if (typeof navigator === "undefined") return "unavailable" as const;

  const share = navigator.share?.bind(navigator);
  if (share) {
    try {
      await share(payload);
      return "shared" as const;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return "cancelled" as const;
    }
  }

  const fallback = [payload.title, payload.text, payload.url].filter(Boolean).join("\n\n");
  if (navigator.clipboard && fallback) {
    try {
      await navigator.clipboard.writeText(fallback);
      return "copied" as const;
    } catch {
      // A denied clipboard permission should never interrupt the current reading.
    }
  }
  return "unavailable" as const;
}

export function onAppResume(callback: () => void) {
  if (typeof window === "undefined") return () => {};

  let disposed = false;
  let lastRun = 0;
  let appListener: CapacitorListener | null = null;
  const run = () => {
    const now = Date.now();
    if (disposed || now - lastRun < 1500) return;
    lastRun = now;
    callback();
  };
  const onVisibility = () => {
    if (document.visibilityState === "visible") run();
  };

  window.addEventListener("focus", run);
  document.addEventListener("visibilitychange", onVisibility);

  const listener = plugins().App?.addListener?.("appStateChange", (event) => {
    if (event.isActive) run();
  });
  void Promise.resolve(listener).then((sub) => {
    if (!sub) return;
    if (disposed) void sub.remove();
    else appListener = sub;
  });

  return () => {
    disposed = true;
    window.removeEventListener("focus", run);
    document.removeEventListener("visibilitychange", onVisibility);
    void appListener?.remove();
  };
}

export function onNativeDeepLink(callback: (url: string) => void) {
  let disposed = false;
  let appListener: CapacitorListener | null = null;
  const listener = plugins().App?.addListener?.("appUrlOpen", (event) => {
    if (!disposed && event.url) callback(event.url);
  });
  void Promise.resolve(listener).then((sub) => {
    if (!sub) return;
    if (disposed) void sub.remove();
    else appListener = sub;
  });
  return () => {
    disposed = true;
    void appListener?.remove();
  };
}

export function onNativeBack(callback: (canGoBack: boolean) => void) {
  let disposed = false;
  let appListener: CapacitorListener | null = null;
  const listener = plugins().App?.addListener?.("backButton", (event) => {
    if (!disposed) callback(event.canGoBack !== false);
  });
  void Promise.resolve(listener).then((sub) => {
    if (!sub) return;
    if (disposed) void sub.remove();
    else appListener = sub;
  });
  return () => {
    disposed = true;
    void appListener?.remove();
  };
}

const NATIVE_ROUTE_ALIASES: Record<string, string> = {
  "/ask": "/chat",
  "/cosmos": "/home",
  "/connections": "/people",
};
const NATIVE_NUDGE_PATH = /^\/nudges\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

export function supportedDeepLinkPath(rawUrl: string) {
  try {
    const base = typeof window !== "undefined" ? window.location.origin : "https://astrosaathi.app";
    const url = new URL(rawUrl, base);
    const path =
      url.protocol === "http:" || url.protocol === "https:"
        ? url.pathname
        : `/${url.hostname}${url.pathname}`;
    const normalizedPath = NATIVE_ROUTE_ALIASES[path] ?? path;
    const nudgeMatch = normalizedPath.match(NATIVE_NUDGE_PATH);
    if (nudgeMatch) return `/nudges?focus=${encodeURIComponent(nudgeMatch[1])}`;
    const allowed =
      ["/chat", "/today", "/home", "/journey", "/people", "/life", "/journal", "/nudges"].includes(
        normalizedPath,
      ) ||
      /^\/people\/[^/]+(?:\/(?:edit|compatibility))?$/.test(normalizedPath);
    return allowed ? `${normalizedPath}${url.search}${url.hash}` : null;
  } catch {
    return null;
  }
}
