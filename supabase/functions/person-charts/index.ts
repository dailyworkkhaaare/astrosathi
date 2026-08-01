// Supabase Edge Function: person-charts
// -----------------------------------------------------------------------------
// Computes D1 + all 16 divisional (varga) charts + basic info for a SAVED
// person (public.related_charts), using the SAME local astronomy-engine math
// as chart-gateway. It is fully self-contained (positions.ts / varga.ts /
// render-north.ts are copied), so it NEVER imports from or mutates the drifted
// chart-gateway backbone, birth_profiles, chart_facts, or chart_artifacts.
//
// Caches the full bundle in public.related_chart_artifacts
// (chart_type = "varga_bundle") keyed by input_hash.
//
// AuthZ: uses the caller's JWT so RLS on related_charts / related_chart_artifacts
// enforces owner-only access. A user can only read/compute their own people.
//
// Request:  POST { related_chart_id: string, force_refresh?: boolean }
// Response: 200 { reused: boolean, data: <bundle> }
//
// Runtime: Deno (Supabase Edge Functions).

// @ts-ignore - Deno std import (resolved at deploy time)
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
// @ts-ignore - esm.sh import (resolved at deploy time)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import {
  computeNatalPayload,
  isoWithOffset,
  sha256Hex,
  canonicalJson,
  SWISS_ENGINE_VERSION,
  ENG_SIGNS,
} from "./positions.ts";
import { VARGAS, VARGA_TO_ENUM, computeVarga } from "./varga.ts";
import { renderNorthIndian } from "./render-north.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const Deno: any;

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

