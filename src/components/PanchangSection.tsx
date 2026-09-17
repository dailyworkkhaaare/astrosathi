import { CalendarDays, Clock3, MapPin, Sunrise, Sunset } from "lucide-react";
import { useTranslation } from "react-i18next";

import { NAKSHATRAS } from "@/lib/charts";
import { computePanchang, computeDayTimes } from "@/lib/panchang";
import { usePanchang } from "@/lib/queries";

export function PanchangSection() {
  const { t, i18n } = useTranslation();
  const { data, isLoading, isError } = usePanchang();

  const panchang = data ? computePanchang(data.sunLon, data.moonLon) : null;
  const nakshatra = data?.nakshatraIndex != null ? (NAKSHATRAS[data.nakshatraIndex] ?? "—") : "—";
  const nakshatraDisplay =
    panchang && data?.nakshatraIndex != null
      ? `${nakshatra} · ${t("sections.panchang.pada")} ${panchang.nakshatraPada}`
      : nakshatra;

  const tz = data?.timezone ?? "Asia/Kolkata";
  const times =
    data && data.lat != null && data.lon != null ? computeDayTimes(data.lat, data.lon, tz) : null;
  const dayLabel = new Intl.DateTimeFormat(i18n.language, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: tz,
  }).format(new Date());
  const fmtTime = (dt: Date) =>
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(dt);

  return (
    <section aria-labelledby="panchang-heading" className="space-y-6">
      <header className="motion-fade-up">
        <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-accent">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-accent/15">
            <CalendarDays size={15} aria-hidden="true" />
          </span>
          {t("sections.panchang.todayLabel")}
        </p>
        <h1
          id="panchang-heading"
          className="mt-4 font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl"
        >
          {t("sections.panchang.title")}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {t("sections.panchang.subtitle")}
        </p>
      </header>

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <StateCard>{t("sections.panchang.loadError")}</StateCard>
      ) : !panchang ? (
        <StateCard>{t("sections.panchang.empty")}</StateCard>
      ) : (
        <div className="space-y-6">
          <article className="relative isolate overflow-hidden rounded-[1.75rem] border border-accent/20 bg-card p-6 shadow-[var(--shadow-elevated)] sm:p-8">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-20 -top-24 -z-10 h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(242,153,29,0.17),rgba(242,153,29,0)_68%)]"
            />
            <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays size={15} className="text-accent" aria-hidden="true" />
                {dayLabel}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MapPin size={15} className="text-accent" aria-hidden="true" />
                {tz}
              </span>
            </div>

            <dl className="mt-6 grid gap-3 sm:grid-cols-2">
              {times ? (
                <ValueCard label={t("sections.panchang.vara")} value={times.varaName} />
              ) : null}
              <ValueCard
                label={t("sections.panchang.tithi")}
                value={`${t(`sections.panchang.paksha.${panchang.paksha}`)} ${panchang.tithiName}`}
              />
              <ValueCard label={t("sections.panchang.nakshatra")} value={nakshatraDisplay} />
              <ValueCard label={t("sections.panchang.yoga")} value={panchang.yogaName} />
              <ValueCard label={t("sections.panchang.karana")} value={panchang.karanaName} />
            </dl>
          </article>

          <section aria-labelledby="panchang-timings-heading" className="space-y-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {t("sections.panchang.localTimings")}
              </p>
              <h2
                id="panchang-timings-heading"
                className="mt-1 text-lg font-semibold text-foreground"
              >
                {t("sections.panchang.timingTitle")}
              </h2>
            </div>
            {times ? (
              <dl className="grid gap-3 sm:grid-cols-2">
                <TimingCard
                  icon={Sunrise}
                  label={t("sections.panchang.sunrise")}
                  value={fmtTime(times.sunrise)}
                />
                <TimingCard
                  icon={Sunset}
                  label={t("sections.panchang.sunset")}
                  value={fmtTime(times.sunset)}
                />
                <TimingCard
                  icon={Clock3}
                  label={t("sections.panchang.rahuKaal")}
                  value={`${fmtTime(times.rahuStart)} – ${fmtTime(times.rahuEnd)}`}
                />
                <TimingCard
                  icon={Clock3}
                  label={t("sections.panchang.abhijit")}
                  value={`${fmtTime(times.abhijitStart)} – ${fmtTime(times.abhijitEnd)}`}
                />
              </dl>
            ) : (
              <StateCard>{t("sections.panchang.timesUnavailable")}</StateCard>
            )}
          </section>
        </div>
      )}
    </section>
  );
}

function LoadingState() {
  return (
    <div
      className="rounded-[1.75rem] border border-border bg-card p-6 shadow-[var(--shadow-soft)]"
      aria-busy="true"
    >
      <div className="h-5 w-2/3 animate-pulse rounded-lg bg-muted" />
      <div className="mt-3 h-20 animate-pulse rounded-2xl bg-muted" />
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="h-20 animate-pulse rounded-2xl bg-muted" />
        <div className="h-20 animate-pulse rounded-2xl bg-muted" />
      </div>
    </div>
  );
}

function StateCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
      <p className="text-sm text-muted-foreground">{children}</p>
    </div>
  );
}

function ValueCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background/65 px-4 py-3.5">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1.5 text-base font-semibold text-foreground">{value}</dd>
    </div>
  );
}

function TimingCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Clock3;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-soft)]">
      <dt className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon size={16} className="text-accent" aria-hidden="true" />
        {label}
      </dt>
      <dd className="mt-2 text-base font-semibold tabular-nums text-foreground">{value}</dd>
    </div>
  );
}
