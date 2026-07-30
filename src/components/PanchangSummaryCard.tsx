import { CalendarDays, ChevronRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { computePanchang, computeDayTimes } from "@/lib/panchang";
import { usePanchang } from "@/lib/queries";

export function PanchangSummaryCard() {
  const { t } = useTranslation();
  const { data, isLoading, isError } = usePanchang();

  const panchang = data ? computePanchang(data.sunLon, data.moonLon) : null;
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
      </CardHeader>

      <CardContent className="pt-4">
        {isLoading ? (
          <div className="space-y-2" aria-busy="true">
            <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
          </div>
        ) : isError ? (
          <p className="text-sm text-muted-foreground">{t("sections.panchang.loadError")}</p>
        ) : !panchang ? (
          <p className="text-sm text-muted-foreground">{t("sections.panchang.empty")}</p>
        ) : (
          <div className="space-y-2.5">
            <SummaryRow
              label={t("sections.panchang.tithi")}
              value={`${t(`sections.panchang.paksha.${panchang.paksha}`)} ${panchang.tithiName}`}
            />
            {times && (
              <SummaryRow
                label={t("sections.panchang.sunrise")}
                value={fmtTime(times.sunrise)}
                numeric
              />
            )}
          </div>
        )}

        <Link
          to="/today/panchang"
          className="tap-press mt-4 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-accent"
        >
          {t("sections.panchang.viewFull")}
          <ChevronRight size={16} aria-hidden="true" />
        </Link>
      </CardContent>
    </Card>
  );
}

function SummaryRow({
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
      <span className="text-sm text-muted-foreground">{label}</span>
      <span
        className={`text-right text-sm font-medium text-foreground ${
          numeric ? "tabular-nums" : ""
        }`}
      >
        {value}
      </span>
    </div>
  );
}
