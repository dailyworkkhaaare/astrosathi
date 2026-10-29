import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, MessageCircle, Share2 } from "lucide-react";
import { toast } from "sonner";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { useDailyHoroscope, type DailyHoroscopeReason } from "@/lib/queries";
import { shareNative, triggerHaptic } from "@/lib/native-device";
import { cn } from "@/lib/utils";

export function DailySignalHero() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const lang = (i18n.language || "en").slice(0, 2);
  const query = useDailyHoroscope(lang);
  const data = query.data;
  const reasons = data?.reasons?.summary.slice(0, 2) ?? [];
  const signal = data?.summary ? splitDailySummary(data.summary) : null;
  const compactMobileState = !query.isPending && (query.isError || data?.incomplete || !signal);

  const askAboutToday = () => {
    void triggerHaptic("selection");
    void navigate({
      to: "/chat",
      search: { seed: t("todayOverview.askSeed") },
    });
  };

  const shareToday = async () => {
    if (!signal) return;
    const result = await shareNative({
      title: t("todayOverview.shareTitle"),
      text: [signal.theme, signal.context].filter(Boolean).join("\n\n"),
      url: typeof window !== "undefined" ? window.location.href : undefined,
    });
    if (result === "shared") void triggerHaptic("success");
    if (result === "copied") toast.success(t("todayOverview.sharedCopied"));
  };

  return (
    <section
      aria-labelledby="daily-signal-heading"
      className={cn(
        "rounded-[1.25rem] bg-card px-[1.125rem] shadow-[var(--as-elevation-1)] sm:px-7",
        compactMobileState ? "py-4" : "pb-4 pt-[1.125rem] sm:py-7",
      )}
    >
      <div className="flex min-h-6 items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-accent [:lang(hi)_&]:tracking-normal [:lang(mr)_&]:tracking-normal">
          {t("todayOverview.personalized")}
        </p>
        {signal && !compactMobileState ? (
          <button
            type="button"
            onClick={() => void shareToday()}
            aria-label={t("todayOverview.share")}
            title={t("todayOverview.share")}
            className="tap-press -my-2.5 -mr-2.5 grid h-11 w-11 place-items-center rounded-full text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Share2 size={19} aria-hidden="true" />
          </button>
        ) : null}
      </div>

      {query.isPending ? (
        <DailySignalSkeleton label={t("todayOverview.loading")} />
      ) : query.isError ? (
        <SignalState
          title={t("todayOverview.unavailableTitle")}
          body={t("sections.horoscope.loadError")}
        >
          <Button
            type="button"
            variant="outline"
            className="rounded-full"
            onClick={() => query.refetch()}
          >
            {t("states.retry")}
          </Button>
          <AskButton onClick={askAboutToday} label={t("todayOverview.ask")} />
        </SignalState>
      ) : data?.incomplete ? (
        <SignalState
          title={t("todayOverview.completeTitle")}
          body={t("sections.horoscope.completeProfile")}
        >
          <Link
            to="/onboarding/birth"
            className="tap-press inline-flex min-h-11 items-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t("sections.horoscope.completeCta")}
          </Link>
        </SignalState>
      ) : !signal ? (
        <SignalState title={t("todayOverview.emptyTitle")} body={t("sections.horoscope.empty")}>
          <AskButton onClick={askAboutToday} label={t("todayOverview.ask")} />
        </SignalState>
      ) : (
        <div className="mt-3.5">
          <h2
            id="daily-signal-heading"
            className="max-w-3xl font-display text-[1.625rem] font-semibold leading-[1.2] text-foreground sm:text-4xl"
          >
            {signal.theme}
          </h2>
          {signal.context ? (
            <p className="mt-2.5 max-w-2xl text-[0.9375rem] leading-[1.45] text-muted-foreground sm:text-base">
              {signal.context}
            </p>
          ) : null}

          {data?.focus ? (
            <div className="mt-3.5 max-w-2xl rounded-xl bg-foreground/[0.05] px-3.5 py-3">
              <p className="text-xs font-semibold text-muted-foreground">
                {t("sections.horoscope.focusLabel")}
              </p>
              <p className="mt-1 text-[0.9375rem] text-foreground">{data.focus}</p>
            </div>
          ) : null}

          {reasons.length > 0 ? (
            <div className="mt-3.5">
              <p className="text-xs font-semibold text-muted-foreground">
                {t("todayOverview.evidence")}
              </p>
              <ul className="mt-2 grid grid-cols-[max-content_minmax(0,1fr)] items-center gap-x-3 gap-y-2">
                {reasons.map((reason, index) => (
                  <EvidenceItem key={`${reason.kind}-${index}`} reason={reason} />
                ))}
              </ul>
            </div>
          ) : null}

          <div className="mt-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
            <AskButton onClick={askAboutToday} label={t("todayOverview.ask")} wide />
            <Link
              to="/today/horoscope"
              className="tap-press inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full px-4 text-[0.9375rem] font-semibold text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {t("todayOverview.readFull")}
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
          <p className="mt-2 max-w-2xl text-xs leading-relaxed text-muted-foreground">
            {t("sections.horoscope.disclaimer")}
          </p>
        </div>
      )}
    </section>
  );
}

function AskButton({
  onClick,
  label,
  wide = false,
}: {
  onClick: () => void;
  label: string;
  wide?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "tap-press inline-flex min-h-[2.875rem] items-center justify-center gap-2 rounded-full bg-[var(--as-color-action-ask)] px-5 text-[0.9375rem] font-semibold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
        wide && "w-full sm:w-auto",
      )}
    >
      <MessageCircle size={17} aria-hidden="true" />
      {label}
    </button>
  );
}

function SignalState({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children: ReactNode;
}) {
  return (
    <div className="mt-3 max-w-xl">
      <h2
        id="daily-signal-heading"
        className="font-display text-xl font-semibold leading-tight text-foreground sm:text-2xl"
      >
        {title}
      </h2>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
      <div className="mt-3.5 flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function splitDailySummary(summary: string) {
  const normalized = summary.trim();
  const match = normalized.match(/^(.+?[.!?।])(?:\s+|$)([\s\S]*)$/u);
  if (!match) return { theme: normalized, context: "" };
  return { theme: match[1].trim(), context: match[2].trim() };
}

function EvidenceItem({ reason }: { reason: DailyHoroscopeReason }) {
  const { t } = useTranslation();
  return (
    <li className="col-span-2 grid grid-cols-subgrid items-center">
      <span className="rounded-full bg-foreground/[0.08] px-2.5 py-1 text-center text-xs text-muted-foreground">
        {t(`todayOverview.reasonKinds.${reason.kind}`)}
      </span>
      <p className="text-sm leading-snug text-foreground">{reason.text}</p>
    </li>
  );
}

function DailySignalSkeleton({ label }: { label: string }) {
  return (
    <div className="mt-3.5 space-y-3 sm:space-y-4" aria-busy="true" role="status">
      <h2 id="daily-signal-heading" className="sr-only">
        {label}
      </h2>
      <div
        className="h-8 w-11/12 motion-safe:animate-pulse rounded-lg bg-muted"
        aria-hidden="true"
      />
      <div className="h-8 w-3/4 motion-safe:animate-pulse rounded-lg bg-muted" aria-hidden="true" />
      <div
        className="h-14 max-w-2xl motion-safe:animate-pulse rounded-2xl bg-muted sm:h-20"
        aria-hidden="true"
      />
    </div>
  );
}