// 27 nakshatras (Ashwini .. Revati). Each spans 360/27 = 13°20'.
const NAKSHATRAS = [
  "Ashwini",
  "Bharani",
  "Krittika",
  "Rohini",
  "Mrigashira",
  "Ardra",
  "Punarvasu",
  "Pushya",
  "Ashlesha",
  "Magha",
  "Purva Phalguni",
  "Uttara Phalguni",
  "Hasta",
  "Chitra",
  "Swati",
  "Vishakha",
  "Anuradha",
  "Jyeshtha",
  "Mula",
  "Purva Ashadha",
  "Uttara Ashadha",
  "Shravana",
  "Dhanishta",
  "Shatabhisha",
  "Purva Bhadrapada",
  "Uttara Bhadrapada",
  "Revati",
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function findBody(positions: any[], id: number): any | null {
  return positions.find((p) => Number(p?.id) === id) ?? null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function basicInfo(positions: any[]) {
  const asc = findBody(positions, 100);
  const moon = findBody(positions, 1);
  const sun = findBody(positions, 0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const signOf = (b: any) =>
    b
      ? {
          sign: Math.floor(Number(b.longitude) / 30),
          name: ENG_SIGNS[Math.floor(Number(b.longitude) / 30)],
        }
      : null;
  let nakshatra: { index: number; name: string; pada: number } | null = null;
  if (moon) {
    const L = ((Number(moon.longitude) % 360) + 360) % 360;
    const span = 360 / 27;
    const idx = Math.floor(L / span);
    const pada = Math.floor((L - idx * span) / (span / 4)) + 1;
    nakshatra = { index: idx, name: NAKSHATRAS[idx], pada };
  }
  return {
    ascendant: signOf(asc),
    moon: moon ? { ...signOf(moon), nakshatra } : null,
    sun: signOf(sun),
  };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return err(405, "method_not_allowed", "Only POST is supported");
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
  if (!SUPABASE_URL || !ANON_KEY) {
    return err(500, "server_misconfigured", "Supabase env missing");
  }

  // Caller JWT -> RLS-scoped client. related_charts / related_chart_artifacts
  // policies restrict every row to auth.uid() = user_id, so a user can only
  // ever read or compute their own saved people.
  const authHeader = req.headers.get("Authorization") ?? "";
  const supabase = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  const user = userData?.user;
  if (userErr || !user) {
    return err(401, "unauthorized", "A valid session is required");
  }

  let body: { related_chart_id?: string; force_refresh?: boolean };
  try {
    body = await req.json();
  } catch {
    return err(400, "invalid_json", "Request body must be valid JSON");
  }
  const relatedChartId = String(body.related_chart_id ?? "").trim();
  if (!relatedChartId) {
    return err(400, "missing_related_chart_id", "related_chart_id is required");
  }
  const forceRefresh = body.force_refresh === true;

  // Read the saved person (RLS ensures ownership).
  const { data: person, error: personErr } = await supabase
    .from("related_charts")
    .select(
      "id, full_name, relation, gender, birth_date, birth_time, birth_time_known, birth_place_label, latitude, longitude, birth_timezone",
    )
    .eq("id", relatedChartId)
    .maybeSingle();
  if (personErr) {
    return err(500, "read_failed", personErr.message);
  }
  if (!person) {
    return err(404, "not_found", "Saved person not found");
  }

  const lat = Number(person.latitude);
  const lon = Number(person.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return err(
      422,
      "missing_coordinates",
      "This person has no birth coordinates; edit the birth place first",
    );
  }

  // Normalize the birth time (default noon when unknown, matching gateway).
  const rawTime =
    person.birth_time_known && person.birth_time ? String(person.birth_time) : "12:00:00";
  const trimmed = rawTime.slice(0, 8);
  const normalizedTime = trimmed.length === 5 ? `${trimmed}:00` : trimmed.padEnd(8, "0");
  const timezone = String(person.birth_timezone || "Asia/Kolkata");
  const datetimeUsed = isoWithOffset(String(person.birth_date), normalizedTime, timezone);
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/.test(datetimeUsed) ||
    Number.isNaN(Date.parse(datetimeUsed))
  ) {
    return err(422, "invalid_datetime", "Birth date/time is invalid");
  }

  // Deterministic input hash (mirrors chart-gateway's approach).
  const hashInput: Record<string, unknown> = {
    related_chart_id: relatedChartId,
    system: "parashara",
    ayanamsa: "lahiri",
    datetime_used: datetimeUsed,
    coordinates_used: `${lat},${lon}`,
    time_confidence: person.birth_time_known ? "high" : "low",
    engine: SWISS_ENGINE_VERSION,
    kind: "varga_bundle_v1",
  };
  const inputHash = await sha256Hex(canonicalJson(hashInput));

  // Reuse guard.
  const { data: cached } = await supabase
    .from("related_chart_artifacts")
    .select("data")
    .eq("related_chart_id", relatedChartId)
    .eq("chart_type", "varga_bundle")
    .eq("input_hash", inputHash)
    .maybeSingle();
  if (cached && !forceRefresh) {
    return json(200, { reused: true, data: cached.data });
  }

  // Compute. Any failure here is isolated to this request.
  let bundle: Record<string, unknown>;
  try {
    const natal = await computeNatalPayload(datetimeUsed, lat, lon);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const positions: any[] = (natal as any)?.data?.planet_position ?? [];

    // D1 + all 16 vargas. Key by the chart_type enum (d1_rashi ..), matching
    // the gateway's chart_jsonb.svg convention so the client can reuse the
    // exact same rendering + SVG parsing path as ChartsTab.
    const charts: Record<string, unknown> = {};
    for (const D of VARGAS) {
      const v = computeVarga(natal, D);
      const svg = renderNorthIndian({
        asc_sign: v.asc_sign,
        positions: v.positions,
      });
      charts[VARGA_TO_ENUM[D]] = {
        svg,
        chart_style: "north_indian",
        provider: "astronomy-engine",
        asc_sign: v.asc_sign,
        positions: v.positions,
      };
    }

    bundle = {
      version: "person-charts-v1",
      provider: "astronomy-engine",
      provider_version: SWISS_ENGINE_VERSION,
      related_chart_id: relatedChartId,
      person: {
        full_name: person.full_name,
        relation: person.relation,
        gender: person.gender,
        birth_date: person.birth_date,
        birth_time: person.birth_time_known ? person.birth_time : null,
        birth_time_known: person.birth_time_known,
        birth_place_label: person.birth_place_label,
        birth_timezone: timezone,
      },
      basic: basicInfo(positions),
      // Prokerala-shaped natal payload; drop-in for charts.ts normalizers.
      natal,
      charts,
    };
  } catch (e) {
    return err(500, "compute_failed", e instanceof Error ? e.message : "chart computation failed");
  }

  // Cache the bundle (best-effort; a persist failure still returns the result).
  try {
    await supabase.from("related_chart_artifacts").upsert(
      {
        related_chart_id: relatedChartId,
        chart_type: "varga_bundle",
        input_hash: inputHash,
        data: bundle,
      },
      { onConflict: "related_chart_id,chart_type,input_hash" },
    );
  } catch (persistErr) {
    console.error("[person-charts] persist threw:", persistErr);
  }

  return json(200, { reused: false, data: bundle });
});
