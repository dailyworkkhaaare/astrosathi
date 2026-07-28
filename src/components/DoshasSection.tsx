import { AlertTriangle, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useDoshaReport } from "@/lib/queries";

type MangalData = { has_dosha: boolean; description: string };
type KaalSarpData = {
  has_dosha: boolean;
  description: string;
  type: string | null;
  dosha_type: string | null;
};
type SadeSatiData = {
  is_in_sade_sati: boolean;
  transit_phase: string | null;
  description: string;
};

export function DoshasSection() {
  const { t } = useTranslation();
  return (
    <section
      aria-labelledby="doshas-heading"
      className="rounded-2xl border border-border bg-card p-5"
    >
      <header>
        <h2 id="doshas-heading" className="text-lg font-semibold text-foreground">
          {t("sections.doshas.title")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("sections.doshas.subtitle")}</p>
      </header>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <div className="motion-fade-up motion-delay-1">
          <MangalCard />
        </div>
        <div className="motion-fade-up motion-delay-2">
          <KaalSarpCard />
        </div>
        <div className="motion-fade-up motion-delay-3">
          <SadeSatiCard />
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- cards

function MangalCard() {
  const { t } = useTranslation();
  const q = useDoshaReport("mangal_dosha");
  const d = q.data?.data as MangalData | null;
  return (
    <DoshaCard
      title={t("sections.doshas.mangalTitle")}
      alias={t("sections.doshas.mangalAlias")}
      subtitle={t("sections.doshas.mangalSubtitle")}
      loading={q.isPending}
      error={q.isError || !!q.data?.errorCode || (!q.isPending && !d)}
      onRetry={() => q.refetch()}
    >
      {d && (
        <>
          <Badge
            active={d.has_dosha}
            activeLabel={t("sections.doshas.present")}
            inactiveLabel={t("sections.doshas.notPresent")}
          />
          {d.description && <Body text={d.description} />}
        </>
      )}
    </DoshaCard>
  );
}

function KaalSarpCard() {
  const { t } = useTranslation();
  const q = useDoshaReport("kaal_sarp_dosha");
  const d = q.data?.data as KaalSarpData | null;
  const typeLine = d?.type ?? d?.dosha_type ?? null;
  return (
    <DoshaCard
      title={t("sections.doshas.kaalSarpTitle")}
      subtitle={t("sections.doshas.kaalSarpSubtitle")}
      loading={q.isPending}
      error={q.isError || !!q.data?.errorCode || (!q.isPending && !d)}
      onRetry={() => q.refetch()}
    >
      {d && (
        <>
          <Badge
            active={d.has_dosha}
            activeLabel={t("sections.doshas.present")}
            inactiveLabel={t("sections.doshas.notPresent")}
          />
          {d.description && <Body text={d.description} />}
          {typeLine && <MetaLine label={t("sections.doshas.typeLabel")} value={typeLine} />}
        </>
      )}
    </DoshaCard>
  );
}

function SadeSatiCard() {
  const { t } = useTranslation();
  const q = useDoshaReport("sade_sati");
  const d = q.data?.data as SadeSatiData | null;
  return (
    <DoshaCard
      title={t("sections.doshas.sadeSatiTitle")}
      subtitle={t("sections.doshas.sadeSatiSubtitle")}
      loading={q.isPending}
      error={q.isError || !!q.data?.errorCode || (!q.isPending && !d)}
      onRetry={() => q.refetch()}
    >
      {d && (
        <>
          <Badge
            active={d.is_in_sade_sati}
            activeLabel={t("sections.doshas.active")}
            inactiveLabel={t("sections.doshas.notActive")}
          />
          {d.description && <Body text={d.description} />}
          {d.transit_phase && (
            <MetaLine label={t("sections.doshas.phaseLabel")} value={d.transit_phase} />
          )}
        </>
      )}
    </DoshaCard>
  );
}

// ---------------------------------------------------------------- primitives

function DoshaCard({
  title,
  alias,
  subtitle,
  loading,
  error,
  onRetry,
  children,
}: {
  title: string;
  alias?: string;
  subtitle: string;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  children: React.ReactNode;
}) {
  return (
    <article className="flex flex-col gap-4 rounded-xl border border-border bg-background p-4">
      <header>
        <h3 className="text-base font-semibold text-foreground">
          {title}
          {alias && (
            <span className="ml-2 align-middle text-xs font-normal text-muted-foreground">
              ({alias})
            </span>
          )}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      </header>

      {loading && <Skeleton />}
      {!loading && error && <InlineError onRetry={onRetry} />}
      {!loading && !error && <div className="flex flex-col gap-3">{children}</div>}
    </article>
  );
}

function Badge({
  active,
  activeLabel,
  inactiveLabel,
}: {
  active: boolean;
  activeLabel: string;
  inactiveLabel: string;
}) {
  const tone = active
    ? "border-destructive/40 bg-destructive/10 text-destructive"
    : "border-accent/40 bg-accent/15 text-accent";
  const dot = active ? "bg-destructive" : "bg-accent/70";
  return (
    <span
      className={`inline-flex w-fit items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide ${tone}`}
    >
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {active ? activeLabel : inactiveLabel}
    </span>
  );
}

function Body({ text }: { text: string }) {
  return <p className="text-sm leading-6 text-foreground">{text}</p>;
}

function MetaLine({ label, value }: { label: string; value: string }) {
  return (
    <p className="text-sm text-muted-foreground">
      <span className="font-medium text-foreground">{label}:</span>{" "}
      <span className="text-foreground">{value}</span>
    </p>
  );
}

function Skeleton() {
  return (
    <div className="flex flex-col gap-3" aria-hidden="true">
      <div className="h-6 w-28 rounded-full bg-muted motion-safe:animate-pulse" />
      <div className="h-4 w-full rounded bg-muted motion-safe:animate-pulse" />
      <div className="h-4 w-5/6 rounded bg-muted motion-safe:animate-pulse" />
      <div className="h-4 w-2/3 rounded bg-muted motion-safe:animate-pulse" />
    </div>
  );
}

function InlineError({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3"
    >
      <div className="flex items-start gap-2 text-sm text-foreground">
        <AlertTriangle size={16} className="text-destructive" aria-hidden="true" />
        <span>{t("sections.doshas.loadError")}</span>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex min-h-11 w-fit items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <RefreshCw size={14} aria-hidden="true" />
        {t("sections.doshas.retry")}
      </button>
    </div>
  );
}
