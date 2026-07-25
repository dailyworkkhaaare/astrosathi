import { createFileRoute } from "@tanstack/react-router";
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Languages, Sparkles, Star } from "lucide-react";

import { APP_NAME } from "@/lib/brand";
import { useAuthSession } from "@/lib/auth";
import { getOnboardingState, routeForOnboardingState } from "@/lib/birth-profile";
import { Button } from "@/components/ui/button";
import { Starfield } from "@/components/Starfield";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AstroSaathi — Vedic Astrology Guidance in Your Language" },
      {
        name: "description",
        content:
          "Personalized Vedic astrology guidance in Marathi, Hindi, and English — kundli, daily insights, and one-to-one chat with an astrologer.",
      },
      { property: "og:title", content: "AstroSaathi — Vedic Astrology Guidance in Your Language" },
      {
        property: "og:description",
        content:
          "Personalized Vedic astrology guidance in Marathi, Hindi, and English — kundli, daily insights, and one-to-one chat with an astrologer.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, loading } = useAuthSession();
  useEffect(() => {
    if (loading || !user) return;
    let cancelled = false;
    void getOnboardingState().then((state) => {
      if (!cancelled) {
        navigate({ to: routeForOnboardingState(state), replace: true });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [loading, navigate, user]);

  const steps = [
    { icon: Languages, title: t("landing.step1Title"), body: t("landing.step1Body") },
    { icon: Star, title: t("landing.step2Title"), body: t("landing.step2Body") },
    { icon: Sparkles, title: t("landing.step3Title"), body: t("landing.step3Body") },
  ];
  return (
    <div className="space-y-12">
      <section
        className="motion-fade-up relative isolate overflow-hidden rounded-3xl px-6 py-16 text-center sm:px-10 sm:py-24"
        style={{ boxShadow: "var(--shadow-elevated)" }}
      >
        <Starfield density={90} />
        <div className="relative">
          <p className="motion-fade-up text-xs font-medium uppercase tracking-[0.28em] text-accent sm:text-sm">
            {APP_NAME}
          </p>
          <h1 className="motion-fade-up motion-delay-1 font-display mx-auto mt-5 max-w-2xl text-4xl font-semibold leading-[1.05] text-on-night sm:text-6xl">
            {t("landing.title")}
          </h1>
          <p className="motion-fade-up motion-delay-2 mx-auto mt-4 max-w-xl text-base text-on-night-muted sm:text-lg">
            {t("landing.subtitle")}
          </p>
          <p className="motion-fade-up motion-delay-3 mx-auto mt-2 max-w-xl text-sm text-on-night-subtle">
            {t("common.tagline")}
          </p>
          <div className="motion-fade-up motion-delay-4 mt-8 flex flex-col items-center gap-4">
            <Button
              variant="primary"
              size="lg"
              asChild
              className="min-h-[48px] w-full max-w-xs px-8 text-base sm:w-auto"
            >
              <Link to="/language">{t("landing.cta")}</Link>
            </Button>
            <div className="inline-flex flex-wrap items-center justify-center gap-2 rounded-full border border-accent/25 bg-accent/10 px-4 py-1.5 text-xs font-medium text-accent">
              <Sparkles size={14} aria-hidden="true" />
              <span>10,000+ Vedic Charts Analyzed</span>
              <span>·</span>
              <span>Marathi · Hindi · English</span>
            </div>
            <p className="text-sm text-on-night-subtle">
              {t("landing.signInPrompt")}{" "}
              <Link to="/auth" className="font-medium text-accent hover:underline">
                {t("landing.signIn")}
              </Link>
            </p>
          </div>
        </div>
      </section>

      <section aria-labelledby="how-title">
        <h2
          id="how-title"
          className="font-display text-center text-3xl font-semibold text-foreground sm:text-4xl"
        >
          {t("landing.howTitle")}
        </h2>
        <ol className="mt-8 grid gap-4 sm:grid-cols-3">
          {steps.map((step, i) => {
            const Icon = step.icon;
            return (
              <li key={i} className="rounded-2xl border border-border bg-card p-6 text-left">
                <div className="flex items-start justify-between">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Icon size={20} aria-hidden="true" />
                  </span>
                  <span className="text-sm font-medium text-muted-foreground">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </div>
                <h3 className="mt-4 text-lg font-semibold text-foreground">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
              </li>
            );
          })}
        </ol>
      </section>

      <section
        aria-label="Trust and safety"
        className="rounded-2xl border border-border bg-card p-5 text-center"
      >
        <p className="text-sm font-medium text-foreground">{t("landing.trustAge")}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t("landing.trustDisclaimer")}</p>
      </section>

      <footer className="mt-12 border-t border-border/60 pb-4 pt-8 text-center">
        <p className="text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} {APP_NAME}
          <span className="mx-2 text-border">·</span>
          <Link to="/terms" className="hover:text-foreground hover:underline">
            {t("common.terms")}
          </Link>
          <span className="mx-2 text-border">·</span>
          <Link to="/privacy" className="hover:text-foreground hover:underline">
            {t("common.privacy")}
          </Link>
        </p>
      </footer>
    </div>
  );
}
