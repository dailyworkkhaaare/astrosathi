import { ChevronDown, MessageCircle, Moon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "@tanstack/react-router";

import { NAKSHATRAS, SIGN_KEYS_BY_INDEX } from "@/lib/charts";
import { usePlanets, useTodayTransits, type TodayPlanetTransit } from "@/lib/queries";
import {
  findAscendantSignIndex,
  houseFor,
  INGRESS_SOON_MS,
  PLANET_KEY_BY_CODE,
} from "@/lib/todayTransits";
import { Button } from "@/components/ui/button";

export function TodaySection() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const transitsQuery = useTodayTransits();
  const planetsQuery = usePlanets();
  const [slowPlanetsOpen, setSlowPlanetsOpen] = useState(false);

  const loading = transitsQuery.isPending || planetsQuery.isPending;
  const hasError = transitsQuery.isError || planetsQuery.isError;

  const realPlanets = planetsQuery.data?.planets ?? [];
  const ascSignIndex = findAscendantSignIndex(realPlanets);

  const today = new Date();
  const dateLabel = new Intl.DateTimeFormat(i18n.language, {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(today);

  const moon = transitsQuery.data?.moon ?? null;
  const planets = transitsQuery.data?.planets ?? [];
  const isEmpty = !loading && !hasError && !moon && planets.length === 0;

  const moonHouse = moon && ascSignIndex != null ? houseFor(moon.signIndex, ascSignIndex) : null;

  const handleAskAboutToday = () => {
    if (!moon || moonHouse == null) return;
    const seed = t("sections.today.askSeed", {
      sign: t(`signs.${SIGN_KEYS_BY_INDEX[moon.signIndex]}`),
      nakshatra: NAKSHATRAS[moon.nakshatraIndex] ?? "",
      house: moonHouse,
    });
    void navigate({ to: "/chat", search: { seed } });
  };

  return (
    <section
      aria-labelledby="today-heading"
      className="rounded-2xl border border-border bg-card p-5"
    >
      <header className="flex items-baseline justify-between gap-3">
        <h2 id="today-heading" className="font-display text-2xl font-semibold text-foreground">
          {t("sections.today.title")}
        </h2>
        <p className="text-sm text-muted-foreground">{dateLabel}</p>
      </header>

      {loading && (
        <div className="mt-4 space-y-3" aria-hidden="true">
          <div className="h-5 w-2/3 animate-pulse rounded bg-muted" />
          <div className="h-16 w-full animate-pulse rounded-xl bg-muted" />
        </div>
      )}

      {!loading && hasError && (
        <div className="mt-4 flex flex-col items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <p className="text-sm text-foreground">{t("sections.today.loadError")}</p>
          <button
            type="button"
            onClick={() => {
              void transitsQuery.refetch();
              void planetsQuery.refetch();
            }}
            className="inline-flex min-h-11 items-center rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t("states.retry")}
          </button>
        </div>
      )}

      {isEmpty && (
        <p className="mt-4 text-sm text-muted-foreground">{t("sections.today.empty")}</p>
      )}

      {!loading && !hasError && !isEmpty && (
        <div className="mt-4 space-y-4">
          {moon && (
            <div className="flex items-start gap-3 rounded-xl border border-border bg-background p-4">
              <Moon size={18} className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t("sections.today.moonNowLabel")}
                </p>
                <p className="mt-1 text-sm text-foreground">
                  {t("sections.today.moonNowLine", {
                    sign: t(`signs.${SIGN_KEYS_BY_INDEX[moon.signIndex]}`),
                    nakshatra: NAKSHATRAS[moon.nakshatraIndex] ?? "—",
                    pada: moon.pada ?? "—",
                  })}
                </p>
                {ascSignIndex != null && (
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {t("sections.today.transitingHouse", {
                      n: houseFor(moon.signIndex, ascSignIndex),
                    })}
                  </p>
                )}
              </div>
            </div>
          )}

          {planets.length > 0 && (
            <div>
              <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <button
                  type="button"
                  onClick={() => setSlowPlanetsOpen((open) => !open)}
                  aria-expanded={slowPlanetsOpen}
                  aria-controls="slow-planets-list"
                  className="-mx-1 flex min-h-11 w-full items-center justify-between gap-2 rounded-md px-1 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span>{t("sections.today.slowPlanetsTitle")}</span>
                  <ChevronDown
                    size={16}
                    aria-hidden="true"
                    className={
                      "shrink-0 text-muted-foreground transition-transform " +
                      (slowPlanetsOpen ? "rotate-180" : "")
                    }
                  />
                </button>
              </h3>
              {slowPlanetsOpen && (
                <ul id="slow-planets-list" className="mt-2 space-y-2">
                  {planets.map((p) => (
                    <TodayPlanetRow
                      key={p.planet}
                      planet={p}
                      ascSignIndex={ascSignIndex}
                      t={t}
                    />
                  ))}
                </ul>
              )}
            </div>
          )}

          {moonHouse != null && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleAskAboutToday}
              className="gap-1.5 px-3 text-muted-foreground hover:text-foreground"
            >
              <MessageCircle size={16} aria-hidden="true" />
              {t("sections.today.askAboutToday")}
            </Button>
          )}
        </div>
      )}
    </section>
  );
}

function TodayPlanetRow({
  planet,
  ascSignIndex,
  t,
}: {
  planet: TodayPlanetTransit;
  ascSignIndex: number | null;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const key = PLANET_KEY_BY_CODE[planet.planet];
  if (!key) return null;

  const signKey = SIGN_KEYS_BY_INDEX[planet.signIndex];
  const house = ascSignIndex != null ? houseFor(planet.signIndex, ascSignIndex) : null;

  const enteringSoon =
    planet.nextIngressTs != null &&
    planet.nextSignIndex != null &&
    (() => {
      const delta = new Date(planet.nextIngressTs).getTime() - Date.now();
      return delta >= 0 && delta <= INGRESS_SOON_MS;
    })();

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2.5">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-foreground">{t(`home.planets.${key}`)}</span>
        {planet.retrograde && (
          <span
            aria-label={t("home.motionRetro")}
            className="inline-flex items-center rounded-md border border-accent/40 bg-accent/15 px-1.5 py-0.5 text-xs font-medium text-accent"
          >
            {t("home.retroShort")}
          </span>
        )}
      </div>
      <div className="flex flex-col items-end text-right">
        <span className="text-sm text-foreground">
          {t(`signs.${signKey}`)}
          {house != null ? ` · ${t("home.houseLabel", { n: house })}` : ""}
        </span>
        {enteringSoon && (
          <span className="text-xs text-muted-foreground">
            {t("sections.today.enteringSoon", {
              sign: t(`signs.${SIGN_KEYS_BY_INDEX[planet.nextSignIndex as number]}`),
            })}
          </span>
        )}
      </div>
    </li>
  );
}
