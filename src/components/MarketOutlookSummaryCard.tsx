import { Link } from "@tanstack/react-router";
import { ChevronRight, Coins, Minus, TrendingDown, TrendingUp } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useMarketOutlook, type MarketMetalOutlook } from "@/lib/queries";

export function MarketOutlookSummaryCard() {
  const { t } = useTranslation();
  const query = useMarketOutlook();

  const loading = query.isPending;
  const hasError = query.isError;
  const data = query.data ?? null;
  const gold = data?.gold ?? null;
  const silver = data?.silver ?? null;
  const isEmpty = !loading && !hasError && !gold && !silver;

  return (
    <section
      aria-labelledby="market-summary-heading"
      className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]"
    >
      <div className="flex items-center gap-2.5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
          <Coins size={15} aria-hidden="true" />
        </span>
        <h2 id="market-summary-heading" className="text-base font-semibold text-foreground">
          {t("sections.market.title")}
        </h2>
      </div>

      {loading ? (
        <div className="mt-4 flex gap-3" aria-hidden="true">
          <div className="h-8 w-24 animate-pulse rounded-full bg-muted" />
          <div className="h-8 w-24 animate-pulse rounded-full bg-muted" />
        </div>
      ) : hasError ? (
        <p className="mt-4 text-sm text-muted-foreground">{t("sections.market.loadError")}</p>
      ) : isEmpty ? (
        <p className="mt-4 text-sm text-muted-foreground">{t("sections.market.empty")}</p>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap gap-2">
            {gold && <LeanChip outlook={gold} t={t} />}
            {silver && <LeanChip outlook={silver} t={t} />}
          </div>
          <Link
            to="/today/markets"
            className="tap-press mt-4 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-accent"
          >
            {t("sections.market.viewFull")}
            <ChevronRight size={16} aria-hidden="true" />
          </Link>
        </>
      )}
    </section>
  );
}

function LeanChip({
  outlook,
  t,
}: {
  outlook: MarketMetalOutlook;
  t: (key: string) => string;
}) {
  const isUp = outlook.lean === "up";
  const isDown = outlook.lean === "down";
  const Icon = isUp ? TrendingUp : isDown ? TrendingDown : Minus;

  const leanClasses = isUp
    ? "border-accent/30 bg-accent/10 text-accent"
    : isDown
      ? "border-border bg-transparent text-muted-foreground"
      : "border-border bg-muted/50 text-muted-foreground";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium ${leanClasses}`}
    >
      <Icon size={13} aria-hidden="true" />
      {t(`sections.market.metals.${outlook.metal}`)} · {t(`sections.market.lean.${outlook.lean}`)}
    </span>
  );
}
