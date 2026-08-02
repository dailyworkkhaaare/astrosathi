import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Plus, RefreshCw, Trash2, X } from "lucide-react";

import { useRequireOnboarding } from "@/lib/require-auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
  return d.toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" });
}

function eventYear(dateStr: string): number {
  const d = parseLocalDate(dateStr);
  return d ? d.getFullYear() : 0;
}

function buildContextLine(
  event: LifeEvent,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string | null {
  const ctx = event.astro_context;
  if (!ctx || !("version" in ctx) || ctx.version !== 1) return null;
  const parts: string[] = [];
  if (ctx.dasha.maha) {
    const lordChain = [ctx.dasha.maha.name, ctx.dasha.antar?.name].filter(Boolean).join("–");
    parts.push(`${t("life.context.dasha")}: ${lordChain}`);
  }
  if (ctx.sade_sati.active && ctx.sade_sati.phase) {
    const phaseKey =
      ctx.sade_sati.phase === "rising"
        ? "life.context.phaseRising"
        : ctx.sade_sati.phase === "peak"
          ? "life.context.phasePeak"
          : "life.context.phaseSetting";
    parts.push(`${t("life.context.sadeSati")} (${t(phaseKey)})`);
  }
  if (ctx.transits.jupiter.sign) {
    parts.push(t("life.context.transitIn", { sign: ctx.transits.jupiter.sign }));
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

const VALENCE_TOKEN: Record<Valence, string> = {
  positive: "bg-primary",
  neutral: "bg-primary",
  mixed: "bg-primary",
  negative: "bg-destructive",
};

// Calm, muted per-graha tones — copied from DashaTimeline.tsx so the life
// ribbon reads as the same instrument as the Home daśā timeline. Deliberately
// avoids accent/primary (reserved for the "now" marker + event markers here)
// and any red-adjacent chart tone.
const MAHA_TONE_BY_PLANET_ID: Record<number, { bg: string; ring: string }> = {
  0: { bg: "bg-muted-foreground/28", ring: "ring-muted-foreground/50" },
  1: { bg: "bg-foreground/14", ring: "ring-foreground/32" },
  2: { bg: "bg-foreground/14", ring: "ring-foreground/32" },
  3: { bg: "bg-chart-4/25", ring: "ring-chart-4/50" },
  4: { bg: "bg-secondary-foreground/20", ring: "ring-secondary-foreground/42" },
  5: { bg: "bg-chart-4/25", ring: "ring-chart-4/50" },
  6: { bg: "bg-muted-foreground/28", ring: "ring-muted-foreground/50" },
  101: { bg: "bg-chart-2/25", ring: "ring-chart-2/50" },
  102: { bg: "bg-chart-2/25", ring: "ring-chart-2/50" },
};
const DEFAULT_MAHA_TONE = { bg: "bg-muted", ring: "ring-border" };
function mahaToneFor(id: number) {
  return MAHA_TONE_BY_PLANET_ID[id] ?? DEFAULT_MAHA_TONE;
}

function fmtRibbonYear(ms: number): string {
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? "" : String(d.getUTCFullYear());
}

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
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const events = eventsQuery.data ?? [];

  const grouped = useMemo(() => {
    const byYear = new Map<number, LifeEvent[]>();
    for (const ev of events) {
      const y = eventYear(ev.event_date);
      const list = byYear.get(y) ?? [];
      list.push(ev);
      byYear.set(y, list);
    }
    return [...byYear.entries()].sort((a, b) => a[0] - b[0]);
  }, [events]);

  const scrollToEvent = (id: string) => {
    const el = cardRefs.current.get(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightId(id);
    setTimeout(() => setHighlightId((cur) => (cur === id ? null : cur)), 1600);
  };

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

  return (
    <section className="mx-auto max-w-2xl space-y-6">
      <div className="motion-fade-up flex items-center gap-2">
        <Link
          to="/settings"
          aria-label={t("common.back")}
          className="tap-press flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft size={18} aria-hidden="true" />
        </Link>
        <div className="min-w-0">
          <h1 className="font-display text-2xl leading-tight tracking-tight text-foreground sm:text-3xl">
            {t("life.title")}
          </h1>
          <p className="text-sm text-muted-foreground">{t("life.subtitle")}</p>
        </div>
      </div>

      <DashaRibbon
        events={events}
        periods={dashaQuery.data?.periods ?? []}
        balanceDuration={
          dashaQuery.data?.balance?.duration != null
            ? String(dashaQuery.data.balance.duration)
            : null
        }
        isLoading={dashaQuery.isLoading}
        onMarkerClick={scrollToEvent}
      />

      <Button
        type="button"
        variant="primary"
        onClick={() => setFormTarget("new")}
        className="w-full gap-2 min-h-11"
      >
        <Plus size={16} aria-hidden="true" />
        {t("life.addEvent")}
      </Button>

      {events.length === 0 && !eventsQuery.isLoading ? (
        <div className="motion-fade-up rounded-2xl border border-border bg-card p-6 text-center">
          <p className="text-base font-semibold text-foreground">{t("life.empty.title")}</p>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
            {t("life.empty.body")}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([year, yearEvents]) => (
            <div key={year} className="space-y-2.5">
              <h2 className="px-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {year}
              </h2>
              <div className="space-y-2.5">
                {yearEvents.map((ev) => (
                  <EventCard
                    key={ev.id}
                    event={ev}
                    locale={i18n.language}
                    highlighted={highlightId === ev.id}
                    stamping={stampingIds.has(ev.id)}
                    cardRef={(el) => {
                      if (el) cardRefs.current.set(ev.id, el);
                      else cardRefs.current.delete(ev.id);
                    }}
                    onEdit={() => setFormTarget(ev)}
                    onDelete={() => setDeleteTarget(ev)}
                    onRefreshAstrology={() => onRefreshAstrology(ev.id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {formTarget && (
        <LifeEventFormDialog
          target={formTarget}
          onClose={() => setFormTarget(null)}
          onCreate={async (input) => {
            await createMutation.mutateAsync(input);
            setFormTarget(null);
          }}
          onUpdate={async (id, patch) => {
            await updateMutation.mutateAsync({ id, patch });
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
            setDeleteTarget(null);
          }}
        />
      )}
    </section>
  );
}

function DashaRibbon({
  events,
  periods,
  balanceDuration,
  isLoading,
  onMarkerClick,
}: {
  events: LifeEvent[];
  periods: { id: number; name: string; start: string; end: string }[];
  balanceDuration: string | null;
  isLoading: boolean;
  onMarkerClick: (id: string) => void;
}) {
  const { t } = useTranslation();
  const cycle = periods.slice(0, 9);
  if (isLoading || cycle.length === 0) return null;

  // The first mahadasha starts before birth (Vimshottari periods run from the
  // natal nakshatra, not from birth) — clamp the ribbon to actually start at
  // birth so it never shows years the user wasn't alive for.
  const birthMs = birthMsFromDasha(cycle[0].end, balanceDuration) ?? Date.parse(cycle[0].start);
  const rangeStartMs = birthMs;
  const rangeEndMs = Date.parse(cycle[cycle.length - 1].end);
  const totalMs = rangeEndMs - rangeStartMs;
  if (!Number.isFinite(totalMs) || totalMs <= 0) return null;

  const nowMs = Date.now();
  const showNow = nowMs >= rangeStartMs && nowMs <= rangeEndMs;
  const nowPct = showNow ? ((nowMs - rangeStartMs) / totalMs) * 100 : null;

  const markers = events
    .map((ev) => {
      const ms = Date.parse(`${ev.event_date}T12:00:00Z`);
      if (!Number.isFinite(ms) || ms < rangeStartMs || ms > rangeEndMs) return null;
      const leftPct = ((ms - rangeStartMs) / totalMs) * 100;
      const tone: string =
        ev.valence && ev.valence in VALENCE_TOKEN ? VALENCE_TOKEN[ev.valence] : "bg-primary";
      return { id: ev.id, leftPct, tone, title: ev.title };
    })
    .filter((m): m is { id: string; leftPct: number; tone: string; title: string } => m !== null);

  return (
    <div
      className="motion-fade-up rounded-2xl border border-border bg-card/60 p-4 sm:p-5"
      style={{ boxShadow: "var(--shadow-soft)" }}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {t("life.context.dasha")}
        </h2>
        <span className="text-[10px] tabular-nums text-muted-foreground">
          {fmtRibbonYear(rangeStartMs)}–{fmtRibbonYear(rangeEndMs)}
        </span>
      </div>

      <div className="overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <div className="relative min-w-[640px]">
          {showNow && nowPct !== null && (
            <div
              className="pointer-events-none absolute top-0 z-10 -translate-x-1/2"
              style={{ left: `${nowPct}%` }}
            >
              <span className="whitespace-nowrap rounded-full bg-foreground px-1.5 py-0.5 text-[9px] font-semibold text-background shadow-sm">
                {t("sections.dasha.youAreHere")}
              </span>
            </div>
          )}

          <div className="relative mt-6">
            {showNow && nowPct !== null && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 z-10 w-px bg-foreground/40"
                style={{ left: `${nowPct}%` }}
              />
            )}

            <div className="relative h-6">
              {markers.map((m) => (
                <div
                  key={m.id}
                  className="absolute top-0 -translate-x-1/2"
                  style={{ left: `${m.leftPct}%` }}
                >
                  <div
                    aria-hidden="true"
                    className="mx-auto h-3 w-px bg-border"
                    style={{ marginTop: "6px" }}
                  />
                  <button
                    type="button"
                    title={m.title}
                    aria-label={m.title}
                    onClick={() => onMarkerClick(m.id)}
                    className={cn(
                      "tap-press absolute -top-1 left-1/2 -translate-x-1/2 rounded-full border-2 border-card shadow-sm transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      m.tone,
                      "h-3.5 w-3.5",
                    )}
                  />
                </div>
              ))}
            </div>

            <div
              className="flex h-11 overflow-hidden rounded-full ring-1 ring-border/60"
              aria-label={t("life.context.dasha")}
            >
              {cycle.map((p) => {
                const pStartMs = Math.max(Date.parse(p.start), rangeStartMs);
                const pEndMs = Date.parse(p.end);
                if (pEndMs <= rangeStartMs) return null;
                const spanMs = pEndMs - pStartMs;
                const widthPct = (spanMs / totalMs) * 100;
                const tone = mahaToneFor(p.id);
                return (
                  <div
                    key={`${p.id}-${p.start}`}
                    style={{ flexBasis: `${widthPct}%` }}
                    title={p.name}
                    className={cn(
                      "flex shrink-0 grow-0 items-center justify-center overflow-hidden border-r border-background/40 px-1 text-center transition-colors last:border-r-0 hover:brightness-95",
                      tone.bg,
                    )}
                  >
                    {widthPct > 6 && (
                      <span className="truncate text-[10px] font-medium text-foreground">
                        {p.name}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-1.5 flex justify-between text-[10px] tabular-nums text-muted-foreground">
              <span>{fmtRibbonYear(rangeStartMs)}</span>
              <span>{fmtRibbonYear(rangeEndMs)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function EventCard({
  event,
  locale,
  highlighted,
  stamping,
  cardRef,
  onEdit,
  onDelete,
  onRefreshAstrology,
}: {
  event: LifeEvent;
  locale: string;
  highlighted: boolean;
  stamping: boolean;
  cardRef: (el: HTMLDivElement | null) => void;
  onEdit: () => void;
  onDelete: () => void;
  onRefreshAstrology: () => void;
}) {
  const { t } = useTranslation();
  const contextLine = buildContextLine(event, t);
  const hasContext = !!event.astro_context && "version" in event.astro_context;

  return (
    <div
      ref={cardRef}
      className={`motion-fade-up rounded-xl border bg-card p-4 transition-colors duration-[var(--motion-standard)] ${
        highlighted ? "border-accent/60 bg-accent/[0.05]" : "border-border"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <button type="button" onClick={onEdit} className="min-w-0 flex-1 text-left">
          <p className="truncate text-base font-semibold text-foreground">{event.title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {formatEventDate(event.event_date, event.date_precision, locale)}
            {event.date_precision === "approx" && (
              <span className="ml-1.5 inline-flex items-center rounded-md border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                {t("life.approxTag")}
              </span>
            )}
          </p>
        </button>
        <div className="flex shrink-0 items-center gap-1">
          {event.valence && (
            <span
              aria-hidden="true"
              className={`h-2.5 w-2.5 rounded-full ${VALENCE_TOKEN[event.valence] ?? "bg-primary"}`}
            />
          )}
          <button
            type="button"
            onClick={onDelete}
            aria-label={t("life.delete")}
            className="tap-press flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent/10 hover:text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Trash2 size={15} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center rounded-md border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-foreground">
          {t(`life.categories.${event.category}`)}
        </span>
      </div>

      {event.description && (
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{event.description}</p>
      )}

      {hasContext && contextLine ? (
        <p className="mt-2.5 text-xs italic text-accent">{contextLine}</p>
      ) : (
        <div className="mt-2.5 flex items-center gap-2">
          <span className="inline-flex items-center rounded-md border border-border bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
            {stamping ? t("life.placingInChart") : t("life.astrologyPending")}
          </span>
          {!stamping && (
            <button
              type="button"
              onClick={onRefreshAstrology}
              className="tap-press inline-flex min-h-[28px] items-center gap-1 text-[11px] font-medium text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <RefreshCw size={11} aria-hidden="true" />
              {t("life.refreshAstrology")}
            </button>
          )}
        </div>
      )}
    </div>
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

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="life-event-form-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 id="life-event-form-title" className="text-base font-semibold text-foreground">
            {isNew ? t("life.addEvent") : t("life.editEvent")}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("life.cancel")}
            className="tap-press flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <form className="space-y-4" onSubmit={onSubmit} noValidate>
          <div>
            <label htmlFor="life-title" className="mb-1 block text-sm font-medium text-foreground">
              {t("life.fields.title")}
            </label>
            <input
              id="life-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            {errors.title && <p className="mt-1 text-xs text-accent">{errors.title}</p>}
          </div>

          <div>
            <label
              htmlFor="life-description"
              className="mb-1 block text-sm font-medium text-foreground"
            >
              {t("life.fields.description")}
            </label>
            <textarea
              id="life-description"
              value={description ?? ""}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <div>
            <label htmlFor="life-category" className="mb-1 block text-sm font-medium text-foreground">
              {t("life.fields.category")}
            </label>
            <select
              id="life-category"
              value={category}
              onChange={(e) => setCategory(e.target.value as LifeEventCategory)}
              className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {t(`life.categories.${c}`)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="life-date" className="mb-1 block text-sm font-medium text-foreground">
              {t("life.fields.date")}
            </label>
            <input
              id="life-date"
              type="date"
              value={eventDate}
              max={todayStr()}
              onChange={(e) => setEventDate(e.target.value)}
              className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            {errors.date && <p className="mt-1 text-xs text-accent">{errors.date}</p>}
          </div>

          <div>
            <span className="mb-1 block text-sm font-medium text-foreground">
              {t("life.fields.precision")}
            </span>
            <div
              role="radiogroup"
              aria-label={t("life.fields.precision")}
              className="flex flex-wrap gap-1.5"
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
                    className={`min-h-[36px] rounded-full border px-3 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      selected
                        ? "border-primary/60 bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {t(`life.precisions.${p}`)}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <span className="mb-1 block text-sm font-medium text-foreground">
              {t("life.fields.valence")}
            </span>
            <div
              role="radiogroup"
              aria-label={t("life.fields.valence")}
              className="flex flex-wrap gap-1.5"
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
                    className={`min-h-[36px] rounded-full border px-3 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      selected
                        ? v === "negative"
                          ? "border-accent/60 bg-accent/10 text-accent"
                          : "border-primary/60 bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {t(`life.valences.${v}`)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="flex-1 border border-border bg-background"
            >
              {t("life.cancel")}
            </Button>
            <Button type="submit" variant="primary" disabled={submitting} className="flex-1">
              {t("life.save")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
