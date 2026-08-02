// TanStack Query hooks that cache chart-gateway responses on the client.
// The cache persists to localStorage (see `AppQueryProvider` in `__root.tsx`),
// so refreshes and navigation reuse the last successful response without a
// new Edge Function call until the entry goes stale.

import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import {
  getDasha,
  getPlanets,
  getVargaChart,
  type ChartGatewayError,
  type DashaBalance,
  type DashaMaha,
  type NormalizedPlanet,
} from "@/lib/charts";
import type { ChartStyle, VargaKey } from "@/lib/chart-types";
import { getBirthProfile } from "@/lib/birth-profile";
import {
  listRelatedCharts,
  type RelatedChart,
  type PersonChartsBundle,
  type CompatibilityBundle,
} from "@/lib/related-charts";
import {
  createLifeEvent,
  deleteLifeEvent,
  listLifeEvents,
  stampLifeEvent,
  updateLifeEvent,
  type LifeEvent,
  type LifeEventInput,
} from "@/lib/life-events";
import {
  actOnNudge,
  dismissNudge,
  getProactiveSettings,
  listSentNudges,
  saveProactiveSettings,
  type ProactiveNudge,
  type ProactiveSettings,
} from "@/lib/proactive";

// ---------------------------------------------------------------- constants

// Stale-while-revalidate window. Cached responses (persisted to localStorage
// and retained for CHART_GC_MS) paint instantly, but anything older than this
// triggers a silent background refetch on mount/focus. Keeping it short means
// out-of-band changes — a regenerated or deleted chart_artifacts row, or birth
// data edited directly via SQL — surface within a minute instead of being
// masked for a full day. The birth-details form also clears the cache on save.
export const CHART_STALE_MS = 24 * 60 * 60 * 1000; // 24h
export const CHART_GC_MS = 7 * 24 * 60 * 60 * 1000; // 7d
export const PERSIST_STORAGE_KEY = "astrosaathi-qc-v1";

const QUERY_RETRY_CONFIG = {
  retry: 3,
  retryDelay: (attemptIndex: number) => Math.min(1000 * Math.pow(2, attemptIndex), 8000),
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
};

// Root key prefix for every chart-gateway backed query — lets us wipe the
// whole namespace in one call.
const ROOT = ["chart-gateway"] as const;

// ---------------------------------------------------------------- user id

export function useCurrentUserId(): string | null {
  const [uid, setUid] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const keys = Object.keys(localStorage);
      const authKey = keys.find((k) => k.startsWith("sb-") && k.endsWith("-auth-token"));
      if (authKey) {
        const raw = localStorage.getItem(authKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          return parsed?.user?.id ?? null;
        }
      }
    } catch {
      /* ignore */
    }
    return null;
  });

  useEffect(() => {
    let mounted = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (mounted && data.user?.id) setUid(data.user.id);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUid(session?.user?.id ?? null);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);
  return uid;
}

// ---------------------------------------------------------------- hooks

export type ChartQueryValue = { svg: string | null; errorCode: string | null };

export function useChart(varga: VargaKey, style: ChartStyle): UseQueryResult<ChartQueryValue> {
  const userId = useCurrentUserId();
  return useQuery<ChartQueryValue>({
    queryKey: [...ROOT, "chart", userId, varga, style],
    enabled: userId !== null,
    staleTime: CHART_STALE_MS,
    gcTime: CHART_GC_MS,
    ...QUERY_RETRY_CONFIG,
    queryFn: async () => {
      const res = await getVargaChart(varga, style);
      if (res.error) {
        // Encode provider errors as a resolved value so the cached shape
        // matches what the previous UI stored per (varga|style).
        return { svg: null, errorCode: res.error.code };
      }
      return { svg: res.svg, errorCode: null };
    },
  });
}

export type PlanetsQueryValue = {
  planets: NormalizedPlanet[];
  errorCode: string | null;
};

export function usePlanets(): UseQueryResult<PlanetsQueryValue> {
  const userId = useCurrentUserId();
  return useQuery<PlanetsQueryValue>({
    queryKey: [...ROOT, "planets", userId],
    enabled: userId !== null,
    staleTime: CHART_STALE_MS,
    gcTime: CHART_GC_MS,
    ...QUERY_RETRY_CONFIG,
    queryFn: async () => {
      const res = await getPlanets();
      if (res.error) return { planets: [], errorCode: res.error.code };
      return {
        planets: Array.isArray(res.planets) ? res.planets : [],
        errorCode: null,
      };
    },
  });
}

export type DashaQueryValue = {
  periods: DashaMaha[];
  balance: DashaBalance | null;
  error: ChartGatewayError | null;
};

export function useDasha(): UseQueryResult<DashaQueryValue> {
  const userId = useCurrentUserId();
  return useQuery<DashaQueryValue>({
    queryKey: [...ROOT, "report", "vimshottari_dasha", userId],
    enabled: userId !== null,
    staleTime: CHART_STALE_MS,
    gcTime: CHART_GC_MS,
    ...QUERY_RETRY_CONFIG,
    queryFn: async () => {
      const res = await getDasha();
      if (res.error) {
        return { periods: [], balance: null, error: res.error };
      }
      return { periods: res.periods, balance: res.balance, error: null };
    },
  });
}

export type NumerologyQueryValue = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any | null;
  errorCode: string | null;
};

