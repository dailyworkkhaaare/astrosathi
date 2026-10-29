import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { SIGN_KEYS_BY_INDEX, NAKSHATRAS } from "@/lib/charts";
import { triggerHaptic } from "@/lib/native-device";
import { usePlanets, useTodayTransits } from "@/lib/queries";
import { findAscendantSignIndex, houseFor } from "@/lib/todayTransits";

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
      <section aria-labelledby="today-glance-heading" aria-busy="true" role="status">
        <h2 id="today-glance-heading" className="sr-only">
          {t("todayOverview.glance.title")}
        </h2>
        <div className="grid grid-cols-2 gap-3" aria-hidden="true">
          <div className="h-[5.5rem] motion-safe:animate-pulse rounded-[1.25rem] bg-card" />
          <div className="h-[5.5rem] motion-safe:animate-pulse rounded-[1.25rem] bg-card" />
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

  const nakshatra = NAKSHATRAS[moon.nakshatraIndex] ?? null;
  const moonSign = t(`signs.${SIGN_KEYS_BY_INDEX[moon.signIndex]}`);
  const tiles = [
    {
      key: "moon",
      label: t("todayOverview.glance.moon"),
      value: nakshatra ?? moonSign,
      detail: [
        nakshatra ? moonSign : null,
        moon.pada != null ? t("todayOverview.glance.pada", { n: moon.pada }) : null,
      ]
        .filter(Boolean)
        .join(" · "),
    },
    {
      key: "focus",
      label: t("todayOverview.glance.focus"),
      value:
        moonHouse != null
          ? t("todayOverview.glance.house", { n: moonHouse })
          : t("todayOverview.glance.sky"),
      detail:
        moonHouse != null
          ? t("todayOverview.glance.focusDetail")
          : t("todayOverview.glance.skyDetail"),
    },
  ];

  return (
    <section aria-labelledby="today-glance-heading">
      <h2 id="today-glance-heading" className="sr-only">
        {t("todayOverview.glance.title")}
      </h2>
      <div className="grid grid-cols-2 gap-3">
        {tiles.map((tile) => (
          <button
            key={tile.key}
            type="button"
            onClick={askAboutToday}
            className="tap-press flex min-w-0 flex-col gap-1 rounded-[1.25rem] bg-card px-4 py-3.5 text-left shadow-[var(--as-elevation-1)] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground [:lang(hi)_&]:tracking-normal [:lang(mr)_&]:tracking-normal">
              {tile.label}
            </span>
            <span className="truncate font-display text-[1.375rem] font-semibold leading-tight text-foreground">
              {tile.value}
            </span>
            <span className="line-clamp-2 text-[0.8125rem] leading-snug text-muted-foreground">
              {tile.detail}
            </span>
            <span className="sr-only">{t("todayOverview.glance.ask")}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
