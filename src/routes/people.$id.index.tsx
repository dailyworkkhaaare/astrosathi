import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Clock3, Heart, MessageCircle, Orbit, Pencil, Sparkles } from "lucide-react";

import { useRequireOnboarding } from "@/lib/require-auth";
import { ChartFrame } from "@/components/chart/ChartFrame";
import { ErrorState } from "@/components/states/ErrorState";
import { LoadingState } from "@/components/states/LoadingState";
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
      <header className="motion-fade-up flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link
            to="/people"
            aria-label={t("people.detail.back")}
            className="tap-press flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowLeft size={18} aria-hidden="true" />
          </Link>
          <div className="min-w-0">
            <p className="as-micro text-primary">{t("people.detail.eyebrow")}</p>
            <h1 className="truncate font-display text-2xl leading-tight tracking-tight text-foreground sm:text-3xl">
              {bundle?.person.full_name ?? "…"}
            </h1>
            {bundle && (
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <span className="inline-flex rounded-full border border-accent/25 bg-accent/[0.08] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-accent">
                  {RELATIONS.includes(bundle.person.relation as Relation)
                    ? t(`people.relations.${bundle.person.relation}`)
                    : bundle.person.relation}
                </span>
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock3 size={12} aria-hidden="true" />
                  {bundle.person.birth_time_known
                    ? t("people.birthTimeKnown")
                    : t("people.birthTimeUnknown")}
                </span>
              </div>
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
      </header>

      {loading && (
        <LoadingState
          scope="panel"
          label={t("people.detail.loading")}
          description={t("people.detail.loadingBody")}
        />
      )}

      {!loading && errorCode && (
        <ErrorState
          scope="panel"
          title={t("people.detail.chartUnavailable")}
          description={
            errorCode === "missing_coordinates"
              ? t("people.detail.missingCoords")
              : t("people.detail.loadError")
          }
          onRetry={() => void query.refetch()}
        />
      )}

      {!loading && bundle && (
        <>
          <section className="motion-fade-up relative isolate overflow-hidden rounded-[1.75rem] border border-primary/20 bg-card p-5 shadow-[var(--shadow-card)] sm:p-6">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 opacity-80"
              style={{
                background:
                  "radial-gradient(60% 85% at 0% 0%, color-mix(in oklab, var(--primary) 13%, transparent), transparent 74%), radial-gradient(45% 70% at 100% 100%, color-mix(in oklab, var(--accent) 12%, transparent), transparent 76%)",
              }}
            />
            <div className="relative flex items-start gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20">
                <Orbit size={19} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="as-micro text-primary">{t("people.detail.chartEyebrow")}</p>
                <h2 className="mt-1 font-display text-xl leading-tight text-foreground">
                  {t("people.detail.chartTitle", { name: bundle.person.full_name })}
                </h2>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {bundle.person.birth_time_known
                    ? t("people.detail.chartReady")
                    : t("people.detail.chartLimited")}
                </p>
              </div>
            </div>
          </section>

          <section aria-labelledby="person-placements-title" className="space-y-3">
            <div className="flex items-end justify-between gap-3 px-1">
              <div>
                <p className="as-micro text-muted-foreground">
                  {t("people.detail.placementsEyebrow")}
                </p>
                <h2
                  id="person-placements-title"
                  className="mt-1 text-lg font-semibold text-foreground"
                >
                  {t("people.detail.placementsTitle")}
                </h2>
              </div>
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Sparkles size={13} aria-hidden="true" />
                {t("people.detail.placementsSource")}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3">
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
              <BasicStat
                label={t("people.detail.ascendant")}
                value={bundle.basic.ascendant?.name}
              />
            </div>
          </section>

          <section aria-labelledby="person-actions-title" className="space-y-3">
            <div className="px-1">
              <p className="as-micro text-muted-foreground">{t("people.detail.actionsEyebrow")}</p>
              <h2 id="person-actions-title" className="mt-1 text-lg font-semibold text-foreground">
                {t("people.detail.actionsTitle")}
              </h2>
            </div>
            <div className="overflow-hidden rounded-[1.5rem] border border-border bg-card shadow-[var(--shadow-card)]">
              <Link
                to="/chat"
                search={{
                  seed: t("chat.subjectSeed", { name: bundle.person.full_name }),
                  subjectRelatedChartId: id,
                }}
                className="tap-press flex min-h-[4.75rem] w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-primary/[0.06] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20">
                  <MessageCircle size={18} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground">
                    {t("people.detail.askAstrologer", { name: bundle.person.full_name })}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {t("people.detail.askAstrologerHint")}
                  </span>
                </span>
              </Link>

              {COMPAT_RELATIONS.includes(bundle.person.relation) ? (
                <Link
                  to="/people/$id/compatibility"
                  params={{ id }}
                  className="tap-press flex min-h-[4.75rem] w-full items-center gap-3 border-t border-border/60 px-4 py-3.5 text-left transition-colors hover:bg-accent/[0.06] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent/10 text-accent ring-1 ring-accent/20">
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
              ) : (
                <div className="border-t border-border/60 px-4 py-3.5">
                  <p className="text-sm font-medium text-foreground">
                    {t("people.detail.compatibilityUnavailable")}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {t("people.detail.compatibilityUnavailableHint")}
                  </p>
                </div>
              )}
            </div>
          </section>

          <section
            aria-labelledby="person-timing-title"
            className="flex gap-3 rounded-[1.5rem] border border-border bg-muted/45 p-4"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-background text-muted-foreground ring-1 ring-border">
              <Clock3 size={17} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="as-micro text-muted-foreground">{t("people.detail.timingEyebrow")}</p>
              <h2 id="person-timing-title" className="mt-1 text-base font-semibold text-foreground">
                {t("people.detail.timingTitle")}
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {t("people.detail.timingUnavailable")}
              </p>
            </div>
          </section>

          <section
            aria-labelledby="person-chart-title"
            className="rounded-[1.5rem] border border-border bg-card p-5 shadow-[var(--shadow-card)]"
          >
            <div className="mb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="as-micro text-muted-foreground">{t("people.detail.chartsEyebrow")}</p>
                <h2 id="person-chart-title" className="mt-1 text-lg font-semibold text-foreground">
                  {t("people.detail.chartsTitle")}
                </h2>
              </div>
              <div className="w-full min-w-0 sm:w-auto">
                <label htmlFor="person-varga-select" className="sr-only">
                  {t("home.varga.pickerLabel")}
                </label>
                <select
                  id="person-varga-select"
                  value={varga}
                  onChange={(e) => setVarga(e.target.value as VargaKey)}
                  className="h-11 w-full max-w-full truncate rounded-xl border border-border bg-background px-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-auto"
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
          </section>
        </>
      )}
    </section>
  );
}

function BasicStat({ label, value, sub }: { label: string; value?: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3.5 text-center shadow-[var(--shadow-card)]">
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 font-display text-lg text-foreground">{value ?? "—"}</div>
      {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}
