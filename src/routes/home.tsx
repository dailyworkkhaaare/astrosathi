import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  Bell,
  BookHeart,
  CalendarClock,
  Check,
  ChevronDown,
  ChevronRight,
  LayoutGrid,
  MessageCircle,
  Orbit,
  Sparkles,
} from "lucide-react";
import { useRequireOnboarding } from "@/lib/require-auth";
import { triggerHaptic } from "@/lib/native-device";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { ExpandableSection } from "@/components/ExpandableSection";
import { ChartFrame } from "@/components/chart/ChartFrame";
import { AstroArt } from "@/components/AstroArt";
import { grahaArtByName } from "@/lib/astro-art";

import { getBirthProfile, type BirthProfile } from "@/lib/birth-profile";
import {
  CHART_STYLES,
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
import { useChart, usePlanets, useUnreadNudgeCount } from "@/lib/queries";
import { NumerologySection } from "@/components/NumerologySection";
import { DoshasSection } from "@/components/DoshasSection";
import { AshtakavargaSection } from "@/components/AshtakavargaSection";
import { LoShuSection } from "@/components/LoShuSection";
import { DashaSection } from "@/components/DashaSection";
import { RemediesSection } from "@/components/RemediesSection";
import { CosmosOverview, type CosmosOverviewTab } from "@/components/CosmosOverview";

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

const PLANET_STATE_KEYS: Record<string, string> = {
  "Exalted (deep)": "home.planetStates.exaltedDeep",
  Exalted: "home.planetStates.exalted",
  "Debilitated (deep)": "home.planetStates.debilitatedDeep",
  Debilitated: "home.planetStates.debilitated",
  Moolatrikona: "home.planetStates.moolatrikona",
  "Own sign": "home.planetStates.ownSign",
  Combust: "home.planetStates.combust",
  Vargottama: "home.planetStates.vargottama",
};

function planetStateLabel(state: string, t: (key: string) => string): string {
  const key = PLANET_STATE_KEYS[state];
  return key ? t(key) : state;
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

const TAB_KEYS = [
  "overview",
  "charts",
  "details",
  "doshas",
  "remedies",
  "ashtakavarga",
  "numerology",
  "loshu",
] as const;
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
  const tab: TabKey = tabParam ?? "overview";
  const setTab = (k: TabKey) => {
    void triggerHaptic("selection");
    void navigate({ search: { tab: k }, replace: true });
  };
  const isProfileIncomplete = profileLoaded && (!profile || !profile.dob);
  const unreadNudges = useUnreadNudgeCount();

  return (
    <section className="space-y-6">
      <header>
        <p className="text-[0.8125rem] font-semibold tracking-[0.04em] text-muted-foreground">
          {t("home.greeting", { name })}
        </p>
        <h1 className="large-title mt-0.5 text-foreground">{t("home.title")}</h1>
      </header>

      {isProfileIncomplete && <IncompleteProfileHeroCard />}

      <Tabs current={tab} onChange={setTab} />

      <div key={tab} className="motion-fade-up">
        {tab === "overview" && (
          <CosmosOverview onSelectTab={setTab as (tab: CosmosOverviewTab) => void} />
        )}
        {tab === "charts" && <ChartsTab />}
        {tab === "details" && <DashaSection />}
        {tab === "doshas" && <DoshasSection />}
        {tab === "remedies" && <RemediesSection />}
        {tab === "ashtakavarga" && <AshtakavargaSection />}
        {tab === "numerology" && <NumerologySection />}
        {tab === "loshu" && <LoShuSection />}
      </div>

      <div className="motion-fade-up grid grid-cols-2 gap-3 border-t border-border/70 pt-5">
        <Link
          to="/life"
          onClick={() => void triggerHaptic("selection")}
          className="tap-press flex min-w-0 items-center gap-2 rounded-xl border border-border bg-card px-3 py-3 min-h-11 text-sm font-medium text-foreground transition-colors hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-4"
        >
          <CalendarClock size={15} aria-hidden="true" className="shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate">{t("life.entryLabel")}</span>
          <ChevronRight size={16} aria-hidden="true" className="shrink-0 text-muted-foreground" />
        </Link>

        <Link
          to="/nudges"
          onClick={() => void triggerHaptic("selection")}
          className="tap-press flex min-w-0 items-center gap-2 rounded-xl border border-border bg-card px-3 py-3 min-h-11 text-sm font-medium text-foreground transition-colors hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-4"
        >
          <Bell size={15} aria-hidden="true" className="shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate">{t("nudges.entryLabel")}</span>
          {unreadNudges > 0 && (
            <span
              className="inline-flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-semibold text-accent-foreground"
              aria-label={String(unreadNudges)}
            >
              {unreadNudges > 99 ? "99+" : unreadNudges}
            </span>
          )}
          <ChevronRight size={16} aria-hidden="true" className="shrink-0 text-muted-foreground" />
        </Link>

        <Link
          to="/journal"
          onClick={() => void triggerHaptic("selection")}
          className="tap-press col-span-2 flex min-w-0 items-center gap-2 rounded-xl border border-border bg-card px-3 py-3 min-h-11 text-sm font-medium text-foreground transition-colors hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-4"
        >
          <BookHeart size={15} aria-hidden="true" className="shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate">{t("journal.entryLabel")}</span>
          <ChevronRight size={16} aria-hidden="true" className="shrink-0 text-muted-foreground" />
        </Link>
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

function Tabs({ current, onChange }: { current: TabKey; onChange: (k: TabKey) => void }) {
  const { t } = useTranslation();
  const listRef = useRef<HTMLDivElement>(null);

  // Keep the active chip in view horizontally only, so the page never jumps.
  useEffect(() => {
    const list = listRef.current;
    const active = list?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!list || !active) return;
    const left = active.offsetLeft - (list.clientWidth - active.offsetWidth) / 2;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    list.scrollTo({ left: Math.max(0, left), behavior: reduce ? "auto" : "smooth" });
  }, [current]);

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={t("home.title")}
      className="-mx-4 flex gap-2 overflow-x-auto scroll-smooth px-4 py-0.5 [mask-image:linear-gradient(to_right,transparent,black_1rem,black_calc(100%-1.5rem),transparent)] [scrollbar-width:none] [-ms-overflow-style:none] sm:mx-0 sm:px-0 sm:[mask-image:none] [&::-webkit-scrollbar]:hidden"
    >
      {TAB_KEYS.map((k) => {
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
                const i = TAB_KEYS.indexOf(current);
                const next =
                  e.key === "ArrowRight"
                    ? TAB_KEYS[(i + 1) % TAB_KEYS.length]
                    : TAB_KEYS[(i - 1 + TAB_KEYS.length) % TAB_KEYS.length];
                onChange(next);
              }
            }}
            className={
              "tap-press inline-flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-full border px-4 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
              (active
                ? "border-accent/60 bg-accent/10 text-accent"
                : "border-foreground/[0.14] text-muted-foreground hover:text-foreground")
            }
          >
            {t(`home.tabs.${k}`)}
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
  const [style, setStyle] = useState<ChartStyle>("north");
  const [selectedHouse, setSelectedHouse] = useState<number | null>(null);
  const [selectedPlanet, setSelectedPlanet] = useState<PlanetKey | null>(null);
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
  const selectVarga = (next: VargaKey) => {
    setVarga(next);
    void triggerHaptic("selection");
  };
  const selectChartStyle = (next: ChartStyle) => {
    setStyle(next);
    void triggerHaptic("selection");
  };

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
  // house number, not the rotating rasi digit printed inside it). Selection
  // is display-only: it never changes provider output or sends an Ask prompt.
  const handleChartHouseClick = (houseNumber: number) => {
    setSelectedHouse(houseNumber);
    void triggerHaptic("selection");
  };

  const handlePlanetAsk = (planet: DisplayPlanet) => {
    void triggerHaptic("selection");
    void navigate({
      to: "/chat",
      search: { seed: buildPlanetSeed(t, debounced.varga, planet) },
    });
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
      <section
        aria-labelledby="kundli-chart-heading"
        className="rounded-[1.25rem] bg-card p-4 shadow-[var(--as-elevation-1)] sm:p-5"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 id="kundli-chart-heading" className="text-[1.0625rem] font-semibold text-foreground">
            {t("home.chartTitle")}
          </h2>
          <ChartStylePicker current={style} onSelect={selectChartStyle} />
        </div>
        <VargaControls current={varga} onSelect={selectVarga} />
        <div
          role="region"
          aria-live="polite"
          aria-label={t(`home.varga.${varga.toLowerCase()}`)}
          className="relative mt-3.5 w-full"
        >
          {loading && <ChartSkeleton />}
          {!loading && errorMessageKey && (
            <div className="flex flex-col items-start gap-3 rounded-xl bg-destructive/[0.08] p-4">
              <p className="text-sm text-foreground">{t(errorMessageKey)}</p>
              <div className="flex flex-wrap items-center gap-2">
                {errorCode === "birth_profile_incomplete" && (
                  <Link
                    to="/onboarding/birth"
                    className="tap-press inline-flex min-h-11 items-center rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {t("home.chartErrors.finishBirth")}
                  </Link>
                )}
                <button
                  type="button"
                  onClick={onRetry}
                  className="tap-press inline-flex min-h-11 items-center rounded-full px-3 text-sm font-semibold text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                  role="group"
                  aria-label={t("home.chartSelection.accessibleList")}
                >
                  {NORTH_CHART_HOUSE_REGIONS.map((r) => (
                    <polygon
                      key={r.house}
                      points={r.points}
                      role="button"
                      tabIndex={0}
                      aria-label={t("home.houseLabel", { n: r.house })}
                      aria-pressed={selectedHouse === r.house}
                      className={
                        "pointer-events-auto cursor-pointer outline-none transition-colors hover:fill-accent/10 focus:fill-accent/10 " +
                        (selectedHouse === r.house ? "fill-primary/15" : "fill-transparent")
                      }
                      onClick={() => handleChartHouseClick(r.house)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          handleChartHouseClick(r.house);
                        }
                      }}
                    />
                  ))}
                </svg>
              )}
            </ChartFrame>
          )}
        </div>
        <p className="mt-2.5 px-0.5 text-xs leading-relaxed text-muted-foreground">
          {t("home.vargaExplorer.current", {
            chart: t(`home.varga.${varga.toLowerCase()}`),
          })}
        </p>
      </section>

      <ChartSelectionLayer
        houses={displayHouses}
        loading={tablesLoading}
        errorKey={tablesErrorKey}
        errorCode={tablesErrorCode}
        onRetry={onRetryTables}
        selectedHouse={selectedHouse}
        onSelectHouse={(house) => {
          setSelectedHouse(house);
          void triggerHaptic("selection");
        }}
        varga={debounced.varga}
        onAsk={(house) => {
          void triggerHaptic("selection");
          void navigate({
            to: "/chat",
            search: { seed: buildHouseSeed(t, debounced.varga, house) },
          });
        }}
      />

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
          <ul className="list-hairline -mx-5 -mb-1 [--list-inset:4.5rem]">
            {displayPlanets.map((p) => {
              const statesExcludeRetro = p.states.filter((s) => s !== "Retrograde");
              const art = grahaArtByName(p.key);
              const sign = p.signKey ? t(`signs.${p.signKey}`) : p.signName || "—";
              const signLord = p.signLordKey
                ? t(`home.planets.${p.signLordKey}`)
                : p.signLordName || "—";
              const nakLord = p.nakshatraLordKey
                ? t(`home.planets.${p.nakshatraLordKey}`)
                : p.nakshatraLordName || "—";
              return (
                <li key={p.key} className="flex gap-3.5 px-5 py-3.5">
                  {art ? (
                    <AstroArt kind="graha" name={art} size={40} />
                  ) : (
                    <span className="h-10 w-10 shrink-0" aria-hidden="true" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="text-[1.0625rem] font-semibold text-foreground">
                          {t(`home.planets.${p.key}`)}
                        </span>
                        {p.degInSign != null && (
                          <span className="text-xs tabular-nums text-muted-foreground">
                            {formatDeg(p.degInSign)}
                          </span>
                        )}
                        {p.retrograde && (
                          <span
                            aria-label={t("home.motionRetro")}
                            className="inline-flex items-center rounded-md bg-accent/15 px-1.5 py-0.5 text-xs font-medium text-accent"
                          >
                            {t("home.retroShort")}
                          </span>
                        )}
                      </div>
                      <span className="shrink-0 text-sm text-muted-foreground">
                        {p.house != null ? t("home.houseLabel", { n: p.house }) : "—"}
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm text-foreground">
                      {sign}
                      {!isDivisional && p.nakshatraName ? ` · ${p.nakshatraName}` : ""}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {t("home.colSignLord")} {signLord}
                      {!isDivisional ? ` · ${t("home.colNakshatraLord")} ${nakLord}` : ""}
                    </p>
                    {statesExcludeRetro.length > 0 && (
                      <div
                        className="mt-1.5 flex flex-wrap gap-1.5"
                        aria-label={t("home.colStates")}
                      >
                        {statesExcludeRetro.map((s) => (
                          <span
                            key={s}
                            className="inline-flex items-center rounded-full bg-foreground/[0.08] px-2 py-0.5 text-xs text-muted-foreground"
                          >
                            {planetStateLabel(s, t)}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="mt-1 flex flex-wrap items-center gap-x-1">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedPlanet((current) => (current === p.key ? null : p.key));
                          void triggerHaptic("selection");
                        }}
                        aria-pressed={selectedPlanet === p.key}
                        className="tap-press -ml-2 inline-flex min-h-11 items-center rounded-full px-2 text-[0.8125rem] font-semibold text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {t("home.chartInspector.inspect")}
                      </button>
                      {selectedPlanet === p.key && (
                        <button
                          type="button"
                          onClick={() => handlePlanetAsk(p)}
                          className="tap-press inline-flex min-h-11 items-center gap-1.5 rounded-full px-2 text-[0.8125rem] font-semibold text-[var(--as-color-action-ask)] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <MessageCircle size={15} aria-hidden="true" />
                          {t("home.chartInspector.askPlacementInline")}
                        </button>
                      )}
                    </div>
                  </div>
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
          <ul className="grid grid-cols-3 gap-2">
            {displayHouses.map((h) => (
              <li key={h.house}>
                <Link
                  to="/chat"
                  search={{ seed: buildHouseSeed(t, debounced.varga, h) }}
                  onClick={() => void triggerHaptic("selection")}
                  className="tap-press flex h-full min-h-[5.5rem] flex-col gap-0.5 rounded-[0.875rem] bg-foreground/[0.05] px-2.5 py-2.5 text-sm transition-colors hover:bg-foreground/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="text-xs text-muted-foreground">
                    {t("home.houseLabel", { n: h.house })}
                  </div>
                  <div className="truncate text-base font-semibold text-foreground">
                    {h.signKey ? t(`signs.${h.signKey}`) : h.signName || "—"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {t("home.colLord")}:{" "}
                    {h.lordKey ? t(`home.planets.${h.lordKey}`) : h.lordName || "—"}
                  </div>
                  {h.planetKeys.length > 0 && (
                    <div className="text-xs font-semibold text-accent">
                      {h.planetKeys.map((pk) => t(`home.planets.${pk}`)).join(", ")}
                    </div>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </ExpandableSection>

      <section className="rounded-[1.25rem] bg-card px-5 py-6 shadow-[var(--as-elevation-1)]">
        <div className="flex flex-col items-center gap-1 text-center">
          <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground [:lang(hi)_&]:tracking-normal [:lang(mr)_&]:tracking-normal">
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
              <p className="font-display text-[2rem] font-semibold leading-tight text-foreground">
                {nakName}
              </p>
              <p className="text-sm text-muted-foreground">
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
      </section>
    </div>
  );
}

function ChartStylePicker({
  current,
  onSelect,
}: {
  current: ChartStyle;
  onSelect: (style: ChartStyle) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const currentLabel = t(`home.chartStyle.${current}`);

  return (
    <div>
      <div className="sm:hidden">
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerTrigger asChild>
            <button
              type="button"
              aria-label={`${t("home.chartStyle.pickerLabel")} · ${currentLabel}`}
              className={PILL_TRIGGER}
            >
              <span className="truncate">{currentLabel}</span>
              <ChevronDown size={15} className="shrink-0" aria-hidden="true" />
            </button>
          </DrawerTrigger>
          <DrawerContent
            aria-label={t("home.chartStyle.pickerLabel")}
            className="bg-card sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:max-h-[min(42rem,calc(100dvh-2rem))] sm:w-full sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl"
          >
            <DrawerHeader className="px-5 pb-4 pt-5 text-left">
              <DrawerTitle className="font-display text-xl">
                {t("home.chartStyle.pickerLabel")}
              </DrawerTitle>
              <DrawerDescription className="leading-relaxed">
                {t(`home.chartStyleCaption.${current}`)}
              </DrawerDescription>
            </DrawerHeader>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-[calc(1rem+var(--as-safe-bottom))]">
              <div
                role="listbox"
                aria-label={t("home.chartStyle.pickerLabel")}
                className="space-y-2"
              >
                {CHART_STYLES.map((chartStyle) => {
                  const selected = current === chartStyle;
                  return (
                    <button
                      key={chartStyle}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => {
                        onSelect(chartStyle);
                        setOpen(false);
                      }}
                      className={
                        "tap-press flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border px-3 text-left text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
                        (selected
                          ? "border-primary/45 bg-primary/10 text-foreground"
                          : "border-border bg-background text-muted-foreground hover:text-foreground")
                      }
                    >
                      <span>{t(`home.chartStyle.${chartStyle}`)}</span>
                      {selected && (
                        <Check size={16} className="shrink-0 text-primary" aria-hidden="true" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </DrawerContent>
        </Drawer>
      </div>
      <div className="hidden sm:block">
        <label htmlFor="chart-style-select" className="sr-only">
          {t("home.chartStyle.pickerLabel")}
        </label>
        <select
          id="chart-style-select"
          value={current}
          onChange={(event) => onSelect(event.target.value as ChartStyle)}
          className={PILL_SELECT}
        >
          {CHART_STYLES.map((chartStyle) => (
            <option key={chartStyle} value={chartStyle}>
              {t(`home.chartStyle.${chartStyle}`)}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function VargaControls({
  current,
  onSelect,
}: {
  current: VargaKey;
  onSelect: (varga: VargaKey) => void;
}) {
  const { t } = useTranslation();
  const [selectorOpen, setSelectorOpen] = useState(false);
  const quickChoices: VargaKey[] = ["D1", "D9", "D10"];

  return (
    <div
      role="group"
      aria-label={t("home.vargaExplorer.title")}
      className="-mx-4 mt-3 flex items-center gap-2 overflow-x-auto px-4 py-0.5 [mask-image:linear-gradient(to_right,transparent,black_1rem,black_calc(100%-1.5rem),transparent)] [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0 sm:[mask-image:none] [&::-webkit-scrollbar]:hidden"
    >
      {quickChoices.map((key) => {
        const selected = current === key;
        return (
          <button
            key={key}
            type="button"
            aria-pressed={selected}
            onClick={() => onSelect(key)}
            className={
              "tap-press inline-flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-full border px-3.5 text-[0.8125rem] font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
              (selected
                ? "border-accent/60 bg-accent/10 text-accent"
                : "border-foreground/[0.14] text-muted-foreground hover:text-foreground")
            }
          >
            {t(`home.varga.${key.toLowerCase()}`)}
          </button>
        );
      })}
      <div className="shrink-0 sm:hidden">
        <Drawer open={selectorOpen} onOpenChange={setSelectorOpen}>
          <DrawerTrigger asChild>
            <button type="button" className={PILL_TRIGGER}>
              <span className="truncate">{t("home.varga.pickerLabel")}</span>
              <ChevronDown size={15} className="shrink-0" aria-hidden="true" />
            </button>
          </DrawerTrigger>
          <DrawerContent
            aria-label={t("home.varga.pickerLabel")}
            className="bg-card sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:max-h-[min(42rem,calc(100dvh-2rem))] sm:w-full sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl"
          >
            <DrawerHeader className="px-5 pb-4 pt-5 text-left">
              <DrawerTitle className="font-display text-xl">
                {t("home.varga.pickerLabel")}
              </DrawerTitle>
              <DrawerDescription className="leading-relaxed">
                {t("home.vargaExplorer.description")}
              </DrawerDescription>
            </DrawerHeader>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-[calc(1rem+var(--as-safe-bottom))]">
              <div role="listbox" aria-label={t("home.varga.pickerLabel")} className="space-y-2">
                {VARGA_KEYS.map((key) => {
                  const selected = current === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => {
                        onSelect(key);
                        setSelectorOpen(false);
                      }}
                      className={
                        "tap-press flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border px-3 text-left text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
                        (selected
                          ? "border-primary/45 bg-primary/10 text-foreground"
                          : "border-border bg-background text-muted-foreground hover:text-foreground")
                      }
                    >
                      <span>{t(`home.varga.${key.toLowerCase()}`)}</span>
                      {selected && (
                        <Check size={16} className="shrink-0 text-primary" aria-hidden="true" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </DrawerContent>
        </Drawer>
      </div>
      <div className="hidden sm:block">
        <label htmlFor="varga-select" className="sr-only">
          {t("home.varga.pickerLabel")}
        </label>
        <select
          id="varga-select"
          value={current}
          onChange={(event) => onSelect(event.target.value as VargaKey)}
          className={PILL_SELECT}
        >
          {VARGA_KEYS.map((key) => (
            <option key={key} value={key}>
              {t(`home.varga.${key.toLowerCase()}`)}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

const PILL_TRIGGER =
  "tap-press inline-flex min-h-11 max-w-[11rem] items-center gap-1.5 rounded-full bg-foreground/[0.07] px-3.5 text-[0.8125rem] font-semibold text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const PILL_SELECT =
  "h-11 max-w-[14rem] truncate rounded-full border-0 bg-foreground/[0.07] pl-3.5 pr-8 text-[0.8125rem] font-semibold text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring";

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

function ChartSelectionLayer({
  houses,
  loading,
  errorKey,
  errorCode,
  onRetry,
  selectedHouse,
  onSelectHouse,
  varga,
  onAsk,
}: {
  houses: DisplayHouse[];
  loading: boolean;
  errorKey: string | null;
  errorCode: string | null;
  onRetry: () => void;
  selectedHouse: number | null;
  onSelectHouse: (house: number | null) => void;
  varga: VargaKey;
  onAsk: (house: DisplayHouse) => void;
}) {
  const { t } = useTranslation();
  const selected = houses.find((house) => house.house === selectedHouse) ?? null;
  const sign = selected?.signKey ? t(`signs.${selected.signKey}`) : selected?.signName || "—";
  const lord = selected?.lordKey
    ? t(`home.planets.${selected.lordKey}`)
    : selected?.lordName || "—";

  return (
    <section
      aria-labelledby="chart-selection-heading"
      className="rounded-[1.25rem] bg-card p-4 shadow-[var(--as-elevation-1)] sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2
          id="chart-selection-heading"
          className="pt-2.5 text-[1.0625rem] font-semibold text-foreground"
        >
          {t("home.chartSelection.title")}
        </h2>
        {selected && (
          <button
            type="button"
            onClick={() => onSelectHouse(null)}
            className="tap-press -mr-2 inline-flex min-h-11 items-center rounded-full px-3 text-sm font-semibold text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t("home.chartSelection.clear")}
          </button>
        )}
      </div>

      {loading ? (
        <div className="mt-4" aria-busy="true">
          <InlineSpinner />
        </div>
      ) : errorKey ? (
        <div className="mt-4">
          <ErrorInline messageKey={errorKey} code={errorCode} onRetry={onRetry} />
        </div>
      ) : houses.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{t("home.noPlanetData")}</p>
      ) : (
        <>
          {selected ? (
            <div className="mt-3 rounded-[0.875rem] bg-accent/[0.08] px-4 py-3.5">
              <p className="text-xs font-semibold text-accent">
                {t("home.chartSelection.selected")}
              </p>
              <h3 className="mt-0.5 text-lg font-semibold text-foreground">
                {t("home.houseLabel", { n: selected.house })} · {sign}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("home.colLord")}: {lord}
                {selected.planetKeys.length > 0
                  ? ` · ${selected.planetKeys.map((key) => t(`home.planets.${key}`)).join(", ")}`
                  : ""}
              </p>
              <button
                type="button"
                onClick={() => onAsk(selected)}
                className="tap-press mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-[var(--as-color-action-ask)] px-4 py-2 text-center text-sm font-semibold leading-snug text-white sm:w-auto focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
              >
                <MessageCircle size={16} aria-hidden="true" />
                {t("home.chartInspector.askHouse", {
                  varga: t(`home.varga.${varga.toLowerCase()}`),
                })}
              </button>
            </div>
          ) : (
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {t("home.chartSelection.hint")}
            </p>
          )}

          <div className="mt-4">
            <h3 className="sr-only">{t("home.chartSelection.accessibleList")}</h3>
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {houses.map((house) => {
                const houseSign = house.signKey
                  ? t(`signs.${house.signKey}`)
                  : house.signName || "—";
                const isSelected = house.house === selectedHouse;
                return (
                  <li key={house.house}>
                    <button
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => onSelectHouse(house.house)}
                      className={
                        "tap-press flex min-h-[3.25rem] w-full flex-col items-start justify-center rounded-[0.75rem] border px-2.5 py-1.5 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
                        (isSelected
                          ? "border-accent/60 bg-accent/10"
                          : "border-transparent bg-foreground/[0.05] hover:bg-foreground/[0.08]")
                      }
                    >
                      <span className="text-xs text-muted-foreground">
                        {t("home.houseLabel", { n: house.house })}
                      </span>
                      <span className="w-full truncate text-sm font-semibold text-foreground">
                        {houseSign}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}
    </section>
  );
}

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

function buildPlanetSeed(
  t: (key: string, opts?: Record<string, unknown>) => string,
  varga: VargaKey,
  planet: DisplayPlanet,
): string {
  const planetName = t(`home.planets.${planet.key}`);
  const sign = planet.signKey ? t(`signs.${planet.signKey}`) : planet.signName || "—";
  return t("home.planetAskSeed", {
    planet: planetName,
    varga: t(`home.varga.${varga.toLowerCase()}`),
    sign,
    house: planet.house ?? "—",
    nakshatra: planet.nakshatraName || "—",
  });
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
