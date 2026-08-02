// bradley-compute — Bradley Siderograph daily engine
// v2 blueprint §5.1 (additive formula: P = X_L·L + X_D·D + X_M·M)
//
// Inputs (POST body, all optional):
//   { date: "YYYY-MM-DD" }                      → compute one specific date
//   { start_date: "...", end_date: "..." }      → range backfill (inclusive)
//   { backfill_days: N }                        → last N days ending today
//   { x_l, x_d, x_m }                           → override multipliers
// Default: today only (IST calendar date).
//
// Anchor: 12:00 UTC (classical Bradley noon-UTC convention).
// Idempotent: upsert on bradley_date. Persists multipliers per row.
// Cultural / educational feature; not investment advice.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const err = (m: string, s = 400, extra: Record<string, unknown> = {}) =>
  json({ ok: false, error: m, ...extra }, s);

// -----------------------------------------------------------
// Constants
// -----------------------------------------------------------
const AYANAMSA_J2000 = 23.85292;
// Precession + Lahiri drift per Julian century (matches steps 1-3 helpers).
function ayanamsaDeg(T: number): number {
  return AYANAMSA_J2000 + 1.3969713 * T + 0.0003086 * T * T;
}
function precessionSinceJ2000Deg(T: number): number {
  return 1.3969713 * T + 0.0003086 * T * T;
}
function norm360(x: number): number {
  const v = x % 360;
  return v < 0 ? v + 360 : v;
}
function angularSeparation(a: number, b: number): number {
  const diff = norm360(a - b);
  return diff > 180 ? 360 - diff : diff;
}

const DEG = Math.PI / 180;

type AspectDef = { name: string; angle: number; weight: number };
const ASPECTS: AspectDef[] = [
  { name: "conjunction", angle:   0, weight:  1.0 },
  { name: "sextile",     angle:  60, weight:  0.5 },
  { name: "square",      angle:  90, weight: -0.75 },
  { name: "trine",       angle: 120, weight:  0.75 },
  { name: "opposition",  angle: 180, weight: -1.0 },
];
const ORB = 15.0;
const DEC_ORB = 1.0; // Bradley's original parallel/contra-parallel orb

type BodyDef = { key: string; astro: string };
// 9 bodies: Sun through Pluto, Moon EXCLUDED (Bradley original).
const BODIES: BodyDef[] = [
  { key: "Sun",     astro: "Sun" },
  { key: "Mercury", astro: "Mercury" },
  { key: "Venus",   astro: "Venus" },
  { key: "Mars",    astro: "Mars" },
  { key: "Jupiter", astro: "Jupiter" },
  { key: "Saturn",  astro: "Saturn" },
  { key: "Uranus",  astro: "Uranus" },
  { key: "Neptune", astro: "Neptune" },
  { key: "Pluto",   astro: "Pluto" },
];

// -----------------------------------------------------------
// Astronomy helpers
// -----------------------------------------------------------
function julianCenturiesTT(A: any, date: Date): number {
  const t = A.MakeTime(date);
  // tt is TT-based Julian date; centuries from J2000.
  return (t.tt) / 36525;
}

// Tropical-of-date ecliptic longitude of a body (aberration-corrected).
function tropicalLonOfDate(A: any, body: string, date: Date, T: number, aberration: boolean): number {
  const time = A.MakeTime(date);
  const vec = A.GeoVector((A.Body as any)[body], time, aberration);
  const ecl = A.Ecliptic(vec); // J2000 ecliptic
  const lonJ2000 = ecl.elon;
  return norm360(lonJ2000 + precessionSinceJ2000Deg(T));
}

// Geocentric equatorial declination of a body in J2000 (±<1' error vs of-date; fine for Bradley).
function declinationDeg(A: any, body: string, date: Date, aberration: boolean): number {
  const time = A.MakeTime(date);
  const vec = A.GeoVector((A.Body as any)[body], time, aberration);
  const eq  = A.EquatorFromVector(vec); // J2000 equatorial { ra, dec, dist }
  return eq.dec;
}

