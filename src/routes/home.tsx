import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  ChevronRight,
  Clock,
  Compass,
  Grid,
  Grid3x3,
  Hash,
  LayoutGrid,
  Orbit,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { useRequireOnboarding } from "@/lib/require-auth";
import { Button } from "@/components/ui/button";
import { ExpandableSection } from "@/components/ExpandableSection";
import { ChartFrame } from "@/components/chart/ChartFrame";

import { getBirthProfile, type BirthProfile } from "@/lib/birth-profile";
import {
  SIGN_LORD,
  VARGA_KEYS,
  type ChartStyle,
  type PlanetKey,
  type SignKey,
  type VargaKey,
} from "@/lib/chart-types";
import {
  buildVargaTable,
  SIGN_KEYS_BY_INDEX,
  type NormalizedPlanet,
  type VargaTable,
} from "@/lib/charts";
import { useChart, usePlanets } from "@/lib/queries";
import { NumerologySection } from "@/components/NumerologySection";
import { DoshasSection } from "@/components/DoshasSection";
import { AshtakavargaSection } from "@/components/AshtakavargaSection";
import { LoShuSection } from "@/components/LoShuSection";
import { DashaSection } from "@/components/DashaSection";

// Format a degree-within-sign (0..30) as Vedic degrees-minutes, e.g. 20.64 -> "20°38′".
function formatDeg(deg: number | null): string | null {
  if (deg == null || !Number.isFinite(deg)) return null;
  let d = Math.floor(deg);
  let m = Math.round((deg - d) * 60);
  if (m === 60) {
    d += 1;
    m = 0;
  }
  return `${d}°${String(m).padStart(2, "0")}′`;
}

// Hit-region polygons for the North-Indian chart overlay — a fixed geometric
// constant of the chart format (square + both diagonals + inner diamond),
// derived by intersecting those lines. Each region is tagged directly with
// its house number (1-12): the provider always draws the ascendant in the
// same top-centre box and numbers every other box sequentially from there,
// so a box's HOUSE is a fixed screen-position constant — verified by parsing
// two different charts with different ascendants (D1 and D12) and confirming
// every one of the 12 boxes lands on the identical house both times. (The
// bare numbers 1..12 *printed* in the boxes are rasi/sign numbers, which
// rotate with the ascendant — that printed digit is a red herring for this
// mapping.) Never derived from the provider SVG itself.
const NORTH_CHART_HOUSE_REGIONS: { house: number; points: string }[] = [
  { house: 1, points: "242,10 356.5,125.5 241,241 126,126" },
  { house: 2, points: "10,10 242,10 126,126" },
  { house: 3, points: "10,10 126,126 10,242" },
  { house: 4, points: "10,242 126,126 241,241 125.5,356.5" },
  { house: 5, points: "10,472 10,242 125.5,356.5" },
  { house: 6, points: "242,472 10,472 125.5,356.5" },
  { house: 7, points: "242,472 125.5,356.5 241,241 357,357" },
  { house: 8, points: "472,472 242,472 357,357" },
  { house: 9, points: "472,242 472,472 357,357" },
  { house: 10, points: "472,242 357,357 241,241 356.5,125.5" },
  { house: 11, points: "472,10 472,242 356.5,125.5" },
  { house: 12, points: "242,10 472,10 356.5,125.5" },
];

const TAB_KEYS = ["charts", "details", "doshas", "ashtakavarga", "numerology", "loshu"] as const;
type TabKey = (typeof TAB_KEYS)[number];

type HomeSearch = { tab?: TabKey };

