import { RefreshCw, Sparkles, X } from "lucide-react";
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
  let closest: { planetKey: PlanetKey; signKey: SignKey; nextSignIndex: number; deltaMs: number } | null =
    null;
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
    return (
      <div
        aria-hidden="true"
        className="h-[52px] animate-pulse rounded-xl border border-accent/20 bg-accent/[0.05]"
      />
    );
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

  return (
    <div className="motion-fade-up flex items-center gap-1 rounded-xl border border-accent/20 bg-accent/[0.05] pl-1 pr-1">
      <button
        type="button"
        onClick={handleTap}
        className="flex min-h-11 flex-1 items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Sparkles size={14} className="shrink-0 text-accent" aria-hidden="true" />
        <span>{text}</span>
      </button>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label={t("sections.today.bandDismiss")}
        className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent/10 hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
