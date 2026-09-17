import { createFileRoute, Link } from "@tanstack/react-router";
import { BookHeart, CalendarDays, History, Orbit, Plus, Sparkles } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { EmptyState } from "@/components/states/EmptyState";
import { ErrorState } from "@/components/states/ErrorState";
import { useRequireOnboarding } from "@/lib/require-auth";
import { useDasha, useJournal, useLifeEvents, useSentNudges } from "@/lib/queries";
import type { JournalEntry } from "@/lib/journal";
import type { LifeEvent } from "@/lib/life-events";
import type { ProactiveNudge } from "@/lib/proactive";

export const Route = createFileRoute("/journey")({
  head: () => ({
    meta: [
      { title: "Journey — AstroSaathi" },
      {
        name: "description",
        content: "A reflective history of your life events, journal and guidance.",
      },
      { property: "og:title", content: "Journey — AstroSaathi" },
      {
        property: "og:description",
        content: "A reflective history of your life events, journal and guidance.",
      },
    ],
  }),
  component: JourneyPage,
});

function parseLocalDate(dateStr: string): Date | null {
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function dateValue(dateStr: string): number {
  return parseLocalDate(dateStr)?.getTime() ?? 0;
}

function formatLifeEventDate(event: LifeEvent, locale: string, approximateLabel: string): string {
  const date = parseLocalDate(event.event_date);
  if (!date) return event.event_date;
  if (event.date_precision === "year") return String(date.getFullYear());
  if (event.date_precision === "month") {
    return date.toLocaleDateString(locale, { month: "long", year: "numeric" });
  }
  const formatted = date.toLocaleDateString(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return event.date_precision === "approx" ? `${formatted} · ${approximateLabel}` : formatted;
}

function formatPeriodRange(start: string, end: string, locale: string): string {
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return "";
  const options: Intl.DateTimeFormatOptions = { month: "short", year: "numeric" };
  return `${startDate.toLocaleDateString(locale, options)} – ${endDate.toLocaleDateString(locale, options)}`;
}

function excerpt(value: string, max = 150): string {
  const trimmed = value.trim();
  return trimmed.length > max ? `${trimmed.slice(0, max).trimEnd()}…` : trimmed;
}

function JourneyPage() {
  useRequireOnboarding();
  const { t, i18n } = useTranslation();
  const lifeQuery = useLifeEvents();
  const journalQuery = useJournal();
  const dashaQuery = useDasha();
  const nudgesQuery = useSentNudges();

  const latestEvent = useMemo(() => {
    const events = lifeQuery.data ?? [];
    return events.reduce<LifeEvent | null>(
      (latest, event) =>
        !latest || dateValue(event.event_date) > dateValue(latest.event_date) ? event : latest,
      null,
    );
  }, [lifeQuery.data]);
  const latestEntry = journalQuery.data?.[0] ?? null;
  const latestNudge = nudgesQuery.data?.[0] ?? null;
  const currentPeriod = useMemo(() => {
    const now = Date.now();
    return (
      dashaQuery.data?.periods.find((period) => {
        const start = Date.parse(period.start);
        const end = Date.parse(period.end);
        return Number.isFinite(start) && Number.isFinite(end) && start <= now && now <= end;
      }) ?? null
    );
  }, [dashaQuery.data?.periods]);

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <header className="motion-fade-up relative isolate overflow-hidden rounded-[2rem] border border-border bg-card p-6 shadow-[var(--shadow-soft)] sm:p-8">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-20 -top-24 -z-10 h-64 w-64 rounded-full bg-accent/10 blur-3xl"
        />
        <div className="flex items-start gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-accent/15 text-accent ring-1 ring-accent/25">
            <History size={22} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {t("journey.eyebrow")}
            </p>
            <h1 className="mt-2 font-display text-3xl leading-tight tracking-tight text-foreground sm:text-4xl">
              {t("journey.title")}
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              {t("journey.subtitle")}
            </p>
          </div>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Link
            to="/life"
            className="tap-press flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Plus size={16} aria-hidden="true" />
            {t("journey.actions.addEvent")}
          </Link>
          <Link
            to="/journal"
            className="tap-press flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <BookHeart size={16} aria-hidden="true" />
            {t("journey.actions.writeReflection")}
          </Link>
        </div>
      </header>

      <section aria-labelledby="journey-current-chapter" className="space-y-3">
        <div className="flex items-center justify-between gap-3 px-1">
          <h2
            id="journey-current-chapter"
            className="font-display text-xl font-semibold tracking-tight text-foreground"
          >
            {t("journey.currentChapter")}
          </h2>
          <Link
            to="/life"
            className="tap-press inline-flex min-h-10 items-center rounded-md px-2 text-xs font-semibold text-primary underline-offset-4 hover:bg-muted hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t("journey.viewTimeline")}
          </Link>
        </div>
        {dashaQuery.isLoading ? (
          <LoadingModule label={t("journey.loading")} />
        ) : dashaQuery.isError || dashaQuery.data?.error ? (
          <ErrorState
            scope="inline"
            title={t("journey.moduleError")}
            description={t("journey.moduleErrorBody")}
            onRetry={() => void dashaQuery.refetch()}
          />
        ) : currentPeriod ? (
          <div className="motion-fade-up flex items-center gap-4 rounded-[1.5rem] border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
              <Orbit size={20} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {t("journey.currentChapterHint")}
              </p>
              <p className="mt-1 truncate font-display text-xl font-semibold text-foreground">
                {currentPeriod.name}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {formatPeriodRange(currentPeriod.start, currentPeriod.end, i18n.language)}
              </p>
            </div>
          </div>
        ) : (
          <EmptyState
            scope="inline"
            title={t("journey.noCurrentChapter")}
            description={t("journey.noCurrentChapterBody")}
            icon={<Orbit size={19} aria-hidden="true" />}
          />
        )}
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard
          title={t("journey.timeline.title")}
          description={t("journey.timeline.hint")}
          icon={<CalendarDays size={18} aria-hidden="true" />}
          to="/life"
          linkLabel={t("journey.viewTimeline")}
          loading={lifeQuery.isLoading}
          error={lifeQuery.isError}
          onRetry={() => void lifeQuery.refetch()}
          empty={!latestEvent}
          emptyTitle={t("journey.timeline.empty")}
          errorTitle={t("journey.moduleError")}
          errorDescription={t("journey.moduleErrorBody")}
        >
          {latestEvent ? (
            <>
              <p className="font-display text-lg font-semibold text-foreground">
                {latestEvent.title}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {formatLifeEventDate(latestEvent, i18n.language, t("journey.approximate"))}
              </p>
            </>
          ) : null}
        </SummaryCard>

        <SummaryCard
          title={t("journey.journal.title")}
          description={t("journey.journal.hint")}
          icon={<BookHeart size={18} aria-hidden="true" />}
          to="/journal"
          linkLabel={t("journey.viewJournal")}
          loading={journalQuery.isLoading}
          error={journalQuery.isError}
          onRetry={() => void journalQuery.refetch()}
          empty={!latestEntry}
          emptyTitle={t("journey.journal.empty")}
          errorTitle={t("journey.moduleError")}
          errorDescription={t("journey.moduleErrorBody")}
        >
          {latestEntry ? <JournalSummary entry={latestEntry} /> : null}
        </SummaryCard>

        <SummaryCard
          title={t("journey.guidance.title")}
          description={t("journey.guidance.hint")}
          icon={<Sparkles size={18} aria-hidden="true" />}
          to="/nudges"
          linkLabel={t("journey.viewGuidance")}
          loading={nudgesQuery.isLoading}
          error={nudgesQuery.isError}
          onRetry={() => void nudgesQuery.refetch()}
          empty={!latestNudge}
          emptyTitle={t("journey.guidance.empty")}
          errorTitle={t("journey.moduleError")}
          errorDescription={t("journey.moduleErrorBody")}
        >
          {latestNudge ? <NudgeSummary nudge={latestNudge} /> : null}
        </SummaryCard>
      </div>
    </section>
  );
}

function LoadingModule({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-label={label}
      className="h-24 animate-pulse rounded-[1.5rem] border border-border bg-card"
    />
  );
}

function SummaryCard({
  title,
  description,
  icon,
  to,
  linkLabel,
  loading,
  error,
  onRetry,
  empty,
  emptyTitle,
  errorTitle,
  errorDescription,
  children,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  to: "/life" | "/journal" | "/nudges";
  linkLabel: string;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  empty: boolean;
  emptyTitle: string;
  errorTitle: string;
  errorDescription: string;
  children: React.ReactNode;
}) {
  return (
    <article className="motion-fade-up flex min-h-64 flex-col rounded-[1.5rem] border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent">
          {icon}
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-lg font-semibold text-foreground">{title}</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="mt-5 flex-1">
        {loading ? (
          <div
            role="status"
            aria-label={description}
            className="h-20 animate-pulse rounded-xl bg-muted"
          />
        ) : error ? (
          <ErrorState
            scope="inline"
            title={errorTitle}
            description={errorDescription}
            onRetry={onRetry}
          />
        ) : empty ? (
          <EmptyState scope="inline" title={emptyTitle} icon={icon} />
        ) : (
          children
        )}
      </div>
      <Link
        to={to}
        className="tap-press mt-5 inline-flex min-h-11 items-center justify-between rounded-xl border border-border px-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {linkLabel}
        <span aria-hidden="true">→</span>
      </Link>
    </article>
  );
}

function JournalSummary({ entry }: { entry: JournalEntry }) {
  const { t } = useTranslation();
  return (
    <>
      <p className="font-display text-lg font-semibold text-foreground">
        {entry.title || t("journey.untitledReflection")}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{excerpt(entry.content)}</p>
      {entry.mood ? (
        <span className="mt-3 inline-flex rounded-full border border-accent/30 bg-accent/10 px-2 py-1 text-xs font-medium text-foreground">
          {t(`journal.moods.${entry.mood}`)}
        </span>
      ) : null}
    </>
  );
}

function NudgeSummary({ nudge }: { nudge: ProactiveNudge }) {
  return (
    <>
      <p className="font-display text-lg font-semibold text-foreground">{nudge.title}</p>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{excerpt(nudge.body)}</p>
    </>
  );
}
