import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, type FormEvent, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, BookHeart, Plus, RefreshCw, Tag, Trash2, X } from "lucide-react";

import { useRequireOnboarding } from "@/lib/require-auth";
import { Button } from "@/components/ui/button";
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

function hasStampedContext(
  entry: JournalEntry,
): entry is JournalEntry & { astro_context: Extract<JournalEntry["astro_context"], { version: 1 }> } {
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
            {t("journal.title")}
          </h1>
          <p className="text-sm text-muted-foreground">{t("journal.subtitle")}</p>
        </div>
      </div>

      <Button
        type="button"
        variant="primary"
        onClick={() => setFormTarget("new")}
        className="w-full gap-2 min-h-11"
      >
        <Plus size={16} aria-hidden="true" />
        {t("journal.addEntry")}
      </Button>

      {entries.length === 0 && !entriesQuery.isLoading ? (
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
        <div className="space-y-6">
          {grouped.map(([key, monthEntries]) => (
            <div key={key} className="space-y-2.5">
              <h2 className="px-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {monthLabel(key, i18n.language)}
              </h2>
              <div className="space-y-2.5">
                {monthEntries.map((entry) => (
                  <EntryCard
                    key={entry.id}
                    entry={entry}
                    locale={i18n.language}
                    stamping={stampingIds.has(entry.id)}
                    onEdit={() => setFormTarget(entry)}
                    onDelete={() => setDeleteTarget(entry)}
                    onRefreshAstrology={() => onRefreshAstrology(entry.id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
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
  onRefreshAstrology,
}: {
  entry: JournalEntry;
  locale: string;
  stamping: boolean;
  onEdit: () => void;
  onDelete: () => void;
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
    <div className="motion-fade-up rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <button type="button" onClick={onEdit} className="min-w-0 flex-1 text-left">
          {entry.title && (
            <p className="truncate text-base font-semibold text-foreground">{entry.title}</p>
          )}
          <p
            className={cn(
              "text-xs text-muted-foreground",
              entry.title ? "mt-0.5" : "",
            )}
          >
            {formatEntryDate(entry.entry_date, locale)}
          </p>
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

      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
        {entry.content}
      </p>

      {(entry.mood || (entry.tags?.length ?? 0) > 0) && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
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
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <p className="text-xs italic text-accent">{contextLine}</p>
          {sadeSatiPhase && (
            <span className="inline-flex items-center rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-[11px] font-medium text-accent">
              {t("journal.context.sadeSati")} · {sadeSatiPhase}
            </span>
          )}
        </div>
      ) : (
        <div className="mt-3 flex items-center gap-2">
          <span className="inline-flex items-center rounded-md border border-border bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
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
        </div>
      )}
    </div>
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
      className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3
            id="journal-entry-form-title"
            className="text-base font-semibold text-foreground"
          >
            {isNew ? t("journal.addEntry") : t("journal.editEntry")}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("journal.cancel")}
            className="tap-press flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <form className="space-y-4" onSubmit={onSubmit} noValidate>
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
              className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            {errors.date && <p className="mt-1 text-xs text-accent">{errors.date}</p>}
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
              className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
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
              rows={6}
              placeholder={t("journal.fields.contentPlaceholder")}
              className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm leading-relaxed focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            {errors.content && <p className="mt-1 text-xs text-accent">{errors.content}</p>}
          </div>

          <div>
            <span className="mb-1 block text-sm font-medium text-foreground">
              {t("journal.fields.mood")}
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                {t("journal.fields.optional")}
              </span>
            </span>
            <div
              role="radiogroup"
              aria-label={t("journal.fields.mood")}
              className="flex flex-wrap gap-1.5"
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
                      "min-h-[36px] rounded-full border px-3 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      selected
                        ? difficult
                          ? "border-accent/60 bg-accent/10 text-accent"
                          : "border-primary/60 bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:text-foreground",
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
              className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="flex-1 border border-border bg-background"
            >
              {t("journal.cancel")}
            </Button>
            <Button type="submit" variant="primary" disabled={submitting} className="flex-1">
              {t("journal.save")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
