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
    <section className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
      <div className="flex items-center gap-2.5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/15">
          <Sun size={15} className="text-accent" aria-hidden="true" />
        </span>
        <h2 className="text-base font-semibold text-foreground">{t("sections.horoscope.title")}</h2>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{t("sections.horoscope.subtitle")}</p>

      {isLoading ? (
        <div className="mt-4 space-y-2" aria-busy="true">
          <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
          <div className="h-4 w-full animate-pulse rounded bg-muted" />
          <div className="h-4 w-5/6 animate-pulse rounded bg-muted" />
        </div>
      ) : isError ? (
        <p className="mt-4 text-sm text-muted-foreground">{t("sections.horoscope.loadError")}</p>
      ) : data?.incomplete ? (
        <div className="mt-4">
          <p className="text-sm text-foreground">{t("sections.horoscope.completeProfile")}</p>
          <Link
            to="/onboarding/birth"
            className="tap-press mt-3 inline-flex min-h-11 items-center rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground"
          >
            {t("sections.horoscope.completeCta")}
          </Link>
        </div>
      ) : !data?.summary ? (
        <p className="mt-4 text-sm text-muted-foreground">{t("sections.horoscope.empty")}</p>
      ) : (
        <div className="mt-4 space-y-4">
          <div>
            <p className="border-l-2 border-accent/30 pl-3 text-sm leading-relaxed text-foreground">
              {data.summary}
            </p>
            <div className="pl-3">
              <ReasonsDisclosure reasons={data.reasons?.summary} />
            </div>
          </div>

          {data.areas.length > 0 && (
            <ul className="space-y-3">
              {data.areas.map((area) => {
                const Icon = AREA_ICON[area.key] ?? Sparkles;
                return (
                  <li key={area.key} className="flex gap-3">
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/15">
                      <Icon size={15} className="text-accent" aria-hidden="true" />
                    </span>
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {t(`sections.horoscope.areas.${area.key}`)}
                      </p>
                      <p className="text-sm leading-relaxed text-muted-foreground">{area.text}</p>
                      <ReasonsDisclosure reasons={data.reasons?.areas?.[area.key]} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {data.focus && (
            <div className="rounded-xl border border-border bg-muted/40 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("sections.horoscope.focusLabel")}
              </p>
              <p className="mt-1 text-sm text-foreground">{data.focus}</p>
            </div>
          )}

          {data.lucky && (data.lucky.color || data.lucky.number || data.lucky.direction) && (
            <div className="flex flex-wrap gap-2">
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
          )}

          <div className="border-t border-border/60" />

          <p className="text-xs text-muted-foreground">{t("sections.horoscope.disclaimer")}</p>
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
    <div className="mt-1.5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={contentId}
        className="tap-press -mx-1 inline-flex min-h-11 items-center gap-1 rounded-md px-1 text-xs font-medium text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ChevronDown
          size={13}
          aria-hidden="true"
          className={cn("shrink-0 transition-transform", open && "rotate-180")}
        />
        {t(open ? "sections.horoscope.whyToggleHide" : "sections.horoscope.whyToggleShow")}
      </button>
      {open && (
        <div
          id={contentId}
          className="motion-fade-up mt-2 space-y-1.5 rounded-lg border border-border/60 bg-muted/30 p-3"
        >
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {t("sections.horoscope.whyTitle")}
          </p>
          <ul className="space-y-1.5">
            {reasons.map((reason, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground"
              >
                <span className="mt-0.5 shrink-0 rounded-full border border-border/70 bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                  {reason.bodies?.[0] ?? reason.kind}
                </span>
                <span>{reason.text}</span>
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
    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1 text-xs">
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-medium text-foreground">{value}</span>
    </span>
  );
}
