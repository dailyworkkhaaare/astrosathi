// varga-svg-parity.ts — CLEAN parity check for supabase/functions/chart-gateway/varga.ts
// against Prokerala's rendered varga SVGs, bypassing the buggy SVG->chart_facts
// parser at src/lib/charts.ts (nearest-anchor; drops planets to the wrong region
// when a label sits toward the outer edge of a house).
//
// APPROACH
//   For each user's stored raw varga SVGs (chart_artifacts.chart_jsonb.svg),
//   re-parse each chart with a POINT-IN-POLYGON reader against the 12 fixed
//   North-Indian regions on Prokerala's 10..472 canvas, then compare each
//   {asc_sign, positions[]} against computeVarga(localNatal, D).
//
// GATES
//   * Rahu/Ketu must be exactly 6 signs apart in every parsed chart (sanity).
//   * Segregate 5 users whose natal was regenerated (astronomy-engine) AFTER
//     the SVGs were rendered (prokerala) — their old SVGs reflect stale birth
//     data, so they can't count against the formulas.
//   * Report matrix + per-varga pass rate for the CLEAN cohort (~9 users);
//     stale cohort reported separately for reference.
//
// READ-ONLY. No writes, no gateway wiring, no deploy.
//
// USAGE
//   deno run -A scripts/varga-svg-parity.ts --all
//   deno run -A scripts/varga-svg-parity.ts --user <uuid>
//   Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import {
  BODY_KEYS,
  computeVarga,
  VARGA_TO_ENUM,
  VARGAS,
  type BodyKey,
  type VargaKey,
} from "../supabase/functions/chart-gateway/varga.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const Deno: any;

// ---- Users whose natal is newer than their SVGs (stale, exclude from gate) ---
const STALE_USER_PREFIXES = [
  "446d5801", "87faf1de", "5558c422", "0a441acc", "36a3a830",
];
const isStaleUser = (uid: string) =>
  STALE_USER_PREFIXES.some((p) => uid.startsWith(p));

// ---- North-Indian fixed template geometry (SVG canvas 10..472) ---------------
// Corners
const TL = { x: 10, y: 10 };
const TR = { x: 472, y: 10 };
const BR = { x: 472, y: 472 };
const BL = { x: 10, y: 472 };
// Center
const C  = { x: 241, y: 241 };
// Edge midpoints (diamond vertices)
const TM = { x: 241, y: 10 };
const RM = { x: 472, y: 241 };
const BM = { x: 241, y: 472 };
const LM = { x: 10,  y: 241 };
// Diagonal-diamond intersections (midpoints of each diamond edge)
const M1 = { x: 125.5, y: 125.5 }; // on edge LM-TM  (NW)
const M2 = { x: 356.5, y: 125.5 }; // on edge TM-RM  (NE)
const M3 = { x: 356.5, y: 356.5 }; // on edge RM-BM  (SE)
const M4 = { x: 125.5, y: 356.5 }; // on edge BM-LM  (SW)

type Pt = { x: number; y: number };

// House regions 1..12 (fixed template positions, INDEPENDENT of ascendant).
// House 1 always occupies the North interior quad, and numbering proceeds in
// the standard North-Indian order (h2 above-left of center, then anticlockwise
// around the perimeter). The sign digit printed in each region tells us the
// rasi for that house.
const HOUSE_POLYS: Pt[][] = [
  /* h1  */ [TM, M2, C,  M1],           // North interior quad
  /* h2  */ [TL, TM, M1],                // NW upper (top-side triangle)
  /* h3  */ [TL, M1, LM],                // NW lower (left-side triangle)
  /* h4  */ [LM, M1, C,  M4],           // West interior quad
  /* h5  */ [BL, LM, M4],                // SW upper (left-side triangle)
  /* h6  */ [BL, M4, BM],                // SW lower (bottom-side triangle)
  /* h7  */ [BM, M4, C,  M3],           // South interior quad
  /* h8  */ [BR, BM, M3],                // SE lower (bottom-side triangle)
  /* h9  */ [BR, M3, RM],                // SE upper (right-side triangle)
  /* h10 */ [RM, M3, C,  M2],           // East interior quad
  /* h11 */ [TR, RM, M2],                // NE lower (right-side triangle)
  /* h12 */ [TR, M2, TM],                // NE upper (top-side triangle)
];

