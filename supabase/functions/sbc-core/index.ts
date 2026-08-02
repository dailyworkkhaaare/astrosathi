// =====================================================================
// SBC-Core v1.0 : Sarvatobhadra Chakra Vedha Engine (Supabase Edge Fn)
// =====================================================================
// Deno runtime + astronomy-engine 2.1.19 (dynamic import for deploy safety)
//
// ARCHITECTURE: STRICT SEPARATION
//   ┌─────────────────────────────────────────────────────────────────┐
//   │  CLASSICAL LAYER (deterministic, weight-free)                    │
//   │   - Reads: ephemeris, panchanga_daily, sbc-core-grid.json,       │
//   │            sbc_asset_charts.janma_snapshot                       │
//   │   - Emits: classical_data { planet_states, vedhas, corner_vedha, │
//   │            malefic_vedha_count, krura_grade }                    │
//   │   - Never touches sbc_config.weights                             │
//   └─────────────────────────────────────────────────────────────────┘
//                                     │
//                                     ▼
//   ┌─────────────────────────────────────────────────────────────────┐
//   │  SCORING LAYER (configurable, proprietary)                      │
//   │   - Reads: classical_data + sbc_config.weights (active row)     │
//   │   - Emits: scored_data { score_raw, contributions, ... }        │
//   │   - Pure function; historical rescoring possible                │
//   └─────────────────────────────────────────────────────────────────┘
//
// Grid loaded once from sbc-core-grid.json (32 akshara cells excluded).
// Only nakshatra (28), rashi (12), tithi/vara (5), vowel-corner (4) read.
// =====================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ENGINE_NAME = "SBC-Core";
const ENGINE_VERSION = "1.0.0";
const GRID_VERSION = "1.0.0";

// ---------- Constants ------------------------------------------------
const NAK27 = [
  "Ashwini","Bharani","Krittika","Rohini","Mrigashira","Ardra",
  "Punarvasu","Pushya","Ashlesha","Magha","P.Phalguni","U.Phalguni",
  "Hasta","Chitra","Swati","Vishakha","Anuradha","Jyeshtha",
  "Mula","P.Ashada","U.Ashada","Shravana","Dhanishta","Shatabhisha",
  "P.Bhadrapada","U.Bhadrapada","Revati"
];

// SBC 28-scheme: Abhijit inserted between U.Ashada (21) and Shravana (22 in 28-scheme).
// Abhijit sidereal span per Varahamihira: Capricorn 6°40' - 10°53'20" (F.C.Dutt)
const ABHIJIT_START = 270 + 6 + 40/60;              // 276.6667° sidereal
const ABHIJIT_END   = 270 + 10 + 53/60 + 20/3600;   // 280.8889° sidereal

const NAK_WIDTH = 360 / 27; // 13.3333° per 27-scheme nakshatra

const RASHI = [
  "Aries","Taurus","Gemini","Cancer","Leo","Virgo",
  "Libra","Scorpio","Sagittarius","Capricorn","Aquarius","Pisces"
];

const MEAN_DAILY: Record<string, number> = {
  sun: 0.9856, moon: 13.176, mercury: 1.383, venus: 1.202,
  mars: 0.524, jupiter: 0.083, saturn: 0.033,
  rahu: -0.053, ketu: -0.053
};

const MALEFIC_ALWAYS = ["sun","mars","saturn","rahu","ketu"];
const BENEFIC_ALWAYS = ["jupiter","venus"];

// Exaltation table (rashi_num 1-12, degree within rashi)
const EXALT: Record<string, {r: number, d: number}> = {
  sun: {r:1,d:10}, moon: {r:2,d:3}, mars: {r:10,d:28},
  mercury: {r:6,d:15}, jupiter: {r:4,d:5}, venus: {r:12,d:27},
  saturn: {r:7,d:20}
};
const DEBIL: Record<string, {r: number, d: number}> = {
  sun: {r:7,d:10}, moon: {r:8,d:3}, mars: {r:4,d:28},
  mercury: {r:12,d:15}, jupiter: {r:10,d:5}, venus: {r:6,d:27},
  saturn: {r:1,d:20}
};
const DIGNITY_ORB = 3.0; // ±3° for exalted/debilitated match

// Location
const MUMBAI_LAT = 19.076;
const MUMBAI_LON = 72.877;
const MUMBAI_ELEV = 14;

// Asset natal chart definitions (Mumbai IST -> UTC)
const ASSET_NATALS = [
  { key:"nifty50",   name:"NIFTY 50",   category:"equity_index",
    utc:"1995-11-03T04:25:00Z", lat:MUMBAI_LAT, lon:MUMBAI_LON, locale:"Mumbai IST 09:55" },
  { key:"mcxgold",   name:"MCX GOLD",   category:"commodity_precious",
    utc:"2003-11-10T04:30:00Z", lat:MUMBAI_LAT, lon:MUMBAI_LON, locale:"Mumbai IST 10:00" },
  { key:"mcxsilver", name:"MCX SILVER", category:"commodity_precious",
    utc:"2003-11-10T04:30:00Z", lat:MUMBAI_LAT, lon:MUMBAI_LON, locale:"Mumbai IST 10:00" }
];

