import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { supabase } from "@/integrations/supabase/client";
import { getOnboardingState, routeForOnboardingState } from "@/lib/birth-profile";
import { refreshAuthSession } from "@/lib/auth";

export const Route = createFileRoute("/auth/callback")({
  head: () => ({
    meta: [{ title: "Signing you in — AstroSaathi" }],
  }),
  component: AuthCallbackPage,
});

function AuthCallbackPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let subscription: { unsubscribe: () => void } | null = null;
    let timeout: ReturnType<typeof setTimeout> | null = null;

    const url = new URL(window.location.href);
    const type = url.searchParams.get("type") ?? url.hash.match(/type=([^&]+)/)?.[1];
    if (type === "recovery") {
      navigate({ to: "/reset-password", replace: true });
      return;
    }

    const proceed = async () => {
      if (cancelled) return;
      cancelled = true;
      if (timeout) clearTimeout(timeout);
      subscription?.unsubscribe();
      try {
        await refreshAuthSession();
        const s = await getOnboardingState();
        navigate({ to: routeForOnboardingState(s), replace: true });
      } catch {
        setError(t("auth.errors.generic"));
      }
    };

    const run = async () => {
      // PKCE flow: exchange the ?code=... for a session deterministically.
      // No-op / harmless on implicit (hash-token) flows.
      const code = url.searchParams.get("code");
      if (code) {
        try {
          await supabase.auth.exchangeCodeForSession(window.location.href);
        } catch {
          // Fall through — onAuthStateChange / getSession still get a chance.
        }
      }

      // Supabase may clean the OAuth URL to `/auth/callback#` before the
      // auth event reaches this route. Poll briefly and refresh the shared
      // auth cache so protected onboarding routes see the same session.
      for (let attempt = 0; attempt < 32; attempt++) {
        if (cancelled) return;
        const session = await refreshAuthSession();
        if (session) {
          void proceed();
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
      }

      // Wait for the first real auth event instead of guessing a timeout.
      const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
        if (cancelled) return;
        if (session && (event === "SIGNED_IN" || event === "INITIAL_SESSION")) {
          void proceed();
        }
      });
      subscription = sub.subscription;

      timeout = setTimeout(() => {
        if (cancelled) return;
        cancelled = true;
        subscription?.unsubscribe();
        setError(t("auth.errors.generic"));
      }, 8000);
    };

    void run();

    return () => {
      cancelled = true;
      if (timeout) clearTimeout(timeout);
      subscription?.unsubscribe();
    };
  }, [navigate, t]);

  return (
    <section className="mx-auto max-w-md py-16 text-center">
      {error ? (
        <>
          <p className="text-sm text-destructive-strong">{error}</p>
          <button
            type="button"
            onClick={() => navigate({ to: "/auth", replace: true })}
            className="mt-4 text-sm font-medium text-primary hover:underline"
          >
            {t("auth.backToSignIn")}
          </button>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">{t("auth.callback.loading")}</p>
      )}
    </section>
  );
}
