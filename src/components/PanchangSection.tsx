import { CalendarDays } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(dt);

  return (
    <Card className="rounded-2xl p-0">
      <CardHeader className="gap-1 space-y-0 p-5 pb-0">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/15">
            <CalendarDays size={15} className="text-accent" aria-hidden="true" />
          </span>
          <CardTitle className="text-base font-semibold leading-tight">
            {t("sections.panchang.title")}
          </CardTitle>
        </div>
        <CardDescription className="text-xs">
          {t("sections.panchang.subtitle")}
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-4">
        {isLoading ? (
          <div className="space-y-2" aria-busy="true">
            <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
            <div className="h-4 w-3/5 animate-pulse rounded bg-muted" />
          </div>
        ) : isError ? (
          <p className="text-sm text-muted-foreground">{t("sections.panchang.loadError")}</p>
        ) : !panchang ? (
          <p className="text-sm text-muted-foreground">{t("sections.panchang.empty")}</p>
        ) : (
          <div className="space-y-4">
            <dl className="space-y-2.5">
              <Row
                label={t("sections.panchang.tithi")}
                value={`${t(`sections.panchang.paksha.${panchang.paksha}`)} ${panchang.tithiName}`}
              />
              <Row label={t("sections.panchang.nakshatra")} value={nakshatra} />
              <Row label={t("sections.panchang.yoga")} value={panchang.yogaName} />
            </dl>

            <div className="border-t border-border/60" />

            <dl className="space-y-2.5">
              {times ? (
                <>
                  <Row label={t("sections.panchang.sunrise")} value={fmtTime(times.sunrise)} numeric />
                  <Row label={t("sections.panchang.sunset")} value={fmtTime(times.sunset)} numeric />
                  <Row
                    label={t("sections.panchang.rahuKaal")}
                    value={`${fmtTime(times.rahuStart)} – ${fmtTime(times.rahuEnd)}`}
                    numeric
                  />
                  <Row
                    label={t("sections.panchang.abhijit")}
                    value={`${fmtTime(times.abhijitStart)} – ${fmtTime(times.abhijitEnd)}`}
                    numeric
                  />
                </>
              ) : (
                <Row
                  label={t("sections.panchang.rahuKaal")}
                  value={t("sections.panchang.timesUnavailable")}
                />
              )}
            </dl>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Row({
  label,
  value,
  numeric,
}: {
  label: string;
  value: string;
  numeric?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd
        className={`text-right text-sm font-medium text-foreground ${
          numeric ? "tabular-nums" : ""
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
