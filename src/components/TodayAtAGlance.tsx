import { MessageCircle, Moon, Sparkles } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { SIGN_KEYS_BY_INDEX, NAKSHATRAS } from "@/lib/charts";
import { triggerHaptic } from "@/lib/native-device";
import { usePlanets, useTodayTransits } from "@/lib/queries";
import { findAscendantSignIndex, houseFor } from "@/lib/todayTransits";
import { Button } from "@/components/ui/button";

export function TodayAtAGlance() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const transitsQuery = useTodayTransits();
  const planetsQuery = usePlanets();

  const moon = transitsQuery.data?.moon ?? null;
  const ascSignIndex = findAscendantSignIndex(planetsQuery.data?.planets ?? []);
  const moonHouse = moon && ascSignIndex != null ? houseFor(moon.signIndex, ascSignIndex) : null;

  if (transitsQuery.isPending || planetsQuery.isPending) {
    return (
      <section
        aria-labelledby="today-glance-heading"
        aria-busy="true"
        role="status"
        className="rounded-2xl border border-border/80 bg-background/70 p-3.5 shadow-[var(--shadow-soft)] sm:p-4"
      >
        <div className="flex items-center justify-between gap-3">
          <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
            <Sparkles size={14} aria-hidden="true" />
            <span id="today-glance-heading">{t("todayOverview.glance.title")}</span>
          </p>
          <span
            aria-hidden="true"
            className="h-11 w-24 motion-safe:animate-pulse rounded-full bg-muted"
          />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2" aria-hidden="true">
          <div className="h-[4.75rem] motion-safe:animate-pulse rounded-xl bg-muted" />
          <div className="h-[4.75rem] motion-safe:animate-pulse rounded-xl bg-muted" />
        </div>
        <span className="sr-only">{t("states.loading")}</span>
      </section>
    );
  }

  if (transitsQuery.isError || planetsQuery.isError || !moon) {
    return null;
  }

  const askAboutToday = () => {
    void triggerHaptic("selection");
    void navigate({
      to: "/chat",
      search: { seed: t("todayOverview.askSeed") },
    });
  };

  return (
    <section
      aria-labelledby="today-glance-heading"
      className="rounded-2xl border border-border/80 bg-background/70 p-3.5 shadow-[var(--shadow-soft)] sm:p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
            <Sparkles size={14} aria-hidden="true" />
            <span id="today-glance-heading">{t("todayOverview.glance.title")}</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{t("todayOverview.glance.subtitle")}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={askAboutToday}
          className="min-h-11 shrink-0 gap-1.5 rounded-full px-3.5"
        >
          <MessageCircle size={15} aria-hidden="true" />
          {t("todayOverview.glance.ask")}
        </Button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="min-w-0 rounded-xl border border-border/70 bg-card px-3 py-2.5">
          <p className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            <Moon size={13} aria-hidden="true" />
            {t("todayOverview.glance.moon")}
          </p>
          <p className="mt-1 truncate text-sm font-semibold text-foreground">
            {t(`signs.${SIGN_KEYS_BY_INDEX[moon.signIndex]}`)}
          </p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {NAKSHATRAS[moon.nakshatraIndex] ?? "—"}
            {moon.pada != null ? ` · ${t("todayOverview.glance.pada", { n: moon.pada })}` : ""}
          </p>
        </div>

        <div className="min-w-0 rounded-xl border border-border/70 bg-card px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {t("todayOverview.glance.focus")}
          </p>
          <p className="mt-1 truncate text-sm font-semibold text-foreground">
            {moonHouse != null
              ? t("todayOverview.glance.house", { n: moonHouse })
              : t("todayOverview.glance.sky")}
          </p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {moonHouse != null
              ? t("todayOverview.glance.focusDetail")
              : t("todayOverview.glance.skyDetail")}
          </p>
        </div>
      </div>
    </section>
  );
}
