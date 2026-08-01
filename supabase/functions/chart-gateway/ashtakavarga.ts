// Ashtakavarga (Bhinna + Sarva) — pure, deterministic computation.
//
// Matches the Prokerala ashtakavarga / sarvashtakavarga artifact envelope so
// it drops into chart_artifacts.chart_jsonb without breaking consumers.
//
// Envelope:
//   bhinna -> { status:"ok", data:{ ashtakavarga:{ trikona, prastara, ekaadhipatya } } }
//   sarva  -> { status:"ok", data:{ sarvashtakavarga:{ trikona, prastara, ekaadhipatya } } }
//
// SOURCE (Parashari Prastarashtakavarga benefic-point tables) — cross-checked
// against two independent open-source Vedic astrology libraries, both citing
// BPHS Ch. 66:
//   - kunjara/jyotish (PHP)     src/Bala/AshtakaVarga.php
//   - naturalstupid/PyJHora     src/jhora/const.py  (ashtaka_varga_dict)
// Per-planet grand totals verified: Sun 48, Moon 49, Mars 39, Mercury 54,
// Jupiter 56, Venus 52, Saturn 39 (sum 337). See assertBenefiTableTotals().
//
// Reduction algorithms — Trikona Shodhana ported directly from PyJHora
// src/jhora/horoscope/chart/ashtakavarga.py (_trikona_sodhana); Ekadhipatya
// Shodhana started from the same source's _ekadhipatya_sodhana but its
// SCOPE was widened based on empirical parity against real Prokerala data
// (see below) — Prokerala does not restrict a pair to only its own planet's
// row the way PyJHora's reference implementation does.
//   Trikona     — for each trine {1,5,9},{2,6,10},{3,7,11},{4,8,12}
//                 (Aries-fixed frame): if any member is 0, skip; if all
//                 three are equal, zero all three; else subtract the min of
//                 the three from all three.
//   Ekadhipatya — for each same-lord sign pair (Mars: Ari/Sco, Mercury:
//                 Gem/Vir, Jupiter: Sag/Pis, Venus: Tau/Lib, Saturn: Cap/Aqu):
//                 skip if either value is already 0, or if BOTH signs are
//                 occupied by a graha in the natal chart. If both empty:
//                 equal -> both zero, unequal -> higher pulled down to the
//                 lower. If one occupied, one empty: the empty sign is
//                 zeroed if its value is lower than the occupied sign's,
//                 else set equal to it.
//
// ekaadhipatya below is a standard shodhana implementation and intentionally
// does NOT byte-match Prokerala's variant (see status notes below) — it is
// currently unconsumed by the app; only prastara and trikona are served.
//
// Status against scripts/ashtakavarga-parity.ts (16-user --all run,
// deep-value compare against real stored Prokerala artifacts):
//   - prastara (HARD gate): 114/114 exact, including every contributor cell.
//   - trikona: 114/114 exact. Bhinna trikona = trikonaShodhana(own raw BAV).
//     Sarva trikona = SUM of each of the 7 planets' own trikona-reduced BAV
//     (NOT trikona applied directly to the raw summed SAV row — that gave
//     0/16 SAV matches; summing the per-planet reduced rows gave 16/16).
//   - ekaadhipatya: bhinna is applied with ALL 5 owned-sign pairs to every
//     planet's row (not just that planet's own pair — PyJHora's own-pair-
//     only scoping left Sun/Moon rows untouched, which measurably diverged
//     from Prokerala; applying all 5 pairs made Sun/Moon match exactly and
//     brought the other 5 planets close, with a handful of residual
//     per-house misses likely from a few users whose fetched natal snapshot
//     no longer matches the birth data their stored artifact was computed
//     from). Sarva ekaadhipatya is applied as an INDEPENDENT single pass of
//     all 5 pairs directly on the RAW (unreduced) summed SAV row — this
//     reproduces Prokerala's characteristic light reduction (SAV
//     ekaadhipatya totals stay close to the 337 prastara total, unlike
//     trikona's heavy reduction) far better than summing per-planet
//     reductions did, but is NOT yet an exact match on every house. This is
//     the one open gap; ekaadhipatya is not the hard gate.
//
// The benefic tables above were independently re-verified against the same
// 16-user capture set: aggregating which (contributor, offset) pairs are
// consistently marked present across every user's real Prokerala bhinna rows
// isolated 4 transcription errors in the initial table port (Moon's own row
// had a spurious offset 9; Moon's Mars row was missing offset 9; Moon's
// Jupiter row had 2 instead of 12; Venus's Mars row had 4 instead of 5) —
// all four are fixed in the tables above and now match Prokerala exactly.