export const Route = createFileRoute("/home")({
  validateSearch: (search: Record<string, unknown>): HomeSearch => {
    const raw = search.tab;
    const tab =
      typeof raw === "string" && (TAB_KEYS as readonly string[]).includes(raw)
        ? (raw as TabKey)
        : undefined;
    return { tab };
  },
  head: () => ({
    meta: [
      { title: "Your chart — AstroSaathi" },
      {
        name: "description",
        content:
          "View your Vedic Rashi chart, planetary placements and nakshatra from your birth details.",
      },
      { property: "og:title", content: "Your chart — AstroSaathi" },
      {
        property: "og:description",
        content: "Vedic Rashi chart with planets, houses and nakshatra.",
      },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  useRequireOnboarding();
  const { t } = useTranslation();
  const [profile, setProfile] = useState<BirthProfile | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  useEffect(() => {
    void getBirthProfile().then((p) => {
      setProfile(p);
      setProfileLoaded(true);
    });
  }, []);
  const name = profile?.name?.split(" ")[0] ?? "AstroSaathi";
  const navigate = useNavigate({ from: Route.fullPath });
  const { tab: tabParam } = Route.useSearch();
  const tab: TabKey = tabParam ?? "charts";
  const setTab = (k: TabKey) => void navigate({ search: { tab: k }, replace: true });
  const isProfileIncomplete = profileLoaded && (!profile || !profile.dob);

  return (
    <section className="space-y-6">
      <header>
        <p className="text-sm text-muted-foreground">{t("home.greeting", { name })}</p>
        <h1 className="mt-1 font-display text-3xl md:text-4xl font-semibold tracking-tight text-foreground">
          {t("home.title")}
        </h1>
      </header>

      {isProfileIncomplete && <IncompleteProfileHeroCard />}

      <Tabs current={tab} onChange={setTab} />

      <div key={tab} className="motion-fade-up">
        {tab === "charts" && <ChartsTab />}
        {tab === "details" && <DashaSection />}
        {tab === "doshas" && <DoshasSection />}
        {tab === "ashtakavarga" && <AshtakavargaSection />}
        {tab === "numerology" && <NumerologySection />}
        {tab === "loshu" && <LoShuSection />}
      </div>
    </section>
  );
}

function IncompleteProfileHeroCard() {
  const { t } = useTranslation();
  return (
    <div className="relative overflow-hidden rounded-2xl border border-accent/30 bg-accent/[0.05] p-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
            <Sparkles size={14} aria-hidden="true" />
            <span>{t("home.chartSetupBadge")}</span>
          </div>
          <h2 className="font-display text-2xl font-semibold text-foreground">
            {t("home.completeProfileTitle")}
          </h2>
          <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
            {t("home.completeProfileBody")}
          </p>
        </div>
        <Button variant="primary" size="lg" asChild className="shrink-0 min-h-[44px]">
          <Link to="/onboarding/birth" className="flex items-center gap-2">
            <span>{t("home.completeProfileCta")}</span>
            <ChevronRight size={16} aria-hidden="true" />
          </Link>
        </Button>
      </div>
    </div>
  );
}

const TAB_CONFIG: {
  key: TabKey;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}[] = [
  { key: "charts", icon: Compass },
  { key: "details", icon: Clock },
  { key: "doshas", icon: ShieldAlert },
  { key: "ashtakavarga", icon: Grid3x3 },
  { key: "numerology", icon: Hash },
  { key: "loshu", icon: Grid },
];

function Tabs({ current, onChange }: { current: TabKey; onChange: (k: TabKey) => void }) {
  const { t } = useTranslation();
  return (
    <div
      role="tablist"
      aria-label={t("home.title")}
      className="flex gap-2 overflow-x-auto pb-1.5 pt-0.5 scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
    >
      {TAB_CONFIG.map(({ key: k, icon: Icon }) => {
        const active = current === k;
        return (
          <button
            key={k}
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(k)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                e.preventDefault();
                const keys = TAB_CONFIG.map((c) => c.key);
                const i = keys.indexOf(current);
                const next =
                  e.key === "ArrowRight"
                    ? keys[(i + 1) % keys.length]
                    : keys[(i - 1 + keys.length) % keys.length];
                onChange(next);
              }
            }}
            className={
              "tap-press inline-flex items-center gap-2 rounded-full border px-4 min-h-[44px] whitespace-nowrap text-sm font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
              (active
                ? "border-primary/60 bg-primary/10 text-primary shadow-sm"
                : "border-border/80 bg-card/60 text-muted-foreground hover:bg-card hover:text-foreground")
            }
          >
            <Icon
              size={16}
              aria-hidden="true"
              className={active ? "text-primary" : "text-muted-foreground"}
            />
            <span>{t(`home.tabs.${k}`)}</span>
          </button>
        );
      })}
    </div>
  );
}

function ChartsTab() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [varga, setVarga] = useState<VargaKey>("D1");
  const [style] = useState<ChartStyle>("north");
  // Debounce the (varga, style) pair to avoid hammering the query cache when
  // the user quickly flips between options. The debounced values drive the
  // useChart hook so a new request only starts after the selection settles.
  const [debounced, setDebounced] = useState({ varga, style });
  useEffect(() => {
    const timer = setTimeout(() => setDebounced({ varga, style }), 400);
    return () => clearTimeout(timer);
  }, [varga, style]);

  const chartQuery = useChart(debounced.varga, debounced.style);
  const planetsQuery = usePlanets();

  // Stale-while-revalidate: only show the chart spinner when there is no cached
  // data yet (isPending). Background refetches (isFetching) keep the existing
  // chart on screen and swap it in silently once fresh data arrives.
  const loading = chartQuery.isPending;
  const svg = chartQuery.data?.svg ?? null;
  const errorCode = chartQuery.isError ? "provider_error" : (chartQuery.data?.errorCode ?? null);

  const planetsLoading = planetsQuery.isPending;
  const planetsErrorCode = planetsQuery.isError
    ? "provider_error"
    : (planetsQuery.data?.errorCode ?? null);

  const onRetry = () => chartQuery.refetch();
  const onRetryPlanets = () => planetsQuery.refetch();

  const errorMessageKey = errorCode
    ? ["not_authenticated", "birth_profile_incomplete", "place_not_resolved"].includes(errorCode)
      ? `home.chartErrors.${errorCode}`
      : "home.chartErrors.provider_error"
    : null;

  const planetsErrorKey = planetsErrorCode
    ? ["not_authenticated", "birth_profile_incomplete", "place_not_resolved"].includes(
        planetsErrorCode,
      )
      ? `home.chartErrors.${planetsErrorCode}`
      : "home.chartErrors.provider_error"
    : null;

  const realPlanets: NormalizedPlanet[] | null = planetsQuery.data?.planets ?? null;

  // Prokerala returns divisional charts (D2..D60) only as a North-Indian SVG
  // with no structured data, so we parse that SVG (see buildVargaTable) to read
  // each planet's sign and house straight from the same source as the picture —
  // guaranteeing the tables match the chart. It is enriched with D1-derived
  // retrograde/vargottama and sign-based dignity. D1 keeps the full Prokerala
  // planet data (nakshatra, degrees, states).
  const isDivisional = debounced.varga !== "D1";
  const vargaTable: VargaTable | null =
    isDivisional && svg && realPlanets ? buildVargaTable(svg, realPlanets) : null;

  const displayPlanets: DisplayPlanet[] = isDivisional
    ? (vargaTable?.rows ?? []).map((r) => {
        const lordKey = SIGN_LORD[r.signKey] ?? null;
        return {
          key: r.key,
          signKey: r.signKey,
          signName: r.signKey,
          signLordKey: lordKey,
          signLordName: lordKey ?? "",
          house: r.house,
          nakshatraName: "",
          nakshatraLordKey: null,
          nakshatraLordName: "",
          retrograde: r.retrograde,
          degInSign: null,
          states: r.states,
        };
      })
    : (realPlanets ?? [])
        .filter((p) => p.key !== null)
        .map((p) => ({
          key: p.key as PlanetKey,
          signKey: p.signKey,
          signName: p.signName,
          signLordKey: p.signLordKey,
          signLordName: p.signLordName,
          house: p.house,
          nakshatraName: p.nakshatraName,
          nakshatraLordKey: p.nakshatraLordKey,
          nakshatraLordName: p.nakshatraLordName,
          retrograde: p.retrograde,
          degInSign: p.degInSign,
          states: p.states,
        }));

  const displayHouses: DisplayHouse[] = isDivisional
    ? vargaTable
      ? buildHousesFromVargaTable(vargaTable)
      : []
    : realPlanets
      ? buildHousesFromPlanets(realPlanets)
      : [];

  // Handles a click on the chart overlay's fixed house region (see
  // NORTH_CHART_HOUSE_REGIONS above for why the box position is a fixed
  // house number, not the rotating rasi digit printed inside it).
  const handleChartHouseClick = (houseNumber: number) => {
    const h = displayHouses.find((house) => house.house === houseNumber);
    if (!h) return;
    void navigate({ to: "/chat", search: { seed: buildHouseSeed(t, debounced.varga, h) } });
  };

  // Divisional tables are parsed from the chart SVG, so they also depend on the
  // chart query; D1 tables only need the planets query.
  const tablesLoading = planetsLoading || (isDivisional && loading);
  const tablesErrorKey = planetsErrorKey ?? (isDivisional ? errorMessageKey : null);
  const tablesErrorCode = planetsErrorCode ?? (isDivisional ? errorCode : null);
  const onRetryTables = () => {
    onRetryPlanets();
    if (isDivisional) onRetry();
  };

  const moon = realPlanets?.find((p) => p.key === "moon") ?? null;
  const nakName = moon?.nakshatraName ?? "";
  const nakLordKey = moon?.nakshatraLordKey ?? null;
  const nakLordName = moon?.nakshatraLordName ?? "";
  const nakPada = moon?.nakshatraPada ?? null;

  return (
    <div className="space-y-6">
      <Card>
        <div className="mb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/15">
              <Compass size={15} className="text-accent" aria-hidden="true" />
            </span>
            <h2 className="text-base font-semibold text-foreground">{t("home.chartTitle")}</h2>
          </div>
          <div className="w-full min-w-0 sm:w-auto">
            <label htmlFor="varga-select" className="sr-only">
              {t("home.varga.pickerLabel")}
            </label>
            <select
              id="varga-select"
              value={varga}
              onChange={(e) => setVarga(e.target.value as VargaKey)}
              className="h-11 w-full max-w-full truncate rounded-lg border border-border bg-background px-3 text-sm sm:w-auto"
            >
              {VARGA_KEYS.map((k) => (
                <option key={k} value={k}>
                  {t(`home.varga.${k.toLowerCase()}`)}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div
          role="region"
          aria-live="polite"
          aria-label={t(`home.varga.${varga.toLowerCase()}`)}
          className="relative w-full"
        >
          {loading && <ChartSkeleton />}
          {!loading && errorMessageKey && (
            <div className="flex flex-col items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
              <p className="text-sm text-foreground">{t(errorMessageKey)}</p>
              <div className="flex flex-wrap items-center gap-2">
                {errorCode === "birth_profile_incomplete" && (
                  <Link
                    to="/onboarding/birth"
                    className="inline-flex items-center rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    {t("home.chartErrors.finishBirth")}
                  </Link>
                )}
                <button
                  type="button"
                  onClick={onRetry}
                  className="inline-flex items-center rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
                >
                  {t("states.retry")}
                </button>
              </div>
            </div>
          )}
          {!loading && !errorMessageKey && svg && (
            <ChartFrame>
              <div
                className="[&_svg]:block [&_svg]:h-auto [&_svg]:w-full [&_svg]:max-w-full [&_svg_line]:stroke-primary [&_svg_path]:stroke-primary [&_svg_rect]:stroke-primary [&_svg_polygon]:stroke-primary [&_svg_text]:fill-foreground"
                dangerouslySetInnerHTML={{ __html: svg }}
              />
              {style === "north" && (
                <svg
                  viewBox="0 0 480 480"
                  preserveAspectRatio="none"
                  className="pointer-events-none absolute inset-0"
                  aria-hidden="true"
                >
                  {NORTH_CHART_HOUSE_REGIONS.map((r) => (
                    <polygon
                      key={r.house}
                      points={r.points}
                      className="pointer-events-auto cursor-pointer fill-transparent transition-colors hover:fill-accent/10"
                      onClick={() => handleChartHouseClick(r.house)}
                    />
                  ))}
                </svg>
              )}
            </ChartFrame>
          )}
        </div>
      </Card>

      <ExpandableSection
        title={
          t("home.planetsTitle") +
          (isDivisional ? ` · ${t(`home.varga.${debounced.varga.toLowerCase()}`)}` : "")
        }
        icon={Orbit}
        badge={!tablesLoading && !tablesErrorKey ? displayPlanets.length : undefined}
      >
        {tablesLoading && <PlanetsTableSkeleton />}
        {!tablesLoading && tablesErrorKey && (
          <ErrorInline messageKey={tablesErrorKey} code={tablesErrorCode} onRetry={onRetryTables} />
        )}
        {!tablesLoading && !tablesErrorKey && displayPlanets.length === 0 && (
          <p className="text-sm text-muted-foreground">{t("home.noPlanetData")}</p>
        )}
        {!tablesLoading && !tablesErrorKey && displayPlanets.length > 0 && (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {displayPlanets.map((p) => {
              const statesExcludeRetro = p.states.filter((s) => s !== "Retrograde");
              return (
                <li
                  key={p.key}
                  className="rounded-xl border border-border bg-background p-4 transition-colors hover:border-accent/30"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">
                        {t(`home.planets.${p.key}`)}
                      </span>
                      {p.degInSign != null && (
                        <span className="text-xs text-muted-foreground">
                          {formatDeg(p.degInSign)}
                        </span>
                      )}
                      {p.retrograde && (
                        <span
                          aria-label={t("home.motionRetro")}
                          className="inline-flex items-center rounded-md border border-accent/40 bg-accent/15 px-1.5 py-0.5 text-xs font-medium text-accent"
                        >
                          {t("home.retroShort")}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {p.house != null ? t("home.houseLabel", { n: p.house }) : "—"}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <div>
                      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        {t("home.colSign")}
                      </div>
                      <div className="text-foreground">
                        {p.signKey ? t(`signs.${p.signKey}`) : p.signName || "—"}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        {t("home.colSignLord")}
                      </div>
                      <div className="text-foreground">
                        {p.signLordKey ? t(`home.planets.${p.signLordKey}`) : p.signLordName || "—"}
                      </div>
                    </div>
                    {!isDivisional && (
                      <>
                        <div>
                          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            {t("home.colNakshatra")}
                          </div>
                          <div className="text-foreground">{p.nakshatraName || "—"}</div>
                        </div>
                        <div>
                          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            {t("home.colNakshatraLord")}
                          </div>
                          <div className="text-foreground">
                            {p.nakshatraLordKey
                              ? t(`home.planets.${p.nakshatraLordKey}`)
                              : p.nakshatraLordName || "—"}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                  {statesExcludeRetro.length > 0 && (
                    <div className="mt-3">
                      <div className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                        {t("home.colStates")}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {statesExcludeRetro.map((s) => (
                          <span
                            key={s}
                            className="inline-flex items-center rounded-md border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-foreground"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </ExpandableSection>

      <ExpandableSection
        title={
          t("home.housesTitle") +
          (isDivisional ? ` · ${t(`home.varga.${debounced.varga.toLowerCase()}`)}` : "")
        }
        icon={LayoutGrid}
        badge={!tablesLoading && !tablesErrorKey ? displayHouses.length : undefined}
      >
        <p className="-mt-1 mb-3 text-xs text-muted-foreground">{t("home.housesSubtitle")}</p>
        {tablesLoading && <HousesGridSkeleton />}
        {!tablesLoading && tablesErrorKey && (
          <ErrorInline messageKey={tablesErrorKey} code={tablesErrorCode} onRetry={onRetryTables} />
        )}
        {!tablesLoading && !tablesErrorKey && displayHouses.length === 0 && (
          <p className="text-sm text-muted-foreground">{t("home.noPlanetData")}</p>
        )}
        {!tablesLoading && !tablesErrorKey && displayHouses.length > 0 && (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {displayHouses.map((h) => (
              <li key={h.house}>
                <Link
                  to="/chat"
                  search={{ seed: buildHouseSeed(t, debounced.varga, h) }}
                  className="tap-press block h-full rounded-lg border border-border bg-background px-3 py-3 text-sm transition-colors hover:border-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="text-xs text-muted-foreground">
                    {t("home.houseLabel", { n: h.house })}
                  </div>
                  <div className="font-medium text-foreground">
                    {h.signKey ? t(`signs.${h.signKey}`) : h.signName || "—"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {t("home.colLord")}:{" "}
                    {h.lordKey ? t(`home.planets.${h.lordKey}`) : h.lordName || "—"}
                  </div>
                  {h.planetKeys.length > 0 && (
                    <div className="mt-1 text-xs text-primary">
                      {h.planetKeys.map((pk) => t(`home.planets.${pk}`)).join(", ")}
                    </div>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </ExpandableSection>

      <Card>
        <div className="flex flex-col items-center text-center">
          <h2 className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            {t("home.nakshatraTitle")}
          </h2>
          {planetsLoading && <NakshatraSkeleton />}
          {!planetsLoading && planetsErrorKey && (
            <ErrorInline
              messageKey={planetsErrorKey}
              code={planetsErrorCode}
              onRetry={onRetryPlanets}
            />
          )}
          {!planetsLoading && !planetsErrorKey && !nakName && (
            <p className="mt-2 text-sm text-muted-foreground">{t("home.noPlanetData")}</p>
          )}
          {!planetsLoading && !planetsErrorKey && nakName && (
            <>
              <p className="mt-2 font-display text-2xl text-foreground">{nakName}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {(nakLordKey || nakLordName) && (
                  <>
                    {t("home.nakshatraLordLabel")}:{" "}
                    {nakLordKey ? t(`home.planets.${nakLordKey}`) : nakLordName}
                    {nakPada != null ? " · " : null}
                  </>
                )}
                {nakPada != null && (
                  <>
                    {t("home.padaLabel")} {nakPada}
                  </>
                )}
              </p>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}

type DisplayPlanet = {
  key: PlanetKey;
  signKey: SignKey | null;
  signName: string;
  signLordKey: PlanetKey | null;
  signLordName: string;
  house: number | null;
  nakshatraName: string;
  nakshatraLordKey: PlanetKey | null;
  nakshatraLordName: string;
  retrograde: boolean;
  degInSign: number | null;
  states: string[];
};

type DisplayHouse = {
  house: number;
  signKey: SignKey | null;
  signName: string;
  lordKey: PlanetKey | null;
  lordName: string;
  planetKeys: PlanetKey[];
};

// Builds the "ask about this house" chat seed — same house/sign/lord/planet
// data already shown on the card, just phrased as a question. Reuses the
// existing /chat?seed= bridge (see chat.tsx) unmodified.
function buildHouseSeed(
  t: (key: string, opts?: Record<string, unknown>) => string,
  varga: VargaKey,
  h: DisplayHouse,
): string {
  const vargaLabel = t(`home.varga.${varga.toLowerCase()}`);
  const sign = h.signKey ? t(`signs.${h.signKey}`) : h.signName || "—";
  const lord = h.lordKey ? t(`home.planets.${h.lordKey}`) : h.lordName || "—";
  if (h.planetKeys.length > 0) {
    return t("home.houseAskSeedWithPlanets", {
      house: h.house,
      varga: vargaLabel,
      sign,
      lord,
      planets: h.planetKeys.map((pk) => t(`home.planets.${pk}`)).join(", "),
    });
  }
  return t("home.houseAskSeed", { house: h.house, varga: vargaLabel, sign, lord });
}

const SIGN_ORDER: SignKey[] = [
  "aries",
  "taurus",
  "gemini",
  "cancer",
  "leo",
  "virgo",
  "libra",
  "scorpio",
  "sagittarius",
  "capricorn",
  "aquarius",
  "pisces",
];

function buildHousesFromVargaTable(vt: VargaTable): DisplayHouse[] {
  const byHouse: Record<number, PlanetKey[]> = {};
  for (const r of vt.rows) {
    (byHouse[r.house] ??= []).push(r.key);
  }

  return Array.from({ length: 12 }, (_, i) => {
    const houseNum = i + 1;
    const signKey = SIGN_KEYS_BY_INDEX[(vt.ascSignIndex + i) % 12];
    const lordKey = signKey ? SIGN_LORD[signKey] : null;
    return {
      house: houseNum,
      signKey,
      signName: signKey ?? "",
      lordKey,
      lordName: lordKey ?? "",
      planetKeys: byHouse[houseNum] ?? [],
    };
  });
}

function buildHousesFromPlanets(planets: NormalizedPlanet[]): DisplayHouse[] {
  const asc =
    planets.find((p) => /ascend|lagna/i.test(p.name)) ?? planets.find((p) => p.house === 1) ?? null;
  const ascSignKey = asc?.signKey ?? null;
  const ascIndex = ascSignKey ? SIGN_ORDER.indexOf(ascSignKey) : -1;

  const byHouse: Record<number, PlanetKey[]> = {};
  for (const p of planets) {
    if (p.house == null || p.key == null) continue;
    if (!/ascend|lagna/i.test(p.name)) {
      (byHouse[p.house] ??= []).push(p.key);
    }
  }

  return Array.from({ length: 12 }, (_, i) => {
    const houseNum = i + 1;
    const signKey = ascIndex >= 0 ? SIGN_ORDER[(ascIndex + i) % 12] : null;
    const lordKey = signKey ? SIGN_LORD[signKey] : null;
    return {
      house: houseNum,
      signKey,
      signName: signKey ?? "",
      lordKey,
      lordName: lordKey ?? "",
      planetKeys: byHouse[houseNum] ?? [],
    };
  });
}

function InlineSpinner() {
  const { t } = useTranslation();
  return (
    <div className="flex w-full items-center justify-center py-6">
      <span
        className="h-6 w-6 animate-spin rounded-full border-2 border-primary/30 border-t-primary motion-reduce:animate-none"
        aria-hidden="true"
      />
      <span className="sr-only">{t("states.loading")}</span>
    </div>
  );
}

function ErrorInline({
  messageKey,
  code,
  onRetry,
}: {
  messageKey: string;
  code: string | null;
  onRetry: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
      <p className="text-sm text-foreground">{t(messageKey)}</p>
      <div className="flex flex-wrap items-center gap-2">
        {code === "birth_profile_incomplete" && (
          <Link
            to="/onboarding/birth"
            className="inline-flex items-center rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          >
            {t("home.chartErrors.finishBirth")}
          </Link>
        )}
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
        >
          {t("states.retry")}
        </button>
      </div>
    </div>
  );
}

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl border border-border bg-card p-5 ${className}`}
      style={{ boxShadow: "var(--shadow-soft)" }}
    >
      {children}
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="flex aspect-square w-full max-w-md mx-auto items-center justify-center rounded-xl border border-border/80 bg-card/40 p-6 animate-pulse">
      <div className="relative flex h-full w-full items-center justify-center rounded-lg border-2 border-dashed border-primary/20">
        <div className="h-28 w-28 rounded-full border-2 border-primary/20 bg-primary/5" />
        <div className="absolute inset-4 rounded-lg border border-primary/10" />
      </div>
    </div>
  );
}

function PlanetsTableSkeleton() {
  return (
    <div className="space-y-3 animate-pulse py-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center justify-between rounded-xl border border-border/60 bg-card/30 p-3"
        >
          <div className="h-4 w-24 rounded bg-primary/10" />
          <div className="h-4 w-20 rounded bg-primary/10" />
          <div className="hidden sm:block h-4 w-16 rounded bg-primary/10" />
          <div className="hidden sm:block h-4 w-20 rounded bg-primary/10" />
        </div>
      ))}
    </div>
  );
}

function HousesGridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 animate-pulse py-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-20 rounded-xl border border-border/60 bg-card/30 p-3 space-y-2">
          <div className="h-3 w-16 rounded bg-primary/10" />
          <div className="h-4 w-24 rounded bg-primary/10" />
        </div>
      ))}
    </div>
  );
}

function NakshatraSkeleton() {
  return (
    <div className="flex flex-col items-center justify-center space-y-3 py-4 animate-pulse">
      <div className="h-3 w-28 rounded bg-primary/10" />
      <div className="h-7 w-40 rounded-lg bg-primary/10" />
      <div className="h-4 w-48 rounded bg-primary/10" />
    </div>
  );
}
