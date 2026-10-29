import { useTranslation } from "react-i18next";

import { getDailyMantraIndex, MANTRAS } from "@/lib/mantras";

export function DailyMantraSection() {
  const { t } = useTranslation();
  const index = getDailyMantraIndex();
  const mantra = MANTRAS[index];

  return (
    <section
      aria-labelledby="daily-mantra-heading"
      className="rounded-[0.875rem] bg-card px-4 py-3.5 shadow-[var(--as-elevation-1)]"
    >
      <header className="flex items-center justify-between gap-3">
        <h2
          id="daily-mantra-heading"
          className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground [:lang(hi)_&]:tracking-normal [:lang(mr)_&]:tracking-normal"
        >
          {t("sections.mantra.title")}
        </h2>
        <p className="text-xs text-muted-foreground">{t("sections.mantra.optionalPractice")}</p>
      </header>

      <p className="mt-2 font-display text-xl leading-relaxed text-accent" lang="sa">
        {mantra.sanskrit}
      </p>
      <p className="mt-0.5 text-sm text-foreground">{mantra.transliteration}</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        {t(`sections.mantra.meanings.${index}`)}
      </p>
      <p className="mt-2.5 border-t border-[color:var(--as-list-separator)] pt-2.5 text-xs leading-relaxed text-muted-foreground">
        {t("sections.mantra.traditionalNote")}
      </p>
    </section>
  );
}