export type AshtakavargaHouseFull = {
  rasi: { id: number; name: string; lord: { id: number; name: string; vedic_name: string } };
  house: { id: number; name: string; number: number };
  score: number;
  planets: Array<{ score: number; planet: { id: number; name: string; vedic_name: string } }>;
};

export type AshtakavargaHouseScoreOnly = {
  rasi: { id: number; name: string; lord: { id: number; name: string; vedic_name: string } };
  house: { id: number; name: string; number: number };
  score: number;
};

export type AshtakavargaGridFull = { score: number; houses: AshtakavargaHouseFull[] };
export type AshtakavargaGridReduced = { score: number; houses: AshtakavargaHouseScoreOnly[] };

export type BhinnaPayload = {
  status: "ok";
  data: {
    ashtakavarga: {
      trikona: AshtakavargaGridReduced;
      prastara: AshtakavargaGridFull;
      ekaadhipatya: AshtakavargaGridReduced;
    };
  };
};

export type SarvaPayload = {
  status: "ok";
  data: {
    sarvashtakavarga: {
      trikona: AshtakavargaGridReduced;
      prastara: AshtakavargaGridFull;
      ekaadhipatya: AshtakavargaGridReduced;
    };
  };
};

// ---------- Static tables ----------

const RASI_NAMES = [
  "Mesha",
  "Vrishabha",
  "Mithuna",
  "Karka",
  "Simha",
  "Kanya",
  "Tula",
  "Vrischika",
  "Dhanu",
  "Makara",
  "Kumbha",
  "Meena",
];
const HOUSE_NAMES = [
  "Tanu",
  "Dhan",
  "Sahaj",
  "Bandhu",
  "Putra",
  "Ari",
  "Yuvati",
  "Randhra",
  "Dharma",
  "Karma",
  "Labha",
  "Vyaya",
];

// Our internal planet-id scheme (matches computeNatalPayload / mangal.ts / kaalsarp.ts).
const SUN = 0, MOON = 1, MERCURY = 2, VENUS = 3, MARS = 4, JUPITER = 5, SATURN = 6, ASC = 100;

const PLANET_NAME: Record<number, string> = {
  [SUN]: "Sun",
  [MOON]: "Moon",
  [MERCURY]: "Mercury",
  [VENUS]: "Venus",
  [MARS]: "Mars",
  [JUPITER]: "Jupiter",
  [SATURN]: "Saturn",
  [ASC]: "Ascendant",
};
const PLANET_VEDIC_NAME: Record<number, string> = {
  [SUN]: "Ravi",
  [MOON]: "Chandra",
  [MERCURY]: "Budha",
  [VENUS]: "Shukra",
  [MARS]: "Kuja",
  [JUPITER]: "Guru",
  [SATURN]: "Shani",
  [ASC]: "Lagna",
};

// Sign rulership, 0 = Aries(Mesha) .. 11 = Pisces(Meena).
const RASI_LORD_ID = [MARS, VENUS, MERCURY, MOON, SUN, MERCURY, VENUS, MARS, JUPITER, SATURN, SATURN, JUPITER];

// Contributor order used for prastara.planets breakdown (bhinna): ascending id.
const CONTRIBUTOR_ORDER = [SUN, MOON, MERCURY, VENUS, MARS, JUPITER, SATURN, ASC];
// The 7 "own" planets, ascending id, used for sarva breakdown.
const SEVEN_PLANETS = [SUN, MOON, MERCURY, VENUS, MARS, JUPITER, SATURN];

