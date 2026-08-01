import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ChevronDown, Heart } from "lucide-react";

import { useRequireOnboarding } from "@/lib/require-auth";
import { useCompatibility, usePersonCharts } from "@/lib/queries";
import type { CompatibilityBundle, CompatibilityKuta } from "@/lib/related-charts";
import { cn } from "@/lib/utils";

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

  const partnerName =
    personQuery.data && !personQuery.data.error ? personQuery.data.data.person.full_name : "";

  const bundle = query.data && !query.data.error ? query.data.data : null;
  const errorCode = query.isError ? "provider_error" : (query.data?.error?.code ?? null);
  const loading = query.isPending;

  return (
    <section className="mx-auto max-w-2xl space-y-6">
      <div className="motion-fade-up flex items-center gap-2">
        <Link
          to="/people/$id"
          params={{ id }}
          aria-label={t("people.compatibility.back")}
          className="tap-press flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft size={18} aria-hidden="true" />
        </Link>
        <div className="min-w-0">
          <h1 className="truncate font-display text-2xl leading-tight tracking-tight text-foreground sm:text-3xl">
            {t("people.compatibility.title")}
          </h1>
          {partnerName && (
            <p className="truncate text-xs text-muted-foreground">
              {t("people.compatibility.subtitle", { partner: partnerName })}
            </p>
          )}
        </div>
      </div>

      {loading && (
        <div className="space-y-4" aria-hidden="true">
          <div className="h-40 animate-pulse rounded-2xl border border-border bg-card" />
          <div className="h-40 animate-pulse rounded-2xl border border-border bg-card" />
        </div>
      )}

      {!loading && errorCode && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
          <p className="text-sm text-foreground">
            {t(
              errorCode && KNOWN_ERROR_CODES.has(errorCode)
                ? `people.compatibility.errors.${errorCode}`
                : "people.compatibility.loadError",
              { partner: partnerName || t("people.detail.compatibility") },
            )}
          </p>
        </div>
      )}

      {!loading && bundle && (
        <>
          <GunaMilanCard bundle={bundle} />
          <MangalCard bundle={bundle} partnerName={partnerName} />
          <SynastryCard bundle={bundle} partnerName={partnerName} />
        </>
      )}
    </section>
  );
}

function GunaMilanCard({ bundle }: { bundle: CompatibilityBundle }) {
  const { t } = useTranslation();
  const { total, max, verdict, kutas } = bundle.guna_milan;

  return (
    <div
      className="rounded-2xl border border-border bg-card p-5"
      style={{ boxShadow: "var(--shadow-soft)" }}
    >
      <h2 className="text-base font-semibold text-foreground">
        {t("people.compatibility.gunaMilan.title")}
      </h2>

      <div className="mt-4 flex flex-col items-center gap-2 text-center">
        <div className="flex items-baseline gap-1">
          <span className="font-display text-5xl leading-none text-foreground">{total}</span>
          <span className="text-lg text-muted-foreground">/{max}</span>
        </div>
        <span
          className={cn(
            "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium",
            verdict === "needs_care"
              ? "border-destructive/40 bg-destructive/10 text-destructive-strong"
              : "border-accent/40 bg-accent/15 text-accent",
          )}
        >
          {t(`people.compatibility.gunaMilan.verdicts.${verdict}`)}
        </span>
      </div>

      <div className="mt-5 border-t border-border/60 pt-4">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {t("people.compatibility.gunaMilan.kutasTitle")}
        </p>
        <ul className="mt-3 flex flex-col gap-3">
          {kutas.map((k) => (
            <KutaRow key={k.name} kuta={k} />
          ))}
        </ul>
      </div>
    </div>
  );
}

function KutaRow({ kuta }: { kuta: CompatibilityKuta }) {
  const { t } = useTranslation();
  const key = KUTA_KEY[kuta.name] ?? kuta.name;
  return (
    <li className="rounded-xl border border-border bg-background p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-foreground">
          {t(`people.compatibility.kutas.${key}.name`, kuta.name)}
        </span>
        <span className="shrink-0 text-xs text-muted-foreground">
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
    <div
      className="rounded-2xl border border-border bg-card p-5"
      style={{ boxShadow: "var(--shadow-soft)" }}
    >
      <h2 className="text-base font-semibold text-foreground">
        {t("people.compatibility.mangal.title")}
      </h2>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <MangalStat label={t("people.compatibility.mangal.selfLabel")} manglik={self.manglik} />
        <MangalStat label={partnerName} manglik={partner.manglik} />
      </div>

      <p className="mt-4 text-sm leading-relaxed text-foreground">
        {t(`people.compatibility.mangal.verdicts.${verdict}`)}
      </p>
    </div>
  );
}

function MangalStat({ label, manglik }: { label: string; manglik: boolean }) {
  const { t } = useTranslation();
  return (
    <div className="rounded-xl border border-border bg-background p-3 text-center">
      <div className="truncate text-xs text-muted-foreground">{label}</div>
      <div
        className={cn(
          "mt-1 font-display text-lg",
          manglik ? "text-destructive-strong" : "text-foreground",
        )}
      >
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
    <div
      className="rounded-2xl border border-border bg-card p-5"
      style={{ boxShadow: "var(--shadow-soft)" }}
    >
      <h2 className="text-base font-semibold text-foreground">
        {t("people.compatibility.synastry.title")}
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        {t("people.compatibility.synastry.subtitle", { partner: partnerName })}
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
        <div className="mt-4 border-t border-border/60 pt-3">
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
    </div>
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
