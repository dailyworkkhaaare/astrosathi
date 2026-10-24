import { ChevronRight, Sunrise } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { computePanchang, computeDayTimes } from "@/lib/panchang";
import { usePanchang } from "@/lib/queries";

export function PanchangSummaryCard() {
  const { t, i18n } = useTranslation();
  const { data, isLoading, isError } = usePanchang();

  const panchang = data ? computePanchang(data.sunLon, data.moonLon) : null;
  const tz = data?.timezone ?? "Asia/Kolkata";
  const times =
    data && data.lat != null && data.lon != null ? computeDayTimes(data.lat, data.lon, tz) : null;
  const unavailable = !isLoading && (isError || !panchang);
  const fmtTime = (dt: Date) =>
    new Intl.DateTimeFormat(i18n.language === "en" ? "en-IN" : i18n.language, {
      timeZone: tz,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(dt);

  const title = unavailable
    ? isError
      ? t("sections.panchang.loadError")
      : t("sections.panchang.empty")
    : panchang
      ? `${t(`sections.panchang.paksha.${panchang.paksha}`)} ${panchang.tithiName}`
      : null;
  const detail = [
    t("sections.panchang.title"),
    times ? `${t("sections.panchang.sunrise")} ${fmtTime(times.sunrise)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Link
      to="/today/panchang"
      aria-busy={isLoading || undefined}
      className="tap-press flex min-h-16 items-center gap-3.5 rounded-[0.875rem] bg-card px-4 py-2.5 shadow-[var(--as-elevation-1)] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent/12 text-accent">
        <Sunrise size={18} aria-hidden="true" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        {isLoading ? (
          <span
            className="h-5 w-40 motion-safe:animate-pulse rounded bg-muted"
            aria-hidden="true"
          />
        ) : (
          <span
            className={
              unavailable
                ? "text-[0.9375rem] leading-snug text-muted-foreground"
                : "text-[1.0625rem] text-foreground"
            }
          >
            {title}
          </span>
        )}
        <span className="text-[0.8125rem] tabular-nums text-muted-foreground">{detail}</span>
        <span className="sr-only">{t("sections.panchang.viewFull")}</span>
      </span>
      <ChevronRight size={16} className="shrink-0 text-muted-foreground" aria-hidden="true" />
    </Link>
  );
}
