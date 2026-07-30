import { Link } from "@tanstack/react-router";
import { ChevronRight, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useDailyHoroscope } from "@/lib/queries";

export function DailyHoroscopeSummaryCard() {
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

      {isLoading ? (
        <div className="mt-4 space-y-2" aria-busy="true">
          <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
          <div className="h-4 w-full animate-pulse rounded bg-muted" />
        </div>
      ) : isError ? (
        <p className="mt-4 text-sm text-muted-foreground">
          {t("sections.horoscope.loadError")}
        </p>
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
        <>
          <p className="mt-4 border-l-2 border-accent/30 pl-3 text-sm leading-relaxed text-foreground">
            {data.summary}
          </p>
          <Link
            to="/today/horoscope"
            className="tap-press mt-4 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-accent"
          >
            {t("sections.horoscope.readFull")}
            <ChevronRight size={16} aria-hidden="true" />
          </Link>
        </>
      )}
    </section>
  );
}
