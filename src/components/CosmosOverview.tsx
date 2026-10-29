import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  ArrowUp,
  BookOpen,
  ChevronRight,
  Compass,
  Flame,
  MessageCircle,
  ShieldAlert,
} from "lucide-react";

import { AstroArt } from "@/components/AstroArt";
import { DashaSection } from "@/components/DashaSection";
import { usePlanets } from "@/lib/queries";

export type CosmosOverviewTab = "charts" | "details" | "doshas" | "remedies" | "ashtakavarga";

type Gateway = {
  tab: CosmosOverviewTab;
  icon: typeof Compass;
  titleKey: string;
  descriptionKey: string;
};

const GATEWAYS: Gateway[] = [
  {
    tab: "charts",
    icon: Compass,
    titleKey: "home.overview.gateways.kundli.title",
    descriptionKey: "home.overview.gateways.kundli.description",
  },
  {
    tab: "doshas",
    icon: ShieldAlert,
    titleKey: "home.overview.gateways.patterns.title",
    descriptionKey: "home.overview.gateways.patterns.description",
  },
  {
    tab: "remedies",
    icon: Flame,
    titleKey: "home.overview.gateways.remedies.title",
    descriptionKey: "home.overview.gateways.remedies.description",
  },
  {
    tab: "ashtakavarga",
    icon: BookOpen,
    titleKey: "home.overview.gateways.strength.title",
    descriptionKey: "home.overview.gateways.strength.description",
  },
];

