import { Link } from "@tanstack/react-router";
import { ChevronRight, Minus, TrendingDown, TrendingUp } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useBarometer, type BarometerAsset, type BarometerBias } from "@/lib/queries";

export function BarometerSummaryCard() {
  const { t } = useTranslation();
  const query = useBarometer();
  const loading = query.isPending;
  const hasError = query.isError;
  const assets = (query.data?.assets ?? []).filter((a) => a.assetKey !== "mcxsilver");
  const isEmpty = !loading && !hasError && assets.length === 0;
  const unavailable = !loading && (hasError || isEmpty);

  return (
    <section aria-labelledby="barometer-summary-heading">
      <h2 id="barometer-summary-heading" className="sr-only">
        {t("sections.barometer.title")}
      </h2>
      <ul className="list-hairline overflow-hidden rounded-[0.875rem] bg-card shadow-[var(--as-elevation-1)]">
        {loading ? (
          <li className="flex min-h-[3.125rem] items-center gap-3 px-4" aria-hidden="true">
            <span className="h-4 w-24 motion-safe:animate-pulse rounded bg-muted" />
            <span className="ml-auto h-6 w-20 motion-safe:animate-pulse rounded-full bg-muted" />
          </li>
        ) : unavailable ? (
          <li className="flex min-h-[3.125rem] items-center px-4 py-3 text-sm leading-relaxed text-muted-foreground">
            {hasError ? t("sections.barometer.loadError") : t("sections.barometer.empty")}
          </li>
        ) : (
          assets.map((asset) => <AssetRow key={asset.assetKey} asset={asset} t={t} />)
        )}
        <li>
          <Link
            to="/today/markets"
            className="tap-press flex min-h-[3.125rem] items-center justify-between gap-3 px-4 text-[0.9375rem] font-semibold text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          >
            {t("sections.barometer.viewFull")}
            <ChevronRight size={16} aria-hidden="true" />
          </Link>
        </li>
      </ul>
    </section>
  );
}

function AssetRow({ asset, t }: { asset: BarometerAsset; t: (key: string) => string }) {
  const bias: BarometerBias = asset.bias;
  const Icon = bias === "bullish" ? TrendingUp : bias === "bearish" ? TrendingDown : Minus;
  const pill =
    bias === "bullish"
      ? "bg-feedback-success/15 text-feedback-success"
      : bias === "bearish"
        ? "bg-feedback-warning/15 text-feedback-warning"
        : "bg-foreground/[0.08] text-muted-foreground";
  const pct = Math.round(Math.max(0, Math.min(1, asset.fusedProbability)) * 100);

  return (
    <li className="flex min-h-[3.125rem] items-center gap-3 px-4 py-2">
      <span className="min-w-0 flex-1 text-base text-foreground">
        {asset.assetKey === "mcxgold"
          ? t("sections.barometer.assets.bullion")
          : t(`sections.barometer.assets.${asset.assetKey}`)}
      </span>
      <span className="text-[0.8125rem] tabular-nums text-muted-foreground">{pct}%</span>
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.8125rem] font-semibold ${pill}`}
      >
        <Icon size={13} strokeWidth={2.6} aria-hidden="true" />
        {t(`sections.barometer.bias.${bias}`)}
      </span>
    </li>
  );
}
