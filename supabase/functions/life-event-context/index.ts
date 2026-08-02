// Supabase Edge Function: life-event-context
// -----------------------------------------------------------------------------
// CI-3.2 · Life Timeline astro-context stamping. Self-contained: embeds the SAME
// validated astronomy-engine positions math and Vimshottari dasha math used by
// chart-gateway / person-charts, so numbers match the rest of the app exactly.
// It NEVER imports from or mutates those functions.
//
// For each of the caller's life events it computes the dasha (maha/antar/
// pratyantar) running on the event date, the Saturn + Jupiter transit signs,
// and a Sade Sati flag, and writes them into user_life_events.astro_context.
//
// AuthZ: caller JWT -> uid; all DB reads/writes use the service-role client but
// are ALWAYS filtered by that uid. Only birth_profiles + user_life_events are
// touched. RLS on user_life_events is owner-only regardless.
//
// Request:  POST { event_id?: string, force?: boolean }
//   - no event_id -> stamp every not-yet-stamped event for the user
//   - event_id    -> stamp just that one event
//   - force:true  -> re-stamp even if astro_context already present
// Response: 200 { stamped: number, skipped: number, total: number }

// @ts-ignore - Deno std import (resolved at deploy time)
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
// @ts-ignore - esm.sh import (resolved at deploy time)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

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

// ===================== positions engine (verbatim from person-charts/positions.ts) =====================
// Local sidereal positions engine — EXTRACTED VERBATIM from chart-gateway
// (astronomy-engine, Lahiri/Chitrapaksha ayanamsa, Parasara). Copied here so
// person-charts is self-contained and NEVER imports from / mutates the drifted
// chart-gateway backbone. Keep the constants and math byte-identical to the
// gateway so a saved person's charts match the app's own charts exactly.
//
// Validated (in gateway) 2026-07-28 against 4 reference charts to <0.01 deg.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const Deno: any;

export const SWISS_ENGINE_VERSION = "astronomy-engine@2.1.19+lahiri-v1";
const AYANAMSA_J2000 = 23.85292; // Lahiri ayanamsa at J2000.0 (degrees)

