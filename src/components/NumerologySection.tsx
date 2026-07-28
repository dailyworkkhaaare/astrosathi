import { useTranslation } from "react-i18next";
import { AlertTriangle, Sparkles, RefreshCw } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useNumerology } from "@/lib/queries";

type NumberBlock = {
  number: number;
  is_master?: boolean;
  total?: number | string;
  reduction?: string;
  meaning?: string;
  year?: number;
};

type NameSet = {
  expression: NumberBlock;
  soul_urge: NumberBlock;
  personality: NumberBlock;
  maturity: NumberBlock;
};

type NumerologyData = {
  input?: { full_name?: string; birth_date?: string };
  systems_note?: string;
  driver: NumberBlock;
  destiny: NumberBlock;
  birthday: NumberBlock;
  personal_year: NumberBlock;
  pythagorean: NameSet;
  chaldean: NameSet;
};

export function NumerologySection() {
  const { t } = useTranslation();
  const query = useNumerology();
  const loading = query.isPending;
  const errorCode = query.isError ? "provider_error" : (query.data?.errorCode ?? null);
  const payload = (query.data?.data ?? null) as NumerologyData | null;
  const data: NumerologyData | null = payload && payload.driver ? payload : null;

  if (loading) {
    return (
      <Card>
        <Header />
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
        <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <SkeletonList />
          <SkeletonList />
        </div>
      </Card>
    );
  }

  if (errorCode) {
    return (
      <Card>
        <Header />
        <div
          role="alert"
          className="mt-6 flex flex-col items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4"
        >
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle size={18} aria-hidden="true" />
            <p className="text-sm font-medium text-foreground">{t("numerology.errors.title")}</p>
          </div>
          <p className="text-sm text-muted-foreground">
            {errorCode === "birth_profile_incomplete"
              ? t("numerology.errors.birthMissing")
              : t("numerology.errors.body")}
          </p>
          <div className="flex flex-wrap gap-2">
            {errorCode === "birth_profile_incomplete" && (
              <Link
                to="/onboarding/birth"
                className="inline-flex items-center rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
              >
                {t("numerology.errors.completeProfile")}
              </Link>
            )}
            <button
              type="button"
              onClick={() => query.refetch()}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <RefreshCw size={14} aria-hidden="true" />
              {t("numerology.retry")}
            </button>
          </div>
        </div>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <Header />
        <div className="mt-6 flex flex-col items-center gap-3 rounded-lg border border-dashed border-border/70 bg-muted/30 p-8 text-center">
          <Sparkles size={22} aria-hidden="true" className="text-primary" />
          <p className="text-sm font-medium text-foreground">{t("numerology.empty.title")}</p>
          <p className="max-w-sm text-sm text-muted-foreground">{t("numerology.empty.body")}</p>
          <Link
            to="/onboarding/birth"
            className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            {t("numerology.empty.cta")}
          </Link>
        </div>
      </Card>
    );
  }

  const d = data;
  const core: Array<{ labelKey: string; block: NumberBlock; badge?: string }> = [
    { labelKey: "numerology.core.driver", block: d.driver },
    { labelKey: "numerology.core.destiny", block: d.destiny },
    { labelKey: "numerology.core.birthday", block: d.birthday },
    {
      labelKey: "numerology.core.personalYear",
      block: d.personal_year,
      badge: d.personal_year?.year ? String(d.personal_year.year) : undefined,
    },
  ];

  return (
    <div className="space-y-6">
      <Card className="motion-fade-up motion-delay-1">
        <Header note={d.systems_note} />
        <section aria-labelledby="core-numbers-heading" className="mt-5">
          <SectionHeading id="core-numbers-heading" text={t("numerology.coreTitle")} />
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {core.map((item) => (
              <CoreCard
                key={item.labelKey}
                label={t(item.labelKey)}
                block={item.block}
                badge={item.badge}
              />
            ))}
          </div>
        </section>
      </Card>

      <Card className="motion-fade-up motion-delay-2">
        <section aria-labelledby="name-numbers-heading">
          <SectionHeading id="name-numbers-heading" text={t("numerology.nameTitle")} />
          <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <NameSystemCard title={t("numerology.systems.pythagorean")} data={d.pythagorean} />
            <NameSystemCard title={t("numerology.systems.chaldean")} data={d.chaldean} />
          </div>
        </section>
      </Card>
    </div>
  );
}

