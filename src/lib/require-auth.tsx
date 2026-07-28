import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { supabase } from "@/integrations/supabase/client";
import { useAuthSession, waitForAuthReady } from "@/lib/auth";
import { getOnboardingState, routeForOnboardingState } from "@/lib/birth-profile";

// Client-side auth gate. Only redirects to /auth when we've deterministically
// confirmed no valid session exists — never on a transient hydration tick,
// and never when the failure is network/offline (mobile-friendly).
export function useRequireAuth() {
  const navigate = useNavigate();
  const { user, loading } = useAuthSession();
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (loading || user) return;

    let cancelled = false;
    void (async () => {
      const session = await waitForAuthReady();
      if (cancelled) return;
      if (session) return;

      // Last-ditch: try a refresh. Only redirect on a hard auth failure
      // (invalid_grant / refresh_token_not_found). Network errors leave the
      // user in place so a flaky connection does not sign them out.
      try {
        const { data, error } = await supabase.auth.refreshSession();
        if (cancelled) return;
        if (data.session) return;
        const msg = (error?.message ?? "").toLowerCase();
        const isNetwork =
          msg.includes("network") || msg.includes("failed to fetch") || msg.includes("load failed");
        if (isNetwork) return;
        navigate({ to: "/auth", replace: true });
      } catch {
        // Treat as network hiccup; do not sign the user out.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loading, user, navigate]);
  return user;
}

// Guards routes that require a fully onboarded account (consent + birth
// details saved). Redirects to whichever onboarding step is still pending
// so home/today/settings/chat can't be reached by direct navigation while
// onboarding is incomplete.
export function useRequireOnboarding() {
  const user = useRequireAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void getOnboardingState().then((state) => {
      if (cancelled || state === "ready") return;
      navigate({ to: routeForOnboardingState(state), replace: true });
    });
    return () => {
      cancelled = true;
    };
  }, [user, navigate]);
  return user;
}