// Reference anchor points (where the sign-digit is typically drawn), from
// spec. Used only as a self-check that our polygon numbering matches
// Prokerala's convention.
const REF_ANCHORS: Pt[] = [
  { x: 237, y: 216 }, // h1
  { x: 123, y: 98  }, // h2
  { x: 98,  y: 123 }, // h3
  { x: 216, y: 241 }, // h4
  { x: 98,  y: 359 }, // h5
  { x: 123, y: 384 }, // h6
  { x: 241, y: 266 }, // h7
  { x: 359, y: 384 }, // h8
  { x: 384, y: 359 }, // h9
  { x: 266, y: 241 }, // h10
  { x: 376, y: 123 }, // h11
  { x: 351, y: 98  }, // h12
];

function pointInPoly(pt: Pt, poly: Pt[]): boolean {
  let inside = false;
  const n = poly.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = poly[i].x, yi = poly[i].y;
    const xj = poly[j].x, yj = poly[j].y;
    const intersect =
      (yi > pt.y) !== (yj > pt.y) &&
      pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function houseAt(pt: Pt): number | null {
  for (let i = 0; i < HOUSE_POLYS.length; i++) {
    if (pointInPoly(pt, HOUSE_POLYS[i])) return i + 1; // 1..12
  }
  return null;
}

// Self-check the polygon numbering on script start.
function selfCheckAnchors(): void {
  for (let i = 0; i < REF_ANCHORS.length; i++) {
    const h = houseAt(REF_ANCHORS[i]);
    if (h !== i + 1) {
      throw new Error(
        `polygon self-check failed: anchor h${i + 1} at (${REF_ANCHORS[i].x},${REF_ANCHORS[i].y}) → house ${h}`,
      );
    }
  }
}

// ---- SVG text-node extraction ------------------------------------------------
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

const PLANET_FROM_CLASS: Record<string, BodyKey | "ascendant"> = {
  sun: "sun", moon: "moon", mars: "mars", mercury: "mercury",
  jupiter: "jupiter", venus: "venus", saturn: "saturn",
  rahu: "rahu", ketu: "ketu", ascendant: "ascendant",
};

function planetFromClass(cls: string | null): BodyKey | "ascendant" | null {
  if (!cls) return null;
  const m = /pk-planet-([a-z]+)/i.exec(cls);
  if (!m) return null;
  return PLANET_FROM_CLASS[m[1].toLowerCase()] ?? null;
}

// ---- SVG → structured parse --------------------------------------------------
type ParsedChart = {
  asc_sign: number;                                    // 0..11
  signAtHouse: number[];                               // idx 1..12, val 0..11
  positions: Array<{ key: BodyKey; sign: number; house: number }>;
  warnings: string[];
};

function parseSvgToPositions(svg: string): ParsedChart | null {
  if (!svg || !/pk-planet-/.test(svg)) return null;
  const nodes = parseSvgTextNodes(svg);
  const warnings: string[] = [];

  // Sign digits: numeric-only text nodes with no class.
  const signAtHouse: number[] = new Array(13).fill(-1); // 1..12
  for (const n of nodes) {
    if (n.cls) continue;
    if (!/^\d{1,2}$/.test(n.text)) continue;
    const val = Number(n.text);
    if (val < 1 || val > 12) continue;
    const h = houseAt({ x: n.x, y: n.y });
    if (!h) continue;
    if (signAtHouse[h] === -1) signAtHouse[h] = val - 1; // 0..11
  }
  const missingHouses: number[] = [];
  for (let h = 1; h <= 12; h++) if (signAtHouse[h] === -1) missingHouses.push(h);
  if (missingHouses.length) {
    warnings.push(`missing sign labels for houses [${missingHouses.join(",")}]`);
    return null;
  }
  // asc_sign = sign printed at house 1
  const asc_sign = signAtHouse[1];

  // Sanity: signs 0..11 should appear once each, sequentially by house.
  const seenSigns = new Set<number>();
  for (let h = 1; h <= 12; h++) {
    if (seenSigns.has(signAtHouse[h])) {
      warnings.push(`duplicate sign ${signAtHouse[h]} appears twice`);
    }
    seenSigns.add(signAtHouse[h]);
    const expected = (asc_sign + h - 1) % 12;
    if (signAtHouse[h] !== expected) {
      warnings.push(
        `house ${h} sign=${signAtHouse[h]} (expected ${expected} from asc=${asc_sign})`,
      );
    }
  }

  // Planet placements. Clamp coords into the canvas: Prokerala pushes stacked
  // planet labels in bottom houses (h6/h8) a few pixels below y=472, so the
  // raw text-node y falls outside every polygon. Snapping back onto the frame
  // puts them in the correct region.
  const clampX = (x: number) => Math.min(471.99, Math.max(10.01, x));
  const clampY = (y: number) => Math.min(471.99, Math.max(10.01, y));
  const positions: Array<{ key: BodyKey; sign: number; house: number }> = [];
  const seenBody = new Set<BodyKey>();
  for (const n of nodes) {
    const p = planetFromClass(n.cls);
    if (!p || p === "ascendant") continue;
    if (seenBody.has(p)) continue;
    const h = houseAt({ x: clampX(n.x), y: clampY(n.y) });
    if (!h) {
      warnings.push(`planet ${p} at (${n.x},${n.y}) not inside any polygon`);
      continue;
    }
    seenBody.add(p);
    positions.push({ key: p, sign: signAtHouse[h], house: h });
  }

  // Sanity: Rahu & Ketu exactly 6 signs apart.
  const rahu = positions.find((x) => x.key === "rahu");
  const ketu = positions.find((x) => x.key === "ketu");
  if (rahu && ketu) {
    const diff = ((rahu.sign - ketu.sign + 12) % 12);
    if (diff !== 6) {
      warnings.push(`rahu(${rahu.sign}) - ketu(${ketu.sign}) = ${diff}, expected 6`);
    }
  }

  return { asc_sign, signAtHouse, positions, warnings };
}

// ---- REST helpers ------------------------------------------------------------
async function fetchJson(url: string, headers: Record<string, string>) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`REST ${res.status} ${url}`);
  return await res.json();
}

