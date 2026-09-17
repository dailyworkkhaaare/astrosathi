import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ChevronDown, Heart, MessageCircle, Sparkles } from "lucide-react";

import { useRequireOnboarding } from "@/lib/require-auth";
import { useCompatibility, usePersonCharts } from "@/lib/queries";
import type { CompatibilityBundle, CompatibilityKuta } from "@/lib/related-charts";
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
  const { id } = useParams({ from: "/people/$id/compatibility" });
  const personQuery = usePersonCharts(id);
  const query = useCompatibility(id);

  const personBundle =
    personQuery.data && !personQuery.data.error ? personQuery.data.data.person.full_name : "";
  const bundle = query.data && !query.data.error ? query.data.data : null;
  const partnerName = bundle?.partner.name ?? personBundle;
  const errorCode = query.isError ? "provider_error" : (query.data?.error?.code ?? null);
  const loading = query.isPending;

  return (
    <section className="mx-auto max-w-2xl space-y-6">
      <header className="motion-fade-up flex items-start gap-2">
        <Link
          to="/people/$id"
          params={{ id }}
          aria-label={t("people.compatibility.back")}
          className="tap-press flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft size={18} aria-hidden="true" />
        </Link>
        <div className="min-w-0">
          <p className="as-micro text-primary">{t("people.compatibility.eyebrow")}</p>
          <h1 className="truncate font-display text-2xl leading-tight tracking-tight text-foreground sm:text-3xl">
            {t("people.compatibility.title")}
          </h1>
          {partnerName ? (
            <p className="mt-1.5 truncate text-sm text-muted-foreground">
              {t("people.compatibility.subtitle", { partner: partnerName })}
            </p>
          ) : null}
        </div>
      </header>

      {loading && (
        <div className="space-y-4" aria-hidden="true">
          <div className="h-40 animate-pulse rounded-2xl border border-border bg-card" />
          <div className="h-40 animate-pulse rounded-2xl border border-border bg-card" />
        </div>
      )}

      {!loading && errorCode && (
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
      )}

      {!loading && bundle && (
        <>
          <CompatibilityOverview bundle={bundle} partnerName={partnerName} />
          <GunaMilanCard bundle={bundle} />
          <MangalCard bundle={bundle} partnerName={partnerName} />
          <SynastryCard bundle={bundle} partnerName={partnerName} />
        </>
      )}
    </section>
  );
}

function CompatibilityOverview({
  bundle,
  partnerName,
}: {
  bundle: CompatibilityBundle;
  partnerName: string;
}) {
  const { t } = useTranslation();
  const displayPartner = partnerName || t("people.compatibility.partnerFallback");
  const { highlights } = bundle.synastry;
  const easeHighlights = highlights.filter((highlight) => highlightGroup(highlight) === "ease");
  const conversationHighlights = highlights.filter(
    (highlight) => highlightGroup(highlight) === "conversation",
  );
  const { total, max } = bundle.guna_milan;

  return (
    <>
      <section className="motion-fade-up relative isolate overflow-hidden rounded-[1.75rem] border border-primary/20 bg-card p-5 shadow-[var(--shadow-card)] sm:p-6">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-80"
          style={{
            background:
              "radial-gradient(58% 72% at 0% 0%, color-mix(in oklab, var(--primary) 12%, transparent), transparent 72%), radial-gradient(48% 70% at 100% 100%, color-mix(in oklab, var(--accent) 13%, transparent), transparent 76%)",
          }}
        />
        <div className="relative">
          <p className="as-micro text-primary">{t("people.compatibility.pairEyebrow")}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-lg font-semibold text-foreground sm:text-xl">
            <span>{t("people.compatibility.selfLabel")}</span>
            <Heart size={17} className="text-accent" aria-hidden="true" />
            <span>{displayPartner}</span>
          </div>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
            {t("people.compatibility.pairNote")}
          </p>
        </div>
      </section>

      <section aria-labelledby="compatibility-patterns-title" className="space-y-3">
        <div className="px-1">
          <p className="as-micro text-muted-foreground">
            {t("people.compatibility.overview.eyebrow")}
          </p>
          <h2
            id="compatibility-patterns-title"
            className="mt-1 text-lg font-semibold text-foreground"
          >
            {t("people.compatibility.overview.title")}
          </h2>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted-foreground">
            {t("people.compatibility.overview.summary")}
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <PatternGroup type="ease" highlights={easeHighlights} />
          <PatternGroup type="conversation" highlights={conversationHighlights} />
        </div>
      </section>

      <section
        aria-labelledby="compatibility-traditional-score-title"
        className="rounded-[1.5rem] border border-border bg-card p-5 shadow-[var(--shadow-card)]"
      >
        <p className="as-micro text-muted-foreground">
          {t("people.compatibility.overview.traditionalEyebrow")}
        </p>
        <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h2
            id="compatibility-traditional-score-title"
            className="text-lg font-semibold text-foreground"
          >
            {t("people.compatibility.overview.traditionalTitle")}
          </h2>
          <span className="text-sm font-semibold tabular-nums text-foreground">
            {t("people.compatibility.gunaMilan.gotLabel", { got: total, max })}
          </span>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {t("people.compatibility.overview.traditionalMethod")}
        </p>
        <p className="mt-3 border-t border-border/60 pt-3 text-xs leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground">
            {t("people.compatibility.overview.traditionalLimitLabel")}
          </span>
          {t("people.compatibility.overview.traditionalLimit")}
        </p>
      </section>
    </>
  );
}

