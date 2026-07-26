// Real Supabase auth service. Keeps the previous mock export names
// (`mockAuth`, `getSession`, `clearSession`, `saveSession`) so existing
// call sites stay unchanged, while all state now flows from Supabase.

import { useSyncExternalStore } from "react";
import type { Session } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";

export type MockUser = { id: string; email: string; name?: string };
export type AuthResult = { user: MockUser; needsConfirmation?: boolean } | { error: string };

// ---------- session cache + subscribers ----------

let currentSession: Session | null = null;
let initialized = false;
let initialSessionLoaded = false;
let hydrationPromise: Promise<Session | null> | null = null;
const listeners = new Set<() => void>();

function userFromSession(s: Session | null): MockUser | null {
  if (!s?.user) return null;
  return {
    id: s.user.id,
    email: s.user.email ?? "",
    name:
      (s.user.user_metadata?.name as string | undefined) ??
      (s.user.user_metadata?.full_name as string | undefined),
  };
}

function emit() {
  for (const l of listeners) l();
}

function initAuth() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  hydrationPromise = (async () => {
    try {
      const { data } = await supabase.auth.getSession();
      let session = data.session;
      // If the access token is expired or near-expiry, try a refresh so the
      // very first protected read after a cold mobile reload succeeds.
      if (session && isExpiringSoon(session)) {
        try {
          const { data: refreshed } = await supabase.auth.refreshSession();
          if (refreshed.session) session = refreshed.session;
        } catch {
          // Ignore — keep existing session; refresh may retry on focus.
        }
      }
      currentSession = session;
      return session;
    } catch {
      return null;
    } finally {
      initialSessionLoaded = true;
      emit();
    }
  })();

  supabase.auth.onAuthStateChange((event, session) => {
    // Only treat explicit sign-out as sign-out; ignore transient events so a
    // brief refresh hiccup does not log the user out.
    if (event === "SIGNED_OUT") {
      currentSession = null;
    } else if (session) {
      currentSession = session;
    }
    initialSessionLoaded = true;
    emit();
  });

  // Silently refresh when the user returns to the tab or regains network.
  const maybeRefresh = () => {
    if (!currentSession) return;
    if (!isExpiringSoon(currentSession, 5 * 60)) return;
    void supabase.auth.refreshSession().catch(() => {
      // Network / offline: keep the session; try again on next focus.
    });
  };
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") maybeRefresh();
  });
  window.addEventListener("focus", maybeRefresh);
  window.addEventListener("online", maybeRefresh);
}

function isExpiringSoon(session: Session, thresholdSec = 60): boolean {
  const exp = session.expires_at;
  if (!exp) return false;
  const nowSec = Math.floor(Date.now() / 1000);
  return exp - nowSec <= thresholdSec;
}

// Awaitable — resolves once the initial session has been loaded (and refreshed
// if needed). Safe to call from anywhere; returns the current session.
export async function waitForAuthReady(): Promise<Session | null> {
  if (typeof window === "undefined") return null;
  initAuth();
  if (hydrationPromise) {
    try {
      await hydrationPromise;
    } catch {
      /* ignore */
    }
  }
  return currentSession;
}

// Kick off on module load in the browser.
initAuth();

export function getSession(): MockUser | null {
  return userFromSession(currentSession);
}
export function getRawSession(): Session | null {
  return currentSession;
}

export async function refreshAuthSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  currentSession = data.session;
  initialSessionLoaded = true;
  emit();
  return data.session;
}

// No-ops kept for backwards compatibility with the old mock API.
export function saveSession(_user: MockUser) {
  void _user;
}
export function clearSession() {
  void supabase.auth.signOut();
}

// React hook — subscribes to Supabase auth state changes.
export function useAuthSession(): {
  user: MockUser | null;
  loading: boolean;
} {
  const snap = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      initAuth();
      return () => listeners.delete(cb);
    },
    () => currentSession,
    () => null,
  );
  return {
    user: userFromSession(snap),
    loading: typeof window !== "undefined" && !initialSessionLoaded,
  };
}

// ---------- error mapping ----------

function mapError(msg: string | undefined): string {
  const m = (msg ?? "").toLowerCase();
  if (m.includes("invalid login") || m.includes("invalid credentials")) return "invalidCredentials";
  if (m.includes("email not confirmed")) return "emailNotConfirmed";
  if (m.includes("already registered") || m.includes("user already")) return "emailTaken";
  if (m.includes("invalid email")) return "invalidEmail";
  if (m.includes("password")) return "passwordShort";
  return "generic";
}

function siteOrigin(): string {
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

// ---------- auth actions ----------

export const mockAuth = {
  async signIn(email: string, password: string): Promise<AuthResult> {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) return { error: mapError(error.message) };
    const u = userFromSession(data.session);
    if (!u) return { error: "generic" };
    return { user: u };
  },

  async signUp(name: string, email: string, password: string): Promise<AuthResult> {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
        emailRedirectTo: `${siteOrigin()}/auth/callback`,
      },
    });
    if (error) return { error: mapError(error.message) };
    // If email confirmation is ON, no session is returned.
    if (!data.session) {
      return {
        user: { id: data.user?.id ?? "", email, name },
        needsConfirmation: true,
      };
    }
    const u = userFromSession(data.session);
    return { user: u ?? { id: data.user?.id ?? "", email, name } };
  },

  async resetPassword(email: string): Promise<AuthResult> {
    if (!email) return { error: "invalidEmail" };
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${siteOrigin()}/reset-password`,
    });
    if (error) return { error: mapError(error.message) };
    return { user: { id: "", email } };
  },

  async signInWithGoogle(): Promise<{ error?: string; redirected?: boolean }> {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });

    if (error) return { error: mapError(error.message) };
    return { redirected: true };
  },

  async signOut(): Promise<void> {
    await supabase.auth.signOut();
  },
};