// -----------------------------------------------------------
// Bradley core computation
// -----------------------------------------------------------
type BradleyResult = {
  bradley_date: string;
  anchor_time_utc: string;
  l_sum: number;
  d_sum: number;
  m_term: number;
  p_raw: number;
  x_l: number;
  x_d: number;
  x_m: number;
  bodies_included: string[];
  aspect_breakdown: Record<string, unknown>;
};

function computeBradley(
  A: any,
  bradleyDate: string,     // YYYY-MM-DD
  xL: number, xD: number, xM: number,
): BradleyResult {
  const anchor = new Date(`${bradleyDate}T12:00:00Z`);
  const T = julianCenturiesTT(A, anchor);

  // 1) Tropical-of-date longitudes for 9 bodies. Sun uses aberration=true; others false
  //    (matches convention in steps 1–3: Sun ab=true, other planets ab=false).
  const lons: Record<string, number> = {};
  for (const b of BODIES) {
    const ab = (b.key === "Sun");
    lons[b.key] = tropicalLonOfDate(A, b.astro, anchor, T, ab);
  }

  // 2) L: sum of aspect strengths across C(9,2)=36 pairs.
  let lSum = 0;
  const aspectHits: Array<{ a: string; b: string; aspect: string; sep: number; strength: number }> = [];
  for (let i = 0; i < BODIES.length; i++) {
    for (let j = i + 1; j < BODIES.length; j++) {
      const a = BODIES[i].key, b = BODIES[j].key;
      const sep = angularSeparation(lons[a], lons[b]);
      for (const asp of ASPECTS) {
        const delta = Math.abs(sep - asp.angle);
        if (delta <= ORB) {
          const strength = asp.weight * (1 - delta / ORB);
          lSum += strength;
          aspectHits.push({ a, b, aspect: asp.name, sep, strength });
        }
      }
    }
  }

  // 3) D: Venus + Mars declination parallel / contra-parallel.
  const decV = declinationDeg(A, "Venus", anchor, false);
  const decM = declinationDeg(A, "Mars",  anchor, false);
  let dSum = 0;
  if (Math.sign(decV) === Math.sign(decM) || decV === 0 || decM === 0) {
    // Parallel candidate (same sign)
    const diff = Math.abs(decV - decM);
    if (diff <= DEC_ORB) dSum += 1.0 * (1 - diff / DEC_ORB);
  }
  {
    // Contra-parallel candidate (opposite sign): sum ≈ 0
    const sum = Math.abs(decV + decM);
    if (sum <= DEC_ORB && Math.sign(decV) !== Math.sign(decM)) {
      dSum += -1.0 * (1 - sum / DEC_ORB);
    }
  }

  // 4) M: semi-annual seasonal term based on Sun tropical longitude.
  //    M = 20 · sin(2·(λ_sun − 285°))
  const sunLon = lons["Sun"];
  const mTerm = 20 * Math.sin(2 * (sunLon - 285) * DEG);

  // 5) P = X_L·L + X_D·D + X_M·M
  const pRaw = xL * lSum + xD * dSum + xM * mTerm;

  return {
    bradley_date: bradleyDate,
    anchor_time_utc: anchor.toISOString(),
    l_sum: lSum,
    d_sum: dSum,
    m_term: mTerm,
    p_raw: pRaw,
    x_l: xL, x_d: xD, x_m: xM,
    bodies_included: BODIES.map((b) => b.key),
    aspect_breakdown: {
      longitudes_deg: lons,
      venus_declination_deg: decV,
      mars_declination_deg: decM,
      aspect_hits: aspectHits,
    },
  };
}

// -----------------------------------------------------------
// Date helpers
// -----------------------------------------------------------
function istTodayDate(): string {
  const nowUtcMs = Date.now();
  return new Date(nowUtcMs + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
}
function addDaysISO(dateStr: string, delta: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}
function isValidISODate(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(`${s}T00:00:00Z`).getTime());
}

