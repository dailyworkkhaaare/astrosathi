import { AlertCircle, Coins, Minus, TrendingDown, TrendingUp } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useMarketOutlook, type MarketMetalOutlook } from "@/lib/queries";
import { SIGN_KEYS_BY_INDEX } from "@/lib/charts";

export function MarketOutlookSection() {
  const { t, i18n } = useTranslation();
  const query = useMarketOutlook();

  const loading = query.isPending;
  const hasError = query.isError;
  const data = query.data ?? null;
  const gold = data?.gold ?? null;
  const silver = data?.silver ?? null;
  const acc = data?.accuracy ?? null;
  const isEmpty = !loading && !hasError && !gold && !silver;

  const dateLabel = data?.tradeDate
    ? new Intl.DateTimeFormat(i18n.language, {
        weekday: "long",
        day: "numeric",
        month: "long",
      }).format(new Date(data.tradeDate + "T00:00:00"))
    : "";

  return (
    <section
      aria-labelledby="market-heading"
      className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]"
    >
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
            <Coins size={15} aria-hidden="true" />
          </span>
          <h2 id="market-heading" className="text-base font-semibold text-foreground">
            {t("sections.market.title")}
          </h2>
        </div>
        {dateLabel && (
          <span className="shrink-0 rounded-full border border-border bg-muted/50 px-2.5 py-1 text-xs font-medium text-muted-foreground">
            {dateLabel}
          </span>
        )}
      </header>

      <p className="mt-1 text-xs text-muted-foreground">
        {t("sections.market.subtitle")}
      </p>

      {loading && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2" aria-hidden="true">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="flex flex-col gap-3 rounded-xl border border-border bg-background p-4"
            >
              <div className="flex items-center gap-2.5">
                <div className="h-7 w-7 animate-pulse rounded-full bg-muted" />
                <div className="h-4 w-16 animate-pulse rounded bg-muted" />
              </div>
              <div className="h-3 w-full animate-pulse rounded bg-muted" />
              <div className="h-3 w-4/5 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
      )}

      {!loading && hasError && (
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-border bg-muted/30 p-4">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertCircle size={15} aria-hidden="true" />
          </span>
          <div className="flex flex-col items-start gap-2">
            <p className="text-sm text-foreground">{t("sections.market.loadError")}</p>
            <button
              type="button"
              onClick={() => void query.refetch()}
              className="inline-flex min-h-11 items-center rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {t("states.retry")}
            </button>
          </div>
        </div>
      )}

      {isEmpty && (
        <div className="mt-4 flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-8 text-center">
          <Coins size={20} className="text-muted-foreground" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">{t("sections.market.empty")}</p>
        </div>
      )}

      {!loading && !hasError && !isEmpty && (
        <div className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {gold && <MetalCard outlook={gold} t={t} />}
            {silver && <MetalCard outlook={silver} t={t} />}
          </div>

          {acc && (
            <div className="flex flex-col gap-2 rounded-xl bg-muted/40 p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t("sections.market.accuracyLabel")}
                </p>
                <p className="text-sm font-medium text-foreground">
                  {acc.pct != null
                    ? t("sections.market.accuracyValue", {
                        pct: acc.pct,
                        correct: acc.correct,
                        total: acc.total,
                      })
                    : t("sections.market.accuracyPending")}
                </p>
              </div>
              {acc.pct != null && (
                <div
                  className="h-1.5 w-full overflow-hidden rounded-full bg-border"
                  role="progressbar"
                  aria-valuenow={acc.pct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className="h-full rounded-full bg-accent transition-all"
                    style={{ width: `${acc.pct}%` }}
                  />
                </div>
              )}
            </div>
          )}

          <p className="text-[11px] leading-relaxed text-muted-foreground/80">
            {t("sections.market.disclaimer")}
          </p>
        </div>
      )}
    </section>
  );
}

function MetalCard({
  outlook,
  t,
}: {
  outlook: MarketMetalOutlook;
  t: (key: string, opts?: Record<string, unknown>) => string;
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
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-background p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
            <Coins size={15} aria-hidden="true" />
          </span>
          <span className="font-medium text-foreground">
            {t(`sections.market.metals.${outlook.metal}`)}
          </span>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${leanClasses}`}
        >
          <Icon size={13} aria-hidden="true" />
          {t(`sections.market.lean.${outlook.lean}`)}
        </span>
      </div>

      {outlook.reasoning.length > 0 && (
        <ul className="space-y-1.5 border-t border-border/60 pt-3">
          {outlook.reasoning.map((r, i) => {
            const signName =
              r.params?.sign != null
                ? t(`signs.${SIGN_KEYS_BY_INDEX[r.params.sign]}`)
                : "";
            const label = r.code
              ? t(`sections.market.reasons.${r.code}`, { sign: signName })
              : r.text;
            return (
              <li key={i} className="flex gap-2 text-sm leading-snug text-muted-foreground">
                <span
                  aria-hidden="true"
                  className="mt-1.5 size-1 shrink-0 rounded-full bg-muted-foreground/40"
                />
                <span>{label}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
