import { createFileRoute } from "@tanstack/react-router";
import { FlaskConical } from "lucide-react";
import { useTranslation } from "react-i18next";

import { TodayBackButton } from "@/components/TodayBackButton";
import { useRequireOnboarding } from "@/lib/require-auth";
import { BarometerSection } from "@/components/BarometerSection";
import { BradleySection } from "@/components/BradleySection";
import { SbcSection } from "@/components/SbcSection";
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
      <TodayBackButton label={t("today.backToToday")} />
      <header className="motion-fade-up px-1">
        <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-accent">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-accent/15">
            <FlaskConical size={15} aria-hidden="true" />
          </span>
          {t("sections.market.experimentalLabel")}
        </p>
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          {t("sections.market.pageTitle")}
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          {t("sections.market.disclaimer")}
        </p>
      </header>
      <BarometerSection />
      <BradleySection />
      <SbcSection />
      <MarketOutlookSection />
    </section>
  );
}
