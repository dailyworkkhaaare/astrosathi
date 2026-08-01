// Divisional (Shodasavarga) charts — pure, deterministic computation.
//
// Given a natal payload (Prokerala-shaped: data.planet_position[] with
// { id, name, longitude, rasi:{id} } entries; sidereal longitudes 0..360),
// computeVarga(natal, D) returns each body's whole-sign house in the requested
// varga chart, plus the ascendant's varga sign.
//
// SOURCE (Parashari / BPHS): the 16 varga-sign formulas are ported directly
// from naturalstupid/PyJHora — src/jhora/horoscope/chart/charts.py — with
// cross-check against kunjara/jyotish (PHP) src/Chart/Varga/*.php and the
// existing in-app implementation at src/lib/charts.ts (`vargaSign`). All
// three agree on D1..D12, D16, D20, D24, D27, D40, D45, D60. D30 uses the
// classical Parashari unequal-part table (Mars/Sat/Jup/Merc/Venus splits).
//
// Output envelope (per varga D):
//   { asc_sign: number 0..11,
//     positions: [{ key, sign, house }] for the 9 grahas }
//   key ∈ sun,moon,mars,mercury,jupiter,venus,saturn,rahu,ketu (lowercase)
//   sign ∈ 0..11 (0 = Aries)
//   house = ((sign - asc_sign + 12) % 12) + 1  (whole-sign, 1..12)

export type VargaKey =
  | "D1" | "D2" | "D3" | "D4" | "D7" | "D9" | "D10" | "D12"
  | "D16" | "D20" | "D24" | "D27" | "D30" | "D40" | "D45" | "D60";

export const VARGAS: VargaKey[] = [
  "D1", "D2", "D3", "D4", "D7", "D9", "D10", "D12",
  "D16", "D20", "D24", "D27", "D30", "D40", "D45", "D60",
];

