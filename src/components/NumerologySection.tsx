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
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
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
          className="mt-4 flex flex-col items-start gap-2 rounded-[0.875rem] bg-destructive/[0.08] p-4"
        >
          <div className="flex items-center gap-2 text-destructive-strong">
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
                className="tap-press inline-flex min-h-11 items-center rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {t("numerology.errors.completeProfile")}
              </Link>
            )}
            <button
              type="button"
              onClick={() => query.refetch()}
              className="tap-press inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
        <div className="mt-4 flex flex-col items-center gap-2.5 rounded-[1.25rem] bg-card p-7 text-center shadow-[var(--as-elevation-1)]">
          <Sparkles size={22} aria-hidden="true" className="text-accent" />
          <p className="text-sm font-medium text-foreground">{t("numerology.empty.title")}</p>
          <p className="max-w-sm text-sm text-muted-foreground">{t("numerology.empty.body")}</p>
          <Link
            to="/onboarding/birth"
            className="tap-press inline-flex min-h-11 items-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
        <Header note={d.systems_note} input={d.input} />
        <section aria-labelledby="core-numbers-heading" className="mt-5">
          <p className="px-1 text-xs font-semibold text-accent">
            {t("numerology.birthDateDerived")}
          </p>
          <SectionHeading id="core-numbers-heading" text={t("numerology.coreTitle")} />
          <div className="mt-2 grid grid-cols-2 gap-3 lg:grid-cols-4">
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
          <p className="px-1 text-xs font-semibold text-accent">{t("numerology.nameDerived")}</p>
          <SectionHeading id="name-numbers-heading" text={t("numerology.nameTitle")} />
          <div className="mt-2 grid grid-cols-1 gap-3 lg:grid-cols-2">
            <NameSystemCard title={t("numerology.systems.pythagorean")} data={d.pythagorean} />
            <NameSystemCard title={t("numerology.systems.chaldean")} data={d.chaldean} />
          </div>
        </section>
      </Card>
    </div>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={className}>{children}</div>;
}

function Header({ note, input }: { note?: string; input?: NumerologyData["input"] }) {
  const { t } = useTranslation();
  return (
    <div className="px-1">
      <p className="text-xs font-semibold text-accent">{t("numerology.lensLabel")}</p>
      <h2 className="mt-0.5 text-xl font-semibold tracking-tight text-foreground">
        {t("numerology.title")}
      </h2>
      <p className="mt-0.5 max-w-2xl text-xs leading-relaxed text-muted-foreground">
        {t("numerology.provenanceBoundary")}
      </p>
      {(input?.birth_date || input?.full_name) && (
        <div className="mt-2.5 flex flex-wrap gap-2" aria-label={t("numerology.sourcesLabel")}>
          {input.birth_date && <SourceTag>{t("numerology.birthDateSource")}</SourceTag>}
          {input.full_name && <SourceTag>{t("numerology.savedNameSource")}</SourceTag>}
        </div>
      )}
      {note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}

function SourceTag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-foreground/[0.07] px-2.5 py-1 text-xs text-muted-foreground">
      {children}
    </span>
  );
}

function SectionHeading({ id, text }: { id: string; text: string }) {
  return (
    <h3 id={id} className="px-1 text-base font-semibold text-foreground">
      {text}
    </h3>
  );
}

function CoreCard({ label, block, badge }: { label: string; block: NumberBlock; badge?: string }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-1.5 rounded-[1.25rem] bg-card p-4 shadow-[var(--as-elevation-1)]">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-muted-foreground">{label}</span>
        {badge && (
          <span className="rounded-full bg-foreground/[0.07] px-2 py-0.5 text-[0.6875rem] font-medium tabular-nums text-muted-foreground">
            {badge}
          </span>
        )}
      </div>
      <div className="flex items-baseline gap-2">
        <span
          className="text-4xl font-semibold text-accent"
          style={{ fontVariantNumeric: "tabular-nums", lineHeight: 1 }}
        >
          {block.number}
        </span>
        {block.is_master && (
          <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[0.6875rem] font-semibold text-accent">
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
    <div className="rounded-[1.25rem] bg-card shadow-[var(--as-elevation-1)]">
      <h4 className="px-4 pb-1 pt-3.5 text-sm font-semibold text-foreground">{title}</h4>
      <ul className="list-hairline [--list-inset:4.25rem]">
        {rows.map((r) => (
          <li key={r.labelKey} className="flex items-start gap-3.5 px-4 py-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent/12">
              <span
                className="text-xl font-semibold text-accent"
                style={{ fontVariantNumeric: "tabular-nums", lineHeight: 1 }}
              >
                {r.block?.number ?? "—"}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[0.9375rem] font-semibold text-foreground">
                  {t(r.labelKey)}
                </span>
                {r.block?.is_master && (
                  <span className="rounded-md border border-accent/40 bg-accent/15 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-accent">
                    {t("numerology.master")}
                  </span>
                )}
              </div>
              {r.block?.meaning && (
                <p className="mt-0.5 text-sm leading-snug text-muted-foreground">
                  {r.block.meaning}
                </p>
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
    <div className="animate-pulse rounded-[1.25rem] bg-card p-4">
      <div className="h-3 w-20 rounded bg-muted" />
      <div className="mt-4 h-10 w-14 rounded bg-muted" />
      <div className="mt-3 h-3 w-full rounded bg-muted" />
      <div className="mt-2 h-3 w-1/2 rounded bg-muted" />
    </div>
  );
}

function SkeletonList() {
  return (
    <div className="animate-pulse rounded-[1.25rem] bg-card p-4">
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
