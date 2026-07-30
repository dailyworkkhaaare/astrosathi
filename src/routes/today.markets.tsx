import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useRequireOnboarding } from "@/lib/require-auth";
import { BarometerSection } from "@/components/BarometerSection";
import { MarketOutlookSection } from "@/components/MarketOutlookSection";

export const Route = createFileRoute("/today/markets")({
  head: () => ({
    meta: [
      { title: "Metals outlook — AstroSaathi" },
      {
        name: "description",
        content: "Vedic planetary outlook for gold & silver today.",
      },
    ],
  }),
  component: MarketsPage,
});

function MarketsPage() {
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
      <BarometerSection />
      <MarketOutlookSection />
    </section>
  );
}
