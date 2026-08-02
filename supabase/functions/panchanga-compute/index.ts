// panchanga-compute — Daily Panchanga engine, anchored to Mumbai (NSE/MCX 19.076N 72.877E).
// Zero external APIs; uses astronomy-engine 2.1.19 (same validated engine as
// chart-gateway / transit-planets-refresh / transit-compute / daily-horoscope).
// Idempotent: upsert on conflict (panchanga_date).
// Cultural / educational feature — NOT investment advice.

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
// Location: Mumbai (BSE/NSE/MCX anchor)
// -----------------------------------------------------------
const LOC_LAT = 19.076;
const LOC_LON = 72.877;
const LOC_ELEV_M = 14;

// -----------------------------------------------------------
// Lahiri sidereal helpers (byte-identical to Steps 1–3)
// -----------------------------------------------------------
const AYANAMSA_J2000 = 23.85292;
const norm360 = (x: number): number => ((x % 360) + 360) % 360;

function ayanamsaDeg(T: number): number {
  // Lahiri drift-corrected. Absorbs precession-since-J2000 + sidereal offset.
  return AYANAMSA_J2000 + 1.3969713 * T + 0.0003086 * T * T;
}

function siderealLon(A: any, body: any, date: Date, ab: boolean): number {
  const time = A.MakeTime(date);
  const equ = A.GeoVector(body, time, ab);   // equatorial J2000
  const ec = A.Ecliptic(equ);                 // -> { elon (J2000 ecliptic), elat }
  const T = time.tt / 36525;
  return norm360(ec.elon - ayanamsaDeg(T));
}

// -----------------------------------------------------------
// Name tables
// -----------------------------------------------------------
const TITHI_NAMES_SHUKLA = [
  "Pratipada", "Dwitiya", "Tritiya", "Chaturthi", "Panchami", "Shashthi",
  "Saptami", "Ashtami", "Navami", "Dashami", "Ekadashi", "Dwadashi",
  "Trayodashi", "Chaturdashi", "Purnima",
];
const TITHI_NAMES_KRISHNA = [
  "Pratipada", "Dwitiya", "Tritiya", "Chaturthi", "Panchami", "Shashthi",
  "Saptami", "Ashtami", "Navami", "Dashami", "Ekadashi", "Dwadashi",
  "Trayodashi", "Chaturdashi", "Amavasya",
];

const VARA_NAMES = [
  "Ravivara", "Somavara", "Mangalavara", "Budhavara",
  "Guruvara", "Shukravara", "Shanivara",
];

const NAKSHATRAS = [
  "Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashira", "Ardra", "Punarvasu",
  "Pushya", "Ashlesha", "Magha", "Purva Phalguni", "Uttara Phalguni", "Hasta",
  "Chitra", "Swati", "Vishakha", "Anuradha", "Jyeshtha", "Mula",
  "Purva Ashadha", "Uttara Ashadha", "Shravana", "Dhanishta", "Shatabhisha",
  "Purva Bhadrapada", "Uttara Bhadrapada", "Revati",
];

const YOGAS = [
  "Vishkambha", "Priti", "Ayushman", "Saubhagya", "Shobhana", "Atiganda", "Sukarma",
  "Dhriti", "Shula", "Ganda", "Vriddhi", "Dhruva", "Vyaghata", "Harshana", "Vajra",
  "Siddhi", "Vyatipata", "Variyana", "Parigha", "Shiva", "Siddha", "Sadhya", "Shubha",
  "Shukla", "Brahma", "Indra", "Vaidhriti",
];

const KARANA_MOVEABLE = ["Bava", "Balava", "Kaulava", "Taitila", "Gara", "Vanija", "Vishti"];
// Fixed karanas by half-tithi index: 0=Kimstughna, 57=Shakuni, 58=Chatushpada, 59=Naga.

// -----------------------------------------------------------
// Muhurta octant tables (1-indexed of 8 daylight octants)
// Rows indexed by vara: 0=Sun,1=Mon,2=Tue,3=Wed,4=Thu,5=Fri,6=Sat
// -----------------------------------------------------------
const RAHU_KALAM_OCTANT   = [8, 2, 7, 5, 6, 4, 3];
const YAMAGANDAM_OCTANT   = [4, 3, 2, 1, 7, 6, 5];
const GULIKA_KALAM_OCTANT = [7, 6, 5, 4, 3, 2, 1];

