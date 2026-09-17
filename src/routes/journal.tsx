import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, type FormEvent, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, BookHeart, Plus, RefreshCw, Tag, Trash2, X } from "lucide-react";

import { useRequireOnboarding } from "@/lib/require-auth";
import { Button } from "@/components/ui/button";
import { JourneyAskDialog, type JourneyAskSource } from "@/components/journey/JourneyAskDialog";
import { ErrorState } from "@/components/states/ErrorState";
import { LoadingState } from "@/components/states/LoadingState";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/settings/primitives";
import {
  useCreateJournalEntry,
  useDeleteJournalEntry,
  useJournal,
  useRestampJournalEntry,
  useUpdateJournalEntry,
} from "@/lib/queries";
import {
  DIFFICULT_MOODS,
  MOODS,
  type JournalEntry,
  type JournalEntryInput,
  type Mood,
} from "@/lib/journal";

export const Route = createFileRoute("/journal")({
  head: () => ({
    meta: [
      { title: "Reflection Journal — AstroSaathi" },
      {
        name: "description",
        content: "Record how each period actually felt, stamped with the astrology of that day.",
      },
      { property: "og:title", content: "Reflection Journal — AstroSaathi" },
      {
        property: "og:description",
        content: "Record how each period actually felt, stamped with the astrology of that day.",
      },
    ],
  }),
  component: JournalPage,
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

function formatEntryDate(dateStr: string, locale: string): string {
  const d = parseLocalDate(dateStr);
  if (!d) return dateStr;
  return d.toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" });
}

function monthKey(dateStr: string): string {
  const d = parseLocalDate(dateStr);
  return d ? `${d.getFullYear()}-${pad2(d.getMonth() + 1)}` : "0000-00";
}

function monthLabel(key: string, locale: string): string {
  const [y, m] = key.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return Number.isNaN(d.getTime())
    ? key
    : d.toLocaleDateString(locale, { month: "long", year: "numeric" });
}

function hasStampedContext(entry: JournalEntry): entry is JournalEntry & {
  astro_context: Extract<JournalEntry["astro_context"], { version: 1 }>;
} {
  return (
    entry.context_status === "stamped" &&
    !!entry.astro_context &&
    "version" in entry.astro_context &&
    entry.astro_context.version === 1
  );
}

function buildContextLine(
  entry: JournalEntry,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string | null {
  if (!hasStampedContext(entry)) return null;
  const ctx = entry.astro_context;
  const parts: string[] = [];
  if (ctx.dasha.maha) {
    const lordChain = [ctx.dasha.maha.name, ctx.dasha.antar?.name].filter(Boolean).join("–");
    parts.push(`${t("journal.context.dasha")}: ${lordChain}`);
  }
  const transitParts: string[] = [];
  if (ctx.transits.saturn?.sign) {
    transitParts.push(t("journal.context.saturnIn", { sign: ctx.transits.saturn.sign }));
  }
  if (ctx.transits.jupiter?.sign) {
    transitParts.push(t("journal.context.jupiterIn", { sign: ctx.transits.jupiter.sign }));
  }
  if (transitParts.length > 0) parts.push(transitParts.join(", "));
  return parts.length > 0 ? parts.join(" · ") : null;
}

function sadeSatiPhaseLabel(
  phase: "rising" | "peak" | "setting" | null,
  t: (key: string) => string,
): string | null {
  if (!phase) return null;
  return t(`journal.context.phase.${phase}`);
}

function JournalPage() {
  useRequireOnboarding();
  const { t, i18n } = useTranslation();
  const entriesQuery = useJournal();
  const createMutation = useCreateJournalEntry();
  const updateMutation = useUpdateJournalEntry();
  const deleteMutation = useDeleteJournalEntry();
  const restampMutation = useRestampJournalEntry();
  const [stampingIds, setStampingIds] = useState<Set<string>>(new Set());

  const [formTarget, setFormTarget] = useState<JournalEntry | "new" | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<JournalEntry | null>(null);
  const [askSource, setAskSource] = useState<JourneyAskSource | null>(null);

  const entries = entriesQuery.data ?? [];

  // Group by year+month; entries already come back date-desc, so preserve that
  // order within each group and keep groups sorted by their month key.
  const grouped = useMemo(() => {
    const byMonth = new Map<string, JournalEntry[]>();
    for (const ev of entries) {
      const k = monthKey(ev.entry_date);
      const list = byMonth.get(k) ?? [];
      list.push(ev);
      byMonth.set(k, list);
    }
    return [...byMonth.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [entries]);

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
      <div className="motion-fade-up flex items-center gap-3">
        <Link
          to="/journey"
          aria-label={t("common.back")}
          className="tap-press flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft size={18} aria-hidden="true" />
        </Link>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {t("journal.eyebrow")}
          </p>
          <h1 className="font-display text-2xl leading-tight tracking-tight text-foreground sm:text-3xl">
            {t("journal.title")}
          </h1>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {t("journal.subtitle")}
          </p>
        </div>
      </div>

      <section className="motion-fade-up rounded-[1.5rem] border border-accent/20 bg-accent/[0.06] p-5">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-card text-accent ring-1 ring-accent/20">
            <BookHeart size={19} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-foreground">
              {t("journal.composerTitle")}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {t("journal.composerHint")}
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="primary"
          onClick={() => setFormTarget("new")}
          className="mt-4 w-full gap-2 min-h-11 sm:w-auto"
        >
          <Plus size={16} aria-hidden="true" />
          {t("journal.addEntry")}
        </Button>
      </section>

      {entriesQuery.isLoading ? (
        <LoadingState
          scope="panel"
          label={t("journal.loading")}
          description={t("journal.loadingBody")}
        />
      ) : entriesQuery.isError ? (
        <ErrorState
          scope="panel"
          title={t("journal.loadError")}
          description={t("journal.loadErrorBody")}
          onRetry={() => void entriesQuery.refetch()}
        />
      ) : entries.length === 0 ? (
        <div className="motion-fade-up rounded-2xl border border-border bg-card p-6 text-center">
          <div
            aria-hidden="true"
            className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-accent/10 text-accent ring-1 ring-accent/25"
          >
            <BookHeart size={20} />
          </div>
          <p className="text-base font-semibold text-foreground">{t("journal.empty.title")}</p>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
            {t("journal.empty.body")}
          </p>
        </div>
      ) : (
        <section aria-label={t("journal.timelineAria")} className="relative">
          <div
            aria-hidden="true"
            className="absolute bottom-5 left-[13px] top-5 w-px bg-border sm:left-[15px]"
          />
          <div className="relative space-y-8">
            {grouped.map(([key, monthEntries]) => (
              <section key={key} aria-labelledby={`journal-month-${key}`} className="relative">
                <div className="mb-3 flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="relative z-10 grid h-7 w-7 shrink-0 place-items-center rounded-full border border-accent/35 bg-background"
                  >
                    <span className="h-2 w-2 rounded-full bg-accent" />
                  </span>
                  <h2
                    id={`journal-month-${key}`}
                    className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground"
                  >
                    {monthLabel(key, i18n.language)}
                  </h2>
                </div>
                <ol className="space-y-3">
                  {monthEntries.map((entry) => (
                    <li key={entry.id} className="relative pl-10 sm:pl-12">
                      <span
                        aria-hidden="true"
                        className="absolute left-[9px] top-6 z-10 h-2.5 w-2.5 rounded-full border-2 border-background bg-primary ring-1 ring-primary/30 sm:left-[11px]"
                      />
                      <EntryCard
                        entry={entry}
                        locale={i18n.language}
                        stamping={stampingIds.has(entry.id)}
                        onEdit={() => setFormTarget(entry)}
                        onDelete={() => setDeleteTarget(entry)}
                        onAsk={() => {
                          const date = formatEntryDate(entry.entry_date, i18n.language);
                          setAskSource({
                            kind: "reflection",
                            title: entry.title || t("journey.untitledReflection"),
                            date,
                            draft: t("journey.askContext.reflectionDraft", {
                              date,
                              content: entry.content,
                            }),
                          });
                        }}
                        onRefreshAstrology={() => onRefreshAstrology(entry.id)}
                      />
                    </li>
                  ))}
                </ol>
              </section>
            ))}
          </div>
        </section>
      )}

      {formTarget && (
        <JournalEntryFormDialog
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
          title={t("journal.confirmDeleteTitle")}
          body={t("journal.confirmDeleteBody")}
          cancelLabel={t("journal.cancel")}
          confirmLabel={t("journal.delete")}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={async () => {
            await deleteMutation.mutateAsync(deleteTarget.id);
            setDeleteTarget(null);
          }}
        />
      )}

      <JourneyAskDialog source={askSource} onClose={() => setAskSource(null)} />
    </section>
  );
}

function MoodPill({ mood, t }: { mood: Mood; t: (key: string) => string }) {
  const difficult = DIFFICULT_MOODS.includes(mood);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        difficult
          ? "border-accent/40 bg-accent/10 text-accent"
          : "border-primary/30 bg-primary/10 text-foreground",
      )}
    >
      {t(`journal.moods.${mood}`)}
    </span>
  );
}

function EntryCard({
  entry,
  locale,
  stamping,
  onEdit,
  onDelete,
  onAsk,
  onRefreshAstrology,
}: {
  entry: JournalEntry;
  locale: string;
  stamping: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onAsk: () => void;
  onRefreshAstrology: () => void;
}) {
  const { t } = useTranslation();
  const contextLine = buildContextLine(entry, t);
  const stamped = hasStampedContext(entry);
  const sadeSatiPhase =
    stamped && entry.astro_context.sade_sati.active
      ? sadeSatiPhaseLabel(entry.astro_context.sade_sati.phase, t)
      : null;

  return (
    <article className="motion-fade-up rounded-[1.5rem] border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <div className="flex items-start justify-between gap-3">
        <button
          type="button"
          onClick={onEdit}
          className="min-w-0 flex-1 rounded-md text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            {formatEntryDate(entry.entry_date, locale)}
          </p>
          {entry.title && (
            <p className="mt-1 truncate text-base font-semibold text-foreground">{entry.title}</p>
          )}
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label={t("journal.delete")}
          className="tap-press flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent/10 hover:text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Trash2 size={15} aria-hidden="true" />
        </button>
      </div>

      <p className="mt-4 whitespace-pre-wrap text-[15px] leading-relaxed text-foreground">
        {entry.content}
      </p>

      <button
        type="button"
        onClick={onAsk}
        className="tap-press mt-3 inline-flex min-h-9 items-center rounded-lg px-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {t("journey.askContext.reflectionAction")}
      </button>

      {(entry.mood || (entry.tags?.length ?? 0) > 0) && (
        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          {entry.mood && <MoodPill mood={entry.mood} t={t} />}
          {entry.tags?.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
            >
              <Tag size={10} aria-hidden="true" />
              {tag}
            </span>
          ))}
        </div>
      )}

      {stamped && contextLine ? (
        <aside className="mt-4 rounded-2xl border border-accent/20 bg-accent/[0.06] px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {t("journal.context.label")}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <p className="text-xs leading-relaxed text-muted-foreground">{contextLine}</p>
            {sadeSatiPhase && (
              <span className="inline-flex items-center rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-[11px] font-medium text-accent">
                {t("journal.context.sadeSati")} · {sadeSatiPhase}
              </span>
            )}
          </div>
        </aside>
      ) : (
        <aside className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-muted/50 px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {t("journal.context.label")}
          </p>
          <span className="inline-flex items-center rounded-md border border-border bg-background px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
            {stamping
              ? t("journal.placingInChart")
              : entry.context_status === "error"
                ? t("journal.astrologyError")
                : t("journal.astrologyPending")}
          </span>
          {!stamping && (
            <button
              type="button"
              onClick={onRefreshAstrology}
              className="tap-press inline-flex min-h-[28px] items-center gap-1 text-[11px] font-medium text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <RefreshCw size={11} aria-hidden="true" />
              {t("journal.refreshAstrology")}
            </button>
          )}
        </aside>
      )}
    </article>
  );
}