// ---------- Grid (embedded; 49 verified cells; 32 akshara excluded) --
// Only cells engine reads. Full 81-cell file stored at sbc-core-grid.json.
type GridCell = { cage: number; r: number; c: number; type: string; content: any };

// Nakshatra cages (28 outer-ring): map n28 -> (r,c)
const NAK28_POS: Record<number, {r:number,c:number,cage:number}> = {
  1:{r:3,c:1,cage:31},  2:{r:2,c:1,cage:32},  3:{r:1,c:2,cage:2},   4:{r:1,c:3,cage:3},
  5:{r:1,c:4,cage:4},   6:{r:1,c:5,cage:5},   7:{r:1,c:6,cage:6},   8:{r:1,c:7,cage:7},
  9:{r:1,c:8,cage:8},   10:{r:2,c:9,cage:10}, 11:{r:3,c:9,cage:11}, 12:{r:4,c:9,cage:12},
  13:{r:5,c:9,cage:13}, 14:{r:6,c:9,cage:14}, 15:{r:7,c:9,cage:15}, 16:{r:8,c:9,cage:16},
  17:{r:9,c:8,cage:18}, 18:{r:9,c:7,cage:19}, 19:{r:9,c:6,cage:20}, 20:{r:9,c:5,cage:21},
  21:{r:9,c:4,cage:22}, 22:{r:9,c:3,cage:23}, 23:{r:9,c:2,cage:24}, 24:{r:8,c:1,cage:26},
  25:{r:7,c:1,cage:27}, 26:{r:6,c:1,cage:28}, 27:{r:5,c:1,cage:29}, 28:{r:4,c:1,cage:30}
};

// Reverse: (r,c) -> n28 (only outer-ring nakshatra positions)
const POS_TO_NAK28: Map<string, number> = new Map();
for (const [n, p] of Object.entries(NAK28_POS)) {
  POS_TO_NAK28.set(`${p.r},${p.c}`, Number(n));
}

// Corner-trigger nakshatras (Rath Corollary 1.01)
const CORNER_TRIGGER_FIRST_PADA = [3, 10, 17, 24]; // Krittika, Magha, Anuradha, Dhanishta (28-scheme)
const CORNER_TRIGGER_LAST_PADA  = [2, 9, 16, 23];  // Bharani, Ashlesha, Vishakha, Shravana

// ===================== EPHEMERIS =====================================
async function loadAstroEngine() {
  const mod = await import("https://esm.sh/astronomy-engine@2.1.19");
  return mod;
}

function utcToJulianDay(iso: string): number {
  const d = new Date(iso);
  return d.getTime() / 86400000 + 2440587.5;
}

function julianCenturiesTT(jdUt: number): number {
  const jdTt = jdUt + 69.2 / 86400;
  return (jdTt - 2451545.0) / 36525.0;
}

// Lahiri ayanamsa at J2000.0, in degrees. Matches chart-gateway AYANAMSA_J2000.
const AYANAMSA_J2000 = 23.85292;

// Precession in ecliptic longitude accumulated since J2000, in degrees.
// Mirrors chart-gateway ePrecessionSinceJ2000 so SBC-Core stays in parity
// with the validated engine.
function precessionSinceJ2000(T: number): number {
  return 1.3969713 * T + 0.0003086 * T * T;
}

// Lahiri ayanamsa referred to the mean equinox OF DATE.
// Written as J2000 value + accumulated precession so the frame logic is
// explicit and byte-for-byte equivalent to chart-gateway eAyanamsaDeg().
// (Algebraically identical to 23.85292 + 1.3969713*T + 0.0003086*T*T.)
function ayanamsaDeg(T: number): number {
  return AYANAMSA_J2000 + precessionSinceJ2000(T);
}

function norm360(x: number): number {
  const y = x % 360;
  return y < 0 ? y + 360 : y;
}

