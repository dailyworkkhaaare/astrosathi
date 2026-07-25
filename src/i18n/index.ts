import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "./locales/en.json";
import hi from "./locales/hi.json";
import mr from "./locales/mr.json";

export const SUPPORTED_LANGUAGES = ["mr", "hi", "en"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];
export const DEFAULT_LANGUAGE: SupportedLanguage = "mr";
export const LANG_STORAGE_KEY = "astrosaathi.lang";

if (!i18n.isInitialized) {
  // initImmediate: false forces synchronous init so the very first render
  // on the client already has translations available (matches SSR).
  void i18n.use(initReactI18next).init({
    resources: {
      en: { translation: en },
      hi: { translation: hi },
      mr: { translation: mr },
    },
    lng: DEFAULT_LANGUAGE,
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: SUPPORTED_LANGUAGES as unknown as string[],
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
    initImmediate: false,
  } as Parameters<typeof i18n.init>[0] & { initImmediate: boolean });
}

// Ensure the first client render always matches SSR (default language).
// The stored preference is re-applied after hydration by AppShell.
if (typeof window !== "undefined" && i18n.language !== DEFAULT_LANGUAGE) {
  void i18n.changeLanguage(DEFAULT_LANGUAGE);
}

export function readStoredLanguage(): SupportedLanguage | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(LANG_STORAGE_KEY);
    if (stored && (SUPPORTED_LANGUAGES as readonly string[]).includes(stored)) {
      return stored as SupportedLanguage;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function setLanguage(lang: SupportedLanguage) {
  void i18n.changeLanguage(lang);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(LANG_STORAGE_KEY, lang);
    } catch {
      /* ignore */
    }
    if (typeof document !== "undefined") {
      document.documentElement.lang = lang;
    }
    // Best-effort persist to profiles.locale as the full BCP-47 tag.
    void (async () => {
      try {
        const { supabase } = await import("@/integrations/supabase/client");
        const { data } = await supabase.auth.getUser();
        const userId = data.user?.id;
        if (!userId) return;
        const dbLocale = ({ mr: "mr-IN", hi: "hi-IN", en: "en-IN" } as const)[lang];
        await supabase.from("profiles").update({ locale: dbLocale }).eq("user_id", userId);
      } catch {
        /* ignore */
      }
    })();
  }
}

export default i18n;
