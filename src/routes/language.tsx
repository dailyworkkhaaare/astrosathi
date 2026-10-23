import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";

import { OnboardingShell } from "@/components/OnboardingShell";
import { SUPPORTED_LANGUAGES, setLanguage, type SupportedLanguage } from "@/i18n";
import { triggerHaptic } from "@/lib/native-device";

export const Route = createFileRoute("/language")({
  head: () => ({
    meta: [
      { title: "Choose your language — AstroSaathi" },
      {
        name: "description",
        content: "Choose your preferred language for AstroSaathi — Marathi, Hindi, or English.",
      },
      { property: "og:title", content: "Choose your language — AstroSaathi" },
      {
        property: "og:description",
        content: "Marathi, Hindi, or English — pick what feels closest to home.",
      },
    ],
  }),
  component: LanguagePage,
});

const LANGUAGE_DETAILS: Record<
  SupportedLanguage,
  { native: string; latin: string; glyph: string; greeting: string; sample: string }
> = {
  mr: {
    native: "मराठी",
    latin: "Marathi",
    glyph: "म",
    greeting: "नमस्कार",
    sample: "तुमची कुंडली, तुमच्या भाषेत",
  },
  hi: {
    native: "हिन्दी",
    latin: "Hindi",
    glyph: "अ",
    greeting: "नमस्ते",
    sample: "आपकी कुंडली, आपकी भाषा में",
  },
  en: {
    native: "English",
    latin: "English",
    glyph: "A",
    greeting: "Hello",
    sample: "Your chart, in your language",
  },
};

function LanguagePage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const languagePrefix = i18n.language.split("-")[0] as SupportedLanguage;
  const current = SUPPORTED_LANGUAGES.includes(languagePrefix) ? languagePrefix : "mr";
  const detail = LANGUAGE_DETAILS[current];

  return (
    <main className="min-h-dvh w-full bg-background px-4 pt-[calc(var(--as-safe-top)+0.75rem)] text-foreground sm:px-6 md:pt-12">
      <OnboardingShell
        step={1}
        title={t("language.heroTitle")}
        subtitle={t("language.persistenceNote")}
        onBack={() => void navigate({ to: "/" })}
        footer={
          <Link
            to="/auth"
            onClick={() => void triggerHaptic("selection")}
            className="tap-press flex min-h-[3.375rem] w-full items-center justify-center rounded-full bg-primary px-6 text-[1.0625rem] font-semibold text-primary-foreground shadow-[var(--as-elevation-glow)] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {t("common.continue")}
          </Link>
        }
      >
        <h2 className="px-4 pb-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {t("language.title")}
        </h2>
        <ul className="space-y-2.5" role="radiogroup" aria-label={t("common.language")}>
          {SUPPORTED_LANGUAGES.map((language) => {
            const selected = current === language;
            const item = LANGUAGE_DETAILS[language];
            return (
              <li key={language}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={`${item.native} — ${item.latin}`}
                  onClick={() => {
                    void triggerHaptic("selection");
                    setLanguage(language);
                  }}
                  lang={language}
                  className={
                    "tap-press flex min-h-[4.5rem] w-full items-center gap-3.5 rounded-[1.25rem] border-[1.5px] px-4 py-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
                    (selected
                      ? "border-accent/60 bg-accent/10"
                      : "border-transparent bg-card hover:bg-card/80")
                  }
                >
                  <span
                    aria-hidden="true"
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-surface-raised font-display text-xl text-accent"
                  >
                    {item.glyph}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-lg font-semibold text-foreground">
                      {item.native}
                    </span>
                    {language !== "en" ? (
                      <span lang="en" className="block text-sm text-muted-foreground">
                        {item.latin}
                      </span>
                    ) : null}
                  </span>
                  <span
                    aria-hidden="true"
                    className={
                      "grid h-7 w-7 shrink-0 place-items-center rounded-full transition-colors " +
                      (selected ? "bg-accent text-accent-foreground" : "text-transparent")
                    }
                  >
                    <Check className="h-4 w-4" strokeWidth={3} />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <div
          aria-live="polite"
          lang={current}
          className="mt-5 rounded-[1.25rem] bg-surface-subtle px-4 py-4"
        >
          <p className="font-display text-xl font-semibold text-accent">{detail.greeting}</p>
          <p className="mt-1 text-[0.9375rem] text-muted-foreground">{detail.sample}</p>
        </div>
      </OnboardingShell>
    </main>
  );
}