export const ENG_SIGNS = [
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
  return 23.4392911 - 0.0130041667 * T - 1.638889e-7 * T * T + 5.036111e-7 * T * T * T;
}
// astronomy-engine Ecliptic() returns ecliptic-of-date longitude, so we subtract
// the of-date ayanamsa for EVERY body (validated fix).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function eEclipticLonOfDate(A: any, body: any, date: Date, aberration: boolean): number {
  const vec = A.GeoVector(body, date, aberration);
  const ecl = A.Ecliptic(vec);
  return eNorm360(ecl.elon);
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function eSiderealLonOfBody(A: any, body: any, date: Date, aberration: boolean, T: number): number {
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
function eIsRetrograde(A: any, body: any, date: Date, aberration: boolean): boolean {
  const l1 = eEclipticLonOfDate(A, body, date, aberration);
  const later = new Date(date.getTime() + 3600 * 1000);
  const l2 = eEclipticLonOfDate(A, body, later, aberration);
  return eNorm180(l2 - l1) < 0;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function eSiderealAscendant(A: any, date: Date, latDeg: number, lonDeg: number, T: number): number {
  const gastHours = A.SiderealTime(date); // Greenwich apparent sidereal time (hours)
  const ramc = eNorm360(gastHours * 15 + lonDeg);
  const eps = eMeanObliquity(T);
  const R = eD2r(ramc);
  const E = eD2r(eps);
  const P = eD2r(latDeg);
  const mc = eNorm360(eR2d(Math.atan2(Math.sin(R), Math.cos(R) * Math.cos(E))));
  let asc = eNorm360(
    eR2d(Math.atan2(Math.cos(R), -(Math.sin(R) * Math.cos(E) + Math.tan(P) * Math.sin(E)))),
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
// so it is a drop-in for the web app (charts.ts normalizers).
export async function computeNatalPayload(
  datetimeUsed: string,
  lat: number,
  lon: number,
): Promise<unknown> {
  // Dynamic import isolates any load failure to this call.
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

// ---------- Deterministic hashing (copied from chart-gateway) ----------

export async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Canonical JSON with sorted keys (deterministic).
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return "[" + value.map(canonicalJson).join(",") + "]";
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonicalJson(obj[k])).join(",") + "}";
}

// ---------- Timezone-aware ISO builder (copied from chart-gateway) ----------

function tzOffsetMinutes(date: Date, timeZone: string): number {
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
  const parts = dtf.formatToParts(date).reduce<Record<string, string>>((acc, p) => {
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

// Build IANA-timezone-aware ISO-8601 string with offset, from a local
// (date, time, tz) triple.
export function isoWithOffset(dateStr: string, timeStr: string, timeZone: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm, ss] = timeStr.split(":").map((v) => Number(v || 0));
  const asUTC = Date.UTC(y, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0, ss ?? 0);
  const offsetMin = tzOffsetMinutes(new Date(asUTC), timeZone);
  const sign = offsetMin >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMin);
  const oh = String(Math.floor(abs / 60)).padStart(2, "0");
  const om = String(abs % 60).padStart(2, "0");
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  const local = `${y}-${pad(m)}-${pad(d)}T${pad(hh ?? 0)}:${pad(mm ?? 0)}:${pad(ss ?? 0)}`;
  return `${local}${sign}${oh}:${om}`;
}

// ===================== vimshottari engine (verbatim from chart-gateway/vimshottari.ts) =====================
// Vimshottari dasha — pure, deterministic computation.
//
// Matches the Prokerala vimshottari_dasha artifact envelope field-for-field so
// it drops into chart_artifacts.chart_jsonb without breaking either consumer
// (src/lib/charts.ts getDasha, and formatDasha in astrologer-chat / daily-horoscope).
//
// Envelope: { status: "ok", data: { dasha_balance, dasha_periods } }
// Depth   : maha -> antardasha -> pratyantardasha (leaf). Exactly 3.
// Period  : { id, name, start, end, [antardasha|pratyantardasha] }. No vedic_name.
// IDs     : 0 Sun, 1 Moon, 2 Mercury, 3 Venus, 4 Mars, 5 Jupiter, 6 Saturn,
//           101 Rahu, 102 Ketu. Same at every level.
// Dates   : ISO-8601 with the birth-profile fixed offset (e.g. +05:30), seconds
//           precision, no milliseconds, no Z.
// Chaining: within a parent, first child.start = parent.start; last child.end =
//           parent.end; each sibling.start = previous sibling.end + 1 second.
//           Mahadashas chain continuously (no top-level +1s gap).

export type DashaLord = { id: number; name: string; vedic_name: string };
export type DashaPeriodLeaf = {
  id: number;
  name: string;
  start: string;
  end: string;
};
export type DashaAntar = DashaPeriodLeaf & {
  pratyantardasha: DashaPeriodLeaf[];
};
export type DashaMaha = DashaPeriodLeaf & { antardasha: DashaAntar[] };
export type DashaBalance = {
  lord: DashaLord;
  duration: string;
  description: string;
};
export type VimshottariPayload = {
  status: "ok";
  data: { dasha_balance: DashaBalance; dasha_periods: DashaMaha[] };
};

// Canonical Parasara cycle. Order MUST NOT change.
const LORDS: Array<{
  id: number;
  name: string;
  vedic: string;
  years: number;
}> = [
  { id: 102, name: "Ketu", vedic: "Ketu", years: 7 },
  { id: 3, name: "Venus", vedic: "Shukra", years: 20 },
  { id: 0, name: "Sun", vedic: "Surya", years: 6 },
  { id: 1, name: "Moon", vedic: "Chandra", years: 10 },
  { id: 4, name: "Mars", vedic: "Mangala", years: 7 },
  { id: 101, name: "Rahu", vedic: "Rahu", years: 18 },
  { id: 5, name: "Jupiter", vedic: "Guru", years: 16 },
  { id: 6, name: "Saturn", vedic: "Shani", years: 19 },
  { id: 2, name: "Mercury", vedic: "Budha", years: 17 },
];
const CYCLE_YEARS = 120;
const NAK_SPAN = 360 / 27; // 13.333...

function pad2(n: number): string {
  return n < 10 ? "0" + n : String(n);
}

// Format an instant as YYYY-MM-DDTHH:mm:ss+HH:MM using a FIXED offset.
// Prokerala emits every dasha date in the birth-profile offset (no DST shifts).
function formatFixedOffset(instantMs: number, offsetMinutes: number): string {
  const shifted = new Date(instantMs + offsetMinutes * 60_000);
  const YYYY = String(shifted.getUTCFullYear()).padStart(4, "0");
  const MM = pad2(shifted.getUTCMonth() + 1);
  const DD = pad2(shifted.getUTCDate());
  const hh = pad2(shifted.getUTCHours());
  const mm = pad2(shifted.getUTCMinutes());
  const ss = pad2(shifted.getUTCSeconds());
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMinutes);
  return `${YYYY}-${MM}-${DD}T${hh}:${mm}:${ss}${sign}${pad2(Math.floor(abs / 60))}:${pad2(abs % 60)}`;
}

// ISO-8601 duration between two instants using calendar Y/M/D borrowing,
// matching Prokerala's dasha_balance.duration style (e.g. "P9Y8M6DT1H8M39S").
function isoDurationBetween(startMs: number, endMs: number): string {
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    return "P0D";
  }
  const s = new Date(startMs);
  const e = new Date(endMs);
  let years = e.getUTCFullYear() - s.getUTCFullYear();
  let months = e.getUTCMonth() - s.getUTCMonth();
  let days = e.getUTCDate() - s.getUTCDate();
  let hours = e.getUTCHours() - s.getUTCHours();
  let mins = e.getUTCMinutes() - s.getUTCMinutes();
  let secs = e.getUTCSeconds() - s.getUTCSeconds();
  if (secs < 0) {
    secs += 60;
    mins -= 1;
  }
  if (mins < 0) {
    mins += 60;
    hours -= 1;
  }
  if (hours < 0) {
    hours += 24;
    days -= 1;
  }
  if (days < 0) {
    const daysInPrevMonth = new Date(
      Date.UTC(e.getUTCFullYear(), e.getUTCMonth(), 0),
    ).getUTCDate();
    days += daysInPrevMonth;
    months -= 1;
  }
  if (months < 0) {
    months += 12;
    years -= 1;
  }
  const datePart =
    (years > 0 ? `${years}Y` : "") +
    (months > 0 ? `${months}M` : "") +
    (days > 0 ? `${days}D` : "");
  const timePart =
    (hours > 0 ? `${hours}H` : "") +
    (mins > 0 ? `${mins}M` : "") +
    (secs > 0 ? `${secs}S` : "");
  return "P" + (datePart || "0D") + (timePart ? "T" + timePart : "");
}

// Human summary matching Prokerala's dasha_balance.description ("9 years 8 months 6 days").
function humanDurationBetween(startMs: number, endMs: number): string {
  const iso = isoDurationBetween(startMs, endMs);
  const m = iso.match(/^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)D)?/);
  const y = Number(m?.[1] ?? 0);
  const mo = Number(m?.[2] ?? 0);
  const d = Number(m?.[3] ?? 0);
  return `${y} year${y === 1 ? "" : "s"} ${mo} month${mo === 1 ? "" : "s"} ${d} day${d === 1 ? "" : "s"}`;
}

