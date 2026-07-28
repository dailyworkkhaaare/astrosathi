import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { useRequireOnboarding } from "@/lib/require-auth";
import { DailyHoroscopeSection } from "@/components/DailyHoroscopeSection";
import { DailyMantraSection } from "@/components/DailyMantraSection";
import { PanchangSection } from "@/components/PanchangSection";
import { MarketOutlookSection } from "@/components/MarketOutlookSection";
import { TodaySection } from "@/components/TodaySection";
import { TransitHighlightBand } from "@/components/TransitHighlightBand";

export const Route = createFileRoute("/today")({
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

  const dateLabel = new Intl.DateTimeFormat(i18n.language, {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  return (
    <section className="space-y-6">
      <header className="motion-fade-up">
        <p className="text-sm text-muted-foreground">{dateLabel}</p>
        <h1 className="mt-1 font-display text-3xl md:text-4xl font-semibold tracking-tight text-foreground">
          {t("today.title")}
        </h1>
      </header>

      <div className="motion-fade-up motion-delay-1 space-y-6">
        <DailyMantraSection />
        <TransitHighlightBand />
      </div>
      <div className="motion-fade-up motion-delay-2">
        <TodaySection />
      </div>
      <div className="motion-fade-up motion-delay-3 space-y-6">
        <PanchangSection />
        <DailyHoroscopeSection />
      </div>
      <div className="motion-fade-up motion-delay-4">
        <MarketOutlookSection />
      </div>
    </section>
  );
}
