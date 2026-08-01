// Supabase Edge Function: chart-gateway
// Returns any of 16 Vedic divisional (varga) charts from Prokerala and
// persists results to chart_artifacts + astrology_provider_runs.
//
// Runtime: Deno (Supabase Edge Functions).

// @ts-ignore - Deno std import (resolved at deploy time)
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
// @ts-ignore - esm.sh import (resolved at deploy time)
import {
  createClient,
  type SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { computeVimshottariDashaPayload } from "./vimshottari.ts";
import { computeMangalDoshaPayload } from "./mangal.ts";
import { computeKaalSarpDoshaPayload } from "./kaalsarp.ts";
import {
  computeAshtakavargaPayload,
  computeSarvashtakavargaPayload,
} from "./ashtakavarga.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const Deno: any;

// ---------- CORS ----------
const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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

// ---------- Chart type mapping (our enum -> Prokerala slug) ----------
const PROKERALA_CHART_SLUG: Record<string, string> = {
  d1_rashi: "rasi",
  d2_hora: "hora",
  d3_drekkana: "drekkana",
  d4_chaturthamsha: "chaturthamsa",
  d7_saptamsha: "saptamsa",
  d9_navamsha: "navamsa",
  d10_dashamsha: "dasamsa",
  d12_dwadashamsha: "dwadasamsa",
  d16_shodashamsha: "shodasamsa",
  d20_vimshamsha: "vimsamsa",
  d24_chaturvimshamsha: "chaturvimsamsa",
  d27_bhamsha: "saptavimsamsa",
  d30_trimshamsha: "trimsamsa",
  d40_khavedamsha: "khavedamsa",
  d45_akshavedamsha: "akshavedamsa",
  d60_shashtiamsha: "shashtyamsa",
};

const ALLOWED_STYLES = new Set(["north_indian", "south_indian", "east_indian"]);

// ---------- Utilities ----------

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Canonical JSON with sorted keys (deterministic).
function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return "[" + value.map(canonicalJson).join(",") + "]";
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return (
    "{" +
    keys.map((k) => JSON.stringify(k) + ":" + canonicalJson(obj[k])).join(",") +
    "}"
  );
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

// Build IANA-timezone-aware ISO-8601 string with offset, from a local
// (date, time, tz) triple. Uses Intl to resolve the offset for that instant.
function isoWithOffset(
  dateStr: string,
  timeStr: string,
  timeZone: string,
): string {
  // Interpret local wall-clock as if it were UTC to derive a candidate instant,
  // then compute the tz offset at that instant and correct.
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm, ss] = timeStr.split(":").map((v) => Number(v || 0));
  const asUTC = Date.UTC(y, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0, ss ?? 0);
  const offsetMin = tzOffsetMinutes(new Date(asUTC), timeZone);
  const instant = new Date(asUTC - offsetMin * 60_000);
  // Format offset
  const sign = offsetMin >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMin);
  const oh = String(Math.floor(abs / 60)).padStart(2, "0");
  const om = String(abs % 60).padStart(2, "0");
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  // Re-format from the local wall-clock (not the UTC instant) to preserve intent.
  const local = `${y}-${pad(m)}-${pad(d)}T${pad(hh ?? 0)}:${pad(mm ?? 0)}:${pad(ss ?? 0)}`;
  void instant;
  return `${local}${sign}${oh}:${om}`;
}

function tzOffsetMinutes(date: Date, timeZone: string): number {
  // Use Intl to extract the wall-clock in the target tz, diff vs UTC ms.
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf
    .formatToParts(date)
    .reduce<Record<string, string>>((acc, p) => {
      if (p.type !== "literal") acc[p.type] = p.value;
      return acc;
    }, {});
  const asUTC = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour === "24" ? "00" : parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return Math.round((asUTC - date.getTime()) / 60_000);
}

// ---------- Handler ----------

// ===================================================================================
// Phase 0 local sidereal engine — astronomy-engine, Lahiri/Chitrapaksha ayanamsa,
// Parasara. Validated 2026-07-28 against 4 reference charts (40 bodies) to <0.01 deg.
// Loaded via DYNAMIC import so a resolve/runtime failure can NEVER break the
// Prokerala path: the caller catches and falls back to Prokerala on any error.
// Only used for the natal planet-position resource, and only when the engine flag
// is set to "swiss". Default remains Prokerala.
// ===================================================================================
const SWISS_ENGINE_VERSION = "astronomy-engine@2.1.19+lahiri-v1";
const AYANAMSA_J2000 = 23.85292; // Lahiri ayanamsa at J2000.0 (degrees)

const ENG_SIGNS = [
  "Aries",
  "Taurus",
  "Gemini",
  "Cancer",
  "Leo",
  "Virgo",
  "Libra",
  "Scorpio",
  "Sagittarius",
  "Capricorn",
  "Aquarius",
  "Pisces",
];
// Sign lords (Parasara), 0 = Aries .. 11 = Pisces.
const ENG_SIGN_LORDS = [
  "Mars",
  "Venus",
  "Mercury",
  "Moon",
  "Sun",
  "Mercury",
  "Venus",
  "Mars",
  "Jupiter",
  "Saturn",
  "Saturn",
  "Jupiter",
];

