import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  CalendarClock,
  Settings2,
  Moon,
  Orbit,
  Sparkles,
  X,
  type LucideIcon,
} from "lucide-react";

import { useRequireOnboarding } from "@/lib/require-auth";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useActOnNudge, useDismissNudge, useSentNudges } from "@/lib/queries";
import type { NudgePriority, ProactiveNudge } from "@/lib/proactive";

export const Route = createFileRoute("/nudges")({
  head: () => ({
    meta: [
      { title: "Nudges — AstroSaathi" },
      {
        name: "description",
        content: "Gentle notes from your chart when your daśā or transits shift.",
      },
      { property: "og:title", content: "Nudges — AstroSaathi" },
      {
        property: "og:description",
        content: "Gentle notes from your chart when your daśā or transits shift.",
      },
    ],
  }),
  component: NudgesPage,
});

const KIND_ICON: Record<string, LucideIcon> = {
  dasha_change: Orbit,
  sade_sati_phase: Moon,
  transit_alert: Sparkles,
  life_event_followup: CalendarClock,
};

function iconFor(kind: string): LucideIcon {
  return KIND_ICON[kind] ?? Bell;
}

function relativeTime(
  iso: string | null,
  t: (k: string, o?: Record<string, unknown>) => string,
): string {
  if (!iso) return "";
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return t("nudges.time.justNow");
  if (minutes < 60) return t("nudges.time.minutesAgo", { n: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("nudges.time.hoursAgo", { n: hours });
  const days = Math.floor(hours / 24);
  if (days < 30) return t("nudges.time.daysAgo", { n: days });
  const months = Math.floor(days / 30);
  return t("nudges.time.monthsAgo", { n: months });
}

function NudgesPage() {
  useRequireOnboarding();
  const { t } = useTranslation();
  const query = useSentNudges();
  const actMutation = useActOnNudge();
  const dismissMutation = useDismissNudge();

  // Optimistic local overlay: any ids we've hidden client-side pending server
  // ack. On refetch success the server list is the source of truth.
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());

  // Whenever a fresh server list arrives, drop optimistic ids that are no
  // longer in it — anything still there was a rollback we need to un-hide.
  useEffect(() => {
    if (!query.data) return;
    setHiddenIds((prev) => {
      if (prev.size === 0) return prev;
      const stillPresent = new Set(query.data.map((n) => n.id));
      const next = new Set<string>();
      for (const id of prev) if (stillPresent.has(id)) next.add(id);
      return next.size === prev.size ? prev : next;
    });
  }, [query.data]);

  const visible = useMemo(() => {
    const list = query.data ?? [];
    return list.filter((n) => !hiddenIds.has(n.id));
  }, [query.data, hiddenIds]);

  const removeOptimistic = (id: string) => {
    setHiddenIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };
  const restoreOptimistic = (id: string) => {
    setHiddenIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const onAct = async (id: string) => {
    removeOptimistic(id);
    try {
      const res = await actMutation.mutateAsync(id);
      if (res.error) throw new Error(res.error);
      toast.success(t("nudges.toasts.acted"));
    } catch {
      restoreOptimistic(id);
      toast.error(t("nudges.toasts.error"));
    }
  };
  const onDismiss = async (id: string) => {
    removeOptimistic(id);
    try {
      const res = await dismissMutation.mutateAsync(id);
      if (res.error) throw new Error(res.error);
      toast.success(t("nudges.toasts.dismissed"));
    } catch {
      restoreOptimistic(id);
      toast.error(t("nudges.toasts.error"));
    }
  };

  return (
    <section className="mx-auto max-w-2xl space-y-6">
      <header className="motion-fade-up rounded-[1.75rem] border border-border bg-card p-5 shadow-[0_16px_40px_-30px_hsl(var(--foreground)/0.42)] sm:p-6">
        <div className="flex items-start gap-3">
          <Link
            to="/"
            aria-label={t("common.back")}
            className="tap-press flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowLeft size={18} aria-hidden="true" />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-primary">
                  <span
                    className="grid h-8 w-8 place-items-center rounded-full bg-primary/10"
                    aria-hidden="true"
                  >
                    <Bell size={15} />
                  </span>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    {t("nudges.entryLabel")}
                  </span>
                </div>
                <h1 className="mt-3 font-display text-2xl leading-tight tracking-tight text-foreground sm:text-3xl">
                  {t("nudges.title")}
                </h1>
              </div>
              <Link
                to="/settings/proactive"
                aria-label={t("settings.proactive.title")}
                className="tap-press grid h-11 w-11 shrink-0 place-items-center rounded-full border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Settings2 size={17} aria-hidden="true" />
              </Link>
            </div>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
              {t("nudges.subtitle")}
            </p>
          </div>
        </div>
      </header>

      {query.isLoading && (
        <div className="space-y-3" aria-hidden="true">
          <div className="h-40 animate-pulse rounded-[1.5rem] border border-border bg-card" />
          <div className="h-40 animate-pulse rounded-[1.5rem] border border-border bg-card" />
        </div>
      )}

      {!query.isLoading && query.isError && (
        <div className="rounded-[1.5rem] border border-destructive/30 bg-destructive/5 p-5">
          <p className="text-sm text-foreground">{t("nudges.loadError")}</p>
          <button
            type="button"
            onClick={() => query.refetch()}
            className="tap-press mt-3 inline-flex min-h-11 items-center rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t("nudges.retry")}
          </button>
        </div>
      )}

      {!query.isLoading && !query.isError && visible.length === 0 && (
        <div className="motion-fade-up rounded-[1.5rem] border border-border bg-card p-6 text-center shadow-[0_16px_40px_-30px_hsl(var(--foreground)/0.42)]">
          <p className="text-base font-semibold text-foreground">{t("nudges.empty.title")}</p>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
            {t("nudges.empty.body")}
          </p>
        </div>
      )}

      {!query.isLoading && !query.isError && visible.length > 0 && (
        <ol className="space-y-3" aria-label={t("nudges.title")}>
          {visible.map((n) => (
            <li key={n.id}>
              <NudgeCard nudge={n} onAct={onAct} onDismiss={onDismiss} />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function NudgeCard({
  nudge,
  onAct,
  onDismiss,
}: {
  nudge: ProactiveNudge;
  onAct: (id: string) => void;
  onDismiss: (id: string) => void;
}) {
  const { t } = useTranslation();
  const Icon = iconFor(nudge.kind);
  const kindLabel = t(`nudges.kinds.${nudge.kind}`, { defaultValue: t("nudges.kinds.other") });
  const priority = nudge.priority as NudgePriority;
  const isHigh = priority === "high";
  const when = nudge.sent_at ?? nudge.scheduled_for ?? nudge.created_at;
  const cardId = `nudge-${nudge.id}`;

  return (
    <article
      aria-labelledby={cardId}
      className={cn(
        "motion-fade-up rounded-[1.5rem] border bg-card p-5 shadow-[0_16px_36px_-30px_hsl(var(--foreground)/0.4)]",
        isHigh ? "border-accent/50 bg-accent/[0.045]" : "border-border",
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-full border",
            isHigh
              ? "border-accent/30 bg-accent/15 text-accent"
              : "border-border bg-muted text-muted-foreground",
          )}
          aria-hidden="true"
        >
          <Icon size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {kindLabel}
            </span>
            <span
              className={cn(
                "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                isHigh
                  ? "border-accent/40 bg-accent/10 text-accent"
                  : "border-border bg-background text-muted-foreground",
              )}
            >
              {t(`nudges.priority.${priority}`, { defaultValue: t("nudges.priority.normal") })}
            </span>
            {when && (
              <time dateTime={when} className="ml-auto text-[11px] text-muted-foreground">
                {relativeTime(when, t)}
              </time>
            )}
          </div>
          <h2 id={cardId} className="mt-2 text-base font-semibold leading-snug text-foreground">
            {nudge.title}
          </h2>
          {nudge.body && (
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{nudge.body}</p>
          )}
          {nudge.topic && (
            <p className="mt-3 border-l-2 border-primary/35 pl-3 text-xs leading-relaxed text-muted-foreground">
              {nudge.topic}
            </p>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-border pt-4">
            <Button
              type="button"
              variant="primary"
              onClick={() => onAct(nudge.id)}
              className="min-h-11 gap-1.5"
            >
              <Sparkles size={14} aria-hidden="true" />
              <span>{t("nudges.act")}</span>
              <ArrowRight size={14} aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onDismiss(nudge.id)}
              className="min-h-11 gap-1.5 border border-border bg-background text-muted-foreground hover:text-foreground"
            >
              <X size={14} aria-hidden="true" />
              <span>{t("nudges.dismiss")}</span>
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}
