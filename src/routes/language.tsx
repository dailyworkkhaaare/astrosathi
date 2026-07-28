import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";

import { BrandMark } from "@/components/BrandMark";
import { Button } from "@/components/ui/button";
import { SUPPORTED_LANGUAGES, setLanguage, type SupportedLanguage } from "@/i18n";
import { APP_NAME } from "@/lib/brand";

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

const NATIVE_LABELS: Record<SupportedLanguage, string> = {
  mr: "मराठी",
  hi: "हिन्दी",
  en: "English",
};

const LATIN_LABELS: Record<SupportedLanguage, string> = {
  mr: "Marathi",
  hi: "Hindi",
  en: "English",
};

function LanguagePage() {
  const { t, i18n } = useTranslation();
  const current = (i18n.language as SupportedLanguage) ?? "mr";

  return (
    <div
      className="flex min-h-dvh w-full flex-col items-center bg-background px-6 pb-8 text-foreground md:justify-center"
      style={{ paddingTop: "calc(4rem + env(safe-area-inset-top))" }}
    >
      <div className="flex w-full max-w-[480px] flex-1 flex-col md:flex-initial md:gap-2">
        {/* Header */}
        <div className="flex flex-col items-center text-center">
          <BrandMark withWordmark={false} className="h-12 w-12" />
          <h1 className="mt-3 font-display text-3xl font-semibold text-foreground">{APP_NAME}</h1>
        </div>

        {/* Title & Subtitle */}
        <div className="mt-6 mb-10 text-center">
          <p className="font-display text-3xl md:text-4xl font-semibold text-foreground">
            {t("language.title")}
          </p>
          <p className="mt-2 text-lg text-muted-foreground">{t("language.subtitle")}</p>
        </div>

        {/* Language Options */}
        <ul className="space-y-4" role="radiogroup" aria-label={t("common.language")}>
          {SUPPORTED_LANGUAGES.map((lng) => {
            const selected = current === lng || current.startsWith(`${lng}-`);
            const showSubLabel = NATIVE_LABELS[lng] !== LATIN_LABELS[lng];

            return (
              <li key={lng}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setLanguage(lng)}
                  lang={lng}
                  className={`flex h-[72px] w-full items-center justify-between rounded-xl border px-6 text-left transition-colors duration-[var(--motion-micro)] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                    selected
                      ? "border-primary bg-primary/5"
                      : "border-border bg-card hover:border-muted-foreground/50"
                  }`}
                >
                  <span className="flex flex-col justify-center">
                    <span className="text-lg font-medium text-foreground">
                      {NATIVE_LABELS[lng]}
                    </span>
                    {showSubLabel && (
                      <span className="text-xs text-muted-foreground">{LATIN_LABELS[lng]}</span>
                    )}
                  </span>
                  {selected && (
                    <span
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-primary text-primary"
                      aria-hidden="true"
                    >
                      <Check className="h-4 w-4" />
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        {/* Flexible spacer for mobile bottom-pinning */}
        <div className="flex-1 md:hidden" />

        {/* Continue Button */}
        <div className="mt-8">
          <Button variant="primary" size="lg" asChild className="w-full">
            <Link to="/auth">{t("common.continue")}</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
