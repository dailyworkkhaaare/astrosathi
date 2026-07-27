import { createFileRoute } from "@tanstack/react-router";
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Languages, MessageCircle, ShieldCheck, Sparkles } from "lucide-react";

import { APP_NAME } from "@/lib/brand";
import { useAuthSession } from "@/lib/auth";
import { getOnboardingState, routeForOnboardingState } from "@/lib/birth-profile";
import { Button } from "@/components/ui/button";
import { Starfield } from "@/components/Starfield";
import { LoadingState } from "@/components/states/LoadingState";

const STEP_ICONS = [Sparkles, MessageCircle, Languages] as const;

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

  if (loading || user) {
    return (
      <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center">
        <LoadingState />
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col">
      <section
        className="motion-fade-up relative isolate flex flex-1 items-center overflow-hidden rounded-3xl px-6 py-20 text-center sm:px-10 sm:py-28"
        style={{ boxShadow: "var(--shadow-elevated)" }}
      >
        <Starfield density={90} />
        <div className="relative mx-auto w-full">
          <p className="motion-fade-up text-xs font-medium uppercase tracking-[0.28em] text-accent sm:text-sm">
            {APP_NAME}
          </p>
          <h1 className="motion-fade-up motion-delay-1 font-display mx-auto mt-5 max-w-2xl text-4xl font-semibold leading-[1.05] text-on-night sm:text-6xl">
            {t("landing.title")}
          </h1>
          <p className="motion-fade-up motion-delay-2 mx-auto mt-4 max-w-xl text-base text-on-night-muted sm:text-lg">
            {t("landing.subtitle")}
          </p>
          <div className="motion-fade-up motion-delay-3 mt-10 flex flex-col items-center gap-4">
            <Button
              variant="primary"
              size="lg"
              asChild
              className="min-h-[48px] w-full max-w-xs px-8 text-base sm:w-auto"
            >
              <Link to="/language">{t("landing.cta")}</Link>
            </Button>
            <p className="text-sm text-on-night-subtle">
              {t("landing.signInPrompt")}{" "}
              <Link to="/auth" className="font-medium text-accent hover:underline">
                {t("landing.signIn")}
              </Link>
            </p>
          </div>
        </div>
      </section>

      <section
        aria-label={t("landing.stepsLabel")}
        className="mx-auto mt-10 grid w-full max-w-4xl grid-cols-1 gap-4 px-1 sm:grid-cols-3"
      >
        {[1, 2, 3].map((n, i) => {
          const Icon = STEP_ICONS[i];
          return (
            <div
              key={n}
              className={
                "motion-fade-up relative rounded-xl border border-border bg-card p-4 " +
                `motion-delay-${n}`
              }
            >
              <span
                aria-hidden="true"
                className="absolute right-3 top-3 text-xs font-medium text-muted-foreground"
              >
                {n}
              </span>
              <div
                aria-hidden="true"
                className="grid h-10 w-10 place-items-center rounded-full bg-accent/10 text-accent ring-1 ring-accent/30"
              >
                <Icon size={18} />
              </div>
              <h2 className="mt-3 text-base font-semibold text-foreground">
                {t(`landing.step${n}Title`)}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">{t(`landing.step${n}Body`)}</p>
            </div>
          );
        })}
      </section>

      <div className="mx-auto mt-6 flex w-full max-w-4xl flex-wrap items-center justify-center gap-x-5 gap-y-2 rounded-2xl border border-border bg-card/60 px-5 py-3 text-center text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <ShieldCheck size={14} className="text-accent" aria-hidden="true" />
          {t("landing.trustPrivate")}
        </span>
        <span className="hidden sm:inline text-border">·</span>
        <span>{t("landing.trustNoFear")}</span>
        <span className="hidden sm:inline text-border">·</span>
        <span>{t("landing.trustDisclaimer")}</span>
      </div>

      <footer className="mt-8 border-t border-border/60 pb-4 pt-6 text-center">
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