export function useNumerology(): UseQueryResult<NumerologyQueryValue> {
  const userId = useCurrentUserId();
  const year = new Date().getUTCFullYear();
  return useQuery<NumerologyQueryValue>({
    queryKey: [...ROOT, "numerology", userId, year],
    enabled: userId !== null,
    staleTime: CHART_STALE_MS,
    gcTime: CHART_GC_MS,
    ...QUERY_RETRY_CONFIG,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("chart-gateway", {
        body: { resource: "numerology" },
      });
      if (error) {
        let code = "provider_error";
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ctx = (error as any).context;
        if (ctx && typeof ctx.json === "function") {
          try {
            const body = await ctx.json();
            if (body?.error?.code) code = String(body.error.code);
          } catch {
            /* ignore */
          }
        }
        return { data: null, errorCode: code };
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const payload = (data as any)?.data ?? null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const innerErr = (data as any)?.error;
      if (innerErr) {
        return {
          data: null,
          errorCode: String(innerErr.code ?? "provider_error"),
        };
      }
      return { data: payload, errorCode: null };
    },
  });
}

// ---------------------------------------------------------------- doshas

export type DoshaReportType = "mangal_dosha" | "kaal_sarp_dosha";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DoshaQueryValue = { data: any | null; errorCode: string | null };

export function useDoshaReport(reportType: DoshaReportType): UseQueryResult<DoshaQueryValue> {
  const userId = useCurrentUserId();
  return useQuery<DoshaQueryValue>({
    queryKey: ["report", reportType, userId],
    enabled: userId !== null,
    staleTime: CHART_STALE_MS,
    gcTime: CHART_GC_MS,
    ...QUERY_RETRY_CONFIG,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("chart-gateway", {
        body: { resource: "report", report_type: reportType },
      });
      if (error) {
        let code = "provider_error";
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ctx = (error as any).context;
        if (ctx && typeof ctx.json === "function") {
          try {
            const body = await ctx.json();
            if (body?.error?.code) code = String(body.error.code);
          } catch {
            /* ignore */
          }
        }
        return { data: null, errorCode: code };
      }
      // chart-gateway response for reports is:
      //   { resource, report_type, ..., data: { status, data: { ...REPORT FIELDS... } } }
      // The actual dosha fields (has_dosha, description, is_in_sade_sati, etc.)
      // live TWO levels deep — unwrap both here so callers read them directly.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const outer = (data as any)?.data ?? null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const innerErr = (data as any)?.error ?? outer?.error;
      if (innerErr) {
        return {
          data: null,
          errorCode: String(innerErr.code ?? "provider_error"),
        };
      }
      const payload =
        outer && typeof outer === "object" && "data" in outer
          ? (outer as { data: unknown }).data
          : outer;
      return { data: payload, errorCode: null };
    },
  });
}

// ---------------------------------------------------------------- ashtakavarga

export type AshtakavargaHouse = {
  house: { id: number; name: string; number: number };
  rasi: { id: number; name: string; lord: { id: number; name: string; vedic_name?: string } };
  planets: Array<{ planet: { id: number; name: string; vedic_name?: string }; score: number }>;
  score: number;
};

export type AshtakavargaQueryValue = {
  houses: AshtakavargaHouse[];
  errorCode: string | null;
};

export function useAshtakavarga(): UseQueryResult<AshtakavargaQueryValue> {
  const userId = useCurrentUserId();
  return useQuery<AshtakavargaQueryValue>({
    queryKey: ["report", "sarvashtakavarga", userId],
    enabled: userId !== null,
    staleTime: CHART_STALE_MS,
    gcTime: CHART_GC_MS,
    ...QUERY_RETRY_CONFIG,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("chart-gateway", {
        body: { resource: "report", report_type: "sarvashtakavarga" },
      });
      if (error) {
        let code = "provider_error";
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ctx = (error as any).context;
        if (ctx && typeof ctx.json === "function") {
          try {
            const body = await ctx.json();
            if (body?.error?.code) code = String(body.error.code);
          } catch {
            /* ignore */
          }
        }
        return { houses: [], errorCode: code };
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const outer = (data as any)?.data ?? null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const innerErr = (data as any)?.error ?? outer?.error;
      if (innerErr) {
        return { houses: [], errorCode: String(innerErr.code ?? "provider_error") };
      }

      const payload =
        outer && typeof outer === "object" && "data" in outer
          ? (outer as { data: unknown }).data
          : outer;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const houses = (payload as any)?.sarvashtakavarga?.prastara?.houses;
      return {
        houses: Array.isArray(houses) ? (houses as AshtakavargaHouse[]) : [],
        errorCode: null,
      };
    },
  });
}

// ---------------------------------------------------------------- bhinnashtakavarga (per planet)

export type BhinnashtakavargaQueryValue = {
  houses: AshtakavargaHouse[];
  errorCode: string | null;
};

export function useBhinnashtakavarga(
  planetId: number,
): UseQueryResult<BhinnashtakavargaQueryValue> {
  const userId = useCurrentUserId();
  return useQuery<BhinnashtakavargaQueryValue>({
    queryKey: ["report", "ashtakavarga", planetId, userId],
    enabled: userId !== null,
    staleTime: CHART_STALE_MS,
    gcTime: CHART_GC_MS,
    ...QUERY_RETRY_CONFIG,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("chart-gateway", {
        body: {
          resource: "report",
          report_type: "ashtakavarga",
          provider_params: { planet: String(planetId) },
        },
      });
      if (error) {
        let code = "provider_error";
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ctx = (error as any).context;
        if (ctx && typeof ctx.json === "function") {
          try {
            const body = await ctx.json();
            if (body?.error?.code) code = String(body.error.code);
          } catch {
            /* ignore */
          }
        }
        return { houses: [], errorCode: code };
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const outer = (data as any)?.data ?? null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const innerErr = (data as any)?.error ?? outer?.error;
      if (innerErr) {
        return { houses: [], errorCode: String(innerErr.code ?? "provider_error") };
      }
      const payload =
        outer && typeof outer === "object" && "data" in outer
          ? (outer as { data: unknown }).data
          : outer;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const houses = (payload as any)?.ashtakavarga?.prastara?.houses;
      return {
        houses: Array.isArray(houses) ? (houses as AshtakavargaHouse[]) : [],
        errorCode: null,
      };
    },
  });
}