// -----------------------------------------------------------
// Handler
// -----------------------------------------------------------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return err("Use POST", 405);

  const URL_ = Deno.env.get("SUPABASE_URL");
  const KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!URL_ || !KEY) return err("Missing Supabase env", 500);

  // Optional shared secret
  const secret = Deno.env.get("BRADLEY_CRON_SECRET") || Deno.env.get("MARKET_CRON_SECRET");
  if (secret && (req.headers.get("x-cron-secret") || "") !== secret) {
    return err("Bad or missing x-cron-secret", 401);
  }

  // Parse body
  let body: any = {};
  try { body = await req.json(); } catch { /* empty ok */ }

  const xL = Number.isFinite(Number(body?.x_l)) ? Number(body.x_l) : 1.0;
  const xD = Number.isFinite(Number(body?.x_d)) ? Number(body.x_d) : 10.0;
  const xM = Number.isFinite(Number(body?.x_m)) ? Number(body.x_m) : 1.0;

  // Build date list
  const dates: string[] = [];
  if (isValidISODate(body?.date)) {
    dates.push(body.date);
  } else if (isValidISODate(body?.start_date) && isValidISODate(body?.end_date)) {
    let cur = body.start_date;
    let safety = 0;
    while (cur <= body.end_date && safety < 20000) {
      dates.push(cur);
      cur = addDaysISO(cur, 1);
      safety++;
    }
  } else if (Number.isFinite(Number(body?.backfill_days)) && Number(body.backfill_days) > 0) {
    const n = Math.min(20000, Math.floor(Number(body.backfill_days)));
    const today = istTodayDate();
    for (let i = n - 1; i >= 0; i--) dates.push(addDaysISO(today, -i));
  } else {
    dates.push(istTodayDate());
  }

  if (dates.length === 0) return err("No dates to compute", 400);

  // Load astronomy-engine
  let A: any;
  try {
    A = await import("https://esm.sh/astronomy-engine@2.1.19");
  } catch (e) {
    return err("Failed to load astronomy-engine: " + String(e), 500);
  }

  // Compute all dates in-memory
  const rows: any[] = [];
  const perDayErrors: Record<string, string> = {};
  const t0 = Date.now();
  for (const d of dates) {
    try {
      const r = computeBradley(A, d, xL, xD, xM);
      rows.push({
        bradley_date: r.bradley_date,
        anchor_time_utc: r.anchor_time_utc,
        l_sum: r.l_sum,
        d_sum: r.d_sum,
        m_term: r.m_term,
        p_raw: r.p_raw,
        x_l: r.x_l, x_d: r.x_d, x_m: r.x_m,
        bodies_included: r.bodies_included,
        aspect_breakdown: r.aspect_breakdown,
        source: "astronomy-engine",
      });
    } catch (e) {
      perDayErrors[d] = String((e as Error)?.message ?? e);
    }
  }
  const computeMs = Date.now() - t0;

  // Batch upsert (chunks of 500 to stay under PostgREST payload limits)
  const svc = createClient(URL_, KEY);
  const CHUNK = 500;
  let upserted = 0;
  const upsertErrors: string[] = [];
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { error: upErr } = await svc
      .from("bradley_siderograph_daily")
      .upsert(chunk, { onConflict: "bradley_date" });
    if (upErr) upsertErrors.push(`chunk ${i}-${i + chunk.length}: ${upErr.message}`);
    else upserted += chunk.length;
  }

  // Audit (best-effort)
  try {
    await svc.from("astrology_provider_runs").insert({
      provider: "astronomy-engine",
      endpoint: "bradley-compute",
      input_hash: `dates=${dates.length};xL=${xL};xD=${xD};xM=${xM}`,
      http_status: 200,
      success: upsertErrors.length === 0,
      cost_units: 0,
    });
  } catch { /* ignore */ }

  // Response: include latest computed row for quick verification.
  const latest = rows.length > 0 ? rows[rows.length - 1] : null;
  return json({
    ok: true,
    datesRequested: dates.length,
    rowsComputed: rows.length,
    rowsUpserted: upserted,
    computeMs,
    multipliers: { x_l: xL, x_d: xD, x_m: xM },
    perDayErrors: Object.keys(perDayErrors).length ? perDayErrors : undefined,
    upsertErrors: upsertErrors.length ? upsertErrors : undefined,
    latest: latest ? {
      bradley_date: latest.bradley_date,
      l_sum: latest.l_sum,
      d_sum: latest.d_sum,
      m_term: latest.m_term,
      p_raw: latest.p_raw,
    } : null,
  });
});