// Benefic house-offsets (1-12, counted inclusively from the contributor's own
// sign) that each contributor D gives to target planet P's ashtakavarga.
// Keyed [targetPlanetId][contributorId] -> offsets.
const BENEFIC_TABLE: Record<number, Record<number, number[]>> = {
  [SUN]: {
    [SUN]: [1, 2, 4, 7, 8, 9, 10, 11],
    [MOON]: [3, 6, 10, 11],
    [MARS]: [1, 2, 4, 7, 8, 9, 10, 11],
    [MERCURY]: [3, 5, 6, 9, 10, 11, 12],
    [JUPITER]: [5, 6, 9, 11],
    [VENUS]: [6, 7, 12],
    [SATURN]: [1, 2, 4, 7, 8, 9, 10, 11],
    [ASC]: [3, 4, 6, 10, 11, 12],
  },
  [MOON]: {
    [SUN]: [3, 6, 7, 8, 10, 11],
    [MOON]: [1, 3, 6, 7, 10, 11],
    [MARS]: [2, 3, 5, 6, 9, 10, 11],
    [MERCURY]: [1, 3, 4, 5, 7, 8, 10, 11],
    [JUPITER]: [1, 4, 7, 8, 10, 11, 12],
    [VENUS]: [3, 4, 5, 7, 9, 10, 11],
    [SATURN]: [3, 5, 6, 11],
    [ASC]: [3, 6, 10, 11],
  },
  [MARS]: {
    [SUN]: [3, 5, 6, 10, 11],
    [MOON]: [3, 6, 11],
    [MARS]: [1, 2, 4, 7, 8, 10, 11],
    [MERCURY]: [3, 5, 6, 11],
    [JUPITER]: [6, 10, 11, 12],
    [VENUS]: [6, 8, 11, 12],
    [SATURN]: [1, 4, 7, 8, 9, 10, 11],
    [ASC]: [1, 3, 6, 10, 11],
  },
  [MERCURY]: {
    [SUN]: [5, 6, 9, 11, 12],
    [MOON]: [2, 4, 6, 8, 10, 11],
    [MARS]: [1, 2, 4, 7, 8, 9, 10, 11],
    [MERCURY]: [1, 3, 5, 6, 9, 10, 11, 12],
    [JUPITER]: [6, 8, 11, 12],
    [VENUS]: [1, 2, 3, 4, 5, 8, 9, 11],
    [SATURN]: [1, 2, 4, 7, 8, 9, 10, 11],
    [ASC]: [1, 2, 4, 6, 8, 10, 11],
  },
  [JUPITER]: {
    [SUN]: [1, 2, 3, 4, 7, 8, 9, 10, 11],
    [MOON]: [2, 5, 7, 9, 11],
    [MARS]: [1, 2, 4, 7, 8, 10, 11],
    [MERCURY]: [1, 2, 4, 5, 6, 9, 10, 11],
    [JUPITER]: [1, 2, 3, 4, 7, 8, 10, 11],
    [VENUS]: [2, 5, 6, 9, 10, 11],
    [SATURN]: [3, 5, 6, 12],
    [ASC]: [1, 2, 4, 5, 6, 7, 9, 10, 11],
  },
  [VENUS]: {
    [SUN]: [8, 11, 12],
    [MOON]: [1, 2, 3, 4, 5, 8, 9, 11, 12],
    [MARS]: [3, 5, 6, 9, 11, 12],
    [MERCURY]: [3, 5, 6, 9, 11],
    [JUPITER]: [5, 8, 9, 10, 11],
    [VENUS]: [1, 2, 3, 4, 5, 8, 9, 10, 11],
    [SATURN]: [3, 4, 5, 8, 9, 10, 11],
    [ASC]: [1, 2, 3, 4, 5, 8, 9, 11],
  },
  [SATURN]: {
    [SUN]: [1, 2, 4, 7, 8, 10, 11],
    [MOON]: [3, 6, 11],
    [MARS]: [3, 5, 6, 10, 11, 12],
    [MERCURY]: [6, 8, 9, 10, 11, 12],
    [JUPITER]: [5, 6, 11, 12],
    [VENUS]: [6, 11, 12],
    [SATURN]: [3, 5, 6, 11],
    [ASC]: [1, 3, 4, 6, 10, 11],
  },
};