// Compute sidereal (Lahiri) longitude at a given UTC ISO for one body.
//
// FRAME HANDLING (do not "simplify" or "fix" this):
//   - Astro.Ecliptic(Astro.GeoVector(...)) returns an ecliptic-OF-DATE
//     longitude, NOT a J2000 longitude. Same validated finding documented in
//     chart-gateway eEclipticLonOfDate().
//   - Therefore precession is NOT added to the longitude. Precession lives
//     inside ayanamsaDeg(T) = AYANAMSA_J2000 + precessionSinceJ2000(T).
//     Adding it in both places double-counts (~0.05 deg near these epochs)
//     and was caught by an independent Meeus cross-check.
//   - The lunar mean-node series is likewise already mean-equinox-of-date,
//     so it needs no precession term either.
//   - Sidereal = (longitude of date) - ayanamsaDeg(T), uniformly, every body.
//
// All 7 physical bodies (including the Moon) go through GeoVector + Ecliptic
// so every body shares one frame. Do NOT use EclipticGeoMoon here: it returns
// a Spherical whose longitude field is .lon, not .elon, so reading .elon
// yields undefined -> NaN and silently nulls every derived value.
async function siderealLon(Astro: any, body: string, iso: string): Promise<number> {
  const d = new Date(iso);
  const jd = utcToJulianDay(iso);
  const T = julianCenturiesTT(jd);
  const ayn = ayanamsaDeg(T);

  let lonOfDate: number;
  if (body === "rahu" || body === "ketu") {
    // Mean lunar ascending node, mean equinox OF DATE (already of-date).
    const t = (jd - 2451545.0) / 36525;
    const meanNode = norm360(125.04452 - 1934.136261 * t + 0.0020708 * t*t + t*t*t/450000);
    lonOfDate = body === "rahu" ? meanNode : norm360(meanNode + 180);
  } else {
    const bodyMap: Record<string, any> = {
      sun: Astro.Body.Sun, moon: Astro.Body.Moon, mercury: Astro.Body.Mercury,
      venus: Astro.Body.Venus, mars: Astro.Body.Mars, jupiter: Astro.Body.Jupiter,
      saturn: Astro.Body.Saturn
    };
    const b = bodyMap[body];
    if (b === undefined) throw new Error(`siderealLon: unknown body "${body}"`);

    const vec = Astro.GeoVector(b, d, true);   // equatorial, aberration-corrected
    const ec = Astro.Ecliptic(vec);            // -> EclipticCoordinates { elat, elon, vec }
    const lonRaw = ec?.elon;                   // ecliptic longitude OF DATE

    if (typeof lonRaw !== "number" || !isFinite(lonRaw)) {
      throw new Error(
        `siderealLon: ephemeris returned non-numeric elon for "${body}" at ${iso} ` +
        `(got ${JSON.stringify(lonRaw)}; Ecliptic keys: ${ec ? Object.keys(ec).join(",") : "null"})`
      );
    }
    // No precession term here on purpose - see FRAME HANDLING note above.
    lonOfDate = norm360(lonRaw);
  }

  const sidereal = norm360(lonOfDate - ayn);
  if (!isFinite(sidereal)) {
    throw new Error(`siderealLon: non-finite sidereal longitude for "${body}" at ${iso}`);
  }
  return sidereal;
}

// Compute all 9 planet sidereal longitudes at date
async function computeAllPlanets(iso: string) {
  const Astro = await loadAstroEngine();
  const bodies = ["sun","moon","mars","mercury","jupiter","venus","saturn","rahu","ketu"];
  const result: Record<string, {lon: number, dailyDelta: number}> = {};
  for (const b of bodies) {
    const lonNow = await siderealLon(Astro, b, iso);
    // Compute lon at +24h to get daily motion
    const iso2 = new Date(new Date(iso).getTime() + 86400000).toISOString();
    const lonNext = await siderealLon(Astro, b, iso2);
    let delta = lonNext - lonNow;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    result[b] = { lon: lonNow, dailyDelta: delta };
  }
  return result;
}

// ===================== CLASSICAL LAYER ================================
// Determine n28 nakshatra from sidereal longitude (0-360)
function siderealLonToN28(lon: number): { n28: number, name: string, pada: number, insideAbhijit: boolean } {
  const n0 = lon;
  const insideAbhijit = n0 >= ABHIJIT_START && n0 < ABHIJIT_END;
  if (insideAbhijit) {
    // Abhijit is 22 in 28-scheme
    const withinAbhijit = (n0 - ABHIJIT_START) / (ABHIJIT_END - ABHIJIT_START);
    return { n28: 22, name: "Abhijit", pada: Math.min(4, Math.floor(withinAbhijit * 4) + 1), insideAbhijit: true };
  }
  // Map to 27-scheme first
  const n27idx = Math.floor(n0 / NAK_WIDTH); // 0..26
  const within = (n0 - n27idx * NAK_WIDTH) / NAK_WIDTH;
  const pada = Math.min(4, Math.floor(within * 4) + 1);
  const name27 = NAK27[n27idx];
  // Map n27idx (0-based) to n28. n28 order: 1=Ashwini, ..., 21=U.Ashada, 22=Abhijit, 23=Shravana, ..., 28=Revati
  const n27num = n27idx + 1;
  let n28: number;
  if (n27num <= 21) n28 = n27num;
  else n28 = n27num + 1; // shift by 1 for Shravana onward
  return { n28, name: name27, pada, insideAbhijit: false };
}

function siderealLonToRashi(lon: number): { rashi_num: number, name: string, deg_in_rashi: number } {
  const idx = Math.floor(lon / 30);
  return { rashi_num: idx + 1, name: RASHI[idx], deg_in_rashi: lon - idx * 30 };
}