// ---------------------------------------------------------------- invalidation

/** Invalidate every chart-gateway query — call after saving a birth profile. */
export function invalidateChartGateway(qc: QueryClient) {
  return qc.invalidateQueries({ queryKey: ROOT });
}

/** Fully clear the in-memory cache and the persisted localStorage entry. */
export function clearChartGatewayCache(qc: QueryClient) {
  qc.removeQueries({ queryKey: ROOT });
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(PERSIST_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }
}

/** Hook variant for use inside components. */
export function useChartGatewayCacheControls() {
  const qc = useQueryClient();
  return {
    invalidate: () => invalidateChartGateway(qc),
    clear: () => clearChartGatewayCache(qc),
  };
}

// ---------------------------------------------------------------- lo shu

export type LoShuCell = {
  number: number;
  count: number;
  digits: string;
  meaning: string;
  planet?: string;
  element?: string;
};

export type LoShuArrow = {
  type: "strength" | "weakness";
  name: string;
  numbers: number[];
  meaning?: string;
};

export type LoShuRepeatedDetail = {
  number: number;
  count: number;
  digits: string;
  level: string;
  note: string;
  meaning: string;
};

export type LoShuMissingRemedy = {
  number: number;
  planet: string;
  element: string;
  meaning: string;
  colour: string;
  mantra: string;
  direction: string;
  practice: string;
};

export type KuaDirection = { name: string; theme: string; direction: string };
export type LoShuKua =
  | { available: false; reason?: string }
  | {
      available: true;
      number: number;
      gender: string;
      group: "East" | "West" | string;
      element: string;
      effective_year?: number;
      favorable: KuaDirection[];
      unfavorable: KuaDirection[];
      note?: string;
    };

export type LoShuData = {
  grid: LoShuCell[][];
  counts: Record<string, number>;
  counts_dob?: Record<string, number>;
  present: number[];
  missing: number[];
  repeated: number[];
  repeated_details?: LoShuRepeatedDetail[];
  driver: number;
  destiny: number;
  arrows: LoShuArrow[];
  meanings: Record<string, string>;
  planets?: Record<string, string>;
  elements?: Record<string, string>;
  added_to_grid?: number[];
  missing_remedies?: LoShuMissingRemedy[];
  input?: { method?: string; [k: string]: unknown };
  kua?: LoShuKua;
};

export type LoShuQueryValue = {
  data: LoShuData | null;
  errorCode: string | null;
};

export function useLoShu(): UseQueryResult<LoShuQueryValue> {
  const userId = useCurrentUserId();
  return useQuery<LoShuQueryValue>({
    queryKey: ["report", "lo_shu", userId],
    enabled: userId !== null,
    staleTime: CHART_STALE_MS,
    gcTime: CHART_GC_MS,
    ...QUERY_RETRY_CONFIG,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("chart-gateway", {
        body: { resource: "lo_shu" },
      });
      if (error) {
        let code = "provider_error";
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ctx = (error as any).context;
        if (ctx && typeof ctx.json === "function") {
          try {
            const body = await ctx.json();
            if (body?.error?.code) code = String(body.error.code);
          } catch {
            /* ignore */
          }
        }
        return { data: null, errorCode: code };
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const outer = (data as any)?.data ?? null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const innerErr = (data as any)?.error ?? outer?.error;
      if (innerErr) {
        return { data: null, errorCode: String(innerErr.code ?? "provider_error") };
      }
      const payload =
        outer && typeof outer === "object" && "data" in outer
          ? (outer as { data: unknown }).data
          : outer;

      return { data: (payload as LoShuData) ?? null, errorCode: null };
    },
  });
}

// ---------------------------------------------------------------- today's transits

export type TodayMoonTransit = {
  slotTs: string;
  signIndex: number;
  nakshatraIndex: number;
  pada: number | null;
};

export type TodayPlanetTransit = {
  planet: number;
  signIndex: number;
  nakshatraIndex: number | null;
  pada: number | null;
  retrograde: boolean;
  nextIngressTs: string | null;
  nextSignIndex: number | null;
};

export type TodayTransitsValue = {
  timezone: string;
  moon: TodayMoonTransit | null;
  planets: TodayPlanetTransit[];
};

// Slow-moving bodies shown in the "Today" panorama, in display order.
const TODAY_PLANET_CODES = [0, 2, 3, 4, 5, 6, 101, 102];

export function useTodayTransits(): UseQueryResult<TodayTransitsValue> {
  const userId = useCurrentUserId();
  return useQuery<TodayTransitsValue>({
    queryKey: [...ROOT, "today-transits", userId],
    enabled: userId !== null,
    staleTime: 15 * 60 * 1000,
    gcTime: CHART_GC_MS,
    ...QUERY_RETRY_CONFIG,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      let timezone = "Asia/Kolkata";
      if (userId) {
        const { data } = await supabase
          .from("profiles")
          .select("timezone")
          .eq("user_id", userId)
          .maybeSingle();
        if (data?.timezone) timezone = data.timezone;
      }

      const [{ data: moonRows }, { data: planetRows }] = await Promise.all([
        supabase
          .from("transit_moon_hourly")
          .select("slot_ts, moon_sign, moon_nakshatra, moon_pada")
          .order("slot_ts", { ascending: true }),
        supabase
          .from("transit_planets")
          .select("planet, sign, nakshatra, pada, retrograde, next_ingress_ts, next_sign")
          .in("planet", TODAY_PLANET_CODES),
      ]);

      // slot_ts is an absolute timestamp, so picking by it is timezone-proof —
      // matching an integer local hour to slot_hour would break near a
      // sign/nakshatra boundary whenever the cron's UTC basis and the user's
      // offset (e.g. IST +5:30) disagree on which hour "now" falls in.
      let moon: TodayMoonTransit | null = null;
      if (moonRows && moonRows.length > 0) {
        const nowMs = Date.now();
        let chosen: (typeof moonRows)[number] | undefined;
        for (const r of moonRows) {
          if (new Date(r.slot_ts).getTime() <= nowMs) chosen = r;
        }
        if (!chosen) {
          chosen = moonRows.reduce((best, r) =>
            Math.abs(new Date(r.slot_ts).getTime() - nowMs) <
            Math.abs(new Date(best.slot_ts).getTime() - nowMs)
              ? r
              : best,
          );
        }
        moon = {
          slotTs: chosen.slot_ts,
          signIndex: chosen.moon_sign,
          nakshatraIndex: chosen.moon_nakshatra,
          pada: chosen.moon_pada,
        };
      }

      const planets: TodayPlanetTransit[] = (planetRows ?? []).map((r) => ({
        planet: r.planet,
        signIndex: r.sign,
        nakshatraIndex: r.nakshatra,
        pada: r.pada,
        retrograde: !!r.retrograde,
        nextIngressTs: r.next_ingress_ts,
        nextSignIndex: r.next_sign,
      }));

      return { timezone, moon, planets };
    },
  });
}

