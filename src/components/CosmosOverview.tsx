import { useTranslation } from "react-i18next";
import { BookOpen, ChevronRight, Compass, Flame, Orbit, ShieldAlert, Sparkles } from "lucide-react";

import { DashaSection } from "@/components/DashaSection";
import { usePlanets } from "@/lib/queries";
import { cn } from "@/lib/utils";

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
  const placements = [
    { label: t("home.overview.placements.ascendant"), planet: ascendant, accent: "text-accent" },
    { label: t("home.planets.sun"), planet: sun, accent: "text-primary" },
    { label: t("home.planets.moon"), planet: moon, accent: "text-primary" },
  ];

  return (
    <div className="space-y-6">
      <section
        aria-labelledby="cosmos-overview-heading"
        className="relative isolate overflow-hidden rounded-[1.75rem] border border-primary/20 bg-card px-5 py-6 shadow-[var(--shadow-elevated)] sm:px-7 sm:py-8"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-20 -z-10 h-52 w-52 rounded-full bg-[radial-gradient(circle,rgba(115,91,209,0.2),rgba(115,91,209,0)_68%)]"
        />
        <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-primary/10">
            <Orbit size={15} aria-hidden="true" />
          </span>
          {t("nav.myCosmos")}
        </p>
        <h2
          id="cosmos-overview-heading"
          className="mt-5 max-w-2xl font-display text-2xl leading-tight tracking-tight text-foreground sm:text-4xl"
        >
          {t("home.overview.title")}
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          {t("home.overview.subtitle")}
        </p>
        <button
          type="button"
          onClick={() => onSelectTab("charts")}
          className="tap-press mt-6 inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Compass size={16} aria-hidden="true" />
          {t("home.overview.openKundli")}
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </section>

      <section aria-labelledby="core-placements-heading">
        <div className="mb-3 flex items-end justify-between gap-4 px-1">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {t("home.overview.eyebrow")}
            </p>
            <h2
              id="core-placements-heading"
              className="mt-1 text-xl font-semibold tracking-tight text-foreground"
            >
              {t("home.overview.placements.title")}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => onSelectTab("charts")}
            className="tap-press inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t("home.overview.viewAll")}
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        </div>

        {planetsQuery.isPending ? (
          <div className="grid gap-3 sm:grid-cols-3" aria-busy="true">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="h-32 animate-pulse rounded-[1.35rem] border border-border bg-card"
              />
            ))}
          </div>
        ) : planetsQuery.isError || planetsQuery.data?.errorCode ? (
          <div className="rounded-[1.35rem] border border-destructive/30 bg-destructive/5 p-5">
            <p className="text-sm text-foreground">{t("home.chartErrors.provider_error")}</p>
            <button
              type="button"
              onClick={() => planetsQuery.refetch()}
              className="tap-press mt-3 inline-flex min-h-11 items-center rounded-full border border-border bg-background px-4 text-sm font-semibold text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {t("states.retry")}
            </button>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            {placements.map(({ label, planet, accent }) => (
              <article
                key={label}
                className="rounded-[1.35rem] border border-border bg-card p-4 shadow-[var(--shadow-soft)]"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    {label}
                  </p>
                  <Sparkles size={14} className={cn("shrink-0", accent)} aria-hidden="true" />
                </div>
                <p className="mt-4 text-lg font-semibold text-foreground">
                  {planet?.signKey ? t(`signs.${planet.signKey}`) : planet?.signName || "—"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {planet?.house != null
                    ? t("home.houseLabel", { n: planet.house })
                    : t("home.noPlanetData")}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="cosmos-timing-heading">
        <div className="mb-3 flex items-end justify-between gap-4 px-1">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {t("home.overview.eyebrow")}
            </p>
            <h2
              id="cosmos-timing-heading"
              className="mt-1 text-xl font-semibold tracking-tight text-foreground"
            >
              {t("home.overview.currentTiming")}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => onSelectTab("details")}
            className="tap-press inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t("home.overview.viewDetails")}
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        </div>
        <DashaSection />
      </section>

      <section aria-labelledby="cosmos-gateways-heading">
        <div className="px-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {t("home.overview.eyebrow")}
          </p>
          <h2
            id="cosmos-gateways-heading"
            className="mt-1 text-xl font-semibold tracking-tight text-foreground"
          >
            {t("home.overview.gateways.title")}
          </h2>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {GATEWAYS.map(({ tab, icon: Icon, titleKey, descriptionKey }) => (
            <button
              key={tab}
              type="button"
              onClick={() => onSelectTab(tab)}
              className="tap-press group flex min-h-28 items-start gap-3 rounded-[1.35rem] border border-border bg-card p-4 text-left shadow-[var(--shadow-soft)] transition-colors hover:border-primary/35 hover:bg-muted/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                <Icon size={17} aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-foreground">{t(titleKey)}</span>
                <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                  {t(descriptionKey)}
                </span>
              </span>
              <ChevronRight
                size={17}
                className="mt-0.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
