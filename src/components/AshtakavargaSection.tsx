import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, ChevronDown, RefreshCw } from "lucide-react";
import { useAshtakavarga, useBhinnashtakavarga, type AshtakavargaHouse } from "@/lib/queries";

const PLANETS: { id: number; key: string }[] = [
  { id: 0, key: "sun" },
  { id: 1, key: "moon" },
  { id: 4, key: "mars" },
  { id: 2, key: "mercury" },
  { id: 5, key: "jupiter" },
  { id: 3, key: "venus" },
  { id: 6, key: "saturn" },
];

export function AshtakavargaSection() {
  const { t } = useTranslation();
  const q = useAshtakavarga();
  const houses = q.data?.houses ?? [];
  const hasError = q.isError || !!q.data?.errorCode;
  const loading = q.isPending;
  const total = houses.reduce((acc, h) => acc + (Number(h.score) || 0), 0);

  return (
    <div className="space-y-4">
      <section
        aria-labelledby="ashtakavarga-heading"
        className="rounded-[1.25rem] bg-card p-4 shadow-[var(--as-elevation-1)] sm:p-5"
      >
        <header>
          <p className="text-xs font-semibold text-accent">{t("sections.ashtakavarga.eyebrow")}</p>
          <h2
            id="ashtakavarga-heading"
            className="mt-0.5 text-[1.0625rem] font-semibold text-foreground"
          >
            {t("sections.ashtakavarga.sarvashtakavargaTitle")}
          </h2>
          <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">
            {t("sections.ashtakavarga.sarvashtakavargaSubtitle")}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {t("sections.ashtakavarga.sarvashtakavargaScope")}
          </p>
        </header>

        {loading && <SkeletonGrid />}

        {!loading && hasError && (
          <div
            role="alert"
            className="mt-4 flex flex-col gap-2 rounded-[0.875rem] bg-destructive/[0.08] p-3"
          >
            <div className="flex items-start gap-2 text-sm text-foreground">
              <AlertTriangle size={16} className="text-destructive-strong" aria-hidden="true" />
              <span>{t("sections.ashtakavarga.loadError")}</span>
            </div>
            <button
              type="button"
              onClick={() => q.refetch()}
              className="tap-press -ml-2 inline-flex min-h-11 w-fit items-center gap-1.5 rounded-full px-2 text-sm font-semibold text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <RefreshCw size={14} aria-hidden="true" />
              {t("sections.ashtakavarga.retry")}
            </button>
          </div>
        )}

        {!loading && !hasError && houses.length === 0 && (
          <p className="mt-5 text-sm text-muted-foreground">{t("sections.ashtakavarga.noData")}</p>
        )}

        {!loading && !hasError && houses.length > 0 && (
          <>
            <BinduHeatmap houses={houses} kind="sarva" />
            <p className="mt-3 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">
                {t("sections.ashtakavarga.totalBindus")}
              </span>{" "}
              <span className="font-semibold tabular-nums text-foreground">{total}</span>
            </p>
            <ExactValues>
              {houses.map((h) => (
                <HouseRow key={h.house.number} h={h} />
              ))}
            </ExactValues>
          </>
        )}
      </section>
      <BhinnashtakavargaSection />
    </div>
  );
}

function BhinnashtakavargaSection() {
  const { t } = useTranslation();
  const [planetId, setPlanetId] = useState<number>(0);
  const q = useBhinnashtakavarga(planetId);
  const houses = q.data?.houses ?? [];
  const hasError = q.isError || !!q.data?.errorCode;
  const loading = q.isPending || q.isFetching;
  const total = houses.reduce((acc, h) => acc + (Number(h.score) || 0), 0);
  const currentPlanetObj = PLANETS.find((p) => p.id === planetId);
  const planetName = currentPlanetObj
    ? t(`sections.ashtakavarga.planets.${currentPlanetObj.key}`)
    : "";

  return (
    <section
      aria-labelledby="bhinnashtakavarga-heading"
      className="rounded-[1.25rem] bg-card p-4 shadow-[var(--as-elevation-1)] sm:p-5"
    >
      <header>
        <p className="text-xs font-semibold text-accent">{t("sections.ashtakavarga.planetLens")}</p>
        <h2
          id="bhinnashtakavarga-heading"
          className="mt-0.5 text-[1.0625rem] font-semibold text-foreground"
        >
          {t("sections.ashtakavarga.bhinnashtakavargaTitle")}
        </h2>
        <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">
          {t("sections.ashtakavarga.bhinnashtakavargaSubtitle")}
        </p>
      </header>
      <div
        role="tablist"
        aria-label="Planet"
        className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 py-0.5 [mask-image:linear-gradient(to_right,transparent,black_1rem,black_calc(100%-1.5rem),transparent)] [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0 sm:[mask-image:none] [&::-webkit-scrollbar]:hidden"
      >
        {PLANETS.map((p) => {
          const active = p.id === planetId;
          return (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setPlanetId(p.id)}
              className={
                "tap-press inline-flex min-h-11 shrink-0 items-center rounded-full border px-3.5 text-[0.8125rem] font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
                (active
                  ? "border-accent/60 bg-accent/10 text-accent"
                  : "border-foreground/[0.14] text-muted-foreground hover:text-foreground")
              }
            >
              {t(`sections.ashtakavarga.planets.${p.key}`)}
            </button>
          );
        })}
      </div>

      {loading && <SkeletonGrid />}

      {!loading && hasError && (
        <div
          role="alert"
          className="mt-4 flex flex-col gap-2 rounded-[0.875rem] bg-destructive/[0.08] p-3"
        >
          <div className="flex items-start gap-2 text-sm text-foreground">
            <AlertTriangle size={16} className="text-destructive-strong" aria-hidden="true" />
            <span>{t("sections.ashtakavarga.bhinnaLoadError")}</span>
          </div>
          <button
            type="button"
            onClick={() => q.refetch()}
            className="tap-press -ml-2 inline-flex min-h-11 w-fit items-center gap-1.5 rounded-full px-2 text-sm font-semibold text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <RefreshCw size={14} aria-hidden="true" />
            {t("sections.ashtakavarga.retry")}
          </button>
        </div>
      )}

      {!loading && !hasError && houses.length === 0 && (
        <p className="mt-5 text-sm text-muted-foreground">
          {t("sections.ashtakavarga.bhinnaNoData")}
        </p>
      )}

      {!loading && !hasError && houses.length > 0 && (
        <>
          <BinduHeatmap houses={houses} kind="bhinna" planetName={planetName} />
          <p className="mt-3 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">
              {t("sections.ashtakavarga.totalBindusForPlanet", { planet: planetName })}
            </span>{" "}
            <span className="font-semibold tabular-nums text-foreground">{total}</span>
          </p>
          <ExactValues>
            {houses.map((h) => (
              <HouseRow key={h.house.number} h={h} withContributors />
            ))}
          </ExactValues>
        </>
      )}
    </section>
  );
}

