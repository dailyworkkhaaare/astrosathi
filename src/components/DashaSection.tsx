import { useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown } from "lucide-react";
import type { DashaBalance, DashaMaha } from "@/lib/charts";
import { useDasha } from "@/lib/queries";
import { AstroArt } from "@/components/AstroArt";
import { DashaTimeline } from "@/components/DashaTimeline";
import { grahaArtByName } from "@/lib/astro-art";

export const VEDIC_BY_ID: Record<number, string> = {
  0: "Surya",
  1: "Chandra",
  2: "Budha",
  3: "Shukra",
  4: "Mangala",
  5: "Guru",
  6: "Shani",
  101: "Rahu",
  102: "Ketu",
};

export function fmtDateMs(ms: number, locale = "en-IN"): string {
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(locale === "en" ? "en-IN" : locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}

// Parse an ISO-8601 duration like "P10Y1M9DT22H1M41S".
function parseIsoDuration(s: string | number | null | undefined): {
  years: number;
  months: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
} | null {
  if (s == null) return null;
  if (typeof s === "number" && Number.isFinite(s)) {
    const years = Math.trunc(s);
    const rem = (s - years) * 12;
    const months = Math.trunc(rem);
    const days = Math.round((rem - months) * 30);
    return { years, months, days, hours: 0, minutes: 0, seconds: 0 };
  }
  const m = String(s)
    .trim()
    .match(/^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/);
  if (!m) return null;
  return {
    years: Number(m[1] ?? 0),
    months: Number(m[2] ?? 0),
    days: Number(m[3] ?? 0),
    hours: Number(m[4] ?? 0),
    minutes: Number(m[5] ?? 0),
    seconds: Number(m[6] ?? 0),
  };
}

function subtractDuration(endIso: string, dur: ReturnType<typeof parseIsoDuration>): number | null {
  if (!dur) return null;
  const t = new Date(endIso).getTime();
  if (!Number.isFinite(t)) return null;
  const d = new Date(t);
  d.setUTCFullYear(d.getUTCFullYear() - dur.years);
  d.setUTCMonth(d.getUTCMonth() - dur.months);
  d.setUTCDate(d.getUTCDate() - dur.days);
  d.setUTCHours(
    d.getUTCHours() - dur.hours,
    d.getUTCMinutes() - dur.minutes,
    d.getUTCSeconds() - Math.floor(dur.seconds),
    d.getUTCMilliseconds() - Math.round((dur.seconds % 1) * 1000),
  );
  return d.getTime();
}

function addYears(ms: number, years: number): number {
  const d = new Date(ms);
  d.setUTCFullYear(d.getUTCFullYear() + years);
  return d.getTime();
}

export function yearsBetweenMs(startMs: number, endMs: number): number {
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return 0;
  return Math.round(((endMs - startMs) / (365.2425 * 24 * 3600 * 1000)) * 10) / 10;
}

export function isRunningMs(startMs: number, endMs: number, now: number): boolean {
  return Number.isFinite(startMs) && Number.isFinite(endMs) && now >= startMs && now < endMs;
}

export type Period = { id: number; name: string; startMs: number; endMs: number };
export type ClampedPratyantar = Period;
export type ClampedAntar = Period & { pratyantardasha: ClampedPratyantar[] };
export type ClampedMaha = Period & { antardasha: ClampedAntar[] };

function clampPeriods(periods: DashaMaha[], birthMs: number, cutoffMs: number): ClampedMaha[] {
  const out: ClampedMaha[] = [];
  for (const m of periods) {
    const mStart = new Date(m.start).getTime();
    const mEnd = new Date(m.end).getTime();
    if (!Number.isFinite(mStart) || !Number.isFinite(mEnd)) continue;
    if (mEnd <= birthMs) continue;
    if (mStart >= cutoffMs) continue;

    const antars: ClampedAntar[] = [];
    for (const a of m.antardasha ?? []) {
      const aStart = new Date(a.start).getTime();
      const aEnd = new Date(a.end).getTime();
      if (!Number.isFinite(aStart) || !Number.isFinite(aEnd)) continue;
      if (aEnd <= birthMs) continue;
      if (aStart >= cutoffMs) continue;

      const praty: ClampedPratyantar[] = [];
      for (const p of a.pratyantardasha ?? []) {
        const pStart = new Date(p.start).getTime();
        const pEnd = new Date(p.end).getTime();
        if (!Number.isFinite(pStart) || !Number.isFinite(pEnd)) continue;
        if (pEnd <= birthMs) continue;
        if (pStart >= cutoffMs) continue;
        praty.push({
          id: p.id,
          name: p.name,
          startMs: Math.max(pStart, birthMs),
          endMs: pEnd,
        });
      }
      antars.push({
        id: a.id,
        name: a.name,
        startMs: Math.max(aStart, birthMs),
        endMs: aEnd,
        pratyantardasha: praty,
      });
    }
    out.push({
      id: m.id,
      name: m.name,
      startMs: Math.max(mStart, birthMs),
      endMs: mEnd,
      antardasha: antars,
    });
  }
  return out;
}

export function label(p: { id: number; name: string }): { primary: string; vedic: string | null } {
  const vedic = VEDIC_BY_ID[p.id] ?? null;
  const primary = p.name || vedic || `#${p.id}`;
  const showVedic = vedic && vedic.toLowerCase() !== primary.toLowerCase() ? vedic : null;
  return { primary, vedic: showVedic };
}

export function PlanetLabel({
  p,
  className,
}: {
  p: { id: number; name: string };
  className?: string;
}) {
  const l = label(p);
  return (
    <span className={className}>
      {l.primary}
      {l.vedic && (
        <span className="ml-1 text-xs font-normal text-muted-foreground">({l.vedic})</span>
      )}
    </span>
  );
}

export function RunningBadge() {
  const { t } = useTranslation();
  return (
    <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-accent/20 px-1.5 py-px text-[8px] font-semibold uppercase tracking-wide text-accent ring-1 ring-accent/40 leading-none">
      <span
        className="h-1 w-1 rounded-full bg-accent motion-safe:animate-pulse"
        aria-hidden="true"
      />
      {t("sections.dasha.runningNow")}
    </span>
  );
}

type CurrentDasha = {
  maha: ClampedMaha;
  antar: ClampedAntar | null;
  pratyantar: ClampedPratyantar | null;
};

export function DashaSection({ compact = false }: { compact?: boolean }) {
  const { t, i18n } = useTranslation();
  const query = useDasha();
  const loading = query.isPending;
  const errorMessage = query.isError
    ? t("sections.dasha.serviceUnavailable")
    : query.data?.error
      ? query.data.error.message || t("sections.dasha.loadError")
      : null;
  const periods: DashaMaha[] | null = query.data?.periods ?? null;
  const balance: DashaBalance | null = query.data?.balance ?? null;

  const now = Date.now();

  return (
    <section
      aria-labelledby="dasha-heading"
      className={
        compact ? "rounded-[1.25rem] bg-card p-4 shadow-[var(--as-elevation-1)]" : undefined
      }
    >
      {compact ? (
        <h2 id="dasha-heading" className="text-[0.8125rem] font-semibold text-muted-foreground">
          {t("sections.dasha.title")}
        </h2>
      ) : (
        <div className="mb-4 px-1">
          <p className="text-xs font-semibold text-accent">{t("sections.dasha.eyebrow")}</p>
          <h2
            id="dasha-heading"
            className="mt-0.5 text-xl font-semibold tracking-tight text-foreground"
          >
            {t("sections.dasha.title")}
          </h2>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            {t("sections.dasha.scope")}
          </p>
        </div>
      )}

      {loading && <DashaSkeleton />}

      {!loading && errorMessage && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-[0.875rem] bg-destructive/[0.08] py-2 pl-4 pr-2">
          <p className="min-w-0 flex-1 text-sm text-foreground">{errorMessage}</p>
          <button
            type="button"
            onClick={() => query.refetch()}
            className="tap-press inline-flex min-h-11 items-center rounded-full px-3 text-sm font-semibold text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t("sections.dasha.retry")}
          </button>
        </div>
      )}

      {!loading && !errorMessage && periods && periods.length === 0 && (
        <p className="text-sm text-muted-foreground">{t("sections.dasha.noData")}</p>
      )}

      {!loading && !errorMessage && periods && periods.length > 0 && (
        <DashaBody
          periods={periods}
          balance={balance}
          now={now}
          compact={compact}
          locale={i18n.language}
        />
      )}
    </section>
  );
}

