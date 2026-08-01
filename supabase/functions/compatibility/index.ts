// Supabase Edge Function: compatibility
// -----------------------------------------------------------------------------
// Guna Milan (Ashtakoota 36-guna) + Mangal / Manglik match + synastry house
// overlays between the LOGGED-IN user (birth_profiles) and ONE saved partner
// (public.related_charts, relation in wife/husband/partner only).
//
// SELF-CONTAINED by design: the sidereal positions engine is inlined (identical
// astronomy-engine + Lahiri config as chart-gateway / person-charts), so this
// function never imports from or mutates chart-gateway, birth_profiles,
// chart_facts, or chart_artifacts. Reads the user's own chart + the partner via
// the caller JWT so RLS keeps everything owner-only. Result is cached in
// public.related_chart_artifacts (chart_type = "compatibility") — no new table.
//
// Guna tables follow the standard Parashari Ashtakoota convention used by common
// Kundli software. Where classical sources disagree on fine gradations (Vashya
// partial scores, Yoni friend/enemy tiers) a documented, defensible
// simplification is used and can be tuned later.
//
// Request:  POST { related_chart_id: string, force_refresh?: boolean }
// Response: 200 { reused: boolean, data: <compatibility bundle> }
//
// Runtime: Deno (Supabase Edge Functions).

// @ts-ignore - Deno std import (resolved at deploy time)
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
// @ts-ignore - esm.sh import (resolved at deploy time)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const Deno: any;

// =============================================================================
// SECTION A — Sidereal positions engine (inlined verbatim from chart-gateway)
// =============================================================================

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
  const gastHours = A.SiderealTime(date);
  const ramc = eNorm360(gastHours * 15 + lonDeg);
  const eps = eMeanObliquity(T);
  const R = eD2r(ramc);
  const E = eD2r(eps);
  const P = eD2r(latDeg);
  const mc = eNorm360(eR2d(Math.atan2(Math.sin(R), Math.cos(R) * Math.cos(E))));
  let asc = eNorm360(
    eR2d(Math.atan2(Math.cos(R), -(Math.sin(R) * Math.cos(E) + Math.tan(P) * Math.sin(E)))),
  );
  if (eNorm360(asc - mc) > 180) asc = eNorm360(asc + 180);
  return eNorm360(asc - eAyanamsaDeg(T));
}

type Body = { id: number; name: string; longitude: number; sign: number; retro: boolean };

function eBody(id: number, name: string, sidLon: number, retro: boolean): Body {
  const L = eNorm360(sidLon);
  return { id, name, longitude: L, sign: Math.floor(L / 30), retro };
}

async function computeBodies(datetimeUsed: string, lat: number, lon: number): Promise<Body[]> {
  // @ts-ignore esm.sh import resolved at deploy/runtime
  const A: any = await import("https://esm.sh/astronomy-engine@2.1.19");
  const date = new Date(datetimeUsed);
  if (Number.isNaN(date.getTime())) throw new Error("invalid datetime for engine");
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
  const out: Body[] = [];
  for (const g of grahas) {
    const sid = eSiderealLonOfBody(A, g.body, date, g.ab, T);
    const retro = g.canRetro ? eIsRetrograde(A, g.body, date, g.ab) : false;
    out.push(eBody(g.id, g.name, sid, retro));
  }
  const rahu = eNorm360(eMeanNodeOfDate(T) - eAyanamsaDeg(T));
  out.push(eBody(101, "Rahu", rahu, true));
  out.push(eBody(102, "Ketu", eNorm360(rahu + 180), true));
  out.push(eBody(100, "Ascendant", eSiderealAscendant(A, date, lat, lon, T), false));
  return out;
}