const eNorm360 = (x: number): number => ((x % 360) + 360) % 360;
const eNorm180 = (x: number): number => {
  const v = eNorm360(x);
  return v > 180 ? v - 360 : v;
};
const eD2r = (d: number): number => (d * Math.PI) / 180;
const eR2d = (r: number): number => (r * 180) / Math.PI;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function eJulianCenturiesTT(A: any, date: Date): number {
  return A.MakeTime(date).tt / 36525;
}
function ePrecessionSinceJ2000(T: number): number {
  return 1.3969713 * T + 0.0003086 * T * T;
}
function eAyanamsaDeg(T: number): number {
  return AYANAMSA_J2000 + ePrecessionSinceJ2000(T);
}
function eMeanObliquity(T: number): number {
  return (
    23.4392911 -
    0.0130041667 * T -
    1.638889e-7 * T * T +
    5.036111e-7 * T * T * T
  );
}
// astronomy-engine Ecliptic() returns ecliptic-of-date longitude, so we subtract
// the of-date ayanamsa for EVERY body (validated fix).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function eEclipticLonOfDate(
  A: any,
  body: any,
  date: Date,
  aberration: boolean,
): number {
  const vec = A.GeoVector(body, date, aberration);
  const ecl = A.Ecliptic(vec);
  return eNorm360(ecl.elon);
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function eSiderealLonOfBody(
  A: any,
  body: any,
  date: Date,
  aberration: boolean,
  T: number,
): number {
  return eNorm360(eEclipticLonOfDate(A, body, date, aberration) - eAyanamsaDeg(T));
}
function eMeanNodeOfDate(T: number): number {
  const om =
    125.0445479 -
    1934.1362891 * T +
    0.0020754 * T * T +
    (T * T * T) / 467441 -
    (T * T * T * T) / 60616000;
  return eNorm360(om);
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function eIsRetrograde(
  A: any,
  body: any,
  date: Date,
  aberration: boolean,
): boolean {
  const l1 = eEclipticLonOfDate(A, body, date, aberration);
  const later = new Date(date.getTime() + 3600 * 1000);
  const l2 = eEclipticLonOfDate(A, body, later, aberration);
  return eNorm180(l2 - l1) < 0;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function eSiderealAscendant(
  A: any,
  date: Date,
  latDeg: number,
  lonDeg: number,
  T: number,
): number {
  const gastHours = A.SiderealTime(date); // Greenwich apparent sidereal time (hours)
  const ramc = eNorm360(gastHours * 15 + lonDeg);
  const eps = eMeanObliquity(T);
  const R = eD2r(ramc);
  const E = eD2r(eps);
  const P = eD2r(latDeg);
  const mc = eNorm360(eR2d(Math.atan2(Math.sin(R), Math.cos(R) * Math.cos(E))));
  let asc = eNorm360(
    eR2d(
      Math.atan2(
        Math.cos(R),
        -(Math.sin(R) * Math.cos(E) + Math.tan(P) * Math.sin(E)),
      ),
    ),
  );
  // Keep the ascendant on the eastern horizon (MC-based 180 deg guard).
  if (eNorm360(asc - mc) > 180) asc = eNorm360(asc + 180);
  return eNorm360(asc - eAyanamsaDeg(T));
}

// Build one Prokerala-shaped body entry from a sidereal longitude.
function eBody(id: number, name: string, sidLon: number, retro: boolean) {
  const L = eNorm360(sidLon);
  const signIndex = Math.floor(L / 30);
  const degInSign = L - signIndex * 30;
  return {
    id,
    name,
    longitude: L,
    degree: degInSign,
    is_retrograde: retro,
    position: signIndex + 1,
    rasi: {
      id: signIndex,
      name: ENG_SIGNS[signIndex],
      lord: {
        name: ENG_SIGN_LORDS[signIndex],
        vedic_name: ENG_SIGN_LORDS[signIndex],
      },
    },
  };
}

// Compute a natal planet-position payload in the exact shape Prokerala returns,
// so it is a drop-in for both the web app (charts.ts) and astrologer-chat.
async function computeNatalPayload(
  datetimeUsed: string,
  lat: number,
  lon: number,
): Promise<unknown> {
  // Dynamic import isolates any load failure to the swiss path only.
  // @ts-ignore esm.sh import resolved at deploy/runtime
  const A: any = await import("https://esm.sh/astronomy-engine@2.1.19");
  const date = new Date(datetimeUsed);
  if (Number.isNaN(date.getTime())) {
    throw new Error("invalid datetime for swiss engine");
  }
  const T = eJulianCenturiesTT(A, date);

  const grahas = [
    { id: 0, name: "Sun", body: A.Body.Sun, ab: true, canRetro: false },
    { id: 1, name: "Moon", body: A.Body.Moon, ab: false, canRetro: false },
    { id: 2, name: "Mercury", body: A.Body.Mercury, ab: true, canRetro: true },
    { id: 3, name: "Venus", body: A.Body.Venus, ab: true, canRetro: true },
    { id: 4, name: "Mars", body: A.Body.Mars, ab: true, canRetro: true },
    { id: 5, name: "Jupiter", body: A.Body.Jupiter, ab: true, canRetro: true },
    { id: 6, name: "Saturn", body: A.Body.Saturn, ab: true, canRetro: true },
  ];

  const planet_position: unknown[] = [];
  for (const g of grahas) {
    const sid = eSiderealLonOfBody(A, g.body, date, g.ab, T);
    const retro = g.canRetro ? eIsRetrograde(A, g.body, date, g.ab) : false;
    planet_position.push(eBody(g.id, g.name, sid, retro));
  }
  // Rahu (mean node, always retrograde) + Ketu (opposite).
  const rahu = eNorm360(eMeanNodeOfDate(T) - eAyanamsaDeg(T));
  planet_position.push(eBody(101, "Rahu", rahu, true));
  planet_position.push(eBody(102, "Ketu", eNorm360(rahu + 180), true));
  // Ascendant (Lagna).
  const asc = eSiderealAscendant(A, date, lat, lon, T);
  planet_position.push(eBody(100, "Ascendant", asc, false));

  return {
    status: "ok",
    provider: "astronomy-engine",
    provider_version: SWISS_ENGINE_VERSION,
    ayanamsa: "lahiri",
    system: "parashara",
    computed_utc: date.toISOString(),
    data: { planet_position },
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
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const PROKERALA_CLIENT_ID = Deno.env.get("PROKERALA_CLIENT_ID");
  const PROKERALA_CLIENT_SECRET = Deno.env.get("PROKERALA_CLIENT_SECRET");

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return err(500, "server_misconfigured", "Supabase env missing");
  }
  if (!PROKERALA_CLIENT_ID || !PROKERALA_CLIENT_SECRET) {
    return err(500, "server_misconfigured", "Prokerala credentials missing");
  }

  // Parse body
  let body: {
    chart_type?: string;
    chart_style?: string;
    force_refresh?: boolean;
    resource?: string;
    report_type?: string;
    provider_params?: Record<string, unknown>;
    engine?: string;
    dasha_year_days?: number | string;
    gender?: string;
  };
  try {
    body = await req.json();
  } catch {
    return err(400, "invalid_json", "Request body must be valid JSON");
  }

  const resource = String(body.resource ?? "chart");
  if (
    resource !== "chart" &&
    resource !== "planets" &&
    resource !== "report" &&
    resource !== "numerology" &&
    resource !== "lo_shu"
  ) {
    return err(
      400,
      "unsupported_resource",
      `Unsupported resource: ${resource}`,
    );
  }
  const isPlanets = resource === "planets";
  const isReport = resource === "report";
  const isNumerology = resource === "numerology";
  const isLoShu = resource === "lo_shu";
  const isJson = isPlanets || isReport;

  // Report registry: our report_type -> Prokerala slug + storage chart_type enum.
  // Multiple reports can share one chart_type enum (e.g. the dosha family), so
  // report_type + report_params are folded into the input hash below to keep
  // their caches distinct.
  const REPORT_CONFIG: Record<
    string,
    { slug: string; chartType: string; needsPlanet?: boolean }
  > = {
    vimshottari_dasha: {
      slug: "dasha-periods",
      chartType: "vimshottari_dasha",
    },
    mangal_dosha: { slug: "mangal-dosha", chartType: "doshas" },
    kaal_sarp_dosha: { slug: "kaal-sarp-dosha", chartType: "doshas" },
    ashtakavarga: {
      slug: "ashtakavarga",
      chartType: "ashtakavarga",
      needsPlanet: true,
    },
    sarvashtakavarga: { slug: "sarvashtakavarga", chartType: "ashtakavarga" },
  };

  const reportType = isReport ? String(body.report_type ?? "") : "";
  const reportConfig = isReport ? REPORT_CONFIG[reportType] : undefined;
  const reportSlug = reportConfig?.slug ?? "";
  if (isReport && !reportConfig) {
    return err(
      400,
      "unsupported_report_type",
      `Unsupported report_type: ${reportType}`,
    );
  }

  // Optional passthrough params for provider tuning/discovery (reports only),
  // e.g. { planet: "0", chart_type: "south-indian", advanced: "true" }.
  const reportParams: Record<string, string> = {};
  if (
    isReport &&
    body.provider_params &&
    typeof body.provider_params === "object"
  ) {
    for (const [k, v] of Object.entries(body.provider_params)) {
      if (v !== undefined && v !== null) reportParams[String(k)] = String(v);
    }
  }
  if (
    isReport &&
    reportConfig?.needsPlanet &&
    reportParams.planet === undefined
  ) {
    return err(
      400,
      "planet_required",
      `report_type ${reportType} requires provider_params.planet (0-6)`,
    );
  }

  const chartType = isPlanets
    ? "natal"
    : isReport
      ? reportConfig!.chartType
      : isNumerology
        ? "numerology"
        : isLoShu
          ? "lo_shu"
          : String(body.chart_type ?? "");
  const chartStyle = String(body.chart_style ?? "north_indian");
  const forceRefresh = body.force_refresh === true;

  // Positions-engine selector. Default "prokerala" keeps live behavior unchanged.
  // Set request body { engine: "swiss" } or env CHART_ENGINE=swiss to use the
  // local astronomy-engine. Only the natal planet-position resource is wired.
  const engine = String(
    body.engine ?? Deno.env.get("CHART_ENGINE") ?? "prokerala",
  ).toLowerCase();
  const useSwiss = engine === "swiss" && isPlanets;
  // Vimshottari dasha swiss path. Independently gated so it can be enabled
  // without touching the natal gate, and vice versa. Default: off.
  const useSwissDasha =
    engine === "swiss" && isReport && reportType === "vimshottari_dasha";
  // Doshas swiss path. Same independent-gate discipline as the dasha branch:
  // opt-in, resilient, any compute error falls through to Prokerala. Default: off.
  const useSwissDosha =
    engine === "swiss" &&
    isReport &&
    (reportType === "mangal_dosha" || reportType === "kaal_sarp_dosha");
  // Ashtakavarga swiss path. Same independent-gate discipline. Default: off.
  const useSwissAshtakavarga =
    engine === "swiss" &&
    isReport &&
    (reportType === "ashtakavarga" || reportType === "sarvashtakavarga");

  const slug =
    isJson || isNumerology || isLoShu ? "" : PROKERALA_CHART_SLUG[chartType];
  if (!isJson && !isNumerology && !isLoShu) {
    if (!slug) {
      return err(
        400,
        "unsupported_chart_type",
        `Unsupported chart_type: ${chartType}`,
      );
    }
    if (!ALLOWED_STYLES.has(chartStyle)) {
      return err(
        400,
        "unsupported_chart_type",
        `Unsupported chart_style: ${chartStyle}`,
      );
    }
  }

  // Auth client (caller identity via forwarded Authorization header)
  const authHeader = req.headers.get("Authorization") ?? "";
  const authClient: SupabaseClient = createClient(SUPABASE_URL, SERVICE_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userErr } = await authClient.auth.getUser();
  if (userErr || !userData?.user) {
    return err(401, "not_authenticated");
  }
  const userId = userData.user.id;

  // Service-role client (bypasses RLS)
  const svc: SupabaseClient = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Load the birth profile FIRST and derive readiness from the ACTUAL birth
  // data, not from a separate profiles.onboarding_state flag. New users whose
  // flag was never flipped to "ready" (missing profiles row, or a writer that
  // didn't run) must NOT be locked out when their birth data is present. Each
  // resource below still enforces its own specific field requirements.
  const { data: birth } = await svc
    .from("birth_profiles")
    .select(
      "id, full_name, birth_date, birth_time, birth_time_known, birth_place_label, birth_timezone, latitude, longitude, gender",
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (!birth || !birth.birth_date) {
    return err(409, "birth_profile_incomplete");
  }

  // Best-effort self-heal: if birth data exists but the onboarding flag wasn't
  // set, flip it so the rest of the app stays consistent. Non-blocking — chart
  // generation must never depend on this succeeding.
  try {
    await svc
      .from("profiles")
      .upsert(
        { user_id: userId, onboarding_state: "ready" },
        { onConflict: "user_id" },
      );
  } catch (_) {
    // ignore — resilience only
  }
  // ---------- Numerology (deterministic; no geocoding/provider) ----------
  if (isNumerology) {
    if (!birth || !birth.birth_date) {
      return err(409, "birth_profile_incomplete");
    }
    const fullName = String(birth.full_name ?? "").trim();
    if (!fullName) {
      return err(409, "name_missing", "Full name is required for numerology");
    }

    const PYTHAGOREAN: Record<string, number> = {
      A: 1,
      B: 2,
      C: 3,
      D: 4,
      E: 5,
      F: 6,
      G: 7,
      H: 8,
      I: 9,
      J: 1,
      K: 2,
      L: 3,
      M: 4,
      N: 5,
      O: 6,
      P: 7,
      Q: 8,
      R: 9,
      S: 1,
      T: 2,
      U: 3,
      V: 4,
      W: 5,
      X: 6,
      Y: 7,
      Z: 8,
    };
    const CHALDEAN: Record<string, number> = {
      A: 1,
      I: 1,
      J: 1,
      Q: 1,
      Y: 1,
      B: 2,
      K: 2,
      R: 2,
      C: 3,
      G: 3,
      L: 3,
      S: 3,
      D: 4,
      M: 4,
      T: 4,
      E: 5,
      H: 5,
      N: 5,
      X: 5,
      U: 6,
      V: 6,
      W: 6,
      O: 7,
      Z: 7,
      F: 8,
      P: 8,
    };
    const VOWELS = new Set(["A", "E", "I", "O", "U"]);
    const MASTERS = new Set([11, 22, 33]);

    const reduceSteps = (
      n: number,
      keepMasters: boolean,
    ): { value: number; steps: string[] } => {
      const steps: string[] = [];
      let cur = n;
      while (cur > 9 && !(keepMasters && MASTERS.has(cur))) {
        const ds = String(cur).split("");
        const next = ds.reduce((a, d) => a + Number(d), 0);
        steps.push(`${ds.join(" + ")} = ${next}`);
        cur = next;
      }
      return { value: cur, steps };
    };

    const NUM = (raw: number, keepMasters: boolean, meaning: string) => {
      const { value, steps } = reduceSteps(raw, keepMasters);
      return {
        number: value,
        is_master: MASTERS.has(value),
        total: raw,
        reduction: steps.length ? steps.join(" \u2192 ") : String(raw),
        meaning,
      };
    };

    const cleanLetters = fullName.toUpperCase().replace(/[^A-Z]/g, "");
    const letterSum = (
      map: Record<string, number>,
      filter: (ch: string) => boolean,
    ): number => {
      let s = 0;
      for (const ch of cleanLetters) {
        if (!filter(ch)) continue;
        s += map[ch] ?? 0;
      }
      return s;
    };

    const bd = Number(String(birth.birth_date).slice(0, 10).split("-")[2]);
    const bm = Number(String(birth.birth_date).slice(0, 10).split("-")[1]);
    const dobDigits = String(birth.birth_date)
      .slice(0, 10)
      .replace(/[^0-9]/g, "");
    const destinyTotal = dobDigits.split("").reduce((a, d) => a + Number(d), 0);

    const tzForYear = (birth.birth_timezone as string | null) ?? "Asia/Kolkata";
    const nowYear = Number(
      new Intl.DateTimeFormat("en-US", {
        timeZone: tzForYear,
        year: "numeric",
      }).format(new Date()),
    );
    const personalYearTotal = (String(bm) + String(bd) + String(nowYear))
      .split("")
      .reduce((a, d) => a + Number(d), 0);

    const driver = NUM(
      bd,
      false,
      "Your core nature and how you instinctively approach life.",
    );
    const destiny = NUM(
      destinyTotal,
      true,
      "Your life's purpose and the path you are here to walk.",
    );
    const birthday = {
      number: bd,
      is_master: false,
      total: bd,
      reduction: String(bd),
      meaning: "A special talent or gift you were born with.",
    };
    const personal_year = {
      ...NUM(
        personalYearTotal,
        false,
        "The dominant theme and energy of your current year.",
      ),
      year: nowYear,
    };

    const nameSet = (map: Record<string, number>) => {
      const expression = NUM(
        letterSum(map, () => true),
        true,
        "How you naturally express your talents to the world.",
      );
      const soul_urge = NUM(
        letterSum(map, (ch) => VOWELS.has(ch)),
        true,
        "Your inner desires and what your heart truly longs for.",
      );
      const personality = NUM(
        letterSum(map, (ch) => !VOWELS.has(ch)),
        true,
        "The first impression and outer self others perceive.",
      );
      const maturity = NUM(
        destiny.number + expression.number,
        true,
        "The direction and goal your life moves toward with age.",
      );
      return { expression, soul_urge, personality, maturity };
    };

    const numerologyData = {
      input: {
        full_name: fullName,
        birth_date: String(birth.birth_date).slice(0, 10),
      },
      systems_note:
        "Master numbers 11, 22, 33 are preserved. Driver and Personal Year reduce to a single digit (1-9).",
      driver,
      destiny,
      birthday,
      personal_year,
      pythagorean: nameSet(PYTHAGOREAN),
      chaldean: nameSet(CHALDEAN),
    };

    const numCanonical = canonicalJson({
      user_id: userId,
      chart_type: "numerology",
      full_name: fullName,
      birth_date: String(birth.birth_date).slice(0, 10),
      numerology_year: nowYear,
    });
    const numHash = await sha256Hex(numCanonical);

    const { data: numExisting } = await svc
      .from("chart_artifacts")
      .select("id, chart_jsonb")
      .eq("user_id", userId)
      .eq("chart_type", "numerology")
      .eq("input_hash", numHash)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (numExisting && !forceRefresh) {
      return json(200, {
        resource: "numerology",
        reused: true,
        artifact_id: numExisting.id,
        data: numExisting.chart_jsonb,
      });
    }

    const { data: numInserted, error: numErr } = await svc
      .from("chart_artifacts")
      .upsert(
        {
          user_id: userId,
          birth_profile_id: birth.id,
          chart_type: "numerology",
          input_hash: numHash,
          provider: "internal",
          provider_version: "num-v1",
          chart_jsonb: numerologyData,
          supersedes_id: null,
        },
        { onConflict: "user_id,chart_type,input_hash" },
      )
      .select("id")
      .single();

    if (numErr || !numInserted) {
      return err(
        500,
        "persist_failed",
        numErr?.message ?? "Could not save numerology",
      );
    }

    return json(200, {
      resource: "numerology",
      reused: false,
      artifact_id: numInserted.id,
      data: numerologyData,
    });
  }

  // ---------- Lo Shu Grid (deterministic; no geocoding/provider) ----------
  if (isLoShu) {
    if (!birth || !birth.birth_date) {
      return err(409, "birth_profile_incomplete");
    }

    const isoDate = String(birth.birth_date).slice(0, 10);
    const bd = Number(isoDate.split("-")[2]);
    const dobDigits = isoDate.replace(/[^0-9]/g, "");

    // Reduce a number to a single digit 1-9 (Lo Shu keeps no master numbers).
    const reduceOne = (n: number): number => {
      let cur = n;
      while (cur > 9) {
        cur = String(cur)
          .split("")
          .reduce((a, d) => a + Number(d), 0);
      }
      return cur;
    };

    const driverNum = reduceOne(bd);
    const destinyNum = reduceOne(
      dobDigits.split("").reduce((a, d) => a + Number(d), 0),
    );

    // Standard Vedic Lo Shu: the grid is built from the DOB digits PLUS the
    // Driver (Mulank) and Conductor (Bhagyank) numbers. 0 has no cell.
    const addedToGrid = [driverNum, destinyNum];
    const gridDigits = dobDigits + addedToGrid.join("");

    const emptyCounts = (): Record<string, number> => ({
      "1": 0,
      "2": 0,
      "3": 0,
      "4": 0,
      "5": 0,
      "6": 0,
      "7": 0,
      "8": 0,
      "9": 0,
    });

    // Raw date-of-birth-only counts, kept for reference/transparency.
    const countsDob = emptyCounts();
    for (const ch of dobDigits) {
      if (ch === "0") continue;
      countsDob[ch] = (countsDob[ch] ?? 0) + 1;
    }

    // Combined counts (DOB + driver + conductor) drive the grid, present/
    // missing lists and arrows.
    const counts = emptyCounts();
    for (const ch of gridDigits) {
      if (ch === "0") continue;
      counts[ch] = (counts[ch] ?? 0) + 1;
    }

    const MEANINGS: Record<string, string> = {
      "1": "Self-expression, communication, and career drive.",
      "2": "Intuition, sensitivity, and harmony in relationships.",
      "3": "Imagination, memory, and creative intelligence.",
      "4": "Discipline, order, and practical skill.",
      "5": "Balance, willpower, and emotional stability (the centre).",
      "6": "Nurturing, home, and material or creative care.",
      "7": "Patience, spirituality, and learning through experience.",
      "8": "Method, hard work, and handling of money and matter.",
      "9": "Ambition, intellect, humanity, and recognition.",
    };

    const PLANETS: Record<string, string> = {
      "1": "Sun (Surya)",
      "2": "Moon (Chandra)",
      "3": "Jupiter (Guru)",
      "4": "Rahu",
      "5": "Mercury (Budha)",
      "6": "Venus (Shukra)",
      "7": "Ketu",
      "8": "Saturn (Shani)",
      "9": "Mars (Mangala)",
    };

    const ELEMENTS: Record<string, string> = {
      "1": "Water",
      "2": "Earth",
      "3": "Wood",
      "4": "Wood",
      "5": "Earth",
      "6": "Metal",
      "7": "Metal",
      "8": "Earth",
      "9": "Fire",
    };

    // Fixed Lo Shu positions, rendered top row to bottom row.
    const LAYOUT = [
      [4, 9, 2],
      [3, 5, 7],
      [8, 1, 6],
    ];
    const grid = LAYOUT.map((row) =>
      row.map((n) => {
        const key = String(n);
        const c = counts[key] ?? 0;
        return {
          number: n,
          count: c,
          digits: c > 0 ? key.repeat(c) : "",
          planet: PLANETS[key],
          element: ELEMENTS[key],
          meaning: MEANINGS[key],
        };
      }),
    );

    const present: number[] = [];
    const missing: number[] = [];
    const repeated: number[] = [];
    for (let n = 1; n <= 9; n++) {
      const c = counts[String(n)] ?? 0;
      if (c > 0) present.push(n);
      else missing.push(n);
      if (c >= 2) repeated.push(n);
    }

    // Count-aware interpretation of repeated (intensified) numbers.
    const repeatedDetails = repeated.map((n) => {
      const c = counts[String(n)] ?? 0;
      const level = c >= 4 ? "excessive" : c === 3 ? "very strong" : "strong";
      const note =
        c >= 4
          ? `Number ${n} appears ${c} times — its energy is excessive and needs conscious balancing.`
          : c === 3
            ? `Number ${n} appears three times — a very strong, dominant trait.`
            : `Number ${n} appears twice — a strong, well-developed trait.`;
      return {
        number: n,
        count: c,
        digits: String(n).repeat(c),
        level,
        note,
        meaning: MEANINGS[String(n)],
      };
    });

    // Rows, columns and diagonals. A fully-present line is an "arrow of
    // strength"; a fully-absent line is an "arrow of weakness".
    const LINES: {
      name: string;
      numbers: number[];
      strength: string;
      weakness: string;
    }[] = [
      {
        name: "Arrow of Intellect",
        numbers: [4, 9, 2],
        strength: "Sharp analytical mind, good memory and strong reasoning.",
        weakness: "Scattered thinking or poor memory; train focus and recall.",
      },
      {
        name: "Arrow of Emotional Balance",
        numbers: [3, 5, 7],
        strength: "Emotional stability, patience and inner harmony.",
        weakness: "Sensitivity and mood swings; needs grounding and calm.",
      },
      {
        name: "Arrow of Practicality",
        numbers: [8, 1, 6],
        strength: "Grounded, hands-on and well organised in daily life.",
        weakness: "Ideas struggle to become action; build practical routines.",
      },
      {
        name: "Arrow of Planning",
        numbers: [4, 3, 8],
        strength: "Excellent planner — orderly, methodical and structured.",
        weakness: "Disorganisation and procrastination; needs clear structure.",
      },
      {
        name: "Arrow of Will & Determination",
        numbers: [9, 5, 1],
        strength: "Strong willpower, determination and drive to succeed.",
        weakness: "Easily discouraged; consciously build resolve and focus.",
      },
      {
        name: "Arrow of Activity",
        numbers: [2, 7, 6],
        strength: "Energetic, active and physically capable.",
        weakness: "Lethargy or restlessness; needs a steady routine.",
      },
      {
        name: "Arrow of Prosperity (Golden Yoga)",
        numbers: [4, 5, 6],
        strength: "Natural pull toward wealth, success and stability.",
        weakness: "Financial ups and downs; wealth needs conscious effort.",
      },
      {
        name: "Arrow of Spirituality (Silver Yoga)",
        numbers: [2, 5, 8],
        strength: "Compassion, spirituality and intuitive wisdom.",
        weakness: "Scepticism or detachment; nurture an inner practice.",
      },
    ];
    const arrows = LINES.flatMap((line) => {
      const allPresent = line.numbers.every(
        (n) => (counts[String(n)] ?? 0) > 0,
      );
      const allAbsent = line.numbers.every(
        (n) => (counts[String(n)] ?? 0) === 0,
      );
      if (allPresent)
        return [
          {
            type: "strength",
            name: line.name,
            numbers: line.numbers,
            meaning: line.strength,
          },
        ];
      if (allAbsent)
        return [
          {
            type: "weakness",
            name: line.name,
            numbers: line.numbers,
            meaning: line.weakness,
          },
        ];
      return [];
    });

    // Remedies for each missing number: ruling planet, colour, mantra,
    // direction and a simple practice.
    const REMEDIES: Record<
      string,
      { colour: string; mantra: string; direction: string; practice: string }
    > = {
      "1": {
        colour: "Orange / Gold",
        mantra: "Om Suryaya Namah",
        direction: "East",
        practice:
          "Offer water to the Sun at sunrise; build confident self-expression.",
      },
      "2": {
        colour: "White / Silver",
        mantra: "Om Chandraya Namah",
        direction: "North-West",
        practice: "Nurture close relationships; practise calming meditation.",
      },
      "3": {
        colour: "Yellow",
        mantra: "Om Gurave Namah",
        direction: "North-East",
        practice:
          "Study regularly, respect teachers and take up creative writing.",
      },
      "4": {
        colour: "Blue / Grey",
        mantra: "Om Rahave Namah",
        direction: "South-West",
        practice: "Build daily discipline and routines; declutter your space.",
      },
      "5": {
        colour: "Green",
        mantra: "Om Budhaya Namah",
        direction: "North",
        practice:
          "Improve communication and stay physically active for balance.",
      },
      "6": {
        colour: "White / Pink",
        mantra: "Om Shukraya Namah",
        direction: "South-East",
        practice: "Care for home and family; engage with art and beauty.",
      },
      "7": {
        colour: "Grey / Multicolour",
        mantra: "Om Ketave Namah",
        direction: "West",
        practice: "Take up meditation and spiritual study; cultivate patience.",
      },
      "8": {
        colour: "Black / Dark Blue",
        mantra: "Om Shanaischaraya Namah",
        direction: "West",
        practice: "Practise discipline and service; manage money methodically.",
      },
      "9": {
        colour: "Red",
        mantra: "Om Angarakaya Namah",
        direction: "South",
        practice:
          "Channel energy into exercise and courageous, focused action.",
      },
    };
    const missingRemedies = missing.map((n) => {
      const key = String(n);
      const r = REMEDIES[key];
      return {
        number: n,
        planet: PLANETS[key],
        element: ELEMENTS[key],
        meaning: MEANINGS[key],
        colour: r.colour,
        mantra: r.mantra,
        direction: r.direction,
        practice: r.practice,
      };
    });

    // ---- Kua number (Feng Shui Eight Mansions) ----
    const rawGender = String(birth.gender ?? body.gender ?? "")
      .trim()
      .toLowerCase();
    const genderNorm =
      rawGender === "male" || rawGender === "m"
        ? "male"
        : rawGender === "female" || rawGender === "f"
          ? "female"
          : "";

    const KUA_DIRECTIONS: Record<number, Record<string, string>> = {
      1: {
        sheng_chi: "SE",
        tien_yi: "E",
        nien_yen: "S",
        fu_wei: "N",
        ho_hai: "W",
        wu_kwei: "NE",
        liu_sha: "NW",
        chueh_ming: "SW",
      },
      2: {
        sheng_chi: "NE",
        tien_yi: "W",
        nien_yen: "NW",
        fu_wei: "SW",
        ho_hai: "E",
        wu_kwei: "SE",
        liu_sha: "S",
        chueh_ming: "N",
      },
      3: {
        sheng_chi: "S",
        tien_yi: "N",
        nien_yen: "SE",
        fu_wei: "E",
        ho_hai: "SW",
        wu_kwei: "NW",
        liu_sha: "NE",
        chueh_ming: "W",
      },
      4: {
        sheng_chi: "N",
        tien_yi: "S",
        nien_yen: "E",
        fu_wei: "SE",
        ho_hai: "NW",
        wu_kwei: "SW",
        liu_sha: "W",
        chueh_ming: "NE",
      },
      6: {
        sheng_chi: "W",
        tien_yi: "NE",
        nien_yen: "SW",
        fu_wei: "NW",
        ho_hai: "SE",
        wu_kwei: "E",
        liu_sha: "N",
        chueh_ming: "S",
      },
      7: {
        sheng_chi: "NW",
        tien_yi: "SW",
        nien_yen: "NE",
        fu_wei: "W",
        ho_hai: "N",
        wu_kwei: "S",
        liu_sha: "SE",
        chueh_ming: "E",
      },
      8: {
        sheng_chi: "SW",
        tien_yi: "NW",
        nien_yen: "W",
        fu_wei: "NE",
        ho_hai: "S",
        wu_kwei: "N",
        liu_sha: "E",
        chueh_ming: "SE",
      },
      9: {
        sheng_chi: "E",
        tien_yi: "SE",
        nien_yen: "N",
        fu_wei: "S",
        ho_hai: "NE",
        wu_kwei: "W",
        liu_sha: "SW",
        chueh_ming: "NW",
      },
    };
    const KUA_ELEMENTS: Record<number, string> = {
      1: "Water",
      2: "Earth",
      3: "Wood",
      4: "Wood",
      6: "Metal",
      7: "Metal",
      8: "Earth",
      9: "Fire",
    };

    let kua: Record<string, unknown>;
    if (genderNorm === "") {
      kua = { available: false, reason: "gender_required" };
    } else {
      const y = Number(isoDate.slice(0, 4));
      const mo = Number(isoDate.slice(5, 7));
      const da = Number(isoDate.slice(8, 10));
      // Chinese solar year begins ~4 Feb; earlier dates use the previous year.
      const effectiveYear = mo < 2 || (mo === 2 && da < 4) ? y - 1 : y;
      const lastTwo = effectiveYear % 100;
      const reducedYear = reduceOne(Math.floor(lastTwo / 10) + (lastTwo % 10));
      let kuaNum: number;
      if (genderNorm === "male") {
        kuaNum = (effectiveYear < 2000 ? 10 : 9) - reducedYear;
        if (kuaNum <= 0) kuaNum += 9;
        if (kuaNum === 5) kuaNum = 2;
      } else {
        kuaNum = reduceOne(reducedYear + (effectiveYear < 2000 ? 5 : 6));
        if (kuaNum === 5) kuaNum = 8;
      }
      const group = [1, 3, 4, 9].includes(kuaNum) ? "East" : "West";
      const d = KUA_DIRECTIONS[kuaNum]!;
      kua = {
        available: true,
        number: kuaNum,
        gender: genderNorm,
        group,
        element: KUA_ELEMENTS[kuaNum] ?? "",
        effective_year: effectiveYear,
        favorable: [
          {
            name: "Sheng Chi",
            theme: "Prosperity, success & wealth",
            direction: d.sheng_chi,
          },
          {
            name: "Tien Yi",
            theme: "Health & wellbeing",
            direction: d.tien_yi,
          },
          {
            name: "Nien Yen",
            theme: "Love & relationships",
            direction: d.nien_yen,
          },
          {
            name: "Fu Wei",
            theme: "Personal growth & stability",
            direction: d.fu_wei,
          },
        ],
        unfavorable: [
          {
            name: "Ho Hai",
            theme: "Mishaps & minor setbacks",
            direction: d.ho_hai,
          },
          {
            name: "Wu Kwei",
            theme: "Five Ghosts — conflict & betrayal",
            direction: d.wu_kwei,
          },
          {
            name: "Liu Sha",
            theme: "Six Killings — losses & legal trouble",
            direction: d.liu_sha,
          },
          {
            name: "Chueh Ming",
            theme: "Total Loss — avoid this direction",
            direction: d.chueh_ming,
          },
        ],
        note: "Kua uses birth year + gender; births before ~4 Feb use the previous lunar year. Kua 5 maps to 2 (male) or 8 (female).",
      };
    }

    const loShuData = {
      input: { birth_date: isoDate, method: "dob+driver+conductor" },
      systems_note:
        "Standard Vedic Lo Shu: the grid is built from the date-of-birth digits (0 has no cell) PLUS the Driver (Mulank) and Conductor (Bhagyank) numbers. counts_dob shows the raw date-only counts for reference.",
      driver: driverNum,
      destiny: destinyNum,
      added_to_grid: addedToGrid,
      grid,
      counts,
      counts_dob: countsDob,
      present,
      missing,
      repeated,
      repeated_details: repeatedDetails,
      arrows,
      missing_remedies: missingRemedies,
      planets: PLANETS,
      elements: ELEMENTS,
      meanings: MEANINGS,
      kua,
    };

    const loCanonical = canonicalJson({
      user_id: userId,
      chart_type: "lo_shu",
      birth_date: isoDate,
      algo: "loshu-v3",
      gender: genderNorm || null,
    });
    const loHash = await sha256Hex(loCanonical);

    const { data: loExisting } = await svc
      .from("chart_artifacts")
      .select("id, chart_jsonb")
      .eq("user_id", userId)
      .eq("chart_type", "lo_shu")
      .eq("input_hash", loHash)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (loExisting && !forceRefresh) {
      return json(200, {
        resource: "lo_shu",
        reused: true,
        artifact_id: loExisting.id,
        data: loExisting.chart_jsonb,
      });
    }

    const { data: loInserted, error: loErr } = await svc
      .from("chart_artifacts")
      .upsert(
        {
          user_id: userId,
          birth_profile_id: birth.id,
          chart_type: "lo_shu",
          input_hash: loHash,
          provider: "internal",
          provider_version: "loshu-v3",
          chart_jsonb: loShuData,
          supersedes_id: null,
        },
        { onConflict: "user_id,chart_type,input_hash" },
      )
      .select("id")
      .single();

    if (loErr || !loInserted) {
      return err(
        500,
        "persist_failed",
        loErr?.message ?? "Could not save Lo Shu grid",
      );
    }

    return json(200, {
      resource: "lo_shu",
      reused: false,
      artifact_id: loInserted.id,
      data: loShuData,
    });
  }

  if (!birth || !birth.birth_date || !birth.birth_place_label) {
    return err(409, "birth_profile_incomplete");
  }

  // Geocode if coordinates missing
  let latitude = birth.latitude as number | null;
  let longitude = birth.longitude as number | null;
  let timezone = (birth.birth_timezone as string | null) ?? "Asia/Kolkata";

  if (latitude == null || longitude == null) {
    // Try progressively broader queries: full label, then each comma-part
    // from most specific to least, so "Atmakur, Telangana" falls back to
    // "Atmakur" then "Telangana" if the exact combined string isn't indexed.
    const label = String(birth.birth_place_label).trim();
    const parts = label
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    // Open-Meteo indexes single tokens; a "City, State" query often returns
    // zero results. Try the full label first, then each part alone.
    const attempts = Array.from(new Set([label, ...parts]));
    let hit:
      { latitude: number; longitude: number; timezone?: string } | undefined;

    for (const attempt of attempts) {
      let geo: Response;
      try {
        geo = await fetchWithTimeout(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(attempt)}&count=5&language=en&format=json`,
          { method: "GET" },
          8000,
        );
      } catch {
        continue;
      }
      if (!geo.ok) continue;
      const gj = (await geo.json()) as {
        results?: Array<{
          latitude: number;
          longitude: number;
          timezone?: string;
          admin1?: string;
          country_code?: string;
        }>;
      };
      const results = gj.results ?? [];
      if (results.length === 0) continue;
      // Prefer a result whose admin1 matches another part of the label.
      const otherParts = parts.filter(
        (p) => p.toLowerCase() !== attempt.toLowerCase(),
      );
      hit =
        results.find((r) =>
          otherParts.some((p) =>
            (r.admin1 ?? "").toLowerCase().includes(p.toLowerCase()),
          ),
        ) ?? results[0];
      break;
    }

    // Fallback to Nominatim (OpenStreetMap) which has much broader coverage
    // for small Indian towns like "Atmakur, Telangana".
    if (!hit) {
      try {
        const nomRes = await fetchWithTimeout(
          `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(label)}`,
          {
            method: "GET",
            headers: { "User-Agent": "astrosathi/1.0 (chart-gateway)" },
          },
          8000,
        );
        if (nomRes.ok) {
          const nj = (await nomRes.json()) as Array<{
            lat: string;
            lon: string;
          }>;
          if (nj.length > 0) {
            hit = {
              latitude: parseFloat(nj[0].lat),
              longitude: parseFloat(nj[0].lon),
              timezone: "Asia/Kolkata",
            };
          }
        }
      } catch {
        // fall through to error below
      }
    }

    if (!hit) {
      return err(422, "place_not_resolved", "Could not resolve birth place");
    }
    latitude = hit.latitude;
    longitude = hit.longitude;
    if (hit.timezone) timezone = hit.timezone;

    await svc
      .from("birth_profiles")
      .update({
        latitude,
        longitude,
        birth_timezone: timezone,
      })
      .eq("user_id", userId);
  }

  // Validate coordinates before any provider call.
  if (
    typeof latitude !== "number" ||
    typeof longitude !== "number" ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    return err(422, "place_not_resolved", "Birth place coordinates missing");
  }

  // Datetime — when birth_time is unknown, default to 12:00:00 local time.
  const timeKnown = birth.birth_time_known !== false;
  const rawTime = timeKnown
    ? String(birth.birth_time ?? "12:00:00")
    : "12:00:00";
  const trimmed = rawTime.slice(0, 8);
  const normalizedTime =
    trimmed.length === 5 ? `${trimmed}:00` : trimmed.padEnd(8, "0");
  const datetimeUsed = isoWithOffset(
    String(birth.birth_date),
    normalizedTime,
    timezone,
  );
  // Validate the produced ISO-8601 with offset.
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/.test(
      datetimeUsed,
    ) ||
    Number.isNaN(Date.parse(datetimeUsed))
  ) {
    return err(422, "invalid_datetime", "Birth date/time is invalid");
  }
  const timeConfidence = timeKnown ? "high" : "low";

  // Input hash
  const coordinatesUsed = `${latitude},${longitude}`;
  const hashInput: Record<string, unknown> = {
    user_id: userId,
    chart_type: chartType,
    system: "parashara",
    ayanamsa: "lahiri",
    datetime_used: datetimeUsed,
    coordinates_used: coordinatesUsed,
    time_confidence: timeConfidence,
  };
  if (isReport) {
    hashInput.report_type = reportType;
    hashInput.report_params = reportParams;
  }
  // Keep swiss and prokerala caches distinct (and avoid serving a stale
  // cross-engine result when the flag is flipped). Applies to any resource
  // that has a swiss path.
  if (isPlanets || useSwissDasha || useSwissDosha || useSwissAshtakavarga) {
    hashInput.engine = engine;
  }
  const canonical = canonicalJson(hashInput);
  const inputHash = await sha256Hex(canonical);

  // Reuse guard
  const { data: existing } = await svc
    .from("chart_artifacts")
    .select("id, chart_jsonb")
    .eq("user_id", userId)
    .eq("chart_type", chartType)
    .eq("input_hash", inputHash)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing && !forceRefresh) {
    if (isReport) {
      return json(200, {
        resource: "report",
        report_type: reportType,
        reused: true,
        artifact_id: existing.id,
        data: existing.chart_jsonb,
      });
    }
    return isPlanets
      ? json(200, {
          resource: "planets",
          reused: true,
          artifact_id: existing.id,
          data: existing.chart_jsonb,
        })
      : json(200, {
          chart_type: chartType,
          reused: true,
          artifact_id: existing.id,
          chart_jsonb: existing.chart_jsonb,
        });
  }

  // Helper: audit row
  const audit = async (params: {
    http_status: number;
    success: boolean;
    cost_units?: number | null;
    error?: string | null;
  }) => {
    await svc.from("astrology_provider_runs").insert({
      user_id: userId,
      provider: "prokerala",
      endpoint: isPlanets
        ? "/v2/astrology/planet-position"
        : isReport
          ? `/v2/astrology/${reportSlug}`
          : "/v2/astrology/chart",
      input_hash: inputHash,
      http_status: params.http_status,
      success: params.success,
      cost_units: params.cost_units ?? null,
      error: params.error ?? null,
    });
  };

  // ---------- Local astronomy-engine path (natal positions + ascendant) ----------
  // Behind the engine flag; defaults off. Computes D1 positions + ascendant
  // locally and returns a Prokerala-shaped payload. Resilient by design:
  //  - any compute error falls through to the Prokerala path below;
  //  - a persistence/audit rejection still returns the correct computed data
  //    (simply uncached), so the app can never break.
  if (useSwiss) {
    try {
      const swissPayload = await computeNatalPayload(
        datetimeUsed,
        latitude,
        longitude,
      );

      let artifactId: string | null = null;
      try {
        let supersedesId: string | null = null;
        if (forceRefresh) {
          const { data: prev } = await svc
            .from("chart_artifacts")
            .select("id")
            .eq("user_id", userId)
            .eq("chart_type", chartType)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          supersedesId = prev?.id ?? null;
        }
        const { data: inserted, error: insErr } = await svc
          .from("chart_artifacts")
          .upsert(
            {
              user_id: userId,
              birth_profile_id: birth.id,
              chart_type: chartType,
              input_hash: inputHash,
              provider: "astronomy-engine",
              provider_version: SWISS_ENGINE_VERSION,
              chart_jsonb: swissPayload,
              supersedes_id: null,
            },
            { onConflict: "user_id,chart_type,input_hash" },
          )
          .select("id")
          .single();
        void supersedesId;
        if (insErr) {
          console.error("[chart-gateway] swiss persist failed:", insErr);
        } else {
          artifactId = inserted?.id ?? null;
        }
      } catch (persistErr) {
        console.error("[chart-gateway] swiss persist threw:", persistErr);
      }

      // Best-effort audit; never fatal.
      try {
        await svc.from("astrology_provider_runs").insert({
          user_id: userId,
          provider: "astronomy-engine",
          endpoint: "local/natal-positions",
          input_hash: inputHash,
          http_status: 200,
          success: true,
          cost_units: 0,
          error: null,
        });
      } catch (auditErr) {
        console.error("[chart-gateway] swiss audit failed:", auditErr);
      }

      console.log(
        "[chart-gateway] served natal via astronomy-engine (engine=swiss)",
      );
      return json(200, {
        resource: "planets",
        engine: "astronomy-engine",
        reused: false,
        artifact_id: artifactId,
        data: swissPayload,
      });
    } catch (e) {
      console.error(
        "[chart-gateway] swiss engine failed; falling back to Prokerala:",
        e,
      );
      // fall through to the Prokerala path below
    }
  }

  // ---------- Local astronomy-engine path (vimshottari dasha) ----------
  // Same gating discipline as the natal swiss path: opt-in, resilient, and
  // any compute error falls through to Prokerala. Cost: zero.
  if (useSwissDasha) {
    try {
      // Reuse the validated natal engine to get the birth Moon's ABSOLUTE
      // 0-360 sidereal longitude. eBody stores `longitude` as the normalized
      // whole-cycle value (see chart-gateway/index.ts eBody -> L = eNorm360(sidLon)).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const natal: any = await computeNatalPayload(
        datetimeUsed,
        latitude,
        longitude,
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const planets: any[] = natal?.data?.planet_position ?? [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const moon = planets.find((p: any) => p?.id === 1);
      const moonSidLon = Number(moon?.longitude);
      if (!Number.isFinite(moonSidLon)) {
        throw new Error("swiss dasha: could not resolve moon longitude");
      }

      const birthUtcMs = Date.parse(datetimeUsed);
      if (!Number.isFinite(birthUtcMs)) {
        throw new Error("swiss dasha: invalid datetime");
      }

      // Extract the fixed offset from datetimeUsed (already validated as
      // ...+HH:MM by the regex above). This is the offset Prokerala uses to
      // format every emitted dasha date.
      const offMatch = datetimeUsed.match(/([+-])(\d{2}):(\d{2})$/);
      const offsetMinutes = offMatch
        ? (offMatch[1] === "-" ? -1 : 1) *
          (Number(offMatch[2]) * 60 + Number(offMatch[3]))
        : 0;

      const dashaEngineOverride = String(
        body.dasha_year_days ?? Deno.env.get("DASHA_YEAR_DAYS") ?? "",
      );
      const yearDays = dashaEngineOverride
        ? Number(dashaEngineOverride)
        : undefined;

      const dashaPayload = computeVimshottariDashaPayload({
        moonSidLon,
        birthUtcMs,
        offsetMinutes,
        yearDays,
      });

      let artifactId: string | null = null;
      try {
        const { data: inserted, error: insErr } = await svc
          .from("chart_artifacts")
          .upsert(
            {
              user_id: userId,
              birth_profile_id: birth.id,
              chart_type: chartType,
              input_hash: inputHash,
              provider: "astronomy-engine",
              provider_version: SWISS_ENGINE_VERSION + "+vim-v1",
              chart_jsonb: dashaPayload,
              supersedes_id: null,
            },
            { onConflict: "user_id,chart_type,input_hash" },
          )
          .select("id")
          .single();
        if (insErr) {
          console.error("[chart-gateway] swiss dasha persist failed:", insErr);
        } else {
          artifactId = inserted?.id ?? null;
        }
      } catch (persistErr) {
        console.error("[chart-gateway] swiss dasha persist threw:", persistErr);
      }

      try {
        await svc.from("astrology_provider_runs").insert({
          user_id: userId,
          provider: "astronomy-engine",
          endpoint: "local/vimshottari-dasha",
          input_hash: inputHash,
          http_status: 200,
          success: true,
          cost_units: 0,
          error: null,
        });
      } catch (auditErr) {
        console.error("[chart-gateway] swiss dasha audit failed:", auditErr);
      }

      console.log(
        "[chart-gateway] served vimshottari_dasha via astronomy-engine (engine=swiss)",
      );
      return json(200, {
        resource: "report",
        report_type: reportType,
        engine: "astronomy-engine",
        reused: false,
        artifact_id: artifactId,
        data: dashaPayload,
      });
    } catch (e) {
      console.error(
        "[chart-gateway] swiss dasha failed; falling back to Prokerala:",
        e,
      );
      // fall through to the Prokerala path below
    }
  }

  // ---------- Local astronomy-engine path (mangal + kaal-sarp doshas) ----------
  // Same gating discipline as swiss-dasha: opt-in, resilient, any compute
  // error falls through to Prokerala. Cost: zero, no provider call.
  if (useSwissDosha) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const natal: any = await computeNatalPayload(
        datetimeUsed,
        latitude,
        longitude,
      );
      const doshaPayload =
        reportType === "mangal_dosha"
          ? computeMangalDoshaPayload(natal)
          : computeKaalSarpDoshaPayload(natal);
      // Stamp _report so parity/inspection tooling can identify local rows
      // unambiguously by type (Prokerala rows lack this key today).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (doshaPayload as any)._report = {
        type: reportType,
        params: reportParams,
      };
      const auditEndpoint =
        reportType === "mangal_dosha"
          ? "local/mangal-dosha"
          : "local/kaal-sarp-dosha";

      let artifactId: string | null = null;
      try {
        const { data: inserted, error: insErr } = await svc
          .from("chart_artifacts")
          .upsert(
            {
              user_id: userId,
              birth_profile_id: birth.id,
              chart_type: chartType,
              input_hash: inputHash,
              provider: "astronomy-engine",
              provider_version: SWISS_ENGINE_VERSION + "+dosha-v1",
              chart_jsonb: doshaPayload,
              supersedes_id: null,
            },
            { onConflict: "user_id,chart_type,input_hash" },
          )
          .select("id")
          .single();
        if (insErr) {
          console.error("[chart-gateway] swiss dosha persist failed:", insErr);
        } else {
          artifactId = inserted?.id ?? null;
        }
      } catch (persistErr) {
        console.error("[chart-gateway] swiss dosha persist threw:", persistErr);
      }

      try {
        await svc.from("astrology_provider_runs").insert({
          user_id: userId,
          provider: "astronomy-engine",
          endpoint: auditEndpoint,
          input_hash: inputHash,
          http_status: 200,
          success: true,
          cost_units: 0,
          error: null,
        });
      } catch (auditErr) {
        console.error("[chart-gateway] swiss dosha audit failed:", auditErr);
      }

      console.log(
        `[chart-gateway] served ${reportType} via astronomy-engine (engine=swiss)`,
      );
      return json(200, {
        resource: "report",
        report_type: reportType,
        engine: "astronomy-engine",
        reused: false,
        artifact_id: artifactId,
        data: doshaPayload,
      });
    } catch (e) {
      console.error(
        "[chart-gateway] swiss dosha failed; falling back to Prokerala:",
        e,
      );
      // fall through to the Prokerala path below
    }
  }

  // ---------- Local astronomy-engine path (ashtakavarga + sarvashtakavarga) ----------
  // Same gating discipline as swiss-dosha: opt-in, resilient, any compute
  // error falls through to Prokerala. Cost: zero, no provider call.
  if (useSwissAshtakavarga) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const natal: any = await computeNatalPayload(
        datetimeUsed,
        latitude,
        longitude,
      );
      let avPayload: unknown;
      let auditEndpoint: string;
      if (reportType === "ashtakavarga") {
        const planetId = Number(reportParams.planet);
        if (!Number.isFinite(planetId)) {
          throw new Error("ashtakavarga: invalid provider_params.planet");
        }
        avPayload = computeAshtakavargaPayload(natal, planetId);
        auditEndpoint = "local/ashtakavarga";
      } else {
        avPayload = computeSarvashtakavargaPayload(natal);
        auditEndpoint = "local/sarvashtakavarga";
      }
      // Stamp _report so parity/inspection tooling can identify local rows
      // unambiguously by type (Prokerala rows lack this key today).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (avPayload as any)._report = {
        type: reportType,
        params: reportParams,
      };

      let artifactId: string | null = null;
      try {
        const { data: inserted, error: insErr } = await svc
          .from("chart_artifacts")
          .upsert(
            {
              user_id: userId,
              birth_profile_id: birth.id,
              chart_type: chartType,
              input_hash: inputHash,
              provider: "astronomy-engine",
              provider_version: SWISS_ENGINE_VERSION + "+av-v1",
              chart_jsonb: avPayload,
              supersedes_id: null,
            },
            { onConflict: "user_id,chart_type,input_hash" },
          )
          .select("id")
          .single();
        if (insErr) {
          console.error("[chart-gateway] swiss ashtakavarga persist failed:", insErr);
        } else {
          artifactId = inserted?.id ?? null;
        }
      } catch (persistErr) {
        console.error("[chart-gateway] swiss ashtakavarga persist threw:", persistErr);
      }

      try {
        await svc.from("astrology_provider_runs").insert({
          user_id: userId,
          provider: "astronomy-engine",
          endpoint: auditEndpoint,
          input_hash: inputHash,
          http_status: 200,
          success: true,
          cost_units: 0,
          error: null,
        });
      } catch (auditErr) {
        console.error("[chart-gateway] swiss ashtakavarga audit failed:", auditErr);
      }

      console.log(
        `[chart-gateway] served ${reportType} via astronomy-engine (engine=swiss)`,
      );
      return json(200, {
        resource: "report",
        report_type: reportType,
        engine: "astronomy-engine",
        reused: false,
        artifact_id: artifactId,
        data: avPayload,
      });
    } catch (e) {
      console.error(
        "[chart-gateway] swiss ashtakavarga failed; falling back to Prokerala:",
        e,
      );
      // fall through to the Prokerala path below
    }
  }

  // Token
  let accessToken: string;
  try {
    const tokRes = await fetchWithTimeout(
      "https://api.prokerala.com/token",
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          client_id: PROKERALA_CLIENT_ID,
          client_secret: PROKERALA_CLIENT_SECRET,
        }).toString(),
      },
      15000,
    );
    if (!tokRes.ok) {
      await audit({
        http_status: tokRes.status,
        success: false,
        error: "provider_auth_failed",
      });
      return err(502, "provider_auth_failed", "Provider authentication failed");
    }
    const tokJson = (await tokRes.json()) as { access_token?: string };
    if (!tokJson.access_token) {
      await audit({
        http_status: tokRes.status,
        success: false,
        error: "provider_auth_failed",
      });
      return err(502, "provider_auth_failed", "Provider authentication failed");
    }
    accessToken = tokJson.access_token;
  } catch {
    await audit({
      http_status: 0,
      success: false,
      error: "provider_auth_failed",
    });
    return err(502, "provider_auth_failed", "Provider authentication failed");
  }

  // Provider call — build query with URLSearchParams so datetime offset (+05:30)
  // and other values are properly percent-encoded.
  const providerParams = new URLSearchParams();
  providerParams.set("ayanamsa", "1");
  providerParams.set("coordinates", coordinatesUsed);
  providerParams.set("datetime", datetimeUsed);
  providerParams.set("la", "en");
  if (!isJson) {
    providerParams.set("chart_type", slug);
    const PROKERALA_STYLE: Record<string, string> = {
      north_indian: "north-indian",
      south_indian: "south-indian",
      east_indian: "east-indian",
    };
    providerParams.set(
      "chart_style",
      PROKERALA_STYLE[chartStyle] ?? chartStyle,
    );
  }
  if (isReport) {
    for (const [k, v] of Object.entries(reportParams)) {
      providerParams.set(k, v);
    }
  }
  const providerPath = isPlanets
    ? "planet-position"
    : isReport
      ? reportSlug
      : "chart";
  const providerUrl = `https://api.prokerala.com/v2/astrology/${providerPath}?${providerParams.toString()}`;

  const callProvider = async (): Promise<Response> =>
    fetchWithTimeout(
      providerUrl,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}` },
      },
      20000,
    );

  let provRes: Response;
  try {
    provRes = await callProvider();
    if (provRes.status === 429) {
      // Retry once after ~1.5s.
      await new Promise((r) => setTimeout(r, 1500));
      provRes = await callProvider();
    }
  } catch {
    await audit({ http_status: 0, success: false, error: "provider_error" });
    return err(502, "provider_error", "Provider request failed");
  }

  const provText = await provRes.text();
  const provContentType = provRes.headers.get("content-type") ?? "";

  if (provRes.status === 429) {
    const busyMsg = "The chart service is busy — please try again in a moment.";
    await audit({
      http_status: 429,
      success: false,
      error: busyMsg,
    });
    return err(429, "provider_rate_limited", busyMsg);
  }

  // Try to parse JSON for error extraction / non-SVG success payloads.
  let provJson: unknown = null;
  try {
    provJson = provText ? JSON.parse(provText) : null;
  } catch {
    provJson = null;
  }

  if (!provRes.ok) {
    // Extract provider's actual error message (fall back to raw text).
    let providerMsg: string | null = null;
    if (provJson && typeof provJson === "object") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pj = provJson as any;
      providerMsg =
        pj.message ??
        pj.error?.message ??
        pj.error_description ??
        (Array.isArray(pj.errors) && pj.errors[0]?.detail) ??
        null;
    }
    if (!providerMsg) {
      providerMsg = provText?.trim()
        ? provText.trim()
        : `HTTP ${provRes.status}`;
    }
    const finalMsg = String(providerMsg).slice(0, 500);
    await audit({
      http_status: provRes.status,
      success: false,
      error: finalMsg,
    });
    return err(502, "provider_error", finalMsg);
  }

  // Determine payload shape: SVG (image/svg+xml) vs JSON.
  const isSvg =
    !isJson &&
    (provContentType.toLowerCase().includes("svg") ||
      provText.trimStart().startsWith("<"));
  const chartPayload: unknown = isJson
    ? provJson
    : isSvg
      ? {
          svg: provText,
          chart_type: chartType,
          chart_style: chartStyle,
          provider: "prokerala",
        }
      : provJson;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const providerVersion = (provJson as any)?.version ?? "v2";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const costUnits = (provJson as any)?.cost_units ?? null;

  // Supersedes id (previous latest for this user+chart_type)
  let supersedesId: string | null = null;
  if (forceRefresh) {
    const { data: prev } = await svc
      .from("chart_artifacts")
      .select("id")
      .eq("user_id", userId)
      .eq("chart_type", chartType)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    supersedesId = prev?.id ?? null;
  }

  const { data: inserted, error: insErr } = await svc
    .from("chart_artifacts")
    .upsert(
      {
        user_id: userId,
        birth_profile_id: birth.id,
        chart_type: chartType,
        input_hash: inputHash,
        provider: "prokerala",
        provider_version: providerVersion,
        chart_jsonb: chartPayload,
        supersedes_id: supersedesId,
      },
      { onConflict: "user_id,chart_type,input_hash" },
    )
    .select("id")
    .single();

  await audit({
    http_status: provRes.status,
    success: !insErr,
    cost_units: typeof costUnits === "number" ? costUnits : null,
    error: insErr?.message ?? null,
  });

  if (insErr || !inserted) {
    return err(
      500,
      "persist_failed",
      insErr?.message ?? "Could not save chart",
    );
  }

  if (isReport) {
    return json(200, {
      resource: "report",
      report_type: reportType,
      reused: false,
      artifact_id: inserted.id,
      data: chartPayload,
    });
  }
  return isPlanets
    ? json(200, {
        resource: "planets",
        reused: false,
        artifact_id: inserted.id,
        data: chartPayload,
      })
    : json(200, {
        chart_type: chartType,
        reused: false,
        artifact_id: inserted.id,
        chart_jsonb: chartPayload,
      });
});
