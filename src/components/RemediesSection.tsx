import { useMemo, useState, useId } from "react";
import { useTranslation } from "react-i18next";
import { CalendarDays, ChevronDown, Flame, Gem, HandCoins, Sparkles } from "lucide-react";

import { usePlanets, useDoshaReport, useSadeSatiTimeline, useDasha } from "@/lib/queries";
import type { PlanetKey } from "@/lib/chart-types";
import { selectRemedies, type RankedRemedy, type RemedyCondition } from "@/lib/remedies-select";
import {
  DOSHA_REMEDIES,
  type DoshaKey,
  type DoshaRemedy,
  type PlanetRemedies,
} from "@/lib/remedies";
import { MANTRAS } from "@/lib/mantras";
import { cn } from "@/lib/utils";

// Proper nouns — transliterated, never translated (design.md Sanskrit rule).
const PLANET_DISPLAY_NAME: Record<PlanetKey, string> = {
  sun: "Surya (Sun)",
  moon: "Chandra (Moon)",
  mars: "Mangal (Mars)",
  mercury: "Budh (Mercury)",
  jupiter: "Guru (Jupiter)",
  venus: "Shukra (Venus)",
  saturn: "Shani (Saturn)",
  rahu: "Rahu",
  ketu: "Ketu",
};

const PLANET_NAME_TO_KEY: Record<string, PlanetKey> = {
  sun: "sun",
  surya: "sun",
  moon: "moon",
  chandra: "moon",
  mars: "mars",
  mangal: "mars",
  kuja: "mars",
  mercury: "mercury",
  budh: "mercury",
  budha: "mercury",
  jupiter: "jupiter",
  guru: "jupiter",
  brihaspati: "jupiter",
  venus: "venus",
  shukra: "venus",
  saturn: "saturn",
  shani: "saturn",
  rahu: "rahu",
  ketu: "ketu",
};

function useCurrentDashaLord(): PlanetKey | null {
  const dashaQ = useDasha();
  return useMemo(() => {
    const periods = dashaQ.data?.periods ?? [];
    const now = Date.now();
    const maha = periods.find((m) => {
      const s = new Date(m.start).getTime();
      const e = new Date(m.end).getTime();
      return Number.isFinite(s) && Number.isFinite(e) && s <= now && now <= e;
    });
    if (!maha) return null;
    return PLANET_NAME_TO_KEY[maha.name.trim().toLowerCase()] ?? null;
  }, [dashaQ.data]);
}

// Reference week (2023-01-01 is a Sunday) used only to resolve the localized
// weekday name for a 0..6 day index via Intl.
function weekdayLabel(day: number, locale: string): string {
  const date = new Date(Date.UTC(2023, 0, 1 + day));
  return new Intl.DateTimeFormat(locale, { weekday: "long", timeZone: "UTC" }).format(date);
}

