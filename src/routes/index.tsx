import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, type ComponentType } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowRight,
  CalendarDays,
  Check,
  Clock3,
  Languages,
  LockKeyhole,
  MessageCircle,
  Orbit,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { BrandMark } from "@/components/BrandMark";
import { LoadingState } from "@/components/states/LoadingState";
import { Button } from "@/components/ui/button";
import { useAuthSession } from "@/lib/auth";
import { APP_NAME } from "@/lib/brand";
import { getOnboardingState, routeForOnboardingState } from "@/lib/birth-profile";

const STEP_ICONS = [Sparkles, Orbit, MessageCircle] as const;

type Feature = {
  key: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  className: string;
};

const FEATURES: Feature[] = [
  {
    key: "chart",
    icon: Orbit,
    className: "md:col-span-2 md:row-span-2 bg-primary text-primary-foreground",
  },
  { key: "today", icon: CalendarDays, className: "bg-card text-card-foreground" },
  { key: "language", icon: Languages, className: "bg-accent/10 text-foreground" },
  { key: "timing", icon: Clock3, className: "md:col-span-2 bg-card text-card-foreground" },
];

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
      if (!cancelled) navigate({ to: routeForOnboardingState(state), replace: true });
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
    <div className="mx-auto flex w-full max-w-[90rem] flex-col gap-20 pb-2 sm:gap-28">
      <Hero t={t} />
      <Story t={t} />
      <FeatureBento t={t} />
      <TrustLayer t={t} />
      <footer className="border-t border-border/60 pb-3 pt-6 text-center">
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

function Hero({ t }: { t: ReturnType<typeof useTranslation>["t"] }) {
  return (
    <section
      aria-labelledby="landing-title"
      className="motion-fade-up relative isolate overflow-hidden rounded-[2rem] border border-white/10 px-5 py-8 shadow-[var(--shadow-elevated)] sm:px-9 sm:py-12 lg:px-14 lg:py-14"
      style={{ background: "var(--gradient-night)" }}
    >
      <CosmicDecor />
      <div className="relative grid items-center gap-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(30rem,1.1fr)] lg:gap-16">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.07] px-3 py-1.5 text-xs font-medium tracking-wide text-on-night-muted backdrop-blur-sm">
            <BrandMark withWordmark={false} className="h-5 w-5" />
            <span>{t("landing.eyebrow")}</span>
          </div>
          <h1
            id="landing-title"
            className="font-display-hero motion-fade-up motion-delay-1 mt-6 text-balance text-[clamp(2.65rem,6.5vw,5.8rem)] font-semibold leading-[0.95] tracking-[-0.045em] text-on-night"
          >
            {t("landing.title")}
          </h1>
          <p className="motion-fade-up motion-delay-2 mt-6 max-w-xl text-pretty text-base leading-7 text-on-night-muted sm:text-lg sm:leading-8">
            {t("landing.subtitle")}
          </p>
          <div className="motion-fade-up motion-delay-3 mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <Button
              variant="primary"
              size="lg"
              asChild
              className="group min-h-12 w-full justify-center px-7 text-base sm:w-auto"
            >
              <Link to="/language">
                {t("landing.cta")}
                <ArrowRight
                  className="transition-transform group-hover:translate-x-0.5"
                  aria-hidden
                />
              </Link>
            </Button>
            <p className="text-sm text-on-night-subtle">
              {t("landing.signInPrompt")}{" "}
              <Link
                to="/auth"
                className="font-semibold text-on-night underline decoration-white/30 underline-offset-4 hover:decoration-accent"
              >
                {t("landing.signIn")}
              </Link>
            </p>
          </div>
          <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-xs text-on-night-subtle">
            {["heroTrust1", "heroTrust2", "heroTrust3"].map((key) => (
              <span key={key} className="inline-flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-accent" aria-hidden />
                {t(`landing.${key}`)}
              </span>
            ))}
          </div>
        </div>
        <KundliChatPreview t={t} />
      </div>
    </section>
  );
}

function CosmicDecor() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="absolute -right-24 -top-28 h-80 w-80 rounded-full bg-[oklch(0.58_0.22_300/0.2)] blur-3xl" />
      <div className="absolute -bottom-40 left-[30%] h-80 w-80 rounded-full bg-[oklch(0.72_0.16_72/0.12)] blur-3xl" />
      <svg className="absolute inset-0 h-full w-full opacity-35" viewBox="0 0 1200 700">
        <path d="M760 58C985 92 1120 230 1188 448" fill="none" stroke="white" strokeOpacity=".16" />
        <path
          d="M820 22C1050 88 1162 224 1215 372"
          fill="none"
          stroke="white"
          strokeOpacity=".08"
        />
        {[
          [82, 90, 2],
          [175, 38, 1.5],
          [415, 110, 1.5],
          [675, 76, 1],
          [1110, 112, 2],
          [1042, 580, 1.5],
          [620, 625, 1],
          [330, 590, 2],
        ].map(([cx, cy, r]) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} fill="white" />
        ))}
      </svg>
    </div>
  );
}

