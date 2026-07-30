import { Link } from "@tanstack/react-router";
import { ChevronRight, Gauge, Minus, TrendingDown, TrendingUp } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useBarometer, type BarometerAsset, type BarometerBias } from "@/lib/queries";

export function BarometerSummaryCard() {
  const { t } = useTranslation();
  const query = useBarometer();
  const loading = query.isPending;
  const hasError = query.isError;
  const assets = query.data?.assets ?? [];
  const isEmpty = !loading && !hasError && assets.length === 0;

  return (
    <section
      aria-labelledby="barometer-summary-heading"
      className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]"
    >
      <div className="flex items-center gap-2.5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/15">
          <Gauge size={15} className="text-accent" aria-hidden="true" />
        </span>
        <h2 id="barometer-summary-heading" className="text-base font-semibold text-foreground">
          {t("sections.barometer.title")}
        </h2>
      </div>

      {loading ? (
        <div className="mt-4 flex gap-3" aria-hidden="true">
          <div className="h-8 w-24 animate-pulse rounded-full bg-muted" />
          <div className="h-8 w-24 animate-pulse rounded-full bg-muted" />
          <div className="h-8 w-24 animate-pulse rounded-full bg-muted" />
        </div>
      ) : hasError ? (
        <p className="mt-4 text-sm text-muted-foreground">{t("sections.barometer.loadError")}</p>
      ) : isEmpty ? (
        <p className="mt-4 text-sm text-muted-foreground">{t("sections.barometer.empty")}</p>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap gap-2">
            {assets.map((asset) => (
              <AssetChip key={asset.assetKey} asset={asset} t={t} />
            ))}
          </div>
          <Link
            to="/today/markets"
            className="tap-press mt-4 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-accent"
          >
            {t("sections.barometer.viewFull")}
            <ChevronRight size={16} aria-hidden="true" />
          </Link>
        </>
      )}
    </section>
  );
}

function AssetChip({ asset, t }: { asset: BarometerAsset; t: (key: string) => string }) {
  const bias: BarometerBias = asset.bias;
  const Icon = bias === "bullish" ? TrendingUp : bias === "bearish" ? TrendingDown : Minus;
  const classes =
    bias === "bullish"
      ? "border-accent/30 bg-accent/10 text-accent"
      : bias === "bearish"
        ? "border-destructive/30 bg-destructive/10 text-destructive"
        : "border-border bg-muted/50 text-muted-foreground";
  const pct = Math.round(Math.max(0, Math.min(1, asset.fusedProbability)) * 100);

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium ${classes}`}
    >
      <Icon size={13} aria-hidden="true" />
      {t(`sections.barometer.assets.${asset.assetKey}`)} · {pct}%
    </span>
  );
}
