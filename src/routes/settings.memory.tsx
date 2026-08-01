import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  ArrowLeft,
  Baby,
  Briefcase,
  Building2,
  ChevronDown,
  Download,
  GraduationCap,
  Heart,
  HeartPulse,
  Home as HomeIcon,
  Plane,
  Sparkles,
  Trash2,
  Users,
  UsersRound,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import { useRequireOnboarding } from "@/lib/require-auth";
import { cn } from "@/lib/utils";
import {
  ConfirmDialog,
  Divider,
  Group,
  Row,
  SegmentedGroup,
  Toggle,
} from "@/components/settings/primitives";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MEMORY_TOPICS,
  clearEmotionalState,
  deleteAllMemories,
  deleteTopicMemory,
  exportMemoryData,
  getEmotionalState,
  getMemoryProfile,
  listTopicMemories,
  resetLearnedPreferences,
  updateMemoryProfile,
  updateTopicMemoryRetention,
  type EmotionalState,
  type MemoryProfile,
  type MemoryTopic,
  type Retention,
  type TopicMemory,
} from "@/lib/memory-settings";

export const Route = createFileRoute("/settings/memory")({
  head: () => ({
    meta: [{ title: "Memory & Privacy — AstroSaathi" }],
  }),
  component: MemorySettingsPage,
});

const TOPIC_ICONS: Record<MemoryTopic, LucideIcon> = {
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
  family: UsersRound,
  other: Sparkles,
};

const RETENTION_VALUES: Retention[] = ["forever", "days_30", "chat", "never"];

const PREFERENCE_KEYS = [
  "preferred_language",
  "preferred_tone",
  "detail_level",
  "likes_tables",
  "remedies_first",
  "wants_practical",
  "likes_followup",
  "communication_style",
] as const;

function isExcludedFromAi(m: TopicMemory): boolean {
  if (m.retention === "never") return true;
  if (m.expires_at && new Date(m.expires_at).getTime() <= Date.now()) return true;
  return false;
}