// ---------------------------------------------------------------- sade sati timeline

export type SadeSatiPhase = {
  phase: "rising" | "peak" | "setting";
  signIndex: number;
  startTs: string;
  endTs: string;
};

export type SadeSatiTimeline = {
  moonSignIndex: number | null;
  moonTimeUncertain: boolean;
  inSadeSati: boolean;
  episode: {
    startTs: string;
    endTs: string;
    currentPhase: "rising" | "peak" | "setting" | null;
    phases: SadeSatiPhase[];
  } | null;
};

export function useSadeSatiTimeline(): UseQueryResult<SadeSatiTimeline> {
  const userId = useCurrentUserId();
  return useQuery<SadeSatiTimeline>({
    queryKey: [...ROOT, "sade-sati-timeline", userId],
    enabled: userId !== null,
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: CHART_GC_MS,
    ...QUERY_RETRY_CONFIG,
    queryFn: async () => {
      const safe: SadeSatiTimeline = {
        moonSignIndex: null,
        moonTimeUncertain: false,
        inSadeSati: false,
        episode: null,
      };
      const { data, error } = await supabase.functions.invoke("sade-sati-timeline", {
        body: {},
      });
      if (error) {
        // Mirror useDoshaReport's error-context pattern; degrade to a safe shape
        // so the card can keep showing Step 1 output.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ctx = (error as any).context;
        if (ctx && typeof ctx.json === "function") {
          try {
            await ctx.json();
          } catch {
            /* ignore */
          }
        }
        return safe;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d = data as any;
      if (!d || d.ok !== true) return safe;
      return {
        moonSignIndex: typeof d.moonSignIndex === "number" ? d.moonSignIndex : null,
        moonTimeUncertain: !!d.moon_time_uncertain,
        inSadeSati: !!d.inSadeSati,
        episode: d.episode
          ? {
              startTs: String(d.episode.startTs),
              endTs: String(d.episode.endTs),
              currentPhase: d.episode.currentPhase ?? null,
              phases: Array.isArray(d.episode.phases)
                ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  d.episode.phases.map((p: any) => ({
                    phase: p.phase,
                    signIndex: p.signIndex,
                    startTs: String(p.startTs),
                    endTs: String(p.endTs),
                  }))
                : [],
            }
          : null,
      };
    },
  });
}

// ---------------------------------------------------------------- market outlook

export type MarketReasoning = {
  points: number;
  text: string;
  code?: string;
  params?: { sign?: number };
};

export type MarketMetalOutlook = {
  metal: "gold" | "silver";
  lean: "up" | "flat" | "down";
  score: number;
  reasoning: MarketReasoning[];
  refPrice: number | null;
};

export type MarketAccuracy = {
  total: number; // scored calls in the window
  correct: number;
  pct: number | null; // 0..100, null when nothing is scored yet
};

export type MarketOutlookValue = {
  tradeDate: string | null;
  gold: MarketMetalOutlook | null;
  silver: MarketMetalOutlook | null;
  accuracy: MarketAccuracy;
};

export function useMarketOutlook(): UseQueryResult<MarketOutlookValue> {
  const userId = useCurrentUserId();
  return useQuery<MarketOutlookValue>({
    queryKey: [...ROOT, "market-outlook", userId],
    enabled: userId !== null,
    staleTime: 15 * 60 * 1000,
    gcTime: CHART_GC_MS,
    ...QUERY_RETRY_CONFIG,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      // Last ~31 calendar days (2 metals/day). RLS allows authenticated reads.
      const sinceIso = new Date(Date.now() - 31 * 24 * 3600 * 1000).toISOString().slice(0, 10);

      const { data: rows } = await supabase
        .from("market_predictions")
        .select("trade_date, metal, lean, score, reasoning, ref_price, correct")
        .gte("trade_date", sinceIso)
        .order("trade_date", { ascending: false });

      const all = rows ?? [];
      const tradeDate = all.length ? all[0].trade_date : null;

      const pick = (metal: "gold" | "silver"): MarketMetalOutlook | null => {
        const r = all.find((x) => x.trade_date === tradeDate && x.metal === metal);
        if (!r) return null;
        const reasoning = Array.isArray(r.reasoning) ? (r.reasoning as MarketReasoning[]) : [];
        return {
          metal,
          lean: r.lean as "up" | "flat" | "down",
          score: Number(r.score),
          reasoning,
          refPrice: r.ref_price != null ? Number(r.ref_price) : null,
        };
      };

      const scored = all.filter((x) => x.correct === true || x.correct === false);
      const correct = scored.filter((x) => x.correct === true).length;
      const total = scored.length;
      const pct = total > 0 ? Math.round((correct / total) * 100) : null;

      return {
        tradeDate,
        gold: pick("gold"),
        silver: pick("silver"),
        accuracy: { total, correct, pct },
      };
    },
  });
}

