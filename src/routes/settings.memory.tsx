import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  Baby,
  Briefcase,
  Building2,
  Check,
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
  Group,
  IconTile,
  SettingsBackHeader,
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
    return new Date(iso).toLocaleDateString(lang, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
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
    const [p, tm, es] = await Promise.all([
      getMemoryProfile(),
      listTopicMemories(),
      getEmotionalState(),
    ]);
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
    emotional &&
    emotional.state &&
    (!emotional.expires_at || new Date(emotional.expires_at).getTime() > Date.now());

  const preferenceEntries = useMemo(() => {
    const prefs = profile?.preferences ?? {};
    return PREFERENCE_KEYS.filter(
      (k) => prefs[k] !== undefined && prefs[k] !== null && prefs[k] !== "",
    ).map((k) => ({ key: k, value: prefs[k] }));
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
    <section className="mx-auto max-w-2xl space-y-7">
      <SettingsBackHeader
        title={t("settings.memory.title")}
        backLabel={t("settings.memory.back")}
        subtitle={t("settings.memory.masterHelp")}
      />

      {loading ? (
        <div className="space-y-7" aria-hidden="true">
          <div className="h-11 rounded-[0.875rem] bg-card motion-safe:animate-pulse" />
          <div className="h-40 rounded-[0.875rem] bg-card motion-safe:animate-pulse" />
        </div>
      ) : (
        <>
          <Group
            title={t("settings.memory.masterTitle")}
            footer={t("settings.memory.masterDetail")}
            delay={1}
          >
            <div className="flex min-h-11 items-center justify-between gap-3 py-1.5 pl-4 pr-2">
              <label
                htmlFor="memory-enabled"
                className="min-w-0 text-[1.0625rem] leading-snug text-foreground"
              >
                {t("settings.memory.masterLabel")}
              </label>
              <Toggle
                id="memory-enabled"
                ariaLabel={t("settings.memory.masterLabel")}
                checked={profile?.memory_enabled ?? false}
                onChange={onToggleMemoryEnabled}
              />
            </div>
          </Group>

          <Group title={t("settings.memory.disclosureTitle")} delay={1}>
            <div className="list-hairline text-[0.8125rem] leading-snug text-muted-foreground">
              <DisclosureItem
                label={t("settings.memory.disclosure.conversationLabel")}
                description={t("settings.memory.disclosure.conversationDescription")}
              />
              <DisclosureItem
                label={t("settings.memory.disclosure.topicsLabel")}
                description={t("settings.memory.disclosure.topicsDescription")}
              />
              <DisclosureItem
                label={t("settings.memory.disclosure.preferencesLabel")}
                description={t("settings.memory.disclosure.preferencesDescription")}
              />
              <DisclosureItem
                label={t("settings.memory.disclosure.moodLabel")}
                description={t("settings.memory.disclosure.moodDescription")}
              />
              <DisclosureItem
                label={t("settings.memory.disclosure.profileLabel")}
                description={t("settings.memory.disclosure.profileDescription")}
              />
            </div>
          </Group>

          <Group
            title={t("settings.memory.retentionTitle")}
            footer={t("settings.memory.retentionDetail")}
            delay={2}
          >
            <div
              role="radiogroup"
              aria-label={t("settings.memory.retentionLabel")}
              className="list-hairline"
            >
              {RETENTION_VALUES.map((r) => {
                const selected = (profile?.memory_default_retention ?? "forever") === r;
                return (
                  <button
                    key={r}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => void onChangeDefaultRetention(r)}
                    className={ACTION_ROW + " justify-between gap-3 text-foreground"}
                  >
                    <span>{t(`settings.memory.retentionOptions.${r}`)}</span>
                    {selected ? (
                      <Check
                        size={20}
                        strokeWidth={2.5}
                        aria-hidden="true"
                        className="text-accent"
                      />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </Group>

          <div className="motion-fade-up motion-delay-3">
            <h2 className={SECTION_LABEL}>{t("settings.memory.memoriesTitle")}</h2>
            {topics.length === 0 ? (
              <div className="rounded-[0.875rem] bg-card px-4 py-6 text-center text-[0.9375rem] text-muted-foreground shadow-[var(--as-elevation-1)]">
                {t("settings.memory.emptyAll")}
              </div>
            ) : (
              <div className="space-y-3">
                {MEMORY_TOPICS.filter((topic) => (grouped.get(topic)?.length ?? 0) > 0).map(
                  (topic) => (
                    <TopicSection
                      key={topic}
                      topic={topic}
                      items={grouped.get(topic) ?? []}
                      lang={i18n.language}
                      onChangeRetention={onChangeCardRetention}
                      onRequestDelete={setConfirmDeleteId}
                    />
                  ),
                )}
              </div>
            )}
            <p className="mt-2 px-4 text-[0.8125rem] leading-snug text-muted-foreground">
              {t("settings.memory.memoriesHint")}
            </p>
          </div>

          <Group
            title={t("settings.memory.prefsTitle")}
            footer={t("settings.memory.prefsCaption")}
            delay={4}
          >
            <div className="list-hairline">
              {preferenceEntries.length === 0 ? (
                <p className="px-4 py-3 text-[0.9375rem] text-muted-foreground">
                  {t("settings.memory.prefsEmpty")}
                </p>
              ) : (
                preferenceEntries.map(({ key, value }) => (
                  <div
                    key={key}
                    className="flex min-h-11 items-center justify-between gap-3 px-4 py-2"
                  >
                    <span className="min-w-0 text-[0.9375rem] text-foreground">
                      {t(`settings.memory.prefKeys.${key}`)}
                    </span>
                    <span className="min-w-0 truncate text-right text-[0.9375rem] text-muted-foreground">
                      {typeof value === "boolean"
                        ? value
                          ? t("settings.memory.on")
                          : t("settings.memory.off")
                        : String(value)}
                    </span>
                  </div>
                ))
              )}
              {preferenceEntries.length > 0 && (
                <button
                  type="button"
                  onClick={() => setConfirmResetPrefs(true)}
                  className={ACTION_ROW + " text-accent"}
                >
                  {t("settings.memory.resetPrefs")}
                </button>
              )}
            </div>
          </Group>

          {moodActive && emotional?.state && (
            <Group
              title={t("settings.memory.moodTitle")}
              footer={t("settings.memory.moodCaption")}
              delay={4}
            >
              <div className="list-hairline">
                <div className="px-4 py-3">
                  {emotional.state.mood && (
                    <p className="text-[0.9375rem] text-foreground">{emotional.state.mood}</p>
                  )}
                  {emotional.state.sensitivities && emotional.state.sensitivities.length > 0 && (
                    <p className="mt-1 text-[0.8125rem] text-muted-foreground">
                      {emotional.state.sensitivities.join(", ")}
                    </p>
                  )}
                  {emotional.state.guidance && emotional.state.guidance.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {emotional.state.guidance.map((g, i) => (
                        <li key={i} className="text-[0.8125rem] leading-snug text-muted-foreground">
                          {g}
                        </li>
                      ))}
                    </ul>
                  )}
                  {emotional.expires_at && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {t("settings.memory.expiresIn", {
                        date: formatDate(emotional.expires_at, i18n.language),
                      })}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setConfirmClearMood(true)}
                  className={ACTION_ROW + " text-accent"}
                >
                  {t("settings.memory.clearMood")}
                </button>
              </div>
            </Group>
          )}

          <Group
            title={t("settings.memory.dangerTitle")}
            footer={t("settings.memory.dangerHint")}
            delay={4}
          >
            <div className="list-hairline [--list-inset:3.75rem]">
              <button type="button" onClick={onExport} className={ACTION_ROW + " gap-3"}>
                <IconTile>
                  <Download size={17} />
                </IconTile>
                <span className="text-[1.0625rem] text-foreground">
                  {t("settings.memory.export")}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setConfirmDeleteAllStep(1)}
                className={ACTION_ROW + " gap-3"}
              >
                <IconTile tone="warning">
                  <Trash2 size={17} />
                </IconTile>
                <span className="text-[1.0625rem] text-destructive-strong">
                  {t("settings.memory.deleteAll")}
                </span>
              </button>
            </div>
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

const SECTION_LABEL =
  "mb-2 px-4 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground [:lang(hi)_&]:tracking-normal [:lang(mr)_&]:tracking-normal";
const ACTION_ROW =
  "tap-press flex min-h-11 w-full items-center px-4 py-2 text-left text-[1.0625rem] transition-colors hover:bg-foreground/[0.04] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring";

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
    <div className="list-hairline overflow-hidden rounded-[0.875rem] bg-card text-card-foreground shadow-[var(--as-elevation-1)] [--list-inset:1rem]">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
        className="tap-press flex min-h-11 w-full items-center gap-3 px-4 py-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <IconTile>
          <Icon size={17} />
        </IconTile>
        <span className="min-w-0 flex-1 text-[1.0625rem] font-semibold text-foreground">
          {t(`settings.memory.topics.${topic}`)}
        </span>
        <span className="text-[0.9375rem] tabular-nums text-muted-foreground">{items.length}</span>
        <ChevronDown
          size={16}
          aria-hidden="true"
          className={cn(
            "shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none",
            expanded && "rotate-180",
          )}
        />
      </button>
      {expanded &&
        items.map((m) => (
          <MemoryCard
            key={m.id}
            memory={m}
            lang={lang}
            onChangeRetention={onChangeRetention}
            onRequestDelete={onRequestDelete}
          />
        ))}
    </div>
  );
}

function DisclosureItem({ label, description }: { label: string; description: string }) {
  return (
    <p className="px-4 py-2.5">
      <span className="font-semibold text-foreground">{label}</span> {description}
    </p>
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
    memory.summary && memory.summary.trim().length > 0 ? memory.summary : compactData(memory.data);

  return (
    <div className="pb-1 pl-4 pr-1.5 pt-3">
      <p className="pr-2.5 text-[0.9375rem] leading-snug text-foreground">{summary}</p>
      <p className="mt-1 pr-2.5 text-xs leading-snug text-muted-foreground">
        {[
          t("settings.memory.updated", { time: relativeTime(memory.updated_at, t) }),
          memory.expires_at
            ? t("settings.memory.expires", { date: formatDate(memory.expires_at, lang) })
            : null,
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>
      <p
        className={cn(
          "mt-1 inline-flex items-center gap-1.5 text-xs font-medium",
          excluded ? "text-muted-foreground" : "text-accent",
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            excluded ? "bg-muted-foreground/50" : "bg-accent",
          )}
        />
        {excluded ? t("settings.memory.excludedFromAi") : t("settings.memory.availableToAi")}
      </p>
      <div className="mt-0.5 flex items-center justify-between gap-2">
        <Select
          value={memory.retention}
          onValueChange={(v) => onChangeRetention(memory.id, v as Retention)}
        >
          <SelectTrigger
            className="-ml-1 h-11 w-auto min-w-0 gap-1.5 border-0 bg-transparent px-1 text-[0.8125rem] font-medium text-muted-foreground shadow-none focus:ring-0 focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={t("settings.memory.retentionLabel")}
          >
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
        <button
          type="button"
          onClick={() => onRequestDelete(memory.id)}
          aria-label={t("settings.memory.deleteCard")}
          className="tap-press grid h-11 w-11 shrink-0 place-items-center rounded-full text-destructive-strong transition-colors hover:bg-destructive/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Trash2 size={17} aria-hidden="true" />
        </button>
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