// Build 9 sub-periods inside [parentStart, parentEnd], starting from
// startLordIdx in the cyclic order. Applies the sibling "+1s" convention and
// pins first.start / last.end to the parent's boundaries.
function buildChildren(
  startLordIdx: number,
  parentStartMs: number,
  parentEndMs: number,
  offsetMin: number,
): Array<{
  id: number;
  name: string;
  start: string;
  end: string;
  startMs: number;
  endMs: number;
}> {
  const parentSpan = parentEndMs - parentStartMs;
  // Continuous nominal cuts (floating), rounded to the nearest second at emit.
  const cuts: number[] = [parentStartMs];
  let acc = 0;
  for (let i = 0; i < 9; i++) {
    const lord = LORDS[(startLordIdx + i) % 9];
    acc += (lord.years / CYCLE_YEARS) * parentSpan;
    cuts.push(parentStartMs + acc);
  }
  cuts[cuts.length - 1] = parentEndMs; // pin last to parent

  const out: Array<{
    id: number;
    name: string;
    start: string;
    end: string;
    startMs: number;
    endMs: number;
  }> = [];
  for (let i = 0; i < 9; i++) {
    const lord = LORDS[(startLordIdx + i) % 9];
    // Round the internal cut to the nearest second; end always rounded.
    const endMs =
      i === 8 ? parentEndMs : Math.round(cuts[i + 1] / 1000) * 1000;
    const startMs =
      i === 0 ? parentStartMs : out[i - 1].endMs + 1000;
    out.push({
      id: lord.id,
      name: lord.name,
      start: formatFixedOffset(startMs, offsetMin),
      end: formatFixedOffset(endMs, offsetMin),
      startMs,
      endMs,
    });
  }
  return out;
}

