import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { useRequireOnboarding } from "@/lib/require-auth";
import { DailySignalHero } from "@/components/DailySignalHero";
import { DailyMantraSection } from "@/components/DailyMantraSection";
import { PanchangSummaryCard } from "@/components/PanchangSummaryCard";
import { BarometerSummaryCard } from "@/components/BarometerSummaryCard";
import { TodaySection } from "@/components/TodaySection";
import { TransitHighlightBand } from "@/components/TransitHighlightBand";
import { useTodayTransits } from "@/lib/queries";

export const Route = createFileRoute("/today/")({
  head: () => ({
    meta: [
      { title: "Today — AstroSaathi" },
      {
        name: "description",
        content:
          "Today's sky at a glance — Moon and slow-planet transits, plus a Vedic planetary outlook for gold and silver.",
      },
      { property: "og:title", content: "Today — AstroSaathi" },
      {
        property: "og:description",
        content: "Today's transits and a Vedic metals outlook.",
      },
    ],
  }),
  component: TodayPage,
});

function TodayPage() {
  useRequireOnboarding();
  const { t, i18n } = useTranslation();
  const transitsQuery = useTodayTransits();
  const timezone = transitsQuery.data?.timezone;

  const dateLabel = new Intl.DateTimeFormat(i18n.language, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    ...(timezone ? { timeZone: timezone } : {}),
  }).format(new Date());

  return (
    <section className="space-y-8">
      <header className="motion-fade-up">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
          <span>{dateLabel}</span>
          {timezone ? (
            <>
              <span aria-hidden="true">·</span>
              <span>{timezone}</span>
            </>
          ) : null}
        </div>
        <h1 className="mt-1 font-display text-3xl md:text-4xl font-semibold tracking-tight text-foreground">
          {t("today.title")}
        </h1>
      </header>

      <div className="motion-fade-up motion-delay-1">
        <DailySignalHero />
      </div>

      <div className="motion-fade-up motion-delay-2 space-y-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {t("todayOverview.currentTiming")}
        </p>
        <TransitHighlightBand />
        <TodaySection />
      </div>

      <div className="motion-fade-up motion-delay-3 space-y-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {t("todayOverview.supporting")}
        </p>
        <div className="grid items-start gap-6 md:grid-cols-2">
          <PanchangSummaryCard />
          <DailyMantraSection />
        </div>
      </div>

      <div className="motion-fade-up motion-delay-4 space-y-4 border-t border-border/70 pt-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {t("todayOverview.experimental")}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("todayOverview.experimentalNote")}
          </p>
        </div>
        <BarometerSummaryCard />
      </div>
    </section>
  );
}
