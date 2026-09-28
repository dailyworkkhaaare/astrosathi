import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { TodayBackButton } from "@/components/TodayBackButton";
import { useRequireOnboarding } from "@/lib/require-auth";
import { PanchangSection } from "@/components/PanchangSection";

export const Route = createFileRoute("/today/panchang")({
  head: () => ({
    meta: [
      { title: "Panchang — AstroSaathi" },
      {
        name: "description",
        content: "Today's full panchang — tithi, nakshatra, yoga, karana, and auspicious timings.",
      },
    ],
  }),
  component: PanchangPage,
});

function PanchangPage() {
  useRequireOnboarding();
  const { t } = useTranslation();

  return (
    <section className="space-y-5">
      <TodayBackButton label={t("today.backToToday")} />
      <PanchangSection />
    </section>
  );
}
