import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { TodayBackButton } from "@/components/TodayBackButton";
import { useRequireOnboarding } from "@/lib/require-auth";
import { DailyHoroscopeSection } from "@/components/DailyHoroscopeSection";

export const Route = createFileRoute("/today/horoscope")({
  head: () => ({
    meta: [
      { title: "Today's horoscope — AstroSaathi" },
      {
        name: "description",
        content: "A calm, personal reading from your chart and today's sky.",
      },
    ],
  }),
  component: HoroscopePage,
});

function HoroscopePage() {
  useRequireOnboarding();
  const { t } = useTranslation();

  return (
    <section className="space-y-5">
      <TodayBackButton label={t("today.backToToday")} />
      <DailyHoroscopeSection />
    </section>
  );
}
