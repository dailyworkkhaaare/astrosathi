import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import {
  fmtDateMs,
  isRunningMs,
  label,
  mahaKey,
  yearsBetweenMs,
  type ClampedMaha,
} from "@/components/DashaSection";

// Calm, muted tone per graha, built entirely from existing design tokens.
// Deliberately avoids accent/primary (primary === accent gold in the dark
// theme — reserved for the "running now" glow elsewhere) and chart-1/3/5
// (chart-1 reads as salmon/coral, chart-3 as gold, chart-5 as a saturated
// red-orange in the dark theme — all too close to laws in design.md: never
// red, one gold glow). chart-2/4 and the neutral foreground family stay
// safely muted and non-red in both themes, so tones are built from those
// only. Adjacent mahadashas in the fixed Vimshottari cycle never share a
// tone.
const TONE_BY_PLANET_ID: Record<number, { bg: string; ring: string }> = {
  0: { bg: "bg-muted-foreground/28", ring: "ring-muted-foreground/50" }, // Surya
  1: { bg: "bg-foreground/14", ring: "ring-foreground/32" }, // Chandra
  2: { bg: "bg-foreground/14", ring: "ring-foreground/32" }, // Budha
  3: { bg: "bg-chart-4/25", ring: "ring-chart-4/50" }, // Shukra
  4: { bg: "bg-secondary-foreground/20", ring: "ring-secondary-foreground/42" }, // Mangala
  5: { bg: "bg-chart-4/25", ring: "ring-chart-4/50" }, // Guru
  6: { bg: "bg-muted-foreground/28", ring: "ring-muted-foreground/50" }, // Shani
  101: { bg: "bg-chart-2/25", ring: "ring-chart-2/50" }, // Rahu
  102: { bg: "bg-chart-2/25", ring: "ring-chart-2/50" }, // Ketu
};
const DEFAULT_TONE = { bg: "bg-muted", ring: "ring-border" };

function toneFor(id: number) {
  return TONE_BY_PLANET_ID[id] ?? DEFAULT_TONE;
}