export function CosmosOverview({ onSelectTab }: { onSelectTab: (tab: CosmosOverviewTab) => void }) {
  const { t } = useTranslation();
  const planetsQuery = usePlanets();
  const planets = planetsQuery.data?.planets ?? [];
  const ascendant = planets.find((planet) => /ascend|lagna/i.test(planet.name)) ?? null;
  const sun = planets.find((planet) => planet.key === "sun") ?? null;
  const moon = planets.find((planet) => planet.key === "moon") ?? null;

  const rows = [
    {
      key: "ascendant",
      label: t("home.overview.placements.ascendant"),
      planet: ascendant,
    },
    {
      key: "moon",
      label: moon?.nakshatraName
        ? `${t("home.planets.moon")} · ${moon.nakshatraName}`
        : t("home.planets.moon"),
      planet: moon,
    },
    { key: "sun", label: t("home.planets.sun"), planet: sun },
  ];

  return (
    <div className="space-y-7">
      <section aria-labelledby="cosmos-overview-heading">
        <h2 id="cosmos-overview-heading" className={SECTION_LABEL}>
          {t("home.overview.title")}
        </h2>

        {planetsQuery.isPending ? (
          <div
            className="h-48 motion-safe:animate-pulse rounded-[0.875rem] bg-card"
            aria-busy="true"
          />
        ) : planetsQuery.isError || planetsQuery.data?.errorCode ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[0.875rem] bg-card py-2 pl-4 pr-2 shadow-[var(--as-elevation-1)]">
            <p className="min-w-0 flex-1 text-sm text-foreground">
              {t("home.chartErrors.provider_error")}
            </p>
            <button
              type="button"
              onClick={() => planetsQuery.refetch()}
              className="tap-press inline-flex min-h-11 items-center rounded-full px-3 text-sm font-semibold text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {t("states.retry")}
            </button>
          </div>
        ) : (
          <dl className="list-hairline overflow-hidden rounded-[0.875rem] bg-card shadow-[var(--as-elevation-1)] [--list-inset:4.5rem]">
            {rows.map(({ key, label, planet }) => {
              const sign = planet?.signKey ? t(`signs.${planet.signKey}`) : planet?.signName || "—";
              return (
                <div key={key} className="flex min-h-16 items-center gap-3.5 px-4 py-2">
                  {planet?.signKey ? (
                    <AstroArt kind="sign" name={planet.signKey} size={40} />
                  ) : (
                    <span
                      className="h-10 w-10 shrink-0 rounded-full bg-accent/12"
                      aria-hidden="true"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <dt className="text-xs text-muted-foreground">{label}</dt>
                    <dd className="text-[1.0625rem] font-semibold text-foreground">{sign}</dd>
                  </div>
                  <dd className="shrink-0 text-[0.9375rem] text-muted-foreground">
                    {planet?.house != null
                      ? t("home.houseLabel", { n: planet.house })
                      : t("home.noPlanetData")}
                  </dd>
                </div>
              );
            })}
          </dl>
        )}

        <button
          type="button"
          onClick={() => onSelectTab("charts")}
          className="tap-press mt-3 flex w-full items-center gap-4 rounded-[1.25rem] bg-card p-4 text-left shadow-[var(--as-elevation-1)] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <MiniKundli />
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-[1.0625rem] font-semibold text-foreground">
              {t("home.overview.openKundli")}
            </span>
            <span className="text-[0.8125rem] text-muted-foreground">
              {t("home.overview.gateways.kundli.description")}
            </span>
          </span>
          <ChevronRight size={18} className="shrink-0 text-muted-foreground" aria-hidden="true" />
        </button>
      </section>

      <section aria-labelledby="cosmos-timing-heading">
        <div className="flex items-center justify-between gap-3 pr-1">
          <h2 id="cosmos-timing-heading" className={SECTION_LABEL}>
            {t("home.overview.currentTiming")}
          </h2>
          <button
            type="button"
            onClick={() => onSelectTab("details")}
            className="tap-press -mt-2 inline-flex min-h-11 items-center gap-1 rounded-full px-3 text-sm font-semibold text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t("home.overview.viewDetails")}
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        </div>
        <DashaSection compact />
      </section>

      <section aria-labelledby="cosmos-gateways-heading">
        <h2 id="cosmos-gateways-heading" className={SECTION_LABEL}>
          {t("home.overview.gateways.title")}
        </h2>
        <ul className="list-hairline overflow-hidden rounded-[0.875rem] bg-card shadow-[var(--as-elevation-1)] [--list-inset:4rem]">
          {GATEWAYS.filter(({ tab }) => tab !== "charts").map(
            ({ tab, icon: Icon, titleKey, descriptionKey }) => (
              <li key={tab}>
                <button
                  type="button"
                  onClick={() => onSelectTab(tab)}
                  className="tap-press flex min-h-[3.75rem] w-full items-center gap-3.5 px-4 py-2.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[0.625rem] bg-accent/12 text-accent">
                    <Icon size={17} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[1.0625rem] text-foreground">{t(titleKey)}</span>
                    <span className="block text-[0.8125rem] text-muted-foreground">
                      {t(descriptionKey)}
                    </span>
                  </span>
                  <ChevronRight
                    size={16}
                    className="shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                </button>
              </li>
            ),
          )}
        </ul>
      </section>

      <section aria-labelledby="cosmos-ask-heading">
        <p className={SECTION_LABEL} aria-hidden="true">
          {t("home.overview.ask.label")}
        </p>
        <div className="flex flex-col gap-3.5 rounded-[1.25rem] bg-[color-mix(in_oklab,var(--as-color-action-ask)_10%,transparent)] p-4 shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--as-color-action-ask)_28%,transparent)]">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[color-mix(in_oklab,var(--as-color-action-ask)_22%,transparent)] text-[var(--as-color-action-ask)]">
              <MessageCircle size={19} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2
                id="cosmos-ask-heading"
                className="text-[1.0625rem] font-semibold text-foreground"
              >
                {t("home.overview.ask.title")}
              </h2>
              <p className="text-[0.8125rem] text-muted-foreground">
                {t("home.overview.ask.subtitle")}
              </p>
            </div>
          </div>
          <Link
            to="/chat"
            search={{ seed: t("home.overview.ask.sample") }}
            className="tap-press flex min-h-[3.25rem] items-center gap-3 rounded-[0.875rem] bg-foreground/[0.07] px-3.5 py-3 text-[0.9375rem] leading-snug text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="min-w-0 flex-1">{t("home.overview.ask.sample")}</span>
            <ArrowRight
              size={17}
              className="shrink-0 text-[var(--as-color-action-ask)]"
              aria-hidden="true"
            />
          </Link>
          <Link
            to="/chat"
            className="tap-press flex min-h-[3.25rem] items-center gap-2.5 rounded-full bg-background py-1.5 pl-[1.125rem] pr-1.5 text-[0.9375rem] text-muted-foreground shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--foreground)_12%,transparent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="min-w-0 flex-1">{t("home.overview.ask.placeholder")}</span>
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--as-color-action-ask)] text-white">
              <ArrowUp size={18} aria-hidden="true" />
            </span>
          </Link>
        </div>
      </section>
    </div>
  );
}

const SECTION_LABEL =
  "px-4 pb-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground [:lang(hi)_&]:tracking-normal [:lang(mr)_&]:tracking-normal";

/** A small North-Indian frame, the doorway into the full Kundli. */
function MiniKundli() {
  return (
    <svg
      viewBox="0 0 76 76"
      className="h-[4.75rem] w-[4.75rem] shrink-0 text-accent"
      fill="none"
      aria-hidden="true"
    >
      <g stroke="currentColor" strokeOpacity="0.8" strokeWidth="1.2">
        <rect x="1" y="1" width="74" height="74" rx="6" />
        <path d="M1 1 L75 75 M75 1 L1 75 M38 1 L75 38 L38 75 L1 38 Z" />
      </g>
    </svg>
  );
}