function determineDignity(body: string, rashi_num: number, deg_in_rashi: number, retrograde: boolean): { state: string, multiplier: number } {
  const e = EXALT[body];
  const d = DEBIL[body];
  if (e && e.r === rashi_num && Math.abs(deg_in_rashi - e.d) <= DIGNITY_ORB) {
    return { state: "exalted", multiplier: 3.0 };
  }
  if (d && d.r === rashi_num && Math.abs(deg_in_rashi - d.d) <= DIGNITY_ORB) {
    // stack rule: retro > debil
    return retrograde
      ? { state: "retrograde_debilitated", multiplier: 2.0 }
      : { state: "debilitated", multiplier: 0.5 };
  }
  if (retrograde) return { state: "retrograde", multiplier: 2.0 };
  return { state: "normal", multiplier: 1.0 };
}

function determineMotion(body: string, dailyDelta: number): { retrograde: boolean, fast: boolean, normal: boolean } {
  if (body === "sun" || body === "moon") {
  // Luminaries never retrograde. Apply the SAME accelerated-motion test as
  // every other graha: fast = |daily delta| > own mean * 1.1 (Option B).
  const mean = Math.abs(MEAN_DAILY[body] ?? 1);
  const fast = Math.abs(dailyDelta) > mean * 1.1;
  return { retrograde: false, fast, normal: !fast };
}
  if (body === "rahu" || body === "ketu") {
    // Mean node always retrograde
    return { retrograde: true, fast: false, normal: false };
  }
  const mean = Math.abs(MEAN_DAILY[body] ?? 1);
  const retro = dailyDelta < 0;
  const fast = !retro && Math.abs(dailyDelta) > mean * 1.1;
  return { retrograde: retro, fast, normal: !retro && !fast };
}

// Rule II/III: determine active vedha type for a planet
function activeVedhaType(body: string, motion: { retrograde: boolean, fast: boolean }): "sammukha" | "savya" | "apasavya" {
  if (body === "rahu" || body === "ketu") return "apasavya";     // Rule II nodes
  if (body === "sun" || body === "moon") return "savya";          // Rule II luminaries
  if (motion.retrograde) return "apasavya";                       // Rule III retro
  if (motion.fast) return "savya";                                 // Rule III fast
  return "sammukha";                                               // Rule III normal
}

// Grid geometry: for a nakshatra at outer-ring (r,c), compute the 3 vedha targets
function vedhaTargets(r: number, c: number): { sammukha: [number,number], savya: [number,number], apasavya: [number,number] } {
  // Top row (r=1)
  if (r === 1) {
    return {
      sammukha: [9, c],
      savya: [10 - c, 9],       // down-right diagonal -> right col
      apasavya: [c, 1]            // down-left diagonal -> left col
    };
  }
  // Right col (c=9)
  if (c === 9) {
    return {
      sammukha: [r, 1],
      savya: [9, r],              // down-left diagonal -> bottom row
      apasavya: [1, 10 - r]       // up-left diagonal -> top row
    };
  }
  // Bottom row (r=9)
  if (r === 9) {
    return {
      sammukha: [1, c],
      savya: [10 - c, 1],         // up-left diagonal -> left col
      apasavya: [c, 9]            // up-right diagonal -> right col
    };
  }
  // Left col (c=1)
  return {
    sammukha: [r, 9],
    savya: [1, r],                 // up-right diagonal -> top row
    apasavya: [9, 10 - r]          // down-right diagonal -> bottom row
  };
}

// Detect Rath Corollary 1.01 corner-trigger condition
function isCornerTrigger(n28: number, pada: number): boolean {
  if (n28 === 22) return false; // Abhijit not a trigger
  if (pada === 1 && CORNER_TRIGGER_FIRST_PADA.includes(n28)) return true;
  if (pada === 4 && CORNER_TRIGGER_LAST_PADA.includes(n28)) return true;
  return false;
}

// Moon paksha (dark = Krishna, bright = Shukla)
function moonPaksha(tithi_num: number): "shukla" | "krishna" {
  // tithi 1-15 shukla; 16-30 krishna (or K1-K15 by convention)
  return tithi_num <= 15 ? "shukla" : "krishna";
}

// Is Moon considered dark/weakened (K8 to S8 in Rath convention = tithis 23..30 + 1..8)
function isMoonDark(tithi_num: number): boolean {
  return (tithi_num >= 23 && tithi_num <= 30) || (tithi_num >= 1 && tithi_num <= 8);
}

// Compute planet_states for all 9 planets
function computePlanetStates(planets: Record<string, {lon:number,dailyDelta:number}>) {
  const states: Record<string, any> = {};
  for (const [body, p] of Object.entries(planets)) {
    const nak = siderealLonToN28(p.lon);
    const rashi = siderealLonToRashi(p.lon);
    const motion = determineMotion(body, p.dailyDelta);
    const dignity = determineDignity(body, rashi.rashi_num, rashi.deg_in_rashi, motion.retrograde);
    states[body] = {
      sidereal_lon: Number(p.lon.toFixed(4)),
      daily_delta_deg: Number(p.dailyDelta.toFixed(4)),
      nakshatra: { n28: nak.n28, name: nak.name, pada: nak.pada, insideAbhijit: nak.insideAbhijit },
      rashi: rashi,
      motion,
      dignity,
      corner_trigger: isCornerTrigger(nak.n28, nak.pada)
    };
  }
  return states;
}