export function computeVimshottariDashaPayload(args: {
  // Absolute 0-360 sidereal (Lahiri). Values outside the range are wrapped.
  moonSidLon: number;
  birthUtcMs: number;
  // Birth-profile offset in minutes (e.g. 330 for +05:30). All emitted dates
  // use this fixed offset — no DST logic.
  offsetMinutes: number;
  // Solar-year length in days. Default 365.25 (Prokerala's convention per
  // parity bake-off); parity script may override to 365.2422 or 360.0.
  yearDays?: number;
  // How many full 120y Vimshottari cycles to emit. 2 covers a human lifespan
  // regardless of nakshatra start; matches Prokerala.
  cycles?: number;
}): VimshottariPayload {
  const yearDays = args.yearDays ?? 365.25;
  const yearMs = yearDays * 86400 * 1000;
  const cycles = args.cycles ?? 2;

  const L = ((args.moonSidLon % 360) + 360) % 360;
  const nakIdx = Math.floor(L / NAK_SPAN); // 0..26
  const startLordIdx = nakIdx % 9;
  const fractionElapsed = (L - nakIdx * NAK_SPAN) / NAK_SPAN;

  // First mahadasha: full lord-length, ends at birth + remaining fraction,
  // starts before birth so the pre-birth portion is emitted (matches Prokerala).
  const firstLord = LORDS[startLordIdx];
  const firstFullMs = firstLord.years * yearMs;
  const firstEndMsRaw = args.birthUtcMs + firstFullMs * (1 - fractionElapsed);
  // Round to second precision to line up with the emitted string format.
  const firstEndMs = Math.round(firstEndMsRaw / 1000) * 1000;
  const firstStartMs = firstEndMs - firstFullMs;

  // Continuous mahadasha timeline. No +1s gap between mahadashas — Prokerala's
  // artifact chains them exactly (maha[i+1].start == maha[i].end).
  const mahaSpans: Array<{
    lordIdx: number;
    startMs: number;
    endMs: number;
  }> = [];
  {
    let curMs = firstStartMs;
    for (let c = 0; c < cycles; c++) {
      for (let i = 0; i < 9; i++) {
        const lord = LORDS[(startLordIdx + i) % 9];
        const spanMs = lord.years * yearMs;
        // Force the first maha to end at the second-rounded firstEndMs; all
        // subsequent mahadashas chain nominally.
        const endMs =
          mahaSpans.length === 0 ? firstEndMs : curMs + spanMs;
        mahaSpans.push({
          lordIdx: (startLordIdx + i) % 9,
          startMs: curMs,
          endMs,
        });
        curMs = endMs;
      }
    }
  }

  const dasha_periods: DashaMaha[] = mahaSpans.map((maha) => {
    const lord = LORDS[maha.lordIdx];
    const antars = buildChildren(
      maha.lordIdx,
      maha.startMs,
      maha.endMs,
      args.offsetMinutes,
    );
    return {
      id: lord.id,
      name: lord.name,
      start: formatFixedOffset(maha.startMs, args.offsetMinutes),
      end: formatFixedOffset(maha.endMs, args.offsetMinutes),
      antardasha: antars.map((a) => {
        const antarLordIdx = LORDS.findIndex((L2) => L2.id === a.id);
        const pratys = buildChildren(
          antarLordIdx,
          a.startMs,
          a.endMs,
          args.offsetMinutes,
        );
        return {
          id: a.id,
          name: a.name,
          start: a.start,
          end: a.end,
          pratyantardasha: pratys.map((p) => ({
            id: p.id,
            name: p.name,
            start: p.start,
            end: p.end,
          })),
        };
      }),
    };
  });

  const dasha_balance: DashaBalance = {
    lord: {
      id: firstLord.id,
      name: firstLord.name,
      vedic_name: firstLord.vedic,
    },
    duration: isoDurationBetween(args.birthUtcMs, firstEndMs),
    description: humanDurationBetween(args.birthUtcMs, firstEndMs),
  };

  return { status: "ok", data: { dasha_balance, dasha_periods } };
}

