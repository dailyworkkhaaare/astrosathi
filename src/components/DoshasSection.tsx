import { AlertTriangle, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  useDoshaReport,
  usePlanets,
  useSadeSatiTimeline,
  useTodayTransits,
} from "@/lib/queries";
import { SIGN_KEYS_BY_INDEX } from "@/lib/charts";
import { DoshaRemedySummary } from "@/components/RemediesSection";

type MangalData = { has_dosha: boolean; description: string };
type KaalSarpData = {
  has_dosha: boolean;
  description: string;
  type: string | null;
  dosha_type: string | null;
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
          {d.has_dosha && <DoshaRemedySummary doshaKey="mangal_dosha" />}
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
          {d.has_dosha && <DoshaRemedySummary doshaKey="kaal_sarp_dosha" />}
        </>
      )}
    </DoshaCard>
  );
}

function SadeSatiCard() {
  const { t, i18n } = useTranslation();
  const planetsQ = usePlanets();
  const transitsQ = useTodayTransits();
  const timelineQ = useSadeSatiTimeline();

  const loading = planetsQ.isPending || transitsQ.isPending;

  const moonSign =
    planetsQ.data?.planets.find((p) => p.key === "moon")?.signIndex ?? null;
  const saturn =
    transitsQ.data?.planets.find((p) => p.planet === 6) ?? null;
  const saturnSign = saturn?.signIndex ?? null;
  const timezone = transitsQ.data?.timezone ?? "Asia/Kolkata";

  const signLabel = (i: number | null | undefined) =>
    i == null ? null : t(`signs.${SIGN_KEYS_BY_INDEX[i]}`);

  const formatDate = (iso: string) =>
    new Intl.DateTimeFormat(i18n.language, {
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: timezone,
    }).format(new Date(iso));

  const canCompute = moonSign != null && saturnSign != null;

  let phase: "rising" | "peak" | "setting" | null = null;
  let dhaiya: "kantaka" | "ashtama" | null = null;
  let twelfth = 0;
  let overMoon = 0;
  let second = 0;
  if (canCompute && moonSign != null && saturnSign != null) {
    twelfth = (moonSign + 11) % 12;
    overMoon = moonSign;
    second = (moonSign + 1) % 12;
    const fourth = (moonSign + 3) % 12;
    const eighth = (moonSign + 7) % 12;
    if (saturnSign === twelfth) phase = "rising";
    else if (saturnSign === overMoon) phase = "peak";
    else if (saturnSign === second) phase = "setting";
    if (phase === null) {
      if (saturnSign === fourth) dhaiya = "kantaka";
      else if (saturnSign === eighth) dhaiya = "ashtama";
    }
  }
  const inSadeSati = phase !== null;

  const phaseLabelKey =
    phase === "rising"
      ? "sections.doshas.sadeSatiPhaseRising"
      : phase === "peak"
        ? "sections.doshas.sadeSatiPhasePeak"
        : phase === "setting"
          ? "sections.doshas.sadeSatiPhaseSetting"
          : null;

  const dhaiyaLabelKey =
    dhaiya === "kantaka"
      ? "sections.doshas.sadeSatiKantaka"
      : dhaiya === "ashtama"
        ? "sections.doshas.sadeSatiAshtama"
        : null;

  const nextIngress = saturn?.nextIngressTs ?? null;
  const nextSignIndex = saturn?.nextSignIndex ?? null;
  const nextIsSadeSati =
    inSadeSati &&
    nextSignIndex != null &&
    (nextSignIndex === twelfth ||
      nextSignIndex === overMoon ||
      nextSignIndex === second);

  // Step 2 enhancement: real episode + phase date-ranges from sade-sati-timeline
  // edge function. Timeline is layered over Step 1; any failure or pending state
  // falls back to Step 1 output silently.
  const timeline = timelineQ.data?.episode ?? null;
  const timelineInSadeSati = !!timelineQ.data?.inSadeSati;
  const timelineTimeUncertain = !!timelineQ.data?.moonTimeUncertain;
  const formatDay = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return new Intl.DateTimeFormat(i18n.language, {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(d);
  };
  const currentPhaseEntry =
    timeline && timelineInSadeSati && timeline.currentPhase
      ? timeline.phases.find((p) => p.phase === timeline.currentPhase) ?? null
      : null;
  const useTimelineRange = timeline && timelineInSadeSati && currentPhaseEntry;

  const descKey =
    phase === "rising"
      ? "sections.doshas.sadeSatiDescRising"
      : phase === "peak"
        ? "sections.doshas.sadeSatiDescPeak"
        : phase === "setting"
          ? "sections.doshas.sadeSatiDescSetting"
          : "sections.doshas.sadeSatiDescNone";

  return (
    <DoshaCard
      title={t("sections.doshas.sadeSatiTitle")}
      subtitle={t("sections.doshas.sadeSatiSubtitle")}
      loading={loading}
      error={!loading && !canCompute}
      onRetry={() => {
        planetsQ.refetch();
        transitsQ.refetch();
      }}
    >
      {canCompute && (
        <>
          <Badge
            calm
            active={inSadeSati}
            activeLabel={t("sections.doshas.active")}
            inactiveLabel={t("sections.doshas.notActive")}
          />
          {inSadeSati && phaseLabelKey && (
            <MetaLine
              label={t("sections.doshas.phaseLabel")}
              value={t(phaseLabelKey)}
            />
          )}
          {inSadeSati && useTimelineRange && currentPhaseEntry && timeline && (
            <>
              <Body
                text={t("sections.doshas.sadeSatiPhaseRange", {
                  phase: t(phaseLabelKey ?? "sections.doshas.phaseLabel"),
                  start: formatDay(currentPhaseEntry.startTs),
                  end: formatDay(currentPhaseEntry.endTs),
                })}
              />
              <Body
                text={t("sections.doshas.sadeSatiEpisodeRange", {
                  start: formatDay(timeline.startTs),
                  end: formatDay(timeline.endTs),
                })}
              />
              {timelineTimeUncertain && (
                <Body text={t("sections.doshas.sadeSatiTimeApprox")} />
              )}
            </>
          )}
          {inSadeSati && !useTimelineRange && nextIngress && (
            <Body
              text={t("sections.doshas.sadeSatiUntil", {
                date: formatDate(nextIngress),
              })}
            />
          )}
          {inSadeSati && !useTimelineRange && nextIngress && nextIsSadeSati && nextSignIndex != null && (
            <Body
              text={t("sections.doshas.sadeSatiThenEnters", {
                sign: signLabel(nextSignIndex),
              })}
            />
          )}
          {inSadeSati && !useTimelineRange && nextIngress && !nextIsSadeSati && saturnSign != null && (
            <Body
              text={t("sections.doshas.sadeSatiEnding", {
                sign: signLabel(saturnSign),
              })}
            />
          )}
          {!inSadeSati && dhaiya && dhaiyaLabelKey && (
            <>
              <MetaLine
                label={t("sections.doshas.phaseLabel")}
                value={t(dhaiyaLabelKey)}
              />
              {nextIngress && (
                <Body
                  text={t("sections.doshas.sadeSatiUntil", {
                    date: formatDate(nextIngress),
                  })}
                />
              )}
            </>
          )}
          {!inSadeSati && !dhaiya && (
            <Body text={t("sections.doshas.sadeSatiNone")} />
          )}
          {!inSadeSati && timeline && !timelineInSadeSati && (
            <Body
              text={t("sections.doshas.sadeSatiNextEpisode", {
                start: formatDay(timeline.startTs),
              })}
            />
          )}
          {timeline && (
            <SadeSatiTimelineBar
              episode={timeline}
              inSadeSati={timelineInSadeSati}
            />
          )}
          <Body text={t(descKey)} />
          {inSadeSati && <DoshaRemedySummary doshaKey="sade_sati" />}
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
  calm = false,
}: {
  active: boolean;
  activeLabel: string;
  inactiveLabel: string;
  calm?: boolean;
}) {
  const tone =
    active && !calm
      ? "border-destructive/40 bg-destructive/10 text-destructive"
      : "border-accent/40 bg-accent/15 text-accent";
  const dot = active && !calm ? "bg-destructive" : "bg-accent/70";
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

type TimelineEpisode = {
  startTs: string;
  endTs: string;
  currentPhase: "rising" | "peak" | "setting" | null;
  phases: {
    phase: "rising" | "peak" | "setting";
    signIndex: number;
    startTs: string;
    endTs: string;
  }[];
};

function SadeSatiTimelineBar({
  episode,
  inSadeSati,
}: {
  episode: TimelineEpisode;
  inSadeSati: boolean;
}) {
  const { t, i18n } = useTranslation();
  const start = new Date(episode.startTs).getTime();
  const end = new Date(episode.endTs).getTime();
  const span = Math.max(1, end - start);

  const monthFmt = new Intl.DateTimeFormat(i18n.language, {
    year: "numeric",
    month: "short",
  });
  const startLabel = monthFmt.format(new Date(start));
  const endLabel = monthFmt.format(new Date(end));

  const order: ("rising" | "peak" | "setting")[] = ["rising", "peak", "setting"];
  const seg = (name: "rising" | "peak" | "setting") => {
    const p = episode.phases.find((x) => x.phase === name);
    if (!p) return { widthPct: 0, present: false };
    const ps = Math.max(new Date(p.startTs).getTime(), start);
    const pe = Math.min(new Date(p.endTs).getTime(), end);
    const w = Math.max(0, pe - ps);
    return { widthPct: (w / span) * 100, present: true };
  };
  const segments = order.map((name) => ({ name, ...seg(name) }));
  const totalWidth = segments.reduce((s, x) => s + x.widthPct, 0) || 1;
  // Normalize so segments always fill the track (handles tiny rounding gaps).
  const normalized = segments.map((s) => ({
    ...s,
    widthPct: (s.widthPct / totalWidth) * 100,
  }));

  const markerPct =
    inSadeSati
      ? Math.min(100, Math.max(0, ((Date.now() - start) / span) * 100))
      : null;

  const shortLabel = (name: "rising" | "peak" | "setting") =>
    name === "rising"
      ? t("sections.doshas.sadeSatiShortRising")
      : name === "peak"
        ? t("sections.doshas.sadeSatiShortPeak")
        : t("sections.doshas.sadeSatiShortSetting");

  const currentShort =
    inSadeSati && episode.currentPhase ? shortLabel(episode.currentPhase) : null;

  const ariaLabel = inSadeSati && currentShort
    ? t("sections.doshas.sadeSatiTimelineAria", {
        start: startLabel,
        end: endLabel,
        phase: currentShort,
      })
    : t("sections.doshas.sadeSatiTimelineAriaUpcoming", {
        start: startLabel,
        end: endLabel,
      });

  const toneFor = (name: "rising" | "peak" | "setting") =>
    name === "peak" ? "bg-accent/45" : "bg-accent/25";

  return (
    <div
      className={`motion-fade-in flex flex-col gap-1.5 ${inSadeSati ? "" : "opacity-70"}`}
    >
      <div
        role="img"
        aria-label={ariaLabel}
        className="relative h-2.5 w-full overflow-hidden rounded-full bg-muted"
      >
        <div aria-hidden="true" className="flex h-full w-full">
          {normalized.map((s, i) => (
            <div
              key={s.name}
              className={`h-full ${toneFor(s.name)} ${i > 0 ? "border-l border-background/60" : ""}`}
              style={{ width: `${s.widthPct}%` }}
            />
          ))}
        </div>
        {markerPct != null && (
          <div
            aria-hidden="true"
            className="motion-reduce:animate-none pointer-events-none absolute top-0 flex h-full flex-col items-center"
            style={{ left: `${markerPct}%`, transform: "translateX(-50%)" }}
          >
            <span className="-mt-1 h-2 w-2 rounded-full bg-foreground" />
            <span className="h-full w-0.5 rounded-full bg-foreground" />
          </div>
        )}
      </div>
      <div aria-hidden="true" className="flex w-full text-[11px] text-muted-foreground">
        {normalized.map((s) => {
          const isCurrent = inSadeSati && episode.currentPhase === s.name;
          return (
            <div
              key={s.name}
              className={`min-w-0 truncate text-center ${isCurrent ? "font-medium text-foreground" : ""}`}
              style={{ width: `${s.widthPct}%` }}
            >
              {shortLabel(s.name)}
            </div>
          );
        })}
      </div>
      <div
        aria-hidden="true"
        className="flex justify-between text-[11px] text-muted-foreground"
      >
        <span>{startLabel}</span>
        <span>{endLabel}</span>
      </div>
    </div>
  );
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
