import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Heart,
  MessageCircle,
} from "lucide-react";

import { useRequireOnboarding } from "@/lib/require-auth";
import { AstroArt } from "@/components/AstroArt";
import { ChartFrame } from "@/components/chart/ChartFrame";
import { grahaArtByName, signArtByIndex } from "@/lib/astro-art";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
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
  const { t, i18n } = useTranslation();
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

  const person = bundle?.person ?? null;
  const relationLabel = person
    ? RELATIONS.includes(person.relation as Relation)
      ? t(`people.relations.${person.relation}`)
      : person.relation
    : "";
  const born = person ? new Date(`${person.birth_date}T12:00:00`) : null;
  const bornLabel =
    born && !Number.isNaN(born.getTime())
      ? born.toLocaleDateString(i18n.language === "en" ? "en-IN" : i18n.language, {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : null;
  const moonArt = signArtByIndex(bundle?.basic.moon?.sign);
  const placements = bundle
    ? [
        { key: "ascendant", label: t("people.detail.ascendant"), info: bundle.basic.ascendant },
        {
          key: "moon",
          label: bundle.basic.moon?.nakshatra
            ? `${t("people.detail.moon")} · ${bundle.basic.moon.nakshatra.name}`
            : t("people.detail.moon"),
          info: bundle.basic.moon,
        },
        { key: "sun", label: t("people.detail.sun"), info: bundle.basic.sun },
      ]
    : [];

  return (
    <section className="mx-auto max-w-2xl">
      <nav className="motion-fade-up -mx-2 -mt-2 flex min-h-11 items-center justify-between">
        <Link
          to="/people"
          className="tap-press inline-flex min-h-11 items-center gap-0.5 rounded-full pl-1 pr-3 text-[1.0625rem] text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronLeft size={22} aria-hidden="true" />
          {t("people.detail.back")}
        </Link>
        <Link
          to="/people/$id/edit"
          params={{ id }}
          aria-label={t("people.edit.title")}
          className="tap-press inline-flex min-h-11 items-center rounded-full px-3 text-[1.0625rem] text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t("people.detail.edit")}
        </Link>
      </nav>

      <header className="motion-fade-up mt-2 flex flex-col items-center gap-1.5 text-center">
        {moonArt ? (
          <AstroArt kind="sign" name={moonArt} size={84} priority />
        ) : (
          <span
            aria-hidden="true"
            className="grid h-[5.25rem] w-[5.25rem] place-items-center rounded-full bg-accent/15 text-3xl font-semibold text-accent"
          >
            {((person?.full_name ?? "").trim()[0] ?? "·").toUpperCase()}
          </span>
        )}
        <h1 className="mt-1 font-display text-[1.75rem] font-semibold leading-tight text-foreground">
          {person?.full_name ?? "…"}
        </h1>
        {person && (
          <p className="text-[0.9375rem] text-muted-foreground">
            {[relationLabel, bornLabel, person.birth_place_label].filter(Boolean).join(" · ")}
          </p>
        )}
        {bundle && !bundle.person.birth_time_known && (
          <p className="inline-flex items-center gap-1.5 text-xs text-feedback-warning">
            <Clock3 size={13} aria-hidden="true" />
            {t("people.detail.timeUnknownShort")}
          </p>
        )}
      </header>

      {loading && (
        <div className="mt-6">
          <LoadingState
            scope="panel"
            label={t("people.detail.loading")}
            description={t("people.detail.loadingBody")}
          />
        </div>
      )}

      {!loading && errorCode && (
        <div className="mt-6">
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
        </div>
      )}

      {!loading && bundle && (
        <>
          <section aria-labelledby="person-placements-title" className="motion-fade-up mt-7">
            <h2 id="person-placements-title" className={SECTION_LABEL}>
              {t("people.detail.placementsTitle")}
            </h2>
            <dl className="list-hairline overflow-hidden rounded-[0.875rem] bg-card shadow-[var(--as-elevation-1)] [--list-inset:4.5rem]">
              {placements.map(({ key, label, info }) => {
                const art = signArtByIndex(info?.sign);
                const signLabel = art ? t(`signs.${art}`) : (info?.name ?? "—");
                return (
                  <div key={key} className="flex min-h-16 items-center gap-3.5 px-4 py-2">
                    {art ? (
                      <AstroArt kind="sign" name={art} size={40} />
                    ) : (
                      <span className="h-10 w-10 shrink-0" aria-hidden="true" />
                    )}
                    <div className="min-w-0 flex-1">
                      <dt className="text-xs text-muted-foreground">{label}</dt>
                      <dd className="text-[1.0625rem] font-semibold text-foreground">
                        {signLabel}
                      </dd>
                    </div>
                  </div>
                );
              })}
            </dl>
          </section>

          <section aria-labelledby="person-actions-title" className="motion-fade-up mt-7">
            <h2 id="person-actions-title" className={SECTION_LABEL}>
              {t("people.detail.explore")}
            </h2>
            <ul className="list-hairline overflow-hidden rounded-[0.875rem] bg-card shadow-[var(--as-elevation-1)] [--list-inset:4rem]">
              <li>
                {COMPAT_RELATIONS.includes(bundle.person.relation) ? (
                  <Link
                    to="/people/$id/compatibility"
                    params={{ id }}
                    className="tap-press flex min-h-[3.75rem] items-center gap-3.5 px-4 py-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  >
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[0.625rem] bg-accent/12 text-accent">
                      <Heart size={17} aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[1.0625rem] text-foreground">
                        {t("people.detail.compatibility")}
                      </span>
                      <span className="block text-[0.8125rem] text-muted-foreground">
                        {t("people.detail.compatibilityHint")}
                      </span>
                    </span>
                    <ChevronRight
                      size={16}
                      className="shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                  </Link>
                ) : (
                  <div className="flex min-h-[3.75rem] items-center gap-3.5 px-4 py-2.5">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[0.625rem] bg-foreground/[0.06] text-muted-foreground">
                      <Heart size={17} aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[1.0625rem] text-muted-foreground">
                        {t("people.detail.compatibilityUnavailable")}
                      </span>
                      <span className="block text-[0.8125rem] text-muted-foreground">
                        {t("people.detail.compatibilityUnavailableHint")}
                      </span>
                    </span>
                  </div>
                )}
              </li>
              <li>
                <Link
                  to="/chat"
                  search={{
                    seed: t("chat.subjectSeed", { name: bundle.person.full_name }),
                    subjectRelatedChartId: id,
                  }}
                  className="tap-press flex min-h-[3.75rem] items-center gap-3.5 px-4 py-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[0.625rem] bg-[color-mix(in_oklab,var(--as-color-action-ask)_18%,transparent)] text-[var(--as-color-action-ask)]">
                    <MessageCircle size={17} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[1.0625rem] text-foreground">
                      {t("people.detail.askAstrologer", { name: bundle.person.full_name })}
                    </span>
                    <span className="block text-[0.8125rem] text-muted-foreground">
                      {t("people.detail.askAstrologerHint")}
                    </span>
                  </span>
                  <ChevronRight
                    size={16}
                    className="shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                </Link>
              </li>
            </ul>
          </section>

          <section aria-labelledby="person-chart-title" className="motion-fade-up mt-7">
            <div className="mb-2 flex items-center justify-between gap-3 pl-4">
              <h2 id="person-chart-title" className={SECTION_LABEL.replace("px-4 pb-2 ", "")}>
                {t("people.detail.chartsTitle")}
              </h2>
              <PersonVargaPicker current={varga} onSelect={setVarga} />
            </div>

            {svg && (
              <div className="rounded-[1.25rem] bg-card p-3 shadow-[var(--as-elevation-1)]">
                <ChartFrame>
                  <div
                    className="[&_svg]:block [&_svg]:h-auto [&_svg]:w-full [&_svg]:max-w-full [&_svg_line]:stroke-primary [&_svg_path]:stroke-primary [&_svg_rect]:stroke-primary [&_svg_polygon]:stroke-primary [&_svg_text]:fill-foreground"
                    dangerouslySetInnerHTML={{ __html: svg }}
                  />
                </ChartFrame>
              </div>
            )}

            {displayPlanets.length > 0 && (
              <ul className="list-hairline mt-3 overflow-hidden rounded-[0.875rem] bg-card shadow-[var(--as-elevation-1)] [--list-inset:4.5rem]">
                {displayPlanets.map((p) => {
                  const art = grahaArtByName(p.key);
                  return (
                    <li key={p.key} className="flex min-h-14 items-center gap-3.5 px-4 py-2">
                      {art ? (
                        <AstroArt kind="graha" name={art} size={40} />
                      ) : (
                        <span className="h-10 w-10 shrink-0" aria-hidden="true" />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block text-base font-semibold text-foreground">
                          {t(`home.planets.${p.key}`)}
                          {p.retrograde && (
                            <span className="ml-2 rounded-md bg-accent/15 px-1.5 py-0.5 text-xs font-medium text-accent">
                              {t("home.retroShort")}
                            </span>
                          )}
                        </span>
                        <span className="block truncate text-[0.8125rem] text-muted-foreground">
                          {p.signName ? t(`signs.${p.signName}`, p.signName) : "—"}
                          {p.nakshatraName ? ` · ${p.nakshatraName}` : ""}
                        </span>
                      </span>
                      <span className="shrink-0 text-sm text-muted-foreground">
                        {p.house != null ? t("home.houseLabel", { n: p.house }) : "—"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}
    </section>
  );
}

const SECTION_LABEL =
  "px-4 pb-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground [:lang(hi)_&]:tracking-normal [:lang(mr)_&]:tracking-normal";

function PersonVargaPicker({
  current,
  onSelect,
}: {
  current: VargaKey;
  onSelect: (varga: VargaKey) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const currentLabel = t(`home.varga.${current.toLowerCase()}`);

  return (
    <div className="min-w-0 shrink-0">
      <div className="sm:hidden">
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerTrigger asChild>
            <button
              type="button"
              aria-label={t("home.varga.pickerLabel")}
              className="tap-press inline-flex min-h-11 max-w-[13rem] items-center gap-1.5 rounded-full bg-foreground/[0.07] pl-3.5 pr-2.5 text-sm font-semibold text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="min-w-0 truncate">{currentLabel}</span>
              <ChevronDown
                size={16}
                className="shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
            </button>
          </DrawerTrigger>
          <DrawerContent
            aria-label={t("home.varga.pickerLabel")}
            className="bg-background sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:max-h-[min(42rem,calc(100dvh-2rem))] sm:w-full sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl"
          >
            <DrawerHeader className="px-5 pb-4 pt-5 text-left">
              <DrawerTitle className="text-[1.0625rem] font-semibold">
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
                        setOpen(false);
                      }}
                      className={
                        "tap-press flex min-h-12 w-full items-center justify-between gap-3 rounded-[0.875rem] px-4 text-left text-[0.9375rem] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
                        (selected
                          ? "bg-accent/12 font-semibold text-foreground"
                          : "bg-card text-foreground shadow-[var(--as-elevation-1)]")
                      }
                    >
                      <span>{t(`home.varga.${key.toLowerCase()}`)}</span>
                      {selected && (
                        <Check size={16} className="shrink-0 text-accent" aria-hidden="true" />
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
        <label htmlFor="person-varga-select" className="sr-only">
          {t("home.varga.pickerLabel")}
        </label>
        <select
          id="person-varga-select"
          value={current}
          onChange={(event) => onSelect(event.target.value as VargaKey)}
          className="h-11 max-w-[16rem] truncate rounded-full bg-foreground/[0.07] px-4 text-sm font-semibold text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