// Compute all vedhas from all planets onto asset's janma nakshatra
function computeVedhas(
  planetStates: Record<string, any>,
  targetN28: number,
  tithi_num: number
) {
  const target = NAK28_POS[targetN28];
  if (!target) throw new Error(`invalid target n28: ${targetN28}`);

  const moonDark = isMoonDark(tithi_num);
  const vedhas: any[] = [];

  for (const [body, s] of Object.entries(planetStates)) {
    const nakPos = NAK28_POS[s.nakshatra.n28];
    if (!nakPos) continue;

    const vtype = activeVedhaType(body, s.motion);
    const targets = vedhaTargets(nakPos.r, nakPos.c);
    const hitCoord = targets[vtype];
    const hits = hitCoord[0] === target.r && hitCoord[1] === target.c;
    if (!hits) continue;

    // Malefic determination
    let isMalefic = MALEFIC_ALWAYS.includes(body);
    if (body === "mercury") {
      // Malefic if in same nakshatra as Saturn or Rahu
      const saturnNak = planetStates.saturn?.nakshatra?.n28;
      const rahuNak = planetStates.rahu?.nakshatra?.n28;
      if (saturnNak === s.nakshatra.n28 || rahuNak === s.nakshatra.n28) isMalefic = true;
    }
    if (body === "moon" && moonDark) {
      // Dark-phase Moon weakened; treat contribution as reduced but not always malefic
      // Flag for scoring layer to apply moon_dark_half_delta
    }

    vedhas.push({
      planet: body,
      vedha_type: vtype,
      planet_nakshatra_n28: s.nakshatra.n28,
      planet_nakshatra_pada: s.nakshatra.pada,
      target_nakshatra_n28: targetN28,
      dignity: s.dignity.state,
      dignity_multiplier: s.dignity.multiplier,
      motion: s.motion.retrograde ? "retrograde" : (s.motion.fast ? "fast" : "normal"),
      is_malefic: isMalefic,
      is_moon_dark: body === "moon" && moonDark
    });
  }
  return vedhas;
}

// Special corner vedha detection (Rath Corollary 1.01)
function detectCornerVedha(planetStates: Record<string, any>) {
  const triggers: any[] = [];
  let maleficCount = 0;
  for (const [body, s] of Object.entries(planetStates)) {
    if (s.corner_trigger) {
      const isMalefic = MALEFIC_ALWAYS.includes(body);
      if (isMalefic) maleficCount++;
      triggers.push({
        planet: body,
        nakshatra_n28: s.nakshatra.n28,
        pada: s.nakshatra.pada,
        is_malefic: isMalefic
      });
    }
  }
  return {
    active: triggers.length > 0,
    triggers,
    malefic_count: maleficCount
  };
}

// Krura grading: count of distinct malefic planets with any vedha on target
function computeKruraGrade(vedhas: any[]): number {
  const maleficPlanets = new Set<string>();
  for (const v of vedhas) {
    if (v.is_malefic) maleficPlanets.add(v.planet);
  }
  return Math.min(5, maleficPlanets.size);
}

// Full classical computation for one asset on one date
function runClassicalLayer(
  planetStates: Record<string, any>,
  assetJanma: { nakshatra: {n28: number}, rashi: {rashi_num: number}, tithi: {tithi_num: number}, vara: {name: string} },
  currentTithi: number
) {
  const vedhas = computeVedhas(planetStates, assetJanma.nakshatra.n28, currentTithi);
  const cornerVedha = detectCornerVedha(planetStates);
  const kruraGrade = computeKruraGrade(vedhas);
  const maleficVedhaCount = vedhas.filter(v => v.is_malefic).length;

  return {
    planet_states: planetStates,
    asset_janma_nakshatra_n28: assetJanma.nakshatra.n28,
    asset_janma_rashi_num: assetJanma.rashi.rashi_num,
    asset_janma_tithi: assetJanma.tithi.tithi_num,
    asset_janma_vara: assetJanma.vara.name,
    current_tithi: currentTithi,
    vedhas,
    corner_vedha: cornerVedha,
    malefic_vedha_count: maleficVedhaCount,
    krura_grade: kruraGrade,
    engine_grid_version: GRID_VERSION
  };
}

