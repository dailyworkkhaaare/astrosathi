import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { useTranslation } from "react-i18next";

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
    <section className="space-y-6">
      <Link
        to="/today"
        className="tap-press inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft size={16} aria-hidden="true" />
        {t("today.backToToday")}
      </Link>
      <PanchangSection />
    </section>
  );
}
