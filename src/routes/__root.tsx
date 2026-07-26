import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import "../i18n";
import { AppShell } from "../components/layout/AppShell";
import { PwaRegister } from "../components/PwaRegister";
import { supabase } from "../integrations/supabase/client";
import { APP_VERSION } from "../lib/preferences";
import { PERSIST_STORAGE_KEY, clearChartGatewayCache } from "../lib/queries";

function NotFoundComponent() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-7xl font-bold text-foreground">404</h1>
        <h2 className="font-display mt-4 text-xl font-semibold text-foreground">
          {t("states.notFoundTitle")}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">{t("states.notFoundBody")}</p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {t("states.goHome")}
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  const { t } = useTranslation();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-xl font-semibold tracking-tight text-foreground">
          {t("states.errorTitle")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("states.errorBody")}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {t("states.retry")}
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            {t("states.goHome")}
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#151732" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { name: "apple-mobile-web-app-title", content: "AstroSaathi" },
      { title: "AstroSaathi — Vedic Astrology Guidance in Your Language" },
      {
        name: "description",
        content:
          "Personalized Vedic astrology guidance in Marathi, Hindi, and English — kundli, daily insights, and one-to-one chat with an astrologer.",
      },
      { name: "author", content: "AstroSaathi" },
      { property: "og:title", content: "AstroSaathi — Vedic Astrology Guidance in Your Language" },
      {
        property: "og:description",
        content:
          "Personalized Vedic astrology guidance in Marathi, Hindi, and English — kundli, daily insights, and one-to-one chat with an astrologer.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "AstroSaathi — Vedic Astrology Guidance in Your Language" },
      {
        name: "twitter:description",
        content:
          "Personalized Vedic astrology guidance in Marathi, Hindi, and English — kundli, daily insights, and one-to-one chat with an astrologer.",
      },
      {
        property: "og:image",
        content:
          "https://astrosathi.vercel.app/og-image.jpg",
      },
      {
        name: "twitter:image",
        content:
          "https://astrosathi.vercel.app/og-image.jpg",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.ico?v=2", type: "image/x-icon" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png?v=2" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500&family=Noto+Sans+Devanagari:wght@400;500;600;700&family=Noto+Serif+Devanagari:wght@500;600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <AppQueryProvider queryClient={queryClient}>
      <AuthCacheSync />
      <PwaRegister />
      <AppShell>
        {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
        <Outlet />
      </AppShell>
    </AppQueryProvider>
  );
}

function AppQueryProvider({
  queryClient,
  children,
}: {
  queryClient: QueryClient;
  children: ReactNode;
}) {
  // Persister is browser-only — localStorage is not available during SSR.
  const [persister] = useState(() =>
    typeof window !== "undefined"
      ? createSyncStoragePersister({
          storage: window.localStorage,
          key: PERSIST_STORAGE_KEY,
        })
      : null,
  );

  if (!persister) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: 24 * 60 * 60 * 1000,
        // Tie the persisted cache to the app version so deploys invalidate.
        buster: APP_VERSION,
        dehydrateOptions: {
          shouldDehydrateQuery: (query) => {
            if (query.state.status !== "success") return false;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const data = query.state.data as any;
            if (!data) return false;
            // Never persist responses that carry an error payload
            if (typeof data === "object") {
              if (data.errorCode || data.error) return false;
            }
            return true;
          },
        },
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}

// On sign-out, wipe the persisted chart-gateway cache so the next user does
// not see the previous account's readings.
function AuthCacheSync() {
  const qc = useQueryClient();
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        clearChartGatewayCache(qc);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [qc]);
  return null;
}
