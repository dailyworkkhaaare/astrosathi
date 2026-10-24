import { createFileRoute } from "@tanstack/react-router";
import { RefreshCw } from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";

import { useRequireOnboarding } from "@/lib/require-auth";
import { DailySignalHero } from "@/components/DailySignalHero";
import { DailyMantraSection } from "@/components/DailyMantraSection";
import { PanchangSummaryCard } from "@/components/PanchangSummaryCard";
import { BarometerSummaryCard } from "@/components/BarometerSummaryCard";
import { TodaySection } from "@/components/TodaySection";
import { TodayAtAGlance } from "@/components/TodayAtAGlance";
import { TransitHighlightBand } from "@/components/TransitHighlightBand";
import { useTodayTransits } from "@/lib/queries";
import { triggerHaptic } from "@/lib/native-device";

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
  const queryClient = useQueryClient();
  const transitsQuery = useTodayTransits();
  const [refreshing, setRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const touchStartYRef = useRef<number | null>(null);
  const timezone = transitsQuery.data?.timezone;

  const dateLabel = new Intl.DateTimeFormat(i18n.language, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    ...(timezone ? { timeZone: timezone } : {}),
  }).format(new Date());

  const refreshToday = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await queryClient.invalidateQueries({
        predicate: (query) => {
          if (query.queryKey[0] !== "chart-gateway") return false;
          return ["today-transits", "daily-horoscope", "panchang", "barometer"].includes(
            String(query.queryKey[1] ?? ""),
          );
        },
      });
      void triggerHaptic("selection");
    } finally {
      setRefreshing(false);
    }
  };

  const handleTouchStart = (event: React.TouchEvent<HTMLElement>) => {
    if (refreshing || event.touches.length !== 1 || window.scrollY > 0) return;
    touchStartYRef.current = event.touches[0]?.clientY ?? null;
  };

  const handleTouchMove = (event: React.TouchEvent<HTMLElement>) => {
    if (touchStartYRef.current === null || refreshing) return;
    const currentY = event.touches[0]?.clientY;
    if (currentY === undefined) return;
    const distance = currentY - touchStartYRef.current;
    setPullDistance(distance > 0 ? Math.min(72, Math.round(distance * 0.6)) : 0);
  };

  const resetPullGesture = () => {
    touchStartYRef.current = null;
    setPullDistance(0);
  };

  const handleTouchEnd = () => {
    const shouldRefresh = pullDistance >= 52;
    resetPullGesture();
    if (shouldRefresh) void refreshToday();
  };

  return (
    <section
      className="space-y-8 overscroll-y-contain"
      aria-busy={refreshing}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={resetPullGesture}
    >
      <div
        aria-hidden={pullDistance === 0 && !refreshing}
        className="grid overflow-hidden text-xs font-medium text-muted-foreground transition-[height,opacity] duration-200"
        style={{
          height: refreshing ? 36 : pullDistance,
          opacity: pullDistance > 0 || refreshing ? 1 : 0,
        }}
      >
        <div className="flex items-center justify-center gap-2">
          <RefreshCw
            size={14}
            aria-hidden="true"
            className={refreshing ? "animate-spin" : pullDistance >= 52 ? "rotate-180" : ""}
          />
          {refreshing
            ? t("today.refreshing")
            : pullDistance >= 52
              ? t("today.releaseToRefresh")
              : t("today.pullToRefresh")}
        </div>
      </div>
      <p className="sr-only" role="status" aria-live="polite">
        {refreshing ? t("today.refreshing") : ""}
      </p>
      <header className="motion-fade-up flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[0.8125rem] font-semibold tracking-[0.04em] text-muted-foreground">
            {dateLabel}
          </p>
          <h1 className="large-title mt-0.5 text-foreground">{t("today.title")}</h1>
        </div>
        <button
          type="button"
          onClick={() => void refreshToday()}
          disabled={refreshing}
          aria-label={t("today.refresh")}
          aria-busy={refreshing}
          title={t("today.refresh")}
          className="tap-press -mr-2 grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait disabled:opacity-70"
        >
          <RefreshCw size={17} aria-hidden="true" className={refreshing ? "animate-spin" : ""} />
        </button>
      </header>

      <div className="motion-fade-up motion-delay-1 -mt-3">
        <DailySignalHero />
      </div>

      <div className="motion-fade-up motion-delay-2 space-y-4">
        <TodayAtAGlance />
        <p className="px-4 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground [:lang(hi)_&]:tracking-normal [:lang(mr)_&]:tracking-normal">
          {t("todayOverview.currentTiming")}
        </p>
        <TransitHighlightBand />
        <TodaySection />
      </div>

      <div className="motion-fade-up motion-delay-3 space-y-4">
        <p className="px-4 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground [:lang(hi)_&]:tracking-normal [:lang(mr)_&]:tracking-normal">
          {t("todayOverview.supporting")}
        </p>
        <div className="grid items-start gap-3 md:grid-cols-2">
          <PanchangSummaryCard />
          <DailyMantraSection />
        </div>
      </div>

      <div className="motion-fade-up motion-delay-4 space-y-2">
        <div>
          <p className="px-4 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground [:lang(hi)_&]:tracking-normal [:lang(mr)_&]:tracking-normal">
            {t("todayOverview.experimental")}
          </p>
          <p className="mt-0.5 px-4 text-xs text-muted-foreground">
            {t("todayOverview.experimentalNote")}
          </p>
        </div>
        <BarometerSummaryCard />
      </div>
    </section>
  );
}
