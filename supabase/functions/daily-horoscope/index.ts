// Supabase Edge Function: daily-horoscope
// Calm, personalized daily reading. Grounds on the user's real natal chart +
// today's live sky (gochara) + current Vimshottari dasha, then asks the model
// for a gentle, structured JSON reading in the UI language. Cached one row per
// user / day / language in public.daily_horoscopes.
//
// Runtime: Deno (Supabase Edge Functions).
// Secrets required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
//   OPENROUTER_API_KEY, and optionally OPENROUTER_MODEL.

// @ts-ignore - esm.sh import (resolved at deploy time)
import {
  createClient,
  type SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2.45.4";
// Live ascendant now uses the LOCAL Swiss engine (astronomy-engine), loaded
// dynamically inside the handler — the same validated engine as chart-gateway.
// (Removed the old vedic-ephemeris getAscendant + blind +180deg hack.)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const Deno: any;

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

async function fetchWithTimeout(
  url: string,
  init: Record<string, unknown>,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal } as never);
  } finally {
    clearTimeout(id);
  }
}

// ---------- Chart normalization (ported from astrologer-chat) ----------
const NAKSHATRAS = [
  "Ashwini","Bharani","Krittika","Rohini","Mrigashira","Ardra","Punarvasu",
  "Pushya","Ashlesha","Magha","Purva Phalguni","Uttara Phalguni","Hasta",
  "Chitra","Swati","Vishakha","Anuradha","Jyeshtha","Mula","Purva Ashadha",
  "Uttara Ashadha","Shravana","Dhanishta","Shatabhisha","Purva Bhadrapada",
  "Uttara Bhadrapada","Revati",
];
const NAK_LORDS = ["Ketu","Venus","Sun","Moon","Mars","Rahu","Jupiter","Saturn","Mercury"];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ctxPick(obj: any, ...keys: string[]): any {
  for (const k of keys) if (obj && obj[k] != null) return obj[k];
  return undefined;
}
function ctxNum(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (v != null && v !== "" && !Number.isNaN(Number(v))) return Number(v);
  return null;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function deepFindArray(payload: any, keys: string[]): any[] {
  if (!payload || typeof payload !== "object") return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const queue: any[] = [payload];
  while (queue.length) {
    const cur = queue.shift();
    if (!cur || typeof cur !== "object") continue;
    for (const k of keys) if (Array.isArray(cur[k])) return cur[k];
    for (const v of Object.values(cur)) if (v && typeof v === "object") queue.push(v);
  }
  return [];
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isPlanetLike(o: any): boolean {
  return (
    !!o && typeof o === "object" &&
    (o.rasi != null || o.sign != null || o.zodiac != null || o.longitude != null)
  );
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractPlanetArray(payload: any): any[] {
  const keyed = deepFindArray(payload, ["planet_position", "planetPosition", "planets"]);
  if (keyed.length) return keyed;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const queue: any[] = [payload];
  while (queue.length) {
    const cur = queue.shift();
    if (!cur || typeof cur !== "object") continue;
    if (Array.isArray(cur)) {
      if (cur.length && cur.every(isPlanetLike)) return cur;
      for (const v of cur) if (v && typeof v === "object") queue.push(v);
      continue;
    }
    for (const v of Object.values(cur)) if (v && typeof v === "object") queue.push(v);
  }
  return [];
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ctxRasiId(p: any): number | null {
  const r = p?.rasi ?? p?.sign ?? p?.zodiac;
  return ctxNum(r?.id);
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ctxIsAsc(p: any): boolean {
  const name = String(p?.name ?? p?.planet ?? "").trim().toLowerCase();
  const id = p?.id;
  return name === "ascendant" || name === "lagna" || id === 100 || id === "100";
}
function ctxNakshatra(lonRaw: number): { name: string; lord: string; pada: number } | null {
  if (!Number.isFinite(lonRaw)) return null;
  const lon = ((lonRaw % 360) + 360) % 360;
  const SPAN = 360 / 27;
  const PADA = SPAN / 4;
  const idx = Math.floor(lon / SPAN);
  const pada = Math.floor((lon % SPAN) / PADA) + 1;
  return { name: NAKSHATRAS[idx], lord: NAK_LORDS[idx % 9], pada };
}
function ctxDate(s: unknown): string {
  const str = String(s ?? "");
  const d = new Date(str);
  if (Number.isNaN(d.getTime())) return str;
  return d.toISOString().slice(0, 10);
}

function navamsaSignIndex(lon: number): number {
  const L = ((lon % 360) + 360) % 360;
  return Math.floor(L / (30 / 9)) % 12;
}
type Dignity = { exaltSign: number; exaltDeg: number; debilSign: number; own: number[]; moola?: { sign: number; from: number; to: number } };
const DIGNITY: Record<string, Dignity> = {
  sun: { exaltSign: 0, exaltDeg: 10, debilSign: 6, own: [4], moola: { sign: 4, from: 0, to: 20 } },
  moon: { exaltSign: 1, exaltDeg: 3, debilSign: 7, own: [3] },
  mars: { exaltSign: 9, exaltDeg: 28, debilSign: 3, own: [0, 7], moola: { sign: 0, from: 0, to: 12 } },
  mercury: { exaltSign: 5, exaltDeg: 15, debilSign: 11, own: [2, 5] },
  jupiter: { exaltSign: 3, exaltDeg: 5, debilSign: 9, own: [8, 11], moola: { sign: 8, from: 0, to: 10 } },
  venus: { exaltSign: 11, exaltDeg: 27, debilSign: 5, own: [1, 6], moola: { sign: 6, from: 0, to: 15 } },
  saturn: { exaltSign: 6, exaltDeg: 20, debilSign: 0, own: [9, 10], moola: { sign: 10, from: 0, to: 20 } },
};
const PLANET_ALIAS: Record<string, string> = {
  surya: "sun", ravi: "sun", chandra: "moon", mangala: "mars", mangal: "mars",
  kuja: "mars", angaraka: "mars", budha: "mercury", budh: "mercury", guru: "jupiter",
  brihaspati: "jupiter", shukra: "venus", sukra: "venus", shani: "saturn", sani: "saturn",
};
const COMBUST_ORB: Record<string, { normal: number; retro?: number }> = {
  moon: { normal: 12 }, mars: { normal: 17 }, mercury: { normal: 14, retro: 12 },
  jupiter: { normal: 11 }, venus: { normal: 10, retro: 8 }, saturn: { normal: 15 },
};
function normPlanetKey(name: string): string {
  const n = name.trim().toLowerCase();
  return PLANET_ALIAS[n] ?? n;
}

// ---------- Explainability: "the chart behind this" ----------
// Short, plain-language facts derived from the SAME computed data used to
// build the prompt context below (natal placements, transits, dasha) — no
// new astronomy, just a structured echo of it for grounding/citation.
type ReasonKind = "natal" | "transit" | "dasha";
type ReasonDignity = "exalted" | "debilitated" | "own" | "neutral";
type Reason = {
  kind: ReasonKind;
  text: string;
  bodies?: string[];
  house?: number;
  sign?: string;
  dignity?: ReasonDignity;
};
function reasonDignity(states: string[]): ReasonDignity | undefined {
  if (states.includes("Exalted")) return "exalted";
  if (states.includes("Debilitated")) return "debilitated";
  if (states.includes("Own sign") || states.includes("Moolatrikona")) return "own";
  return undefined;
}

// Fact sentences are template-built (not model-authored), so they must be
// localized here explicitly — planet/sign names stay transliterated per
// design.md, only the surrounding grammar changes per language.
function factAscendant(lang: string, sign: string): string {
  if (lang === "hi") return `आपका लग्न ${sign} राशि में है।`;
  if (lang === "mr") return `तुमची लग्नरास ${sign} आहे.`;
  return `Your Ascendant (Lagna) is in ${sign}.`;
}
function factNatalPlanet(
  lang: string, name: string, signName: string, house: number,
  dignity: ReasonDignity | undefined, retro: boolean,
): string {
  let text: string;
  if (lang === "hi") {
    text = dignity === "exalted"
      ? `${name} ${signName} राशि में उच्च का है, भाव ${house} में — एक मज़बूत स्थिति।`
      : dignity === "debilitated"
        ? `${name} ${signName} राशि में नीच का है, भाव ${house} में — इसे थोड़े सहयोग की ज़रूरत है।`
        : dignity === "own"
          ? `${name} अपनी ही राशि ${signName} में है, भाव ${house} में — स्थिर और सहज।`
          : `${name} ${signName} राशि में है, भाव ${house} में।`;
    if (retro) text += " यह अभी वक्री है।";
  } else if (lang === "mr") {
    text = dignity === "exalted"
      ? `${name} ${signName} राशीत उच्च आहे, भाव ${house} मध्ये — एक बलवान स्थिती.`
      : dignity === "debilitated"
        ? `${name} ${signName} राशीत नीच आहे, भाव ${house} मध्ये — याला थोडा आधार हवा आहे.`
        : dignity === "own"
          ? `${name} स्वतःच्या राशीत ${signName} आहे, भाव ${house} मध्ये — स्थिर आणि आरामदायक.`
          : `${name} ${signName} राशीत आहे, भाव ${house} मध्ये.`;
    if (retro) text += " हा सध्या वक्री आहे.";
  } else {
    text = dignity === "exalted"
      ? `${name} is exalted in ${signName}, house ${house} — a strong placement.`
      : dignity === "debilitated"
        ? `${name} is debilitated in ${signName}, house ${house} — its energy needs gentle support.`
        : dignity === "own"
          ? `${name} is in its own sign ${signName}, house ${house} — steady and comfortable.`
          : `${name} is in ${signName}, house ${house}.`;
    if (retro) text += " It is retrograde right now.";
  }
  return text;
}
function factMoonTransit(lang: string, house: number, sign: string): string {
  if (lang === "hi") return `चंद्रमा आज आपके भाव ${house} में गोचर कर रहा है, ${sign} राशि में।`;
  if (lang === "mr") return `चंद्र आज तुमच्या भाव ${house} मध्ये गोचर करत आहे, ${sign} राशीत.`;
  return `The Moon is transiting your house ${house} today, in ${sign}.`;
}
function factPlanetTransit(lang: string, name: string, house: number, sign: string, retro: boolean): string {
  if (lang === "hi") return `गोचर में ${name} अभी आपके भाव ${house} में है, ${sign} राशि में${retro ? " (वक्री)" : ""}।`;
  if (lang === "mr") return `गोचरात ${name} सध्या तुमच्या भाव ${house} मध्ये आहे, ${sign} राशीत${retro ? " (वक्री)" : ""}.`;
  return `Transiting ${name} is in your house ${house} right now, in ${sign}${retro ? " (retrograde)" : ""}.`;
}
function factDasha(lang: string, maha: string, antar?: string): string {
  if (antar) {
    if (lang === "hi") return `आप अभी अपनी ${maha}–${antar} दशा में हैं।`;
    if (lang === "mr") return `तुम्ही सध्या तुमच्या ${maha}–${antar} दशेत आहात.`;
    return `You're in your ${maha}–${antar} period right now.`;
  }
  if (lang === "hi") return `आप अभी अपनी ${maha} महादशा में हैं।`;
  if (lang === "mr") return `तुम्ही सध्या तुमच्या ${maha} महादशेत आहात.`;
  return `You're in your ${maha} Mahadasha right now.`;
}
function angularSep(a: number, b: number): number {
  let d = Math.abs(a - b) % 360;
  if (d > 180) d = 360 - d;
  return d;
}
function planetStates(args: {
  name: string; lon: number | null; degInSign: number | null;
  signIdx: number | null; retro: boolean; sunLon: number | null;
}): string[] {
  const { name, lon, degInSign, signIdx, retro, sunLon } = args;
  const key = normPlanetKey(name);
  const tags: string[] = [];
  const dig = DIGNITY[key];
  if (dig && signIdx != null) {
    if (signIdx === dig.exaltSign) tags.push("Exalted");
    else if (signIdx === dig.debilSign) tags.push("Debilitated");
    else if (dig.moola && signIdx === dig.moola.sign && degInSign != null && degInSign >= dig.moola.from && degInSign <= dig.moola.to) tags.push("Moolatrikona");
    else if (dig.own.includes(signIdx)) tags.push("Own sign");
  }
  const orb = COMBUST_ORB[key];
  if (orb && lon != null && sunLon != null) {
    const limit = retro && orb.retro != null ? orb.retro : orb.normal;
    if (angularSep(lon, sunLon) <= limit) tags.push("Combust");
  }
  if (lon != null && signIdx != null && navamsaSignIndex(lon) === signIdx) tags.push("Vargottama");
  if (retro) tags.push("Retrograde");
  return tags;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatNatal(natal: any, lang: string): { text: string; facts: Reason[] } | null {
  const arr = extractPlanetArray(natal);
  if (!arr.length) return null;
  const asc = arr.find(ctxIsAsc);
  const ascRasiId = asc ? ctxRasiId(asc) : null;
  const lines: string[] = [];
  const facts: Reason[] = [];
  if (asc) {
    const ascRasi = asc.rasi ?? asc.sign ?? asc.zodiac ?? {};
    const ascSign = String(ascRasi?.name ?? "");
    const ascDeg = ctxNum(ctxPick(asc, "degree"));
    const ascLon = ctxNum(ctxPick(asc, "longitude", "long", "lon"));
    const deg = ascDeg != null ? ascDeg : ascLon != null ? ascLon % 30 : null;
    lines.push(`Ascendant (Lagna): ${ascSign || "?"}${deg != null ? " " + deg.toFixed(2) + "\u00B0" : ""}`);
    if (ascSign) {
      facts.push({
        kind: "natal",
        text: factAscendant(lang, ascSign),
        bodies: ["Ascendant"],
        sign: ascSign,
      });
    }
  }
  const sunEntry = arr.find((p) => !ctxIsAsc(p) && normPlanetKey(String(ctxPick(p, "name", "planet") ?? "")) === "sun");
  let sunLon: number | null = null;
  if (sunEntry) {
    const sLon = ctxNum(ctxPick(sunEntry, "longitude", "long", "lon"));
    const sRasi = ctxRasiId(sunEntry);
    const sDeg = ctxNum(ctxPick(sunEntry, "degree"));
    sunLon = sLon != null ? sLon : sRasi != null && sDeg != null ? sRasi * 30 + sDeg : null;
  }
  let planetCount = 0;
  for (const p of arr) {
    if (ctxIsAsc(p)) continue;
    const name = String(ctxPick(p, "name", "planet") ?? "").trim();
    if (!name) continue;
    const rasi = p.rasi ?? p.sign ?? p.zodiac ?? {};
    const signName = String(rasi?.name ?? "");
    const rasiId = ctxRasiId(p);
    let house: number | null = null;
    if (ascRasiId != null && rasiId != null) house = ((rasiId - ascRasiId + 12) % 12) + 1;
    const degRaw = ctxNum(ctxPick(p, "degree"));
    const lon = ctxNum(ctxPick(p, "longitude", "long", "lon"));
    const degInSign = degRaw != null ? degRaw : lon != null ? lon % 30 : null;
    const nak = lon != null ? ctxNakshatra(lon) : null;
    const retro = Boolean(ctxPick(p, "is_retrograde", "isRetrograde", "retrograde", "retro"));
    const parts = [
      `${name}:`,
      `${signName || "?"}${degInSign != null ? " " + degInSign.toFixed(2) + "\u00B0" : ""}`,
      house != null ? `in House ${house}` : "in House ?",
    ];
    if (nak) parts.push(`nakshatra ${nak.name} pada ${nak.pada}`);
    const effLon = lon != null ? lon : rasiId != null && degInSign != null ? rasiId * 30 + degInSign : null;
    const states = planetStates({ name, lon: effLon, degInSign, signIdx: rasiId, retro, sunLon });
    if (states.length) parts.push(`[${states.join(", ")}]`);
    lines.push("- " + parts.join(" "));
    planetCount++;

    if (signName && house != null) {
      const dignity = reasonDignity(states);
      const text = factNatalPlanet(lang, name, signName, house, dignity, states.includes("Retrograde"));
      facts.push({ kind: "natal", text, bodies: [name], house, sign: signName, dignity });
    }
  }
  if (!planetCount) return null;
  return { text: lines.join("\n"), facts };
}

// ---------- Current sky (gochara) ----------
const SIGN_FULL = ["Aries","Taurus","Gemini","Cancer","Leo","Virgo","Libra","Scorpio","Sagittarius","Capricorn","Aquarius","Pisces"];
function skyNorm360(x: number): number { return ((x % 360) + 360) % 360; }
function skySignName(idx: number): string { return Number.isInteger(idx) && idx >= 0 && idx < 12 ? SIGN_FULL[idx] : "?"; }
function skyNakName(idx: number | null): string { return idx != null && Number.isInteger(idx) && idx >= 0 && idx < 27 ? NAKSHATRAS[idx] : "?"; }

// ---------- Live sidereal ascendant (local Swiss engine, Lahiri) ----------
// Ported verbatim from chart-gateway / positions.mjs. Resolves the 180deg
// ascendant ambiguity via the MC — fixing the exact bug the old vedic-ephemeris
// path patched over with a blind +180.
const ASC_AYANAMSA_J2000 = 23.85292;
const ascNorm360 = (x: number): number => ((x % 360) + 360) % 360;
const ascD2r = (d: number): number => (d * Math.PI) / 180;
const ascR2d = (r: number): number => (r * 180) / Math.PI;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ascJulianCenturiesTT(A: any, date: Date): number { return A.MakeTime(date).tt / 36525; }
function ascAyanamsaDeg(T: number): number { return ASC_AYANAMSA_J2000 + 1.3969713 * T + 0.0003086 * T * T; }
function ascMeanObliquity(T: number): number { return 23.4392911 - 0.0130041667 * T - 1.638889e-7 * T * T + 5.036111e-7 * T * T * T; }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function eSiderealAscendant(A: any, date: Date, latDeg: number, lonDeg: number): number {
  const T = ascJulianCenturiesTT(A, date);
  const gastHours = A.SiderealTime(date); // Greenwich apparent sidereal time (hours)
  const ramc = ascNorm360(gastHours * 15 + lonDeg);
  const eps = ascMeanObliquity(T);
  const R = ascD2r(ramc), E = ascD2r(eps), P = ascD2r(latDeg);
  const mc = ascNorm360(ascR2d(Math.atan2(Math.sin(R), Math.cos(R) * Math.cos(E))));
  let asc = ascNorm360(ascR2d(Math.atan2(Math.cos(R), -(Math.sin(R) * Math.cos(E) + Math.tan(P) * Math.sin(E)))));
  if (ascNorm360(asc - mc) > 180) asc = ascNorm360(asc + 180);
  return ascNorm360(asc - ascAyanamsaDeg(T));
}
function skyHouse(signIdx: number, refSignIdx: number | null): number | null {
  if (refSignIdx == null || !Number.isInteger(signIdx)) return null;
  return ((signIdx - refSignIdx + 12) % 12) + 1;
}
function skyDeg(deg: number | null): string { return deg != null && Number.isFinite(deg) ? deg.toFixed(2) + "\u00B0" : ""; }
const TRANSIT_PLANET_ORDER = [
  { id: 0, name: "Sun" }, { id: 2, name: "Mercury" }, { id: 3, name: "Venus" },
  { id: 4, name: "Mars" }, { id: 5, name: "Jupiter" }, { id: 6, name: "Saturn" },
  { id: 101, name: "Rahu" }, { id: 102, name: "Ketu" },
];
type TransitPlanetRow = { planet: number; sign: number; deg: number | null; nakshatra: number | null; pada: number | null; retrograde: boolean | null; next_ingress_ts: string | null; next_sign: number | null };
type MoonRow = { slot_hour: number; slot_ts: string; moon_sign: number; moon_deg: number | null; moon_nakshatra: number | null; moon_pada: number | null };
function skyIngressNote(nextTs: string | null, nextSign: number | null): string {
  if (!nextTs || nextSign == null) return "";
  const d = new Date(nextTs);
  if (Number.isNaN(d.getTime())) return "";
  const days = Math.round((d.getTime() - Date.now()) / 86400000);
  if (days < 0 || days > 45) return "";
  const when = d.toISOString().slice(0, 10);
  return " [enters " + skySignName(nextSign) + " ~" + when + (days <= 14 ? " (~" + days + "d)" : "") + "]";
}
function formatCurrentSky(args: {
  planets: TransitPlanetRow[]; moon: MoonRow | null;
  natalAscSign: number | null; natalMoonSign: number | null;
  liveAsc: { sign: number; deg: number } | null;
  lang: string;
}): { text: string; facts: Reason[] } | null {
  const { planets, moon, natalAscSign, natalMoonSign, liveAsc, lang } = args;
  const byId: Record<number, TransitPlanetRow> = {};
  for (const p of planets) byId[p.planet] = p;
  const lines: string[] = [];
  const facts: Reason[] = [];
  if (liveAsc) {
    const nk = ctxNakshatra(liveAsc.sign * 30 + liveAsc.deg);
    lines.push("Ascendant rising NOW: " + skySignName(liveAsc.sign) + " " + skyDeg(liveAsc.deg) + (nk ? " - nakshatra " + nk.name + " pada " + nk.pada : ""));
  }
  if (moon) {
    const h = skyHouse(moon.moon_sign, natalAscSign);
    lines.push("Moon: " + skySignName(moon.moon_sign) + " " + skyDeg(moon.moon_deg) + (h != null ? " - House " + h : "") + (moon.moon_nakshatra != null ? " - nakshatra " + skyNakName(moon.moon_nakshatra) + " pada " + (moon.moon_pada ?? "?") : ""));
    if (h != null) {
      facts.push({
        kind: "transit",
        text: factMoonTransit(lang, h, skySignName(moon.moon_sign)),
        bodies: ["Moon"],
        house: h,
        sign: skySignName(moon.moon_sign),
      });
    }
  }
  for (const entry of TRANSIT_PLANET_ORDER) {
    const p = byId[entry.id];
    if (!p) continue;
    const h = skyHouse(p.sign, natalAscSign);
    const retro = p.retrograde ? " (R)" : "";
    const nk = p.nakshatra != null ? " - nakshatra " + skyNakName(p.nakshatra) + " pada " + (p.pada ?? "?") : "";
    lines.push(entry.name + ": " + skySignName(p.sign) + " " + skyDeg(p.deg) + retro + (h != null ? " - House " + h : "") + nk + skyIngressNote(p.next_ingress_ts, p.next_sign));
    if (h != null) {
      facts.push({
        kind: "transit",
        text: factPlanetTransit(lang, entry.name, h, skySignName(p.sign), Boolean(p.retrograde)),
        bodies: [entry.name],
        house: h,
        sign: skySignName(p.sign),
      });
    }
  }
  if (!lines.length) return null;
  const ref = "Houses above are whole-sign from the natal Ascendant (" + (natalAscSign != null ? skySignName(natalAscSign) : "?") + "). Natal Moon sign is " + (natalMoonSign != null ? skySignName(natalMoonSign) : "?") + ".";
  return { text: lines.join("\n") + "\n" + ref, facts };
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatDasha(dasha: any, lang: string): { text: string; facts: Reason[] } | null {
  const periods = deepFindArray(dasha, ["dasha_periods", "dashaPeriods"]);
  if (!periods.length) return null;
  const now = Date.now();
  const lines: string[] = [];
  const facts: Reason[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const within = (x: any) => {
    const s = new Date(x?.start).getTime();
    const e = new Date(x?.end).getTime();
    return Number.isFinite(s) && Number.isFinite(e) && now >= s && now <= e;
  };
  const curMaha = periods.find(within);
  if (curMaha) {
    lines.push(`Current Mahadasha: ${curMaha.name} (${ctxDate(curMaha.start)} to ${ctxDate(curMaha.end)}).`);
    const antars = Array.isArray(curMaha.antardasha) ? curMaha.antardasha : [];
    const curAntar = antars.find(within);
    if (curAntar) {
      lines.push(`Current Antardasha: ${curMaha.name}-${curAntar.name} (${ctxDate(curAntar.start)} to ${ctxDate(curAntar.end)}).`);
      facts.push({
        kind: "dasha",
        text: factDasha(lang, curMaha.name, curAntar.name),
        bodies: [curMaha.name, curAntar.name],
      });
    } else {
      facts.push({
        kind: "dasha",
        text: factDasha(lang, curMaha.name),
        bodies: [curMaha.name],
      });
    }
  }
  return lines.length ? { text: lines.join("\n"), facts } : null;
}

// ---------- Language + safe JSON parse ----------
const LANG_NAME: Record<string, string> = { en: "English", hi: "Hindi (Devanagari script)", mr: "Marathi (Devanagari script)" };
function parseModelJson(raw: string): Record<string, unknown> | null {
  let s = raw.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  const first = s.indexOf("{");
  const last = s.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) s = s.slice(first, last + 1);
  try { return JSON.parse(s); } catch { return null; }
}

const AREA_KEYS = ["general", "work", "relationships", "wellbeing"];

// Whitelist model-returned reason indices against the real facts array —
// the model can only select from provided facts, never invent one.
function validIndices(raw: unknown, max: number): number[] {
  if (!Array.isArray(raw)) return [];
  const out: number[] = [];
  for (const v of raw) {
    const n = typeof v === "number" ? v : Number(v);
    if (Number.isInteger(n) && n >= 0 && n < max && !out.includes(n)) out.push(n);
  }
  return out.slice(0, 4);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (req.method !== "POST") return err(405, "method_not_allowed", "Only POST is supported");

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
  const MODEL = Deno.env.get("OPENROUTER_MODEL") || "google/gemini-2.0-flash-001";
  if (!SUPABASE_URL || !SERVICE_KEY) return err(500, "server_misconfigured", "Supabase env missing");
  if (!OPENROUTER_API_KEY) return err(500, "server_misconfigured", "OpenRouter API key missing");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any = {};
  try { body = await req.json(); } catch { body = {}; }
  const langRaw = String(body.lang ?? "en").toLowerCase();
  const lang = LANG_NAME[langRaw] ? langRaw : "en";
  const force = body.force === true;

  // ---- Auth: normal in-app (login token) OR service-role (explicit user_id) ----
  // When called with the service key + an explicit user_id (e.g. from
  // build-guidance / the scheduled WhatsApp send), generate for that user.
  // Otherwise behave exactly as before: derive the user from their login token.
  const authHeader = req.headers.get("Authorization") ?? "";
  const bearer = authHeader.replace(/^Bearer\s+/i, "").trim();
  const bodyUserId = typeof body.user_id === "string" ? body.user_id.trim() : "";

  let userId: string;
  if (bodyUserId && bearer && bearer === SERVICE_KEY) {
    // Service-role invocation. The service key is a server-only secret,
    // so trusting body.user_id here is safe.
    userId = bodyUserId;
  } else {
    // Normal in-app flow: derive the user from their login token.
    const authClient: SupabaseClient = createClient(SUPABASE_URL, SERVICE_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userErr } = await authClient.auth.getUser();
    if (userErr || !userData?.user) return err(401, "not_authenticated");
    userId = userData.user.id;
  }

  const svc: SupabaseClient = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Birth profile (for timezone, lat/lon, name).
  const { data: birth } = await svc
    .from("birth_profiles")
    .select("full_name, birth_timezone, latitude, longitude")
    .eq("user_id", userId)
    .maybeSingle();

  const tz = birth?.birth_timezone || "Asia/Kolkata";
  const todayIso = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());

  // Cache hit?
  if (!force) {
    const { data: cached } = await svc
      .from("daily_horoscopes")
      .select("summary, areas, focus, lucky, model, reasons")
      .eq("user_id", userId)
      .eq("horoscope_date", todayIso)
      .eq("lang", lang)
      .maybeSingle();
    if (cached) {
      return json(200, {
        ok: true, cached: true, date: todayIso, lang,
        summary: cached.summary, areas: cached.areas ?? [],
        focus: cached.focus ?? null, lucky: cached.lucky ?? null, model: cached.model,
        reasons: cached.reasons ?? null,
      });
    }
  }

  // Grounding: natal + dasha artifacts.
  const { data: arts } = await svc
    .from("chart_artifacts")
    .select("chart_type, chart_jsonb, created_at")
    .eq("user_id", userId)
    .in("chart_type", ["natal", "vimshottari_dasha"])
    .order("created_at", { ascending: false })
    .limit(10);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const byType: Record<string, any> = {};
  for (const a of arts ?? []) if (!(a.chart_type in byType)) byType[a.chart_type] = a.chart_jsonb;

  const natalResult = byType.natal ? formatNatal(byType.natal, lang) : null;
  if (!natalResult) {
    // No computed chart yet — let the client show a "complete your profile" state.
    return json(200, { ok: true, incomplete: true, date: todayIso, lang });
  }
  const natalText = natalResult.text;

  // Natal ascendant + moon sign for gochara houses.
  let natalAscSign: number | null = null;
  let natalMoonSign: number | null = null;
  {
    const natalArr = extractPlanetArray(byType.natal);
    const ascP = natalArr.find(ctxIsAsc);
    natalAscSign = ascP ? ctxRasiId(ascP) : null;
    const moonP = natalArr.find((p) => !ctxIsAsc(p) && normPlanetKey(String(ctxPick(p, "name", "planet") ?? "")) === "moon");
    natalMoonSign = moonP ? ctxRasiId(moonP) : null;
  }

  // Current sky.
  let skyText: string | null = null;
  let skyFacts: Reason[] = [];
  try {
    const { data: transitPlanets } = await svc
      .from("transit_planets")
      .select("planet, sign, deg, nakshatra, pada, retrograde, next_ingress_ts, next_sign");
    const { data: moonRows } = await svc
      .from("transit_moon_hourly")
      .select("slot_hour, slot_ts, moon_sign, moon_deg, moon_nakshatra, moon_pada");
    let moon: MoonRow | null = null;
    if (Array.isArray(moonRows) && moonRows.length) {
      const nowMs = Date.now();
      let best = Infinity;
      for (const r of moonRows) {
        const t = new Date(r.slot_ts).getTime();
        if (Number.isNaN(t)) continue;
        const diff = Math.abs(t - nowMs);
        if (diff < best) { best = diff; moon = r as MoonRow; }
      }
    }
    let liveAsc: { sign: number; deg: number } | null = null;
    const lat = ctxNum(birth?.latitude);
    const lon = ctxNum(birth?.longitude);
    if (lat != null && lon != null) {
      try {
        const A = await import("https://esm.sh/astronomy-engine@2.1.19");
        const ascLon = eSiderealAscendant(A, new Date(), lat, lon);
        liveAsc = { sign: Math.floor(ascLon / 30) % 12, deg: ascLon % 30 };
      } catch (_e) { liveAsc = null; }
    }
    const skyResult = formatCurrentSky({
      planets: (transitPlanets ?? []) as TransitPlanetRow[],
      moon, natalAscSign, natalMoonSign, liveAsc, lang,
    });
    skyText = skyResult?.text ?? null;
    skyFacts = skyResult?.facts ?? [];
  } catch (_e) { skyText = null; skyFacts = []; }

  const dashaResult = byType.vimshottari_dasha ? formatDasha(byType.vimshottari_dasha, lang) : null;
  const dashaText = dashaResult?.text ?? null;

  const facts: Reason[] = [...natalResult.facts, ...skyFacts, ...(dashaResult?.facts ?? [])].slice(0, 24);
  const factsListText = facts.map((f, i) => `[${i}] ${f.text}`).join("\n");

  const firstName = String(birth?.full_name ?? "").trim().split(/\s+/)[0] || "";
  const todayLabel = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz, weekday: "long", day: "numeric", month: "long", year: "numeric",
  }).format(new Date());

  const context = [
    firstName ? `Person's first name: ${firstName}` : "",
    `Today: ${todayLabel} (${tz}).`,
    "",
    "NATAL CHART (kundali) — authoritative placements, whole-sign houses from the Ascendant. Use these exact values:",
    natalText,
    "",
    skyText ? "CURRENT SKY (gochara / live transits) — where planets are right now. Read verbatim; never recompute:\n" + skyText : "",
    "",
    dashaText ? "CURRENT VIMSHOTTARI DASHA (active planetary period):\n" + dashaText : "",
  ].filter(Boolean).join("\n");

  const systemPrompt = [
    "You are AstroSaathi, a warm, wise Vedic (Jyotish) astrologer working in the Parasara tradition with the Lahiri sidereal ayanamsa.",
    "Write a gentle, encouraging DAILY reading for this person for today, grounded ONLY in the chart facts and transits given below.",
    "",
    "TONE (must follow):",
    "- Calm, kind, hopeful and empowering. Like a caring friend, not a report.",
    "- NEVER use fear, alarm, urgency, warnings of danger, doom, or pressure. No 'beware', 'danger', 'avoid at all costs', 'must', deadlines, or scare language.",
    "- Frame any challenge softly as a gentle invitation to be mindful, always with a constructive, reassuring note.",
    "- Base everything on the real placements/transits/dasha provided. NEVER invent positions, numbers, or facts not present below. Keep it specific but not technical/jargony.",
    "",
    `LANGUAGE: Write ALL text values in ${LANG_NAME[lang]}. Keep sentences natural and warm.`,
    "",
    "OUTPUT: Return ONLY a JSON object (no markdown, no commentary) with EXACTLY this shape:",
    "{",
    '  "summary": "2-3 warm sentences about the overall feel of today for this person",',
    '  "summaryReasons": [0, 2],',
    '  "areas": [',
    '    { "key": "general", "text": "1-2 gentle sentences", "reasons": [1] },',
    '    { "key": "work", "text": "1-2 gentle sentences on work/study/focus", "reasons": [] },',
    '    { "key": "relationships", "text": "1-2 gentle sentences on relationships/family", "reasons": [] },',
    '    { "key": "wellbeing", "text": "1-2 gentle sentences on mind & body wellbeing", "reasons": [] }',
    "  ],",
    '  "focus": "one short, gentle suggestion to carry through the day",',
    '  "lucky": { "color": "a calming colour", "number": "a single number", "direction": "a compass direction" }',
    "}",
    "Use exactly these four area keys in this order. Keep the whole thing concise and soothing.",
    '"summaryReasons" and each area\'s "reasons" are arrays of 0-based indices into the FACTS list below — include ONLY indices whose fact genuinely supports that line (an empty array is fine if none clearly apply). Never invent an index or a fact not in the list.',
    "",
    "FACTS (reference ONLY by these exact indices):",
    facts.length ? factsListText : "(none)",
    "",
    "Chart facts and transits (ground truth, for your understanding):",
    context,
  ].join("\n");

  let parsed: Record<string, unknown> | null = null;
  try {
    const orRes = await fetchWithTimeout(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "HTTP-Referer": "https://astrosathi.app",
          "X-Title": "AstroSaathi",
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: "Give me my calm daily reading for today as JSON only." },
          ],
          temperature: 0.7,
          max_tokens: 1100,
          response_format: { type: "json_object" },
        }),
      },
      45000,
    );
    const orJson = await orRes.json();
    if (!orRes.ok) return err(502, "provider_error", orJson?.error?.message || `OpenRouter HTTP ${orRes.status}`);
    const content = String(orJson?.choices?.[0]?.message?.content ?? "").trim();
    parsed = parseModelJson(content);
  } catch (e) {
    return err(504, "provider_timeout", String((e as Error)?.message ?? e));
  }
  if (!parsed || typeof parsed.summary !== "string" || !parsed.summary.trim()) {
    return err(502, "provider_empty", "Model returned an unusable response");
  }

  // Normalize areas to the four expected keys, in order.
  const rawAreas = Array.isArray(parsed.areas) ? parsed.areas : [];
  const areaText: Record<string, string> = {};
  const areaReasonIdx: Record<string, number[]> = {};
  for (const a of rawAreas) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const key = String((a as any)?.key ?? "").toLowerCase();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const text = String((a as any)?.text ?? "").trim();
    if (AREA_KEYS.includes(key) && text) {
      areaText[key] = text;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      areaReasonIdx[key] = validIndices((a as any)?.reasons, facts.length);
    }
  }
  const areas = AREA_KEYS.filter((k) => areaText[k]).map((k) => ({ key: k, text: areaText[k] }));
  const summaryReasonIdx = validIndices(parsed.summaryReasons, facts.length);
  const reasons = {
    summary: summaryReasonIdx.map((i) => facts[i]),
    areas: Object.fromEntries(
      AREA_KEYS.filter((k) => areaText[k]).map((k) => [k, (areaReasonIdx[k] ?? []).map((i) => facts[i])]),
    ),
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const luckyRaw = (parsed.lucky as any) ?? null;
  const lucky = luckyRaw && typeof luckyRaw === "object"
    ? {
        color: luckyRaw.color != null ? String(luckyRaw.color) : null,
        number: luckyRaw.number != null ? String(luckyRaw.number) : null,
        direction: luckyRaw.direction != null ? String(luckyRaw.direction) : null,
      }
    : null;
  const summary = String(parsed.summary).trim();
  const focus = parsed.focus != null ? String(parsed.focus).trim() : null;

  // Cache (upsert to be safe against races).
  await svc.from("daily_horoscopes").upsert(
    {
      user_id: userId, horoscope_date: todayIso, lang,
      summary, areas, focus, lucky, model: MODEL, reasons,
    },
    { onConflict: "user_id,horoscope_date,lang" },
  );

  return json(200, { ok: true, cached: false, date: todayIso, lang, summary, areas, focus, lucky, model: MODEL, reasons });
});