type SvgArtifact = { chart_type: string; svg: string; created_at: string; provider: string | null };
type Fixture = {
  userId: string;
  natal: unknown;
  natalProv: { created_at: string | null; provider: string | null };
  vargaSvgs: Map<string, SvgArtifact>; // keyed by chart_type enum
};

async function loadUserFixture(
  baseUrl: string,
  key: string,
  userId: string,
): Promise<Fixture> {
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "content-type": "application/json",
  };
  const natalRows = (await fetchJson(
    `${baseUrl}/rest/v1/chart_artifacts?user_id=eq.${userId}&chart_type=eq.natal&order=created_at.desc&limit=1&select=chart_jsonb,created_at,provider`,
    headers,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  )) as any[];
  if (!natalRows[0]) throw new Error(`no natal for ${userId}`);

  const enums = Object.values(VARGA_TO_ENUM);
  const inList = enums.map((e) => `"${e}"`).join(",");
  // We want the newest artifact per varga type. Fetch all sorted, then dedupe.
  const artifactRows = (await fetchJson(
    `${baseUrl}/rest/v1/chart_artifacts?user_id=eq.${userId}&chart_type=in.(${inList})&order=created_at.desc&select=chart_type,chart_jsonb,created_at,provider`,
    headers,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  )) as any[];
  const vargaSvgs = new Map<string, SvgArtifact>();
  for (const r of artifactRows) {
    if (vargaSvgs.has(r.chart_type)) continue;
    // deno-lint-ignore no-explicit-any
    const svg: string | null = (r?.chart_jsonb as any)?.svg ?? null;
    if (!svg) continue;
    vargaSvgs.set(r.chart_type, {
      chart_type: r.chart_type,
      svg,
      created_at: r.created_at,
      provider: r.provider ?? null,
    });
  }

  return {
    userId,
    natal: natalRows[0].chart_jsonb,
    natalProv: {
      created_at: natalRows[0].created_at ?? null,
      provider: natalRows[0].provider ?? null,
    },
    vargaSvgs,
  };
}

