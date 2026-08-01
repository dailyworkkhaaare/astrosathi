import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Heart, Pencil } from "lucide-react";

import { useRequireOnboarding } from "@/lib/require-auth";
import { ChartFrame } from "@/components/chart/ChartFrame";
import { usePersonCharts } from "@/lib/queries";
import { buildVargaTable, mapPlanets, VARGA_TO_ENUM, type NormalizedPlanet } from "@/lib/charts";
import { VARGA_KEYS, type PlanetKey, type VargaKey } from "@/lib/chart-types";
import { COMPAT_RELATIONS, RELATIONS, type Relation } from "@/lib/related-charts";

export const Route = createFileRoute("/people/$id/")({
  head: () => ({
    meta: [{ title: "Chart — AstroSaathi" }],
  }),
  component: PersonDetailPage,
});

function PersonDetailPage() {
  useRequireOnboarding();
  const { t } = useTranslation();
  const { id } = useParams({ from: "/people/$id" });
  const query = usePersonCharts(id);
  const [varga, setVarga] = useState<VargaKey>("D1");

  const bundle = query.data && !query.data.error ? query.data.data : null;
  const errorCode = query.isError ? "provider_error" : (query.data?.error?.code ?? null);
  const loading = query.isPending;

  const realPlanets: NormalizedPlanet[] | null = useMemo(
    () => (bundle ? mapPlanets(bundle.natal) : null),
    [bundle],
  );

  const chartEntry = bundle ? bundle.charts[VARGA_TO_ENUM[varga]] : null;
  const svg = chartEntry?.svg ?? null;
  const isDivisional = varga !== "D1";
  const vargaTable = isDivisional && svg && realPlanets ? buildVargaTable(svg, realPlanets) : null;

  const displayPlanets: {
    key: PlanetKey;
    signName: string;
    house: number | null;
    nakshatraName: string;
    degInSign: number | null;
    retrograde: boolean;
  }[] = isDivisional
    ? (vargaTable?.rows ?? []).map((r) => ({
        key: r.key,
        signName: r.signKey,
        house: r.house,
        nakshatraName: "",
        degInSign: null,
        retrograde: r.retrograde,
      }))
    : (realPlanets ?? [])
        .filter((p) => p.key !== null)
        .map((p) => ({
          key: p.key as PlanetKey,
          signName: p.signKey ?? p.signName,
          house: p.house,
          nakshatraName: p.nakshatraName,
          degInSign: p.degInSign,
          retrograde: p.retrograde,
        }));

  return (
    <section className="mx-auto max-w-2xl space-y-6">
      <div className="motion-fade-up flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Link
            to="/people"
            aria-label={t("people.detail.back")}
            className="tap-press flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowLeft size={18} aria-hidden="true" />
          </Link>
          <div className="min-w-0">
            <h1 className="truncate font-display text-2xl leading-tight tracking-tight text-foreground sm:text-3xl">
              {bundle?.person.full_name ?? "…"}
            </h1>
            {bundle && (
              <p className="text-xs text-muted-foreground">
                {RELATIONS.includes(bundle.person.relation as Relation)
                  ? t(`people.relations.${bundle.person.relation}`)
                  : bundle.person.relation}
              </p>
            )}
          </div>
        </div>
        <Link
          to="/people/$id/edit"
          params={{ id }}
          aria-label={t("people.edit.title")}
          className="tap-press flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Pencil size={16} aria-hidden="true" />
        </Link>
      </div>

      {loading && <div className="h-40 animate-pulse rounded-2xl border border-border bg-card" />}

      {!loading && errorCode && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
          <p className="text-sm text-foreground">
            {errorCode === "missing_coordinates"
              ? t("people.detail.missingCoords")
              : t("people.detail.loadError")}
          </p>
        </div>
      )}

      {!loading && bundle && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <BasicStat label={t("people.detail.ascendant")} value={bundle.basic.ascendant?.name} />
            <BasicStat
              label={t("people.detail.moon")}
              value={bundle.basic.moon?.name}
              sub={
                bundle.basic.moon?.nakshatra
                  ? `${bundle.basic.moon.nakshatra.name} · ${bundle.basic.moon.nakshatra.pada}`
                  : undefined
              }
            />
            <BasicStat label={t("people.detail.sun")} value={bundle.basic.sun?.name} />
          </div>

          {COMPAT_RELATIONS.includes(bundle.person.relation) && (
            <Link
              to="/people/$id/compatibility"
              params={{ id }}
              className="tap-press flex min-h-11 w-full items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-left transition-colors hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              style={{ boxShadow: "var(--shadow-soft)" }}
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
                <Heart size={18} aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">
                  {t("people.detail.compatibility")}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {t("people.detail.compatibilityHint")}
                </span>
              </span>
            </Link>
          )}

          <div
            className="rounded-2xl border border-border bg-card p-5"
            style={{ boxShadow: "var(--shadow-soft)" }}
          >
            <div className="mb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-foreground">
                {t("people.detail.chartsTitle")}
              </h2>
              <div className="w-full min-w-0 sm:w-auto">
                <label htmlFor="person-varga-select" className="sr-only">
                  {t("home.varga.pickerLabel")}
                </label>
                <select
                  id="person-varga-select"
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

            {svg && (
              <ChartFrame>
                <div
                  className="[&_svg]:block [&_svg]:h-auto [&_svg]:w-full [&_svg]:max-w-full [&_svg_line]:stroke-primary [&_svg_path]:stroke-primary [&_svg_rect]:stroke-primary [&_svg_polygon]:stroke-primary [&_svg_text]:fill-foreground"
                  dangerouslySetInnerHTML={{ __html: svg }}
                />
              </ChartFrame>
            )}

            {displayPlanets.length > 0 && (
              <ul className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {displayPlanets.map((p) => (
                  <li
                    key={p.key}
                    className="rounded-xl border border-border bg-background p-3 text-sm"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-foreground">
                        {t(`home.planets.${p.key}`)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {p.house != null ? t("home.houseLabel", { n: p.house }) : "—"}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {p.signName ? t(`signs.${p.signName}`, p.signName) : "—"}
                      {p.nakshatraName ? ` · ${p.nakshatraName}` : ""}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </section>
  );
}

function BasicStat({ label, value, sub }: { label: string; value?: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 text-center">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-lg text-foreground">{value ?? "—"}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}
