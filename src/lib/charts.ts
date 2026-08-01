import { supabase } from "@/integrations/supabase/client";
import type { ChartStyle, PlanetKey, SignKey, VargaKey } from "@/lib/chart-types";

const VARGA_TO_ENUM: Record<VargaKey, string> = {
  D1: "d1_rashi",
  D2: "d2_hora",
  D3: "d3_drekkana",
  D4: "d4_chaturthamsha",
  D7: "d7_saptamsha",
  D9: "d9_navamsha",
  D10: "d10_dashamsha",
  D12: "d12_dwadashamsha",
  D16: "d16_shodashamsha",
  D20: "d20_vimshamsha",
  D24: "d24_chaturvimshamsha",
  D27: "d27_bhamsha",
  D30: "d30_trimshamsha",
  D40: "d40_khavedamsha",
  D45: "d45_akshavedamsha",
  D60: "d60_shashtiamsha",
};

const STYLE_TO_ENUM: Record<ChartStyle, string> = {
  north: "north_indian",
  south: "south_indian",
  east: "east_indian",
};

export type ChartGatewayError = { code: string; message: string };
export type ChartGatewayResult =
  | { svg: string; chart: unknown; error?: undefined }
  | { error: ChartGatewayError; svg?: undefined };

// Recursively find the first string field that looks like an SVG document.
function findSvg(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") {
    const s = value.trim();
    return s.startsWith("<svg") || s.includes("<svg ") ? s : null;
  }
  if (typeof value !== "object") return null;
  if (Array.isArray(value)) {
    for (const v of value) {
      const hit = findSvg(v);
      if (hit) return hit;
    }
    return null;
  }
  const obj = value as Record<string, unknown>;
  for (const key of ["svg", "chart_svg", "chart", "data"]) {
    if (key in obj) {
      const hit = findSvg(obj[key]);
      if (hit) return hit;
    }
  }
  for (const k of Object.keys(obj)) {
    const hit = findSvg(obj[k]);
    if (hit) return hit;
  }
  return null;
}

