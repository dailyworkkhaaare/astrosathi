import { ChevronRight, MessageCircle, Moon } from "lucide-react";
import type { ReactNode } from "react";
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
import { triggerHaptic } from "@/lib/native-device";
import { AstroArt } from "@/components/AstroArt";
import { grahaArtByName, type GrahaArt } from "@/lib/astro-art";

export function TodaySection() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const transitsQuery = useTodayTransits();
  const planetsQuery = usePlanets();

  const loading = transitsQuery.isPending || planetsQuery.isPending;
  const hasError = transitsQuery.isError || planetsQuery.isError;

  const realPlanets = planetsQuery.data?.planets ?? [];
  const ascSignIndex = findAscendantSignIndex(realPlanets);

  const moon = transitsQuery.data?.moon ?? null;
  const planets = transitsQuery.data?.planets ?? [];
  const isEmpty = !loading && !hasError && !moon && planets.length === 0;

  const moonHouse = moon && ascSignIndex != null ? houseFor(moon.signIndex, ascSignIndex) : null;

  const handleAskAboutToday = () => {
    if (!moon || moonHouse == null) return;
    void triggerHaptic("selection");
    const seed = t("sections.today.askSeed", {
      sign: t(`signs.${SIGN_KEYS_BY_INDEX[moon.signIndex]}`),
      nakshatra: NAKSHATRAS[moon.nakshatraIndex] ?? "",
      house: moonHouse,
    });
    void navigate({ to: "/chat", search: { seed } });
  };

  const moonSign = moon ? t(`signs.${SIGN_KEYS_BY_INDEX[moon.signIndex]}`) : "";
  const moonNakshatra = moon ? (NAKSHATRAS[moon.nakshatraIndex] ?? null) : null;

  return (
    <section aria-labelledby="today-heading">
      <h2
        id="today-heading"
        className="px-4 pb-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground [:lang(hi)_&]:tracking-normal [:lang(mr)_&]:tracking-normal"
      >
        {t("sections.today.title")}
      </h2>

      {loading && (
        <div
          className="space-y-3 rounded-[0.875rem] bg-card p-4 shadow-[var(--as-elevation-1)]"
          aria-busy="true"
          role="status"
        >
          <span className="sr-only">{t("states.loading")}</span>
          <div
            className="h-10 w-full motion-safe:animate-pulse rounded-lg bg-muted"
            aria-hidden="true"
          />
          <div
            className="h-10 w-full motion-safe:animate-pulse rounded-lg bg-muted"
            aria-hidden="true"
          />
        </div>
      )}

      {!loading && hasError && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[0.875rem] bg-card py-2 pl-4 pr-2 shadow-[var(--as-elevation-1)]">
          <p className="min-w-0 flex-1 text-sm text-foreground">{t("sections.today.loadError")}</p>
          <button
            type="button"
            onClick={() => {
              void transitsQuery.refetch();
              void planetsQuery.refetch();
            }}
            className="tap-press inline-flex min-h-11 shrink-0 items-center rounded-full px-3 text-sm font-semibold text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t("states.retry")}
          </button>
        </div>
      )}

      {isEmpty && (
        <div className="flex items-center gap-3 rounded-[0.875rem] border border-dashed border-border px-4 py-3">
          <Moon size={17} className="shrink-0 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm leading-relaxed text-muted-foreground">
            {t("sections.today.empty")}
          </p>
        </div>
      )}

      {!loading && !hasError && !isEmpty && (
        <ul className="list-hairline overflow-hidden rounded-[0.875rem] bg-card shadow-[var(--as-elevation-1)] [--list-inset:4.375rem]">
          {moon && (
            <SkyRow
              art="moon"
              name={t("home.planets.moon")}
              detail={[
                moonSign,
                moonNakshatra,
                moon.pada != null ? t("todayOverview.glance.pada", { n: moon.pada }) : null,
              ]
                .filter(Boolean)
                .join(" · ")}
              house={moonHouse}
              t={t}
            />
          )}
          {planets.map((p) => (
            <TodayPlanetRow key={p.planet} planet={p} ascSignIndex={ascSignIndex} t={t} />
          ))}
          {moonHouse != null && (
            <li>
              <button
                type="button"
                onClick={handleAskAboutToday}
                className="tap-press flex min-h-[3.125rem] w-full items-center justify-between gap-3 px-4 text-left text-[0.9375rem] font-semibold text-[var(--as-color-action-ask)] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              >
                <span className="inline-flex items-center gap-2">
                  <MessageCircle size={16} aria-hidden="true" />
                  {t("sections.today.askAboutToday")}
                </span>
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            </li>
          )}
        </ul>
      )}
    </section>
  );
}

function SkyRow({
  art,
  name,
  badge,
  detail,
  note,
  house,
  t,
}: {
  art: GrahaArt | null;
  name: string;
  badge?: ReactNode;
  detail: string;
  note?: string | null;
  house: number | null;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  return (
    <li className="flex min-h-[3.75rem] items-center gap-3.5 px-4 py-2.5">
      {art ? (
        <AstroArt kind="graha" name={art} size={40} />
      ) : (
        <span className="h-10 w-10 shrink-0" aria-hidden="true" />
      )}
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-[1.0625rem] text-foreground">
          {name}
          {badge}
        </p>
        <p className="text-[0.8125rem] text-muted-foreground">{detail}</p>
        {note ? <p className="text-xs text-accent">{note}</p> : null}
      </div>
      {house != null ? (
        <span className="shrink-0 text-[0.9375rem] text-muted-foreground">
          {t("home.houseLabel", { n: house })}
        </span>
      ) : null}
    </li>
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
    <SkyRow
      art={grahaArtByName(key)}
      name={t(`home.planets.${key}`)}
      badge={
        planet.retrograde ? (
          <span
            aria-label={t("home.motionRetro")}
            className="inline-flex items-center rounded-md bg-accent/15 px-1.5 py-0.5 text-xs font-medium text-accent"
          >
            {t("home.retroShort")}
          </span>
        ) : null
      }
      detail={t(`signs.${signKey}`)}
      note={
        enteringSoon
          ? t("sections.today.enteringSoon", {
              sign: t(`signs.${SIGN_KEYS_BY_INDEX[planet.nextSignIndex as number]}`),
            })
          : null
      }
      house={house}
      t={t}
    />
  );
}
