import { Link } from "@tanstack/react-router";
import { Briefcase, Heart, Leaf, Sparkles, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useDailyHoroscope } from "@/lib/queries";

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
        <h2 className="text-base font-semibold text-foreground">
          {t("sections.horoscope.title")}
        </h2>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {t("sections.horoscope.subtitle")}
      </p>

      {isLoading ? (
        <div className="mt-4 space-y-2" aria-busy="true">
          <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
          <div className="h-4 w-full animate-pulse rounded bg-muted" />
          <div className="h-4 w-5/6 animate-pulse rounded bg-muted" />
        </div>
      ) : isError ? (
        <p className="mt-4 text-sm text-muted-foreground">
          {t("sections.horoscope.loadError")}
        </p>
      ) : data?.incomplete ? (
        <div className="mt-4">
          <p className="text-sm text-foreground">
            {t("sections.horoscope.completeProfile")}
          </p>
          <Link
            to="/onboarding/birth"
            className="tap-press mt-3 inline-flex items-center rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground"
          >
            {t("sections.horoscope.completeCta")}
          </Link>
        </div>
      ) : !data?.summary ? (
        <p className="mt-4 text-sm text-muted-foreground">
          {t("sections.horoscope.empty")}
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          <p className="text-sm leading-relaxed text-foreground">{data.summary}</p>

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
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        {area.text}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {data.focus && (
            <div className="rounded-xl border border-border bg-muted/40 p-3">
              <p className="text-xs font-medium text-muted-foreground">
                {t("sections.horoscope.focusLabel")}
              </p>
              <p className="mt-0.5 text-sm text-foreground">{data.focus}</p>
            </div>
          )}

          {data.lucky &&
            (data.lucky.color || data.lucky.number || data.lucky.direction) && (
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

          <p className="text-xs text-muted-foreground">
            {t("sections.horoscope.disclaimer")}
          </p>
        </div>
      )}
    </section>
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
