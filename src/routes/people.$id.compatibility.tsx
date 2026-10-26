import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronLeft, MessageCircle, Share2 } from "lucide-react";
import { toast } from "sonner";

import { AstroArt } from "@/components/AstroArt";
import { signArtByIndex } from "@/lib/astro-art";
import { useRequireOnboarding } from "@/lib/require-auth";
import { useCompatibility, usePersonCharts } from "@/lib/queries";
import type { CompatibilityBundle, CompatibilityKuta } from "@/lib/related-charts";
import { shareNative, triggerHaptic } from "@/lib/native-device";
import { cn } from "@/lib/utils";
import { ErrorState } from "@/components/states/ErrorState";

export const Route = createFileRoute("/people/$id/compatibility")({
  head: () => ({
    meta: [{ title: "Compatibility — AstroSaathi" }],
  }),
  component: CompatibilityPage,
});

const KUTA_KEY: Record<string, string> = {
  Varna: "varna",
  Vashya: "vashya",
  Tara: "tara",
  Yoni: "yoni",
  "Graha Maitri": "grahaMaitri",
  Gana: "gana",
  Bhakoot: "bhakoot",
  Nadi: "nadi",
};

const BENEFIC_PLANETS = new Set(["venus", "jupiter", "moon"]);
const CONVERSATION_PLANETS = new Set(["saturn", "mars"]);

const KNOWN_ERROR_CODES = new Set([
  "no_self_profile",
  "not_compat_eligible",
  "missing_self_coordinates",
  "missing_partner_coordinates",
]);

function CompatibilityPage() {
  useRequireOnboarding();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams({ from: "/people/$id/compatibility" });
  const personQuery = usePersonCharts(id);
  const query = useCompatibility(id);

  const personBundle =
    personQuery.data && !personQuery.data.error ? personQuery.data.data.person.full_name : "";
  const bundle = query.data && !query.data.error ? query.data.data : null;
  const partnerName = bundle?.partner.name ?? personBundle;
  const errorCode = query.isError ? "provider_error" : (query.data?.error?.code ?? null);
  const loading = query.isPending;

  const askAboutCompatibility = () => {
    if (!bundle) return;
    void triggerHaptic("selection");
    void navigate({
      to: "/chat",
      search: {
        seed: t("people.compatibility.askSeed", {
          partner: partnerName || t("people.compatibility.partnerFallback"),
        }),
        subjectRelatedChartId: id,
      },
    });
  };

  const shareCompatibility = async () => {
    if (!bundle) return;
    const partner = partnerName || t("people.compatibility.partnerFallback");
    const { total, max, verdict } = bundle.guna_milan;
    const result = await shareNative({
      title: t("people.compatibility.shareTitle", { partner }),
      text: [
        t("people.compatibility.shareScore", { partner, got: total, max }),
        t(`people.compatibility.gunaMilan.verdicts.${verdict}`),
      ].join("\n\n"),
      url: typeof window !== "undefined" ? window.location.href : undefined,
    });
    if (result === "shared") void triggerHaptic("success");
    if (result === "copied") toast.success(t("people.compatibility.sharedCopied"));
  };

  return (
    <section className="mx-auto max-w-2xl">
      <nav className="motion-fade-up -mx-2 -mt-2 flex min-h-11 items-center justify-between">
        <Link
          to="/people/$id"
          params={{ id }}
          aria-label={t("people.compatibility.back")}
          className="tap-press inline-flex min-h-11 min-w-0 items-center gap-0.5 rounded-full pl-1 pr-3 text-[1.0625rem] text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronLeft size={22} className="shrink-0" aria-hidden="true" />
          <span className="truncate">{partnerName || t("people.detail.back")}</span>
        </Link>
        {bundle ? (
          <button
            type="button"
            aria-label={t("people.compatibility.share")}
            title={t("people.compatibility.share")}
            onClick={() => void shareCompatibility()}
            className="tap-press grid h-11 w-11 shrink-0 place-items-center rounded-full text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Share2 size={20} aria-hidden="true" />
          </button>
        ) : null}
      </nav>

      <header className="motion-fade-up mt-1">
        <h1 className="large-title text-foreground">{t("people.compatibility.title")}</h1>
        {partnerName ? (
          <p className="mt-1.5 text-[0.9375rem] leading-snug text-muted-foreground">
            {t("people.compatibility.subtitle", { partner: partnerName })}
          </p>
        ) : null}
      </header>

      {loading && (
        <div className="mt-6 space-y-3" aria-hidden="true">
          <div className="h-28 motion-safe:animate-pulse rounded-[1.25rem] bg-card" />
          <div className="h-40 motion-safe:animate-pulse rounded-[1.25rem] bg-card" />
        </div>
      )}

      {!loading && errorCode && (
        <div className="mt-6">
          <ErrorState
            scope="panel"
            title={t("people.compatibility.errorTitle")}
            description={t(
              errorCode && KNOWN_ERROR_CODES.has(errorCode)
                ? `people.compatibility.errors.${errorCode}`
                : "people.compatibility.loadError",
              { partner: partnerName || t("people.detail.compatibility") },
            )}
            onRetry={() => void query.refetch()}
          />
        </div>
      )}

      {!loading && bundle && (
        <>
          <CompatibilityOverview bundle={bundle} partnerName={partnerName} onAsk={askAboutCompatibility} />
          <GunaMilanCard bundle={bundle} />
          <MangalCard bundle={bundle} partnerName={partnerName} />
          <SynastryCard bundle={bundle} partnerName={partnerName} />
        </>
      )}
    </section>
  );
}