function BinduHeatmap({
  houses,
  kind,
  planetName,
}: {
  houses: AshtakavargaHouse[];
  kind: "sarva" | "bhinna";
  planetName?: string;
}) {
  const { t } = useTranslation();
  const label =
    kind === "sarva"
      ? t("sections.ashtakavarga.sarvashtakavargaHeatmap")
      : t("sections.ashtakavarga.bhinnashtakavargaHeatmap", { planet: planetName ?? "" });
  const strongAt = kind === "sarva" ? 30 : 5;
  const lowAt = kind === "sarva" ? 25 : 2;

  return (
    <section aria-label={label} className="motion-fade-up mt-4">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h3 className="text-[0.8125rem] font-semibold text-muted-foreground">{label}</h3>
        <span className="text-xs text-muted-foreground">
          {t("sections.ashtakavarga.bindusLabel")}
        </span>
      </div>
      <div
        className={
          "grid gap-1.5 " + (kind === "sarva" ? "grid-cols-4" : "grid-cols-4 sm:grid-cols-6")
        }
        role="list"
      >
        {houses.map((h) => {
          const score = Number(h.score) || 0;
          const intensity =
            score >= strongAt
              ? "bg-accent/30"
              : score <= lowAt
                ? "bg-foreground/[0.06]"
                : "bg-accent/[0.14]";
          const house = t("sections.ashtakavarga.houseNum", { n: h.house.number });
          return (
            <div
              key={h.house.number}
              role="listitem"
              aria-label={t("sections.ashtakavarga.heatmapCellAria", {
                house,
                sign: h.rasi?.name ?? "—",
                score,
              })}
              className={`flex flex-col items-center rounded-[0.75rem] px-1 py-2 text-center ${intensity}`}
            >
              <p className="text-[0.6875rem] text-muted-foreground">
                {t("sections.ashtakavarga.houseShort", { n: h.house.number })}
              </p>
              <p className="text-xl font-bold leading-tight tabular-nums text-foreground">
                {score}
              </p>
              <p className="w-full truncate text-[0.625rem] text-muted-foreground">
                {h.rasi?.name ?? "—"}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** Exact per-house values, one tap away so the maps stay the focus. */
function ExactValues({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  return (
    <details className="group mt-3 border-t border-[color:var(--as-list-separator)] pt-1">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-md text-sm font-semibold text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
        {t("sections.ashtakavarga.exactHouseValues")}
        <ChevronDown
          size={16}
          aria-hidden="true"
          className="shrink-0 transition-transform group-open:rotate-180"
        />
      </summary>
      <ul className="list-hairline [--list-inset:0rem]">{children}</ul>
    </details>
  );
}

function HouseRow({
  h,
  withContributors = false,
}: {
  h: AshtakavargaHouse;
  withContributors?: boolean;
}) {
  const { t } = useTranslation();
  const score = Number(h.score) || 0;
  const contributors =
    withContributors && Array.isArray(h.planets)
      ? h.planets
          .filter((p) => Number(p.score) === 1)
          .map((p) => p.planet?.name)
          .filter(Boolean)
      : [];
  return (
    <li className="flex items-center gap-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="text-sm text-foreground">
          {t("sections.ashtakavarga.houseNum", { n: h.house.number })}
          {h.house.name ? <span className="text-muted-foreground"> · {h.house.name}</span> : null}
        </p>
        <p className="text-xs text-muted-foreground">
          {h.rasi?.name ?? "—"} · {t("sections.ashtakavarga.lord")} {h.rasi?.lord?.name ?? "—"}
        </p>
        {contributors.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            {t("sections.ashtakavarga.contributors", { count: contributors.length })}:{" "}
            {contributors.join(", ")}
          </p>
        ) : null}
      </div>
      <span className="shrink-0 text-lg font-semibold tabular-nums text-foreground">{score}</span>
    </li>
  );
}

function SkeletonGrid() {
  return (
    <div className="mt-4 grid grid-cols-4 gap-1.5" aria-hidden="true">
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="h-16 rounded-[0.75rem] bg-muted motion-safe:animate-pulse" />
      ))}
    </div>
  );
}
