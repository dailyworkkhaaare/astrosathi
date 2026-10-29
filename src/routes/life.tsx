import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import {
  Briefcase,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Heart,
  HeartPulse,
  Home as HomeIcon,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  type LucideIcon,
} from "lucide-react";

import { useRequireOnboarding } from "@/lib/require-auth";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { JourneyAskDialog, type JourneyAskSource } from "@/components/journey/JourneyAskDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { triggerHaptic } from "@/lib/native-device";
import { ConfirmDialog } from "@/components/settings/primitives";
import {
  useCreateLifeEvent,
  useDasha,
  useDeleteLifeEvent,
  useLifeEvents,
  useRestampLifeEvent,
  useUpdateLifeEvent,
} from "@/lib/queries";
import {
  CATEGORIES,
  PRECISIONS,
  VALENCES,
  type DatePrecision,
  type LifeEvent,
  type LifeEventCategory,
  type LifeEventInput,
  type Valence,
} from "@/lib/life-events";

export const Route = createFileRoute("/life")({
  head: () => ({
    meta: [
      { title: "Life Timeline — AstroSaathi" },
      {
        name: "description",
        content: "Your life's milestones, mapped against your daśā and transits.",
      },
      { property: "og:title", content: "Life Timeline — AstroSaathi" },
      {
        property: "og:description",
        content: "Your life's milestones, mapped against your daśā and transits.",
      },
    ],
  }),
  component: LifePage,
});

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function parseLocalDate(dateStr: string): Date | null {
  const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function formatEventDate(dateStr: string, precision: DatePrecision, locale: string): string {
  const d = parseLocalDate(dateStr);
  if (!d) return dateStr;
  if (precision === "year") {
    return String(d.getFullYear());
  }
  if (precision === "month") {
    return d.toLocaleDateString(locale, { month: "long", year: "numeric" });
  }
  return d.toLocaleDateString(locale === "en" ? "en-IN" : locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatEventDateForAsk(event: LifeEvent, locale: string, approximate: string): string {
  const date = formatEventDate(event.event_date, event.date_precision, locale);
  return event.date_precision === "approx" ? `${date} · ${approximate}` : date;
}

const EVENT_TEMPLATES: {
  id: "job" | "move" | "relationship" | "health";
  category: LifeEventCategory;
  icon: LucideIcon;
}[] = [
  { id: "job", category: "career", icon: Briefcase },
  { id: "move", category: "property", icon: HomeIcon },
  { id: "relationship", category: "relationships", icon: Heart },
  { id: "health", category: "health", icon: HeartPulse },
];

// Derive the exact birth instant from the daśā API's own numbers: the end of
// the first mahadasha minus dasha_balance.duration (an ISO-8601 duration like
// "P9Y8M6DT1H8M39S"). The first mahadasha itself starts well before birth
// (Vimshottari periods are computed from the natal nakshatra, not from
// birth), so this is the only reliable way to know where "birth" sits inside
// it — matches the same derivation used by DashaSection.tsx for Home's
// daśā timeline.
function birthMsFromDasha(firstMahaEnd: string, balanceDuration: string | null): number | null {
  if (!balanceDuration) return null;
  const m = balanceDuration
    .trim()
    .match(/^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/);
  if (!m) return null;
  const endMs = Date.parse(firstMahaEnd);
  if (!Number.isFinite(endMs)) return null;
  const d = new Date(endMs);
  d.setUTCFullYear(d.getUTCFullYear() - Number(m[1] ?? 0));
  d.setUTCMonth(d.getUTCMonth() - Number(m[2] ?? 0));
  d.setUTCDate(d.getUTCDate() - Number(m[3] ?? 0));
  d.setUTCHours(
    d.getUTCHours() - Number(m[4] ?? 0),
    d.getUTCMinutes() - Number(m[5] ?? 0),
    d.getUTCSeconds() - Math.floor(Number(m[6] ?? 0)),
  );
  const birthMs = d.getTime();
  return Number.isFinite(birthMs) ? birthMs : null;
}

type TimelineGroup = {
  key: string;
  title: string;
  span: string | null;
  current: boolean;
  latestMs: number;
  events: LifeEvent[];
};

function eventMs(event: LifeEvent): number {
  return parseLocalDate(event.event_date)?.getTime() ?? 0;
}

function planetName(t: TFunction, name: string): string {
  return t(`home.planets.${name.trim().toLowerCase()}`, { defaultValue: name });
}

/** "Aug 2026", "2016, approx." — the date as precisely as it was recorded. */
function shortEventDate(event: LifeEvent, locale: string, approximate: string): string {
  const d = parseLocalDate(event.event_date);
  if (!d) return event.event_date;
  const loc = locale === "en" ? "en-IN" : locale;
  const date =
    event.date_precision === "year"
      ? String(d.getFullYear())
      : d.toLocaleDateString(loc, { month: "short", year: "numeric" });
  return event.date_precision === "approx" ? `${date}, ${approximate}` : date;
}

function stampedDasha(event: LifeEvent) {
  const ctx = event.astro_context;
  return ctx && "version" in ctx && ctx.version === 1 ? ctx.dasha : null;
}

function LifePage() {
  useRequireOnboarding();
  const { t, i18n } = useTranslation();
  const eventsQuery = useLifeEvents();
  const dashaQuery = useDasha();
  const createMutation = useCreateLifeEvent();
  const updateMutation = useUpdateLifeEvent();
  const deleteMutation = useDeleteLifeEvent();
  const restampMutation = useRestampLifeEvent();
  const [stampingIds, setStampingIds] = useState<Set<string>>(new Set());

  const [formTarget, setFormTarget] = useState<LifeEvent | "new" | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LifeEvent | null>(null);
  const [askSource, setAskSource] = useState<JourneyAskSource | null>(null);
  const [area, setArea] = useState<LifeEventCategory | "all">("all");

  const events = useMemo(() => eventsQuery.data ?? [], [eventsQuery.data]);
  const areas = useMemo(
    () => CATEGORIES.filter((c) => events.some((ev) => ev.category === c)),
    [events],
  );
  const activeArea = area !== "all" && areas.includes(area) ? area : "all";

  // Events grouped under the Mahadasha they fell in, newest first. The
  // period comes from the daśā list when it covers the date, else from the
  // dasha stamped on the event; unplaced events gather at the end.
  const groups = useMemo(() => {
    const periods = dashaQuery.data?.periods ?? [];
    const balance = dashaQuery.data?.balance?.duration;
    const birthMs =
      periods.length > 0
        ? (birthMsFromDasha(periods[0].end, balance != null ? String(balance) : null) ??
          Date.parse(periods[0].start))
        : null;
    const now = Date.now();
    const yearOf = (ms: number) => new Date(ms).getFullYear();
    const byKey = new Map<string, TimelineGroup>();

    for (const ev of events) {
      if (activeArea !== "all" && ev.category !== activeArea) continue;
      const ms = eventMs(ev);
      const period = periods.find((p) => Date.parse(p.start) <= ms && ms <= Date.parse(p.end));
      const maha = stampedDasha(ev)?.maha ?? null;
      let group: Omit<TimelineGroup, "latestMs" | "events">;
      if (period) {
        const startMs = Math.max(Date.parse(period.start), birthMs ?? -Infinity);
        const endMs = Date.parse(period.end);
        const span = t("life.groupSpan", { start: yearOf(startMs), end: yearOf(endMs) });
        const current = startMs <= now && now <= endMs;
        group = {
          key: `${period.id}-${period.start}`,
          title: `${planetName(t, period.name)} ${t("sections.dasha.mahadasha")}`,
          span: current ? t("life.groupNow", { span }) : span,
          current,
        };
      } else if (maha) {
        group = {
          key: `maha-${maha.id}`,
          title: `${planetName(t, maha.name)} ${t("sections.dasha.mahadasha")}`,
          span: null,
          current: false,
        };
      } else {
        group = { key: "unplaced", title: t("life.unplaced"), span: null, current: false };
      }
      const existing = byKey.get(group.key);
      if (existing) {
        existing.events.push(ev);
        existing.latestMs = Math.max(existing.latestMs, ms);
      } else {
        byKey.set(group.key, { ...group, latestMs: ms, events: [ev] });
      }
    }

    return [...byKey.values()]
      .map((g) => ({ ...g, events: [...g.events].sort((a, b) => eventMs(b) - eventMs(a)) }))
      .sort((a, b) =>
        a.key === "unplaced" ? 1 : b.key === "unplaced" ? -1 : b.latestMs - a.latestMs,
      );
  }, [events, activeArea, dashaQuery.data, t]);

  const onRefreshAstrology = async (id: string) => {
    setStampingIds((prev) => new Set(prev).add(id));
    try {
      await restampMutation.mutateAsync(id);
    } finally {
      setStampingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const hasEvents = !eventsQuery.isLoading && !eventsQuery.isError && events.length > 0;

  return (
    <section className="mx-auto max-w-2xl">
      <nav className="motion-fade-up -mx-2 -mt-2 flex min-h-11 items-center justify-between">
        <Link
          to="/journey"
          className="tap-press inline-flex min-h-11 items-center gap-0.5 rounded-full pl-1 pr-3 text-[1.0625rem] text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronLeft size={22} aria-hidden="true" />
          {t("nav.journey")}
        </Link>
        {hasEvents && (
          <button
            type="button"
            onClick={() => setFormTarget("new")}
            aria-label={t("life.addEvent")}
            title={t("life.addEvent")}
            className="tap-press grid h-11 w-11 place-items-center rounded-full text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Plus size={22} aria-hidden="true" />
          </button>
        )}
      </nav>

      <header className="motion-fade-up mt-1">
        <h1 className="large-title text-foreground">{t("life.title")}</h1>
        <p className="mt-1.5 text-[0.9375rem] leading-snug text-muted-foreground">
          {t("life.subtitle")}
        </p>
      </header>

      {eventsQuery.isLoading ? (
        <div role="status" aria-label={t("life.loading")} className="mt-6 space-y-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="ml-7 h-16 motion-safe:animate-pulse rounded-[0.875rem] bg-card"
            />
          ))}
        </div>
      ) : eventsQuery.isError ? (
        <div
          role="alert"
          data-state="error"
          className="mt-6 flex items-center gap-3 rounded-[0.875rem] bg-card py-2 pl-4 pr-2 shadow-[var(--as-elevation-1)]"
        >
          <CircleAlert size={18} className="shrink-0 text-feedback-warning" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">{t("life.loadError")}</p>
            <p className="text-xs text-muted-foreground">{t("life.loadErrorBody")}</p>
          </div>
          <button
            type="button"
            onClick={() => void eventsQuery.refetch()}
            className="tap-press inline-flex min-h-11 shrink-0 items-center rounded-full px-3 text-sm font-semibold text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t("states.retry")}
          </button>
        </div>
      ) : events.length === 0 ? (
        <div
          data-state="empty"
          className="motion-fade-up mt-8 flex flex-col items-center gap-1.5 rounded-[1.25rem] bg-card px-6 py-8 text-center shadow-[var(--as-elevation-1)]"
        >
          <span className="mb-2 grid h-11 w-11 place-items-center rounded-[0.875rem] bg-accent/12 text-accent">
            <CalendarDays size={20} aria-hidden="true" />
          </span>
          <p className="text-base font-semibold text-foreground">{t("life.empty.title")}</p>
          <p className="max-w-xs text-[0.8125rem] leading-snug text-muted-foreground">
            {t("life.empty.body")}
          </p>
          <button
            type="button"
            onClick={() => setFormTarget("new")}
            className="tap-press mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-full bg-accent/15 px-5 text-sm font-semibold text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Plus size={16} aria-hidden="true" />
            {t("life.addEvent")}
          </button>
        </div>
      ) : (
        <>
          {areas.length > 1 && (
            <div
              role="group"
              aria-label={t("life.filterLabel")}
              className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1 [mask-image:linear-gradient(to_right,transparent,black_1rem,black_calc(100%-1.5rem),transparent)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {(["all", ...areas] as const).map((value) => {
                const pressed = activeArea === value;
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={pressed}
                    onClick={() => {
                      setArea(value);
                      void triggerHaptic("selection");
                    }}
                    className={cn(
                      "tap-press inline-flex min-h-11 shrink-0 items-center rounded-full px-4 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      pressed
                        ? "bg-foreground text-background"
                        : "text-muted-foreground shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--foreground)_16%,transparent)]",
                    )}
                  >
                    {value === "all" ? t("life.filterAll") : t(`life.categories.${value}`)}
                  </button>
                );
              })}
            </div>
          )}

          <div aria-label={t("life.timelineAria")} role="region">
            {groups.map((group) => (
              <section
                key={group.key}
                aria-labelledby={`life-group-${group.key}`}
                className="motion-fade-up mt-6"
              >
                <div className="mb-2.5 flex items-baseline justify-between gap-2.5 pl-9 pr-1">
                  <h2
                    id={`life-group-${group.key}`}
                    className={cn(
                      "text-xs font-semibold uppercase tracking-[0.08em] [:lang(hi)_&]:tracking-normal [:lang(mr)_&]:tracking-normal",
                      group.current ? "text-accent" : "text-muted-foreground",
                    )}
                  >
                    {group.title}
                  </h2>
                  {group.span && (
                    <span className="shrink-0 text-xs text-muted-foreground">{group.span}</span>
                  )}
                </div>
                <ol className="flex flex-col gap-2">
                  {group.events.map((ev) => (
                    <EventRow
                      key={ev.id}
                      event={ev}
                      current={group.current}
                      locale={i18n.language}
                      stamping={stampingIds.has(ev.id)}
                      onEdit={() => setFormTarget(ev)}
                      onDelete={() => setDeleteTarget(ev)}
                      onAsk={() => {
                        const date = formatEventDateForAsk(ev, i18n.language, t("life.approxTag"));
                        setAskSource({
                          kind: "event",
                          title: ev.title,
                          date,
                          draft: t("journey.askContext.eventDraft", { title: ev.title, date }),
                        });
                      }}
                      onRefreshAstrology={() => onRefreshAstrology(ev.id)}
                    />
                  ))}
                </ol>
              </section>
            ))}
          </div>

          <Link
            to="/chat"
            search={{ seed: t("life.findPattern.seed") }}
            className="tap-press mt-6 flex items-center gap-3.5 rounded-[1.25rem] bg-[color-mix(in_oklab,var(--as-color-action-ask)_12%,transparent)] p-4 shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--as-color-action-ask)_30%,transparent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[color-mix(in_oklab,var(--as-color-action-ask)_20%,transparent)] text-[var(--as-color-action-ask)]">
              <MessageCircle size={19} aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-base font-semibold text-foreground">
                {t("life.findPattern.title")}
              </span>
              <span className="block text-xs text-[var(--as-color-action-ask)]">
                {t("life.findPattern.body")}
              </span>
            </span>
            <ChevronRight size={18} className="shrink-0 text-muted-foreground" aria-hidden="true" />
          </Link>
          <p className="mt-3 text-center text-xs text-muted-foreground">{t("life.privacy")}</p>
        </>
      )}

      {formTarget && (
        <LifeEventFormDialog
          target={formTarget}
          onClose={() => setFormTarget(null)}
          onCreate={async (input) => {
            await createMutation.mutateAsync(input);
            void triggerHaptic("success");
            setFormTarget(null);
          }}
          onUpdate={async (id, patch) => {
            await updateMutation.mutateAsync({ id, patch });
            void triggerHaptic("success");
            setFormTarget(null);
          }}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title={t("life.confirmDeleteTitle")}
          body={t("life.confirmDeleteBody")}
          cancelLabel={t("life.cancel")}
          confirmLabel={t("life.delete")}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={async () => {
            await deleteMutation.mutateAsync(deleteTarget.id);
            void triggerHaptic("warning");
            setDeleteTarget(null);
          }}
        />
      )}

      <JourneyAskDialog source={askSource} onClose={() => setAskSource(null)} />
    </section>
  );
}

const VALENCE_DOT: Record<Valence, string> = {
  positive: "bg-feedback-success",
  negative: "bg-feedback-warning",
  mixed: "bg-muted-foreground",
  neutral: "bg-muted-foreground",
};

const VALENCE_TAG: Record<Valence, string> = {
  positive: "bg-feedback-success/15 text-feedback-success",
  negative: "bg-feedback-warning/15 text-feedback-warning",
  mixed: "bg-foreground/[0.08] text-muted-foreground",
  neutral: "bg-foreground/[0.08] text-muted-foreground",
};

const VALENCE_SELECTED: Record<Valence, string> = {
  positive: "text-feedback-success shadow-[inset_0_0_0_1.5px_var(--as-color-feedback-success)]",
  negative: "text-feedback-warning shadow-[inset_0_0_0_1.5px_var(--as-color-feedback-warning)]",
  mixed: "text-foreground shadow-[inset_0_0_0_1.5px_var(--muted-foreground)]",
  neutral: "text-foreground shadow-[inset_0_0_0_1.5px_var(--muted-foreground)]",
};

const FORM_LABEL =
  "mb-2 px-1 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground [:lang(hi)_&]:tracking-normal [:lang(mr)_&]:tracking-normal";

function EventRow({
  event,
  current,
  locale,
  stamping,
  onEdit,
  onDelete,
  onAsk,
  onRefreshAstrology,
}: {
  event: LifeEvent;
  current: boolean;
  locale: string;
  stamping: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onAsk: () => void;
  onRefreshAstrology: () => void;
}) {
  const { t } = useTranslation();
  const dasha = stampedDasha(event);
  const date = shortEventDate(event, locale, t("life.approxTag"));
  const lords = dasha?.maha
    ? [dasha.maha, dasha.antar]
        .filter((p): p is NonNullable<typeof p> => !!p)
        .map((p) => planetName(t, p.name))
        .join(" / ")
    : null;

  return (
    <li className="relative flex">
      <span aria-hidden="true" className="relative flex w-5 shrink-0 justify-center">
        <span
          className={cn(
            "absolute -bottom-1 -top-1 w-0.5",
            current ? "bg-accent/50" : "bg-foreground/[0.12]",
          )}
        />
        <span
          className={cn(
            "absolute top-[1.625rem] h-3 w-3 rounded-full shadow-[0_0_0_4px_var(--background)]",
            event.valence ? VALENCE_DOT[event.valence] : "bg-accent",
          )}
        />
      </span>
      <div className="ml-2 flex min-h-16 min-w-0 flex-1 items-center rounded-[0.875rem] bg-card shadow-[var(--as-elevation-1)]">
        <button
          type="button"
          onClick={onEdit}
          className="tap-press flex min-w-0 flex-1 items-center gap-3 self-stretch rounded-l-[0.875rem] py-3 pl-3.5 pr-1 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        >
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="truncate text-base text-foreground">{event.title}</span>
            <span className="truncate text-xs text-muted-foreground">
              {date}
              {" · "}
              {lords ?? (stamping ? t("life.placingInChart") : t("life.astrologyPending"))}
            </span>
          </span>
          {event.valence && (
            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold",
                VALENCE_TAG[event.valence],
              )}
            >
              {t(`life.valences.${event.valence}`)}
            </span>
          )}
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={t("life.rowOptions", { title: event.title })}
              className="tap-press grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <MoreHorizontal size={18} aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="min-w-[12rem] rounded-xl border-border bg-card p-1.5 shadow-[var(--shadow-elevated)]"
          >
            <DropdownMenuItem
              onClick={onEdit}
              className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg px-3 text-sm text-foreground"
            >
              <Pencil size={15} aria-hidden="true" />
              {t("life.editEvent")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={onAsk}
              className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg px-3 text-sm text-foreground"
            >
              <MessageCircle size={15} aria-hidden="true" />
              {t("journey.askContext.eventAction")}
            </DropdownMenuItem>
            {!lords && !stamping && (
              <DropdownMenuItem
                onClick={onRefreshAstrology}
                className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg px-3 text-sm text-foreground"
              >
                <RefreshCw size={15} aria-hidden="true" />
                {t("life.refreshAstrology")}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onClick={onDelete}
              className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg px-3 text-sm text-destructive-strong"
            >
              <Trash2 size={15} aria-hidden="true" />
              {t("life.delete")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  );
}

function LifeEventFormDialog({
  target,
  onClose,
  onCreate,
  onUpdate,
}: {
  target: LifeEvent | "new";
  onClose: () => void;
  onCreate: (input: LifeEventInput) => Promise<void>;
  onUpdate: (id: string, patch: Partial<LifeEventInput>) => Promise<void>;
}) {
  const { t } = useTranslation();
  const isNew = target === "new";
  const existing = isNew ? null : target;

  const [title, setTitle] = useState(existing?.title ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [category, setCategory] = useState<LifeEventCategory>(existing?.category ?? "other");
  const [eventDate, setEventDate] = useState(existing?.event_date ?? todayStr());
  const [precision, setPrecision] = useState<DatePrecision>(existing?.date_precision ?? "exact");
  const [valence, setValence] = useState<Valence | null>(existing?.valence ?? null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (ev: FormEvent) => {
    ev.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!title.trim()) nextErrors.title = t("life.errors.titleRequired");
    if (!eventDate) nextErrors.date = t("life.errors.dateRequired");
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      if (isNew) {
        await onCreate({
          title: title.trim(),
          description: description.trim() || null,
          category,
          event_date: eventDate,
          date_precision: precision,
          valence,
        });
      } else if (existing) {
        await onUpdate(existing.id, {
          title: title.trim(),
          description: description.trim() || null,
          category,
          event_date: eventDate,
          date_precision: precision,
          valence,
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const stamped = existing && eventDate === existing.event_date ? stampedDasha(existing) : null;
  const fallsIn = stamped?.maha
    ? [stamped.maha, stamped.antar]
        .filter((p): p is NonNullable<typeof p> => !!p)
        .map((p) => planetName(t, p.name))
        .join(" / ")
    : null;

  return (
    <Drawer open onOpenChange={(open) => !open && onClose()} shouldScaleBackground={false}>
      <DrawerContent
        aria-describedby="life-event-form-note"
        className="bg-background sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:max-h-[min(44rem,calc(100dvh-2rem))] sm:w-full sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl"
      >
        <DrawerHeader className="grid grid-cols-[1fr_auto_1fr] items-center gap-0 px-2 pb-1 pt-1">
          <DrawerClose asChild>
            <button
              type="button"
              className="tap-press inline-flex min-h-11 items-center justify-self-start rounded-full px-3 text-[1.0625rem] text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {t("life.cancel")}
            </button>
          </DrawerClose>
          <DrawerTitle className="text-[1.0625rem] font-semibold">
            {isNew ? t("life.addEvent") : t("life.editEvent")}
          </DrawerTitle>
          <button
            type="submit"
            form="life-event-form"
            disabled={submitting}
            className="tap-press inline-flex min-h-11 items-center justify-self-end rounded-full px-3 text-[1.0625rem] font-semibold text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            {submitting ? t("life.saving") : t("life.save")}
          </button>
        </DrawerHeader>

        <form
          id="life-event-form"
          className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-1"
          onSubmit={onSubmit}
          noValidate
        >
          <DrawerDescription id="life-event-form-note" className="sr-only">
            {t("life.form.intro")}
          </DrawerDescription>

          {isNew ? (
            <section aria-labelledby="life-event-template-title" className="mb-5">
              <h4 id="life-event-template-title" className={FORM_LABEL}>
                {t("life.form.templatesTitle")}
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {EVENT_TEMPLATES.map(({ id, category, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      setTitle(t(`life.form.templates.${id}.title`));
                      setCategory(category);
                      void triggerHaptic("selection");
                    }}
                    className="tap-press flex min-h-11 items-center gap-2 rounded-xl bg-card px-3 py-2 text-left text-sm font-semibold text-foreground shadow-[var(--as-elevation-1)] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Icon size={16} aria-hidden="true" className="shrink-0 text-accent" />
                    <span className="min-w-0 leading-tight">
                      {t(`life.form.templates.${id}.label`)}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          <label htmlFor="life-title" className="sr-only">
            {t("life.fields.title")}
          </label>
          <input
            id="life-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("life.form.titlePlaceholder")}
            enterKeyHint="next"
            autoCapitalize="sentences"
            autoCorrect="on"
            aria-invalid={!!errors.title}
            aria-describedby={errors.title ? "life-title-error" : undefined}
            className={cn(
              "h-14 w-full rounded-[0.875rem] bg-card px-4 text-lg font-semibold text-foreground placeholder:font-normal placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
              errors.title
                ? "shadow-[inset_0_0_0_1px_var(--as-color-feedback-warning)]"
                : "shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--accent)_35%,transparent)]",
            )}
          />
          {errors.title && (
            <p id="life-title-error" className="mt-1.5 px-1 text-xs text-feedback-warning">
              {errors.title}
            </p>
          )}

          <label htmlFor="life-category" className={cn(FORM_LABEL, "mt-5 block")}>
            {t("life.fields.category")}
          </label>
          <div className="relative">
            <select
              id="life-category"
              value={category}
              onChange={(e) => setCategory(e.target.value as LifeEventCategory)}
              className="h-12 w-full appearance-none rounded-[0.875rem] bg-card pl-4 pr-10 text-base text-foreground shadow-[var(--as-elevation-1)] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {t(`life.categories.${c}`)}
                </option>
              ))}
            </select>
            <ChevronDown
              size={18}
              aria-hidden="true"
              className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
          </div>

          <p className={cn(FORM_LABEL, "mt-5")}>{t("life.form.timing")}</p>
          <div className="overflow-hidden rounded-[0.875rem] bg-card shadow-[var(--as-elevation-1)]">
            <div className="p-2">
              <div
                role="radiogroup"
                aria-label={t("life.fields.precision")}
                className="grid grid-cols-2 gap-0.5 rounded-[0.625rem] bg-foreground/[0.07] p-0.5 sm:grid-cols-4"
              >
                {PRECISIONS.map((p) => {
                  const selected = p === precision;
                  return (
                    <button
                      key={p}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setPrecision(p)}
                      className={cn(
                        "min-h-11 rounded-[0.5rem] px-2 text-[0.8125rem] font-semibold leading-tight transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                        selected
                          ? "bg-background text-foreground shadow-[var(--as-elevation-1)] dark:bg-foreground/[0.16]"
                          : "text-muted-foreground",
                      )}
                    >
                      {t(`life.precisions.${p}`)}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex min-h-12 items-center justify-between gap-3 border-t border-[var(--as-list-separator)] pl-4 pr-2">
              <label htmlFor="life-date" className="text-base text-foreground">
                {t("life.fields.date")}
              </label>
              <input
                id="life-date"
                type="date"
                value={eventDate}
                max={todayStr()}
                onChange={(e) => setEventDate(e.target.value)}
                enterKeyHint="done"
                aria-invalid={!!errors.date}
                aria-describedby={errors.date ? "life-date-error" : undefined}
                className="min-h-9 rounded-lg bg-foreground/[0.07] px-2.5 text-base text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>
          {errors.date && (
            <p id="life-date-error" className="mt-1.5 px-1 text-xs text-feedback-warning">
              {errors.date}
            </p>
          )}
          {fallsIn && (
            <p className="mt-2 px-1 text-xs text-muted-foreground">
              {t("life.form.fallsIn", { lords: fallsIn })}
            </p>
          )}

          <p className={cn(FORM_LABEL, "mt-5")}>{t("life.fields.valence")}</p>
          <div
            role="radiogroup"
            aria-label={t("life.fields.valence")}
            className="grid grid-cols-2 gap-2 sm:grid-cols-4"
          >
            {VALENCES.map((v) => {
              const selected = v === valence;
              return (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setValence(selected ? null : v)}
                  className={cn(
                    "tap-press flex min-h-11 items-center justify-center gap-2 rounded-xl px-2 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    selected
                      ? cn("bg-card", VALENCE_SELECTED[v])
                      : "bg-card text-muted-foreground shadow-[var(--as-elevation-1)]",
                  )}
                >
                  <span aria-hidden="true" className={cn("h-2 w-2 rounded-full", VALENCE_DOT[v])} />
                  {t(`life.valences.${v}`)}
                </button>
              );
            })}
          </div>

          <label htmlFor="life-description" className="sr-only">
            {t("life.fields.description")}
          </label>
          <textarea
            id="life-description"
            value={description ?? ""}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder={t("life.form.notePlaceholder")}
            enterKeyHint="enter"
            autoCapitalize="sentences"
            autoCorrect="on"
            spellCheck
            className="mt-5 w-full resize-none rounded-[0.875rem] bg-card px-4 py-3.5 text-base leading-snug text-foreground shadow-[var(--as-elevation-1)] placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          />
        </form>

        <DrawerFooter className="px-5 pt-0">
          <p className="text-center text-xs text-muted-foreground">{t("life.form.privacy")}</p>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
