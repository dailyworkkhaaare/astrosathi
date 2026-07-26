import { Flower2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { getDailyMantraIndex, MANTRAS } from "@/lib/mantras";

export function DailyMantraSection() {
  const { t } = useTranslation();
  const index = getDailyMantraIndex();
  const mantra = MANTRAS[index];

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
      <div className="flex items-center gap-2.5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/15">
          <Flower2 size={15} className="text-accent" aria-hidden="true" />
        </span>
        <h2 className="text-base font-semibold text-foreground">
          {t("sections.mantra.title")}
        </h2>
      </div>

      <div className="mt-4 rounded-xl border border-accent/20 bg-accent/[0.04] px-4 py-4">
        <p className="font-display text-xl leading-relaxed text-foreground" lang="sa">
          {mantra.sanskrit}
        </p>
        <div className="my-3 h-px w-12 bg-accent/40" />
        <p className="text-sm font-medium tracking-wide text-muted-foreground">
          {mantra.transliteration}
        </p>
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground/80">
          {t(`sections.mantra.meanings.${index}`)}
        </p>
      </div>
    </section>
  );
}