function DashaBody({
  periods,
  balance,
  now,
  compact,
  locale,
}: {
  periods: DashaMaha[];
  balance: DashaBalance | null;
  now: number;
  compact: boolean;
  locale: string;
}) {
  const { t } = useTranslation();
  // Derive birth instant from the API's own numbers: the end of the first
  // mahadasha minus dasha_balance.duration. This matches the exact birth
  // instant the provider used, avoiding timezone-parsing issues.
  const birthMs = useMemo(() => {
    if (!periods.length) return null;
    const dur = parseIsoDuration(balance?.duration);
    const b = dur ? subtractDuration(periods[0].end, dur) : null;
    if (b != null) return b;
    const t = new Date(periods[0].start).getTime();
    return Number.isFinite(t) ? t : null;
  }, [periods, balance]);

  const cutoffMs = useMemo(() => (birthMs != null ? addYears(birthMs, 100) : null), [birthMs]);

  const clamped = useMemo(() => {
    if (birthMs == null || cutoffMs == null) return [];
    return clampPeriods(periods, birthMs, cutoffMs);
  }, [periods, birthMs, cutoffMs]);

  const current = useMemo<CurrentDasha | null>(() => {
    const maha = clamped.find((m) => isRunningMs(m.startMs, m.endMs, now)) ?? null;
    if (!maha) return null;
    const antar = maha.antardasha.find((a) => isRunningMs(a.startMs, a.endMs, now)) ?? null;
    const pratyantar = antar
      ? (antar.pratyantardasha.find((p) => isRunningMs(p.startMs, p.endMs, now)) ?? null)
      : null;
    return { maha, antar, pratyantar };
  }, [clamped, now]);

  const mahaRefs = useRef(new Map<string, HTMLLIElement>());

  if (compact) {
    return current ? <CompactTiming current={current} locale={locale} /> : null;
  }

  const registerMahaRef = (key: string, el: HTMLLIElement | null) => {
    if (el) mahaRefs.current.set(key, el);
    else mahaRefs.current.delete(key);
  };
  const handleFocusMaha = (key: string) => {
    const el = mahaRefs.current.get(key);
    if (!el) return;
    const details = el.querySelector("details");
    if (details && !details.open) details.open = true;
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
  };

  if (!clamped.length) {
    return <p className="text-sm text-muted-foreground">{t("sections.dasha.noPeriods")}</p>;
  }

  return (
    <div className="space-y-5">
      {current && <CurrentTimingCard current={current} locale={locale} />}

      {birthMs != null && cutoffMs != null && (
        <DashaTimeline
          periods={clamped}
          birthMs={birthMs}
          cutoffMs={cutoffMs}
          now={now}
          currentMahaKey={current ? mahaKey(current.maha) : null}
          onSelectMaha={handleFocusMaha}
        />
      )}

      {balance && (
        <div className="px-4">
          <p className="text-xs font-semibold text-muted-foreground">
            {t("sections.dasha.birthBalanceEyebrow")}
          </p>
          <p className="mt-0.5 text-sm leading-relaxed text-foreground">
            <span className="font-medium">{t("sections.dasha.balanceAtBirth")}</span>{" "}
            <span className="font-medium">{balance.lord?.name}</span>
            {balance.lord?.vedic_name && (
              <span className="text-muted-foreground"> ({balance.lord.vedic_name})</span>
            )}
            {balance.description && (
              <span className="text-muted-foreground"> · {balance.description}</span>
            )}
          </p>
        </div>
      )}

      <div>
        <div className="px-4 pb-2">
          <p className="text-xs font-semibold text-muted-foreground">
            {t("sections.dasha.periodMapEyebrow")}
          </p>
          <h3 className="text-base font-semibold text-foreground">
            {t("sections.dasha.allMahadashas")}
          </h3>
        </div>
        <ul className="list-hairline overflow-hidden rounded-[0.875rem] bg-card shadow-[var(--as-elevation-1)] [--list-inset:4.5rem]">
          {clamped.map((m) => (
            <MahaRow
              key={mahaKey(m)}
              maha={m}
              now={now}
              locale={locale}
              registerRef={(el) => registerMahaRef(mahaKey(m), el)}
            />
          ))}
        </ul>
      </div>
    </div>
  );
}

