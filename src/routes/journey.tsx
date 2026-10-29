import { createFileRoute, Link } from "@tanstack/react-router";
import type { TFunction } from "i18next";
import {
  Baby,
  BookHeart,
  Briefcase,
  Building2,
  CalendarDays,
  ChevronRight,
  CircleAlert,
  GraduationCap,
  Heart,
  HeartPulse,
  Home as HomeIcon,
  PenLine,
  Plane,
  Plus,
  Sparkles,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { AstroArt } from "@/components/AstroArt";
import { grahaArtByName } from "@/lib/astro-art";
import type { DashaMaha } from "@/lib/charts";
import { triggerHaptic } from "@/lib/native-device";
import { useRequireOnboarding } from "@/lib/require-auth";
import { useDasha, useJournal, useLifeEvents, useSentNudges } from "@/lib/queries";
import type { JournalEntry } from "@/lib/journal";
import type { LifeEvent, LifeEventCategory } from "@/lib/life-events";
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

function excerpt(value: string, max = 150): string {
  const trimmed = value.trim();
  return trimmed.length > max ? `${trimmed.slice(0, max).trimEnd()}…` : trimmed;
}

const CATEGORY_ICON: Record<LifeEventCategory, LucideIcon> = {
  career: Briefcase,
  health: HeartPulse,
  marriage: Heart,
  relationships: Users,
  finance: Wallet,
  children: Baby,
  education: GraduationCap,
  travel: Plane,
  property: HomeIcon,
  business: Building2,
  spirituality: Sparkles,
  family: Users,
  other: CalendarDays,
};

const SECTION_LABEL =
  "text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground [:lang(hi)_&]:tracking-normal [:lang(mr)_&]:tracking-normal";

const YEAR_MS = 365.25 * 24 * 60 * 60 * 1000;

/** Indian day-month order for English, like the rest of the app. */
function dateLocale(locale: string): string {
  return locale === "en" ? "en-IN" : locale;
}

function planetName(t: TFunction, name: string): string {
  return t(`home.planets.${name.trim().toLowerCase()}`, { defaultValue: name });
}

function shortEventDate(event: LifeEvent, locale: string): string {
  const date = parseLocalDate(event.event_date);
  if (!date) return event.event_date;
  if (event.date_precision === "year") return String(date.getFullYear());
  return date.toLocaleDateString(dateLocale(locale), { month: "short", year: "numeric" });
}

function eventMeta(event: LifeEvent, locale: string, t: TFunction): string {
  const parts = [shortEventDate(event, locale)];
  const dasha = "dasha" in event.astro_context ? event.astro_context.dasha : null;
  if (dasha?.maha) {
    parts.push(
      dasha.antar
        ? `${planetName(t, dasha.maha.name)} / ${planetName(t, dasha.antar.name)}`
        : planetName(t, dasha.maha.name),
    );
  }
  return parts.join(" · ");
}

function relativeTime(iso: string | null, t: TFunction): string {
  if (!iso) return "";
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (!Number.isFinite(minutes)) return "";
  if (minutes < 1) return t("nudges.time.justNow");
  if (minutes < 60) return t("nudges.time.minutesAgo", { n: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("nudges.time.hoursAgo", { n: hours });
  const days = Math.floor(hours / 24);
  if (days < 30) return t("nudges.time.daysAgo", { n: days });
  return t("nudges.time.monthsAgo", { n: Math.floor(days / 30) });
}

function JourneyPage() {
  useRequireOnboarding();
  const { t, i18n } = useTranslation();
  const lifeQuery = useLifeEvents();
  const journalQuery = useJournal();
  const dashaQuery = useDasha();
  const nudgesQuery = useSentNudges();

  const recentEvents = useMemo(
    () =>
      [...(lifeQuery.data ?? [])]
        .sort((a, b) => dateValue(b.event_date) - dateValue(a.event_date))
        .slice(0, 3),
    [lifeQuery.data],
  );
  const latestEvent = recentEvents[0] ?? null;
  const recentEntries = (journalQuery.data ?? []).slice(0, 2);
  const latestEntry = recentEntries[0] ?? null;
  const recentNudges = (nudgesQuery.data ?? []).slice(0, 2);
  const latestNudge = recentNudges[0] ?? null;

  const currentPeriod = useMemo(() => {
    const now = Date.now();
    return (
      dashaQuery.data?.periods?.find((period) => {
        const start = Date.parse(period.start);
        const end = Date.parse(period.end);
        return Number.isFinite(start) && Number.isFinite(end) && start <= now && now <= end;
      }) ?? null
    );
  }, [dashaQuery.data?.periods]);

  return (
    <section className="mx-auto max-w-2xl space-y-7">
      <header className="motion-fade-up">
        <p className="text-[0.8125rem] font-semibold tracking-[0.04em] text-muted-foreground">
          {t("journey.title")}
        </p>
        <h1 className="large-title mt-0.5 text-foreground">{t("nav.journey")}</h1>
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <Link
            to="/life"
            onClick={() => void triggerHaptic("selection")}
            className="tap-press flex min-h-12 items-center justify-center gap-1.5 rounded-full bg-accent/15 px-2.5 py-2 text-center leading-tight text-sm font-semibold text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Plus size={18} className="shrink-0" aria-hidden="true" />
            <span>{t("journey.actions.addEvent")}</span>
          </Link>
          <Link
            to="/journal"
            onClick={() => void triggerHaptic("selection")}
            className="tap-press flex min-h-12 items-center justify-center gap-1.5 rounded-full bg-foreground/[0.07] px-2.5 py-2 text-center leading-tight text-sm font-semibold text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <PenLine size={17} className="shrink-0" aria-hidden="true" />
            <span>{t("journey.actions.writeReflection")}</span>
          </Link>
        </div>
      </header>

      <section aria-labelledby="journey-current-chapter" className="motion-fade-up motion-delay-1">
        <h2 id="journey-current-chapter" className="sr-only">
          {t("journey.currentChapter")}
        </h2>
        {dashaQuery.isLoading ? (
          <div
            role="status"
            aria-label={t("journey.loading")}
            className="h-[7.5rem] motion-safe:animate-pulse rounded-[1.25rem] bg-card"
          />
        ) : dashaQuery.isError || dashaQuery.data?.error ? (
          <SectionError onRetry={() => void dashaQuery.refetch()} />
        ) : currentPeriod ? (
          <ChapterCard period={currentPeriod} />
        ) : (
          <div className="rounded-[1.25rem] bg-card px-4 py-3.5 shadow-[var(--as-elevation-1)]">
            <p className="text-[0.9375rem] font-semibold text-foreground">
              {t("journey.noCurrentChapter")}
            </p>
            <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">
              {t("journey.noCurrentChapterBody")}
            </p>
          </div>
        )}
      </section>

      <SummaryCard
        id="journey-timeline"
        title={t("journey.timeline.title")}
        icon={<CalendarDays size={18} aria-hidden="true" />}
        to="/life"
        loading={lifeQuery.isLoading}
        error={lifeQuery.isError}
        onRetry={() => void lifeQuery.refetch()}
        empty={!latestEvent}
        emptyTitle={t("journey.timeline.empty")}
        emptyDescription={t("journey.timeline.emptyHint")}
        linkLabel={latestEvent ? t("journey.viewTimeline") : t("journey.actions.addEvent")}
      >
        {recentEvents.map((event) => {
          const Icon = CATEGORY_ICON[event.category] ?? CalendarDays;
          return (
            <li key={event.id}>
              <Link
                to="/life"
                className="tap-press flex min-h-[3.75rem] items-center gap-3.5 px-4 py-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[0.625rem] bg-accent/12 text-accent">
                  <Icon size={17} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base text-foreground">{event.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {eventMeta(event, i18n.language, t)}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </SummaryCard>

      <SummaryCard
        id="journey-journal"
        listInset="[--list-inset:1rem]"
        title={t("journey.journal.title")}
        icon={<BookHeart size={18} aria-hidden="true" />}
        to="/journal"
        loading={journalQuery.isLoading}
        error={journalQuery.isError}
        onRetry={() => void journalQuery.refetch()}
        empty={!latestEntry}
        emptyTitle={t("journey.journal.empty")}
        linkLabel={latestEntry ? t("journey.viewJournal") : t("journey.actions.writeReflection")}
      >
        {recentEntries.map((entry) => (
          <li key={entry.id}>
            <JournalRow entry={entry} />
          </li>
        ))}
      </SummaryCard>

      <SummaryCard
        id="journey-guidance"
        listInset="[--list-inset:2.375rem]"
        title={t("journey.guidance.title")}
        icon={<Sparkles size={18} aria-hidden="true" />}
        to="/nudges"
        linkLabel={t("journey.viewGuidance")}
        loading={nudgesQuery.isLoading}
        error={nudgesQuery.isError}
        onRetry={() => void nudgesQuery.refetch()}
        empty={!latestNudge}
        emptyTitle={t("journey.guidance.empty")}
      >
        {recentNudges.map((nudge) => (
          <li key={nudge.id}>
            <NudgeRow nudge={nudge} />
          </li>
        ))}
      </SummaryCard>
    </section>
  );
}

/** The running Mahadasha, with its Antardasha and how far through it you are. */
function ChapterCard({ period }: { period: DashaMaha }) {
  const { t, i18n } = useTranslation();
  const now = Date.now();
  const startMs = Date.parse(period.start);
  const endMs = Date.parse(period.end);
  const totalYears = Math.max(1, Math.round((endMs - startMs) / YEAR_MS));
  const yearNow = Math.min(totalYears, Math.floor((now - startMs) / YEAR_MS) + 1);
  const progress = Math.min(1, Math.max(0, (now - startMs) / (endMs - startMs)));
  const antar =
    period.antardasha?.find((a) => Date.parse(a.start) <= now && now <= Date.parse(a.end)) ?? null;
  const art = grahaArtByName(period.name);
  const since = antar
    ? new Date(antar.start).toLocaleDateString(dateLocale(i18n.language), {
        month: "short",
        year: "numeric",
      })
    : null;

  return (
    <Link
      to="/home"
      search={{ tab: "details" }}
      onClick={() => void triggerHaptic("selection")}
      className="tap-press relative isolate flex items-center gap-3.5 overflow-hidden rounded-[1.25rem] bg-card p-[1.125rem] shadow-[var(--as-elevation-1),inset_0_0_0_1px_color-mix(in_oklab,var(--accent)_25%,transparent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {art && (
        <>
          <AstroArt
            kind="graha"
            name={art}
            size={148}
            priority
            className="absolute -right-14 top-1/2 -z-20 -translate-y-1/2 opacity-85"
          />
          <span
            aria-hidden="true"
            className="absolute inset-0 -z-10 bg-gradient-to-r from-card from-45% via-card/80 via-70% to-card/20"
          />
        </>
      )}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-xs font-semibold uppercase tracking-[0.1em] text-accent [:lang(hi)_&]:tracking-normal [:lang(mr)_&]:tracking-normal">
          {t("journey.currentChapter")}
        </span>
        <span className="font-display text-[1.3125rem] font-semibold leading-tight text-foreground">
          {planetName(t, period.name)} {t("sections.dasha.mahadasha")}
        </span>
        {antar && since && (
          <span className="text-[0.8125rem] text-foreground/80">
            {planetName(t, antar.name)} {t("sections.dasha.antardasha")} ·{" "}
            {t("journey.since", { date: since })}
          </span>
        )}
        <span className="mt-2 flex w-[12.25rem] max-w-full items-center gap-2.5">
          <span
            aria-hidden="true"
            className="block h-[3px] flex-1 overflow-hidden rounded-full bg-foreground/[0.14]"
          >
            <span
              className="block h-full min-w-1.5 rounded-full bg-accent"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </span>
          <span className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">
            {t("journey.yearOf", { n: yearNow, total: totalYears })}
          </span>
        </span>
      </span>
      <ChevronRight size={18} className="shrink-0 text-foreground/70" aria-hidden="true" />
    </Link>
  );
}

function SectionError({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <div
      role="alert"
      data-state="error"
      className="flex items-center gap-3 rounded-[0.875rem] bg-card py-2 pl-4 pr-2 shadow-[var(--as-elevation-1)]"
    >
      <CircleAlert size={18} className="shrink-0 text-feedback-warning" aria-hidden="true" />
      <p className="min-w-0 flex-1 text-sm text-foreground">{t("journey.moduleError")}</p>
      <button
        type="button"
        onClick={onRetry}
        className="tap-press inline-flex min-h-11 shrink-0 items-center rounded-full px-3 text-sm font-semibold text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {t("states.retry")}
      </button>
    </div>
  );
}

function PreviewEmpty({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action: React.ReactNode;
}) {
  return (
    <div
      role="status"
      data-state="empty"
      className="flex flex-col gap-3 rounded-[0.875rem] bg-card p-4 shadow-[var(--as-elevation-1)]"
    >
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[0.625rem] bg-accent/12 text-accent">
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-[0.9375rem] font-semibold text-foreground">{title}</p>
          {description && (
            <p className="mt-0.5 text-[0.8125rem] leading-snug text-muted-foreground">
              {description}
            </p>
          )}
        </div>
      </div>
      {action}
    </div>
  );
}

function SummaryCard({
  id,
  title,
  icon,
  to,
  linkLabel,
  loading,
  error,
  onRetry,
  empty,
  emptyTitle,
  emptyDescription,
  listInset = "[--list-inset:4.25rem]",
  children,
}: {
  id: string;
  title: string;
  icon: React.ReactNode;
  to: "/life" | "/journal" | "/nudges";
  linkLabel: string;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  empty: boolean;
  emptyTitle: string;
  emptyDescription?: string;
  /** Where row dividers start, so they line up with each row's text. */
  listInset?: string;
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  const headingId = `${id}-heading`;
  const ready = !loading && !error;
  return (
    <article aria-labelledby={headingId} className="motion-fade-up motion-delay-2">
      <div className="flex min-h-11 items-center justify-between gap-3 pb-1 pl-4 pr-1">
        <h2 id={headingId} className={SECTION_LABEL}>
          {title}
        </h2>
        {ready && !empty ? (
          <Link
            to={to}
            onClick={() => void triggerHaptic("selection")}
            aria-label={linkLabel}
            className="tap-press inline-flex min-h-11 items-center rounded-full px-3 text-sm font-semibold text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t("journey.seeAll")}
          </Link>
        ) : null}
      </div>
      {loading ? (
        <div
          role="status"
          aria-label={title}
          className="h-[7.5rem] motion-safe:animate-pulse rounded-[0.875rem] bg-card"
        />
      ) : error ? (
        <SectionError onRetry={onRetry} />
      ) : empty ? (
        <PreviewEmpty
          icon={icon}
          title={emptyTitle}
          description={emptyDescription}
          action={
            <Link
              to={to}
              onClick={() => void triggerHaptic("selection")}
              className="tap-press inline-flex min-h-11 w-fit items-center gap-1.5 rounded-full bg-accent/15 px-4 text-sm font-semibold text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {linkLabel}
            </Link>
          }
        />
      ) : (
        <ul
          className={`list-hairline overflow-hidden rounded-[0.875rem] bg-card shadow-[var(--as-elevation-1)] ${listInset}`}
        >
          {children}
        </ul>
      )}
    </article>
  );
}

function JournalRow({ entry }: { entry: JournalEntry }) {
  const { t, i18n } = useTranslation();
  const date = parseLocalDate(entry.entry_date);
  return (
    <Link
      to="/journal"
      className="tap-press flex min-h-16 flex-col justify-center gap-1 px-4 py-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
    >
      <span className="flex items-baseline justify-between gap-2.5">
        <span className="min-w-0 truncate text-base text-foreground">
          {entry.title || t("journey.untitledReflection")}
        </span>
        {date && (
          <span className="shrink-0 text-xs text-muted-foreground">
            {date.toLocaleDateString(dateLocale(i18n.language), { day: "numeric", month: "short" })}
          </span>
        )}
      </span>
      <span className="truncate text-[0.8125rem] text-muted-foreground">
        {excerpt(entry.content, 120)}
      </span>
    </Link>
  );
}

function NudgeRow({ nudge }: { nudge: ProactiveNudge }) {
  const { t } = useTranslation();
  const fresh = nudge.status === "sent";
  return (
    <Link
      to="/nudges"
      className="tap-press flex min-h-[3.75rem] items-center gap-3.5 px-4 py-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
    >
      <span
        aria-hidden="true"
        className={`h-2 w-2 shrink-0 rounded-full ${fresh ? "bg-accent" : "bg-foreground/20"}`}
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-base text-foreground">{nudge.title}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {t(`nudges.kinds.${nudge.kind}`, { defaultValue: t("nudges.kinds.other") })}
          {nudge.sent_at ? ` · ${relativeTime(nudge.sent_at, t)}` : ""}
        </span>
      </span>
    </Link>
  );
}