// ---------------------------------------------------------------- composite barometer

export type BarometerBias = "bullish" | "neutral" | "bearish";
export type BarometerAsset = {
  assetKey: string;
  fusedProbability: number; // 0..1 P(up)
  confidenceScore: number; // 0..100, coverage-adjusted
  bias: BarometerBias;
  sourceCoverage: number | null; // 0..1 fraction of active sources present
};
export type BarometerValue = {
  barometerDate: string | null;
  assets: BarometerAsset[];
};

// Reads the latest Composite Financial Barometer rows (one per asset) written
// by the barometer-compute Edge Function. Global market data — RLS allows
// authenticated reads via the "read barometer" policy on
// financial_barometer_daily. Mirrors the useMarketOutlook direct-table pattern.
export function useBarometer(): UseQueryResult<BarometerValue> {
  const userId = useCurrentUserId();
  return useQuery<BarometerValue>({
    queryKey: [...ROOT, "barometer", userId],
    enabled: userId !== null,
    staleTime: 15 * 60 * 1000,
    gcTime: CHART_GC_MS,
    ...QUERY_RETRY_CONFIG,
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<BarometerValue> => {
      // Pull a small recent window (3 assets/day) and keep only the latest date.
      const { data: rows } = await supabase
        .from("financial_barometer_daily")
        .select(
          "barometer_date, asset_key, fused_probability, confidence_score, directional_bias, inputs",
        )
        .order("barometer_date", { ascending: false })
        .limit(12);

      const all = rows ?? [];
      if (all.length === 0) return { barometerDate: null, assets: [] };

      const latestDate = String(all[0].barometer_date);
      const assets: BarometerAsset[] = all
        .filter((r) => String(r.barometer_date) === latestDate)
        .map((r) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const cov = (r.inputs as any)?.source_coverage;
          return {
            assetKey: String(r.asset_key),
            fusedProbability: Number(r.fused_probability),
            confidenceScore: Number(r.confidence_score),
            bias: (r.directional_bias as BarometerBias) ?? "neutral",
            sourceCoverage: cov != null ? Number(cov) : null,
          };
        })
        .sort((a, b) => a.assetKey.localeCompare(b.assetKey));

      return { barometerDate: latestDate, assets };
    },
  });
}

// ---------------------------------------------------------------- bradley siderograph

export type BradleyPoint = { date: string; value: number };
export type BradleyValue = {
  today: string;
  points: BradleyPoint[];
};

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

// Reads the Bradley siderograph curve (p_raw) across a window from ~30 days ago
// to ~60 days ahead (future rows are precomputed to 2026-12-31). Global
// market-timing data — RLS allows authenticated reads via the "read bradley"
// policy on bradley_siderograph_daily.
export function useBradley(): UseQueryResult<BradleyValue> {
  const userId = useCurrentUserId();
  return useQuery<BradleyValue>({
    queryKey: [...ROOT, "bradley", userId],
    enabled: userId !== null,
    staleTime: 15 * 60 * 1000,
    gcTime: CHART_GC_MS,
    ...QUERY_RETRY_CONFIG,
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<BradleyValue> => {
      const now = new Date();
      const today = ymd(now);
      const start = new Date(now);
      start.setDate(start.getDate() - 30);
      const end = new Date(now);
      end.setDate(end.getDate() + 60);

      const { data: rows } = await supabase
        .from("bradley_siderograph_daily")
        .select("bradley_date, p_raw")
        .gte("bradley_date", ymd(start))
        .lte("bradley_date", ymd(end))
        .order("bradley_date", { ascending: true });

      const points: BradleyPoint[] = (rows ?? []).map((r) => ({
        date: String(r.bradley_date),
        value: Number(r.p_raw),
      }));

      return { today, points };
    },
  });
}

// ---------------------------------------------------------------- sbc vedha

export type SbcVedhaCell = {
  planet: string;
  vedhaType: string; // savya / apasavya (direction)
  isMalefic: boolean;
  contribution: number; // signed
  vedhaStrength: number;
  dignityMultiplier: number;
};

export type SbcDay = {
  date: string;
  netScore: number; // scored_data.score_raw (true signed net)
  vedhaCount: number;
  cells: SbcVedhaCell[];
};

export type SbcAssetSeries = {
  assetKey: string; // nifty50 | mcxgold | mcxsilver
  byDate: Record<string, SbcDay>;
};

export type SbcValue = {
  today: string;
  dates: string[]; // full 30-day calendar (ascending) so columns align across assets
  maxAbs: number; // symmetric diverging domain from days that actually have vedhas
  assets: SbcAssetSeries[]; // fixed order: nifty50, mcxgold, mcxsilver
};

const SBC_ASSET_ORDER = ["nifty50", "mcxgold", "mcxsilver"] as const;
const SBC_WINDOW_DAYS = 30;