// ===================== SCORING LAYER =================================
// Pure function: classical_data + weights -> scored_data
function runScoringLayer(classical: any, weights: any) {
  const vs = weights.vedha_strength;
  const pb = weights.planet_base;
  const pc = weights.planet_conditional || {};
  const dm = weights.dignity_multiplier;
  const cg = weights.corner_vedha_grade_multipliers || {};
  const sc = weights.score_scaling || {};

  const contributions: any[] = [];
  let scoreRaw = 0;

  for (const v of classical.vedhas) {
    let planetBase = pb[v.planet] ?? 0;

    // Conditional adjustments
    if (v.planet === "mercury" && v.is_malefic && v.planet !== "sun") {
      // Mercury flipped malefic via Saturn/Rahu conjunction
      planetBase += pc.mercury_with_saturn_or_rahu_delta ?? 0;
    }
    if (v.is_moon_dark) {
      planetBase += pc.moon_dark_half_delta ?? 0;
    }

    const vedhaStrength = vs[v.vedha_type] ?? 0;
    const contribution = planetBase * vedhaStrength * v.dignity_multiplier;
    scoreRaw += contribution;

    contributions.push({
      planet: v.planet,
      vedha_type: v.vedha_type,
      planet_base_effective: Number(planetBase.toFixed(3)),
      vedha_strength: vedhaStrength,
      dignity_multiplier: v.dignity_multiplier,
      contribution: Number(contribution.toFixed(4)),
      is_malefic: v.is_malefic
    });
  }

  // Corner vedha contribution
  if (classical.corner_vedha.active) {
    const grade = String(Math.min(5, classical.corner_vedha.malefic_count));
    const cornerMult = cg[grade] ?? 0;
    const cornerContribution = -1 * (vs.special_corner ?? 0) * cornerMult *
      Math.abs(pb.saturn ?? 3); // treated as saturn-scale malefic pulse
    scoreRaw += cornerContribution;
    contributions.push({
      planet: "corner_vedha",
      vedha_type: "special_corner",
      malefic_count: classical.corner_vedha.malefic_count,
      grade_multiplier: cornerMult,
      contribution: Number(cornerContribution.toFixed(4)),
      is_malefic: classical.corner_vedha.malefic_count > 0
    });
  }

  const clip = sc.final_score_clip ?? [-100, 100];
  const scoreClipped = Math.max(clip[0], Math.min(clip[1], scoreRaw));

  return {
    score_raw: Number(scoreRaw.toFixed(4)),
    score_clipped: Number(scoreClipped.toFixed(4)),
    percentile_60d: null, // computed server-side via v_sbc_recent view
    contributions,
    weights_snapshot_keys: Object.keys(weights),
    scoring_version: weights.version ?? "unknown"
  };
}

// ===================== ASSET NATAL BOOTSTRAP =========================
async function ensureAssetCharts(sb: any) {
  const { data: existing } = await sb.from("sbc_asset_charts").select("asset_key");
  const existingKeys = new Set((existing ?? []).map((r: any) => r.asset_key));

  for (const asset of ASSET_NATALS) {
    if (existingKeys.has(asset.key)) continue;

    const planets = await computeAllPlanets(asset.utc);
    const moonLon = planets.moon.lon;
    const sunLon = planets.sun.lon;

    // Hard guard: never write a row with a non-finite luminary longitude.
    // Fail loudly instead of silently storing null astrological values.
    if (!isFinite(moonLon) || !isFinite(sunLon)) {
      throw new Error(
        `ensureAssetCharts: non-finite luminary longitude for ${asset.key} ` +
        `(moon=${moonLon}, sun=${sunLon})`
      );
    }

    const nak = siderealLonToN28(moonLon);
    const rashi = siderealLonToRashi(moonLon);

    // Tithi: elongation of Moon from Sun / 12° = tithi index
    let elong = norm360(moonLon - sunLon);
    const tithi_num = Math.floor(elong / 12) + 1; // 1..30
    if (!Number.isFinite(tithi_num) || tithi_num < 1 || tithi_num > 30) {
      throw new Error(
        `ensureAssetCharts: invalid tithi ${tithi_num} for ${asset.key} ` +
        `(elong=${elong}, moon=${moonLon}, sun=${sunLon})`
      );
    }

    // Vara at UTC time (weekday in Mumbai IST)
    const istMs = new Date(asset.utc).getTime() + 5.5 * 3600000;
    const varaIdx = new Date(istMs).getUTCDay(); // 0=Sun..6=Sat
    const varaNames = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

    const jd = utcToJulianDay(asset.utc);
    const T = julianCenturiesTT(jd);
    const ayanamsa = ayanamsaDeg(T);

    const janma = {
      nakshatra: nak,
      rashi: rashi,
      tithi: { tithi_num, paksha: moonPaksha(tithi_num) },
      vara: { name: varaNames[varaIdx], num: varaIdx },
      ayanamsa_deg: Number(ayanamsa.toFixed(6)),
      // Raw audit trail so every derived value above can be independently rechecked.
      raw: {
        moon_sidereal_lon: Number(moonLon.toFixed(6)),
        sun_sidereal_lon: Number(sunLon.toFixed(6)),
        elongation_deg: Number(elong.toFixed(6)),
        ayanamsa_j2000_deg: AYANAMSA_J2000,
        precession_since_j2000_deg: Number(precessionSinceJ2000(T).toFixed(6))
      },
      computed_from: {
        engine: "astronomy-engine@2.1.19",
        ayanamsa_model: "lahiri-v1",
        frame_pipeline: "ecliptic-of-date elon -> -ayanamsaDeg(T); ayanamsaDeg = AYANAMSA_J2000 + precession(T)",
        parity_with: "chart-gateway eSiderealLonOfBody (astronomy-engine@2.1.19+lahiri-v1)"
      }
    };

    await sb.from("sbc_asset_charts").insert({
      asset_key: asset.key,
      asset_name: asset.name,
      asset_category: asset.category,
      inception_utc: asset.utc,
      inception_lat: asset.lat,
      inception_lon: asset.lon,
      inception_locale: asset.locale,
      janma_snapshot: janma,
      engine_version: ENGINE_VERSION
    });
  }
}