export async function getVargaChart(
  vargaKey: VargaKey,
  styleKey: ChartStyle,
): Promise<ChartGatewayResult> {
  const chart_type = VARGA_TO_ENUM[vargaKey];
  const chart_style = STYLE_TO_ENUM[styleKey];

  const { data, error } = await supabase.functions.invoke("chart-gateway", {
    body: { chart_type, chart_style },
  });

  if (error) {
    // Try to read the structured error body the function returned.
    let code = "provider_error";
    let message = error.message ?? "Request failed";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ctx = (error as any).context;
    if (ctx && typeof ctx.json === "function") {
      try {
        const body = await ctx.json();
        if (body?.error?.code) code = String(body.error.code);
        if (body?.error?.message) message = String(body.error.message);
      } catch {
        /* ignore parse errors */
      }
    }
    return { error: { code, message } };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payload = (data as any)?.chart_jsonb ?? data;
  const svg = findSvg(payload);
  if (!svg) {
    return {
      error: {
        code: "provider_error",
        message: "Chart response did not include an SVG",
      },
    };
  }
  return { svg, chart: payload };
}

// ---------- Planets ----------

export type NormalizedPlanet = {
  key: PlanetKey | null;
  name: string;
  signKey: SignKey | null;
  signName: string;
  signLordKey: PlanetKey | null;
  signLordName: string;
  house: number | null;
  nakshatraName: string;
  nakshatraLordKey: PlanetKey | null;
  nakshatraLordName: string;
  nakshatraPada: number | null;
  retrograde: boolean;
  states: string[];
  /** Degree within the current sign, 0..30 (e.g. 20.64 = 20°38′). */
  degInSign: number | null;
  /** Absolute sidereal longitude (0..360). Needed to compute divisional charts. */
  lon: number | null;
  /** D1 sign index, 0 = Aries .. 11 = Pisces. */
  signIndex: number | null;
};

export type PlanetsResult =
  | { planets: NormalizedPlanet[]; raw: unknown; error?: undefined }
  | { error: ChartGatewayError; planets?: undefined };

const PLANET_ALIAS: Record<string, PlanetKey> = {
  sun: "sun",
  surya: "sun",
  moon: "moon",
  chandra: "moon",
  mars: "mars",
  mangal: "mars",
  kuja: "mars",
  mercury: "mercury",
  budh: "mercury",
  budha: "mercury",
  jupiter: "jupiter",
  guru: "jupiter",
  brihaspati: "jupiter",
  venus: "venus",
  shukra: "venus",
  saturn: "saturn",
  shani: "saturn",
  rahu: "rahu",
  ketu: "ketu",
};

const SIGN_ALIAS: Record<string, SignKey> = {
  aries: "aries",
  mesha: "aries",
  mesh: "aries",
  taurus: "taurus",
  vrishabha: "taurus",
  vrishabh: "taurus",
  vrsabha: "taurus",
  gemini: "gemini",
  mithuna: "gemini",
  mithun: "gemini",
  cancer: "cancer",
  karka: "cancer",
  karkata: "cancer",
  leo: "leo",
  simha: "leo",
  sinha: "leo",
  virgo: "virgo",
  kanya: "virgo",
  libra: "libra",
  tula: "libra",
  thula: "libra",
  scorpio: "scorpio",
  vrischika: "scorpio",
  vrschika: "scorpio",
  sagittarius: "sagittarius",
  dhanu: "sagittarius",
  dhanus: "sagittarius",
  capricorn: "capricorn",
  makara: "capricorn",
  makar: "capricorn",
  aquarius: "aquarius",
  kumbha: "aquarius",
  kumbh: "aquarius",
  pisces: "pisces",
  meena: "pisces",
  mina: "pisces",
};

function normPlanet(s: string | undefined | null): PlanetKey | null {
  if (!s) return null;
  return PLANET_ALIAS[s.trim().toLowerCase()] ?? null;
}

function normSign(s: string | undefined | null): SignKey | null {
  if (!s) return null;
  return SIGN_ALIAS[s.trim().toLowerCase()] ?? null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pick(obj: any, ...keys: string[]): unknown {
  for (const k of keys) {
    if (obj && obj[k] != null) return obj[k];
  }
  return undefined;
}

function extractPlanetArray(payload: unknown): unknown[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const obj = payload as any;
  const candidates = [
    obj.planet_position,
    obj.planetPosition,
    obj.planets,
    obj.data?.planet_position,
    obj.data?.planetPosition,
    obj.data?.planets,
    obj.data,
  ];
  for (const c of candidates) {
    if (Array.isArray(c)) return c;
  }
  return [];
}

export const NAKSHATRAS = [
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
// Vimshottari lord cycle, repeats every 9 nakshatras
const NAK_LORDS = ["Ketu", "Venus", "Sun", "Moon", "Mars", "Rahu", "Jupiter", "Saturn", "Mercury"];

function nakshatraFromLongitude(lonRaw: number): {
  nakshatraName: string;
  nakshatraLordName: string;
  nakshatraLordKey: string;
  nakshatraPada: number;
} {
  const lon = ((lonRaw % 360) + 360) % 360;
  const SPAN = 360 / 27;
  const PADA = SPAN / 4;
  const idx = Math.floor(lon / SPAN);
  const pada = Math.floor((lon % SPAN) / PADA) + 1;
  return {
    nakshatraName: NAKSHATRAS[idx],
    nakshatraLordName: NAK_LORDS[idx % 9],
    nakshatraLordKey: NAK_LORDS[idx % 9].toLowerCase(),
    nakshatraPada: pada,
  };
}

// ----- Planet dignity & state helpers (Parasara tradition) -----
// Sign indices are 0-based: 0 = Aries ... 10 = Aquarius, 11 = Pisces
// (matches the provider's rasi.id numbering). Kept in sync with the
// astrologer-chat edge function so the app and the AI report identical states.
function navamsaSignIndex(lon: number): number {
  const L = ((lon % 360) + 360) % 360;
  return Math.floor(L / (30 / 9)) % 12;
}

type Dignity = {
  exaltSign: number;
  exaltDeg: number;
  debilSign: number;
  own: number[];
  moola?: { sign: number; from: number; to: number };
};

const DIGNITY: Record<string, Dignity> = {
  sun: {
    exaltSign: 0,
    exaltDeg: 10,
    debilSign: 6,
    own: [4],
    moola: { sign: 4, from: 0, to: 20 },
  },
  moon: { exaltSign: 1, exaltDeg: 3, debilSign: 7, own: [3] },
  mars: {
    exaltSign: 9,
    exaltDeg: 28,
    debilSign: 3,
    own: [0, 7],
    moola: { sign: 0, from: 0, to: 12 },
  },
  mercury: { exaltSign: 5, exaltDeg: 15, debilSign: 11, own: [2, 5] },
  jupiter: {
    exaltSign: 3,
    exaltDeg: 5,
    debilSign: 9,
    own: [8, 11],
    moola: { sign: 8, from: 0, to: 10 },
  },
  venus: {
    exaltSign: 11,
    exaltDeg: 27,
    debilSign: 5,
    own: [1, 6],
    moola: { sign: 6, from: 0, to: 15 },
  },
  saturn: {
    exaltSign: 6,
    exaltDeg: 20,
    debilSign: 0,
    own: [9, 10],
    moola: { sign: 10, from: 0, to: 20 },
  },
};

const COMBUST_ORB: Record<string, { normal: number; retro?: number }> = {
  moon: { normal: 12 },
  mars: { normal: 17 },
  mercury: { normal: 14, retro: 12 },
  jupiter: { normal: 11 },
  venus: { normal: 10, retro: 8 },
  saturn: { normal: 15 },
};

function angularSep(a: number, b: number): number {
  let d = Math.abs(a - b) % 360;
  if (d > 180) d = 360 - d;
  return d;
}

// Dignity (Exalted / Debilitated / Moolatrikona / Own sign), Combust,
// Vargottama and Retrograde. Dignity and combustion are not applied to
// Rahu/Ketu (tradition varies).
function computeStates(args: {
  key: string | null;
  lon: number | null;
  degInSign: number | null;
  signIdx: number | null;
  retro: boolean;
  sunLon: number | null;
}): string[] {
  const { key, lon, degInSign, signIdx, retro, sunLon } = args;
  const tags: string[] = [];
  const dig = key ? DIGNITY[key] : undefined;
  if (dig && signIdx != null) {
    if (signIdx === dig.exaltSign) {
      const deep = degInSign != null && Math.abs(degInSign - dig.exaltDeg) <= 1;
      tags.push(deep ? "Exalted (deep)" : "Exalted");
    } else if (signIdx === dig.debilSign) {
      const deep = degInSign != null && Math.abs(degInSign - dig.exaltDeg) <= 1;
      tags.push(deep ? "Debilitated (deep)" : "Debilitated");
    } else if (
      dig.moola &&
      signIdx === dig.moola.sign &&
      degInSign != null &&
      degInSign >= dig.moola.from &&
      degInSign <= dig.moola.to
    ) {
      tags.push("Moolatrikona");
    } else if (dig.own.includes(signIdx)) {
      tags.push("Own sign");
    }
  }
  const orb = key ? COMBUST_ORB[key] : undefined;
  if (orb && lon != null && sunLon != null) {
    const limit = retro && orb.retro != null ? orb.retro : orb.normal;
    if (angularSep(lon, sunLon) <= limit) tags.push("Combust");
  }
  if (lon != null && signIdx != null && navamsaSignIndex(lon) === signIdx) {
    tags.push("Vargottama");
  }
  if (retro) tags.push("Retrograde");
  return tags;
}

function mapPlanets(payload: unknown): NormalizedPlanet[] {
  const arr = extractPlanetArray(payload);

  // Find the Ascendant to compute whole-sign houses.
  // Prokerala's `position` is the sign ordinal (rasi.id + 1), NOT the house.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getRasiId = (p: any): number | null => {
    const r = p?.rasi ?? p?.sign ?? p?.zodiac;
    const id = r?.id;
    if (typeof id === "number") return id;
    if (id != null && !Number.isNaN(Number(id))) return Number(id);
    return null;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isAsc = (p: any): boolean => {
    const name = String(p?.name ?? p?.planet ?? "")
      .trim()
      .toLowerCase();
    const id = p?.id;
    return name === "ascendant" || name === "lagna" || id === 100 || id === "100";
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ascendant = arr.find((p) => isAsc(p as any)) as any;
  const ascRasiId = ascendant ? getRasiId(ascendant) : null;

  // Sun's longitude is needed to test combustion for the other planets.
  const sunRaw = arr.find(
    (p) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      !isAsc(p as any) &&
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      normPlanet(String(pick(p as any, "name", "planet") ?? "")) === "sun",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) as any;
  let sunLon: number | null = null;
  if (sunRaw) {
    const sl = pick(sunRaw, "longitude", "long", "lon");
    const slNum =
      typeof sl === "number" ? sl : sl != null && !Number.isNaN(Number(sl)) ? Number(sl) : null;
    if (slNum != null) {
      sunLon = slNum;
    } else {
      const sr = getRasiId(sunRaw);
      const sd = pick(sunRaw, "degree");
      const sdNum =
        typeof sd === "number" ? sd : sd != null && !Number.isNaN(Number(sd)) ? Number(sd) : null;
      if (sr != null && sdNum != null) sunLon = sr * 30 + sdNum;
    }
  }

  return arr.map((raw): NormalizedPlanet => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = raw as any;
    const rasi = pick(p, "rasi", "sign", "zodiac") as
      | {
          id?: number | string;
          name?: string;
          lord?: { name?: string; vedic_name?: string } | string;
        }
      | undefined;
    const signName = String(rasi?.name ?? "");
    const signLordRaw =
      typeof rasi?.lord === "string"
        ? rasi.lord
        : (rasi?.lord?.name ?? rasi?.lord?.vedic_name ?? "");

    // Compute whole-sign house from ascendant. Never fall back to `position`.
    let houseNum: number | null = null;
    if (ascRasiId != null) {
      const bodyRasiId = getRasiId(p);
      if (bodyRasiId != null) {
        houseNum = ((bodyRasiId - ascRasiId + 12) % 12) + 1;
      }
    }
    if (isAsc(p)) houseNum = ascRasiId != null ? 1 : null;

    // Nakshatra is computed deterministically from sidereal longitude.
    const lonRaw = pick(p, "longitude", "long", "lon");
    const lonNum =
      typeof lonRaw === "number"
        ? lonRaw
        : lonRaw != null && !Number.isNaN(Number(lonRaw))
          ? Number(lonRaw)
          : null;
    const nakInfo =
      lonNum != null && Number.isFinite(lonNum) ? nakshatraFromLongitude(lonNum) : null;

    const retro = Boolean(pick(p, "is_retrograde", "isRetrograde", "retrograde", "retro"));

    const name = String(pick(p, "name", "planet") ?? "");

    const bodyRasiId = getRasiId(p);
    const degRaw = pick(p, "degree");
    const degNum =
      typeof degRaw === "number"
        ? degRaw
        : degRaw != null && !Number.isNaN(Number(degRaw))
          ? Number(degRaw)
          : null;
    const degInSign = degNum != null ? degNum : lonNum != null ? ((lonNum % 30) + 30) % 30 : null;
    const effLon =
      lonNum != null
        ? lonNum
        : bodyRasiId != null && degInSign != null
          ? bodyRasiId * 30 + degInSign
          : null;
    const states = isAsc(p)
      ? []
      : computeStates({
          key: normPlanet(name),
          lon: effLon,
          degInSign,
          signIdx: bodyRasiId,
          retro,
          sunLon,
        });

    return {
      key: normPlanet(name),
      name,
      signKey: normSign(signName),
      signName,
      signLordKey: normPlanet(signLordRaw),
      signLordName: String(signLordRaw ?? ""),
      house: houseNum,
      nakshatraName: nakInfo?.nakshatraName ?? "",
      nakshatraLordKey: nakInfo ? normPlanet(nakInfo.nakshatraLordName) : null,
      nakshatraLordName: nakInfo?.nakshatraLordName ?? "",
      nakshatraPada: nakInfo?.nakshatraPada ?? null,
      retrograde: retro,
      states,
      degInSign,
      lon: effLon,
      signIndex: bodyRasiId,
    };
  });
}

export type PlanetDignityFlags = {
  exalted: boolean;
  debilitated: boolean;
  ownSign: boolean;
  moolatrikona: boolean;
  combust: boolean;
};

// Reads dignity/combustion off the tags `computeStates()` already attached to
// NormalizedPlanet.states, so callers (e.g. remedies) don't need their own
// copy of the DIGNITY/COMBUST_ORB tables.
export function planetDignityState(planet: Pick<NormalizedPlanet, "states">): PlanetDignityFlags {
  const s = planet.states;
  return {
    exalted: s.some((x) => x.startsWith("Exalted")),
    debilitated: s.some((x) => x.startsWith("Debilitated")),
    ownSign: s.includes("Own sign"),
    moolatrikona: s.includes("Moolatrikona"),
    combust: s.includes("Combust"),
  };
}

export async function getPlanets(): Promise<PlanetsResult> {
  const { data, error } = await supabase.functions.invoke("chart-gateway", {
    body: { resource: "planets" },
  });

  if (error) {
    let code = "provider_error";
    let message = error.message ?? "Request failed";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ctx = (error as any).context;
    if (ctx && typeof ctx.json === "function") {
      try {
        const body = await ctx.json();
        if (body?.error?.code) code = String(body.error.code);
        if (body?.error?.message) message = String(body.error.message);
      } catch {
        /* ignore */
      }
    }
    return { error: { code, message } };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payload = (data as any)?.data ?? (data as any)?.chart_jsonb ?? data;
  const planets = mapPlanets(payload);
  // Empty is not an error — the UI shows "No planet data".
  return { planets, raw: payload };
}

// ---------- Vimshottari Dasha ----------

export type DashaPratyantar = {
  id: number;
  name: string;
  start: string;
  end: string;
};
export type DashaAntar = DashaPratyantar & {
  pratyantardasha: DashaPratyantar[];
};
export type DashaMaha = DashaPratyantar & {
  antardasha: DashaAntar[];
};
export type DashaBalance = {
  lord: { id: number; name: string; vedic_name?: string };
  duration: number | string;
  description: string;
};
export type DashaResult =
  | { periods: DashaMaha[]; balance: DashaBalance | null; error?: undefined }
  | { error: ChartGatewayError; periods?: undefined };

export async function getDasha(): Promise<DashaResult> {
  const { data, error } = await supabase.functions.invoke("chart-gateway", {
    body: { resource: "report", report_type: "vimshottari_dasha" },
  });

  if (error) {
    let code = "provider_error";
    let message = error.message ?? "Request failed";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ctx = (error as any).context;
    if (ctx && typeof ctx.json === "function") {
      try {
        const body = await ctx.json();
        if (body?.error?.code) code = String(body.error.code);
        if (body?.error?.message) message = String(body.error.message);
      } catch {
        /* ignore */
      }
    }
    return { error: { code, message } };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = data as any;
  const inner = d?.data?.data ?? d?.data ?? d;
  const periods: DashaMaha[] = Array.isArray(inner?.dasha_periods) ? inner.dasha_periods : [];
  const balance: DashaBalance | null = inner?.dasha_balance ?? null;
  return { periods, balance };
}

// ---------- Divisional (varga) chart computation ----------
// Deterministic Parasara (BPHS) varga math, computed client-side from the
// reliable D1 sidereal longitudes returned by getPlanets(). This mirrors the
// astrologer-chat edge function so the app and the AI report identical charts.
// Prokerala's divisional SVGs are unreliable, so D2..D60 use this instead.

export const SIGN_KEYS_BY_INDEX: SignKey[] = [
  "aries",
  "taurus",
  "gemini",
  "cancer",
  "leo",
  "virgo",
  "libra",
  "scorpio",
  "sagittarius",
  "capricorn",
  "aquarius",
  "pisces",
];

// Sign index (0 = Aries .. 11 = Pisces) a sidereal longitude maps to in a
// given divisional chart, following Brihat Parasara Hora Shastra.
export function vargaSign(varga: VargaKey, lon: number): number {
  const L = ((lon % 360) + 360) % 360;
  const s = Math.floor(L / 30) % 12;
  const d = L - Math.floor(L / 30) * 30;
  const odd = s % 2 === 0;
  const modality = s % 3;
  const element = s % 4;
  const mod = (n: number) => ((n % 12) + 12) % 12;
  switch (varga) {
    case "D1":
      return s;
    case "D2":
      return odd ? (d < 15 ? 4 : 3) : d < 15 ? 3 : 4;
    case "D3":
      return mod(s + 4 * Math.floor(d / 10));
    case "D4":
      return mod(s + 3 * Math.floor(d / 7.5));
    case "D7": {
      const start = odd ? s : mod(s + 6);
      return mod(start + Math.floor(d / (30 / 7)));
    }
    case "D9":
      return mod(Math.floor(L / (30 / 9)));
    case "D10": {
      const start = odd ? s : mod(s + 8);
      return mod(start + Math.floor(d / 3));
    }
    case "D12":
      return mod(s + Math.floor(d / 2.5));
    case "D16": {
      const start = modality === 0 ? 0 : modality === 1 ? 4 : 8;
      return mod(start + Math.floor(d / (30 / 16)));
    }
    case "D20": {
      const start = modality === 0 ? 0 : modality === 1 ? 8 : 4;
      return mod(start + Math.floor(d / (30 / 20)));
    }
    case "D24": {
      const start = odd ? 4 : 3;
      return mod(start + Math.floor(d / (30 / 24)));
    }
    case "D27": {
      const start = element === 0 ? 0 : element === 1 ? 3 : element === 2 ? 6 : 9;
      return mod(start + Math.floor(d / (30 / 27)));
    }
    case "D30": {
      if (odd) {
        if (d < 5) return 0;
        if (d < 10) return 10;
        if (d < 18) return 8;
        if (d < 25) return 2;
        return 6;
      }
      if (d < 5) return 1;
      if (d < 12) return 5;
      if (d < 20) return 11;
      if (d < 25) return 9;
      return 7;
    }
    case "D40": {
      const start = odd ? 0 : 6;
      return mod(start + Math.floor(d / (30 / 40)));
    }
    case "D45": {
      const start = modality === 0 ? 0 : modality === 1 ? 4 : 8;
      return mod(start + Math.floor(d / (30 / 45)));
    }
    case "D60":
      return mod(s + Math.floor(d / 0.5));
    default:
      return s;
  }
}

// Dignity of a planet purely by sign (used for divisional charts, where the
// sign is resolved but not the exact varga degree). Not applied to Rahu/Ketu.
function dignityBySign(key: string, signIdx: number): string | null {
  const dig = DIGNITY[key];
  if (!dig) return null;
  if (signIdx === dig.exaltSign) return "Exalted";
  if (signIdx === dig.debilSign) return "Debilitated";
  if (dig.own.includes(signIdx)) return "Own sign";
  return null;
}

function isAscendantName(name: string): boolean {
  const n = name.trim().toLowerCase();
  return n === "ascendant" || n === "lagna";
}

export type DivisionalPosition = {
  key: PlanetKey | null;
  name: string;
  isAsc: boolean;
  signIndex: number;
  signKey: SignKey;
  house: number | null;
  vargottama: boolean;
  dignity: string | null;
};

// Compute every body's placement in the given varga from D1 longitudes.
export function computeDivisional(
  planets: NormalizedPlanet[],
  varga: VargaKey,
): DivisionalPosition[] {
  const asc = planets.find((p) => isAscendantName(p.name) && p.lon != null);
  const ascVargaSign = asc && asc.lon != null ? vargaSign(varga, asc.lon) : null;
  return planets
    .filter((p) => p.lon != null)
    .map((p) => {
      const lon = p.lon as number;
      const vs = vargaSign(varga, lon);
      const isAsc = isAscendantName(p.name);
      const house = ascVargaSign != null ? ((vs - ascVargaSign + 12) % 12) + 1 : null;
      const d1 = vargaSign("D1", lon);
      const d9 = vargaSign("D9", lon);
      return {
        key: p.key,
        name: p.name,
        isAsc,
        signIndex: vs,
        signKey: SIGN_KEYS_BY_INDEX[vs],
        house,
        vargottama: d1 === d9,
        dignity: isAsc || !p.key ? null : dignityBySign(p.key, vs),
      };
    });
}

// ---------- North-Indian varga chart SVG parsing ----------
// Prokerala returns divisional charts (D2..D60) only as a North-Indian SVG,
// with no structured planet data. We parse that SVG so the Planets/Houses
// tables are read from the exact same source as the rendered chart, which
// guarantees they always match. In a North-Indian chart each compartment is
// labelled with its rasi (sign) number 1..12, the ascendant marks house 1, and
// every planet's house is counted forward from the ascendant's sign.

type SvgTextNode = { x: number; y: number; cls: string | null; text: string };

function parseSvgTextNodes(svg: string): SvgTextNode[] {
  const nodes: SvgTextNode[] = [];
  const re = /<text\b([^>]*)>([\s\S]*?)<\/text>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(svg)) !== null) {
    const attrs = m[1];
    const text = m[2].replace(/<[^>]*>/g, "").trim();
    const xM = /\bx\s*=\s*"([^"]*)"/.exec(attrs);
    const yM = /\by\s*=\s*"([^"]*)"/.exec(attrs);
    const cM = /\bclass\s*=\s*"([^"]*)"/.exec(attrs);
    const x = xM ? Number(xM[1]) : NaN;
    const y = yM ? Number(yM[1]) : NaN;
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    nodes.push({ x, y, cls: cM ? cM[1] : null, text });
  }
  return nodes;
}

