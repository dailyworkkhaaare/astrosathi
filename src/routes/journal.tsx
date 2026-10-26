import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, type FormEvent, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import {
  BookHeart,
  ChevronLeft,
  CircleAlert,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  Search,
  SquarePen,
  Tag,
  Trash2,
  X,
} from "lucide-react";

import { useRequireOnboarding } from "@/lib/require-auth";
import { Button } from "@/components/ui/button";
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

function shortEntryDate(dateStr: string, locale: string): string {
  const d = parseLocalDate(dateStr);
  if (!d) return dateStr;
  return d.toLocaleDateString(locale === "en" ? "en-IN" : locale, {
    day: "numeric",
    month: "short",
  });
}

const MOOD_DOT: Record<Mood, string> = {
  happy: "bg-accent",
  hopeful: "bg-accent",
  calm: "bg-feedback-success",
  neutral: "bg-muted-foreground",
  confused: "bg-feedback-warning",
  anxious: "bg-feedback-warning",
  sad: "bg-feedback-warning",
  angry: "bg-feedback-warning",
};

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
  const [query, setQuery] = useState("");

  const entries = useMemo(() => entriesQuery.data ?? [], [entriesQuery.data]);

  // Group by year+month; entries already come back date-desc, so preserve that
  // order within each group and keep groups sorted by their month key.
  const grouped = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    const byMonth = new Map<string, JournalEntry[]>();
    for (const ev of entries) {
      if (
        q &&
        ![ev.title ?? "", ev.content, ...(ev.tags ?? [])].some((s) =>
          s.toLocaleLowerCase().includes(q),
        )
      ) {
        continue;
      }
      const k = monthKey(ev.entry_date);
      const list = byMonth.get(k) ?? [];
      list.push(ev);
      byMonth.set(k, list);
    }
    return [...byMonth.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [entries, query]);

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

  const hasEntries = !entriesQuery.isLoading && !entriesQuery.isError && entries.length > 0;

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
        {hasEntries && (
          <button
            type="button"
            onClick={() => setFormTarget("new")}
            aria-label={t("journal.addEntry")}
            title={t("journal.addEntry")}
            className="tap-press grid h-11 w-11 place-items-center rounded-full text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <SquarePen size={20} aria-hidden="true" />
          </button>
        )}
      </nav>

      <header className="motion-fade-up mt-1">
        <h1 className="large-title text-foreground">{t("journal.title")}</h1>
        <p className="mt-1.5 text-[0.9375rem] leading-snug text-muted-foreground">
          {t("journal.subtitle")}
        </p>
      </header>

      {entriesQuery.isLoading ? (
        <div role="status" aria-label={t("journal.loading")} className="mt-6 space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 motion-safe:animate-pulse rounded-[0.875rem] bg-card" />
          ))}
        </div>
      ) : entriesQuery.isError ? (
        <div
          role="alert"
          data-state="error"
          className="mt-6 flex items-center gap-3 rounded-[0.875rem] bg-card py-2 pl-4 pr-2 shadow-[var(--as-elevation-1)]"
        >
          <CircleAlert size={18} className="shrink-0 text-feedback-warning" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">{t("journal.loadError")}</p>
            <p className="text-xs text-muted-foreground">{t("journal.loadErrorBody")}</p>
          </div>
          <button
            type="button"
            onClick={() => void entriesQuery.refetch()}
            className="tap-press inline-flex min-h-11 shrink-0 items-center rounded-full px-3 text-sm font-semibold text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t("states.retry")}
          </button>
        </div>
      ) : entries.length === 0 ? (
        <div
          data-state="empty"
          className="motion-fade-up mt-8 flex flex-col items-center gap-1.5 rounded-[1.25rem] bg-card px-6 py-8 text-center shadow-[var(--as-elevation-1)]"
        >
          <span className="mb-2 grid h-11 w-11 place-items-center rounded-[0.875rem] bg-accent/12 text-accent">
            <BookHeart size={20} aria-hidden="true" />
          </span>
          <p className="text-base font-semibold text-foreground">{t("journal.empty.title")}</p>
          <p className="max-w-xs text-[0.8125rem] leading-snug text-muted-foreground">
            {t("journal.empty.body")}
          </p>
          <button
            type="button"
            onClick={() => setFormTarget("new")}
            className="tap-press mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-full bg-accent/15 px-5 text-sm font-semibold text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <SquarePen size={16} aria-hidden="true" />
            {t("journal.addEntry")}
          </button>
        </div>
      ) : (
        <>
          <div role="search" className="relative mt-4">
            <label htmlFor="journal-search" className="sr-only">
              {t("journal.searchLabel")}
            </label>
            <Search
              size={16}
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              id="journal-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("journal.searchPlaceholder")}
              enterKeyHint="search"
              className="h-11 w-full rounded-xl bg-foreground/[0.07] pl-9 pr-3 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            />
          </div>

          {grouped.length === 0 ? (
            <div role="status" className="flex flex-col gap-1.5 px-8 py-12 text-center">
              <p className="text-base font-semibold text-foreground">{t("journal.noMatches")}</p>
              <p className="text-xs text-muted-foreground">{t("journal.noMatchesHint")}</p>
            </div>
          ) : (
            <div role="region" aria-label={t("journal.timelineAria")}>
              {grouped.map(([key, monthEntries]) => (
                <section
                  key={key}
                  aria-labelledby={`journal-month-${key}`}
                  className="motion-fade-up mt-6"
                >
                  <h2
                    id={`journal-month-${key}`}
                    className="mb-2 px-4 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground [:lang(hi)_&]:tracking-normal [:lang(mr)_&]:tracking-normal"
                  >
                    {monthLabel(key, i18n.language)}
                  </h2>
                  <ul className="list-hairline overflow-hidden rounded-[0.875rem] bg-card shadow-[var(--as-elevation-1)] [--list-inset:2.375rem]">
                    {monthEntries.map((entry) => (
                      <EntryRow
                        key={entry.id}
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
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
          <p className="mt-4 text-center text-xs text-muted-foreground">{t("journal.privacy")}</p>
        </>
      )}

      {formTarget && (
        <JournalEntryFormDialog
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
          title={t("journal.confirmDeleteTitle")}
          body={t("journal.confirmDeleteBody")}
          cancelLabel={t("journal.cancel")}
          confirmLabel={t("journal.delete")}
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

function EntryRow({
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
  const title = entry.title || t("journey.untitledReflection");
  const stamped = hasStampedContext(entry);
  return (
    <li className="flex items-center pr-1">
      <button
        type="button"
        onClick={onEdit}
        className="tap-press flex min-h-16 min-w-0 flex-1 items-center gap-3 py-3 pl-4 pr-1 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        {entry.mood ? (
          <span
            role="img"
            aria-label={t(`journal.moods.${entry.mood}`)}
            className={cn("h-2 w-2 shrink-0 rounded-full", MOOD_DOT[entry.mood])}
          />
        ) : (
          <span aria-hidden="true" className="h-2 w-2 shrink-0" />
        )}
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex items-baseline justify-between gap-2.5">
            <span className="truncate text-base font-semibold text-foreground">{title}</span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {shortEntryDate(entry.entry_date, locale)}
            </span>
          </span>
          <span className="truncate text-sm text-muted-foreground">{entry.content}</span>
        </span>
      </button>
      <button
        type="button"
        onClick={onAsk}
        aria-label={t("journey.askContext.reflectionAction")}
        title={t("journey.askContext.reflectionAction")}
        className="tap-press grid h-11 w-11 shrink-0 place-items-center rounded-full text-[var(--as-color-action-ask)] hover:bg-foreground/[0.06] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <MessageCircle size={18} aria-hidden="true" />
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={t("life.rowOptions", { title })}
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
            {t("journal.editEntry")}
          </DropdownMenuItem>
          {!stamped && !stamping && (
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
            {t("journal.delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
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
    <Drawer open onOpenChange={(open) => !open && onClose()} shouldScaleBackground={false}>
      <DrawerContent
        aria-describedby="journal-entry-form-note"
        className="bg-card sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:max-h-[min(42rem,calc(100dvh-2rem))] sm:w-full sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl"
      >
        <DrawerHeader className="flex flex-row items-start justify-between gap-4 px-5 pb-4 pt-5 text-left sm:px-6">
          <div className="flex min-w-0 items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-accent/12 text-accent ring-1 ring-accent/25">
              <BookHeart size={19} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {t("journal.form.eyebrow")}
              </p>
              <DrawerTitle className="mt-1 font-display text-xl font-semibold tracking-tight text-foreground">
                {isNew ? t("journal.addEntry") : t("journal.editEntry")}
              </DrawerTitle>
            </div>
          </div>
          <DrawerClose asChild>
            <button
              type="button"
              aria-label={t("journal.cancel")}
              className="tap-press flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </DrawerClose>
        </DrawerHeader>

        <form
          id="journal-entry-form"
          className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 pb-5 sm:px-6"
          onSubmit={onSubmit}
          noValidate
        >
          <DrawerDescription
            id="journal-entry-form-note"
            className="mb-6 text-sm leading-relaxed text-muted-foreground"
          >
            {t("journal.form.intro")}
          </DrawerDescription>

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
                enterKeyHint="enter"
                autoCapitalize="sentences"
                autoCorrect="on"
                spellCheck
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
                enterKeyHint="next"
                autoCapitalize="sentences"
                autoCorrect="on"
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
                enterKeyHint="next"
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
                enterKeyHint="done"
                autoCapitalize="none"
                autoCorrect="off"
                className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </section>

          <div className="rounded-2xl border border-accent/20 bg-accent/[0.06] px-4 py-3 text-sm leading-relaxed text-muted-foreground">
            {t("journal.form.contextNote")}
          </div>
        </form>

        <DrawerFooter className="flex-row gap-2 px-5 sm:px-6">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            className="flex-1 border border-border bg-background"
          >
            {t("journal.cancel")}
          </Button>
          <Button
            type="submit"
            form="journal-entry-form"
            variant="primary"
            disabled={submitting}
            className="flex-1"
          >
            {submitting ? t("journal.saving") : t("journal.save")}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