// ===================== MAIN HANDLER ==================================
async function loadActiveConfig(sb: any) {
  const { data, error } = await sb.from("sbc_config").select("*").eq("is_active", true).single();
  if (error) throw new Error(`no active sbc_config: ${error.message}`);
  return { weights: { ...data.weights, version: data.version }, version: data.version };
}

async function loadPanchangaForDate(sb: any, dateStr: string) {
  const { data } = await sb.from("panchanga_daily").select("*").eq("panchanga_date", dateStr).maybeSingle();
  return data;
}

async function computeForDate(sb: any, dateStr: string, config: any) {
  // Anchor: sunrise IST. Fallback: 06:00 IST if panchanga row missing.
  const panchanga = await loadPanchangaForDate(sb, dateStr);
  let sunriseIso: string;
  let currentTithi = 1;
  let currentVaraName = "Unknown";

  if (panchanga && panchanga.sunrise_utc) {
    sunriseIso = panchanga.sunrise_utc;
  } else if (panchanga && panchanga.sunrise_ist) {
    // convert IST HH:mm:ss on dateStr to UTC ISO
    const [h,m,s] = String(panchanga.sunrise_ist).split(":");
    const istMs = new Date(`${dateStr}T${h}:${m||"00"}:${s||"00"}+05:30`).getTime();
    sunriseIso = new Date(istMs).toISOString();
  } else {
    // Fallback: 06:00 IST
    sunriseIso = new Date(`${dateStr}T06:00:00+05:30`).toISOString();
  }
  if (panchanga) {
    currentTithi = panchanga.tithi_number ?? panchanga.tithi_num ?? 1;
    currentVaraName = panchanga.vara ?? panchanga.weekday ?? "Unknown";
  }

  const planets = await computeAllPlanets(sunriseIso);
  const planetStates = computePlanetStates(planets);

  const { data: assets } = await sb.from("sbc_asset_charts").select("*");
  if (!assets || assets.length === 0) throw new Error("no sbc_asset_charts rows");

  const rows: any[] = [];
  for (const asset of assets) {
    const classical = runClassicalLayer(planetStates, asset.janma_snapshot, currentTithi);
    const scored = runScoringLayer(classical, config.weights);
    rows.push({
      sbc_date: dateStr,
      asset_key: asset.asset_key,
      classical_data: classical,
      scored_data: scored,
      severe_krura: classical.krura_grade >= 4,
      engine_version: ENGINE_VERSION,
      config_version: config.version
    });
  }

  const { error } = await sb.from("sbc_vedha_daily").upsert(rows, { onConflict: "sbc_date,asset_key" });
  if (error) throw new Error(`upsert failed: ${error.message}`);

  return { date: dateStr, rows_written: rows.length, current_tithi: currentTithi };
}

// ===================== HTTP HANDLER ==================================
// Safe fingerprint of a secret: never returns the secret itself.
function fp(s: string): string {
  if (!s) return "(empty)";
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) >>> 0; }
  return `len=${s.length} hash=${h.toString(16)}`;
}

