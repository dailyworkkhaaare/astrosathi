import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { supabase } from "@/integrations/supabase/client";
import { useAuthSession, waitForAuthReady } from "@/lib/auth";

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