function JournalEntryFormDialog({
  target,
  onClose,
  onCreate,
  onUpdate,
}: {
  target: JournalEntry | "new";
  onClose: () => void;
  onCreate: (input: JournalEntryInput) => Promise<void>;
  onUpdate: (id: string, patch: Partial<JournalEntryInput>) => Promise<void>;
}) {
  const { t } = useTranslation();
  const isNew = target === "new";
  const existing = isNew ? null : target;

  const [entryDate, setEntryDate] = useState(existing?.entry_date ?? todayStr());
  const [title, setTitle] = useState(existing?.title ?? "");
  const [content, setContent] = useState(existing?.content ?? "");
  const [mood, setMood] = useState<Mood | null>(existing?.mood ?? null);
  const [tags, setTags] = useState<string[]>(existing?.tags ?? []);
  const [tagDraft, setTagDraft] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const commitTag = (raw: string) => {
    const cleaned = raw.trim().replace(/^#/, "").slice(0, 32);
    if (!cleaned) return;
    setTags((prev) => (prev.includes(cleaned) ? prev : [...prev, cleaned]));
    setTagDraft("");
  };

  const onTagKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commitTag(tagDraft);
    } else if (e.key === "Backspace" && !tagDraft && tags.length > 0) {
      setTags((prev) => prev.slice(0, -1));
    }
  };

  const onSubmit = async (ev: FormEvent) => {
    ev.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!content.trim()) nextErrors.content = t("journal.errors.contentRequired");
    if (!entryDate) nextErrors.date = t("journal.errors.dateRequired");
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      // Fold any un-committed tag draft into the tag list.
      const pendingTag = tagDraft.trim();
      const finalTags = pendingTag && !tags.includes(pendingTag) ? [...tags, pendingTag] : tags;
      const payload: JournalEntryInput = {
        entry_date: entryDate,
        content: content.trim(),
        title: title.trim() || null,
        mood,
        tags: finalTags,
      };
      if (isNew) {
        await onCreate(payload);
      } else if (existing) {
        // Only send `entry_date` if it actually changed, so the queries hook
        // won't force a re-stamp on unrelated edits.
        const patch: Partial<JournalEntryInput> = {
          content: payload.content,
          title: payload.title,
          mood: payload.mood,
          tags: payload.tags,
        };
        if (existing.entry_date !== payload.entry_date) patch.entry_date = payload.entry_date;
        await onUpdate(existing.id, patch);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="journal-entry-form-title"
      aria-describedby="journal-entry-form-note"
      className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[1.75rem] border border-border bg-card p-5 shadow-[var(--shadow-elevated)] sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-accent/12 text-accent ring-1 ring-accent/25">
              <BookHeart size={19} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {t("journal.form.eyebrow")}
              </p>
              <h3
                id="journal-entry-form-title"
                className="mt-1 font-display text-xl font-semibold tracking-tight text-foreground"
              >
                {isNew ? t("journal.addEntry") : t("journal.editEntry")}
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("journal.cancel")}
            className="tap-press flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <p
          id="journal-entry-form-note"
          className="mb-6 text-sm leading-relaxed text-muted-foreground"
        >
          {t("journal.form.intro")}
        </p>

        <form className="space-y-6" onSubmit={onSubmit} noValidate>
          <section aria-labelledby="journal-reflection-title" className="space-y-4">
            <div>
              <h4 id="journal-reflection-title" className="text-sm font-semibold text-foreground">
                {t("journal.form.reflection")}
              </h4>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {t("journal.form.reflectionHint")}
              </p>
            </div>
            <div>
              <label
                htmlFor="journal-content"
                className="mb-1 block text-sm font-medium text-foreground"
              >
                {t("journal.fields.content")}
              </label>
              <textarea
                id="journal-content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={7}
                placeholder={t("journal.fields.contentPlaceholder")}
                aria-invalid={!!errors.content}
                aria-describedby={errors.content ? "journal-content-error" : undefined}
                className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm leading-relaxed focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              {errors.content && (
                <p id="journal-content-error" className="mt-1 text-xs text-accent">
                  {errors.content}
                </p>
              )}
            </div>
            <div>
              <label
                htmlFor="journal-title"
                className="mb-1 block text-sm font-medium text-foreground"
              >
                {t("journal.fields.title")}
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  {t("journal.fields.optional")}
                </span>
              </label>
              <input
                id="journal-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("journal.fields.titlePlaceholder")}
                className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </section>

          <section aria-labelledby="journal-timing-title" className="space-y-3">
            <div>
              <h4 id="journal-timing-title" className="text-sm font-semibold text-foreground">
                {t("journal.form.timing")}
              </h4>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {t("journal.form.timingHint")}
              </p>
            </div>
            <div>
              <label
                htmlFor="journal-date"
                className="mb-1 block text-sm font-medium text-foreground"
              >
                {t("journal.fields.date")}
              </label>
              <input
                id="journal-date"
                type="date"
                value={entryDate}
                max={todayStr()}
                onChange={(e) => setEntryDate(e.target.value)}
                aria-invalid={!!errors.date}
                aria-describedby={errors.date ? "journal-date-error" : undefined}
                className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              {errors.date && (
                <p id="journal-date-error" className="mt-1 text-xs text-accent">
                  {errors.date}
                </p>
              )}
            </div>
          </section>

          <section aria-labelledby="journal-details-title" className="space-y-4">
            <div>
              <h4 id="journal-details-title" className="text-sm font-semibold text-foreground">
                {t("journal.form.details")}
              </h4>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {t("journal.form.detailsHint")}
              </p>
            </div>
            <div>
              <span className="mb-2 block text-sm font-medium text-foreground">
                {t("journal.fields.mood")}
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  {t("journal.fields.optional")}
                </span>
              </span>
              <div
                role="radiogroup"
                aria-label={t("journal.fields.mood")}
                className="grid grid-cols-2 gap-2 sm:grid-cols-4"
              >
                {MOODS.map((m) => {
                  const selected = m === mood;
                  const difficult = DIFFICULT_MOODS.includes(m);
                  return (
                    <button
                      key={m}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setMood(selected ? null : m)}
                      className={cn(
                        "min-h-11 rounded-xl border px-3 text-left text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        selected
                          ? difficult
                            ? "border-accent/60 bg-accent/10 text-accent"
                            : "border-primary/60 bg-primary/10 text-primary"
                          : "border-border bg-background text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {t(`journal.moods.${m}`)}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label
                htmlFor="journal-tags"
                className="mb-1 block text-sm font-medium text-foreground"
              >
                {t("journal.fields.tags")}
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  {t("journal.fields.tagsHint")}
                </span>
              </label>
              {tags.length > 0 && (
                <div className="mb-1.5 flex flex-wrap gap-1.5">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                    >
                      <Tag size={10} aria-hidden="true" />
                      {tag}
                      <button
                        type="button"
                        onClick={() => setTags((prev) => prev.filter((x) => x !== tag))}
                        aria-label={t("journal.removeTag", { tag })}
                        className="tap-press ml-0.5 rounded-full p-0.5 text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <X size={10} aria-hidden="true" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <input
                id="journal-tags"
                type="text"
                value={tagDraft}
                onChange={(e) => setTagDraft(e.target.value)}
                onKeyDown={onTagKeyDown}
                onBlur={() => tagDraft.trim() && commitTag(tagDraft)}
                placeholder={t("journal.fields.tagsPlaceholder")}
                className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </section>

          <div className="rounded-2xl border border-accent/20 bg-accent/[0.06] px-4 py-3 text-sm leading-relaxed text-muted-foreground">
            {t("journal.form.contextNote")}
          </div>

          <div className="flex gap-2 border-t border-border pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="flex-1 border border-border bg-background"
            >
              {t("journal.cancel")}
            </Button>
            <Button type="submit" variant="primary" disabled={submitting} className="flex-1">
              {submitting ? t("journal.saving") : t("journal.save")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
