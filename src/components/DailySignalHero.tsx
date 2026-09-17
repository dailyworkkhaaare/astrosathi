import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Check, MessageCircle, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { useDailyHoroscope, type DailyHoroscopeReason } from "@/lib/queries";

export function DailySignalHero() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const lang = (i18n.language || "en").slice(0, 2);
  const query = useDailyHoroscope(lang);
  const data = query.data;
  const reasons = data?.reasons?.summary.slice(0, 2) ?? [];
  const signal = data?.summary ? splitDailySummary(data.summary) : null;

  const askAboutToday = () => {
    void navigate({
      to: "/chat",
      search: { seed: t("todayOverview.askSeed") },
    });
  };

  return (
    <section
      aria-labelledby="daily-signal-heading"
      className="relative isolate min-h-72 overflow-hidden rounded-[1.75rem] border border-accent/20 bg-card px-5 py-6 shadow-[var(--shadow-elevated)] sm:px-7 sm:py-8"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-20 -z-10 h-52 w-52 rounded-full bg-[radial-gradient(circle,rgba(242,153,29,0.19),rgba(242,153,29,0)_68%)]"
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-accent">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-accent/15">
            <Sparkles size={15} aria-hidden="true" />
          </span>
          {t("todayOverview.personalized")}
        </p>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background/70 px-3 py-1.5 text-xs font-medium text-muted-foreground">
          <Check size={13} className="text-accent" aria-hidden="true" />
          {t("todayOverview.chartGrounded")}
        </span>
      </div>

      {query.isPending ? (
        <DailySignalSkeleton label={t("todayOverview.loading")} />
      ) : query.isError ? (
        <div className="mt-7 max-w-xl">
          <h2 id="daily-signal-heading" className="font-display text-2xl text-foreground">
            {t("todayOverview.unavailableTitle")}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {t("sections.horoscope.loadError")}
          </p>
          <Button type="button" variant="outline" className="mt-5" onClick={() => query.refetch()}>
            {t("states.retry")}
          </Button>
        </div>
      ) : data?.incomplete ? (
        <div className="mt-7 max-w-xl">
          <h2 id="daily-signal-heading" className="font-display text-2xl text-foreground">
            {t("todayOverview.completeTitle")}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {t("sections.horoscope.completeProfile")}
          </p>
          <Link
            to="/onboarding/birth"
            className="tap-press mt-5 inline-flex min-h-11 items-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t("sections.horoscope.completeCta")}
          </Link>
        </div>
      ) : !signal ? (
        <div className="mt-7 max-w-xl">
          <h2 id="daily-signal-heading" className="font-display text-2xl text-foreground">
            {t("todayOverview.emptyTitle")}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">{t("sections.horoscope.empty")}</p>
        </div>
      ) : (
        <div className="mt-7">
          <h2
            id="daily-signal-heading"
            className="max-w-3xl font-display text-2xl leading-[1.2] tracking-tight text-foreground sm:text-4xl"
          >
            {signal.theme}
          </h2>
          {signal.context ? (
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              {signal.context}
            </p>
          ) : null}

          {data?.focus ? (
            <div className="mt-6 max-w-2xl rounded-2xl border border-accent/20 bg-accent/[0.06] px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
                {t("sections.horoscope.focusLabel")}
              </p>
              <p className="mt-1.5 text-sm font-medium leading-relaxed text-foreground">
                {data.focus}
              </p>
            </div>
          ) : null}

          {reasons.length > 0 ? (
            <div className="mt-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {t("todayOverview.evidence")}
              </p>
              <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                {reasons.map((reason, index) => (
                  <EvidenceItem key={`${reason.kind}-${index}`} reason={reason} />
                ))}
              </ul>
            </div>
          ) : null}

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Button type="button" onClick={askAboutToday} className="gap-2 rounded-full px-5">
              <MessageCircle size={16} aria-hidden="true" />
              {t("todayOverview.ask")}
            </Button>
            <Link
              to="/today/horoscope"
              className="tap-press inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-sm font-semibold text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {t("todayOverview.readFull")}
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
          <p className="mt-3 max-w-2xl text-xs leading-relaxed text-muted-foreground">
            {t("sections.horoscope.disclaimer")}
          </p>
        </div>
      )}
    </section>
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
    <li className="rounded-xl border border-border/70 bg-background/65 px-3.5 py-3">
      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {t(`todayOverview.reasonKinds.${reason.kind}`)}
      </span>
      <p className="mt-1 text-xs leading-relaxed text-foreground">{reason.text}</p>
    </li>
  );
}

function DailySignalSkeleton({ label }: { label: string }) {
  return (
    <div className="mt-7 space-y-4" aria-busy="true">
      <h2 id="daily-signal-heading" className="sr-only">
        {label}
      </h2>
      <div className="h-8 w-11/12 animate-pulse rounded-lg bg-muted" />
      <div className="h-8 w-3/4 animate-pulse rounded-lg bg-muted" />
      <div className="h-20 max-w-2xl animate-pulse rounded-2xl bg-muted" />
    </div>
  );
}