// Reads the base table sbc_vedha_daily directly (authenticated read granted via
// the "read sbc" policy). One 30-day window powers both the heatmap and today's
// card. Absent dates are surfaced as "not computed" by the UI, distinct from a
// present row with zero vedhas.
export function useSbc(): UseQueryResult<SbcValue> {
  const userId = useCurrentUserId();
  return useQuery<SbcValue>({
    queryKey: [...ROOT, "sbc", userId],
    enabled: userId !== null,
    staleTime: 15 * 60 * 1000,
    gcTime: CHART_GC_MS,
    ...QUERY_RETRY_CONFIG,
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<SbcValue> => {
      const now = new Date();
      const today = ymd(now);
      const dates: string[] = [];
      for (let i = SBC_WINDOW_DAYS - 1; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        dates.push(ymd(d));
      }

      const { data: rows } = await supabase
        .from("sbc_vedha_daily")
        .select("sbc_date, asset_key, scored_data")
        .gte("sbc_date", dates[0])
        .lte("sbc_date", today)
        .order("sbc_date", { ascending: true });

      const byAsset: Record<string, Record<string, SbcDay>> = {};
      for (const key of SBC_ASSET_ORDER) byAsset[key] = {};

      let maxAbs = 0;
      for (const r of rows ?? []) {
        const assetKey = String((r as { asset_key: string }).asset_key);
        if (!byAsset[assetKey]) continue;

        const sd = ((r as { scored_data: unknown }).scored_data ?? {}) as {
          score_raw?: number;
          contributions?: unknown;
        };
        const rawCells = Array.isArray(sd.contributions) ? sd.contributions : [];
        const cells: SbcVedhaCell[] = rawCells.map((c) => {
          const cell = c as Record<string, unknown>;
          return {
            planet: String(cell.planet ?? ""),
            vedhaType: String(cell.vedha_type ?? ""),
            isMalefic: Boolean(cell.is_malefic),
            contribution: Number(cell.contribution ?? 0),
            vedhaStrength: Number(cell.vedha_strength ?? 0),
            dignityMultiplier: Number(cell.dignity_multiplier ?? 0),
          };
        });

        const netScore = Number(sd.score_raw ?? 0);
        const date = String((r as { sbc_date: string }).sbc_date);
        byAsset[assetKey][date] = {
          date,
          netScore,
          vedhaCount: cells.length,
          cells,
        };
        if (cells.length > 0) maxAbs = Math.max(maxAbs, Math.abs(netScore));
      }

      const assets: SbcAssetSeries[] = SBC_ASSET_ORDER.map((assetKey) => ({
        assetKey,
        byDate: byAsset[assetKey],
      }));

      return { today, dates, maxAbs: maxAbs || 1, assets };
    },
  });
}

// ---------------------------------------------------------------- daily horoscope

export type DailyHoroscopeArea = { key: string; text: string };
export type DailyHoroscopeLucky = {
  color: string | null;
  number: string | null;
  direction: string | null;
};
export type DailyHoroscopeReason = {
  kind: "natal" | "transit" | "dasha";
  text: string;
  bodies?: string[];
  house?: number;
  sign?: string;
  dignity?: "exalted" | "debilitated" | "own" | "neutral";
};
export type DailyHoroscopeReasons = {
  summary: DailyHoroscopeReason[];
  areas: Record<string, DailyHoroscopeReason[]>;
};
export type DailyHoroscopeValue = {
  incomplete: boolean;
  summary: string | null;
  areas: DailyHoroscopeArea[];
  focus: string | null;
  lucky: DailyHoroscopeLucky | null;
  date: string | null;
  reasons: DailyHoroscopeReasons | null;
};

// Personalized daily reading. The `daily-horoscope` Edge Function grounds on
// the user's real natal chart + today's live sky + current dasha, caches one
// row per user/day/language, and returns calm structured JSON.
export function useDailyHoroscope(lang: string): UseQueryResult<DailyHoroscopeValue> {
  const userId = useCurrentUserId();
  return useQuery<DailyHoroscopeValue>({
    queryKey: [...ROOT, "daily-horoscope", userId, lang],
    enabled: userId !== null && !!lang,
    staleTime: CHART_STALE_MS,
    gcTime: CHART_GC_MS,
    ...QUERY_RETRY_CONFIG,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("daily-horoscope", {
        body: { lang },
      });
      if (error) {
        let code = "provider_error";
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ctx = (error as any).context;
        if (ctx && typeof ctx.json === "function") {
          try {
            const body = await ctx.json();
            if (body?.error?.code) code = String(body.error.code);
          } catch {
            /* ignore */
          }
        }
        throw new Error(code);
      }
      if (data?.incomplete) {
        return {
          incomplete: true,
          summary: null,
          areas: [],
          focus: null,
          lucky: null,
          date: data?.date ?? null,
          reasons: null,
        };
      }
      return {
        incomplete: false,
        summary: data?.summary ?? null,
        areas: Array.isArray(data?.areas) ? (data.areas as DailyHoroscopeArea[]) : [],
        focus: data?.focus ?? null,
        lucky: (data?.lucky ?? null) as DailyHoroscopeLucky | null,
        date: data?.date ?? null,
        reasons: (data?.reasons ?? null) as DailyHoroscopeReasons | null,
      };
    },
  });
}

// ---------------------------------------------------------------- panchang

export type PanchangQueryValue = {
  sunLon: number;
  moonLon: number;
  nakshatraIndex: number;
  lat: number | null;
  lon: number | null;
  timezone: string;
} | null;

// Reads today's Sun (transit_planets planet=0) and the nearest Moon slot
// (transit_moon_hourly) and returns sidereal longitudes for panchang math.
export function usePanchang(): UseQueryResult<PanchangQueryValue> {
  const userId = useCurrentUserId();
  return useQuery<PanchangQueryValue>({
    queryKey: [...ROOT, "panchang", userId],
    enabled: userId !== null,
    staleTime: 15 * 60 * 1000,
    gcTime: CHART_GC_MS,
    ...QUERY_RETRY_CONFIG,
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<PanchangQueryValue> => {
      const [{ data: moonRows }, { data: sunRows }] = await Promise.all([
        supabase
          .from("transit_moon_hourly")
          .select("slot_ts, moon_sign, moon_deg, moon_nakshatra")
          .order("slot_ts", { ascending: true }),
        supabase.from("transit_planets").select("planet, sign, deg").eq("planet", 0),
      ]);

      const sunRow = (sunRows ?? [])[0];
      if (!sunRow || sunRow.sign == null || sunRow.deg == null) return null;
      const sunLon = sunRow.sign * 30 + Number(sunRow.deg);

      if (!moonRows || moonRows.length === 0) return null;
      const nowMs = Date.now();
      let chosen: (typeof moonRows)[number] | undefined;
      for (const r of moonRows) {
        if (new Date(r.slot_ts).getTime() <= nowMs) chosen = r;
      }
      if (!chosen) {
        chosen = moonRows.reduce((best, r) =>
          Math.abs(new Date(r.slot_ts).getTime() - nowMs) <
          Math.abs(new Date(best.slot_ts).getTime() - nowMs)
            ? r
            : best,
        );
      }
      if (chosen.moon_sign == null || chosen.moon_deg == null) return null;
      const moonLon = chosen.moon_sign * 30 + Number(chosen.moon_deg);
      const nakshatraIndex = chosen.moon_nakshatra ?? null;

      const profile = await getBirthProfile();
      return {
        sunLon,
        moonLon,
        nakshatraIndex,
        lat: profile?.latitude ?? null,
        lon: profile?.longitude ?? null,
        timezone: profile?.birth_timezone ?? "Asia/Kolkata",
      };
    },
  });
}

