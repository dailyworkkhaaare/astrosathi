import { createClient } from "@supabase/supabase-js";

// Public (publishable) values — safe to ship to the browser. Sourced from
// env vars (.env, gitignored) rather than hardcoded.
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
export const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

// Stable storage key so SDK upgrades / preview-vs-published origins do not
// silently drop the persisted session on returning mobile visitors.
export const SUPABASE_AUTH_STORAGE_KEY = "astrosaathi-auth";

const browserStorage = typeof window !== "undefined" ? window.localStorage : undefined;

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: "pkce",
    storage: browserStorage,
    storageKey: SUPABASE_AUTH_STORAGE_KEY,
  },
});
