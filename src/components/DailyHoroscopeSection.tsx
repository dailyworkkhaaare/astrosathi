import { Link } from "@tanstack/react-router";
import { Briefcase, ChevronDown, Heart, Leaf, Sparkles, Sun } from "lucide-react";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";

import { useDailyHoroscope, type DailyHoroscopeReason } from "@/lib/queries";
import { cn } from "@/lib/utils";

const AREA_ICON: Record<string, typeof Sparkles> = {
  general: Sparkles,
  work: Briefcase,
  relationships: Heart,
  wellbeing: Leaf,
};

export function DailyHoroscopeSection() {
  const { t, i18n } = useTranslation();
  const lang = (i18n.language || "en").slice(0, 2);
  const { data, isLoading, isError } = useDailyHoroscope(lang);

  return (
    <section aria-labelledby="daily-horoscope-heading" className="space-y-6">
      <header className="motion-fade-up">
        <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-accent">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-accent/15">
            <Sun size={15} aria-hidden="true" />
          </span>
          {t("todayOverview.personalized")}
        </p>
        <h1
          id="daily-horoscope-heading"
          className="mt-4 font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl"
        >
          {t("sections.horoscope.title")}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {t("sections.horoscope.subtitle")}
        </p>
      </header>

      {isLoading ? (
        <div
          className="rounded-[1.75rem] border border-border bg-card p-6 shadow-[var(--shadow-soft)]"
          aria-busy="true"
        >
          <div className="h-8 w-3/4 animate-pulse rounded-lg bg-muted" />
          <div className="mt-3 h-5 w-full animate-pulse rounded-lg bg-muted" />
          <div className="mt-2 h-5 w-5/6 animate-pulse rounded-lg bg-muted" />
          <div className="mt-6 h-28 animate-pulse rounded-2xl bg-muted" />
        </div>
      ) : isError ? (
        <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
          <p className="text-sm text-muted-foreground">{t("sections.horoscope.loadError")}</p>
        </div>
      ) : data?.incomplete ? (
        <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
          <p className="text-sm text-foreground">{t("sections.horoscope.completeProfile")}</p>
          <Link
            to="/onboarding/birth"
            className="tap-press mt-3 inline-flex min-h-11 items-center rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground"
          >
            {t("sections.horoscope.completeCta")}
          </Link>
        </div>
      ) : !data?.summary ? (
        <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
          <p className="text-sm text-muted-foreground">{t("sections.horoscope.empty")}</p>
        </div>
      ) : (
        <div className="space-y-6">
          <article className="relative isolate overflow-hidden rounded-[1.75rem] border border-accent/20 bg-card p-6 shadow-[var(--shadow-elevated)] sm:p-8">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-20 -top-24 -z-10 h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(242,153,29,0.17),rgba(242,153,29,0)_68%)]"
            />
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
              {t("todayOverview.chartGrounded")}
            </p>
            <p className="mt-3 max-w-3xl font-display text-2xl leading-[1.28] tracking-tight text-foreground sm:text-3xl">
              {data.summary}
            </p>
            <ReasonsDisclosure reasons={data.reasons?.summary} />

            {data.focus && (
              <div className="mt-6 max-w-2xl rounded-2xl border border-accent/20 bg-accent/[0.06] px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
                  {t("sections.horoscope.focusLabel")}
                </p>
                <p className="mt-1.5 text-sm font-medium leading-relaxed text-foreground">
                  {data.focus}
                </p>
              </div>
            )}
          </article>

          {data.areas.length > 0 && (
            <section aria-labelledby="daily-horoscope-areas" className="space-y-3">
              <h2
                id="daily-horoscope-areas"
                className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground"
              >
                {t("todayOverview.supporting")}
              </h2>
              <ul className="grid gap-4 md:grid-cols-2">
                {data.areas.map((area) => {
                  const Icon = AREA_ICON[area.key] ?? Sparkles;
                  return (
                    <li
                      key={area.key}
                      className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]"
                    >
                      <div className="flex items-start gap-3">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent/15 text-accent">
                          <Icon size={17} aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground">
                            {t(`sections.horoscope.areas.${area.key}`)}
                          </p>
                          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                            {area.text}
                          </p>
                          <ReasonsDisclosure reasons={data.reasons?.areas?.[area.key]} />
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {data.lucky && (data.lucky.color || data.lucky.number || data.lucky.direction) && (
            <section
              aria-labelledby="daily-horoscope-notes"
              className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]"
            >
              <h2
                id="daily-horoscope-notes"
                className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground"
              >
                {t("todayOverview.smallNotes")}
              </h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {data.lucky.color && (
                  <Chip label={t("sections.horoscope.lucky.color")} value={data.lucky.color} />
                )}
                {data.lucky.number && (
                  <Chip label={t("sections.horoscope.lucky.number")} value={data.lucky.number} />
                )}
                {data.lucky.direction && (
                  <Chip
                    label={t("sections.horoscope.lucky.direction")}
                    value={data.lucky.direction}
                  />
                )}
              </div>
            </section>
          )}

          <p className="border-t border-border/60 pt-5 text-xs leading-relaxed text-muted-foreground">
            {t("sections.horoscope.disclaimer")}
          </p>
        </div>
      )}
    </section>
  );
}

function ReasonsDisclosure({ reasons }: { reasons: DailyHoroscopeReason[] | undefined }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const contentId = useId();

  if (!reasons || reasons.length === 0) return null;

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => setOpen((open) => !open)}
        aria-expanded={open}
        aria-controls={contentId}
        className="tap-press inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border/70 bg-background/70 px-3 text-xs font-semibold text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ChevronDown
          size={14}
          aria-hidden="true"
          className={cn("shrink-0 transition-transform", open && "rotate-180")}
        />
        {t(open ? "sections.horoscope.whyToggleHide" : "sections.horoscope.whyToggleShow")}
      </button>
      {open && (
        <div
          id={contentId}
          className="motion-fade-up mt-3 space-y-3 rounded-2xl border border-border/70 bg-background/65 p-4"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {t("sections.horoscope.whyTitle")}
          </p>
          <ul className="space-y-3">
            {reasons.map((reason, index) => (
              <li key={`${reason.kind}-${index}`} className="flex items-start gap-3">
                <span className="mt-0.5 shrink-0 rounded-full border border-border/70 bg-card px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {t(`todayOverview.reasonKinds.${reason.kind}`)}
                </span>
                <span className="text-xs leading-relaxed text-foreground">{reason.text}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-2 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold text-foreground">{value}</span>
    </span>
  );
}