function CurrentTimingCard({ current, locale }: { current: CurrentDasha; locale: string }) {
  const { t } = useTranslation();
  const art = grahaArtByName(current.maha.name);
  const rows = [
    current.antar
      ? { key: "antar", label: t("sections.dasha.antardasha"), p: current.antar }
      : null,
    current.pratyantar
      ? { key: "pratyantar", label: t("sections.dasha.pratyantardasha"), p: current.pratyantar }
      : null,
  ].filter((row): row is NonNullable<typeof row> => row !== null);

  return (
    <div
      aria-labelledby="current-timing-heading"
      className="relative isolate overflow-hidden rounded-[1.25rem] bg-accent/[0.08] p-[1.125rem] shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--accent)_25%,transparent)]"
    >
      {art ? (
        <AstroArt
          kind="graha"
          name={art}
          size={168}
          className="absolute -right-10 -top-8 -z-10 opacity-[0.32]"
        />
      ) : null}
      <div className="flex items-center justify-between gap-3">
        <h3 id="current-timing-heading" className="text-xs font-semibold text-muted-foreground">
          {t("sections.dasha.currentTiming")}
        </h3>
        <RunningBadge />
      </div>
      <p className="mt-2 font-display text-[1.625rem] font-semibold leading-tight text-foreground">
        {label(current.maha).primary} {t("sections.dasha.mahadasha")}
      </p>
      <p className="mt-1 max-w-[85%] text-sm leading-relaxed text-muted-foreground">
        {current.antar
          ? t("sections.dasha.currentSummaryWithAntar", {
              maha: label(current.maha).primary,
              antar: label(current.antar).primary,
            })
          : t("sections.dasha.currentSummary", { maha: label(current.maha).primary })}
      </p>
      {rows.length > 0 ? (
        <dl className="mt-3 space-y-2 text-[0.9375rem]">
          {rows.map((row) => (
            <div key={row.key} className="flex items-baseline justify-between gap-3">
              <dt className="text-muted-foreground">{row.label}</dt>
              <dd className="text-right text-foreground">
                <span>{label(row.p).primary}</span>
                <span className="text-muted-foreground">
                  {" · "}
                  {t("sections.dasha.untilDate", { date: fmtDateMs(row.p.endMs, locale) })}
                </span>
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}

/** The overview's one-card summary: running Mahadasha, Antardasha and progress. */
function CompactTiming({ current, locale }: { current: CurrentDasha; locale: string }) {
  const { t } = useTranslation();
  const art = grahaArtByName(current.maha.name);
  const length = current.maha.endMs - current.maha.startMs;
  const pct =
    length > 0
      ? Math.min(100, Math.max(0, ((Date.now() - current.maha.startMs) / length) * 100))
      : 0;
  const monthYear = (ms: number) =>
    new Intl.DateTimeFormat(locale, { month: "short", year: "numeric" }).format(new Date(ms));

  return (
    <div className="mt-2.5">
      <div className="flex items-center gap-3">
        {art ? <AstroArt kind="graha" name={art} size={40} /> : null}
        <div className="min-w-0 flex-1">
          <p className="font-display text-xl font-semibold leading-tight text-foreground">
            {label(current.maha).primary} {t("sections.dasha.mahadasha")}
          </p>
          {current.antar ? (
            <p className="text-[0.8125rem] text-muted-foreground">
              {label(current.antar).primary} {t("sections.dasha.antardasha")} ·{" "}
              {t("sections.dasha.untilDate", { date: fmtDateMs(current.antar.endMs, locale) })}
            </p>
          ) : null}
        </div>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-foreground/10" aria-hidden="true">
        <div className="h-full min-w-1.5 rounded-full bg-accent" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-1.5 flex justify-between text-xs tabular-nums text-muted-foreground">
        <span>{monthYear(current.maha.startMs)}</span>
        <span>{monthYear(current.maha.endMs)}</span>
      </div>
    </div>
  );
}

export function mahaKey(m: { id: number; startMs: number }): string {
  return `${m.id}-${m.startMs}`;
}

function MahaRow({
  maha,
  now,
  locale,
  registerRef,
}: {
  maha: ClampedMaha;
  now: number;
  locale: string;
  registerRef?: (el: HTMLLIElement | null) => void;
}) {
  const { t } = useTranslation();
  const running = isRunningMs(maha.startMs, maha.endMs, now);
  const art = grahaArtByName(maha.name);
  return (
    <li ref={registerRef}>
      <details className={"group " + (running ? "bg-accent/[0.06]" : "")}>
        <summary className="flex min-h-[3.75rem] cursor-pointer list-none items-center gap-3.5 px-4 py-2.5 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
          {art ? (
            <AstroArt kind="graha" name={art} size={40} />
          ) : (
            <span className="h-10 w-10 shrink-0" aria-hidden="true" />
          )}
          <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate text-base font-semibold text-foreground">
                  {label(maha).primary}
                </span>
                {running && <RunningBadge />}
              </div>
              {label(maha).vedic && (
                <div className="truncate text-xs text-muted-foreground">{label(maha).vedic}</div>
              )}
            </div>
            <div className="shrink-0 text-left text-xs text-muted-foreground sm:text-right">
              <div className="whitespace-nowrap tabular-nums">
                {fmtDateMs(maha.startMs, locale)} – {fmtDateMs(maha.endMs, locale)}
              </div>
              <div className="tabular-nums text-muted-foreground/80">
                {t("sections.dasha.yearsShort", { n: yearsBetweenMs(maha.startMs, maha.endMs) })}
              </div>
            </div>
          </div>
          <ChevronDown
            size={18}
            aria-hidden="true"
            className="mt-1 shrink-0 text-muted-foreground transition-transform group-open:rotate-180 sm:mt-0"
          />
        </summary>
        <div className="pb-3 pl-[4.5rem] pr-4">
          {maha.antardasha.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t("sections.dasha.noAntardashas")}</p>
          ) : (
            <ul>
              {maha.antardasha.map((a) => (
                <AntarRow key={`${a.id}-${a.startMs}`} antar={a} now={now} locale={locale} />
              ))}
            </ul>
          )}
        </div>
      </details>
    </li>
  );
}

function AntarRow({ antar, now, locale }: { antar: ClampedAntar; now: number; locale: string }) {
  const { t } = useTranslation();
  const running = isRunningMs(antar.startMs, antar.endMs, now);
  return (
    <li className="py-0.5">
      <details
        open={running}
        className={"group rounded-[0.625rem] " + (running ? "bg-accent/[0.08]" : "")}
      >
        <summary className="flex min-h-11 cursor-pointer list-none items-start gap-2 px-2.5 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:items-center [&::-webkit-details-marker]:hidden">
          <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <PlanetLabel p={antar} className="min-w-0 truncate font-medium text-foreground" />
              {running && <RunningBadge />}
            </div>
            <div className="shrink-0 whitespace-nowrap text-left text-xs tabular-nums text-muted-foreground sm:text-right">
              {fmtDateMs(antar.startMs, locale)} – {fmtDateMs(antar.endMs, locale)}
            </div>
          </div>
          <ChevronDown
            size={14}
            aria-hidden="true"
            className="mt-1 shrink-0 text-muted-foreground transition-transform group-open:rotate-180 sm:mt-0"
          />
        </summary>
        <div className="px-2.5 pb-2">
          {antar.pratyantardasha.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {t("sections.dasha.noPratyantardashas")}
            </p>
          ) : (
            <ul>
              {antar.pratyantardasha.map((p) => (
                <PratyantarRow
                  key={`${p.id}-${p.startMs}`}
                  pratyantar={p}
                  now={now}
                  locale={locale}
                />
              ))}
            </ul>
          )}
        </div>
      </details>
    </li>
  );
}

function PratyantarRow({
  pratyantar,
  now,
  locale,
}: {
  pratyantar: ClampedPratyantar;
  now: number;
  locale: string;
}) {
  const running = isRunningMs(pratyantar.startMs, pratyantar.endMs, now);
  return (
    <li
      className={
        "flex flex-col gap-1 rounded-md px-2 py-1.5 text-xs sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3 " +
        (running ? "bg-accent/10 text-foreground" : "text-muted-foreground")
      }
    >
      <div className="flex min-w-0 items-center gap-2">
        <PlanetLabel
          p={pratyantar}
          className={"min-w-0 truncate " + (running ? "text-foreground" : "")}
        />
        {running && <RunningBadge />}
      </div>
      <div className="shrink-0 whitespace-nowrap text-left tabular-nums sm:text-right">
        {fmtDateMs(pratyantar.startMs, locale)} – {fmtDateMs(pratyantar.endMs, locale)}
      </div>
    </li>
  );
}

function DashaSkeleton() {
  return (
    <div className="space-y-5 animate-pulse py-2">
      <div className="rounded-[1.25rem] bg-card p-5 space-y-3">
        <div className="h-4 w-36 rounded bg-primary/10" />
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="h-12 rounded-lg bg-primary/10" />
          <div className="h-12 rounded-lg bg-primary/10" />
          <div className="h-12 rounded-lg bg-primary/10" />
        </div>
      </div>
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-14 w-full rounded-xl border border-border/60 bg-card/30" />
        ))}
      </div>
    </div>
  );
}
