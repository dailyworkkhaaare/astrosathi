import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, RefreshCw } from "lucide-react";
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
    <div className="space-y-6">
      <section
        aria-labelledby="ashtakavarga-heading"
        className="rounded-2xl border border-border bg-card p-5"
      >
        <header>
          <h2 id="ashtakavarga-heading" className="text-lg font-semibold text-foreground">
            {t("sections.ashtakavarga.sarvashtakavargaTitle")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("sections.ashtakavarga.sarvashtakavargaSubtitle")}
          </p>
        </header>

        {loading && <SkeletonGrid />}

        {!loading && hasError && (
          <div
            role="alert"
            className="mt-5 flex flex-col gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3"
          >
            <div className="flex items-start gap-2 text-sm text-foreground">
              <AlertTriangle size={16} className="text-destructive" aria-hidden="true" />
              <span>{t("sections.ashtakavarga.loadError")}</span>
            </div>
            <button
              type="button"
              onClick={() => q.refetch()}
              className="inline-flex min-h-11 w-fit items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {houses.map((h) => (
                <HouseCard key={h.house.number} h={h} />
              ))}
            </div>
            <p className="mt-5 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">
                {t("sections.ashtakavarga.totalBindus")}
              </span>{" "}
              <span className="text-foreground">{total}</span>
            </p>
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
      className="rounded-2xl border border-border bg-card p-5"
    >
      <header>
        <h2 id="bhinnashtakavarga-heading" className="text-lg font-semibold text-foreground">
          {t("sections.ashtakavarga.bhinnashtakavargaTitle")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("sections.ashtakavarga.bhinnashtakavargaSubtitle")}
        </p>
      </header>

      <div role="tablist" aria-label="Planet" className="mt-4 flex flex-wrap gap-1.5">
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
                "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
                (active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground hover:text-foreground")
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
          className="mt-5 flex flex-col gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3"
        >
          <div className="flex items-start gap-2 text-sm text-foreground">
            <AlertTriangle size={16} className="text-destructive" aria-hidden="true" />
            <span>{t("sections.ashtakavarga.bhinnaLoadError")}</span>
          </div>
          <button
            type="button"
            onClick={() => q.refetch()}
            className="inline-flex min-h-11 w-fit items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {houses.map((h) => (
              <BhinnaHouseCard key={h.house.number} h={h} />
            ))}
          </div>
          <p className="mt-5 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">
              {t("sections.ashtakavarga.totalBindusForPlanet", { planet: planetName })}
            </span>{" "}
            <span className="text-foreground">{total}</span>
          </p>
        </>
      )}
    </section>
  );
}

function BhinnaHouseCard({ h }: { h: AshtakavargaHouse }) {
  const { t } = useTranslation();
  const score = Number(h.score) || 0;
  const strong = score >= 5;
  const weak = score <= 2;
  const scoreColor = strong ? "text-primary" : weak ? "text-accent" : "text-foreground";
  const ring = strong ? "border-primary/40" : weak ? "border-accent/30" : "border-border";
  const contributors = Array.isArray(h.planets)
    ? h.planets
        .filter((p) => Number(p.score) === 1)
        .map((p) => p.planet?.name)
        .filter(Boolean)
    : [];
  return (
    <article className={`flex flex-col gap-2 rounded-xl border bg-background p-4 ${ring}`}>
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            {t("sections.ashtakavarga.houseNum", { n: h.house.number })}
          </div>
          <div className="text-sm font-medium text-foreground">{h.house.name}</div>
        </div>
        <div className={`text-2xl font-semibold tabular-nums ${scoreColor}`}>{score}</div>
      </div>
      <div className="text-sm text-foreground">{h.rasi?.name ?? "—"}</div>
      <div className="text-xs text-muted-foreground">
        {t("sections.ashtakavarga.lord")} {h.rasi?.lord?.name ?? "—"}
      </div>
      {contributors.length > 0 && (
        <details className="mt-1">
          <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
            {t("sections.ashtakavarga.contributors", { count: contributors.length })}
          </summary>
          <p className="mt-1 text-xs text-muted-foreground">{contributors.join(", ")}</p>
        </details>
      )}
    </article>
  );
}

function HouseCard({ h }: { h: AshtakavargaHouse }) {
  const { t } = useTranslation();
  const score = Number(h.score) || 0;
  const strong = score >= 30;
  const weak = score <= 25;
  const scoreColor = strong ? "text-primary" : weak ? "text-accent" : "text-foreground";
  const ring = strong ? "border-primary/40" : weak ? "border-accent/30" : "border-border";
  return (
    <article className={`flex flex-col gap-2 rounded-xl border bg-background p-4 ${ring}`}>
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            {t("sections.ashtakavarga.houseNum", { n: h.house.number })}
          </div>
          <div className="text-sm font-medium text-foreground">{h.house.name}</div>
        </div>
        <div className={`text-2xl font-semibold tabular-nums ${scoreColor}`}>{score}</div>
      </div>
      <div className="text-sm text-foreground">{h.rasi?.name ?? "—"}</div>
      <div className="text-xs text-muted-foreground">
        {t("sections.ashtakavarga.lord")} {h.rasi?.lord?.name ?? "—"}
      </div>
    </article>
  );
}

function SkeletonGrid() {
  return (
    <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
      {Array.from({ length: 12 }).map((_, i) => (
        <div
          key={i}
          className="flex flex-col gap-2 rounded-xl border border-border bg-background p-4"
        >
          <div className="h-3 w-16 rounded bg-muted motion-safe:animate-pulse" />
          <div className="h-5 w-24 rounded bg-muted motion-safe:animate-pulse" />
          <div className="h-4 w-20 rounded bg-muted motion-safe:animate-pulse" />
          <div className="h-3 w-28 rounded bg-muted motion-safe:animate-pulse" />
        </div>
      ))}
    </div>
  );
}