// ---------------------------------------------------------------- whatsapp guidance

export type WhatsAppPrefs = {
  phone_e164: string | null;
  opt_in: boolean;
  send_hour_local: number;
  lang: string;
  opted_in_at: string | null;
};

export const DEFAULT_WHATSAPP_HOUR = 8;

// Loose E.164 check: leading +, country code digit 1-9, up to 15 digits total.
const E164_RE = /^\+[1-9]\d{7,14}$/;

export function isValidE164Phone(phone: string): boolean {
  return E164_RE.test(phone.trim());
}

// Backed by Supabase `whatsapp_prefs` (one row per user). Presentation-only
// opt-in card in Settings reads/writes through this — no sending logic here.
export function useWhatsAppPrefs(): UseQueryResult<WhatsAppPrefs | null> {
  const userId = useCurrentUserId();
  return useQuery<WhatsAppPrefs | null>({
    queryKey: ["whatsapp-prefs", userId],
    enabled: userId !== null,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase
        .from("whatsapp_prefs")
        .select("phone_e164, opt_in, send_hour_local, lang, opted_in_at")
        .eq("user_id", userId)
        .maybeSingle();
      if (!data) return null;
      return {
        phone_e164: data.phone_e164 ?? null,
        opt_in: !!data.opt_in,
        send_hour_local: data.send_hour_local ?? DEFAULT_WHATSAPP_HOUR,
        lang: data.lang ?? "en",
        opted_in_at: data.opted_in_at ?? null,
      };
    },
  });
}

export async function saveWhatsAppPrefs(input: {
  phone_e164: string;
  opt_in: boolean;
  send_hour_local: number;
  lang: string;
}): Promise<{ error?: string }> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return { error: "unauthenticated" };

  if (input.opt_in && !isValidE164Phone(input.phone_e164)) {
    return { error: "invalid_phone" };
  }

  const patch: Record<string, unknown> = {
    user_id: userId,
    phone_e164: input.phone_e164.trim(),
    opt_in: input.opt_in,
    send_hour_local: input.send_hour_local,
    lang: input.lang,
  };
  // Only stamp opted_in_at when the user is (re)enabling — leaving it out of
  // the patch when disabling keeps the original opt-in time intact.
  if (input.opt_in) patch.opted_in_at = new Date().toISOString();

  const { error } = await supabase.from("whatsapp_prefs").upsert(patch, { onConflict: "user_id" });
  if (error) return { error: error.message };
  return {};
}

// ---------------------------------------------------------------- People (related charts)

export function useRelatedCharts(): UseQueryResult<RelatedChart[]> {
  const userId = useCurrentUserId();
  return useQuery<RelatedChart[]>({
    queryKey: ["related-charts", "list", userId],
    enabled: userId !== null,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data } = await listRelatedCharts();
      return data;
    },
  });
}

export type PersonChartsValue =
  | { data: PersonChartsBundle; error?: undefined }
  | { data?: undefined; error: { code: string; message: string } };

export function usePersonCharts(
  relatedChartId: string | undefined,
): UseQueryResult<PersonChartsValue> {
  const userId = useCurrentUserId();
  return useQuery<PersonChartsValue>({
    queryKey: ["related-charts", "person-charts", userId, relatedChartId],
    enabled: userId !== null && !!relatedChartId,
    staleTime: CHART_STALE_MS,
    gcTime: CHART_GC_MS,
    ...QUERY_RETRY_CONFIG,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("person-charts", {
        body: { related_chart_id: relatedChartId },
      });
      if (error) {
        let code = "provider_error";
        let message = error.message ?? "Request failed";
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ctx = (error as any).context;
        if (ctx && typeof ctx.json === "function") {
          try {
            const body = await ctx.json();
            if (body?.error?.code) code = String(body.error.code);
            if (body?.error?.message) message = String(body.error.message);
          } catch {
            /* ignore */
          }
        }
        return { error: { code, message } };
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const bundle = (data as any)?.data as PersonChartsBundle | undefined;
      if (!bundle) return { error: { code: "provider_error", message: "Empty response" } };
      return { data: bundle };
    },
  });
}

export type CompatibilityValue =
  | { data: CompatibilityBundle; error?: undefined }
  | { data?: undefined; error: { code: string; message: string } };

export function useCompatibility(
  relatedChartId: string | undefined,
): UseQueryResult<CompatibilityValue> {
  const userId = useCurrentUserId();
  return useQuery<CompatibilityValue>({
    queryKey: ["related-charts", "compatibility", userId, relatedChartId],
    enabled: userId !== null && !!relatedChartId,
    staleTime: CHART_STALE_MS,
    gcTime: CHART_GC_MS,
    ...QUERY_RETRY_CONFIG,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("compatibility", {
        body: { related_chart_id: relatedChartId },
      });
      if (error) {
        let code = "provider_error";
        let message = error.message ?? "Request failed";
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ctx = (error as any).context;
        if (ctx && typeof ctx.json === "function") {
          try {
            const body = await ctx.json();
            if (body?.error?.code) code = String(body.error.code);
            if (body?.error?.message) message = String(body.error.message);
          } catch {
            /* ignore */
          }
        }
        return { error: { code, message } };
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const bundle = (data as any)?.data as CompatibilityBundle | undefined;
      if (!bundle) return { error: { code: "provider_error", message: "Empty response" } };
      return { data: bundle };
    },
  });
}