const EXPECTED_TOTALS: Record<number, number> = {
  [SUN]: 48,
  [MOON]: 49,
  [MARS]: 39,
  [MERCURY]: 54,
  [JUPITER]: 56,
  [VENUS]: 52,
  [SATURN]: 39,
};

function assertBenefiTableTotals(): void {
  let grand = 0;
  for (const p of SEVEN_PLANETS) {
    let total = 0;
    for (const c of CONTRIBUTOR_ORDER) total += (BENEFIC_TABLE[p][c] ?? []).length;
    if (total !== EXPECTED_TOTALS[p]) {
      throw new Error(
        `ashtakavarga: benefic table total mismatch for planet ${p}: got ${total}, expected ${EXPECTED_TOTALS[p]}`,
      );
    }
    grand += total;
  }
  if (grand !== 337) {
    throw new Error(`ashtakavarga: grand total mismatch: got ${grand}, expected 337`);
  }
}
assertBenefiTableTotals();

// Same-lord sign pairs (0-indexed Aries=0) used by Ekadhipatya Shodhana.
// Sun/Moon own only one sign each and have no pair.
const EKADHIPATYA_PAIRS: Array<{ planet: number; signs: [number, number] }> = [
  { planet: MARS, signs: [0, 7] }, // Aries, Scorpio
  { planet: MERCURY, signs: [2, 5] }, // Gemini, Virgo
  { planet: VENUS, signs: [1, 6] }, // Taurus, Libra
  { planet: JUPITER, signs: [8, 11] }, // Sagittarius, Pisces
  { planet: SATURN, signs: [9, 10] }, // Capricorn, Aquarius
];

// ---------- Natal helpers ----------