function relativeTime(iso: string, t: ReturnType<typeof useTranslation>["t"]): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return t("settings.memory.time.justNow");
  if (minutes < 60) return t("settings.memory.time.minutesAgo", { n: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("settings.memory.time.hoursAgo", { n: hours });
  const days = Math.floor(hours / 24);
  if (days < 30) return t("settings.memory.time.daysAgo", { n: days });
  const months = Math.floor(days / 30);
  return t("settings.memory.time.monthsAgo", { n: months });
}

function formatDate(iso: string, lang: string): string {
  try {
    return new Date(iso).toLocaleDateString(lang, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}

function MemorySettingsPage() {
  useRequireOnboarding();
  const { t, i18n } = useTranslation();

  const [profile, setProfile] = useState<MemoryProfile | null>(null);
  const [topics, setTopics] = useState<TopicMemory[]>([]);
  const [emotional, setEmotional] = useState<EmotionalState | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmClearMood, setConfirmClearMood] = useState(false);
  const [confirmDeleteAllStep, setConfirmDeleteAllStep] = useState<0 | 1 | 2>(0);
  const [confirmResetPrefs, setConfirmResetPrefs] = useState(false);

  const loadAll = async () => {
    const [p, tm, es] = await Promise.all([getMemoryProfile(), listTopicMemories(), getEmotionalState()]);
    setProfile(p);
    setTopics(tm);
    setEmotional(es);
    setLoading(false);
  };

  useEffect(() => {
    void loadAll();
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<MemoryTopic, TopicMemory[]>();
    for (const topic of MEMORY_TOPICS) map.set(topic, []);
    for (const m of topics) {
      if (!map.has(m.topic)) map.set(m.topic, []);
      map.get(m.topic)!.push(m);
    }
    return map;
  }, [topics]);

  const moodActive =
    emotional && emotional.state && (!emotional.expires_at || new Date(emotional.expires_at).getTime() > Date.now());

  const preferenceEntries = useMemo(() => {
    const prefs = profile?.preferences ?? {};
    return PREFERENCE_KEYS.filter((k) => prefs[k] !== undefined && prefs[k] !== null && prefs[k] !== "").map(
      (k) => ({ key: k, value: prefs[k] }),
    );
  }, [profile]);

  const onToggleMemoryEnabled = async (checked: boolean) => {
    setProfile((p) => (p ? { ...p, memory_enabled: checked } : p));
    const { error } = await updateMemoryProfile({ memory_enabled: checked });
    if (error) {
      toast.error(t("settings.memory.toasts.error"));
      setProfile((p) => (p ? { ...p, memory_enabled: !checked } : p));
    } else {
      toast.success(t("settings.memory.toasts.saved"));
    }
  };

  const onChangeDefaultRetention = async (value: Retention) => {
    const prev = profile?.memory_default_retention;
    setProfile((p) => (p ? { ...p, memory_default_retention: value } : p));
    const { error } = await updateMemoryProfile({ memory_default_retention: value });
    if (error) {
      toast.error(t("settings.memory.toasts.error"));
      setProfile((p) => (p && prev ? { ...p, memory_default_retention: prev } : p));
    } else {
      toast.success(t("settings.memory.toasts.saved"));
    }
  };

  const onChangeCardRetention = async (id: string, value: Retention) => {
    const prevRow = topics.find((m) => m.id === id);
    setTopics((list) =>
      list.map((m) =>
        m.id === id
          ? {
              ...m,
              retention: value,
              expires_at:
                value === "days_30"
                  ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
                  : value === "never"
                    ? new Date().toISOString()
                    : null,
            }
          : m,
      ),
    );
    const { error } = await updateTopicMemoryRetention(id, value);
    if (error) {
      toast.error(t("settings.memory.toasts.error"));
      if (prevRow) setTopics((list) => list.map((m) => (m.id === id ? prevRow : m)));
    } else {
      toast.success(t("settings.memory.toasts.saved"));
    }
  };

  const onDeleteCard = async (id: string) => {
    setConfirmDeleteId(null);
    const prev = topics;
    setTopics((list) => list.filter((m) => m.id !== id));
    const { error } = await deleteTopicMemory(id);
    if (error) {
      toast.error(t("settings.memory.toasts.error"));
      setTopics(prev);
    } else {
      toast.success(t("settings.memory.toasts.deleted"));
    }
  };

  const onClearMood = async () => {
    setConfirmClearMood(false);
    const { error } = await clearEmotionalState();
    if (error) {
      toast.error(t("settings.memory.toasts.error"));
    } else {
      setEmotional(null);
      toast.success(t("settings.memory.toasts.deleted"));
    }
  };

  const onExport = async () => {
    const data = await exportMemoryData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "astrosaathi-memory.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(t("settings.memory.toasts.exported"));
  };

  const onDeleteAll = async () => {
    setConfirmDeleteAllStep(0);
    const { error, legacyFailed } = await deleteAllMemories();
    if (error) {
      toast.error(t("settings.memory.toasts.error"));
      return;
    }
    setTopics([]);
    setEmotional(null);
    if (legacyFailed) {
      toast.success(t("settings.memory.toasts.deletedAllPartial"));
    } else {
      toast.success(t("settings.memory.toasts.deletedAll"));
    }
  };

  const onResetPrefs = async () => {
    setConfirmResetPrefs(false);
    const { error } = await resetLearnedPreferences();
    if (error) {
      toast.error(t("settings.memory.toasts.error"));
    } else {
      setProfile((p) => (p ? { ...p, preferences: {} } : p));
      toast.success(t("settings.memory.toasts.saved"));
    }
  };

  return (
    <section className="mx-auto max-w-2xl space-y-6">
      <div className="motion-fade-up flex items-center gap-2">
        <Link
          to="/settings"
          aria-label={t("settings.memory.back")}
          className="tap-press flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft size={18} aria-hidden="true" />
        </Link>
        <h1 className="font-display text-2xl leading-tight tracking-tight text-foreground sm:text-3xl">
          {t("settings.memory.title")}
        </h1>
      </div>

      {loading ? (
        <div className="space-y-4" aria-hidden="true">
          <div className="h-24 animate-pulse rounded-2xl border border-border bg-card" />
          <div className="h-40 animate-pulse rounded-2xl border border-border bg-card" />
        </div>
      ) : (
        <>
          {/* 1. Master toggle */}
          <Group title={t("settings.memory.masterTitle")} delay={1}>
            <div className="flex items-start justify-between gap-3 px-4 py-3 min-h-11">
              <div className="min-w-0">
                <label htmlFor="memory-enabled" className="block text-sm font-medium text-foreground">
                  {t("settings.memory.masterLabel")}
                </label>
                <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
                  {t("settings.memory.masterHelp")}
                </p>
              </div>
              <Toggle
                id="memory-enabled"
                checked={profile?.memory_enabled ?? false}
                onChange={onToggleMemoryEnabled}
              />
            </div>
          </Group>

          {/* 2. Default retention */}
          <Group title={t("settings.memory.retentionTitle")} delay={2}>
            <div className="flex flex-col gap-3 px-4 py-3 min-h-11">
              <div>
                <span className="text-sm font-medium text-foreground">
                  {t("settings.memory.retentionLabel")}
                </span>
                <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
                  {t("settings.memory.retentionHelp")}
                </p>
              </div>
              <SegmentedGroup<Retention>
                name="default-retention"
                value={profile?.memory_default_retention ?? "forever"}
                onChange={onChangeDefaultRetention}
                options={RETENTION_VALUES.map((r) => ({
                  value: r,
                  label: t(`settings.memory.retentionOptions.${r}`),
                }))}
              />
            </div>
          </Group>

          {/* 3. Topic memories */}
          <div className="motion-fade-up motion-delay-3">
            <h2 className="mb-2.5 px-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {t("settings.memory.memoriesTitle")}
            </h2>
            {topics.length === 0 ? (
              <div className="rounded-xl border border-border bg-card p-5 text-center text-sm text-muted-foreground">
                {t("settings.memory.emptyAll")}
              </div>
            ) : (
              <div className="space-y-3">
                {MEMORY_TOPICS.filter((topic) => (grouped.get(topic)?.length ?? 0) > 0).map((topic) => (
                  <TopicSection
                    key={topic}
                    topic={topic}
                    items={grouped.get(topic) ?? []}
                    lang={i18n.language}
                    onChangeRetention={onChangeCardRetention}
                    onRequestDelete={setConfirmDeleteId}
                  />
                ))}
              </div>
            )}
          </div>

          {/* 4. Preferences (read-only) */}
          <Group title={t("settings.memory.prefsTitle")} delay={4}>
            <div className="px-4 py-3">
              {preferenceEntries.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("settings.memory.prefsEmpty")}</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {preferenceEntries.map(({ key, value }) => (
                    <span
                      key={key}
                      className="inline-flex items-center rounded-full border border-border bg-muted px-3 py-1.5 min-h-[32px] text-xs font-medium text-foreground"
                    >
                      {t(`settings.memory.prefKeys.${key}`)}
                      {typeof value === "boolean" ? (
                        <span className="ml-1 text-muted-foreground">
                          {value ? t("settings.memory.on") : t("settings.memory.off")}
                        </span>
                      ) : (
                        <span className="ml-1 text-muted-foreground">{String(value)}</span>
                      )}
                    </span>
                  ))}
                </div>
              )}
              <p className="mt-3 text-[11px] text-muted-foreground">{t("settings.memory.prefsCaption")}</p>
              {preferenceEntries.length > 0 && (
                <button
                  type="button"
                  onClick={() => setConfirmResetPrefs(true)}
                  className="tap-press mt-3 inline-flex min-h-11 items-center rounded-md px-1 text-xs font-medium text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {t("settings.memory.resetPrefs")}
                </button>
              )}
            </div>
          </Group>

          {/* 5. Current mood */}
          {moodActive && emotional?.state && (
            <div className="motion-fade-up rounded-2xl border border-accent/30 bg-accent/10 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-foreground">
                    {t("settings.memory.moodTitle")}
                  </h2>
                  {emotional.state.mood && (
                    <p className="mt-1 text-sm text-foreground">{emotional.state.mood}</p>
                  )}
                  {emotional.state.sensitivities && emotional.state.sensitivities.length > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {emotional.state.sensitivities.join(", ")}
                    </p>
                  )}
                  {emotional.state.guidance && emotional.state.guidance.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {emotional.state.guidance.map((g, i) => (
                        <li key={i} className="text-xs leading-relaxed text-muted-foreground">
                          {g}
                        </li>
                      ))}
                    </ul>
                  )}
                  {emotional.expires_at && (
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      {t("settings.memory.expiresIn", { date: formatDate(emotional.expires_at, i18n.language) })}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setConfirmClearMood(true)}
                  className="tap-press inline-flex min-h-11 shrink-0 items-center rounded-md px-2 text-xs font-medium text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {t("settings.memory.clearMood")}
                </button>
              </div>
            </div>
          )}

          {/* 6. Danger zone */}
          <Group title={t("settings.memory.dangerTitle")} delay={4}>
            <button
              type="button"
              onClick={onExport}
              className="tap-press flex w-full items-center justify-between px-4 py-3 min-h-11 text-left text-sm font-medium text-foreground transition-colors hover:bg-muted focus:outline-none focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            >
              <span className="inline-flex items-center gap-2">
                <Download size={15} aria-hidden="true" className="text-muted-foreground" />
                {t("settings.memory.export")}
              </span>
            </button>
            <Divider />
            <button
              type="button"
              onClick={() => setConfirmDeleteAllStep(1)}
              className="tap-press flex w-full items-center justify-between px-4 py-3 min-h-11 text-left text-sm font-medium text-foreground transition-colors hover:bg-accent/10 focus:outline-none focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            >
              <span className="inline-flex items-center gap-2">
                <Trash2 size={15} aria-hidden="true" className="text-accent" />
                {t("settings.memory.deleteAll")}
              </span>
            </button>
          </Group>
        </>
      )}

      {confirmDeleteId && (
        <ConfirmDialog
          title={t("settings.memory.deleteCardTitle")}
          body={t("settings.memory.deleteCardBody")}
          cancelLabel={t("settings.memory.cancel")}
          confirmLabel={t("settings.memory.confirm")}
          onCancel={() => setConfirmDeleteId(null)}
          onConfirm={() => onDeleteCard(confirmDeleteId)}
        />
      )}

      {confirmClearMood && (
        <ConfirmDialog
          title={t("settings.memory.clearMoodTitle")}
          body={t("settings.memory.clearMoodBody")}
          cancelLabel={t("settings.memory.cancel")}
          confirmLabel={t("settings.memory.confirm")}
          onCancel={() => setConfirmClearMood(false)}
          onConfirm={onClearMood}
        />
      )}

      {confirmResetPrefs && (
        <ConfirmDialog
          title={t("settings.memory.resetPrefsTitle")}
          body={t("settings.memory.resetPrefsBody")}
          cancelLabel={t("settings.memory.cancel")}
          confirmLabel={t("settings.memory.confirm")}
          onCancel={() => setConfirmResetPrefs(false)}
          onConfirm={onResetPrefs}
        />
      )}

      {confirmDeleteAllStep === 1 && (
        <ConfirmDialog
          title={t("settings.memory.deleteAllTitle")}
          body={t("settings.memory.deleteAllBody1")}
          cancelLabel={t("settings.memory.cancel")}
          confirmLabel={t("settings.memory.continue")}
          onCancel={() => setConfirmDeleteAllStep(0)}
          onConfirm={() => setConfirmDeleteAllStep(2)}
        />
      )}

      {confirmDeleteAllStep === 2 && (
        <ConfirmDialog
          title={t("settings.memory.deleteAllTitle")}
          body={t("settings.memory.deleteAllBody2")}
          cancelLabel={t("settings.memory.cancel")}
          confirmLabel={t("settings.memory.confirm")}
          onCancel={() => setConfirmDeleteAllStep(0)}
          onConfirm={onDeleteAll}
        />
      )}
    </section>
  );
}