// ---------------------------------------------------------------- life timeline

const LIFE_EVENTS_ROOT = ["life-events"] as const;

export function useLifeEvents(): UseQueryResult<LifeEvent[]> {
  const userId = useCurrentUserId();
  return useQuery<LifeEvent[]>({
    queryKey: [...LIFE_EVENTS_ROOT, userId],
    enabled: userId !== null,
    staleTime: 60 * 1000,
    gcTime: CHART_GC_MS,
    ...QUERY_RETRY_CONFIG,
    queryFn: listLifeEvents,
  });
}

// Stamping is best-effort: a failure there must not fail the create/update
// mutation itself, so it's caught and swallowed after the initial refetch.
function useStampAndInvalidate() {
  const queryClient = useQueryClient();
  const userId = useCurrentUserId();
  return async (id: string, force?: boolean) => {
    try {
      await stampLifeEvent(id, force);
    } catch {
      /* best-effort */
    }
    void queryClient.invalidateQueries({ queryKey: [...LIFE_EVENTS_ROOT, userId] });
  };
}

export function useCreateLifeEvent() {
  const queryClient = useQueryClient();
  const userId = useCurrentUserId();
  const stampAndInvalidate = useStampAndInvalidate();
  return useMutation({
    mutationFn: (input: LifeEventInput) => createLifeEvent(input),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: [...LIFE_EVENTS_ROOT, userId] });
      if (result.event) void stampAndInvalidate(result.event.id);
    },
  });
}

export function useUpdateLifeEvent() {
  const queryClient = useQueryClient();
  const userId = useCurrentUserId();
  const stampAndInvalidate = useStampAndInvalidate();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<LifeEventInput> }) =>
      updateLifeEvent(id, patch),
    onSuccess: async (result, variables) => {
      await queryClient.invalidateQueries({ queryKey: [...LIFE_EVENTS_ROOT, userId] });
      if (result.event) {
        const datesOrCategoryChanged =
          "event_date" in variables.patch || "category" in variables.patch;
        void stampAndInvalidate(result.event.id, datesOrCategoryChanged);
      }
    },
  });
}

export function useDeleteLifeEvent() {
  const queryClient = useQueryClient();
  const userId = useCurrentUserId();
  return useMutation({
    mutationFn: (id: string) => deleteLifeEvent(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...LIFE_EVENTS_ROOT, userId] });
    },
  });
}

// Manual "Refresh astrology" retry — force-restamps a single event without
// touching its other fields.
export function useRestampLifeEvent() {
  const queryClient = useQueryClient();
  const userId = useCurrentUserId();
  return useMutation({
    mutationFn: (id: string) => stampLifeEvent(id, true),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...LIFE_EVENTS_ROOT, userId] });
    },
  });
}

// ---------------------------------------------------------------- proactive nudges

const PROACTIVE_NUDGES_ROOT = ["proactive-nudges"] as const;
const PROACTIVE_SETTINGS_ROOT = ["proactive-settings"] as const;

export function useSentNudges(): UseQueryResult<ProactiveNudge[]> {
  const userId = useCurrentUserId();
  return useQuery<ProactiveNudge[]>({
    queryKey: [...PROACTIVE_NUDGES_ROOT, userId],
    enabled: userId !== null,
    staleTime: 60 * 1000,
    gcTime: CHART_GC_MS,
    ...QUERY_RETRY_CONFIG,
    queryFn: listSentNudges,
  });
}

// Wraps useSentNudges with a client-only selector; never runs a second query.
export function useUnreadNudgeCount(): number {
  const userId = useCurrentUserId();
  const query = useQuery<ProactiveNudge[], Error, number>({
    queryKey: [...PROACTIVE_NUDGES_ROOT, userId],
    enabled: userId !== null,
    staleTime: 60 * 1000,
    gcTime: CHART_GC_MS,
    ...QUERY_RETRY_CONFIG,
    queryFn: listSentNudges,
    select: (data) => data.length,
  });
  return query.data ?? 0;
}

export function useActOnNudge() {
  const queryClient = useQueryClient();
  const userId = useCurrentUserId();
  return useMutation({
    mutationFn: (id: string) => actOnNudge(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...PROACTIVE_NUDGES_ROOT, userId] });
    },
  });
}

export function useDismissNudge() {
  const queryClient = useQueryClient();
  const userId = useCurrentUserId();
  return useMutation({
    mutationFn: (id: string) => dismissNudge(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...PROACTIVE_NUDGES_ROOT, userId] });
    },
  });
}

export function useProactiveSettings(): UseQueryResult<ProactiveSettings> {
  const userId = useCurrentUserId();
  return useQuery<ProactiveSettings>({
    queryKey: [...PROACTIVE_SETTINGS_ROOT, userId],
    enabled: userId !== null,
    staleTime: 5 * 60 * 1000,
    gcTime: CHART_GC_MS,
    ...QUERY_RETRY_CONFIG,
    queryFn: getProactiveSettings,
  });
}

export function useSaveProactiveSettings() {
  const queryClient = useQueryClient();
  const userId = useCurrentUserId();
  return useMutation({
    mutationFn: (patch: Partial<ProactiveSettings>) => saveProactiveSettings(patch),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...PROACTIVE_SETTINGS_ROOT, userId] });
    },
  });
}
