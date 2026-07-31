import { ChevronDown, LayoutGrid, Lock } from "lucide-react";
import { useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useSbc, type SbcDay, type SbcValue } from "@/lib/queries";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function fmtTick(d: string): string {
  const parts = d.split("-").map(Number);
  const mon = MONTHS[(parts[1] ?? 1) - 1] ?? "";
  return `${parts[2] ?? ""} ${mon}`;
}

type CellKind = "empty" | "none" | "zero" | "score";

function classify(day: SbcDay | undefined): CellKind {
  if (!day) return "empty";
  if (day.vedhaCount === 0) return "none";
  if (day.netScore === 0) return "zero";
  return "score";
}

// Diverging fill: positive -> accent (teal), negative -> destructive (rose),
// intensity scales with |score| / maxAbs (floored so faint scores stay visible).
function scoreStyle(netScore: number, maxAbs: number): CSSProperties {
  const t = Math.min(Math.abs(netScore) / (maxAbs || 1), 1);
  const pct = Math.round((0.18 + 0.82 * t) * 100);
  const token = netScore > 0 ? "--accent" : "--destructive";
  return {
    backgroundColor: `color-mix(in oklab, var(${token}) ${pct}%, transparent)`,
  };
}

function HeatRow({
  label,
  isSelected,
  dates,
  byDate,
  today,
  maxAbs,
}: {
  label: string;
  isSelected: boolean;
  dates: string[];
  byDate: Record<string, SbcDay>;
  today: string;
  maxAbs: number;
}) {
  return (
    <div
      className={`flex items-center rounded-md ${
        isSelected ? "bg-accent/[0.06] shadow-[inset_2px_0_0_var(--accent)]" : ""
      }`}
    >
      <div
        className={`sticky left-0 z-10 w-20 shrink-0 bg-card py-0.5 pl-2 text-[11px] ${
          isSelected ? "font-semibold text-accent" : "text-muted-foreground"
        }`}
      >
        {label}
      </div>
      <div className="flex gap-px">
        {dates.map((date) => {
          const day = byDate[date];
          const kind = classify(day);
          const isToday = date === today;
          const style = kind === "score" && day ? scoreStyle(day.netScore, maxAbs) : undefined;
          const base =
            kind === "empty"
              ? "border border-dashed border-border"
              : kind === "none" || kind === "zero"
                ? "bg-muted"
                : "";
          return (
            <div
              key={date}
              title={`${fmtTick(date)} · ${
                day
                  ? `${day.vedhaCount} signal${day.vedhaCount === 1 ? "" : "s"} · net ${day.netScore}`
                  : "not calculated yet"
              }`}
              className={`relative h-3.5 w-2 rounded-[2px] ${base} ${
                isToday ? "ring-1 ring-accent" : ""
              }`}
              style={style}
            >
              {kind === "zero" ? (
                <span className="absolute inset-0 m-auto h-1 w-1 rounded-full bg-border" />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function SbcSection() {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useSbc();
  const [selected, setSelected] = useState<string>("nifty50");

  const value = data as SbcValue | undefined;
  const assets = (value?.assets ?? []).filter((a) => a.assetKey !== "mcxsilver");
  const isEmpty = !isLoading && !isError && assets.every((a) => Object.keys(a.byDate).length === 0);
  const selectedAsset = assets.find((a) => a.assetKey === selected) ?? assets[0];
  const todayDay = selectedAsset?.byDate[value?.today ?? ""];
  const assetLabel = (assetKey: string) =>
    assetKey === "mcxgold"
      ? t("sections.barometer.assets.bullion")
      : t(`sections.sbc.assets.${assetKey}`);

  return (
    <Card className="rounded-2xl p-0">
      <CardHeader className="gap-1 space-y-0 p-5 pb-0">
        <div className="flex items-center gap-2.5">
          <LayoutGrid size={15} className="text-accent" aria-hidden="true" />
          <CardTitle className="text-base font-semibold leading-tight">
            {t("sections.sbc.title")}
          </CardTitle>
        </div>
        <CardDescription className="text-xs">{t("sections.sbc.subtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        {isLoading ? (
          <div className="space-y-1" aria-busy="true">
            <div className="h-5 animate-pulse rounded bg-muted" />
            <div className="h-5 animate-pulse rounded bg-muted" />
            <div className="h-5 animate-pulse rounded bg-muted" />
          </div>
        ) : isError ? (
          <p className="text-sm text-muted-foreground">{t("sections.sbc.loadError")}</p>
        ) : isEmpty || !value || !selectedAsset ? (
          <p className="text-sm text-muted-foreground">{t("sections.sbc.empty")}</p>
        ) : (
          <>
            <div className="mb-3 flex gap-2">
              {assets.map((asset) => (
                <button
                  key={asset.assetKey}
                  type="button"
                  onClick={() => setSelected(asset.assetKey)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    asset.assetKey === selected
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  {assetLabel(asset.assetKey)}
                </button>
              ))}
            </div>

            <div className="overflow-x-auto">
              <div className="min-w-max">
                {assets.map((asset) => (
                  <div key={asset.assetKey} className="mb-0.5">
                    <HeatRow
                      label={assetLabel(asset.assetKey)}
                      isSelected={asset.assetKey === selected}
                      dates={value.dates}
                      byDate={asset.byDate}
                      today={value.today}
                      maxAbs={value.maxAbs}
                    />
                  </div>
                ))}
                <div className="ml-20 mt-1 flex justify-between text-[9px] text-muted-foreground">
                  <span>{fmtTick(value.dates[0] ?? "")}</span>
                  <span>{fmtTick(value.dates[Math.floor(value.dates.length / 2)] ?? "")}</span>
                  <span>
                    {t("sections.sbc.today")} · {fmtTick(value.today)}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-muted-foreground">
              <span>{t("sections.sbc.legend.bearish")}</span>
              <span
                className="inline-block h-2.5 w-24 rounded-sm"
                style={{
                  background:
                    "linear-gradient(to right, var(--destructive), var(--muted), var(--accent))",
                }}
              />
              <span>{t("sections.sbc.legend.bullish")}</span>
              <span>{t("sections.sbc.legend.noVedha")}</span>
              <span>{t("sections.sbc.legend.netZero")}</span>
              <span>{t("sections.sbc.legend.notComputed")}</span>
            </div>

            <div className="mt-4 border-t border-border pt-4">
              <h3 className="mb-2 text-sm font-semibold">
                {t("sections.sbc.todayTitle", {
                  asset: assetLabel(selectedAsset.assetKey),
                })}
              </h3>
              {!todayDay ? (
                <p className="rounded-lg bg-muted px-3 py-3 text-sm text-muted-foreground">
                  {t("sections.sbc.notComputedToday")}
                </p>
              ) : todayDay.vedhaCount === 0 ? (
                <p className="rounded-lg bg-muted px-3 py-3 text-sm text-muted-foreground">
                  {t("sections.sbc.noVedhasToday")}
                </p>
              ) : (
                <div className="space-y-1.5">
                  {todayDay.cells.map((cell, idx) => {
                    const sign = cell.contribution > 0 ? "+" : "";
                    const colorClass =
                      cell.contribution > 0
                        ? "text-accent"
                        : cell.contribution < 0
                          ? "text-destructive"
                          : "text-muted-foreground";
                    return (
                      <div
                        key={`${cell.planet}-${idx}`}
                        className="flex flex-wrap items-center gap-2 rounded-lg border border-border px-3 py-2"
                      >
                        <span className="text-sm font-medium">{cell.planet}</span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            cell.isMalefic
                              ? "bg-destructive/12 text-destructive"
                              : "bg-accent/12 text-accent"
                          }`}
                        >
                          {cell.isMalefic ? t("sections.sbc.malefic") : t("sections.sbc.benefic")}
                        </span>
                        <span className={`ml-auto text-sm font-semibold ${colorClass}`}>
                          {sign}
                          {cell.contribution}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="mt-4 flex items-center gap-2 rounded-xl border border-dashed border-border bg-muted/30 px-3 py-3 text-xs text-muted-foreground">
              <Lock size={13} aria-hidden="true" />
              {t("sections.sbc.v11Placeholder")}
            </div>
          </>
        )}
        <details className="group mt-3">
          <summary className="flex cursor-pointer list-none items-center gap-1 text-xs font-medium text-muted-foreground [&::-webkit-details-marker]:hidden">
            <ChevronDown
              size={13}
              className="transition-transform group-open:rotate-180"
              aria-hidden="true"
            />
            {t("sections.sbc.howTitle")}
          </summary>
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
            {t("sections.sbc.howBody")}
          </p>
        </details>
      </CardContent>
    </Card>
  );
}