// ---------- deterministic hashing + tz-aware ISO (from chart-gateway) ----------

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonicalJson).join(",") + "]";
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonicalJson(obj[k])).join(",") + "}";
}
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
function isoWithOffset(dateStr: string, timeStr: string, timeZone: string): string {
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

// =============================================================================
// SECTION B — Ashtakoota (36-guna), Mangal, synastry (pure math)
// =============================================================================

const NAK_SPAN = 360 / 27; // 13°20'
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

function nakOfLon(lon: number): { index: number; pada: number } {
  const L = eNorm360(lon);
  const index = Math.floor(L / NAK_SPAN);
  const pada = Math.floor((L - index * NAK_SPAN) / (NAK_SPAN / 4)) + 1;
  return { index, pada };
}

// ---- 1) Varna (max 1) ----
// water=Brahmin(4), fire=Kshatriya(3), earth=Vaishya(2), air=Shudra(1)
function varnaRank(sign: number): number {
  if (sign === 3 || sign === 7 || sign === 11) return 4; // water
  if (sign === 0 || sign === 4 || sign === 8) return 3; // fire
  if (sign === 1 || sign === 5 || sign === 9) return 2; // earth
  return 1; // air
}
const VARNA_NAME = { 4: "Brahmin", 3: "Kshatriya", 2: "Vaishya", 1: "Shudra" } as Record<
  number,
  string
>;
function varnaKuta(boySign: number, girlSign: number) {
  const b = varnaRank(boySign),
    g = varnaRank(girlSign);
  return { got: b >= g ? 1 : 0, max: 1, boy: VARNA_NAME[b], girl: VARNA_NAME[g] };
}

// ---- 2) Vashya (max 2) ----
// groups: 0 Nara(human) 1 Chatushpada(quadruped) 2 Jalachar(aquatic) 3 Vanachar(wild) 4 Keet(insect)
const VASHYA_GROUP = [1, 1, 0, 2, 3, 0, 0, 4, 0, 2, 0, 2];
const VASHYA_NAME = ["Nara", "Chatushpada", "Jalachar", "Vanachar", "Keet"];
function vashyaKuta(boySign: number, girlSign: number) {
  const b = VASHYA_GROUP[boySign],
    g = VASHYA_GROUP[girlSign];
  let got: number;
  if (b === g) got = 2;
  else if (b === 3 || g === 3)
    got = 0; // wild animal in the pair → no control
  else got = 1; // partial harmony
  return { got, max: 2, boy: VASHYA_NAME[b], girl: VASHYA_NAME[g] };
}

// ---- 3) Tara / Dina (max 3) ----
// count from one star to the other, mod 9; even remainder (incl. 0) is auspicious.
function taraHalf(fromNak: number, toNak: number): number {
  const count = ((toNak - fromNak + 27) % 27) + 1;
  const r = count % 9;
  return r % 2 === 0 ? 1.5 : 0;
}
function taraKuta(boyNak: number, girlNak: number) {
  const got = taraHalf(boyNak, girlNak) + taraHalf(girlNak, boyNak);
  return { got, max: 3 };
}

// ---- 4) Yoni (max 4) ----
// 14 animals; same=4, mortal-enemy pairs=0, otherwise neutral=2.
// (friend=3 / enemy=1 gradations simplified to neutral pending a full matrix.)
const YONI_ANIMAL = [
  0, 1, 2, 3, 3, 4, 5, 2, 5, 6, 6, 7, 8, 9, 8, 9, 10, 10, 4, 11, 12, 11, 13, 0, 13, 7, 1,
];
const YONI_NAME = [
  "Horse",
  "Elephant",
  "Sheep",
  "Serpent",
  "Dog",
  "Cat",
  "Rat",
  "Cow",
  "Buffalo",
  "Tiger",
  "Deer",
  "Monkey",
  "Mongoose",
  "Lion",
];
const YONI_ENEMIES: Array<[number, number]> = [
  [0, 8], // Horse - Buffalo
  [1, 13], // Elephant - Lion
  [2, 11], // Sheep - Monkey
  [3, 12], // Serpent - Mongoose
  [4, 10], // Dog - Deer
  [5, 6], // Cat - Rat
  [7, 9], // Cow - Tiger
];
function yoniKuta(boyNak: number, girlNak: number) {
  const b = YONI_ANIMAL[boyNak],
    g = YONI_ANIMAL[girlNak];
  let got: number;
  if (b === g) got = 4;
  else if (YONI_ENEMIES.some(([x, y]) => (x === b && y === g) || (x === g && y === b))) got = 0;
  else got = 2;
  return { got, max: 4, boy: YONI_NAME[b], girl: YONI_NAME[g] };
}

// ---- 5) Graha Maitri (max 5) ----
// natural friendship between the two Moon-sign lords.
const PLANET_FRIENDS: Record<string, { f: string[]; e: string[] }> = {
  Sun: { f: ["Moon", "Mars", "Jupiter"], e: ["Venus", "Saturn"] },
  Moon: { f: ["Sun", "Mercury"], e: [] },
  Mars: { f: ["Sun", "Moon", "Jupiter"], e: ["Mercury"] },
  Mercury: { f: ["Sun", "Venus"], e: ["Moon"] },
  Jupiter: { f: ["Sun", "Moon", "Mars"], e: ["Mercury", "Venus"] },
  Venus: { f: ["Mercury", "Saturn"], e: ["Sun", "Moon"] },
  Saturn: { f: ["Mercury", "Venus"], e: ["Sun", "Moon", "Mars"] },
};
function relation(a: string, b: string): "F" | "N" | "E" {
  if (a === b) return "F";
  const r = PLANET_FRIENDS[a];
  if (!r) return "N";
  if (r.f.includes(b)) return "F";
  if (r.e.includes(b)) return "E";
  return "N";
}
function maitriKuta(boySign: number, girlSign: number) {
  const bl = ENG_SIGN_LORDS[boySign],
    gl = ENG_SIGN_LORDS[girlSign];
  const rb = relation(bl, gl),
    rg = relation(gl, bl);
  const key = [rb, rg].sort().join("");
  let got = 3;
  if (bl === gl) got = 5;
  else if (key === "FF") got = 5;
  else if (key === "FN") got = 4;
  else if (key === "NN") got = 3;
  else if (key === "EF") got = 1;
  else if (key === "EN") got = 0.5;
  else if (key === "EE") got = 0;
  return { got, max: 5, boy: bl, girl: gl };
}

// ---- 6) Gana (max 6) ----
// 0 Deva, 1 Manushya, 2 Rakshasa
const NAK_GANA = [0, 1, 2, 1, 0, 1, 0, 0, 2, 2, 1, 1, 0, 2, 0, 2, 0, 2, 2, 1, 1, 0, 2, 2, 1, 1, 0];
const GANA_NAME = ["Deva", "Manushya", "Rakshasa"];
const GANA_MATRIX = [
  [6, 6, 0], // boy Deva
  [5, 6, 0], // boy Manushya
  [1, 0, 6], // boy Rakshasa
];
function ganaKuta(boyNak: number, girlNak: number) {
  const b = NAK_GANA[boyNak],
    g = NAK_GANA[girlNak];
  return { got: GANA_MATRIX[b][g], max: 6, boy: GANA_NAME[b], girl: GANA_NAME[g] };
}

// ---- 7) Bhakoot (max 7) ----
// 0 points for 2/12, 5/9, 6/8 moon-sign relationships; else 7.
function bhakootKuta(boySign: number, girlSign: number) {
  const ab = ((girlSign - boySign + 12) % 12) + 1;
  const ba = ((boySign - girlSign + 12) % 12) + 1;
  const pair = [ab, ba].sort((x, y) => x - y).join("-");
  const bad = pair === "2-12" || pair === "5-9" || pair === "6-8";
  return { got: bad ? 0 : 7, max: 7, relationship: `${ab}-${ba}` };
}

// ---- 8) Nadi (max 8) ----
// 0 Aadi, 1 Madhya, 2 Antya; same nadi → 0 (dosha), else 8.
const NAK_NADI = [0, 1, 2, 2, 1, 0, 0, 1, 2, 2, 1, 0, 0, 1, 2, 2, 1, 0, 0, 1, 2, 2, 1, 0, 0, 1, 2];
const NADI_NAME = ["Aadi", "Madhya", "Antya"];
function nadiKuta(boyNak: number, girlNak: number) {
  const b = NAK_NADI[boyNak],
    g = NAK_NADI[girlNak];
  return { got: b === g ? 0 : 8, max: 8, boy: NADI_NAME[b], girl: NADI_NAME[g] };
}

type MilanPerson = { moonSign: number; moonNak: number };
function ashtakoota(boy: MilanPerson, girl: MilanPerson) {
  const kutas = [
    { name: "Varna", ...varnaKuta(boy.moonSign, girl.moonSign) },
    { name: "Vashya", ...vashyaKuta(boy.moonSign, girl.moonSign) },
    { name: "Tara", ...taraKuta(boy.moonNak, girl.moonNak) },
    { name: "Yoni", ...yoniKuta(boy.moonNak, girl.moonNak) },
    { name: "Graha Maitri", ...maitriKuta(boy.moonSign, girl.moonSign) },
    { name: "Gana", ...ganaKuta(boy.moonNak, girl.moonNak) },
    { name: "Bhakoot", ...bhakootKuta(boy.moonSign, girl.moonSign) },
    { name: "Nadi", ...nadiKuta(boy.moonNak, girl.moonNak) },
  ];
  const total = kutas.reduce((s, k) => s + k.got, 0);
  let verdict: string;
  if (total >= 28) verdict = "excellent";
  else if (total >= 24) verdict = "very_good";
  else if (total >= 18) verdict = "good";
  else if (total >= 14) verdict = "average";
  else verdict = "needs_care";
  return { total, max: 36, kutas, verdict };
}

// ---- Mangal / Manglik dosha ----
const MANGLIK_HOUSES = new Set([1, 2, 4, 7, 8, 12]);
function houseFrom(refSign: number, planetSign: number): number {
  return ((planetSign - refSign + 12) % 12) + 1;
}
function mangalFor(marsSign: number, ascSign: number, moonSign: number) {
  const fromLagna = houseFrom(ascSign, marsSign);
  const fromMoon = houseFrom(moonSign, marsSign);
  return {
    mars_house_from_lagna: fromLagna,
    mars_house_from_moon: fromMoon,
    manglik_from_lagna: MANGLIK_HOUSES.has(fromLagna),
    manglik_from_moon: MANGLIK_HOUSES.has(fromMoon),
    manglik: MANGLIK_HOUSES.has(fromLagna),
  };
}

// ---- Synastry house overlays ----
const SYN_BODIES = [
  { id: 0, name: "Sun" },
  { id: 1, name: "Moon" },
  { id: 4, name: "Mars" },
  { id: 2, name: "Mercury" },
  { id: 5, name: "Jupiter" },
  { id: 3, name: "Venus" },
  { id: 6, name: "Saturn" },
  { id: 101, name: "Rahu" },
  { id: 102, name: "Ketu" },
];
function overlays(fromAscSign: number, otherBodies: Body[]) {
  const byId = new Map(otherBodies.map((b) => [b.id, b]));
  return SYN_BODIES.map(({ id, name }) => {
    const b = byId.get(id);
    if (!b) return null;
    return {
      planet: name,
      sign: b.sign,
      sign_name: ENG_SIGNS[b.sign],
      house: houseFrom(fromAscSign, b.sign),
    };
  }).filter(Boolean) as Array<{ planet: string; sign: number; sign_name: string; house: number }>;
}
const BENEFIC = new Set(["Venus", "Jupiter", "Moon"]);
const GOOD_HOUSES = new Set([1, 5, 7, 9, 11]);
function synastryHighlights(partnerInSelf: ReturnType<typeof overlays>) {
  const h: string[] = [];
  for (const o of partnerInSelf) {
    if (BENEFIC.has(o.planet) && GOOD_HOUSES.has(o.house))
      h.push(`partner_${o.planet.toLowerCase()}_in_self_${o.house}`);
    if (o.planet === "Saturn" && (o.house === 1 || o.house === 7))
      h.push(`partner_saturn_in_self_${o.house}`);
    if (o.planet === "Mars" && o.house === 7) h.push("partner_mars_in_self_7");
  }
  return h;
}

// =============================================================================
// SECTION C — HTTP handler
// =============================================================================

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

const COMPAT_RELATIONS = new Set(["wife", "husband", "partner"]);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeBirth(row: any) {
  const timeKnown = row.birth_time_known !== false;
  const rawTime = timeKnown && row.birth_time ? String(row.birth_time) : "12:00:00";
  const trimmed = rawTime.slice(0, 8);
  const normalizedTime = trimmed.length === 5 ? `${trimmed}:00` : trimmed.padEnd(8, "0");
  const timezone = String(row.birth_timezone || "Asia/Kolkata");
  const datetimeUsed = isoWithOffset(String(row.birth_date), normalizedTime, timezone);
  return { datetimeUsed, timezone, timeKnown };
}

async function bodiesFor(
  row: { birth_date: string; latitude: number; longitude: number },
  dt: string,
) {
  const lat = Number(row.latitude),
    lon = Number(row.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return await computeBodies(dt, lat, lon);
}

function personSummary(bodies: Body[]) {
  const moon = bodies.find((b) => b.id === 1)!;
  const asc = bodies.find((b) => b.id === 100)!;
  const sun = bodies.find((b) => b.id === 0)!;
  const nak = nakOfLon(moon.longitude);
  return {
    moonSign: moon.sign,
    moonNak: nak.index,
    moonPada: nak.pada,
    ascSign: asc.sign,
    sunSign: sun.sign,
    moon_sign_name: ENG_SIGNS[moon.sign],
    moon_nakshatra: NAKSHATRAS[nak.index],
    asc_sign_name: ENG_SIGNS[asc.sign],
  };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (req.method !== "POST") return err(405, "method_not_allowed", "Only POST is supported");

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
  if (!SUPABASE_URL || !ANON_KEY) return err(500, "server_misconfigured", "Supabase env missing");

  const authHeader = req.headers.get("Authorization") ?? "";
  const supabase = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  const user = userData?.user;
  if (userErr || !user) return err(401, "unauthorized", "A valid session is required");

  let body: { related_chart_id?: string; force_refresh?: boolean };
  try {
    body = await req.json();
  } catch {
    return err(400, "invalid_json", "Request body must be valid JSON");
  }
  const relatedChartId = String(body.related_chart_id ?? "").trim();
  if (!relatedChartId) return err(400, "missing_related_chart_id", "related_chart_id is required");
  const forceRefresh = body.force_refresh === true;

  // Self (logged-in user) chart from birth_profiles — RLS owner-only.
  const { data: self, error: selfErr } = await supabase
    .from("birth_profiles")
    .select(
      "full_name, gender, birth_date, birth_time, birth_time_known, latitude, longitude, birth_timezone",
    )
    .eq("user_id", user.id)
    .maybeSingle();
  if (selfErr) return err(500, "read_failed", selfErr.message);
  if (!self || !self.birth_date)
    return err(422, "no_self_profile", "Complete your own birth details first");

  // Partner from related_charts — RLS owner-only.
  const { data: partner, error: pErr } = await supabase
    .from("related_charts")
    .select(
      "id, full_name, relation, gender, birth_date, birth_time, birth_time_known, birth_place_label, latitude, longitude, birth_timezone",
    )
    .eq("id", relatedChartId)
    .maybeSingle();
  if (pErr) return err(500, "read_failed", pErr.message);
  if (!partner) return err(404, "not_found", "Saved person not found");
  if (!COMPAT_RELATIONS.has(String(partner.relation)))
    return err(
      422,
      "not_compat_eligible",
      "Compatibility is only available for a spouse or partner",
    );

  const selfBirth = normalizeBirth(self);
  const partnerBirth = normalizeBirth(partner);
  const dtOk = (s: string) =>
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
  if (!dtOk(selfBirth.datetimeUsed))
    return err(422, "invalid_self_datetime", "Your birth date/time is invalid");
  if (!dtOk(partnerBirth.datetimeUsed))
    return err(422, "invalid_partner_datetime", "Partner birth date/time is invalid");

  const inputHash = await sha256Hex(
    canonicalJson({
      kind: "compatibility_v1",
      engine: SWISS_ENGINE_VERSION,
      self: {
        dt: selfBirth.datetimeUsed,
        lat: Number(self.latitude),
        lon: Number(self.longitude),
        tc: selfBirth.timeKnown,
      },
      partner: {
        id: relatedChartId,
        dt: partnerBirth.datetimeUsed,
        lat: Number(partner.latitude),
        lon: Number(partner.longitude),
        tc: partnerBirth.timeKnown,
      },
    }),
  );

  // cache lookup
  const { data: cached } = await supabase
    .from("related_chart_artifacts")
    .select("data")
    .eq("related_chart_id", relatedChartId)
    .eq("chart_type", "compatibility")
    .eq("input_hash", inputHash)
    .maybeSingle();
  if (cached && !forceRefresh) return json(200, { reused: true, data: cached.data });

  let bundle: Record<string, unknown>;
  try {
    const selfBodies = await bodiesFor(self, selfBirth.datetimeUsed);
    const partnerBodies = await bodiesFor(partner, partnerBirth.datetimeUsed);
    if (!selfBodies)
      return err(422, "missing_self_coordinates", "Your birth coordinates are missing");
    if (!partnerBodies)
      return err(422, "missing_partner_coordinates", "Partner birth coordinates are missing");

    const selfSum = personSummary(selfBodies);
    const partnerSum = personSummary(partnerBodies);

    // Directional kutas need groom (boy) / bride (girl). Map by gender; if
    // ambiguous, default self=boy and flag the assumption.
    let boy = selfSum,
      girl = partnerSum,
      boyLabel = "self",
      assumedGender = false;
    if (self.gender === "female" && partner.gender === "male") {
      boy = partnerSum;
      girl = selfSum;
      boyLabel = "partner";
    } else if (!(self.gender === "male" && partner.gender === "female")) {
      assumedGender = true; // same/unknown gender — kept self as boy
    }

    const guna = ashtakoota(
      { moonSign: boy.moonSign, moonNak: boy.moonNak },
      { moonSign: girl.moonSign, moonNak: girl.moonNak },
    );

    const selfMars = selfBodies.find((b) => b.id === 4)!;
    const partnerMars = partnerBodies.find((b) => b.id === 4)!;
    const selfMangal = mangalFor(selfMars.sign, selfSum.ascSign, selfSum.moonSign);
    const partnerMangal = mangalFor(partnerMars.sign, partnerSum.ascSign, partnerSum.moonSign);
    let mangalVerdict: string;
    if (selfMangal.manglik && partnerMangal.manglik) mangalVerdict = "both_manglik_balanced";
    else if (!selfMangal.manglik && !partnerMangal.manglik) mangalVerdict = "none_manglik";
    else mangalVerdict = "one_manglik";

    const partnerInSelf = overlays(selfSum.ascSign, partnerBodies);
    const selfInPartner = overlays(partnerSum.ascSign, selfBodies);

    bundle = {
      version: "compatibility-v1",
      provider: "astronomy-engine",
      provider_version: SWISS_ENGINE_VERSION,
      related_chart_id: relatedChartId,
      assumed_gender: assumedGender,
      groom_is: boyLabel,
      self: {
        name: self.full_name,
        gender: self.gender,
        moon_sign: selfSum.moonSign,
        moon_sign_name: selfSum.moon_sign_name,
        moon_nakshatra_index: selfSum.moonNak,
        moon_nakshatra: selfSum.moon_nakshatra,
        asc_sign: selfSum.ascSign,
        asc_sign_name: selfSum.asc_sign_name,
      },
      partner: {
        related_chart_id: relatedChartId,
        name: partner.full_name,
        relation: partner.relation,
        gender: partner.gender,
        moon_sign: partnerSum.moonSign,
        moon_sign_name: partnerSum.moon_sign_name,
        moon_nakshatra_index: partnerSum.moonNak,
        moon_nakshatra: partnerSum.moon_nakshatra,
        asc_sign: partnerSum.ascSign,
        asc_sign_name: partnerSum.asc_sign_name,
      },
      guna_milan: guna,
      mangal: { self: selfMangal, partner: partnerMangal, verdict: mangalVerdict },
      synastry: {
        partner_planets_in_self_houses: partnerInSelf,
        self_planets_in_partner_houses: selfInPartner,
        highlights: synastryHighlights(partnerInSelf),
      },
    };
  } catch (e) {
    return err(
      500,
      "compute_failed",
      e instanceof Error ? e.message : "compatibility computation failed",
    );
  }

  try {
    await supabase
      .from("related_chart_artifacts")
      .upsert(
        {
          related_chart_id: relatedChartId,
          chart_type: "compatibility",
          input_hash: inputHash,
          data: bundle,
        },
        { onConflict: "related_chart_id,chart_type,input_hash" },
      );
  } catch (persistErr) {
    console.error("[compatibility] persist threw:", persistErr);
  }

  return json(200, { reused: false, data: bundle });
});
