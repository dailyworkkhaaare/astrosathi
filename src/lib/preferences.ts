// Preferences store. Profile-backed fields (tone, answer_length,
// memory_enabled, timezone, display_name) sync to `profiles`. Theme is a
// browser-local preference kept in localStorage.

import { supabase } from "@/integrations/supabase/client";

export type Theme = "light" | "dark" | "system";
export type Tone = "calm" | "direct" | "supportive";
export type AnswerLength = "concise" | "balanced" | "detailed";

export type Preferences = {
  theme: Theme;
  tone: Tone;
  answer_length: AnswerLength;
  memory_opt_in: boolean; // maps to profiles.memory_enabled
  display_name: string;
  timezone: string;
};

const THEME_KEY = "astrosaathi.theme";

const DEFAULTS: Preferences = {
  theme: "dark",
  tone: "calm",
  answer_length: "balanced",
  memory_opt_in: false,
  display_name: "",
  timezone: "Asia/Kolkata",
};

let cache: Preferences = { ...DEFAULTS };

function readStoredTheme(): Theme {
  if (typeof window === "undefined") return DEFAULTS.theme;
  try {
    const raw = window.localStorage.getItem(THEME_KEY);
    if (raw === "light" || raw === "dark" || raw === "system") return raw;
  } catch {
    /* ignore */
  }
  return DEFAULTS.theme;
}

function writeStoredTheme(t: Theme) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(THEME_KEY, t);
  } catch {
    /* ignore */
  }
}

cache.theme = readStoredTheme();

export function getPreferences(): Preferences {
  return cache;
}

export async function loadPreferencesFromProfile(): Promise<Preferences> {
  cache.theme = readStoredTheme();
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return cache;
  const { data } = await supabase
    .from("profiles")
    .select("display_name, tone, answer_length, memory_enabled, timezone")
    .eq("user_id", userId)
    .maybeSingle();
  if (data) {
    cache = {
      ...cache,
      tone: (data.tone as Tone) ?? DEFAULTS.tone,
      answer_length: (data.answer_length as AnswerLength) ?? DEFAULTS.answer_length,
      memory_opt_in: !!data.memory_enabled,
      display_name: data.display_name ?? "",
      timezone: data.timezone ?? DEFAULTS.timezone,
    };
  }
  return cache;
}

export function updatePreferences(patch: Partial<Preferences>): Preferences {
  cache = { ...cache, ...patch };
  if (patch.theme) writeStoredTheme(patch.theme);

  // Fire-and-forget persistence for profile-backed fields.
  const profilePatch: Record<string, unknown> = {};
  if (patch.tone !== undefined) profilePatch.tone = patch.tone;
  if (patch.answer_length !== undefined) profilePatch.answer_length = patch.answer_length;
  if (patch.memory_opt_in !== undefined) profilePatch.memory_enabled = patch.memory_opt_in;
  if (patch.display_name !== undefined) profilePatch.display_name = patch.display_name;
  if (patch.timezone !== undefined) profilePatch.timezone = patch.timezone;
  if (Object.keys(profilePatch).length > 0) {
    void (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) return;
      await supabase.from("profiles").update(profilePatch).eq("user_id", userId);
    })();
  }

  return cache;
}

// Apply the visual theme to the document. `system` follows the OS.
export function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const prefersDark =
    typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  const wantDark = theme === "dark" || (theme === "system" && prefersDark);
  root.classList.toggle("dark", wantDark);
}

let mediaListenerBound = false;
// Keep `system` theme in sync with OS changes; safe to call more than once.
export function bindSystemThemeListener() {
  if (mediaListenerBound || typeof window === "undefined") return;
  const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
  if (!mq) return;
  mq.addEventListener?.("change", () => {
    if (getPreferences().theme === "system") applyTheme("system");
  });
  mediaListenerBound = true;
}

export const APP_VERSION = "0.2.0-mock";