function TopicSection({
  topic,
  items,
  lang,
  onChangeRetention,
  onRequestDelete,
}: {
  topic: MemoryTopic;
  items: TopicMemory[];
  lang: string;
  onChangeRetention: (id: string, value: Retention) => void;
  onRequestDelete: (id: string) => void;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(true);
  const Icon = TOPIC_ICONS[topic];

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-[var(--shadow-soft)]">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
        className="tap-press flex w-full items-center justify-between px-4 py-3 min-h-11 text-left focus:outline-none focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
          <Icon size={15} aria-hidden="true" className="text-accent" />
          {t(`settings.memory.topics.${topic}`)}
          <span className="text-xs font-normal text-muted-foreground">({items.length})</span>
        </span>
        <ChevronDown
          size={16}
          aria-hidden="true"
          className={cn("shrink-0 text-muted-foreground transition-transform", expanded && "rotate-180")}
        />
      </button>
      {expanded && (
        <div className="motion-fade-up space-y-3 border-t border-border/60 px-4 py-4">
          {items.map((m) => (
            <MemoryCard
              key={m.id}
              memory={m}
              lang={lang}
              onChangeRetention={onChangeRetention}
              onRequestDelete={onRequestDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MemoryCard({
  memory,
  lang,
  onChangeRetention,
  onRequestDelete,
}: {
  memory: TopicMemory;
  lang: string;
  onChangeRetention: (id: string, value: Retention) => void;
  onRequestDelete: (id: string) => void;
}) {
  const { t } = useTranslation();
  const excluded = isExcludedFromAi(memory);
  const summary =
    memory.summary && memory.summary.trim().length > 0
      ? memory.summary
      : compactData(memory.data);

  return (
    <div className="rounded-xl border border-border/60 bg-background p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-relaxed text-foreground">{summary}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-muted-foreground">
              {t("settings.memory.updated", { time: relativeTime(memory.updated_at, t) })}
            </span>
            {memory.expires_at && (
              <span className="inline-flex items-center rounded-full border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                {t("settings.memory.expires", { date: formatDate(memory.expires_at, lang) })}
              </span>
            )}
            {excluded && (
              <span className="inline-flex items-center rounded-full border border-muted-foreground/30 bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                {t("settings.memory.excludedFromAi")}
              </span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => onRequestDelete(memory.id)}
          aria-label={t("settings.memory.deleteCard")}
          className="tap-press flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-accent transition-colors hover:bg-accent/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Trash2 size={15} aria-hidden="true" />
        </button>
      </div>
      <div className="mt-3">
        <Select
          value={memory.retention}
          onValueChange={(v) => onChangeRetention(memory.id, v as Retention)}
        >
          <SelectTrigger className="h-9 w-full text-xs sm:w-44" aria-label={t("settings.memory.retentionLabel")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RETENTION_VALUES.map((r) => (
              <SelectItem key={r} value={r}>
                {t(`settings.memory.retentionOptions.${r}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function compactData(data: unknown): string {
  if (!data || typeof data !== "object") return "";
  try {
    const entries = Object.entries(data as Record<string, unknown>).slice(0, 4);
    return entries.map(([k, v]) => `${k}: ${String(v)}`).join(" · ");
  } catch {
    return "";
  }
}
