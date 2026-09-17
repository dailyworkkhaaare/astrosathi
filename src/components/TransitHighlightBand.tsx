import { MessageCircle, RefreshCw, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "@tanstack/react-router";

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

export function TransitHighlightBand() {
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
      <div className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-accent/20 bg-accent/[0.05] px-3 py-2.5">
        <span className="text-sm text-muted-foreground">{t("sections.today.bandLoadError")}</span>
        <button
          type="button"
          onClick={() => {
            void transitsQuery.refetch();
            void planetsQuery.refetch();
          }}
          className="tap-press inline-flex min-h-11 w-fit shrink-0 items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <RefreshCw size={14} aria-hidden="true" />
          {t("states.retry")}
        </button>
      </div>
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

  return (
    <article
      aria-labelledby="transit-highlight-heading"
      className="motion-fade-up relative isolate overflow-hidden rounded-2xl border border-accent/20 bg-card p-4 shadow-[var(--shadow-soft)] sm:p-5"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-20 -z-10 h-48 w-48 rounded-full bg-[radial-gradient(circle,rgba(242,153,29,0.16),rgba(242,153,29,0)_70%)]"
      />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
            <Sparkles size={14} aria-hidden="true" />
            {t("sections.today.currentTiming")}
          </p>
          <h3
            id="transit-highlight-heading"
            className="mt-2 text-base font-semibold leading-snug text-foreground"
          >
            {text}
          </h3>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label={t("sections.today.bandDismiss")}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent/10 hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2" aria-label={t("sections.today.evidenceLabel")}>
        <span className="inline-flex items-center rounded-full border border-border/70 bg-background/70 px-3 py-1.5 text-xs font-medium text-foreground">
          {evidence}
        </span>
        {highlight.kind === "ingress" && highlight.house != null ? (
          <span className="inline-flex items-center rounded-full border border-border/70 bg-background/70 px-3 py-1.5 text-xs font-medium text-foreground">
            {t("home.houseLabel", { n: highlight.house })}
          </span>
        ) : null}
      </div>

      <button
        type="button"
        onClick={handleTap}
        className="tap-press mt-4 inline-flex min-h-11 items-center gap-2 rounded-full border border-accent/30 bg-accent/[0.08] px-4 text-sm font-semibold text-foreground hover:bg-accent/[0.14] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <MessageCircle size={16} className="text-accent" aria-hidden="true" />
        {t("sections.today.askHighlight")}
      </button>
    </article>
  );
}