export function RemediesSection() {
  const { t, i18n } = useTranslation();
  const planetsQ = usePlanets();
  const mangalQ = useDoshaReport("mangal_dosha");
  const kaalSarpQ = useDoshaReport("kaal_sarp_dosha");
  const sadeSatiQ = useSadeSatiTimeline();
  const currentDashaLord = useCurrentDashaLord();

  const loading =
    planetsQ.isPending || mangalQ.isPending || kaalSarpQ.isPending || sadeSatiQ.isPending;

  const selection = useMemo(() => {
    if (loading) return null;

    const mangalData = mangalQ.data?.data as { has_dosha?: boolean } | null;

    const kaalSarpData = kaalSarpQ.data?.data as { has_dosha?: boolean } | null;
    return selectRemedies({
      planets: planetsQ.data?.planets ?? [],
      hasMangalDosha: !!mangalData?.has_dosha,
      hasKaalSarpDosha: !!kaalSarpData?.has_dosha,
      hasSadeSati: !!sadeSatiQ.data?.inSadeSati,
      currentDashaLord,
    });
  }, [loading, planetsQ.data, mangalQ.data, kaalSarpQ.data, sadeSatiQ.data, currentDashaLord]);

  const [showMore, setShowMore] = useState(false);

  return (
    <section aria-labelledby="remedies-heading">
      <header className="px-1">
        <p className="text-xs font-semibold text-accent">
          {t("sections.remedies.optionalPractice")}
        </p>
        <h2
          id="remedies-heading"
          className="mt-0.5 text-xl font-semibold tracking-tight text-foreground"
        >
          {t("sections.remedies.title")}
        </h2>
        <p className="mt-0.5 max-w-2xl text-xs leading-relaxed text-muted-foreground">
          {t("sections.remedies.practiceBoundary")}
        </p>
      </header>

      {loading && <RemediesSkeleton />}

      {!loading && selection && selection.wellBalanced && <WellBalancedFallback />}

      {!loading && selection && !selection.wellBalanced && (
        <div className="mt-4 flex flex-col gap-3">
          {selection.top.map((r) => (
            <RemedyCard key={r.condition.id} ranked={r} locale={i18n.language} />
          ))}
          {selection.more.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setShowMore((s) => !s)}
                aria-expanded={showMore}
                className="tap-press inline-flex min-h-11 items-center gap-1.5 rounded-md px-1 text-sm font-medium text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <ChevronDown
                  size={15}
                  aria-hidden="true"
                  className={cn("shrink-0 transition-transform", showMore && "rotate-180")}
                />
                {t(showMore ? "sections.remedies.showFewer" : "sections.remedies.showMore", {
                  count: selection.more.length,
                })}
              </button>
              {showMore && (
                <div className="mt-2 flex flex-col gap-3">
                  {selection.more.map((r) => (
                    <RemedyCard key={r.condition.id} ranked={r} locale={i18n.language} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <p className="mt-4 px-1 text-xs leading-relaxed text-muted-foreground">
        {t("sections.remedies.disclaimer")}
      </p>
    </section>
  );
}

function RemediesSkeleton() {
  return (
    <div className="mt-4 flex flex-col gap-3" aria-hidden="true">
      <div className="h-40 w-full rounded-[1.25rem] bg-card motion-safe:animate-pulse" />
      <div className="h-40 w-full rounded-[1.25rem] bg-card motion-safe:animate-pulse" />
    </div>
  );
}

function WellBalancedFallback() {
  const { t } = useTranslation();
  const gayatri = MANTRAS[0];
  const shanti = MANTRAS[4];
  return (
    <div className="mt-4 flex flex-col gap-3">
      <p className="px-1 text-sm leading-6 text-foreground">
        {t("sections.remedies.wellBalancedBody")}
      </p>
      <div className="rounded-[1.25rem] bg-card p-4 shadow-[var(--as-elevation-1)]">
        <p className="text-xs font-semibold text-muted-foreground">
          {t("sections.remedies.wellBalancedMantrasTitle")}
        </p>
        <div className="mt-3 flex flex-col gap-3">
          {[gayatri, shanti].map((m) => (
            <div
              key={m.transliteration}
              className="rounded-[0.875rem] bg-accent/[0.07] px-3.5 py-3"
            >
              <p className="font-display text-lg leading-relaxed text-accent" lang="sa">
                {m.sanskrit}
              </p>
              <p className="mt-1 text-xs font-medium tracking-wide text-muted-foreground">
                {m.transliteration}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function RemedyCard({ ranked, locale }: { ranked: RankedRemedy; locale: string }) {
  const { t } = useTranslation();
  const { condition, remedy } = ranked;
  const planetName = condition.planet ? PLANET_DISPLAY_NAME[condition.planet] : null;

  const headline = t(`sections.remedies.reasons.${condition.reasonKey}`, {
    planet: planetName ?? "",
  });

  return (
    <article className="flex flex-col gap-3 rounded-[1.25rem] bg-card p-4 shadow-[var(--as-elevation-1)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-muted-foreground">
            {t("sections.remedies.practiceFor")}
          </p>
          <p className="mt-0.5 text-[0.9375rem] leading-snug text-foreground">{headline}</p>
        </div>
        {condition.activeNow && (
          <span className="inline-flex w-fit shrink-0 items-center rounded-full bg-accent/15 px-2.5 py-1 text-xs font-semibold text-accent">
            {t("sections.remedies.activeNow")}
          </span>
        )}
      </div>

      <WhyChip reasons={condition.reasons} planetName={planetName} />

      <RemedyBundleBody remedy={remedy} locale={locale} />
    </article>
  );
}

function WhyChip({ reasons, planetName }: { reasons: string[]; planetName: string | null }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const contentId = useId();

  return (
    <div>
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
        {t(open ? "sections.remedies.whyToggleHide" : "sections.remedies.whyToggleShow")}
      </button>
      {open && (
        <div
          id={contentId}
          className="motion-fade-up mt-1 space-y-1.5 rounded-[0.875rem] bg-foreground/[0.05] p-3"
        >
          <p className="text-xs font-semibold text-muted-foreground">
            {t("sections.remedies.whyTitle")}
          </p>
          <ul className="space-y-1.5">
            {reasons.map((r) => (
              <li key={r} className="text-xs leading-relaxed text-muted-foreground">
                {t(`sections.remedies.reasons.${r}`, { planet: planetName ?? "" })}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function RemedyBundleBody({
  remedy,
  locale,
}: {
  remedy: PlanetRemedies | DoshaRemedy;
  locale: string;
}) {
  const { t } = useTranslation();
  const isDosha = !("gemstone" in remedy);

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-[0.875rem] bg-accent/[0.07] px-3.5 py-3">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <Flame size={12} aria-hidden="true" />
          {t("sections.remedies.mantraLabel")}
        </div>
        <p className="mt-1 font-display text-lg leading-relaxed text-accent" lang="sa">
          {remedy.mantra.devanagari}
        </p>
        <p className="mt-1 text-xs font-medium tracking-wide text-muted-foreground">
          {remedy.mantra.transliteration}
        </p>
      </div>

      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-foreground/[0.07] px-2.5 py-1">
          <CalendarDays size={12} aria-hidden="true" />
          {weekdayLabel(remedy.day, locale)}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-foreground/[0.07] px-2.5 py-1">
          <Sparkles size={12} aria-hidden="true" />
          {remedy.deity.name}
          {remedy.deity.praise ? ` · ${remedy.deity.praise}` : ""}
        </span>
      </div>

      <div>
        <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <HandCoins size={12} aria-hidden="true" />
          {t("sections.remedies.danaLabel")}
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {remedy.dana.map((id) => (
            <span
              key={id}
              className="rounded-full bg-foreground/[0.07] px-2.5 py-1 text-xs text-foreground"
            >
              {t(`sections.remedies.dana.${id}`)}
            </span>
          ))}
        </div>
      </div>

      {isDosha && (remedy as DoshaRemedy).noteKey && (
        <p className="text-xs leading-relaxed text-muted-foreground">
          {t(`sections.remedies.${(remedy as DoshaRemedy).noteKey}`)}
        </p>
      )}

      {!isDosha && <GemstoneRudrakshaBlock remedy={remedy as PlanetRemedies} />}
    </div>
  );
}

function GemstoneRudrakshaBlock({ remedy }: { remedy: PlanetRemedies }) {
  const { t } = useTranslation();
  return (
    <div className="rounded-[0.875rem] bg-foreground/[0.05] p-3">
      <div className="flex items-start gap-2">
        <Gem size={14} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
        <div className="flex flex-col gap-1">
          <p className="text-xs font-semibold text-foreground">
            {t("sections.remedies.gemstoneCaveatTitle")}
          </p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {remedy.gemstone.name} ({remedy.gemstone.sanskritName}) ·{" "}
            {t("sections.remedies.rudrakshaMukhi", { count: remedy.rudraksha.mukhi })}
          </p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {t("sections.remedies.gemstoneCaveatBody")}
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- compact (doshas tab)

export function DoshaRemedySummary({ doshaKey }: { doshaKey: DoshaKey }) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const contentId = useId();
  const remedy = DOSHA_REMEDIES[doshaKey];

  return (
    <div className="mt-1">
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
        {t(open ? "sections.remedies.hideRemedies" : "sections.remedies.showRemedies")}
      </button>
      {open && (
        <div
          id={contentId}
          className="motion-fade-up mt-1 rounded-[0.875rem] bg-foreground/[0.05] p-3"
        >
          <p className="mb-2 text-xs font-semibold text-muted-foreground">
            {t("sections.remedies.suggestedTitle")}
          </p>
          <RemedyBundleBody remedy={remedy} locale={i18n.language} />
        </div>
      )}
    </div>
  );
}
