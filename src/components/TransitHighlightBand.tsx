import { MessageCircle, RefreshCw, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "@tanstack/react-router";

import { AstroArt } from "@/components/AstroArt";
import { grahaArtByName } from "@/lib/astro-art";
import { SIGN_KEYS_BY_INDEX } from "@/lib/charts";
import { usePlanets, useTodayTransits, useCurrentUserId } from "@/lib/queries";
import { findAscendantSignIndex, houseFor, PLANET_KEY_BY_CODE } from "@/lib/todayTransits";
import type { PlanetKey, SignKey } from "@/lib/chart-types";

// A slow-planet ingress only counts as "soon" within this window — beyond it,
// it's not personally relevant enough to interrupt the page with.
const INGRESS_HIGHLIGHT_MS = 3 * 24 * 60 * 60 * 1000;
const ANGULAR_HOUSES = [1, 4, 7, 10];

type Highlight =
  | { kind: "ingress"; planetKey: PlanetKey; signKey: SignKey; days: number; house: number | null }
  | { kind: "moon-house"; house: number };

function todayDateKey(): string {
  // en-CA formats as YYYY-MM-DD regardless of the viewer's language.
  return new Intl.DateTimeFormat("en-CA").format(new Date());
}

function computeHighlight(
  moon: { signIndex: number } | null,
  planets: Array<{ planet: number; nextIngressTs: string | null; nextSignIndex: number | null }>,
  ascSignIndex: number | null,
): Highlight | null {
  const now = Date.now();
  let closest: {
    planetKey: PlanetKey;
    signKey: SignKey;
    nextSignIndex: number;
    deltaMs: number;
  } | null = null;
  for (const p of planets) {
    if (p.nextIngressTs == null || p.nextSignIndex == null) continue;
    const deltaMs = new Date(p.nextIngressTs).getTime() - now;
    if (deltaMs < 0 || deltaMs > INGRESS_HIGHLIGHT_MS) continue;
    const planetKey = PLANET_KEY_BY_CODE[p.planet];
    if (!planetKey) continue;
    if (!closest || deltaMs < closest.deltaMs) {
      closest = {
        planetKey,
        signKey: SIGN_KEYS_BY_INDEX[p.nextSignIndex],
        nextSignIndex: p.nextSignIndex,
        deltaMs,
      };
    }
  }
  if (closest) {
    const days = Math.max(1, Math.ceil(closest.deltaMs / (24 * 60 * 60 * 1000)));
    const house = ascSignIndex != null ? houseFor(closest.nextSignIndex, ascSignIndex) : null;
    return { kind: "ingress", planetKey: closest.planetKey, signKey: closest.signKey, days, house };
  }

  if (moon && ascSignIndex != null) {
    const house = houseFor(moon.signIndex, ascSignIndex);
    if (ANGULAR_HOUSES.includes(house)) {
      return { kind: "moon-house", house };
    }
  }

  return null;
}

function highlightSignature(h: Highlight): string {
  return h.kind === "ingress"
    ? `ingress:${h.planetKey}:${h.signKey}`
    : `moon-house:${h.house}:${todayDateKey()}`;
}

/** `label` is the section heading; it only renders alongside the band. */
export function TransitHighlightBand({ label }: { label?: ReactNode } = {}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const userId = useCurrentUserId();
  const transitsQuery = useTodayTransits();
  const planetsQuery = usePlanets();

  const ascSignIndex = useMemo(
    () => findAscendantSignIndex(planetsQuery.data?.planets ?? []),
    [planetsQuery.data],
  );

  const highlight = useMemo(
    () =>
      computeHighlight(
        transitsQuery.data?.moon ?? null,
        transitsQuery.data?.planets ?? [],
        ascSignIndex,
      ),
    [transitsQuery.data, ascSignIndex],
  );

  const signature = highlight ? highlightSignature(highlight) : null;
  const storageKey = userId ? `astrosaathi-transit-band:${userId}` : null;

  const [dismissedSignature, setDismissedSignature] = useState<string | null>(null);
  useEffect(() => {
    if (!storageKey || typeof window === "undefined") return;
    try {
      setDismissedSignature(window.localStorage.getItem(storageKey));
    } catch {
      /* ignore */
    }
  }, [storageKey]);

  const loading = transitsQuery.isPending || planetsQuery.isPending;
  const hasError = transitsQuery.isError || planetsQuery.isError;

  if (loading) {
    return null;
  }

  if (hasError) {
    return (
      <>
        {label}
        <div className="flex min-h-11 items-center justify-between gap-3 rounded-[0.875rem] bg-card py-2 pl-4 pr-2 shadow-[var(--as-elevation-1)]">
          <span className="text-sm text-muted-foreground">{t("sections.today.bandLoadError")}</span>
          <button
            type="button"
            onClick={() => {
              void transitsQuery.refetch();
              void planetsQuery.refetch();
            }}
            className="tap-press inline-flex min-h-11 w-fit shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <RefreshCw size={14} aria-hidden="true" />
            {t("states.retry")}
          </button>
        </div>
      </>
    );
  }

  if (!highlight || !signature || dismissedSignature === signature) return null;

  const handleDismiss = () => {
    setDismissedSignature(signature);
    if (storageKey) {
      try {
        window.localStorage.setItem(storageKey, signature);
      } catch {
        /* ignore */
      }
    }
  };

  const handleTap = () => {
    const seed =
      highlight.kind === "ingress"
        ? t("sections.today.bandIngressSeed", {
            planet: t(`home.planets.${highlight.planetKey}`),
            sign: t(`signs.${highlight.signKey}`),
            days: highlight.days,
          })
        : t("sections.today.bandMoonHouseSeed", { house: highlight.house });
    void navigate({ to: "/chat", search: { seed } });
  };

  const text =
    highlight.kind === "ingress"
      ? highlight.house != null
        ? t("sections.today.bandIngressHouse", {
            planet: t(`home.planets.${highlight.planetKey}`),
            sign: t(`signs.${highlight.signKey}`),
            days: highlight.days,
            house: highlight.house,
          })
        : t("sections.today.bandIngress", {
            planet: t(`home.planets.${highlight.planetKey}`),
            sign: t(`signs.${highlight.signKey}`),
            days: highlight.days,
          })
      : t("sections.today.bandMoonHouse", { house: highlight.house });

  const evidence =
    highlight.kind === "ingress"
      ? `${t(`home.planets.${highlight.planetKey}`)} → ${t(`signs.${highlight.signKey}`)}`
      : t("sections.today.bandMoonEvidence", { house: highlight.house });

  const artPlanet = grahaArtByName(highlight.kind === "ingress" ? highlight.planetKey : "moon");

  return (
    <>
      {label}
      <article
        aria-labelledby="transit-highlight-heading"
        className="motion-fade-up rounded-[0.875rem] bg-card py-3 pl-4 pr-1.5 shadow-[var(--as-elevation-1)]"
      >
        <div className="flex items-center gap-3">
          {artPlanet ? (
            <AstroArt kind="graha" name={artPlanet} size={40} />
          ) : (
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent/12 text-accent">
              <Sparkles size={18} aria-hidden="true" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h3
              id="transit-highlight-heading"
              className="text-[0.9375rem] font-semibold leading-snug text-foreground"
            >
              {text}
            </h3>
            <div
              className="mt-1.5 flex flex-wrap gap-1.5"
              aria-label={t("sections.today.evidenceLabel")}
            >
              <span className="rounded-full bg-foreground/[0.08] px-2.5 py-0.5 text-xs text-muted-foreground">
                {evidence}
              </span>
              {highlight.kind === "ingress" && highlight.house != null ? (
                <span className="rounded-full bg-foreground/[0.08] px-2.5 py-0.5 text-xs text-muted-foreground">
                  {t("home.houseLabel", { n: highlight.house })}
                </span>
              ) : null}
            </div>
            <button
              type="button"
              onClick={handleTap}
              className="tap-press -ml-2 mt-0.5 inline-flex min-h-11 items-center gap-1.5 rounded-full px-2 text-[0.8125rem] font-semibold text-[var(--as-color-action-ask)] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <MessageCircle size={15} aria-hidden="true" />
              {t("sections.today.askHighlight")}
            </button>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            aria-label={t("sections.today.bandDismiss")}
            className="grid h-11 w-11 shrink-0 self-start place-items-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      </article>
    </>
  );
}
