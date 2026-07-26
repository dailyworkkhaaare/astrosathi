// TanStack Query hooks that cache chart-gateway responses on the client.
// The cache persists to localStorage (see `AppQueryProvider` in `__root.tsx`),
// so refreshes and navigation reuse the last successful response without a
// new Edge Function call until the entry goes stale.

import {
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

export type DoshaReportType = "mangal_dosha" | "kaal_sarp_dosha" | "sade_sati";

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
      const sinceIso = new Date(Date.now() - 31 * 24 * 3600 * 1000)
        .toISOString()
        .slice(0, 10);

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
        const reasoning = Array.isArray(r.reasoning)
          ? (r.reasoning as MarketReasoning[])
          : [];
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

// ---------------------------------------------------------------- daily horoscope

export type DailyHoroscopeArea = { key: string; text: string };
export type DailyHoroscopeLucky = {
  color: string | null;
  number: string | null;
  direction: string | null;
};
export type DailyHoroscopeValue = {
  incomplete: boolean;
  summary: string | null;
  areas: DailyHoroscopeArea[];
  focus: string | null;
  lucky: DailyHoroscopeLucky | null;
  date: string | null;
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
        };
      }
      return {
        incomplete: false,
        summary: data?.summary ?? null,
        areas: Array.isArray(data?.areas) ? (data.areas as DailyHoroscopeArea[]) : [],
        focus: data?.focus ?? null,
        lucky: (data?.lucky ?? null) as DailyHoroscopeLucky | null,
        date: data?.date ?? null,
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
        sunLon, moonLon, nakshatraIndex,
        lat: profile?.latitude ?? null,
        lon: profile?.longitude ?? null,
        timezone: profile?.birth_timezone ?? "Asia/Kolkata",
      };
    },
  });
}
