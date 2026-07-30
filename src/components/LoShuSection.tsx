import { Fragment } from "react";
import { AlertTriangle, RefreshCw, Sparkles } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  useLoShu,
  type LoShuCell,
  type LoShuData,
  type LoShuMissingRemedy,
  type LoShuKua,
  type KuaDirection,
} from "@/lib/queries";
import { ExpandableSection } from "@/components/ExpandableSection";

export function LoShuSection() {
  const { t } = useTranslation();
  const query = useLoShu();
  const loading = query.isPending;
  const errorCode = query.isError ? "provider_error" : (query.data?.errorCode ?? null);
  const data = query.data?.data ?? null;

  return (
    <div className="space-y-6">
      <Card>
        <Header />
        {loading && <LoadingBody />}
        {!loading && errorCode && (
          <ErrorBody code={errorCode} onRetry={() => query.refetch()} t={t} />
        )}
        {!loading && !errorCode && !isValid(data) && <EmptyBody t={t} />}
        {!loading && !errorCode && isValid(data) && <Body data={data!} />}
      </Card>
    </div>
  );
}

function isValid(d: LoShuData | null): boolean {
  return !!d && Array.isArray(d.grid) && d.grid.length === 3;
}

// ---------------------------------------------------------------- body

function Body({ data }: { data: LoShuData }) {
  const { t } = useTranslation();
  return (
    <div className="mt-5 space-y-4">
      {/* Grid */}
      <ExpandableSection title={t("sections.loshu.gridTitle")} defaultOpen>
        <div className="flex flex-col items-center gap-4">
          <div role="grid" aria-label={t("sections.loshu.title")} className="grid grid-cols-3 gap-2 sm:gap-3">
            {data.grid.flat().map((cell, i) => (
              <GridCell key={i} cell={cell} />
            ))}
          </div>
          {data.added_to_grid && data.added_to_grid.length > 0 && (
            <p
              className="max-w-xs text-center text-[11px] text-muted-foreground"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {t("sections.loshu.gridIncludes", { numbers: data.added_to_grid.join(", ") })}
            </p>
          )}
          <div className="flex flex-wrap justify-center gap-2">
            <Chip label={t("sections.loshu.driver")} value={data.driver} tone="gold" />
            <Chip label={t("sections.loshu.destiny")} value={data.destiny} tone="gold" />
          </div>
        </div>
      </ExpandableSection>

      {/* Present numbers */}
      <ExpandableSection
        title={t("sections.loshu.presentNumbers")}
        badge={data.present?.length ?? 0}
        defaultOpen
      >
        <NumberList
          numbers={data.present}
          meanings={data.meanings}
          tone="present"
          emptyText={t("sections.loshu.noNumbersPresent")}
        />
      </ExpandableSection>

      {/* Missing numbers */}
      <ExpandableSection
        title={t("sections.loshu.missingNumbers")}
        badge={data.missing?.length ?? 0}
      >
        <NumberList
          numbers={data.missing}
          meanings={data.meanings}
          tone="missing"
          emptyText={t("sections.loshu.noMissingNumbers")}
        />
      </ExpandableSection>

      {/* Repeated */}
      {data.repeated_details && data.repeated_details.length > 0 && (
        <ExpandableSection
          title={t("sections.loshu.repeated")}
          badge={data.repeated_details.length}
        >
          <ul className="flex flex-col gap-2">
            {data.repeated_details.map((r) => (
              <li key={r.number} className="rounded-lg border border-border bg-background p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border/70 bg-card text-sm font-semibold text-glow-gold"
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {r.number}
                  </span>
                  <span
                    className="text-xs text-muted-foreground"
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {r.digits} ({r.count}x)
                  </span>
                  <span className="rounded-md border px-2 py-0.5 text-[10px] uppercase tracking-wider text-glow-violet border-glow-violet/[33%] bg-glow-violet/10">
                    {r.level}
                  </span>
                </div>
                {r.note && <p className="mt-2 text-sm leading-snug text-foreground">{r.note}</p>}
                {r.meaning && <p className="mt-1 text-xs text-muted-foreground">{r.meaning}</p>}
              </li>
            ))}
          </ul>
        </ExpandableSection>
      )}

      {/* Arrows */}
      {data.arrows && data.arrows.length > 0 && (
        <ExpandableSection title={t("sections.loshu.arrows")} badge={data.arrows.length}>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {data.arrows.map((a, i) => {
              const tone = a.type === "strength" ? "gold" : "destructive";
              const textTone = tone === "gold" ? "text-glow-gold" : "text-destructive";
              const pillTone =
                tone === "gold"
                  ? "text-glow-gold border-glow-gold/[33%] bg-glow-gold/10"
                  : "text-destructive border-destructive/[33%] bg-destructive/10";
              return (
                <li key={i} className="rounded-lg border border-border bg-background p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className={"text-sm font-semibold " + textTone}>{a.name}</p>
                      <p className="mt-0.5 text-[11px] uppercase tracking-wider text-muted-foreground">
                        {a.type}
                      </p>
                    </div>
                    <span
                      className={"rounded-md border px-2 py-1 text-xs font-medium " + pillTone}
                      style={{ fontVariantNumeric: "tabular-nums" }}
                    >
                      {a.numbers.join("-")}
                    </span>
                  </div>
                  {a.meaning && (
                    <p className="mt-2 text-sm leading-snug text-foreground">{a.meaning}</p>
                  )}
                </li>
              );
            })}
          </ul>
        </ExpandableSection>
      )}

      {/* Remedies for missing numbers */}
      {data.missing_remedies && data.missing_remedies.length > 0 && (
        <ExpandableSection
          title={t("sections.loshu.remediesTitle")}
          badge={data.missing_remedies.length}
        >
          <p className="mb-3 text-xs text-muted-foreground">
            {t("sections.loshu.remediesSubtitle")}
          </p>
          <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {data.missing_remedies.map((r) => (
              <RemedyCard key={r.number} remedy={r} />
            ))}
          </ul>
        </ExpandableSection>
      )}

      {/* Kua directions */}
      <ExpandableSection title={t("sections.loshu.kuaTitle")}>
        <KuaCard kua={data.kua} />
      </ExpandableSection>
    </div>
  );
}

