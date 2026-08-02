// Supabase Edge Function: prime-charts
// Eagerly pre-generates ALL of a user's charts/reports right after their birth
// details are saved (onboarding OR a later edit), so every chart plus the AI's
// structured chart_facts exist up front — whether or not the user ever opens
// each tab.
//
// It does NOT talk to Prokerala directly: it calls chart-gateway once per item,
// reusing all of the gateway's generation, caching (input_hash reuse), and
// fact-writing logic. On a birth *change*, the new birth data yields new input
// hashes, so the gateway regenerates fresh and overwrites both chart_artifacts
// and chart_facts — keeping frontend, backend and AI in sync from one action.
//
// Work runs in the background (EdgeRuntime.waitUntil) so the caller returns
// immediately and onboarding never stalls.
//
// Runtime: Deno (Supabase Edge Functions).

// @ts-ignore - Deno std import (resolved at deploy time)
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const Deno: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const EdgeRuntime: any;

// ---------- CORS ----------
const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Max-Age": "86400",
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...CORS_HEADERS },
  });
}

function err(status: number, code: string, message?: string): Response {
  return json(status, { error: { code, message: message ?? code } });
}

// ---------- The full set of charts/reports to pre-generate ----------
type GatewayBody = Record<string, unknown>;

// 16 divisional (varga) charts — must match chart-gateway's PROKERALA_CHART_SLUG
// keys and the frontend VARGA_TO_ENUM values.
const VARGA_CHART_TYPES: string[] = [
  "d1_rashi",
  "d2_hora",
  "d3_drekkana",
  "d4_chaturthamsha",
  "d7_saptamsha",
  "d9_navamsha",
  "d10_dashamsha",
  "d12_dwadashamsha",
  "d16_shodashamsha",
  "d20_vimshamsha",
  "d24_chaturvimshamsha",
  "d27_bhamsha",
  "d30_trimshamsha",
  "d40_khavedamsha",
  "d45_akshavedamsha",
  "d60_shashtiamsha",
];

function buildJobBodies(): GatewayBody[] {
  const bodies: GatewayBody[] = [];
  // 16 divisional (varga) charts, north-Indian (the style we parse into facts).
  for (const chart_type of VARGA_CHART_TYPES) {
    bodies.push({ resource: "chart", chart_type, chart_style: "north_indian" });
  }
  // Planet positions (natal).
  bodies.push({ resource: "planets" });
  // Numerology + Lo Shu.
  bodies.push({ resource: "numerology" });
  bodies.push({ resource: "lo_shu" });
  // Reports: dasha + dosha family + sarvashtakavarga.
  bodies.push({ resource: "report", report_type: "vimshottari_dasha" });
  bodies.push({ resource: "report", report_type: "mangal_dosha" });
  bodies.push({ resource: "report", report_type: "kaal_sarp_dosha" });
  bodies.push({ resource: "report", report_type: "sade_sati" });
  bodies.push({ resource: "report", report_type: "sarvashtakavarga" });
  // Bhinnashtakavarga per planet (Sun..Saturn = 0..6).
  for (let planet = 0; planet <= 6; planet++) {
    bodies.push({
      resource: "report",
      report_type: "ashtakavarga",
      provider_params: { planet: String(planet) },
    });
  }
  return bodies;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return err(405, "method_not_allowed", "Only POST is supported");
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return err(500, "server_misconfigured", "Supabase env missing");
  }

  // prime-charts must be called by an authenticated user. We forward that same
  // Authorization to chart-gateway so it resolves the caller and their birth
  // profile exactly as a normal request would.
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader) {
    return err(401, "not_authenticated", "Missing Authorization header");
  }

  // Optional: force a full refresh (e.g. an explicit "regenerate everything").
  // Normally omitted — changed birth data already yields new input-hashes, so
  // the gateway regenerates only what actually changed.
  let forceRefresh = false;
  try {
    const body = await req.json();
    forceRefresh = body?.force_refresh === true;
  } catch {
    // empty body is fine
  }

  const jobs = buildJobBodies().map((b) => (forceRefresh ? { ...b, force_refresh: true } : b));

  const gatewayUrl = `${SUPABASE_URL}/functions/v1/chart-gateway`;
  const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

  // Call the gateway for one item, retrying on throttling / transient errors.
  // Prokerala's free tier throttles bursts, so a single best-effort fetch can
  // silently drop later calls (this is what left ashtakavarga at 3/8). We retry
  // on 429 and 5xx (and network errors) with exponential backoff + jitter, and
  // honor Retry-After when the provider sends it, so every item actually lands.
  const callGateway = async (payload: GatewayBody): Promise<void> => {
    const MAX_ATTEMPTS = 4;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const res = await fetch(gatewayUrl, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            apikey: SERVICE_KEY,
            Authorization: authHeader,
          },
          body: JSON.stringify(payload),
        });
        // Always drain the body so the connection is released.
        try {
          await res.text();
        } catch {
          // ignore
        }
        if (res.ok) return;
        // Retry only on throttling (429) and server/provider errors (5xx).
        const retryable = res.status === 429 || res.status >= 500;
        if (!retryable || attempt === MAX_ATTEMPTS) return; // best-effort: give up
        const retryAfterRaw = Number(res.headers.get("retry-after"));
        const backoffMs =
          Number.isFinite(retryAfterRaw) && retryAfterRaw > 0
            ? retryAfterRaw * 1000
            : 500 * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 250);
        await sleep(backoffMs);
      } catch (_e) {
        // Network / fetch error: back off and retry.
        if (attempt === MAX_ATTEMPTS) return;
        await sleep(500 * Math.pow(2, attempt - 1));
      }
    }
  };

  // Fire everything in the background so the client's onboarding flow returns
  // instantly. Run SEQUENTIALLY with a small gap between calls: Prokerala's
  // free tier throttles bursts, and concurrency-3 was dropping the tail of the
  // ashtakavarga per-planet calls. Sequential + inter-call delay + per-call
  // backoff retries makes priming reliable. A full run takes ~30-60s, which is
  // fine for a background (waitUntil) job.
  const runAll = (async () => {
    for (const job of jobs) {
      await callGateway(job);
      await sleep(400);
    }
  })();
  if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) {
    EdgeRuntime.waitUntil(runAll);
  } else {
    // Fallback if the background API is unavailable: fire-and-forget.
    void runAll;
  }

  return json(202, { status: "priming", total: jobs.length });
});
