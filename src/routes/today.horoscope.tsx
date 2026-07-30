import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { useTranslation } from "react-i18next";

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
    <section className="space-y-6">
      <Link
        to="/today"
        className="tap-press inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft size={16} aria-hidden="true" />
        {t("today.backToToday")}
      </Link>
      <DailyHoroscopeSection />
    </section>
  );
}