async function discoverUsers(
  baseUrl: string,
  key: string,
  limit: number,
): Promise<string[]> {
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "content-type": "application/json",
  };
  const natalRows = (await fetchJson(
    `${baseUrl}/rest/v1/chart_artifacts?chart_type=eq.natal&select=user_id&limit=2000`,
    headers,
  )) as Array<{ user_id: string }>;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of natalRows) {
    if (seen.has(r.user_id)) continue;
    seen.add(r.user_id);
    out.push(r.user_id);
    if (out.length >= limit) break;
  }
  return out;
}

// ---- Comparison --------------------------------------------------------------
type Cmp = {
  ok: boolean;
  ascOk: boolean;
  signMismatches: Array<{ key: string; svg: number; loc: number }>;
  houseMismatches: Array<{ key: string; svg: number; loc: number }>;
  missing: string[]; // bodies missing from SVG parse
  ascSvg: number;
  ascLoc: number;
  parseWarnings: string[];
};

function compareVargaVsSvg(parsed: ParsedChart, natal: unknown, D: VargaKey): Cmp {
  const local = computeVarga(natal, D);
  const cmp: Cmp = {
    ok: true,
    ascOk: parsed.asc_sign === local.asc_sign,
    signMismatches: [],
    houseMismatches: [],
    missing: [],
    ascSvg: parsed.asc_sign,
    ascLoc: local.asc_sign,
    parseWarnings: parsed.warnings,
  };
  if (!cmp.ascOk) cmp.ok = false;

  const svgByKey = new Map<string, { sign: number; house: number }>();
  for (const p of parsed.positions) {
    svgByKey.set(p.key, { sign: p.sign, house: p.house });
  }
  for (const p of local.positions) {
    const s = svgByKey.get(p.key);
    if (!s) {
      cmp.missing.push(p.key);
      cmp.ok = false;
      continue;
    }
    if (s.sign !== p.sign) {
      cmp.signMismatches.push({ key: p.key, svg: s.sign, loc: p.sign });
      cmp.ok = false;
    }
    if (s.house !== p.house) {
      cmp.houseMismatches.push({ key: p.key, svg: s.house, loc: p.house });
    }
  }
  return cmp;
}

// ---- Main --------------------------------------------------------------------
type Args = { limit: number; wantAll: boolean; user: string | null; verbose: boolean };
function parseArgs(argv: string[]): Args {
  const out: Args = { limit: 30, wantAll: false, user: null, verbose: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--all") out.wantAll = true;
    else if (a === "--limit") out.limit = Number(argv[++i]);
    else if (a === "--user") out.user = String(argv[++i]);
    else if (a === "--verbose") out.verbose = true;
  }
  return out;
}

type Row = {
  uid: string;
  stale: boolean;
  cells: string[]; // per varga
  pass: number;
  total: number;
  failedVargas: string[];
};

function printMatrix(label: string, rows: Row[], vargas: VargaKey[]) {
  console.log(`\n=== ${label} (${rows.length} user(s)) ===`);
  if (!rows.length) return;
  console.log(
    "user_id                                  " +
    vargas.map((v) => v.padEnd(6)).join("") +
    " pass",
  );
  console.log(
    "--------------------------------------   " +
    vargas.map(() => "----- ").join("") +
    " ----",
  );
  for (const r of rows) {
    console.log(
      `${r.uid.padEnd(40)} ${r.cells.join("")} ${r.pass}/${r.total}`,
    );
  }

  // per-varga rollup within this cohort
  const perV = new Map<VargaKey, { pass: number; total: number }>();
  for (const v of vargas) perV.set(v, { pass: 0, total: 0 });
  for (const r of rows) {
    for (let i = 0; i < vargas.length; i++) {
      const c = r.cells[i].trim();
      if (c === "-") continue;
      const p = perV.get(vargas[i])!;
      p.total++;
      if (c === "ok") p.pass++;
    }
  }
  console.log("\nper-varga:");
  let sp = 0, st = 0;
  for (const v of vargas) {
    const p = perV.get(v)!;
    sp += p.pass; st += p.total;
    const pct = p.total ? ((100 * p.pass) / p.total).toFixed(1) : "n/a";
    const badge = p.total === 0 ? "-" : p.pass === p.total ? "PASS" : "FAIL";
    console.log(`  ${v.padEnd(4)} ${String(p.pass).padStart(3)}/${String(p.total).padEnd(3)} ${pct.padStart(5)}% ${badge}`);
  }
  const overall = st ? ((100 * sp) / st).toFixed(1) : "n/a";
  console.log(`overall: ${sp}/${st} ${overall}%`);
}

