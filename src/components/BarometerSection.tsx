import { Gauge, Minus, TrendingDown, TrendingUp } from "lucide-react";
import { useTranslation } from "react-i18next";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useBarometer, type BarometerAsset, type BarometerBias } from "@/lib/queries";

// Semicircular gauge geometry (matches the validated mock). Angles run from
// 180° (left) through 90° (top) to 0° (right); probability 0..1 maps linearly.
const CX = 60;
const CY = 64;
const R = 50;

function polar(deg: number): [number, number] {
  const a = (deg * Math.PI) / 180;
  return [CX + R * Math.cos(a), CY - R * Math.sin(a)];
}

function arcPath(startDeg: number, endDeg: number): string {
  const [sx, sy] = polar(startDeg);
  const [ex, ey] = polar(endDeg);
  const large = Math.abs(endDeg - startDeg) > 180 ? 1 : 0;
  return `M ${sx} ${sy} A ${R} ${R} 0 ${large} 1 ${ex} ${ey}`;
}

const TRACK_PATH = arcPath(180, 0);

function biasColorClass(bias: BarometerBias): string {
  if (bias === "bullish") return "text-accent";
  if (bias === "bearish") return "text-destructive";
  return "text-muted-foreground";
}

export function BarometerSection() {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useBarometer();

  const assets = data?.assets ?? [];
  const isEmpty = !isLoading && !isError && assets.length === 0;

  return (
    <Card className="rounded-2xl p-0">
      <CardHeader className="gap-1 space-y-0 p-5 pb-0">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/15">
            <Gauge size={15} className="text-accent" aria-hidden="true" />
          </span>
          <CardTitle className="text-base font-semibold leading-tight">
            {t("sections.barometer.title")}
          </CardTitle>
        </div>
        <CardDescription className="text-xs">
          {t("sections.barometer.subtitle")}
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-4">
        {isLoading ? (
          <div className="grid grid-cols-3 gap-2" aria-busy="true">
            <div className="h-24 animate-pulse rounded-xl bg-muted" />
            <div className="h-24 animate-pulse rounded-xl bg-muted" />
            <div className="h-24 animate-pulse rounded-xl bg-muted" />
          </div>
        ) : isError ? (
          <p className="text-sm text-muted-foreground">
            {t("sections.barometer.loadError")}
          </p>
        ) : isEmpty ? (
          <p className="text-sm text-muted-foreground">
            {t("sections.barometer.empty")}
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {assets.map((asset) => (
              <AssetGauge key={asset.assetKey} asset={asset} t={t} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AssetGauge({
  asset,
  t,
}: {
  asset: BarometerAsset;
  t: (key: string) => string;
}) {
  const clamped = Math.max(0, Math.min(1, asset.fusedProbability));
  const valuePath = arcPath(180, 180 - clamped * 180);
  const pct = Math.round(clamped * 100);
  const colorClass = biasColorClass(asset.bias);
  const assetName = t(`sections.barometer.assets.${asset.assetKey}`);
  const coverage =
    asset.sourceCoverage != null ? `${Math.round(asset.sourceCoverage * 100)}%` : "—";

  return (
    <div className="flex flex-col items-center text-center">
      <div className="relative mx-auto w-full max-w-[132px]">
        <svg viewBox="0 0 120 74" className="block w-full" role="img">
          <path
            d={TRACK_PATH}
            fill="none"
            stroke="currentColor"
            strokeWidth={9}
            strokeLinecap="round"
            className="text-muted-foreground/20"
          />
          <path
            d={valuePath}
            fill="none"
            stroke="currentColor"
            strokeWidth={9}
            strokeLinecap="round"
            className={colorClass}
          />
        </svg>
        <span className="absolute inset-x-0 bottom-0.5 text-center text-xl font-bold tabular-nums text-foreground">
          {pct}%
        </span>
      </div>

      <div className="mt-1 text-xs text-muted-foreground">{assetName}</div>
      <BiasChip bias={asset.bias} t={t} />
      <div className="mt-2 text-[11px] leading-tight text-muted-foreground">
        {t("sections.barometer.confidence")} {asset.confidenceScore}
        <br />
        {t("sections.barometer.coverage")} {coverage}
      </div>
    </div>
  );
}

function BiasChip({
  bias,
  t,
}: {
  bias: BarometerBias;
  t: (key: string) => string;
}) {
  const Icon =
    bias === "bullish" ? TrendingUp : bias === "bearish" ? TrendingDown : Minus;
  const classes =
    bias === "bullish"
      ? "border-accent/30 bg-accent/10 text-accent"
      : bias === "bearish"
        ? "border-destructive/30 bg-destructive/10 text-destructive"
        : "border-border bg-muted/50 text-muted-foreground";

  return (
    <span
      className={`mt-2 inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${classes}`}
    >
      <Icon size={12} aria-hidden="true" />
      {t(`sections.barometer.bias.${bias}`)}
    </span>
  );
}