// Chart-type enum used in chart_facts / chart_artifacts. Note d27_bhamsha
// maps to Prokerala's `saptavimsamsa` slug.
export const VARGA_TO_ENUM: Record<VargaKey, string> = {
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

// Lowercase body keys, matching chart_facts.positions[].key.
export const BODY_KEYS = [
  "sun", "moon", "mars", "mercury", "jupiter", "venus", "saturn", "rahu", "ketu",
] as const;
export type BodyKey = typeof BODY_KEYS[number];

// Prokerala body-id table. Ascendant = 100, Rahu = 101, Ketu = 102.
const ID_TO_KEY: Record<number, BodyKey> = {
  0: "sun",
  1: "moon",
  2: "mercury",
  3: "venus",
  4: "mars",
  5: "jupiter",
  6: "saturn",
  101: "rahu",
  102: "ketu",
};
const ASC_ID = 100;

const NAME_TO_KEY: Record<string, BodyKey> = {
  sun: "sun", surya: "sun",
  moon: "moon", chandra: "moon",
  mars: "mars", mangal: "mars", kuja: "mars",
  mercury: "mercury", budh: "mercury", budha: "mercury",
  jupiter: "jupiter", guru: "jupiter", brihaspati: "jupiter",
  venus: "venus", shukra: "venus",
  saturn: "saturn", shani: "saturn",
  rahu: "rahu",
  ketu: "ketu",
};

const mod12 = (n: number) => ((n % 12) + 12) % 12;
const norm360 = (x: number) => ((x % 360) + 360) % 360;

// -------------------------------------------------------------------------
// The 16 varga-sign functions. Input: sidereal longitude L in [0,360).
// Output: sign index 0..11 (0 = Aries).
// Ported from naturalstupid/PyJHora (charts.py) — Parashari BPHS.
// -------------------------------------------------------------------------

export function vargaSign(varga: VargaKey, lonRaw: number): number {
  const L = norm360(lonRaw);
  const s = Math.floor(L / 30) % 12;          // 0..11 sign
  const d = L - Math.floor(L / 30) * 30;       // 0..30 degree within sign
  const odd = s % 2 === 0;                     // Aries=odd (1st), Taurus=even (2nd)
  const modality = s % 3;                      // 0 movable, 1 fixed, 2 dual
  const element = s % 4;                       // 0 fire, 1 earth, 2 air, 3 water

  switch (varga) {
    case "D1":
      return s;

    // D2 Hora (Parashari): odd sign 1st half → Leo (Sun), 2nd half → Cancer (Moon);
    // even sign the reverse.
    case "D2":
      return odd ? (d < 15 ? 4 : 3) : (d < 15 ? 3 : 4);

    // D3 Drekkana: 3 equal 10° parts → 1st, 5th (s+4), 9th (s+8) from sign.
    case "D3":
      return mod12(s + 4 * Math.floor(d / 10));

    // D4 Chaturthamsha: 4 equal 7.5° parts → 1st, 4th (s+3), 7th (s+6), 10th (s+9).
    case "D4":
      return mod12(s + 3 * Math.floor(d / 7.5));

    // D7 Saptamsha: 7 equal parts; odd sign starts from itself, even from the 7th.
    case "D7": {
      const start = odd ? s : mod12(s + 6);
      return mod12(start + Math.floor(d / (30 / 7)));
    }

    // D9 Navamsha: 9 equal parts. Fire → Aries, Earth → Cap, Air → Libra, Water → Cancer.
    // Equivalent closed form: floor(L / (30/9)) mod 12.
    case "D9":
      return mod12(Math.floor(L / (30 / 9)));

    // D10 Dashamsha: 10 equal 3° parts; odd sign starts from itself, even from the 9th (s+8).
    case "D10": {
      const start = odd ? s : mod12(s + 8);
      return mod12(start + Math.floor(d / 3));
    }

    // D12 Dwadashamsha: 12 equal 2.5° parts starting from the sign itself.
    case "D12":
      return mod12(s + Math.floor(d / 2.5));

    // D16 Shodashamsha: 16 parts. Movable → Aries, Fixed → Leo, Dual → Sagittarius.
    case "D16": {
      const start = modality === 0 ? 0 : modality === 1 ? 4 : 8;
      return mod12(start + Math.floor(d / (30 / 16)));
    }

    // D20 Vimshamsha: 20 parts. Movable → Aries, Fixed → Sagittarius, Dual → Leo.
    case "D20": {
      const start = modality === 0 ? 0 : modality === 1 ? 8 : 4;
      return mod12(start + Math.floor(d / (30 / 20)));
    }

    // D24 Chaturvimshamsha (Siddhamsha): 24 parts. Odd → Leo, Even → Cancer.
    case "D24": {
      const start = odd ? 4 : 3;
      return mod12(start + Math.floor(d / (30 / 24)));
    }

    // D27 Bhamsha / Nakshatramsha: 27 parts. Fire → Aries, Earth → Cancer,
    // Air → Libra, Water → Capricorn.
    case "D27": {
      const start = element === 0 ? 0 : element === 1 ? 3 : element === 2 ? 6 : 9;
      return mod12(start + Math.floor(d / (30 / 27)));
    }

    // D30 Trimshamsha (Parashari, unequal parts). Skips the sign's own lord.
    //   Odd sign:  Mars 0-5, Sat 5-10, Jup 10-18, Merc 18-25, Ven 25-30
    //              → Aries(0), Aquarius(10), Sagittarius(8), Gemini(2), Libra(6)
    //   Even sign: Ven 0-5, Merc 5-12, Jup 12-20, Sat 20-25, Mars 25-30
    //              → Taurus(1), Virgo(5), Pisces(11), Capricorn(9), Scorpio(7)
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

    // D40 Khavedamsha (Svavedamsha): 40 parts. Odd → Aries, Even → Libra.
    case "D40": {
      const start = odd ? 0 : 6;
      return mod12(start + Math.floor(d / (30 / 40)));
    }

    // D45 Akshavedamsha: 45 parts. Movable → Aries, Fixed → Leo, Dual → Sagittarius.
    case "D45": {
      const start = modality === 0 ? 0 : modality === 1 ? 4 : 8;
      return mod12(start + Math.floor(d / (30 / 45)));
    }

    // D60 Shashtiamsha: 60 parts of 0.5° each, counted from the sign itself.
    case "D60":
      return mod12(s + Math.floor(d / 0.5));
  }
}

// -------------------------------------------------------------------------
// Natal-payload adapters
// -------------------------------------------------------------------------

export type NatalBody = {
  key: BodyKey | "ascendant";
  lon: number;
};

// Extract { key, longitude } for the 9 grahas + ascendant from any
// Prokerala-shaped natal payload (planet_position[] with id/name/rasi/longitude,
// or degree if longitude absent).
// deno-lint-ignore no-explicit-any
export function extractBodies(natal: any): NatalBody[] {
  const inner = natal?.data ?? natal;
  const arr: unknown[] = Array.isArray(inner?.planet_position)
    ? inner.planet_position
    : Array.isArray(inner?.planets)
      ? inner.planets
      : Array.isArray(inner)
        ? inner
        : [];
  const out: NatalBody[] = [];
  for (const p of arr) {
    // deno-lint-ignore no-explicit-any
    const pp = p as any;
    let key: BodyKey | "ascendant" | null = null;
    const id = Number(pp?.id);
    if (Number.isFinite(id)) {
      if (id === ASC_ID) key = "ascendant";
      else if (ID_TO_KEY[id]) key = ID_TO_KEY[id];
    }
    if (!key) {
      const name = String(pp?.name ?? pp?.planet ?? "").trim().toLowerCase();
      if (name === "ascendant" || name === "lagna") key = "ascendant";
      else if (NAME_TO_KEY[name]) key = NAME_TO_KEY[name];
    }
    if (!key) continue;

    let lon = Number(pp?.longitude ?? pp?.long ?? pp?.lon);
    if (!Number.isFinite(lon)) {
      // Fall back to rasi.id * 30 + degree.
      const rid = Number(pp?.rasi?.id);
      const deg = Number(pp?.degree);
      if (Number.isFinite(rid) && Number.isFinite(deg)) lon = rid * 30 + deg;
    }
    if (!Number.isFinite(lon)) continue;
    out.push({ key, lon: norm360(lon) });
  }
  return out;
}

// -------------------------------------------------------------------------
// Public API
// -------------------------------------------------------------------------

export type VargaPosition = { key: BodyKey; sign: number; house: number };
export type VargaResult = {
  asc_sign: number;
  positions: VargaPosition[];
};

export function computeVarga(natal: unknown, D: VargaKey): VargaResult {
  const bodies = extractBodies(natal);
  const asc = bodies.find((b) => b.key === "ascendant");
  if (!asc) throw new Error("varga: ascendant missing from natal payload");
  const ascSign = vargaSign(D, asc.lon);

  const positions: VargaPosition[] = [];
  for (const k of BODY_KEYS) {
    const b = bodies.find((x) => x.key === k);
    if (!b) continue;
    const sign = vargaSign(D, b.lon);
    const house = ((sign - ascSign + 12) % 12) + 1;
    positions.push({ key: k, sign, house });
  }
  return { asc_sign: ascSign, positions };
}

// Convenience: compute all 16 vargas in one pass.
export function computeAllVargas(natal: unknown): Record<VargaKey, VargaResult> {
  const out: Partial<Record<VargaKey, VargaResult>> = {};
  for (const v of VARGAS) out[v] = computeVarga(natal, v);
  return out as Record<VargaKey, VargaResult>;
}
