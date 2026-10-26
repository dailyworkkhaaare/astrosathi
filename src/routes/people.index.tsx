import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ChevronRight, Heart, MessageCircle, Orbit, Plus, Users } from "lucide-react";

import { AstroArt } from "@/components/AstroArt";
import { useAuthSession } from "@/lib/auth";
import { useRequireOnboarding } from "@/lib/require-auth";
import { triggerHaptic } from "@/lib/native-device";
import { usePlanets, useRelatedCharts } from "@/lib/queries";
import {
  COMPAT_RELATIONS,
  RELATIONS,
  RELATED_CHARTS_LIMIT,
  type Relation,
} from "@/lib/related-charts";

export const Route = createFileRoute("/people/")({
  head: () => ({
    meta: [
      { title: "People — AstroSaathi" },
      {
        name: "description",
        content: "Charts for the people in your life — family, partners and friends.",
      },
    ],
  }),
  component: PeoplePage,
});

function PeoplePage() {
  useRequireOnboarding();
  const { t, i18n } = useTranslation();
  const { user } = useAuthSession();
  const { data: people, isPending } = useRelatedCharts();
  const planetsQuery = usePlanets();
  const moonSign =
    planetsQuery.data?.planets.find((planet) => planet.key === "moon")?.signKey ?? null;

  const count = people?.length ?? 0;
  const atLimit = count >= RELATED_CHARTS_LIMIT;
  const dateLocale = i18n.language === "en" ? "en-IN" : i18n.language;
  const selfName = user?.name?.trim() || t("people.myself");

  return (
    <section className="mx-auto max-w-2xl">
      <header className="motion-fade-up flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[0.8125rem] font-semibold tracking-[0.04em] text-muted-foreground">
            {t("people.circleEyebrow")}
          </p>
          <h1 className="large-title mt-0.5 text-foreground">{t("nav.people")}</h1>
        </div>
        {!atLimit && count > 0 ? (
          <Link
            to="/people/new"
            aria-label={t("people.addPerson")}
            onClick={() => void triggerHaptic("selection")}
            className="tap-press mb-0.5 grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent/15 text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Plus size={20} aria-hidden="true" />
          </Link>
        ) : null}
      </header>

      <section aria-labelledby="people-self-title" className="motion-fade-up mt-5">
        <h2 id="people-self-title" className="sr-only">
          {t("people.myChart")}
        </h2>
        <Link
          to="/home"
          onClick={() => void triggerHaptic("selection")}
          className="tap-press flex min-h-[4.25rem] w-full items-center gap-3.5 rounded-[1.25rem] bg-card px-4 py-3 text-left shadow-[var(--as-elevation-1)] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {moonSign ? (
            <AstroArt kind="sign" name={moonSign} size={44} priority />
          ) : (
            <span
              aria-hidden="true"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent/15 text-lg font-semibold text-accent"
            >
              {(selfName[0] ?? "?").toUpperCase()}
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[1.0625rem] font-semibold text-foreground">
              {selfName}
            </span>
            <span className="block truncate text-[0.8125rem] text-muted-foreground">
              {t("people.myselfHint")}
            </span>
          </span>
          <ChevronRight size={18} aria-hidden="true" className="shrink-0 text-muted-foreground" />
        </Link>
      </section>

      <section aria-labelledby="people-list-title" className="mt-7">
        <div className="mb-2 flex items-baseline justify-between gap-3 px-4">
          <h2
            id="people-list-title"
            className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground [:lang(hi)_&]:tracking-normal [:lang(mr)_&]:tracking-normal"
          >
            {t("people.savedPeople")}
          </h2>
          <p className="shrink-0 text-xs tabular-nums text-muted-foreground">
            {t("people.count", { count, limit: RELATED_CHARTS_LIMIT })}
          </p>
        </div>

        {isPending ? (
          <div
            role="status"
            aria-label={t("people.loading")}
            className="space-y-px overflow-hidden rounded-[0.875rem]"
          >
            {[0, 1].map((i) => (
              <div key={i} className="h-[6.5rem] motion-safe:animate-pulse bg-card" />
            ))}
          </div>
        ) : count === 0 ? (
          <div
            data-state="empty"
            className="flex flex-col items-center gap-1.5 rounded-[1.25rem] bg-card px-6 py-8 text-center shadow-[var(--as-elevation-1)]"
          >
            <span className="mb-2 grid h-11 w-11 place-items-center rounded-[0.875rem] bg-accent/12 text-accent">
              <Users size={20} aria-hidden="true" />
            </span>
            <h3 className="text-base font-semibold text-foreground">{t("people.emptyTitle")}</h3>
            <p className="max-w-xs text-[0.8125rem] leading-snug text-muted-foreground">
              {t("people.empty")}
            </p>
            <Link
              to="/people/new"
              onClick={() => void triggerHaptic("selection")}
              className="tap-press mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-full bg-accent/15 px-5 text-sm font-semibold text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Plus size={16} aria-hidden="true" />
              {t("people.addPerson")}
            </Link>
          </div>
        ) : (
          <ul
            aria-label={t("people.listAria", { count })}
            className="list-hairline overflow-hidden rounded-[0.875rem] border border-[var(--as-list-separator)] bg-card shadow-[var(--as-elevation-1)] [--list-inset:4.25rem]"
          >
            {(people ?? []).map((p) => {
              const relation = RELATIONS.includes(p.relation as Relation)
                ? t(`people.relations.${p.relation}`)
                : p.relation;
              const born = new Date(`${p.birth_date}T12:00:00`);
              const bornLabel = Number.isNaN(born.getTime())
                ? null
                : born.toLocaleDateString(dateLocale, {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  });
              return (
                <li key={p.id}>
                  <Link
                    to="/people/$id"
                    params={{ id: p.id }}
                    onClick={() => void triggerHaptic("selection")}
                    className="tap-press flex min-h-[3.75rem] w-full items-center gap-3.5 px-4 pb-0.5 pt-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  >
                    <span
                      aria-hidden="true"
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent/12 text-base font-semibold text-accent"
                    >
                      {(p.full_name.trim()[0] ?? "?").toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-base font-semibold text-foreground">
                        {p.full_name}
                      </span>
                      <span className="block truncate text-[0.8125rem] text-muted-foreground">
                        {[relation, bornLabel].filter(Boolean).join(" · ")}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground/80">
                        {p.birth_time_known
                          ? t("people.birthTimeKnown")
                          : t("people.birthTimeUnknown")}
                      </span>
                    </span>
                    <ChevronRight
                      size={18}
                      aria-hidden="true"
                      className="shrink-0 text-muted-foreground"
                    />
                  </Link>

                  <div
                    aria-label={t("people.quickActions.label")}
                    className="flex flex-wrap items-center gap-0.5 pb-1.5 pl-[3.625rem] pr-3"
                  >
                    <Link
                      to="/people/$id"
                      params={{ id: p.id }}
                      aria-label={t("people.quickActions.chartFor", { name: p.full_name })}
                      onClick={() => void triggerHaptic("selection")}
                      className={QUICK_ACTION + " text-muted-foreground hover:text-foreground"}
                    >
                      <Orbit size={15} aria-hidden="true" />
                      {t("people.quickActions.chart")}
                    </Link>
                    <Link
                      to="/chat"
                      search={{
                        seed: t("chat.subjectSeed", { name: p.full_name }),
                        subjectRelatedChartId: p.id,
                      }}
                      aria-label={t("people.quickActions.askAbout", { name: p.full_name })}
                      onClick={() => void triggerHaptic("selection")}
                      className={QUICK_ACTION + " text-[var(--as-color-action-ask)]"}
                    >
                      <MessageCircle size={15} aria-hidden="true" />
                      {t("people.quickActions.ask")}
                    </Link>
                    {COMPAT_RELATIONS.includes(p.relation) ? (
                      <Link
                        to="/people/$id/compatibility"
                        params={{ id: p.id }}
                        aria-label={t("people.quickActions.compatibilityWith", {
                          name: p.full_name,
                        })}
                        onClick={() => void triggerHaptic("selection")}
                        className={QUICK_ACTION + " text-accent"}
                      >
                        <Heart size={15} aria-hidden="true" />
                        {t("people.quickActions.compatibility")}
                      </Link>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {atLimit ? (
          <p className="mt-2 px-4 text-xs text-muted-foreground">{t("people.limitHint")}</p>
        ) : null}
      </section>

      {count > 0 ? (
        <p className="mt-4 text-center text-xs text-muted-foreground">{t("people.separateNote")}</p>
      ) : null}
    </section>
  );
}

const QUICK_ACTION =
  "tap-press inline-flex min-h-11 items-center gap-1.5 rounded-full px-2.5 text-[0.8125rem] font-semibold transition-colors hover:bg-foreground/[0.05] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring";
