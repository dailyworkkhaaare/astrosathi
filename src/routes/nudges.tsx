import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  CalendarClock,
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

function relativeTime(iso: string | null, t: (k: string, o?: Record<string, unknown>) => string): string {
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
      <div className="motion-fade-up flex items-center gap-2">
        <Link
          to="/"
          aria-label={t("common.back")}
          className="tap-press flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft size={18} aria-hidden="true" />
        </Link>
        <div className="min-w-0">
          <h1 className="font-display text-2xl leading-tight tracking-tight text-foreground sm:text-3xl">
            {t("nudges.title")}
          </h1>
          <p className="text-sm text-muted-foreground">{t("nudges.subtitle")}</p>
        </div>
      </div>

      {query.isLoading && (
        <div className="space-y-3" aria-hidden="true">
          <div className="h-32 animate-pulse rounded-2xl border border-border bg-card" />
          <div className="h-32 animate-pulse rounded-2xl border border-border bg-card" />
        </div>
      )}

      {!query.isLoading && query.isError && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5">
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
        <div className="motion-fade-up rounded-2xl border border-border bg-card p-6 text-center">
          <p className="text-base font-semibold text-foreground">{t("nudges.empty.title")}</p>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
            {t("nudges.empty.body")}
          </p>
        </div>
      )}

      {!query.isLoading && !query.isError && visible.length > 0 && (
        <div className="space-y-3">
          {visible.map((n) => (
            <NudgeCard key={n.id} nudge={n} onAct={onAct} onDismiss={onDismiss} />
          ))}
        </div>
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

  return (
    <article
      className={cn(
        "motion-fade-up rounded-2xl border bg-card p-5",
        isHigh ? "border-l-2 border-accent/60 border-y-border border-r-border bg-accent/[0.05]" : "border-border",
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
            isHigh ? "bg-accent/15 text-accent" : "bg-muted text-muted-foreground",
          )}
          aria-hidden="true"
        >
          <Icon size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {kindLabel}
            </span>
            {isHigh && (
              <span className="inline-flex items-center rounded-full border border-accent/40 bg-accent/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
                {t("nudges.priority.high")}
              </span>
            )}
            {when && (
              <span className="ml-auto text-[11px] text-muted-foreground">
                {relativeTime(when, t)}
              </span>
            )}
          </div>
          <h3 className="mt-1 text-base font-medium text-foreground">{nudge.title}</h3>
          {nudge.body && (
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{nudge.body}</p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
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
