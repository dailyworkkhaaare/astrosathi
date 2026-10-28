import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, CircleAlert, Moon, RefreshCw, Settings2 } from "lucide-react";

import { useRequireOnboarding } from "@/lib/require-auth";
import { cn } from "@/lib/utils";
import { useActOnNudge, useDismissNudge, useSentNudges } from "@/lib/queries";
import type { NudgePriority, ProactiveNudge } from "@/lib/proactive";
import { triggerHaptic } from "@/lib/native-device";

type NudgesSearch = { focus?: string };

export const Route = createFileRoute("/nudges")({
  validateSearch: (search: Record<string, unknown>): NudgesSearch => {
    const focus = search.focus;
    return typeof focus === "string" && focus.length <= 100 ? { focus } : {};
  },
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
  const { focus } = Route.useSearch();
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

  useEffect(() => {
    if (!focus || query.isLoading || typeof window === "undefined") return;
    const frame = window.requestAnimationFrame(() => {
      const target = document.getElementById(`nudge-${focus}`);
      if (!target) return;
      const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      target.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
      target.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [focus, query.isLoading, visible]);

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
    void triggerHaptic("selection");
    removeOptimistic(id);
    try {
      const res = await actMutation.mutateAsync(id);
      if (res.error) throw new Error(res.error);
      void triggerHaptic("success");
      toast.success(t("nudges.toasts.acted"));
    } catch {
      restoreOptimistic(id);
      void triggerHaptic("error");
      toast.error(t("nudges.toasts.error"));
    }
  };
  const onDismiss = async (id: string) => {
    void triggerHaptic("selection");
    removeOptimistic(id);
    try {
      const res = await dismissMutation.mutateAsync(id);
      if (res.error) throw new Error(res.error);
      void triggerHaptic("success");
      toast.success(t("nudges.toasts.dismissed"));
    } catch {
      restoreOptimistic(id);
      void triggerHaptic("error");
      toast.error(t("nudges.toasts.error"));
    }
  };

  const onRefresh = () => {
    void triggerHaptic("selection");
    void query.refetch();
  };

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
        <div className="flex items-center">
          <button
            type="button"
            onClick={onRefresh}
            disabled={query.isFetching}
            aria-label={t("nudges.refresh")}
            title={t("nudges.refresh")}
            className="tap-press grid h-11 w-11 place-items-center rounded-full text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            <RefreshCw
              size={19}
              className={query.isFetching ? "animate-spin motion-reduce:animate-none" : ""}
              aria-hidden="true"
            />
          </button>
          <Link
            to="/settings/proactive"
            aria-label={t("settings.proactive.settingsAria")}
            className="tap-press grid h-11 w-11 place-items-center rounded-full text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Settings2 size={19} aria-hidden="true" />
          </Link>
        </div>
      </nav>

      <header className="motion-fade-up mt-1">
        <h1 className="large-title text-foreground">{t("nudges.title")}</h1>
        <p className="mt-1.5 text-[0.9375rem] leading-snug text-muted-foreground">
          {t("nudges.subtitle")}
        </p>
      </header>

      {query.isLoading && (
        <div className="mt-6 space-y-2" aria-hidden="true">
          <div className="h-28 motion-safe:animate-pulse rounded-[0.875rem] bg-card" />
          <div className="h-28 motion-safe:animate-pulse rounded-[0.875rem] bg-card" />
        </div>
      )}

      {!query.isLoading && query.isError && (
        <div
          role="alert"
          data-state="error"
          className="mt-6 flex items-center gap-3 rounded-[0.875rem] bg-card py-2 pl-4 pr-2 shadow-[var(--as-elevation-1)]"
        >
          <CircleAlert size={18} className="shrink-0 text-feedback-warning" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-sm text-foreground">{t("nudges.loadError")}</p>
          <button
            type="button"
            onClick={onRefresh}
            className="tap-press inline-flex min-h-11 shrink-0 items-center rounded-full px-3 text-sm font-semibold text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t("nudges.retry")}
          </button>
        </div>
      )}

      {!query.isLoading && !query.isError && visible.length === 0 && (
        <div className="motion-fade-up mt-10 flex flex-col items-center gap-1.5 px-8 text-center">
          <span className="mb-2 grid h-11 w-11 place-items-center rounded-full bg-accent/12 text-accent">
            <Moon size={20} aria-hidden="true" />
          </span>
          <p className="text-lg font-semibold text-foreground">{t("nudges.empty.title")}</p>
          <p className="max-w-xs text-[0.8125rem] leading-snug text-muted-foreground">
            {t("nudges.empty.body")}
          </p>
        </div>
      )}

      {!query.isLoading && !query.isError && visible.length > 0 && (
        <>
          <h2 className="mb-2 mt-7 px-4 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground [:lang(hi)_&]:tracking-normal [:lang(mr)_&]:tracking-normal">
            {t("nudges.newLabel")}
          </h2>
          <ol
            className="list-hairline overflow-hidden rounded-[0.875rem] bg-card shadow-[var(--as-elevation-1)] [--list-inset:2.25rem]"
            aria-label={t("nudges.title")}
          >
            {visible.map((n) => (
              <li key={n.id}>
                <NudgeCard nudge={n} onAct={onAct} onDismiss={onDismiss} focused={n.id === focus} />
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}

function NudgeCard({
  nudge,
  onAct,
  onDismiss,
  focused,
}: {
  nudge: ProactiveNudge;
  onAct: (id: string) => void;
  onDismiss: (id: string) => void;
  focused: boolean;
}) {
  const { t } = useTranslation();
  const kindLabel = t(`nudges.kinds.${nudge.kind}`, { defaultValue: t("nudges.kinds.other") });
  const priority = nudge.priority as NudgePriority;
  const isHigh = priority === "high";
  const when = nudge.sent_at ?? nudge.scheduled_for ?? nudge.created_at;
  const cardId = `nudge-${nudge.id}`;

  return (
    <article
      aria-labelledby={cardId}
      data-state={focused ? "targeted" : undefined}
      className={cn(
        "motion-fade-up flex scroll-mt-6 gap-0 py-3 pr-4",
        focused && "bg-accent/[0.07]",
      )}
    >
      <span aria-hidden="true" className="flex w-9 shrink-0 justify-center pt-[0.4375rem]">
        <span className={cn("h-2 w-2 rounded-full", isHigh ? "bg-accent" : "bg-transparent")} />
      </span>
      <div className="min-w-0 flex-1">
        <h2
          id={cardId}
          tabIndex={focused ? -1 : undefined}
          className="text-base font-semibold leading-snug text-foreground focus:outline-none"
        >
          {nudge.title}
        </h2>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
          <span>{kindLabel}</span>
          {when && (
            <>
              <span aria-hidden="true">·</span>
              <time dateTime={when}>{relativeTime(when, t)}</time>
            </>
          )}
          <span
            className={cn(
              "ml-0.5 rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold",
              isHigh ? "bg-accent/15 text-accent" : "bg-foreground/[0.07] text-muted-foreground",
            )}
          >
            {t(`nudges.priority.${priority}`, { defaultValue: t("nudges.priority.normal") })}
          </span>
        </div>
        {nudge.body && (
          <p className="mt-1.5 text-sm leading-snug text-muted-foreground">{nudge.body}</p>
        )}
        {nudge.topic && <p className="mt-1 text-xs text-accent">{nudge.topic}</p>}
        <div className="-ml-3 mt-1 flex items-center gap-1">
          <button
            type="button"
            onClick={() => onAct(nudge.id)}
            className="tap-press inline-flex min-h-11 items-center gap-1 rounded-full px-3 text-sm font-semibold text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t("nudges.act")}
            <ChevronRight size={15} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => onDismiss(nudge.id)}
            className="tap-press inline-flex min-h-11 items-center rounded-full px-3 text-sm font-semibold text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t("nudges.dismiss")}
          </button>
        </div>
      </div>
    </article>
  );
}