// -----------------------------------------------------------
// Date helpers
// -----------------------------------------------------------
function istDateStr(nowMs: number): string {
  const ist = nowMs + 5.5 * 3600 * 1000;
  return new Date(ist).toISOString().slice(0, 10);
}
function istMidnightUtc(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00+05:30`);
}

// -----------------------------------------------------------
// Karana from half-tithi index (0..59)
// -----------------------------------------------------------
function karanaFromHalfTithi(halfTithi: number): { idx: number; name: string } {
  if (halfTithi === 0)  return { idx: 11, name: "Kimstughna" };
  if (halfTithi === 57) return { idx: 8,  name: "Shakuni" };
  if (halfTithi === 58) return { idx: 9,  name: "Chatushpada" };
  if (halfTithi === 59) return { idx: 10, name: "Naga" };
  const m = (halfTithi - 1) % 7;              // 1..56 -> 0..6
  return { idx: m + 1, name: KARANA_MOVEABLE[m] };
}

// -----------------------------------------------------------
// Astronomy-engine AstroTime -> JS Date (robust)
// -----------------------------------------------------------
function astroTimeToDate(t: any): Date {
  if (t && t.date instanceof Date) return t.date;
  // Fallback: ut is days since J2000 (UT).
  const J2000_UTC_MS = Date.UTC(2000, 0, 1, 12, 0, 0);
  return new Date(J2000_UTC_MS + (t?.ut ?? 0) * 86400 * 1000);
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

  // Optional cron-secret guard. When PANCHANGA_CRON_SECRET is set, header must match.
  const secret = Deno.env.get("PANCHANGA_CRON_SECRET");
  if (secret && (req.headers.get("x-cron-secret") || "") !== secret) {
    return err("Bad or missing x-cron-secret", 401);
  }

  const svc = createClient(URL_, KEY);

  // Optional body { date: "YYYY-MM-DD" } for backfill.
  let body: any = {};
  try { body = await req.json(); } catch { /* empty body ok */ }
  const dateStr: string = (body?.date && /^\d{4}-\d{2}-\d{2}$/.test(body.date))
    ? body.date
    : istDateStr(Date.now());

  // Anchor for sunrise/sunset search: IST midnight of that date.
  const anchor = istMidnightUtc(dateStr);

  // Dynamic astronomy-engine (isolates failures from cold start).
  let A: any;
  try {
    A = await import("https://esm.sh/astronomy-engine@2.1.19");
  } catch (e) {
    return err("astronomy-engine load failed: " + String((e as Error)?.message ?? e), 500);
  }

  // Observer + sunrise/sunset for that IST day.
  const observer = new A.Observer(LOC_LAT, LOC_LON, LOC_ELEV_M);
  const sunriseT = A.SearchRiseSet(A.Body.Sun, observer, +1, anchor, 1);
  if (!sunriseT) return err("Sunrise search failed for " + dateStr, 500);
  const sunsetT = A.SearchRiseSet(A.Body.Sun, observer, -1, astroTimeToDate(sunriseT), 1);
  if (!sunsetT) return err("Sunset search failed for " + dateStr, 500);

  const sunrise = astroTimeToDate(sunriseT);
  const sunset  = astroTimeToDate(sunsetT);

  // Compute panchanga AT sunrise (canonical Vedic anchor).
  const sunLon  = siderealLon(A, A.Body.Sun,  sunrise, true);
  const moonLon = siderealLon(A, A.Body.Moon, sunrise, false);

  // ---- Tithi ----
  const tithiElong = norm360(moonLon - sunLon);            // 0..360
  const halfTithi = Math.min(59, Math.floor(tithiElong / 6));  // 0..59
  const tithiIdx  = Math.min(30, Math.floor(tithiElong / 12) + 1); // 1..30
  const paksha    = tithiIdx <= 15 ? "shukla" : "krishna";
  const tithiNameArr = paksha === "shukla" ? TITHI_NAMES_SHUKLA : TITHI_NAMES_KRISHNA;
  const tithiName = tithiNameArr[(tithiIdx - 1) % 15];

  // ---- Vara (weekday of the IST date) ----
  // JS getUTCDay on the IST-midnight instant + 5.5h shift = local IST weekday.
  const varaMs = anchor.getTime() + 5.5 * 3600 * 1000;
  const vara = new Date(varaMs).getUTCDay(); // 0..6, 0=Sun
  const varaName = VARA_NAMES[vara];

  // ---- Nakshatra + pada ----
  const NAK_LEN = 360 / 27; // 13.3333...
  const nakIdx = Math.floor(moonLon / NAK_LEN) % 27;
  const nakInto = moonLon - nakIdx * NAK_LEN;
  const padaLen = NAK_LEN / 4;
  const pada = Math.min(4, Math.floor(nakInto / padaLen) + 1);

  // ---- Yoga ----
  const yogaAngle = norm360(sunLon + moonLon);
  const yogaIdx = Math.min(27, Math.floor(yogaAngle / NAK_LEN) + 1);
  const yogaName = YOGAS[yogaIdx - 1];

  // ---- Karana ----
  const karana = karanaFromHalfTithi(halfTithi);

  // ---- Muhurta windows (8 equal daylight octants) ----
  const daylightMs = sunset.getTime() - sunrise.getTime();
  if (!(daylightMs > 0)) return err("Bad daylight span for " + dateStr, 500);
  const octantMs = daylightMs / 8;
  const octant = (n: number): [Date, Date] => {
    // n is 1..8
    const s = new Date(sunrise.getTime() + (n - 1) * octantMs);
    const e = new Date(sunrise.getTime() + n * octantMs);
    return [s, e];
  };
  const [rk_s, rk_e] = octant(RAHU_KALAM_OCTANT[vara]);
  const [yg_s, yg_e] = octant(YAMAGANDAM_OCTANT[vara]);
  const [gk_s, gk_e] = octant(GULIKA_KALAM_OCTANT[vara]);

  // ---- Abhijit muhurta (8th of 15 daylight muhurtas; skipped on Wednesday) ----
  const muhurtaMs = daylightMs / 15;
  const abhijit_s = new Date(sunrise.getTime() + 7 * muhurtaMs);
  const abhijit_e = new Date(sunrise.getTime() + 8 * muhurtaMs);
  const abhijitValid = vara !== 3;

  // ---- Upsert ----
  const row = {
    panchanga_date: dateStr,
    location_lat: LOC_LAT,
    location_lon: LOC_LON,
    tithi: tithiIdx,
    tithi_name: tithiName,
    paksha,
    vara,
    vara_name: varaName,
    nakshatra: nakIdx,
    nakshatra_name: NAKSHATRAS[nakIdx],
    nakshatra_pada: pada,
    yoga: yogaIdx,
    yoga_name: yogaName,
    karana: karana.idx,
    karana_name: karana.name,
    sunrise: sunrise.toISOString(),
    sunset: sunset.toISOString(),
    rahu_kalam_start: rk_s.toISOString(),
    rahu_kalam_end:   rk_e.toISOString(),
    yamagandam_start: yg_s.toISOString(),
    yamagandam_end:   yg_e.toISOString(),
    gulika_start:     gk_s.toISOString(),
    gulika_end:       gk_e.toISOString(),
    abhijit_start:    abhijitValid ? abhijit_s.toISOString() : null,
    abhijit_end:      abhijitValid ? abhijit_e.toISOString() : null,
    source: "astronomy-engine",
  };

  const { error: upErr } = await svc
    .from("panchanga_daily")
    .upsert(row, { onConflict: "panchanga_date" });
  if (upErr) return err("Write panchanga_daily failed: " + upErr.message, 500);

  // Audit row (best-effort; do not fail the request on audit failure)
  try {
    await svc.from("astrology_provider_runs").insert({
      provider: "astronomy-engine",
      endpoint: "panchanga-compute",
      input_hash: dateStr,
      http_status: 200,
      success: true,
      cost_units: 0,
    });
  } catch { /* ignore */ }

  return json({ ok: true, panchangaDate: dateStr, panchanga: row });
});