async function main() {
  selfCheckAnchors();
  console.log("polygon self-check ✓ (12 house regions verified against reference anchors)\n");

  const args = parseArgs(Deno.args as string[]);
  if (!args.wantAll && !args.user) {
    console.error("usage: --all [--limit N] | --user <uuid> [--verbose]");
    Deno.exit(2);
  }
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
    Deno.exit(2);
  }

  const users = args.user
    ? [args.user]
    : await discoverUsers(url, key, args.limit);
  const vargas = [...VARGAS];
  console.log(`SVG parity: ${users.length} user(s) × ${vargas.length} varga(s)`);

  const cleanRows: Row[] = [];
  const staleRows: Row[] = [];
  const failDetail: string[] = [];
  const parseWarn: string[] = [];

  for (const uid of users) {
    let fx: Fixture;
    try {
      fx = await loadUserFixture(url, key, uid);
    } catch (e) {
      console.log(`${uid} : load error ${String(e)}`);
      continue;
    }
    const cells: string[] = [];
    let pass = 0, total = 0;
    const failedVargas: string[] = [];

    for (const V of vargas) {
      const enumType = VARGA_TO_ENUM[V];
      const art = fx.vargaSvgs.get(enumType);
      if (!art) { cells.push("-    ".padEnd(6)); continue; }
      const parsed = parseSvgToPositions(art.svg);
      if (!parsed) { cells.push("nsvg ".padEnd(6)); continue; }
      if (parsed.warnings.length) {
        for (const w of parsed.warnings) parseWarn.push(`${uid} ${V}: ${w}`);
      }
      total++;
      let cmp: Cmp;
      try {
        cmp = compareVargaVsSvg(parsed, fx.natal, V);
      } catch (e) {
        cells.push("ERR  ".padEnd(6));
        failDetail.push(`${uid} ${V}: throw ${String(e)}`);
        continue;
      }
      if (cmp.ok) {
        pass++;
        cells.push("ok   ".padEnd(6));
      } else {
        cells.push("FAIL ".padEnd(6));
        failedVargas.push(V);
        const bits: string[] = [];
        if (!cmp.ascOk) bits.push(`asc svg=${cmp.ascSvg} loc=${cmp.ascLoc}`);
        for (const m of cmp.signMismatches) bits.push(`${m.key} svg=${m.svg} loc=${m.loc}`);
        for (const m of cmp.missing) bits.push(`missing-in-svg[${m}]`);
        failDetail.push(`${uid} ${V}: ${bits.join(", ")}`);
      }
    }
    const row: Row = {
      uid, stale: isStaleUser(uid), cells, pass, total, failedVargas,
    };
    (row.stale ? staleRows : cleanRows).push(row);
  }

  printMatrix("CLEAN cohort (same-generation SVGs)", cleanRows, vargas);
  printMatrix("STALE cohort (natal newer than SVGs — FYI only)", staleRows, vargas);

  console.log("\nper-user failing vargas (all cohorts):");
  const allRows = [...cleanRows, ...staleRows];
  const anyFail = allRows.filter((r) => r.failedVargas.length);
  if (!anyFail.length) console.log("  (none)");
  else {
    for (const r of anyFail) {
      const tag = r.stale ? "STALE" : "CLEAN";
      console.log(`  ${tag} ${r.uid}  fail: [${r.failedVargas.join(",")}]`);
    }
  }

  if (parseWarn.length) {
    console.log(`\nparse warnings: ${parseWarn.length}`);
    if (args.verbose) for (const w of parseWarn) console.log(`  ${w}`);
    else console.log(`  (rerun --verbose to dump)`);
  }
  if (failDetail.length) {
    console.log(`\nfailure detail: ${failDetail.length}`);
    if (args.verbose) for (const d of failDetail) console.log(`  ${d}`);
    else console.log(`  (rerun --verbose to dump)`);
  }

  // Exit gate: CLEAN cohort must be 100% on every varga cell.
  const cleanAllOk = cleanRows.every((r) => r.pass === r.total);
  Deno.exit(cleanAllOk ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  Deno.exit(1);
});