function PatternGroup({
  type,
  highlights,
}: {
  type: "ease" | "conversation";
  highlights: string[];
}) {
  const { t } = useTranslation();
  const isEase = type === "ease";
  const Icon = isEase ? Sparkles : MessageCircle;
  const title = t(`people.compatibility.overview.${type}Title`);

  return (
    <section className="rounded-[1.5rem] border border-border bg-card p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-start gap-2.5">
        <span
          className={cn(
            "grid h-9 w-9 shrink-0 place-items-center rounded-xl ring-1",
            isEase
              ? "bg-primary/10 text-primary ring-primary/20"
              : "bg-accent/[0.08] text-accent ring-accent/20",
          )}
        >
          <Icon size={16} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            {t(`people.compatibility.overview.${type}Hint`)}
          </p>
        </div>
      </div>
      {highlights.length === 0 ? (
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          {t(`people.compatibility.overview.no${isEase ? "Ease" : "Conversation"}`)}
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {highlights.map((highlight) => (
            <li
              key={highlight}
              className="flex items-start gap-2 text-sm leading-relaxed text-foreground"
            >
              <span
                aria-hidden="true"
                className={cn(
                  "mt-2 size-1.5 shrink-0 rounded-full",
                  isEase ? "bg-primary/70" : "bg-accent/70",
                )}
              />
              <span>{highlightSentence(highlight, t)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function GunaMilanCard({ bundle }: { bundle: CompatibilityBundle }) {
  const { t } = useTranslation();
  const { total, max, verdict, kutas } = bundle.guna_milan;

  return (
    <section
      aria-labelledby="guna-milan-title"
      className="rounded-[1.5rem] border border-border bg-card p-5 shadow-[var(--shadow-card)]"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="as-micro text-muted-foreground">
            {t("people.compatibility.gunaMilan.eyebrow")}
          </p>
          <h2 id="guna-milan-title" className="mt-1 text-lg font-semibold text-foreground">
            {t("people.compatibility.gunaMilan.title")}
          </h2>
          <p className="mt-1 max-w-lg text-sm leading-relaxed text-muted-foreground">
            {t("people.compatibility.gunaMilan.method")}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-muted/45 px-4 py-3 text-right">
          <p className="as-micro text-muted-foreground">
            {t("people.compatibility.gunaMilan.scoreLabel")}
          </p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">
            {t("people.compatibility.gunaMilan.gotLabel", { got: total, max })}
          </p>
        </div>
      </div>

      <p className="mt-4 rounded-2xl border border-border bg-muted/40 px-3.5 py-3 text-sm leading-relaxed text-foreground">
        {t(`people.compatibility.gunaMilan.verdicts.${verdict}`)}
      </p>

      <div className="mt-5 border-t border-border/60 pt-4">
        <p className="text-sm font-medium text-foreground">
          {t("people.compatibility.gunaMilan.kutasTitle")}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {t("people.compatibility.gunaMilan.kutasHint")}
        </p>
        <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {kutas.map((k) => (
            <KutaRow key={k.name} kuta={k} />
          ))}
        </ul>
      </div>
      <p className="mt-4 border-t border-border/60 pt-3 text-xs leading-relaxed text-muted-foreground">
        {t("people.compatibility.gunaMilan.limit")}
      </p>
    </section>
  );
}

function KutaRow({ kuta }: { kuta: CompatibilityKuta }) {
  const { t } = useTranslation();
  const key = KUTA_KEY[kuta.name] ?? kuta.name;
  return (
    <li className="rounded-2xl border border-border bg-background p-3.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-foreground">
          {t(`people.compatibility.kutas.${key}.name`, kuta.name)}
        </span>
        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums text-foreground">
          {t("people.compatibility.gunaMilan.gotLabel", { got: kuta.got, max: kuta.max })}
        </span>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        {t(`people.compatibility.kutas.${key}.meaning`, "")}
      </p>
    </li>
  );
}

function MangalCard({ bundle, partnerName }: { bundle: CompatibilityBundle; partnerName: string }) {
  const { t } = useTranslation();
  const { self, partner, verdict } = bundle.mangal;

  return (
    <section
      aria-labelledby="mangal-title"
      className="rounded-[1.5rem] border border-border bg-card p-5 shadow-[var(--shadow-card)]"
    >
      <p className="as-micro text-muted-foreground">{t("people.compatibility.mangal.eyebrow")}</p>
      <h2 id="mangal-title" className="mt-1 text-lg font-semibold text-foreground">
        {t("people.compatibility.mangal.title")}
      </h2>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
        {t("people.compatibility.mangal.method")}
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <MangalStat label={t("people.compatibility.mangal.selfLabel")} manglik={self.manglik} />
        <MangalStat label={partnerName} manglik={partner.manglik} />
      </div>

      <p className="mt-4 rounded-2xl border border-border bg-muted/40 px-3.5 py-3 text-sm leading-relaxed text-foreground">
        {t(`people.compatibility.mangal.verdicts.${verdict}`)}
      </p>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        {t("people.compatibility.mangal.limit")}
      </p>
    </section>
  );
}

function MangalStat({ label, manglik }: { label: string; manglik: boolean }) {
  const { t } = useTranslation();
  return (
    <div className="rounded-2xl border border-border bg-background p-3.5 text-center">
      <div className="truncate text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-lg text-foreground">
        {manglik
          ? t("people.compatibility.mangal.manglik")
          : t("people.compatibility.mangal.notManglik")}
      </div>
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
  const { highlights, partner_planets_in_self_houses } = bundle.synastry;

  return (
    <section
      aria-labelledby="synastry-title"
      className="rounded-[1.5rem] border border-border bg-card p-5 shadow-[var(--shadow-card)]"
    >
      <p className="as-micro text-muted-foreground">{t("people.compatibility.synastry.eyebrow")}</p>
      <h2 id="synastry-title" className="mt-1 text-lg font-semibold text-foreground">
        {t("people.compatibility.synastry.title")}
      </h2>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
        {t("people.compatibility.synastry.subtitle", { partner: partnerName })}
      </p>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        {t("people.compatibility.synastry.method")}
      </p>

      {highlights.length === 0 ? (
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          {t("people.compatibility.synastry.empty")}
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2">
          {highlights.map((h) => (
            <li key={h} className="flex items-start gap-2 text-sm leading-relaxed text-foreground">
              <Heart size={14} aria-hidden="true" className="mt-1 shrink-0 text-accent" />
              <span>{highlightSentence(h, t)}</span>
            </li>
          ))}
        </ul>
      )}

      {partner_planets_in_self_houses.length > 0 && (
        <div className="mt-5 border-t border-border/60 pt-3">
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            aria-expanded={expanded}
            className="tap-press -mx-1 inline-flex min-h-11 items-center gap-1 rounded-md px-1 text-xs font-medium text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronDown
              size={13}
              aria-hidden="true"
              className={cn("shrink-0 transition-transform", expanded && "rotate-180")}
            />
            {t("people.compatibility.synastry.tableTitle")}
          </button>
          {expanded && (
            <ul className="motion-fade-up mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {partner_planets_in_self_houses.map((o) => (
                <li
                  key={o.planet}
                  className="rounded-lg border border-border/60 bg-background px-3 py-2 text-xs text-foreground"
                >
                  <span className="font-medium">
                    {t(`home.planets.${o.planet.toLowerCase()}`, o.planet)}
                  </span>
                  <span className="text-muted-foreground">
                    {" · "}
                    {t(`signs.${o.sign_name}`, o.sign_name)}
                    {" · "}
                    {t("home.houseLabel", { n: o.house })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <p className="mt-4 border-t border-border/60 pt-3 text-xs leading-relaxed text-muted-foreground">
        {t("people.compatibility.synastry.limit")}
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