function KundliChatPreview({ t }: { t: ReturnType<typeof useTranslation>["t"] }) {
  return (
    <div
      role="img"
      aria-label={t("landing.previewAria")}
      data-testid="kundli-chat-preview"
      className="motion-ceremonial relative mx-auto w-full max-w-[36rem] pb-12 sm:pb-16"
    >
      <div className="rotate-[-1.5deg] rounded-[1.75rem] border border-white/15 bg-white/[0.09] p-3 shadow-2xl backdrop-blur-xl sm:p-4">
        <div className="rounded-[1.35rem] border border-white/10 bg-[oklch(0.14_0.035_286/0.88)] p-4 sm:p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[0.66rem] font-semibold uppercase tracking-[0.19em] text-accent">
                {t("landing.previewLabel")}
              </p>
              <p className="mt-1 text-sm font-semibold text-on-night">
                {t("landing.previewTitle")}
              </p>
            </div>
            <span className="rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-[0.65rem] text-on-night-subtle">
              {t("landing.previewIllustrative")}
            </span>
          </div>
          <div className="mt-5 grid items-center gap-5 sm:grid-cols-[minmax(11rem,0.8fr)_1fr]">
            <KundliGlyph />
            <div className="space-y-2.5">
              {["Moon · Pisces", "Sun · Taurus", "Asc · Leo"].map((item, index) => (
                <div
                  key={item}
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.045] px-3 py-2.5 text-xs text-on-night-muted"
                >
                  <span>{item}</span>
                  <span className={index === 0 ? "text-accent" : "text-on-night-subtle"}>
                    {index === 0 ? "12°" : index === 1 ? "03°" : "18°"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="absolute bottom-0 right-0 w-[88%] rounded-2xl border border-white/20 bg-[oklch(0.97_0.018_83)] p-4 text-[oklch(0.18_0.035_286)] shadow-2xl sm:w-[78%] sm:p-5">
        <div className="flex gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
            <BrandMark withWordmark={false} className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-primary">{t("landing.previewAnswerLabel")}</p>
            <p className="mt-1 text-sm leading-6">{t("landing.previewAnswer")}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function KundliGlyph() {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[13rem]" aria-hidden="true">
      <div className="absolute inset-0 rounded-3xl bg-accent/10 blur-2xl" />
      <svg className="relative h-full w-full text-accent" viewBox="0 0 200 200">
        <rect
          x="18"
          y="18"
          width="164"
          height="164"
          rx="8"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          d="M18 18l164 164M182 18L18 182M100 18l82 82-82 82-82-82z"
          fill="none"
          stroke="currentColor"
          strokeOpacity=".75"
          strokeWidth="1.25"
        />
        <circle cx="100" cy="100" r="24" fill="currentColor" fillOpacity=".1" />
        <text x="100" y="96" textAnchor="middle" fill="currentColor" fontSize="9" fontWeight="600">
          MOON
        </text>
        <text x="100" y="109" textAnchor="middle" fill="white" fillOpacity=".78" fontSize="8">
          12°
        </text>
        <text x="100" y="42" textAnchor="middle" fill="white" fillOpacity=".62" fontSize="8">
          ASC
        </text>
        <text x="100" y="165" textAnchor="middle" fill="white" fillOpacity=".62" fontSize="8">
          SUN
        </text>
      </svg>
    </div>
  );
}

function Story({ t }: { t: ReturnType<typeof useTranslation>["t"] }) {
  return (
    <section aria-labelledby="story-title" className="px-1 sm:px-3">
      <SectionHeading
        eyebrow={t("landing.storyEyebrow")}
        title={t("landing.storyTitle")}
        body={t("landing.storyBody")}
        id="story-title"
      />
      <ol className="relative mt-10 grid gap-4 lg:grid-cols-3">
        <div
          className="pointer-events-none absolute left-[16%] right-[16%] top-7 hidden border-t border-dashed border-accent/35 lg:block"
          aria-hidden="true"
        />
        {[1, 2, 3].map((n, index) => {
          const Icon = STEP_ICONS[index];
          return (
            <li
              key={n}
              className="relative rounded-3xl border border-border/70 bg-card/75 p-5 shadow-[var(--shadow-soft)] backdrop-blur sm:p-6"
            >
              <div className="flex items-center justify-between">
                <span className="relative z-[1] grid h-14 w-14 place-items-center rounded-2xl border border-accent/20 bg-background text-accent shadow-sm">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <span className="font-display text-3xl text-primary/25">0{n}</span>
              </div>
              <h3 className="mt-7 text-lg font-semibold text-foreground">
                {t(`landing.step${n}Title`)}
              </h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {t(`landing.step${n}Body`)}
              </p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function FeatureBento({ t }: { t: ReturnType<typeof useTranslation>["t"] }) {
  return (
    <section aria-labelledby="features-title" className="px-1 sm:px-3">
      <SectionHeading
        eyebrow={t("landing.featuresEyebrow")}
        title={t("landing.featuresTitle")}
        body={t("landing.featuresBody")}
        id="features-title"
      />
      <div className="mt-10 grid auto-rows-[minmax(11rem,auto)] gap-4 md:grid-cols-4">
        {FEATURES.map(({ key, icon: Icon, className }) => (
          <article
            key={key}
            className={`group relative flex flex-col overflow-hidden rounded-[1.75rem] border border-border/60 p-6 shadow-[var(--shadow-soft)] ${className}`}
          >
            <div
              className="absolute -right-10 -top-10 h-32 w-32 rounded-full border border-current opacity-[0.08] transition-transform duration-500 group-hover:scale-110"
              aria-hidden="true"
            />
            <Icon className="h-6 w-6 opacity-80" aria-hidden />
            {key === "chart" && <ChartFeatureArt />}
            <div className={key === "chart" ? "relative mt-auto pt-32" : "relative mt-10 md:mt-14"}>
              <h3 className="font-display text-2xl font-semibold leading-tight">
                {t(`landing.feature${key}Title`)}
              </h3>
              <p className="mt-2 max-w-md text-sm leading-6 opacity-75">
                {t(`landing.feature${key}Body`)}
              </p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function ChartFeatureArt() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 320 190"
      className="absolute -right-8 top-3 h-52 w-80 text-white/80 opacity-60 transition-transform duration-500 group-hover:-translate-x-1 group-hover:translate-y-1"
    >
      <ellipse
        cx="171"
        cy="87"
        rx="117"
        ry="49"
        fill="none"
        stroke="currentColor"
        strokeOpacity=".22"
      />
      <ellipse
        cx="171"
        cy="87"
        rx="78"
        ry="78"
        fill="none"
        stroke="currentColor"
        strokeOpacity=".16"
        transform="rotate(-32 171 87)"
      />
      <ellipse
        cx="171"
        cy="87"
        rx="42"
        ry="103"
        fill="none"
        stroke="currentColor"
        strokeOpacity=".13"
        transform="rotate(58 171 87)"
      />
      <circle cx="171" cy="87" r="26" fill="currentColor" fillOpacity=".12" />
      <circle cx="171" cy="87" r="6" fill="currentColor" />
      <circle cx="62" cy="70" r="5" fill="currentColor" />
      <circle cx="229" cy="149" r="4" fill="currentColor" />
      <circle cx="245" cy="48" r="3" fill="currentColor" />
      <path d="M26 154h212" stroke="currentColor" strokeOpacity=".08" />
      <path d="M42 168h164" stroke="currentColor" strokeOpacity=".08" />
    </svg>
  );
}

function TrustLayer({ t }: { t: ReturnType<typeof useTranslation>["t"] }) {
  const items = [
    { key: "Private", icon: LockKeyhole },
    { key: "NoFear", icon: ShieldCheck },
    { key: "Disclaimer", icon: Sparkles },
  ] as const;
  return (
    <section
      aria-labelledby="trust-title"
      className="relative overflow-hidden rounded-[2rem] border border-border bg-card/70 px-5 py-10 shadow-[var(--shadow-soft)] sm:px-10 sm:py-12"
    >
      <div
        className="absolute right-0 top-0 h-48 w-48 rounded-full bg-accent/10 blur-3xl"
        aria-hidden="true"
      />
      <div className="relative grid gap-9 lg:grid-cols-[0.75fr_1.25fr] lg:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">
            {t("landing.trustEyebrow")}
          </p>
          <h2
            id="trust-title"
            className="font-display mt-3 text-balance text-3xl font-semibold leading-tight text-foreground sm:text-4xl"
          >
            {t("landing.trustTitle")}
          </h2>
          <p className="mt-3 max-w-lg text-sm leading-6 text-muted-foreground">
            {t("landing.trustBody")}
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {items.map(({ key, icon: Icon }) => (
            <div key={key} className="rounded-2xl border border-border/70 bg-background/70 p-4">
              <Icon className="h-5 w-5 text-accent" aria-hidden />
              <h3 className="mt-5 text-sm font-semibold text-foreground">
                {t(`landing.trust${key}`)}
              </h3>
              <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
                {t(`landing.trust${key}Body`)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function SectionHeading({
  eyebrow,
  title,
  body,
  id,
}: {
  eyebrow: string;
  title: string;
  body: string;
  id: string;
}) {
  return (
    <div className="max-w-2xl">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">{eyebrow}</p>
      <h2
        id={id}
        className="font-display mt-3 text-balance text-3xl font-semibold leading-tight tracking-[-0.02em] text-foreground sm:text-5xl"
      >
        {title}
      </h2>
      <p className="mt-4 text-pretty text-sm leading-6 text-muted-foreground sm:text-base sm:leading-7">
        {body}
      </p>
    </div>
  );
}