Deno.serve(async (req: Request) => {
  try {
    const url = new URL(req.url);
    const mode = url.searchParams.get("mode") || "daily";  // daily | backfill | asset_bootstrap | diag | purge_assets
    const dateParam = url.searchParams.get("date");                 // YYYY-MM-DD (daily mode)
    const backfillYears = parseInt(url.searchParams.get("years") || "10", 10);

    // ---- Auth -------------------------------------------------------
    // The Supabase dashboard Test panel overwrites the Authorization header
    // with the project JWT and drops custom headers, so a ?secret= query
    // parameter is accepted as an equal-rank credential for manual invokes.
    // Production pg_cron uses the Authorization header, which works normally.
    const envSbc = Deno.env.get("SBC_CRON_SECRET") || "";
    const envMarket = Deno.env.get("MARKET_CRON_SECRET") || "";
    const envTransit = Deno.env.get("TRANSIT_CRON_SECRET") || "";
    const accepted = [envSbc, envMarket, envTransit].filter(s => s.length > 0);

    const hdrCron = (req.headers.get("x-cron-secret") || "").trim();
    const hdrAuthRaw = (req.headers.get("authorization") || "").trim();
    const hdrAuth = hdrAuthRaw.replace(/^Bearer\s+/i, "").trim();
    const qsSecret = (url.searchParams.get("secret") || "").trim();

    const candidates = [hdrCron, hdrAuth, qsSecret].filter(s => s.length > 0);

    // ---- Diagnostic mode (no auth required; leaks no secret values) --
    if (mode === "diag") {
      return new Response(JSON.stringify({
        ok: true,
        mode: "diag",
        engine: ENGINE_NAME,
        version: ENGINE_VERSION,
        env_secrets_present: {
          SBC_CRON_SECRET: envSbc.length > 0 ? fp(envSbc) : "NOT SET",
          MARKET_CRON_SECRET: envMarket.length > 0 ? fp(envMarket) : "NOT SET",
          TRANSIT_CRON_SECRET: envTransit.length > 0 ? fp(envTransit) : "NOT SET"
        },
        headers_received: {
          "x-cron-secret": hdrCron.length > 0 ? fp(hdrCron) : "NOT SENT",
          "authorization_raw_prefix": hdrAuthRaw ? hdrAuthRaw.slice(0, 12) + "..." : "NOT SENT",
          "authorization_after_bearer_strip": hdrAuth.length > 0 ? fp(hdrAuth) : "NOT SENT",
          "looks_like_jwt": hdrAuth.split(".").length === 3
        },
        query_secret: qsSecret.length > 0 ? fp(qsSecret) : "NOT SENT",
        would_authorize: candidates.some(c => accepted.includes(c)),
        hint: "Pass ?secret=<SBC_CRON_SECRET> as a query parameter when invoking from the dashboard Test panel."
      }, null, 2), { headers: {"content-type":"application/json"} });
    }

    if (accepted.length === 0 || !candidates.some(c => accepted.includes(c))) {
      return new Response(JSON.stringify({
        error: "unauthorized",
        detail: "No supplied secret matched a configured cron secret.",
        env_secret_configured: accepted.length > 0,
        sent_x_cron_secret: hdrCron.length > 0,
        sent_authorization: hdrAuthRaw.length > 0,
        sent_query_secret: qsSecret.length > 0,
        authorization_looks_like_jwt: hdrAuth.split(".").length === 3,
        next_step: "Call ?mode=diag (no auth needed) to compare secret fingerprints."
      }, null, 2), { status: 401, headers: {"content-type":"application/json"} });
    }

    // ---- Purge asset charts (lets a corrected bootstrap re-run cleanly) --
    if (mode === "purge_assets") {
      const supaUrlP = Deno.env.get("SUPABASE_URL") || Deno.env.get("PROJECT_URL") || "";
      const supaKeyP = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SERVICE_ROLE_KEY") || "";
      const sbP = createClient(supaUrlP, supaKeyP);
      const { error: delErr } = await sbP.from("sbc_asset_charts").delete().neq("asset_key", "__none__");
      if (delErr) throw new Error(`purge_assets failed: ${delErr.message}`);
      return new Response(JSON.stringify({
        ok: true, mode: "purge_assets",
        note: "sbc_asset_charts cleared. Re-run ?mode=asset_bootstrap to recompute."
      }, null, 2), { headers: {"content-type":"application/json"} });
    }

    const supaUrl = Deno.env.get("SUPABASE_URL") || Deno.env.get("PROJECT_URL") || "";
    const supaKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SERVICE_ROLE_KEY") || "";
    if (!supaUrl || !supaKey) throw new Error("SUPABASE_URL / SERVICE_ROLE_KEY missing");
    const sb = createClient(supaUrl, supaKey);

    await ensureAssetCharts(sb);

    const config = await loadActiveConfig(sb);

    if (mode === "asset_bootstrap") {
      return new Response(JSON.stringify({ ok: true, mode, engine: ENGINE_NAME, version: ENGINE_VERSION }), { headers: {"content-type":"application/json"} });
    }

    if (mode === "backfill") {
      const today = new Date();
      const results: any[] = [];
      for (let daysAgo = backfillYears * 365; daysAgo >= 0; daysAgo--) {
        const d = new Date(today.getTime() - daysAgo * 86400000);
        const iso = d.toISOString().slice(0, 10);
        try {
          const r = await computeForDate(sb, iso, config);
          results.push(r);
        } catch (e) {
          results.push({ date: iso, error: (e as Error).message });
        }
      }
      return new Response(JSON.stringify({ ok: true, mode, engine: ENGINE_NAME, version: ENGINE_VERSION, backfill_days: results.length, last: results[results.length-1] }), { headers: {"content-type":"application/json"} });
    }

    // daily mode
    const dateStr = dateParam || new Date().toISOString().slice(0,10);
    const result = await computeForDate(sb, dateStr, config);
    return new Response(JSON.stringify({ ok: true, engine: ENGINE_NAME, version: ENGINE_VERSION, ...result }), { headers: {"content-type":"application/json"} });

  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message, engine: ENGINE_NAME, version: ENGINE_VERSION }), { status: 500, headers: {"content-type":"application/json"} });
  }
});
