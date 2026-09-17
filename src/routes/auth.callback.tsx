import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CircleAlert, Orbit } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { AuthTransitionPage } from "@/components/auth/AuthTransitionPage";
import { StateFrame } from "@/components/states/StateFrame";
import { Button } from "@/components/ui/button";
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
    <AuthTransitionPage>
      {error ? (
        <StateFrame
          scope="panel"
          tone="error"
          role="alert"
          live="assertive"
          title={t("auth.callback.errorTitle")}
          description={t("auth.callback.errorBody", { error })}
          icon={<CircleAlert className="h-6 w-6" strokeWidth={1.8} />}
          action={
            <Button type="button" onClick={() => navigate({ to: "/auth", replace: true })}>
              {t("auth.backToSignIn")}
            </Button>
          }
          className="border-white/15 bg-background/95 shadow-2xl backdrop-blur-xl"
        />
      ) : (
        <StateFrame
          scope="panel"
          tone="loading"
          role="status"
          live="polite"
          busy
          title={t("auth.callback.loadingTitle")}
          description={t("auth.callback.loadingBody")}
          icon={
            <>
              <Orbit className="h-6 w-6" strokeWidth={1.6} />
              <span className="as-state-orbit-dot absolute left-1/2 top-1/2 size-1.5 rounded-full bg-current shadow-[0_0_10px_currentColor]" />
            </>
          }
          className="border-white/15 bg-background/95 shadow-2xl backdrop-blur-xl"
        />
      )}
    </AuthTransitionPage>
  );
}