function signIdOf(p: unknown): number {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rasi = (p as any)?.rasi;
  const id = Number(rasi?.id);
  if (Number.isFinite(id)) return id;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lon = Number((p as any)?.longitude);
  if (Number.isFinite(lon)) return Math.floor((((lon % 360) + 360) % 360) / 30);
  throw new Error("ashtakavarga: missing rasi.id/longitude");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function planetArr(natalPayload: unknown): any[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inner: any = (natalPayload as any)?.data ?? natalPayload;
  return inner?.planet_position ?? [];
}

function signOfId(arr: unknown[], id: number): number {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = (arr as any[]).find((x: any) => x?.id === id);
  if (!p) throw new Error(`ashtakavarga: planet id=${id} missing from natal`);
  return signIdOf(p);
}

// Which of the 7 "own" grahas occupy each sign (0-indexed Aries=0).
function occupancyOf(arr: unknown[]): boolean[] {
  const occ = new Array(12).fill(false);
  for (const id of SEVEN_PLANETS) {
    const s = signOfId(arr, id);
    occ[s] = true;
  }
  return occ;
}

// ---------- Core bindu computation ----------

// Contributed[signIdx][contributorId] = 0|1, for a single target planet.
function computeContributions(arr: unknown[], targetId: number): Map<number, Record<number, 0 | 1>> {
  const contributed = new Map<number, Record<number, 0 | 1>>();
  for (let s = 0; s < 12; s++) {
    const row: Record<number, 0 | 1> = {};
    for (const c of CONTRIBUTOR_ORDER) row[c] = 0;
    contributed.set(s, row);
  }
  for (const contributor of CONTRIBUTOR_ORDER) {
    const contributorSign = signOfId(arr, contributor);
    const offsets = BENEFIC_TABLE[targetId][contributor] ?? [];
    for (const offset of offsets) {
      const signIdx = (contributorSign + offset - 1) % 12;
      contributed.get(signIdx)![contributor] = 1;
    }
  }
  return contributed;
}

function rawFromContributions(contributed: Map<number, Record<number, 0 | 1>>): number[] {
  const raw = new Array(12).fill(0);
  for (let s = 0; s < 12; s++) {
    const row = contributed.get(s)!;
    raw[s] = CONTRIBUTOR_ORDER.reduce((sum, c) => sum + row[c], 0);
  }
  return raw;
}

// ---------- Shodhana (reduction) ----------

function trikonaShodhana(raw: number[]): number[] {
  const out = raw.slice();
  for (let r = 0; r < 4; r++) {
    const i1 = r, i2 = r + 4, i3 = r + 8;
    const v1 = out[i1], v2 = out[i2], v3 = out[i3];
    if (v1 === 0 || v2 === 0 || v3 === 0) continue;
    if (v1 === v2 && v2 === v3) {
      out[i1] = 0;
      out[i2] = 0;
      out[i3] = 0;
    } else {
      const min = Math.min(v1, v2, v3);
      out[i1] -= min;
      out[i2] -= min;
      out[i3] -= min;
    }
  }
  return out;
}

function applyEkadhipatyaPair(
  values: number[],
  occupancy: boolean[],
  signs: [number, number],
): void {
  const [r1, r2] = signs;
  const v1 = values[r1], v2 = values[r2];
  const occ1 = occupancy[r1], occ2 = occupancy[r2];
  if (v1 === 0 || v2 === 0) return;
  if (occ1 && occ2) return;
  if (!occ1 && !occ2) {
    if (v1 === v2) {
      values[r1] = 0;
      values[r2] = 0;
    } else {
      const min = Math.min(v1, v2);
      values[r1] = min;
      values[r2] = min;
    }
    return;
  }
  // Exactly one occupied.
  if (occ1) {
    values[r2] = v2 < v1 ? 0 : v1;
  } else {
    values[r1] = v1 < v2 ? 0 : v2;
  }
}

// Ekadhipatya operates on the trikona-reduced row, applying ALL 5 same-lord
// sign pairs (Mars/Mercury/Jupiter/Venus/Saturn) regardless of which
// planet's own BAV row is being reduced — Sun and Moon rows are eligible
// too, since the pairs are unrelated to whose row they're applied to.
function ekadhipatyaShodhanaBhinna(trikonaReduced: number[], occupancy: boolean[], _targetId: number): number[] {
  const out = trikonaReduced.slice();
  for (const pair of EKADHIPATYA_PAIRS) applyEkadhipatyaPair(out, occupancy, pair.signs);
  return out;
}

// ---------- House/rasi metadata ----------

function rasiMeta(signIdx: number) {
  const lordId = RASI_LORD_ID[signIdx];
  return {
    id: signIdx,
    name: RASI_NAMES[signIdx],
    lord: { id: lordId, name: PLANET_NAME[lordId], vedic_name: PLANET_VEDIC_NAME[lordId] },
  };
}

function houseBase(houseNumber: number, ascSign: number) {
  const signIdx = (ascSign + houseNumber - 1) % 12;
  return {
    house: { id: houseNumber - 1, name: HOUSE_NAMES[houseNumber - 1], number: houseNumber },
    rasi: rasiMeta(signIdx),
    signIdx,
  };
}

function buildReducedGrid(values: number[], ascSign: number): AshtakavargaGridReduced {
  const houses: AshtakavargaHouseScoreOnly[] = [];
  let score = 0;
  for (let h = 1; h <= 12; h++) {
    const base = houseBase(h, ascSign);
    const s = values[base.signIdx];
    houses.push({ house: base.house, rasi: base.rasi, score: s });
    score += s;
  }
  return { score, houses };
}

// ---------- Public API ----------

export function computeAshtakavargaPayload(natalPayload: unknown, targetPlanetId: number): BhinnaPayload {
  if (!(targetPlanetId in BENEFIC_TABLE)) {
    throw new Error(`ashtakavarga: unsupported planet id ${targetPlanetId}`);
  }
  const arr = planetArr(natalPayload);
  const ascSign = signOfId(arr, ASC);
  const occupancy = occupancyOf(arr);

  const contributed = computeContributions(arr, targetPlanetId);
  const raw = rawFromContributions(contributed);
  const trikonaReduced = trikonaShodhana(raw);
  const ekadhipatyaReduced = ekadhipatyaShodhanaBhinna(trikonaReduced, occupancy, targetPlanetId);

  const prastaraHouses: AshtakavargaHouseFull[] = [];
  let prastaraScore = 0;
  for (let h = 1; h <= 12; h++) {
    const base = houseBase(h, ascSign);
    const row = contributed.get(base.signIdx)!;
    const planets = CONTRIBUTOR_ORDER.map((c) => ({
      score: row[c],
      planet: { id: c, name: PLANET_NAME[c], vedic_name: PLANET_VEDIC_NAME[c] },
    }));
    const s = raw[base.signIdx];
    prastaraHouses.push({ house: base.house, rasi: base.rasi, score: s, planets });
    prastaraScore += s;
  }

  return {
    status: "ok",
    data: {
      ashtakavarga: {
        trikona: buildReducedGrid(trikonaReduced, ascSign),
        prastara: { score: prastaraScore, houses: prastaraHouses },
        ekaadhipatya: buildReducedGrid(ekadhipatyaReduced, ascSign),
      },
    },
  };
}

export function computeSarvashtakavargaPayload(natalPayload: unknown): SarvaPayload {
  const arr = planetArr(natalPayload);
  const ascSign = signOfId(arr, ASC);
  const occupancy = occupancyOf(arr);

  // Raw per-planet bhinna scores at each sign (0-8), used both for the SAV
  // per-sign planet breakdown and to build the combined 337-total SAV row.
  const perPlanetRaw: Record<number, number[]> = {};
  for (const p of SEVEN_PLANETS) {
    perPlanetRaw[p] = rawFromContributions(computeContributions(arr, p));
  }
  const rawSav = new Array(12).fill(0);
  for (let s = 0; s < 12; s++) {
    rawSav[s] = SEVEN_PLANETS.reduce((sum, p) => sum + perPlanetRaw[p][s], 0);
  }

  // SAV's reduced grids are the SUM of each planet's own reduced BAV (proven
  // against real Prokerala captures: bhinna trikona/ekaadhipatya matched
  // 100%/near-100% per-planet, but reducing the raw SAV row directly did
  // not reproduce Prokerala's SAV grids at all).
  const trikonaReduced = new Array(12).fill(0);
  for (const p of SEVEN_PLANETS) {
    const pTrikona = trikonaShodhana(perPlanetRaw[p]);
    for (let s = 0; s < 12; s++) trikonaReduced[s] += pTrikona[s];
  }
  const ekadhipatyaReduced = rawSav.slice();
  for (const pair of EKADHIPATYA_PAIRS) applyEkadhipatyaPair(ekadhipatyaReduced, occupancy, pair.signs);

  const prastaraHouses: AshtakavargaHouseFull[] = [];
  let prastaraScore = 0;
  for (let h = 1; h <= 12; h++) {
    const base = houseBase(h, ascSign);
    const planets = SEVEN_PLANETS.map((p) => ({
      score: perPlanetRaw[p][base.signIdx],
      planet: { id: p, name: PLANET_NAME[p], vedic_name: PLANET_VEDIC_NAME[p] },
    }));
    const s = rawSav[base.signIdx];
    prastaraHouses.push({ house: base.house, rasi: base.rasi, score: s, planets });
    prastaraScore += s;
  }

  return {
    status: "ok",
    data: {
      sarvashtakavarga: {
        trikona: buildReducedGrid(trikonaReduced, ascSign),
        prastara: { score: prastaraScore, houses: prastaraHouses },
        ekaadhipatya: buildReducedGrid(ekadhipatyaReduced, ascSign),
      },
    },
  };
}
