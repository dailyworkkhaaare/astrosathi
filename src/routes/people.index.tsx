import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  ChevronRight,
  Clock3,
  Heart,
  MessageCircle,
  Orbit,
  Plus,
  Sparkles,
  UserRound,
  Users,
} from "lucide-react";

import { useRequireOnboarding } from "@/lib/require-auth";
import { triggerHaptic } from "@/lib/native-device";
import { useRelatedCharts } from "@/lib/queries";
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
  const { t } = useTranslation();
  const { data: people, isPending } = useRelatedCharts();

  const count = people?.length ?? 0;
  const atLimit = count >= RELATED_CHARTS_LIMIT;

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <header className="motion-fade-up flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="as-micro text-primary">{t("people.eyebrow")}</p>
          <h1 className="mt-2 font-display text-3xl leading-tight tracking-tight text-foreground sm:text-4xl">
            {t("people.title")}
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
            {t("people.subtitle")}
          </p>
        </div>
        {!atLimit && count > 0 ? (
          <Link
            to="/people/new"
            aria-label={t("people.addPerson")}
            onClick={() => void triggerHaptic("selection")}
            className="tap-press grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground shadow-[var(--shadow-soft)] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Plus size={18} aria-hidden="true" />
          </Link>
        ) : null}
      </header>

      <section className="motion-fade-up relative isolate overflow-hidden rounded-[1.5rem] border border-primary/20 bg-card p-4 shadow-[var(--shadow-card)] sm:rounded-[1.75rem] sm:p-6">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-80"
          style={{
            background:
              "radial-gradient(55% 105% at 0% 0%, color-mix(in oklab, var(--primary) 14%, transparent), transparent 70%), radial-gradient(45% 90% at 100% 100%, color-mix(in oklab, var(--accent) 12%, transparent), transparent 72%)",
          }}
        />
        <div className="relative flex items-start gap-3 sm:gap-4">
          <span
            className="relative mt-0.5 flex h-12 w-16 shrink-0 items-center sm:h-14 sm:w-[4.75rem]"
            aria-hidden="true"
          >
            <span className="absolute left-0 grid h-10 w-10 place-items-center rounded-full border border-primary/25 bg-primary/10 text-primary shadow-sm sm:h-12 sm:w-12">
              <UserRound size={19} />
            </span>
            <span className="absolute right-0 grid h-9 w-9 place-items-center rounded-full border border-accent/30 bg-accent/10 text-accent shadow-sm sm:h-10 sm:w-10">
              <Orbit size={17} />
            </span>
          </span>
          <div className="min-w-0">
            <p className="as-micro text-primary">{t("people.circleEyebrow")}</p>
            <h2 className="mt-1 font-display text-xl leading-tight text-foreground">
              {t("people.circleTitle")}
            </h2>
            <p className="mt-1 max-w-lg text-sm leading-relaxed text-muted-foreground sm:mt-1.5">
              {t("people.circleHint")}
            </p>
          </div>
        </div>
      </section>

      <section aria-labelledby="people-self-title" className="motion-fade-up">
        <h2 id="people-self-title" className="sr-only">
          {t("people.myself")}
        </h2>
        <Link
          to="/home"
          onClick={() => void triggerHaptic("selection")}
          className="tap-press flex w-full items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 text-left shadow-[var(--shadow-card)] transition-colors hover:border-primary/30 hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20">
            <Users size={18} aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {t("people.myChart")}
            </span>
            <span className="mt-0.5 block truncate text-sm font-semibold text-foreground">
              {t("people.myself")}
            </span>
            <span className="mt-0.5 block truncate text-xs text-muted-foreground">
              {t("people.myselfHint")}
            </span>
          </span>
          <ChevronRight size={16} aria-hidden="true" className="shrink-0 text-muted-foreground" />
        </Link>
      </section>

      <section aria-labelledby="people-list-title" className="space-y-3">
        <div className="flex items-end justify-between gap-3 px-1">
          <div>
            <p className="as-micro text-muted-foreground">{t("people.savedPeople")}</p>
            <h2 id="people-list-title" className="mt-1 text-lg font-semibold text-foreground">
              {t("people.savedPeopleTitle")}
            </h2>
          </div>
          <p className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
            {t("people.count", { count, limit: RELATED_CHARTS_LIMIT })}
          </p>
        </div>

        {isPending ? (
          <div className="rounded-[1.5rem] border border-border bg-card p-5 shadow-[var(--shadow-card)]">
            <ListSkeleton label={t("people.loading")} />
          </div>
        ) : count === 0 ? (
          <div className="rounded-[1.5rem] border border-dashed border-primary/30 bg-card p-6 text-center shadow-[var(--shadow-card)]">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-accent/10 text-accent ring-1 ring-accent/20">
              <Sparkles size={19} aria-hidden="true" />
            </span>
            <h3 className="mt-4 text-base font-semibold text-foreground">
              {t("people.emptyTitle")}
            </h3>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
              {t("people.empty")}
            </p>
            {!atLimit && <AddPersonLink className="mt-5" label={t("people.addPerson")} />}
          </div>
        ) : (
          <ul
            aria-label={t("people.listAria", { count })}
            className="overflow-hidden rounded-[1.25rem] border border-border bg-card shadow-[var(--shadow-card)] sm:grid sm:grid-cols-2 sm:gap-3 sm:overflow-visible sm:rounded-none sm:border-0 sm:bg-transparent sm:shadow-none"
          >
            {(people ?? []).map((p) => (
              <li key={p.id} className="border-b border-border/70 last:border-b-0 sm:border-0">
                <div className="overflow-hidden transition-colors hover:bg-muted/35 sm:rounded-[1.5rem] sm:border sm:border-border sm:bg-card sm:shadow-[var(--shadow-card)] sm:transition-all sm:hover:border-primary/35 sm:hover:shadow-[var(--shadow-elevated)] sm:hover:-translate-y-0.5 motion-reduce:transform-none">
                  <Link
                    to="/people/$id"
                    params={{ id: p.id }}
                    onClick={() => void triggerHaptic("selection")}
                    className="tap-press group flex min-h-[4.75rem] w-full items-start gap-3 px-3.5 py-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:min-h-[8.5rem] sm:p-4"
                  >
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20">
                      <span className="font-display text-lg">
                        {(p.full_name.trim()[0] ?? "?").toUpperCase()}
                      </span>
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col items-start">
                      <span className="inline-flex rounded-full border border-accent/25 bg-accent/[0.08] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-accent">
                        {RELATIONS.includes(p.relation as Relation)
                          ? t(`people.relations.${p.relation}`)
                          : p.relation}
                      </span>
                      <span className="mt-1.5 line-clamp-1 text-base font-semibold leading-snug text-foreground sm:mt-2 sm:line-clamp-2">
                        {p.full_name}
                      </span>
                      <span className="mt-auto flex items-center gap-1.5 pt-2 text-xs text-muted-foreground sm:pt-3">
                        <Clock3 size={13} aria-hidden="true" />
                        {p.birth_time_known
                          ? t("people.birthTimeKnown")
                          : t("people.birthTimeUnknown")}
                      </span>
                    </span>
                    <ChevronRight
                      size={16}
                      aria-hidden="true"
                      className="mt-1 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none"
                    />
                  </Link>

                  <div
                    aria-label={t("people.quickActions.label")}
                    className="grid grid-cols-3 border-t border-border/60"
                  >
                    <Link
                      to="/people/$id"
                      params={{ id: p.id }}
                      aria-label={t("people.quickActions.chartFor", { name: p.full_name })}
                      onClick={() => void triggerHaptic("selection")}
                      className="tap-press inline-flex min-h-11 items-center justify-center gap-1.5 border-r border-border/60 px-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                    >
                      <Orbit size={14} aria-hidden="true" />
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
                      className="tap-press inline-flex min-h-11 items-center justify-center gap-1.5 border-r border-border/60 px-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                    >
                      <MessageCircle size={14} aria-hidden="true" />
                      {t("people.quickActions.ask")}
                    </Link>
                    {COMPAT_RELATIONS.includes(p.relation) ? (
                      <Link
                        to="/people/$id/compatibility"
                        params={{ id: p.id }}
                        aria-label={t("people.quickActions.compatibilityWith", { name: p.full_name })}
                        onClick={() => void triggerHaptic("selection")}
                        className="tap-press inline-flex min-h-11 items-center justify-center gap-1.5 px-2 text-xs font-semibold text-accent transition-colors hover:bg-accent/[0.08] focus:outline-none focus-visible:bg-accent/[0.08] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                      >
                        <Heart size={14} aria-hidden="true" />
                        {t("people.quickActions.compatibility")}
                      </Link>
                    ) : (
                      <span className="inline-flex min-h-11 items-center justify-center gap-1.5 px-2 text-xs font-medium text-muted-foreground/50">
                        <Heart size={14} aria-hidden="true" />
                        {t("people.quickActions.compatibility")}
                      </span>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {atLimit ? (
        <p className="rounded-2xl border border-border bg-muted/45 px-4 py-3 text-center text-sm leading-relaxed text-muted-foreground">
          {t("people.limitReached")}
        </p>
      ) : (
        (count > 0 || isPending) && <AddPersonLink label={t("people.addPerson")} />
      )}
    </section>
  );
}

function AddPersonLink({ className, label }: { className?: string; label: string }) {
  return (
    <Link
      to="/people/new"
      onClick={() => void triggerHaptic("selection")}
      className={`tap-press flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-dashed border-primary/35 px-4 py-3 text-sm font-medium text-primary transition-colors hover:border-primary/60 hover:bg-primary/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${className ?? ""}`}
    >
      <Plus size={16} aria-hidden="true" />
      {label}
    </Link>
  );
}

function ListSkeleton({ label }: { label: string }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2" aria-label={label}>
      {Array.from({ length: 2 }).map((_, i) => (
        <div
          key={i}
          className="flex min-h-[8.5rem] animate-pulse items-start gap-3 rounded-2xl bg-muted/55 p-4"
        >
          <div className="h-11 w-11 shrink-0 rounded-2xl bg-primary/10" />
          <div className="flex min-w-0 flex-1 flex-col gap-2.5">
            <div className="h-4 w-16 rounded-full bg-accent/10" />
            <div className="h-4 w-32 max-w-full rounded bg-primary/10" />
            <div className="mt-auto h-3 w-24 rounded bg-primary/10" />
          </div>
        </div>
      ))}
    </div>
  );
}
