import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, Scale, Sparkles } from "lucide-react";
import type { DashaBalance, DashaMaha } from "@/lib/charts";
import { useDasha } from "@/lib/queries";

const VEDIC_BY_ID: Record<number, string> = {
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

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function fmtDateMs(ms: number): string {
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
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

function yearsBetweenMs(startMs: number, endMs: number): number {
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return 0;
  return Math.round(((endMs - startMs) / (365.2425 * 24 * 3600 * 1000)) * 10) / 10;
}

function isRunningMs(startMs: number, endMs: number, now: number): boolean {
  return Number.isFinite(startMs) && Number.isFinite(endMs) && now >= startMs && now < endMs;
}

type Period = { id: number; name: string; startMs: number; endMs: number };
type ClampedPratyantar = Period;
type ClampedAntar = Period & { pratyantardasha: ClampedPratyantar[] };
type ClampedMaha = Period & { antardasha: ClampedAntar[] };

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

function label(p: { id: number; name: string }): { primary: string; vedic: string | null } {
  const vedic = VEDIC_BY_ID[p.id] ?? null;
  const primary = p.name || vedic || `#${p.id}`;
  const showVedic = vedic && vedic.toLowerCase() !== primary.toLowerCase() ? vedic : null;
  return { primary, vedic: showVedic };
}

function PlanetLabel({ p, className }: { p: { id: number; name: string }; className?: string }) {
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

function RunningBadge() {
  const { t } = useTranslation();
  return (
    <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-px text-[8px] font-semibold uppercase tracking-wide text-amber-900 ring-1 ring-amber-300/70 leading-none">
      <span
        className="h-1 w-1 rounded-full bg-amber-500 motion-safe:animate-pulse"
        aria-hidden="true"
      />
      {t("sections.dasha.runningNow")}
    </span>
  );
}

export function DashaSection() {
  const { t } = useTranslation();
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
      className="rounded-2xl border border-border bg-card p-4 sm:p-6"
      style={{ boxShadow: "var(--shadow-soft)" }}
    >
      <div className="mb-5 grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3">
        <h2
          id="dasha-heading"
          className="truncate text-xl font-semibold tracking-tight text-foreground sm:text-2xl"
        >
          {t("sections.dasha.title")}
        </h2>
        <p className="shrink-0 text-xs text-muted-foreground">{t("sections.dasha.subtitle")}</p>
      </div>

      {loading && <DashaSkeleton />}

      {!loading && errorMessage && (
        <div className="flex flex-col items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <p className="text-sm text-foreground">{errorMessage}</p>
          <button
            type="button"
            onClick={() => query.refetch()}
            className="inline-flex min-h-[44px] items-center rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
          >
            {t("sections.dasha.retry")}
          </button>
        </div>
      )}

      {!loading && !errorMessage && periods && periods.length === 0 && (
        <p className="text-sm text-muted-foreground">{t("sections.dasha.noData")}</p>
      )}

      {!loading && !errorMessage && periods && periods.length > 0 && (
        <DashaBody periods={periods} balance={balance} now={now} />
      )}
    </section>
  );
}

function DashaBody({
  periods,
  balance,
  now,
}: {
  periods: DashaMaha[];
  balance: DashaBalance | null;
  now: number;
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

  const current = useMemo(() => {
    const maha = clamped.find((m) => isRunningMs(m.startMs, m.endMs, now)) ?? null;
    if (!maha) return null;
    const antar = maha.antardasha.find((a) => isRunningMs(a.startMs, a.endMs, now)) ?? null;
    const pratyantar = antar
      ? (antar.pratyantardasha.find((p) => isRunningMs(p.startMs, p.endMs, now)) ?? null)
      : null;
    return { maha, antar, pratyantar };
  }, [clamped, now]);

  if (!clamped.length) {
    return <p className="text-sm text-muted-foreground">{t("sections.dasha.noPeriods")}</p>;
  }

  return (
    <div className="space-y-5">
      {current && (
        <div
          className="rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/[0.06] via-amber-50/60 to-transparent p-4 sm:p-5"
          style={{ boxShadow: "var(--shadow-soft)" }}
        >
          <div className="mb-4 flex items-center gap-2">
            <Sparkles size={16} aria-hidden="true" className="text-amber-600" />
            <h3 className="text-base font-semibold text-foreground sm:text-lg">
              {t("sections.dasha.currentTransit")}
            </h3>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <CurrentCell label={t("sections.dasha.mahadasha")} p={current.maha} />
            {current.antar && (
              <CurrentCell label={t("sections.dasha.antardasha")} p={current.antar} />
            )}
            {current.pratyantar && (
              <CurrentCell
                label={t("sections.dasha.pratyantardasha")}
                p={current.pratyantar}
                sub={t("sections.dasha.untilDate", { date: fmtDateMs(current.pratyantar.endMs) })}
              />
            )}
          </div>
        </div>
      )}

      {balance && (
        <div className="flex items-start gap-3 rounded-xl border border-border/70 bg-secondary/40 px-4 py-3">
          <Scale size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-primary/80" />
          <p className="min-w-0 text-sm leading-relaxed text-foreground">
            <span className="font-medium">{t("sections.dasha.balanceAtBirth")}</span>{" "}
            <span className="font-medium">{balance.lord?.name}</span>
            {balance.lord?.vedic_name && (
              <span className="text-muted-foreground"> ({balance.lord.vedic_name})</span>
            )}
            {balance.description && (
              <span className="text-muted-foreground"> — {balance.description}</span>
            )}
          </p>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <h3 className="text-base font-semibold text-foreground">
            {t("sections.dasha.allMahadashas")}
          </h3>
          <span className="h-px flex-1 bg-border/70" aria-hidden="true" />
        </div>
        <ul className="space-y-2">
          {clamped.map((m) => (
            <MahaRow key={`${m.id}-${m.startMs}`} maha={m} now={now} />
          ))}
        </ul>
      </div>
    </div>
  );
}

function CurrentCell({
  label: lbl,
  p,
  sub,
}: {
  label: string;
  p: { id: number; name: string };
  sub?: string;
}) {
  const l = label(p);
  return (
    <div className="min-w-0 rounded-xl border border-border/70 bg-card/80 px-3.5 py-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="truncate text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {lbl}
        </span>
        <RunningBadge />
      </div>
      <div className="truncate text-lg font-semibold leading-tight text-foreground">
        {l.primary}
      </div>
      {l.vedic && <div className="mt-0.5 truncate text-xs text-muted-foreground">{l.vedic}</div>}
      {sub && <div className="mt-2 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function MahaRow({ maha, now }: { maha: ClampedMaha; now: number }) {
  const { t } = useTranslation();
  const running = isRunningMs(maha.startMs, maha.endMs, now);
  return (
    <li>
      <details
        className={
          "group overflow-hidden rounded-xl border transition-colors " +
          (running
            ? "border-primary/30 bg-primary/[0.04]"
            : "border-border bg-background hover:bg-muted/30")
        }
      >
        <summary className="flex min-h-[64px] cursor-pointer list-none items-start gap-3 px-4 py-3.5 text-sm sm:items-center">
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
                {fmtDateMs(maha.startMs)} – {fmtDateMs(maha.endMs)}
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
        <div className="border-t border-border/60 bg-background/60 px-3 py-3 sm:px-4">
          {maha.antardasha.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t("sections.dasha.noAntardashas")}</p>
          ) : (
            <ul className="divide-y divide-border/40">
              {maha.antardasha.map((a) => (
                <AntarRow key={`${a.id}-${a.startMs}`} antar={a} now={now} />
              ))}
            </ul>
          )}
        </div>
      </details>
    </li>
  );
}

function AntarRow({ antar, now }: { antar: ClampedAntar; now: number }) {
  const { t } = useTranslation();
  const running = isRunningMs(antar.startMs, antar.endMs, now);
  return (
    <li className="ml-2 border-l-2 border-primary/15 pl-3 py-1.5 sm:ml-3 sm:pl-4">
      <details
        open={running}
        className={
          "group overflow-hidden rounded-lg border transition-colors " +
          (running ? "border-primary/25 bg-primary/[0.04]" : "border-border/60 bg-background")
        }
      >
        <summary className="flex min-h-[48px] cursor-pointer list-none items-start gap-2 px-3 py-2.5 text-sm sm:items-center">
          <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <PlanetLabel p={antar} className="min-w-0 truncate font-medium text-foreground" />
              {running && <RunningBadge />}
            </div>
            <div className="shrink-0 whitespace-nowrap text-left text-xs tabular-nums text-muted-foreground sm:text-right">
              {fmtDateMs(antar.startMs)} – {fmtDateMs(antar.endMs)}
            </div>
          </div>
          <ChevronDown
            size={14}
            aria-hidden="true"
            className="mt-1 shrink-0 text-muted-foreground transition-transform group-open:rotate-180 sm:mt-0"
          />
        </summary>
        <div className="border-t border-border/60 px-3 py-2">
          {antar.pratyantardasha.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {t("sections.dasha.noPratyantardashas")}
            </p>
          ) : (
            <ul className="divide-y divide-border/40">
              {antar.pratyantardasha.map((p) => (
                <PratyantarRow key={`${p.id}-${p.startMs}`} pratyantar={p} now={now} />
              ))}
            </ul>
          )}
        </div>
      </details>
    </li>
  );
}

function PratyantarRow({ pratyantar, now }: { pratyantar: ClampedPratyantar; now: number }) {
  const running = isRunningMs(pratyantar.startMs, pratyantar.endMs, now);
  return (
    <li
      className={
        "ml-2 flex flex-col gap-1 rounded-md px-2.5 py-2 text-xs sm:ml-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3 " +
        (running ? "bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-muted/40")
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
        {fmtDateMs(pratyantar.startMs)} – {fmtDateMs(pratyantar.endMs)}
      </div>
    </li>
  );
}

function DashaSkeleton() {
  return (
    <div className="space-y-5 animate-pulse py-2">
      <div className="rounded-2xl border border-border/60 bg-card/40 p-5 space-y-3">
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