// ---------------------------------------------------------------- kua

const COMPASS_ORDER: Array<"NW" | "N" | "NE" | "W" | "C" | "E" | "SW" | "S" | "SE"> = [
  "NW",
  "N",
  "NE",
  "W",
  "C",
  "E",
  "SW",
  "S",
  "SE",
];

function KuaCard({ kua }: { kua?: LoShuKua }) {
  const { t } = useTranslation();
  const ready = kua && kua.available === true;
  return (
    <div>
      <p className="text-xs text-muted-foreground">{t("sections.loshu.kuaSubtitle")}</p>

      {!ready ? (
        <div className="mt-4 flex flex-col items-start gap-3 rounded-lg border border-dashed border-border/70 bg-muted/30 p-5">
          <p className="text-sm text-foreground">{t("sections.loshu.kuaUnlockPrompt")}</p>
          <Link
            to="/onboarding/birth"
            className="inline-flex items-center rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          >
            {t("sections.loshu.completeProfile")}
          </Link>
        </div>
      ) : (
        <KuaBody kua={kua as Extract<LoShuKua, { available: true }>} />
      )}
    </div>
  );
}

function KuaBody({ kua }: { kua: Extract<LoShuKua, { available: true }> }) {
  const { t } = useTranslation();
  const favMap = new Map<string, KuaDirection>();
  kua.favorable?.forEach((d) => favMap.set(d.direction, d));
  const unfavMap = new Map<string, KuaDirection>();
  kua.unfavorable?.forEach((d) => unfavMap.set(d.direction, d));

  return (
    <div className="mt-4 space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-full border text-glow-gold border-glow-gold/[40%] bg-glow-gold/10"
          aria-label={`Kua number ${kua.number}`}
        >
          <span className="text-lg font-semibold leading-none" style={{ fontVariantNumeric: "tabular-nums" }}>
            {kua.number}
          </span>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium text-glow-gold border-glow-gold/[33%] bg-glow-gold/10">
          {t("sections.loshu.kuaGroup", { group: kua.group })}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium text-glow-violet border-glow-violet/[33%] bg-glow-violet/10">
          {kua.element}
        </span>
      </div>

      {/* Compass 3x3 */}
      <div
        role="grid"
        aria-label="Kua compass directions"
        className="mx-auto grid w-full max-w-sm grid-cols-3 gap-2 sm:gap-3"
      >
        {COMPASS_ORDER.map((dir) => {
          if (dir === "C") {
            return (
              <div
                key="C"
                role="gridcell"
                className="flex aspect-square min-h-[44px] flex-col items-center justify-center rounded-xl border border-border bg-card"
              >
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Kua
                </span>
                <span
                  className="text-2xl font-semibold leading-none text-glow-gold"
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {kua.number}
                </span>
              </div>
            );
          }
          const fav = favMap.get(dir);
          const unfav = unfavMap.get(dir);
          const isFav = !!fav;
          const textTone = isFav ? "text-glow-gold" : "text-destructive";
          const pillTone = isFav
            ? "text-glow-gold border-glow-gold/[33%] bg-glow-gold/10"
            : "text-destructive border-destructive/[33%] bg-destructive/10";
          const label = fav?.name ?? unfav?.name ?? "";
          return (
            <div
              key={dir}
              role="gridcell"
              title={fav?.theme ?? unfav?.theme ?? ""}
              aria-label={`${dir} ${isFav ? "favourable" : "unfavourable"}: ${label}`}
              className={
                "flex aspect-square min-h-[44px] flex-col items-center justify-center gap-1 rounded-xl border px-1 text-center " +
                pillTone
              }
            >
              <span className={"text-[11px] font-semibold uppercase tracking-wider " + textTone}>
                {dir}
              </span>
              <span className="text-[10px] leading-tight text-foreground/80">{label}</span>
            </div>
          );
        })}
      </div>

      {/* Lists */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <DirList
          title={t("sections.loshu.luckyDirections")}
          tone="gold"
          items={kua.favorable ?? []}
        />
        <DirList
          title={t("sections.loshu.directionsToAvoid")}
          tone="red"
          items={kua.unfavorable ?? []}
        />
      </div>

      {kua.note && <p className="text-xs text-muted-foreground">{kua.note}</p>}
    </div>
  );
}

function DirList({
  title,
  tone,
  items,
}: {
  title: string;
  tone: "gold" | "red";
  items: KuaDirection[];
}) {
  const textTone = tone === "gold" ? "text-glow-gold" : "text-destructive";
  const badgeTone =
    tone === "gold"
      ? "text-glow-gold border-glow-gold/[33%] bg-glow-gold/10"
      : "text-destructive border-destructive/[33%] bg-destructive/10";
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <h4 className={"text-sm font-semibold " + textTone}>{title}</h4>
      <ul className="mt-2 divide-y divide-border/60">
        {items.map((d) => (
          <li
            key={d.direction + d.name}
            className="flex items-center gap-3 py-2 first:pt-0 last:pb-0"
          >
            <span
              className={
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border text-xs font-semibold " +
                badgeTone
              }
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {d.direction}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium leading-snug text-foreground">{d.name}</p>
              {d.theme && (
                <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{d.theme}</p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------- pieces

function GridCell({ cell }: { cell: LoShuCell }) {
  const filled = cell.count > 0;
  return (
    <div
      role="gridcell"
      title={cell.meaning}
      aria-label={`${cell.number}: ${cell.meaning}${filled ? ` (x${cell.count})` : " — empty"}`}
      className={
        "group relative flex h-24 w-24 flex-col items-center justify-center gap-0.5 rounded-xl border px-1 sm:h-28 sm:w-28 " +
        (filled ? "border-border bg-background" : "border-dashed border-border/60 bg-muted/20")
      }
    >
      <span
        className="absolute left-1.5 top-1 text-[10px] font-medium text-muted-foreground"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {cell.number}
      </span>
      {filled ? (
        <>
          <span
            className="text-2xl font-semibold leading-none sm:text-3xl text-glow-gold"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {cell.digits}
          </span>
          {(cell.planet || cell.element) && (
            <span className="mt-0.5 text-center text-[9px] leading-tight text-muted-foreground">
              {cell.planet}
              {cell.planet && cell.element ? " · " : ""}
              {cell.element}
            </span>
          )}
        </>
      ) : (
        <>
          <span className="text-xl text-muted-foreground/40" aria-hidden="true">
            ·
          </span>
          {(cell.planet || cell.element) && (
            <span className="mt-0.5 text-center text-[9px] leading-tight text-muted-foreground/70">
              {cell.planet}
              {cell.planet && cell.element ? " · " : ""}
              {cell.element}
            </span>
          )}
        </>
      )}
    </div>
  );
}

function RemedyCard({ remedy }: { remedy: LoShuMissingRemedy }) {
  const { t } = useTranslation();
  const rows: Array<{ label: string; value: string }> = [
    { label: t("sections.loshu.colour"), value: remedy.colour },
    { label: t("sections.loshu.mantra"), value: remedy.mantra },
    { label: t("sections.loshu.luckyDirection"), value: remedy.direction },
    { label: t("sections.loshu.practice"), value: remedy.practice },
  ].filter((r) => !!r.value);
  return (
    <li className="rounded-xl border border-border bg-background p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border text-glow-violet border-glow-violet/[33%] bg-glow-violet/10">
          <span className="text-lg font-semibold leading-none" style={{ fontVariantNumeric: "tabular-nums" }}>
            {remedy.number}
          </span>
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="text-sm font-semibold text-foreground">
            {remedy.planet}
            {remedy.element ? (
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                · {remedy.element}
              </span>
            ) : null}
          </p>
          {remedy.meaning && (
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{remedy.meaning}</p>
          )}
        </div>
      </div>
      {rows.length > 0 && (
        <dl className="mt-4 grid grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-2 border-t border-border/60 pt-3 text-sm">
          {rows.map((r) => (
            <Fragment key={r.label}>
              <dt className="whitespace-nowrap text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                {r.label}
              </dt>
              <dd className="min-w-0 text-sm text-foreground">{r.value}</dd>
            </Fragment>
          ))}
        </dl>
      )}
    </li>
  );
}

function Chip({ label, value, tone }: { label: string; value: number; tone: "gold" | "lavender" }) {
  const pillTone =
    tone === "gold"
      ? "text-glow-gold border-glow-gold/[33%] bg-glow-gold/10"
      : "text-glow-violet border-glow-violet/[33%] bg-glow-violet/10";
  return (
    <span
      className={"inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium " + pillTone}
    >
      {label}: <span style={{ fontVariantNumeric: "tabular-nums" }}>{value}</span>
    </span>
  );
}

function NumberList({
  numbers,
  meanings,
  tone,
  emptyText,
}: {
  numbers: number[];
  meanings: Record<string, string>;
  tone: "present" | "missing";
  emptyText: string;
}) {
  const pillTone =
    tone === "present"
      ? "text-glow-gold border-glow-gold/[33%] bg-glow-gold/10"
      : "text-glow-violet border-glow-violet/[33%] bg-glow-violet/10";
  return !numbers || numbers.length === 0 ? (
    <p className="text-sm text-muted-foreground">{emptyText}</p>
  ) : (
    <ul className="flex flex-col gap-2">
      {numbers.map((n) => (
        <li
          key={n}
          className="flex items-start gap-3 rounded-lg border border-border/60 bg-card p-3"
        >
          <div
            className={
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border " + pillTone
            }
          >
            <span className="text-lg font-semibold leading-none" style={{ fontVariantNumeric: "tabular-nums" }}>
              {n}
            </span>
          </div>
          <p className="min-w-0 flex-1 text-sm leading-snug text-foreground">
            {meanings?.[String(n)] ?? ""}
          </p>
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------- shell

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl border border-border bg-card p-5"
      style={{ boxShadow: "var(--shadow-soft)" }}
    >
      {children}
    </div>
  );
}

function Header() {
  const { t } = useTranslation();
  return (
    <div>
      <h2 className="text-base font-semibold text-foreground">{t("sections.loshu.title")}</h2>
      <p className="mt-1 text-xs text-muted-foreground">{t("sections.loshu.subtitle")}</p>
    </div>
  );
}

function LoadingBody() {
  return (
    <div className="mt-5 space-y-6" aria-hidden="true">
      <div className="flex justify-center">
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="h-20 w-20 animate-pulse rounded-xl bg-muted sm:h-24 sm:w-24" />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="animate-pulse rounded-xl border border-border bg-background p-4">
            <div className="h-4 w-32 rounded bg-muted" />
            <div className="mt-4 space-y-2">
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={j} className="h-12 w-full rounded-lg bg-muted" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ErrorBody({
  code,
  onRetry,
  t,
}: {
  code: string;
  onRetry: () => void;
  t: (k: string) => string;
}) {
  const missing = code === "birth_profile_incomplete";
  return (
    <div
      role="alert"
      className="mt-6 flex flex-col items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4"
    >
      <div className="flex items-center gap-2 text-destructive">
        <AlertTriangle size={18} aria-hidden="true" />
        <p className="text-sm font-medium text-foreground">{t("sections.loshu.loadError")}</p>
      </div>
      <p className="text-sm text-muted-foreground">
        {missing ? t("sections.loshu.profileIncomplete") : t("sections.loshu.tryAgainLater")}
      </p>
      <div className="flex flex-wrap gap-2">
        {missing && (
          <Link
            to="/onboarding/birth"
            className="inline-flex items-center rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          >
            {t("sections.loshu.completeBirthProfile")}
          </Link>
        )}
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
        >
          <RefreshCw size={14} aria-hidden="true" />
          {t("sections.dasha.retry")}
        </button>
      </div>
    </div>
  );
}

function EmptyBody({ t }: { t: (k: string) => string }) {
  return (
    <div className="mt-6 flex flex-col items-center gap-3 rounded-lg border border-dashed border-border/70 bg-muted/30 p-8 text-center">
      <Sparkles size={22} aria-hidden="true" className="text-primary" />
      <p className="text-sm font-medium text-foreground">{t("states.empty")}</p>
    </div>
  );
}

export default LoShuSection;