// ---------------------------------------------------------------------------
// CI-3.2 handler
// ---------------------------------------------------------------------------
type LordRef = { id: number; name: string };
type Period = { id: number; name: string; start: string; end: string };

function findActive(periods: Period[], atMs: number): Period | null {
  for (const p of periods) {
    const s = Date.parse(p.start);
    const e = Date.parse(p.end);
    if (Number.isFinite(s) && Number.isFinite(e) && atMs >= s && atMs < e) {
      return p;
    }
  }
  return null;
}

function signInfo(sidLon: number): { sign_index: number; sign: string } {
  const idx = Math.floor((((sidLon % 360) + 360) % 360) / 30);
  return { sign_index: idx, sign: ENG_SIGNS[idx] };
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
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE_KEY) {
    return err(500, "server_misconfigured", "Supabase env missing");
  }

  // Caller JWT -> uid (validates the session). Every DB call below is filtered
  // by this uid, so a user can only ever read/stamp their own rows.
  const authHeader = req.headers.get("Authorization") ?? "";
  const authClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userErr } = await authClient.auth.getUser();
  const user = userData?.user;
  if (userErr || !user) {
    return err(401, "unauthorized", "A valid session is required");
  }
  const uid = user.id;

  let body: { event_id?: string; force?: boolean };
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const eventId = body.event_id ? String(body.event_id).trim() : "";
  const force = body.force === true;

  const svc = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // 1) Birth profile (owner-scoped).
  const { data: birth, error: birthErr } = await svc
    .from("birth_profiles")
    .select(
      "birth_date, birth_time, birth_time_known, birth_timezone, latitude, longitude",
    )
    .eq("user_id", uid)
    .maybeSingle();
  if (birthErr) {
    return err(500, "read_failed", birthErr.message);
  }
  if (!birth || !birth.birth_date) {
    return err(409, "birth_profile_incomplete", "Birth details required");
  }

  const lat = Number(birth.latitude);
  const lon = Number(birth.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return err(409, "birth_profile_incomplete", "Birth coordinates required");
  }
  const tz = (birth.birth_timezone as string | null) ?? "Asia/Kolkata";
  const timeKnown = birth.birth_time_known !== false;
  const birthTime =
    timeKnown && birth.birth_time ? String(birth.birth_time) : "12:00:00";

  // 2) Natal Moon -> Vimshottari dasha timeline (reused validated math).
  let dashaMahas: any[] = [];
  let natalMoonSign: { sign_index: number; sign: string } = {
    sign_index: -1,
    sign: "",
  };
  try {
    const datetimeUsed = isoWithOffset(String(birth.birth_date), birthTime, tz);
    const natal: any = await computeNatalPayload(datetimeUsed, lat, lon);
    const planets: any[] = natal?.data?.planet_position ?? [];
    const moon = planets.find((p: any) => p?.id === 1);
    const moonSidLon = Number(moon?.longitude);
    if (!Number.isFinite(moonSidLon)) {
      throw new Error("could not resolve natal moon longitude");
    }
    natalMoonSign = signInfo(moonSidLon);
    const birthUtcMs = Date.parse(datetimeUsed);
    const offMatch = datetimeUsed.match(/([+-])(\d{2}):(\d{2})$/);
    const offsetMinutes = offMatch
      ? (offMatch[1] === "-" ? -1 : 1) *
        (Number(offMatch[2]) * 60 + Number(offMatch[3]))
      : 0;
    const dasha = computeVimshottariDashaPayload({
      moonSidLon,
      birthUtcMs,
      offsetMinutes,
    });
    dashaMahas = dasha.data.dasha_periods;
  } catch (e) {
    return err(500, "dasha_failed", (e as Error).message);
  }

  // 3) Load events to stamp (owner-scoped).
  let query = svc
    .from("user_life_events")
    .select("id, event_date, astro_context")
    .eq("user_id", uid);
  if (eventId) query = query.eq("id", eventId);
  const { data: events, error: evErr } = await query;
  if (evErr) {
    return err(500, "read_failed", evErr.message);
  }

  let stamped = 0;
  let skipped = 0;
  for (const ev of events ?? []) {
    const already =
      ev.astro_context &&
      typeof ev.astro_context === "object" &&
      (ev.astro_context as any).version;
    if (!ev.event_date || (already && !force)) {
      skipped++;
      continue;
    }
    const atMs = Date.parse(`${ev.event_date}T12:00:00Z`);
    if (!Number.isFinite(atMs)) {
      skipped++;
      continue;
    }

    // Dasha active on the event date.
    const dashaCtx: {
      maha: LordRef | null;
      antar: LordRef | null;
      pratyantar: LordRef | null;
    } = { maha: null, antar: null, pratyantar: null };
    const maha = findActive(dashaMahas as Period[], atMs);
    if (maha) {
      dashaCtx.maha = { id: maha.id, name: maha.name };
      const antar = findActive((maha as any).antardasha ?? [], atMs);
      if (antar) {
        dashaCtx.antar = { id: antar.id, name: antar.name };
        const praty = findActive((antar as any).pratyantardasha ?? [], atMs);
        if (praty) dashaCtx.pratyantar = { id: praty.id, name: praty.name };
      }
    }

    // Transits on the event date (Saturn + Jupiter are slow, so time-of-day is
    // irrelevant). lat/lon only drive the ascendant, which we ignore here.
    let saturnSign: { sign_index: number; sign: string } = {
      sign_index: -1,
      sign: "",
    };
    let jupiterSign: { sign_index: number; sign: string } = {
      sign_index: -1,
      sign: "",
    };
    let sadeSati: { active: boolean; phase: string | null } = {
      active: false,
      phase: null,
    };
    try {
      const t: any = await computeNatalPayload(
        `${ev.event_date}T12:00:00Z`,
        lat,
        lon,
      );
      const tp: any[] = t?.data?.planet_position ?? [];
      const sat = tp.find((p: any) => p?.id === 6);
      const jup = tp.find((p: any) => p?.id === 5);
      if (Number.isFinite(Number(sat?.longitude))) {
        saturnSign = signInfo(Number(sat.longitude));
        if (natalMoonSign.sign_index >= 0) {
          const rel =
            (saturnSign.sign_index - natalMoonSign.sign_index + 12) % 12;
          if (rel === 11) sadeSati = { active: true, phase: "rising" };
          else if (rel === 0) sadeSati = { active: true, phase: "peak" };
          else if (rel === 1) sadeSati = { active: true, phase: "setting" };
        }
      }
      if (Number.isFinite(Number(jup?.longitude))) {
        jupiterSign = signInfo(Number(jup.longitude));
      }
    } catch {
      // Transits are best-effort; the dasha context still stamps.
    }

    const astro_context = {
      version: 1,
      computed_at: new Date().toISOString(),
      engine: SWISS_ENGINE_VERSION,
      time_known: timeKnown,
      natal_moon: natalMoonSign,
      dasha: dashaCtx,
      transits: { saturn: saturnSign, jupiter: jupiterSign },
      sade_sati: sadeSati,
    };

    const { error: upErr } = await svc
      .from("user_life_events")
      .update({ astro_context, updated_at: new Date().toISOString() })
      .eq("id", ev.id)
      .eq("user_id", uid);
    if (upErr) {
      skipped++;
      continue;
    }
    stamped++;
  }

  return json(200, { stamped, skipped, total: (events ?? []).length });
});