export function DashaTimeline({
  periods,
  birthMs,
  cutoffMs,
  now,
  currentMahaKey,
  onSelectMaha,
}: {
  periods: ClampedMaha[];
  birthMs: number;
  cutoffMs: number;
  now: number;
  currentMahaKey: string | null;
  onSelectMaha: (key: string) => void;
}) {
  const { t } = useTranslation();
  const nowMarkerRef = useRef<HTMLDivElement>(null);
  const [selectedMahaKey, setSelectedMahaKey] = useState<string | null>(currentMahaKey);
  const [selectedAntarKey, setSelectedAntarKey] = useState<string | null>(null);

  const totalSpan = cutoffMs - birthMs;
  const nowPct =
    totalSpan > 0 ? Math.min(100, Math.max(0, ((now - birthMs) / totalSpan) * 100)) : 0;

  const currentMaha = useMemo(
    () => periods.find((m) => mahaKey(m) === currentMahaKey) ?? null,
    [periods, currentMahaKey],
  );
  const selectedMaha = useMemo(
    () => periods.find((m) => mahaKey(m) === selectedMahaKey) ?? currentMaha,
    [periods, selectedMahaKey, currentMaha],
  );
  const selectedAntar = useMemo(
    () => selectedMaha?.antardasha.find((antar) => mahaKey(antar) === selectedAntarKey) ?? null,
    [selectedMaha, selectedAntarKey],
  );

  useEffect(() => {
    nowMarkerRef.current?.scrollIntoView({ behavior: "auto", inline: "center", block: "nearest" });
  }, []);

  useEffect(() => {
    setSelectedMahaKey(currentMahaKey);
    const activeAntar = currentMaha?.antardasha.find((antar) =>
      isRunningMs(antar.startMs, antar.endMs, now),
    );
    setSelectedAntarKey(activeAntar ? mahaKey(activeAntar) : null);
  }, [currentMaha, currentMahaKey, now]);

  if (totalSpan <= 0 || periods.length === 0) return null;

  return (
    <section
      aria-labelledby="dasha-timeline-title"
      className="rounded-2xl border border-border bg-card/60 p-4 sm:p-5"
      style={{ boxShadow: "var(--shadow-soft)" }}
    >
      <h3
        id="dasha-timeline-title"
        className="mb-4 text-base font-semibold text-foreground sm:text-lg"
      >
        {t("sections.dasha.timelineTitle")}
      </h3>
      <div className="overflow-x-auto pb-1">
        <div className="min-w-[720px] sm:min-w-0">
          <div className="relative flex flex-col">
            <div
              ref={nowMarkerRef}
              aria-label={t("sections.dasha.nowMarkerAria", { date: fmtDateMs(now) })}
              className="pointer-events-none absolute top-0 z-10 -translate-x-1/2"
              style={{ left: `${nowPct}%` }}
            >
              <span className="whitespace-nowrap rounded-full bg-foreground px-1.5 py-0.5 text-[9px] font-semibold text-background">
                {t("sections.dasha.youAreHere")}
              </span>
              <span className="ml-1 whitespace-nowrap text-[9px] font-medium tabular-nums text-muted-foreground">
                {fmtDateMs(now)}
              </span>
            </div>

            <div className="relative mt-6">
              <div
                className="pointer-events-none absolute inset-y-0 w-px bg-foreground/40 motion-safe:transition-[left] motion-safe:duration-500"
                style={{ left: `${nowPct}%` }}
                aria-hidden="true"
              />

              <div
                className="flex h-11 overflow-hidden rounded-full ring-1 ring-border/60"
                aria-label={t("sections.dasha.timelineTitle")}
              >
                {periods.map((m) => {
                  const pct = ((m.endMs - m.startMs) / totalSpan) * 100;
                  const running = mahaKey(m) === currentMahaKey;
                  const tone = toneFor(m.id);
                  const l = label(m);
                  const years = yearsBetweenMs(m.startMs, m.endMs);
                  return (
                    <button
                      key={mahaKey(m)}
                      type="button"
                      style={{ flexBasis: `${pct}%` }}
                      onClick={() => {
                        setSelectedMahaKey(mahaKey(m));
                        setSelectedAntarKey(null);
                        onSelectMaha(mahaKey(m));
                      }}
                      aria-pressed={mahaKey(m) === selectedMahaKey}
                      aria-label={t("sections.dasha.segmentAria", {
                        planet: l.primary,
                        start: fmtDateMs(m.startMs),
                        end: fmtDateMs(m.endMs),
                        years,
                      })}
                      className={cn(
                        "group relative flex shrink-0 grow-0 items-center justify-center overflow-hidden border-r border-background/40 px-1 text-[10px] font-medium text-foreground transition-colors last:border-r-0 hover:brightness-95 focus-visible:z-20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        tone.bg,
                        running && cn("ring-2 ring-inset", tone.ring),
                        mahaKey(m) === selectedMahaKey && "ring-2 ring-inset ring-foreground/50",
                      )}
                    >
                      {pct > 5 && <span className="truncate">{l.primary}</span>}
                    </button>
                  );
                })}
              </div>

              <div className="mt-1.5 flex justify-between text-[10px] tabular-nums text-muted-foreground">
                <span>{fmtDateMs(birthMs)}</span>
                <span>{fmtDateMs(cutoffMs)}</span>
              </div>

              {selectedMaha && selectedMaha.antardasha.length > 0 && (
                <div className="mt-3.5">
                  <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    {t("sections.dasha.antarTitle", { maha: label(selectedMaha).primary })}
                  </p>
                  <div
                    className="flex h-7 overflow-hidden rounded-xl ring-1 ring-border/50"
                    aria-label={t("sections.dasha.antarTitle", {
                      maha: label(selectedMaha).primary,
                    })}
                  >
                    {selectedMaha.antardasha.map((a) => {
                      const span = selectedMaha.endMs - selectedMaha.startMs;
                      const pct = span > 0 ? ((a.endMs - a.startMs) / span) * 100 : 0;
                      const running = isRunningMs(a.startMs, a.endMs, now);
                      const tone = toneFor(a.id);
                      const active = mahaKey(a) === selectedAntarKey;
                      const l = label(a);
                      return (
                        <button
                          key={mahaKey(a)}
                          type="button"
                          style={{ flexBasis: `${pct}%` }}
                          onClick={() => setSelectedAntarKey(mahaKey(a))}
                          aria-pressed={active}
                          aria-label={t("sections.dasha.antarSegmentAria", {
                            planet: l.primary,
                            start: fmtDateMs(a.startMs),
                            end: fmtDateMs(a.endMs),
                          })}
                          className={cn(
                            "shrink-0 grow-0 border-r border-background/40 text-[9px] font-medium text-foreground last:border-r-0 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            tone.bg,
                            running && cn("ring-2 ring-inset", tone.ring),
                            active && "ring-2 ring-inset ring-foreground/50",
                          )}
                        >
                          {pct > 10 && <span className="truncate px-1">{l.primary}</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {selectedAntar && selectedAntar.pratyantardasha.length > 0 && (
                <div className="mt-3.5">
                  <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    {t("sections.dasha.pratyantarTitle", { antar: label(selectedAntar).primary })}
                  </p>
                  <div
                    className="flex h-5 overflow-hidden rounded-lg ring-1 ring-border/50"
                    aria-label={t("sections.dasha.pratyantarTitle", {
                      antar: label(selectedAntar).primary,
                    })}
                  >
                    {selectedAntar.pratyantardasha.map((p) => {
                      const span = selectedAntar.endMs - selectedAntar.startMs;
                      const pct = span > 0 ? ((p.endMs - p.startMs) / span) * 100 : 0;
                      const running = isRunningMs(p.startMs, p.endMs, now);
                      const tone = toneFor(p.id);
                      const l = label(p);
                      return (
                        <div
                          key={mahaKey(p)}
                          style={{ flexBasis: `${pct}%` }}
                          aria-label={t("sections.dasha.pratyantarSegmentAria", {
                            planet: l.primary,
                            start: fmtDateMs(p.startMs),
                            end: fmtDateMs(p.endMs),
                          })}
                          className={cn(
                            "shrink-0 grow-0 border-r border-background/40 last:border-r-0",
                            tone.bg,
                            running && cn("ring-2 ring-inset", tone.ring),
                          )}
                        />
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