const SECTION_LABEL =
  "px-4 pb-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground [:lang(hi)_&]:tracking-normal [:lang(mr)_&]:tracking-normal";
const GROUP =
  "list-hairline overflow-hidden rounded-[0.875rem] bg-card shadow-[var(--as-elevation-1)]";
const FOOTNOTE = "mt-2 px-4 text-xs leading-relaxed text-muted-foreground";

function PairAvatar({ sign, initial }: { sign: number; initial: string }) {
  const art = signArtByIndex(sign);
  return art ? (
    <span className="rounded-full bg-card ring-2 ring-card">
      <AstroArt kind="sign" name={art} size={44} />
    </span>
  ) : (
    <span
      aria-hidden="true"
      className="grid h-11 w-11 place-items-center rounded-full bg-accent/15 font-semibold text-accent ring-2 ring-card"
    >
      {initial}
    </span>
  );
}

function CompatibilityOverview({
  bundle,
  partnerName,
  onAsk,
}: {
  bundle: CompatibilityBundle;
  partnerName: string;
  onAsk: () => void;
}) {
  const { t } = useTranslation();
  const displayPartner = partnerName || t("people.compatibility.partnerFallback");
  const { highlights } = bundle.synastry;
  const easeHighlights = highlights.filter((highlight) => highlightGroup(highlight) === "ease");
  const conversationHighlights = highlights.filter(
    (highlight) => highlightGroup(highlight) === "conversation",
  );
  const { total, max } = bundle.guna_milan;
  const ratio = max > 0 ? Math.min(1, Math.max(0, total / max)) : 0;
  const circumference = 2 * Math.PI * 30;
  const patterns = [
    ...easeHighlights.map((h) => ({ h, type: "ease" as const })),
    ...conversationHighlights.map((h) => ({ h, type: "conversation" as const })),
  ];

  return (
    <>
      <section
        aria-label={t("people.compatibility.pairEyebrow")}
        className="motion-fade-up mt-6 rounded-[1.25rem] bg-card p-4 shadow-[var(--as-elevation-1)]"
      >
        <div className="flex items-center gap-3.5">
          <span className="flex shrink-0 -space-x-3" aria-hidden="true">
            <PairAvatar
              sign={bundle.self.moon_sign}
              initial={(t("people.compatibility.selfLabel")[0] ?? "·").toUpperCase()}
            />
            <PairAvatar
              sign={bundle.partner.moon_sign}
              initial={(displayPartner.trim()[0] ?? "·").toUpperCase()}
            />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[1.0625rem] font-semibold text-foreground">
              {t("people.compatibility.selfLabel")} &amp; {displayPartner}
            </span>
            <span className="block text-[0.8125rem] leading-snug text-muted-foreground">
              {t("people.compatibility.pairNote")}
            </span>
          </span>
        </div>
        <button
          type="button"
          onClick={onAsk}
          className="tap-press mt-3.5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-[var(--as-color-action-ask)] px-4 text-[0.9375rem] font-semibold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
        >
          <MessageCircle size={17} aria-hidden="true" />
          {t("people.compatibility.ask")}
        </button>
      </section>

      <section aria-labelledby="compatibility-patterns-title" className="motion-fade-up mt-7">
        <h2 id="compatibility-patterns-title" className={SECTION_LABEL}>
          {t("people.compatibility.overview.eyebrow")}
        </h2>
        {patterns.length === 0 ? (
          <p className="rounded-[0.875rem] bg-card px-4 py-3.5 text-sm text-muted-foreground shadow-[var(--as-elevation-1)]">
            {t("people.compatibility.synastry.empty")}
          </p>
        ) : (
          <ul className={`${GROUP} [--list-inset:2.25rem]`}>
            {patterns.map(({ h, type }) => (
              <li key={h} className="flex items-start gap-3 px-4 py-3">
                <span
                  aria-hidden="true"
                  className={cn(
                    "mt-[0.4375rem] h-2 w-2 shrink-0 rounded-full",
                    type === "ease" ? "bg-feedback-success" : "bg-feedback-warning",
                  )}
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-[0.9375rem] leading-snug text-foreground">
                    {highlightSentence(h, t)}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {t(`people.compatibility.overview.${type}Title`)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className={FOOTNOTE}>{t("people.compatibility.overview.summary")}</p>
      </section>

      <section
        aria-labelledby="compatibility-traditional-score-title"
        className="motion-fade-up mt-7 rounded-[1.25rem] bg-card p-4 shadow-[var(--as-elevation-1)]"
      >
        <div className="flex items-center gap-4">
          <div className="min-w-0 flex-1">
            <h2
              id="compatibility-traditional-score-title"
              className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground [:lang(hi)_&]:tracking-normal [:lang(mr)_&]:tracking-normal"
            >
              {t("people.compatibility.overview.traditionalTitle")}
            </h2>
            <p className="mt-1 tabular-nums">
              <span className="text-[2rem] font-semibold leading-none text-foreground">
                {total}
              </span>
              <span className="ml-1 text-base text-muted-foreground">/ {max}</span>
            </p>
            <p className="mt-1.5 text-[0.8125rem] leading-snug text-accent">
              {t(`people.compatibility.gunaMilan.verdicts.${bundle.guna_milan.verdict}`)}
            </p>
          </div>
          <svg
            viewBox="0 0 76 76"
            className="h-[4.75rem] w-[4.75rem] shrink-0 text-accent"
            role="img"
            aria-label={t("people.compatibility.gunaMilan.gotLabel", { got: total, max })}
          >
            <circle
              cx="38"
              cy="38"
              r="30"
              fill="none"
              stroke="currentColor"
              strokeOpacity="0.14"
              strokeWidth="7"
            />
            <circle
              cx="38"
              cy="38"
              r="30"
              fill="none"
              stroke="currentColor"
              strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray={`${ratio * circumference} ${circumference}`}
              transform="rotate(-90 38 38)"
            />
            <text
              x="38"
              y="42.5"
              textAnchor="middle"
              className="fill-foreground text-[13px] font-semibold"
            >
              {Math.round(ratio * 100)}%
            </text>
          </svg>
        </div>
        <p className="mt-3 border-t border-[var(--as-list-separator)] pt-3 text-xs leading-relaxed text-muted-foreground">
          <span className="font-semibold text-foreground">
            {t("people.compatibility.overview.traditionalLimitLabel")}
          </span>{" "}
          {t("people.compatibility.overview.traditionalLimit")}
        </p>
      </section>
    </>
  );
}

function GunaMilanCard({ bundle }: { bundle: CompatibilityBundle }) {
  const { t } = useTranslation();
  const { total, max, verdict, kutas } = bundle.guna_milan;

  return (
    <section
      aria-labelledby="guna-milan-title"
      aria-describedby="guna-milan-summary"
      className="motion-fade-up mt-7"
    >
      <h2 id="guna-milan-title" className={SECTION_LABEL}>
        {t("people.compatibility.gunaMilan.kutasTitle")}
      </h2>
      <p id="guna-milan-summary" className="sr-only">
        {t("people.compatibility.gunaMilan.gotLabel", { got: total, max })} ·{" "}
        {t(`people.compatibility.gunaMilan.verdicts.${verdict}`)}
      </p>
      <ul className={`${GROUP} [--list-inset:1rem]`}>
        {kutas.map((k) => (
          <KutaRow key={k.name} kuta={k} />
        ))}
      </ul>
      <p className={FOOTNOTE}>
        {t("people.compatibility.gunaMilan.method")} {t("people.compatibility.gunaMilan.limit")}
      </p>
    </section>
  );
}

function KutaRow({ kuta }: { kuta: CompatibilityKuta }) {
  const { t } = useTranslation();
  const key = KUTA_KEY[kuta.name] ?? kuta.name;
  const ratio = kuta.max > 0 ? Math.min(1, Math.max(0, kuta.got / kuta.max)) : 0;
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <span className="min-w-0 flex-1">
        <span className="block text-[0.9375rem] font-semibold text-foreground">
          {t(`people.compatibility.kutas.${key}.name`, kuta.name)}
        </span>
        <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
          {t(`people.compatibility.kutas.${key}.meaning`, "")}
        </span>
      </span>
      <span
        aria-hidden="true"
        className="h-1 w-12 shrink-0 overflow-hidden rounded-full bg-foreground/[0.1]"
      >
        <span
          className="block h-full rounded-full bg-accent"
          style={{ width: `${ratio * 100}%` }}
        />
      </span>
      <span className="w-12 shrink-0 text-right text-sm font-semibold tabular-nums text-foreground">
        {t("people.compatibility.gunaMilan.gotLabel", { got: kuta.got, max: kuta.max })}
      </span>
    </li>
  );
}

function MangalCard({ bundle, partnerName }: { bundle: CompatibilityBundle; partnerName: string }) {
  const { t } = useTranslation();
  const { self, partner, verdict } = bundle.mangal;

  return (
    <section aria-labelledby="mangal-title" className="motion-fade-up mt-7">
      <h2 id="mangal-title" className={SECTION_LABEL}>
        {t("people.compatibility.mangal.title")}
      </h2>
      <dl className={`${GROUP} [--list-inset:1rem]`}>
        <MangalStat label={t("people.compatibility.mangal.selfLabel")} manglik={self.manglik} />
        <MangalStat label={partnerName} manglik={partner.manglik} />
      </dl>
      <p className="mt-2 px-4 text-[0.8125rem] leading-snug text-foreground">
        {t(`people.compatibility.mangal.verdicts.${verdict}`)}
      </p>
      <p className={FOOTNOTE}>
        {t("people.compatibility.mangal.method")} {t("people.compatibility.mangal.limit")}
      </p>
    </section>
  );
}

function MangalStat({ label, manglik }: { label: string; manglik: boolean }) {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-12 items-center justify-between gap-3 px-4">
      <dt className="min-w-0 truncate text-[0.9375rem] text-foreground">{label}</dt>
      <dd className="shrink-0 text-[0.9375rem] text-muted-foreground">
        {manglik
          ? t("people.compatibility.mangal.manglik")
          : t("people.compatibility.mangal.notManglik")}
      </dd>
    </div>
  );
}

function SynastryCard({
  bundle,
  partnerName,
}: {
  bundle: CompatibilityBundle;
  partnerName: string;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const { partner_planets_in_self_houses } = bundle.synastry;
  if (partner_planets_in_self_houses.length === 0) return null;

  return (
    <section aria-labelledby="synastry-title" className="motion-fade-up mt-7">
      <h2 id="synastry-title" className={SECTION_LABEL}>
        {t("people.compatibility.synastry.title")}
      </h2>
      <div className={GROUP}>
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
          aria-controls="synastry-placements"
          className="tap-press flex min-h-12 w-full items-center gap-3 px-4 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-[0.9375rem] text-foreground">
              {t("people.compatibility.synastry.tableTitle")}
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              {t("people.compatibility.synastry.subtitle", { partner: partnerName })}
            </span>
          </span>
          <ChevronDown
            size={17}
            aria-hidden="true"
            className={cn(
              "shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none",
              expanded && "rotate-180",
            )}
          />
        </button>
        {expanded && (
          <ul
            id="synastry-placements"
            className="list-hairline border-t border-[var(--as-list-separator)] [--list-inset:1rem]"
          >
            {partner_planets_in_self_houses.map((o) => (
              <li key={o.planet} className="flex min-h-11 items-center justify-between gap-3 px-4">
                <span className="text-[0.9375rem] text-foreground">
                  {t(`home.planets.${o.planet.toLowerCase()}`, o.planet)}
                </span>
                <span className="text-[0.8125rem] text-muted-foreground">
                  {t(`signs.${o.sign_name}`, o.sign_name)} · {t("home.houseLabel", { n: o.house })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className={FOOTNOTE}>
        {t("people.compatibility.synastry.method")} {t("people.compatibility.synastry.limit")}
      </p>
    </section>
  );
}

function highlightSentence(key: string, t: ReturnType<typeof useTranslation>["t"]): string {
  const match = key.match(/^partner_(\w+)_in_self_(\d+)$/);
  if (!match) return key;
  const planet = match[1];
  const house = Number(match[2]);
  const houseLabel = t("home.houseLabel", { n: house });
  const planetName = t(`home.planets.${planet}`, planet);

  if (planet === "saturn") {
    return t("people.compatibility.synastry.templates.saturn", {
      planet: planetName,
      house: houseLabel,
    });
  }
  if (planet === "mars") {
    return t("people.compatibility.synastry.templates.mars", { house: houseLabel });
  }
  if (BENEFIC_PLANETS.has(planet)) {
    return t("people.compatibility.synastry.templates.benefic", {
      planet: planetName,
      house: houseLabel,
    });
  }
  return key;
}

function highlightGroup(key: string): "ease" | "conversation" | null {
  const match = key.match(/^partner_(\w+)_in_self_\d+$/);
  if (!match) return null;
  if (BENEFIC_PLANETS.has(match[1])) return "ease";
  if (CONVERSATION_PLANETS.has(match[1])) return "conversation";
  return null;
}