const PK_PLANET_CLASS: Record<string, PlanetKey | "ascendant"> = {
  sun: "sun",
  moon: "moon",
  mars: "mars",
  mercury: "mercury",
  jupiter: "jupiter",
  venus: "venus",
  saturn: "saturn",
  rahu: "rahu",
  ketu: "ketu",
  ascendant: "ascendant",
};

function planetFromClass(cls: string | null): PlanetKey | "ascendant" | null {
  if (!cls) return null;
  const m = /pk-planet-([a-z]+)/i.exec(cls);
  if (!m) return null;
  return PK_PLANET_CLASS[m[1].toLowerCase()] ?? null;
}

export type ParsedVargaChart = {
  /** 0 = Aries .. 11 = Pisces */
  ascSignIndex: number;
  positions: Array<{ key: PlanetKey; signIndex: number; house: number }>;
};

// Parse a Prokerala North-Indian divisional chart SVG into structured
// positions. Returns null if the SVG is not a recognisable North-Indian chart
// (e.g. a South/East-Indian layout), so callers can fall back gracefully
// instead of showing wrong data.
export function parseNorthIndianVargaChart(svg: string): ParsedVargaChart | null {
  if (!svg || !/pk-planet-/.test(svg)) return null;
  const nodes = parseSvgTextNodes(svg);

  // Rasi-number anchors: bare numeric labels 1..12, one per compartment.
  const anchors: Array<{ sign: number; x: number; y: number }> = [];
  for (const n of nodes) {
    if (n.cls) continue;
    if (!/^\d{1,2}$/.test(n.text)) continue;
    const sign = Number(n.text);
    if (sign >= 1 && sign <= 12) anchors.push({ sign, x: n.x, y: n.y });
  }
  if (anchors.length < 12) return null;

  const nearestSign = (x: number, y: number): number => {
    let best = anchors[0];
    let bestD = Infinity;
    for (const a of anchors) {
      const d = (a.x - x) ** 2 + (a.y - y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = a;
      }
    }
    return best.sign; // 1..12
  };

  const ascNode = nodes.find((n) => planetFromClass(n.cls) === "ascendant");
  if (!ascNode) return null;
  const ascSign1 = nearestSign(ascNode.x, ascNode.y); // 1..12

  const positions: Array<{ key: PlanetKey; signIndex: number; house: number }> = [];
  const seen = new Set<PlanetKey>();
  for (const n of nodes) {
    const p = planetFromClass(n.cls);
    if (!p || p === "ascendant") continue;
    if (seen.has(p)) continue;
    seen.add(p);
    const sign1 = nearestSign(n.x, n.y); // 1..12
    positions.push({
      key: p,
      signIndex: sign1 - 1,
      house: ((sign1 - ascSign1 + 12) % 12) + 1,
    });
  }
  if (positions.length === 0) return null;
  return { ascSignIndex: ascSign1 - 1, positions };
}

