import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Check, Languages, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";

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

const LANGUAGE_DETAILS: Record<
  SupportedLanguage,
  { native: string; latin: string; greeting: string; sample: string; numeral: string }
> = {
  mr: {
    native: "मराठी",
    latin: "Marathi",
    greeting: "नमस्कार",
    sample: "तुमची कुंडली, तुमच्या भाषेत",
    numeral: "०१",
  },
  hi: {
    native: "हिन्दी",
    latin: "Hindi",
    greeting: "नमस्ते",
    sample: "आपकी कुंडली, आपकी भाषा में",
    numeral: "०२",
  },
  en: {
    native: "English",
    latin: "English",
    greeting: "Hello",
    sample: "Your chart, in your language",
    numeral: "03",
  },
};

function LanguagePage() {
  const { t, i18n } = useTranslation();
  const languagePrefix = i18n.language.split("-")[0] as SupportedLanguage;
  const current = SUPPORTED_LANGUAGES.includes(languagePrefix) ? languagePrefix : "mr";

  return (
    <main className="min-h-dvh w-full bg-background p-3 text-foreground sm:p-5 lg:p-6">
      <div className="mx-auto grid min-h-[calc(100dvh-1.5rem)] w-full max-w-[88rem] overflow-hidden rounded-[2rem] border border-border/70 bg-card/75 shadow-[var(--shadow-elevated)] backdrop-blur sm:min-h-[calc(100dvh-2.5rem)] lg:grid-cols-[0.92fr_1.08fr]">
        <WelcomePanel t={t} current={current} />
        <SelectionPanel t={t} current={current} />
      </div>
    </main>
  );
}

function WelcomePanel({
  t,
  current,
}: {
  t: ReturnType<typeof useTranslation>["t"];
  current: SupportedLanguage;
}) {
  const detail = LANGUAGE_DETAILS[current];

  return (
    <section
      aria-label={t("language.welcomePanel")}
      className="relative isolate flex min-h-[21rem] flex-col overflow-hidden px-6 py-7 text-on-night sm:min-h-[25rem] sm:px-10 sm:py-9 lg:min-h-full lg:px-14 lg:py-12"
      style={{ background: "var(--gradient-night)" }}
    >
      <LanguageCosmos />
      <div className="relative flex items-center justify-between">
        <BrandMark withWordmark={false} className="h-8 w-8" />
        <span className="rounded-full border border-white/15 bg-white/[0.07] px-3 py-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-on-night-muted backdrop-blur-sm">
          {APP_NAME}
        </span>
      </div>

      <div className="relative my-auto max-w-xl py-10 lg:py-16">
        <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-accent">
          <Sparkles className="h-4 w-4" aria-hidden />
          {t("language.eyebrow")}
        </div>
        <h1 className="font-display-hero mt-5 max-w-[9ch] text-balance text-4xl font-semibold leading-[1.02] sm:text-5xl lg:text-6xl">
          {t("language.heroTitle")}
        </h1>
        <p className="mt-5 max-w-md text-sm leading-6 text-on-night-muted sm:text-base sm:leading-7">
          {t("language.heroBody")}
        </p>
      </div>

      <div className="relative flex items-end justify-between gap-5 border-t border-white/10 pt-5">
        <div>
          <p lang={current} className="font-display text-xl font-semibold text-accent sm:text-2xl">
            {detail.greeting}
          </p>
          <p lang={current} className="mt-1 text-xs text-on-night-subtle sm:text-sm">
            {detail.sample}
          </p>
        </div>
        <Languages className="hidden h-6 w-6 text-on-night-subtle sm:block" aria-hidden />
      </div>
    </section>
  );
}

function SelectionPanel({
  t,
  current,
}: {
  t: ReturnType<typeof useTranslation>["t"];
  current: SupportedLanguage;
}) {
  return (
    <section className="flex flex-col justify-center px-5 py-9 sm:px-10 sm:py-12 lg:px-[clamp(3rem,6vw,6rem)]">
      <div className="mx-auto w-full max-w-[35rem]">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">
          {t("language.stepLabel")}
        </p>
        <h2 className="font-display mt-3 text-balance text-3xl font-semibold leading-tight tracking-[-0.02em] text-foreground sm:text-5xl">
          {t("language.title")}
        </h2>
        <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground sm:text-base">
          {t("language.subtitle")}
        </p>

        <ul className="mt-8 space-y-3" role="radiogroup" aria-label={t("common.language")}>
          {SUPPORTED_LANGUAGES.map((language) => {
            const selected = current === language;
            const detail = LANGUAGE_DETAILS[language];

            return (
              <li key={language}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={`${detail.native} — ${detail.latin}`}
                  onClick={() => setLanguage(language)}
                  lang={language}
                  className={`tap-press group relative flex min-h-[5.25rem] w-full items-center gap-4 overflow-hidden rounded-2xl border px-4 text-left transition-[border-color,background-color,box-shadow] duration-[var(--motion-micro)] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:px-5 ${
                    selected
                      ? "border-primary/60 bg-primary/[0.07] shadow-[var(--shadow-soft)]"
                      : "border-border/80 bg-background/65 hover:border-primary/30 hover:bg-card"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`font-numeric grid h-11 w-11 shrink-0 place-items-center rounded-xl text-xs font-semibold ${
                      selected
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground group-hover:text-foreground"
                    }`}
                  >
                    {detail.numeral}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-lg font-semibold text-foreground">
                      {detail.native}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {detail.sample}
                    </span>
                  </span>
                  <span
                    aria-hidden="true"
                    className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border transition-colors ${
                      selected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background text-transparent"
                    }`}
                  >
                    <Check className="h-4 w-4" />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <div className="mt-7">
          <Button variant="primary" size="lg" asChild className="group min-h-12 w-full text-base">
            <Link to="/auth">
              {t("common.continue")}
              <ArrowRight
                className="transition-transform group-hover:translate-x-0.5"
                aria-hidden
              />
            </Link>
          </Button>
          <p className="mt-3 text-center text-xs leading-5 text-muted-foreground">
            {t("language.persistenceNote")}
          </p>
        </div>
      </div>
    </section>
  );
}

function LanguageCosmos() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="absolute -left-20 bottom-[-8rem] h-80 w-80 rounded-full bg-[oklch(0.69_0.16_75/0.13)] blur-3xl" />
      <div className="absolute -right-24 -top-20 h-72 w-72 rounded-full bg-[oklch(0.55_0.22_302/0.22)] blur-3xl" />
      <svg
        className="absolute right-[-5rem] top-[12%] h-[24rem] w-[24rem] opacity-50"
        viewBox="0 0 400 400"
      >
        <circle cx="200" cy="200" r="142" fill="none" stroke="white" strokeOpacity=".12" />
        <circle cx="200" cy="200" r="100" fill="none" stroke="white" strokeOpacity=".09" />
        <path
          d="M58 200h284M200 58v284M100 100l200 200M300 100L100 300"
          stroke="white"
          strokeOpacity=".07"
        />
        <circle cx="200" cy="58" r="4" fill="currentColor" className="text-accent" />
        <circle cx="330" cy="255" r="3" fill="white" fillOpacity=".8" />
        <circle cx="91" cy="284" r="2.5" fill="white" fillOpacity=".65" />
      </svg>
    </div>
  );
}
