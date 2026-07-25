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

function useCurrentUserId(): string | null {
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
