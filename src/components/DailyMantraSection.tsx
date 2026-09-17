import { Flower2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { getDailyMantraIndex, MANTRAS } from "@/lib/mantras";

export function DailyMantraSection() {
  const { t } = useTranslation();
  const index = getDailyMantraIndex();
  const mantra = MANTRAS[index];

  return (
    <section
      aria-labelledby="daily-mantra-heading"
      className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]"
    >
      <header className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent/15 text-accent">
          <Flower2 size={17} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
            {t("sections.mantra.optionalPractice")}
          </p>
          <h2 id="daily-mantra-heading" className="mt-1 text-lg font-semibold text-foreground">
            {t("sections.mantra.title")}
          </h2>
        </div>
      </header>

      <div className="mt-5 rounded-[1.35rem] border border-accent/20 bg-accent/[0.05] px-5 py-5">
        <p
          className="font-display text-2xl leading-relaxed text-foreground sm:text-[1.7rem]"
          lang="sa"
        >
          {mantra.sanskrit}
        </p>
        <div className="my-4 h-px w-12 bg-accent/40" />
        <p className="text-sm font-medium tracking-wide text-muted-foreground">
          {mantra.transliteration}
        </p>
        <p className="mt-3 text-sm leading-relaxed text-foreground">
          {t(`sections.mantra.meanings.${index}`)}
        </p>
      </div>

      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
        {t("sections.mantra.traditionalNote")}
      </p>
    </section>
  );
}