export type VargaTableRow = {
  key: PlanetKey;
  signIndex: number;
  signKey: SignKey;
  house: number;
  retrograde: boolean;
  states: string[];
};

export type VargaTable = {
  /** 0 = Aries .. 11 = Pisces */
  ascSignIndex: number;
  rows: VargaTableRow[];
};

// Build divisional Planets/Houses table data straight from the Prokerala
// North-Indian SVG (sign + house), enriched with D1-derived facts (retrograde
// and vargottama) and sign-based dignity. Rows are ordered to match the D1
// planet table. Returns null when the SVG can't be parsed, so the UI can show
// an empty/loading state instead of wrong data.
export function buildVargaTable(svg: string, d1Planets: NormalizedPlanet[]): VargaTable | null {
  const parsed = parseNorthIndianVargaChart(svg);
  if (!parsed) return null;

  const orderOf = (k: PlanetKey): number => {
    const i = d1Planets.findIndex((p) => p.key === k);
    return i < 0 ? 99 : i;
  };

  const rows: VargaTableRow[] = parsed.positions
    .map((pos) => {
      const src = d1Planets.find((p) => p.key === pos.key) ?? null;
      const states: string[] = [];
      const dig = dignityBySign(pos.key, pos.signIndex);
      if (dig) states.push(dig);
      if (src?.lon != null && vargaSign("D1", src.lon) === vargaSign("D9", src.lon)) {
        states.push("Vargottama");
      }
      return {
        key: pos.key,
        signIndex: pos.signIndex,
        signKey: SIGN_KEYS_BY_INDEX[pos.signIndex],
        house: pos.house,
        retrograde: src?.retrograde ?? false,
        states,
      };
    })
    .sort((a, b) => orderOf(a.key) - orderOf(b.key));

  return { ascSignIndex: parsed.ascSignIndex, rows };
}