function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-border bg-card p-5 ${className}`}
      style={{ boxShadow: "var(--shadow-soft)" }}
    >
      {children}
    </div>
  );
}

function Header({ note }: { note?: string }) {
  const { t } = useTranslation();
  return (
    <div>
      <h2 className="text-base font-semibold text-foreground">{t("numerology.title")}</h2>
      {note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}

function SectionHeading({ id, text }: { id: string; text: string }) {
  return (
    <h3 id={id} className="text-sm font-semibold text-foreground">
      {text}
    </h3>
  );
}

function CoreCard({ label, block, badge }: { label: string; block: NumberBlock; badge?: string }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-background p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        {badge && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            {badge}
          </span>
        )}
      </div>
      <div className="flex items-baseline gap-2">
        <span
          className="text-4xl font-semibold text-primary"
          style={{ fontVariantNumeric: "tabular-nums", lineHeight: 1 }}
        >
          {block.number}
        </span>
        {block.is_master && (
          <span className="rounded-md border border-accent/40 bg-accent/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-accent">
            {t("numerology.master")}
          </span>
        )}
      </div>
      {block.meaning && <p className="text-sm leading-snug text-foreground">{block.meaning}</p>}
      {block.reduction && (
        <p
          className="mt-auto text-xs text-muted-foreground"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {block.reduction}
        </p>
      )}
    </div>
  );
}

function NameSystemCard({ title, data }: { title: string; data: NameSet }) {
  const { t } = useTranslation();
  const rows: Array<{ labelKey: string; block: NumberBlock }> = [
    { labelKey: "numerology.name.expression", block: data.expression },
    { labelKey: "numerology.name.soulUrge", block: data.soul_urge },
    { labelKey: "numerology.name.personality", block: data.personality },
    { labelKey: "numerology.name.maturity", block: data.maturity },
  ];
  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <h4 className="text-sm font-semibold text-foreground">{title}</h4>
      <ul className="mt-3 flex flex-col gap-2">
        {rows.map((r) => (
          <li
            key={r.labelKey}
            className="flex items-start gap-3 rounded-lg border border-border/60 bg-card p-3"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/40">
              <span
                className="text-xl font-semibold text-primary"
                style={{ fontVariantNumeric: "tabular-nums", lineHeight: 1 }}
              >
                {r.block?.number ?? "—"}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {t(r.labelKey)}
                </span>
                {r.block?.is_master && (
                  <span className="rounded-md border border-accent/40 bg-accent/15 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-accent">
                    {t("numerology.master")}
                  </span>
                )}
              </div>
              {r.block?.meaning && (
                <p className="mt-1 text-sm leading-snug text-foreground">{r.block.meaning}</p>
              )}
              {r.block?.reduction && (
                <p
                  className="mt-1 text-xs text-muted-foreground"
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {r.block.reduction}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-xl border border-border bg-background p-4">
      <div className="h-3 w-20 rounded bg-muted" />
      <div className="mt-4 h-10 w-14 rounded bg-muted" />
      <div className="mt-3 h-3 w-full rounded bg-muted" />
      <div className="mt-2 h-3 w-1/2 rounded bg-muted" />
    </div>
  );
}

function SkeletonList() {
  return (
    <div className="animate-pulse rounded-xl border border-border bg-background p-4">
      <div className="h-4 w-24 rounded bg-muted" />
      <div className="mt-4 space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-14 w-full rounded-lg bg-muted" />
        ))}
      </div>
    </div>
  );
}

export default NumerologySection;
