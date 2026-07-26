import { CalendarDays } from "lucide-react";
import { useTranslation } from "react-i18next";

import { NAKSHATRAS } from "@/lib/charts";
import { computePanchang, computeDayTimes } from "@/lib/panchang";
import { usePanchang } from "@/lib/queries";

export function PanchangSection() {
  const { t } = useTranslation();
  const { data, isLoading, isError } = usePanchang();

  const panchang = data ? computePanchang(data.sunLon, data.moonLon) : null;
  const nakshatra =
    data?.nakshatraIndex != null ? NAKSHATRAS[data.nakshatraIndex] ?? "—" : "—";

  const tz = data?.timezone ?? "Asia/Kolkata";
  const times =
    data && data.lat != null && data.lon != null
      ? computeDayTimes(data.lat, data.lon, tz)
      : null;
  const fmtTime = (dt: Date) =>
    new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit", hour12: true }).format(dt);

  return (
    <section
      className="rounded-2xl border border-border bg-card p-5"
      style={{ boxShadow: "var(--shadow-soft)" }}
    >
      <div className="flex items-center gap-2">
        <CalendarDays size={18} className="text-accent" aria-hidden="true" />
        <h2 className="text-base font-semibold text-foreground">
          {t("sections.panchang.title")}
        </h2>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {t("sections.panchang.subtitle")}
      </p>

      {isLoading ? (
        <div className="mt-4 space-y-2" aria-busy="true">
          <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
          <div className="h-4 w-3/5 animate-pulse rounded bg-muted" />
        </div>
      ) : isError ? (
        <p className="mt-4 text-sm text-muted-foreground">
          {t("sections.panchang.loadError")}
        </p>
      ) : !panchang ? (
        <p className="mt-4 text-sm text-muted-foreground">
          {t("sections.panchang.empty")}
        </p>
      ) : (
        <dl className="mt-4 space-y-3">
          <Row
            label={t("sections.panchang.tithi")}
            value={`${t(`sections.panchang.paksha.${panchang.paksha}`)} ${panchang.tithiName}`}
          />
          <Row label={t("sections.panchang.nakshatra")} value={nakshatra} />
          <Row label={t("sections.panchang.yoga")} value={panchang.yogaName} />
          {times ? (
            <>
              <Row label={t("sections.panchang.sunrise")} value={fmtTime(times.sunrise)} />
              <Row label={t("sections.panchang.sunset")} value={fmtTime(times.sunset)} />
              <Row
                label={t("sections.panchang.rahuKaal")}
                value={`${fmtTime(times.rahuStart)} – ${fmtTime(times.rahuEnd)}`}
              />
              <Row
                label={t("sections.panchang.abhijit")}
                value={`${fmtTime(times.abhijitStart)} – ${fmtTime(times.abhijitEnd)}`}
              />
            </>
          ) : (
            <Row
              label={t("sections.panchang.rahuKaal")}
              value={t("sections.panchang.timesUnavailable")}
            />
          )}
        </dl>
      )}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/50 pb-3 last:border-0 last:pb-0">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium text-foreground">{value}</dd>
    </div>
  );
}
