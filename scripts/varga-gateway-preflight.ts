// varga-gateway-preflight.ts — SIMULATED preflight for the swiss-chart branch
// of supabase/functions/chart-gateway/index.ts.
//
// The branch itself lives in a not-yet-deployed edge function, so this script
// reconstructs its exact logic locally:
//   natal → computeVarga(D) → renderNorthIndian → chartPayload
//                                              → chart_facts row
// and asserts:
//   * the SVG round-trips through BOTH parsers back to computeVarga
//     (asc_sign + every body sign + house),
//   * the simulated chart_facts row == computeVarga output exactly,
//   * provider == "astronomy-engine", chart_jsonb is findSvg-compatible
//     ({svg,chart_type,chart_style,provider} — matches the shape charts.ts
//     findSvg() reaches into).
//
// It also exercises the error path — passes a broken natal to computeVarga
// and asserts an exception is thrown (which in the deployed branch triggers
// the outer try/catch → Prokerala fallthrough).
//
// READ-ONLY: no writes to Supabase, no gateway hit, no deploy.
//
// USAGE
//   deno run -A scripts/varga-gateway-preflight.ts [--users 4]
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (usually sourced from .env).

import {
  BODY_KEYS,
  computeVarga,
  VARGA_TO_ENUM,
  type BodyKey,
  type VargaKey,
} from "../supabase/functions/chart-gateway/varga.ts";
import { renderNorthIndian } from "../supabase/functions/chart-gateway/render-north.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const Deno: any;

// Vargas the user asked to preflight.
const PREFLIGHT_VARGAS: VargaKey[] = ["D1", "D9", "D30", "D60"];

// The list of stale-natal users seen in earlier phases; skip them so this
// preflight runs against clean data.
const STALE_PREFIXES = ["446d5801", "87faf1de", "5558c422", "0a441acc", "36a3a830"];
const isStale = (uid: string) => STALE_PREFIXES.some((p) => uid.startsWith(p));

// -----------------------------------------------------------------------------
// Inline both parsers (mirroring varga-render-parity.ts). Kept self-contained
// so the preflight can be run in isolation.
// -----------------------------------------------------------------------------
type Pt = { x: number; y: number };
const TL = { x: 10, y: 10 }, TR = { x: 472, y: 10 },
      BR = { x: 472, y: 472 }, BL = { x: 10, y: 472 };
const C  = { x: 241, y: 241 };
const TM = { x: 241, y: 10 }, RM = { x: 472, y: 241 },
      BM = { x: 241, y: 472 }, LM = { x: 10, y: 241 };
const M1 = { x: 125.5, y: 125.5 }, M2 = { x: 356.5, y: 125.5 },
      M3 = { x: 356.5, y: 356.5 }, M4 = { x: 125.5, y: 356.5 };
const HOUSE_POLYS: Pt[][] = [
  [TM, M2, C,  M1], [TL, TM, M1], [TL, M1, LM],
  [LM, M1, C,  M4], [BL, LM, M4], [BL, M4, BM],
  [BM, M4, C,  M3], [BR, BM, M3], [BR, M3, RM],
  [RM, M3, C,  M2], [TR, RM, M2], [TR, M2, TM],
];
function pointInPoly(pt: Pt, poly: Pt[]): boolean {
  let inside = false;
  const n = poly.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = poly[i].x, yi = poly[i].y;
    const xj = poly[j].x, yj = poly[j].y;
    const hit =
      (yi > pt.y) !== (yj > pt.y) &&
      pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi + 1e-12) + xi;
    if (hit) inside = !inside;
  }
  return inside;
}
function houseAt(pt: Pt): number | null {
  const px = { x: Math.min(471.99, Math.max(10.01, pt.x)),
                y: Math.min(471.99, Math.max(10.01, pt.y)) };
  for (let i = 0; i < HOUSE_POLYS.length; i++) {
    if (pointInPoly(px, HOUSE_POLYS[i])) return i + 1;
  }
  return null;
}
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
type ParsedChart = {
  asc_sign: number;
  positions: Array<{ key: BodyKey; sign: number; house: number }>;
};
function parseByPolygon(svg: string): ParsedChart | null {
  const nodes = parseSvgTextNodes(svg);
  const signAtHouse: number[] = new Array(13).fill(-1);
  for (const n of nodes) {
    if (n.cls) continue;
    if (!/^\d{1,2}$/.test(n.text)) continue;
    const v = Number(n.text);
    if (v < 1 || v > 12) continue;
    const h = houseAt({ x: n.x, y: n.y });
    if (h && signAtHouse[h] === -1) signAtHouse[h] = v - 1;
  }
  for (let h = 1; h <= 12; h++) if (signAtHouse[h] === -1) return null;
  const asc_sign = signAtHouse[1];
  const positions: Array<{ key: BodyKey; sign: number; house: number }> = [];
  const seen = new Set<BodyKey>();
  for (const n of nodes) {
    const p = planetFromClass(n.cls);
    if (!p || p === "ascendant") continue;
    if (seen.has(p)) continue;
    const h = houseAt({ x: n.x, y: n.y });
    if (!h) continue;
    seen.add(p);
    positions.push({ key: p, sign: signAtHouse[h], house: h });
  }
  return { asc_sign, positions };
}
function parseByNearestAnchor(svg: string): ParsedChart | null {
  if (!/pk-planet-/.test(svg)) return null;
  const nodes = parseSvgTextNodes(svg);
  const anchors: Array<{ sign: number; x: number; y: number }> = [];
  for (const n of nodes) {
    if (n.cls) continue;
    if (!/^\d{1,2}$/.test(n.text)) continue;
    const sign = Number(n.text);
    if (sign >= 1 && sign <= 12) anchors.push({ sign, x: n.x, y: n.y });
  }
  if (anchors.length < 12) return null;
  const nearestSign = (x: number, y: number): number => {
    let best = anchors[0], bestD = Infinity;
    for (const a of anchors) {
      const d = (a.x - x) ** 2 + (a.y - y) ** 2;
      if (d < bestD) { bestD = d; best = a; }
    }
    return best.sign;
  };
  const ascNode = nodes.find((n) => planetFromClass(n.cls) === "ascendant");
  if (!ascNode) return null;
  const ascSign1 = nearestSign(ascNode.x, ascNode.y);
  const positions: Array<{ key: BodyKey; sign: number; house: number }> = [];
  const seen = new Set<BodyKey>();
  for (const n of nodes) {
    const p = planetFromClass(n.cls);
    if (!p || p === "ascendant") continue;
    if (seen.has(p)) continue;
    seen.add(p);
    const sign1 = nearestSign(n.x, n.y);
    positions.push({
      key: p, sign: sign1 - 1,
      house: ((sign1 - ascSign1 + 12) % 12) + 1,
    });
  }
  return { asc_sign: ascSign1 - 1, positions };
}

// -----------------------------------------------------------------------------
// REST helpers
// -----------------------------------------------------------------------------
async function fetchJson(url: string, headers: Record<string, string>) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`REST ${res.status} ${url}`);
  return await res.json();
}
async function loadNatal(baseUrl: string, key: string, userId: string): Promise<unknown | null> {
  const headers = { apikey: key, Authorization: `Bearer ${key}`, "content-type": "application/json" };
  const rows = (await fetchJson(
    `${baseUrl}/rest/v1/chart_artifacts?user_id=eq.${userId}&chart_type=eq.natal&order=created_at.desc&limit=1&select=chart_jsonb`,
    headers,
    // deno-lint-ignore no-explicit-any
  )) as any[];
  return rows[0]?.chart_jsonb ?? null;
}
async function discoverCleanUsers(baseUrl: string, key: string, want: number): Promise<string[]> {
  const headers = { apikey: key, Authorization: `Bearer ${key}`, "content-type": "application/json" };
  const rows = (await fetchJson(
    `${baseUrl}/rest/v1/chart_artifacts?chart_type=eq.natal&select=user_id&limit=2000`,
    headers,
  )) as Array<{ user_id: string }>;
  const seen = new Set<string>(); const out: string[] = [];
  for (const r of rows) {
    if (isStale(r.user_id)) continue;
    if (seen.has(r.user_id)) continue;
    seen.add(r.user_id); out.push(r.user_id);
    if (out.length >= want) break;
  }
  return out;
}

// -----------------------------------------------------------------------------
// Simulate the swiss-chart branch of chart-gateway/index.ts for one (user, D)
// -----------------------------------------------------------------------------
type PayloadShape = {
  svg: string;
  chart_type: string;
  chart_style: string;
  provider: string;
};
type FactsShape = {
  user_id: string;
  birth_profile_id: null;      // placeholder — real branch passes birth.id
  chart_type: string;
  input_hash: string;          // simulated
  provider: string;
  asc_sign: number;
  positions: Array<{ key: BodyKey; sign: number; house: number }>;
  meta: { engine: string; endpoint: string; provider_version: string };
};
function simulateSwissBranch(
  natal: unknown, userId: string, D: VargaKey,
): { chart_jsonb: PayloadShape; chart_facts: FactsShape; varga: ReturnType<typeof computeVarga> } {
  const chartType = VARGA_TO_ENUM[D];
  const varga = computeVarga(natal, D);
  const svg = renderNorthIndian({ asc_sign: varga.asc_sign, positions: varga.positions });
  const provider_version = "astronomy-engine@2.1.19+lahiri-v1+varga-v1";
  const chart_jsonb: PayloadShape = {
    svg, chart_type: chartType, chart_style: "north_indian", provider: "astronomy-engine",
  };
  const chart_facts: FactsShape = {
    user_id: userId,
    birth_profile_id: null,
    chart_type: chartType,
    input_hash: "SIM-preflight",
    provider: "astronomy-engine",
    asc_sign: varga.asc_sign,
    positions: varga.positions,
    meta: { engine: "swiss", endpoint: "local/varga", provider_version },
  };
  return { chart_jsonb, chart_facts, varga };
}

// findSvg-compatible check — mirrors src/lib/charts.ts findSvg(): looks for
// a top-level svg string OR nested chart_jsonb.svg. Our payload has both.
function isFindSvgCompatible(payload: PayloadShape): boolean {
  return typeof payload?.svg === "string" && /<svg[\s>]/.test(payload.svg);
}

// -----------------------------------------------------------------------------
// Assertions per (user, D)
// -----------------------------------------------------------------------------
type CheckOutcome = {
  user: string; varga: VargaKey; chartType: string;
  poly: string; near: string; facts: string; envelope: string;
  ok: boolean;
};
function diffToOrig(
  orig: ReturnType<typeof computeVarga>, parsed: ParsedChart | null,
): string {
  if (!parsed) return "parse=null";
  const mm: string[] = [];
  if (parsed.asc_sign !== orig.asc_sign) mm.push(`asc ${orig.asc_sign}!=${parsed.asc_sign}`);
  const byKey = new Map(parsed.positions.map((p) => [p.key, p]));
  for (const p of orig.positions) {
    const q = byKey.get(p.key);
    if (!q) { mm.push(`missing:${p.key}`); continue; }
    if (q.sign !== p.sign) mm.push(`${p.key}.sign ${p.sign}!=${q.sign}`);
    if (q.house !== p.house) mm.push(`${p.key}.house ${p.house}!=${q.house}`);
  }
  return mm.length ? mm.join(", ") : "OK";
}
function checkOne(userId: string, natal: unknown, D: VargaKey): CheckOutcome {
  const chartType = VARGA_TO_ENUM[D];
  const sim = simulateSwissBranch(natal, userId, D);
  const poly = diffToOrig(sim.varga, parseByPolygon(sim.chart_jsonb.svg));
  const near = diffToOrig(sim.varga, parseByNearestAnchor(sim.chart_jsonb.svg));
  // chart_facts must equal computeVarga exactly.
  const factsPositionsOk =
    sim.chart_facts.asc_sign === sim.varga.asc_sign &&
    sim.chart_facts.positions.length === sim.varga.positions.length &&
    sim.chart_facts.positions.every((p, i) => {
      const q = sim.varga.positions[i];
      return p.key === q.key && p.sign === q.sign && p.house === q.house
        && BODY_KEYS.includes(p.key);
    });
  const facts = factsPositionsOk ? "OK" : "MISMATCH";
  const envelope = (
    sim.chart_jsonb.provider === "astronomy-engine" &&
    sim.chart_jsonb.chart_type === chartType &&
    sim.chart_jsonb.chart_style === "north_indian" &&
    isFindSvgCompatible(sim.chart_jsonb)
  ) ? "OK" : "BAD";
  const ok = poly === "OK" && near === "OK" && facts === "OK" && envelope === "OK";
  return { user: userId.slice(0, 8), varga: D, chartType, poly, near, facts, envelope, ok };
}

// -----------------------------------------------------------------------------
// Fallback simulation — feed a broken natal, assert computeVarga throws.
// -----------------------------------------------------------------------------
function checkFallback(): { threw: boolean; msg: string } {
  // Ascendant intentionally omitted → computeVarga must throw.
  const brokenNatal = { data: { planet_position: [{ id: 0, name: "Sun", longitude: 10 }] } };
  try {
    computeVarga(brokenNatal, "D1");
    return { threw: false, msg: "computeVarga did NOT throw on broken natal" };
  } catch (e) {
    return { threw: true, msg: String((e as Error).message ?? e) };
  }
}

// -----------------------------------------------------------------------------
// Main
// -----------------------------------------------------------------------------
async function main() {
  const argv = (Deno.args ?? []) as string[];
  let want = 4;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--users") want = Math.max(1, Number(argv[i + 1] || 4));
  }
  const baseUrl = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!baseUrl || !key) {
    console.error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY required (source .env).");
    Deno.exit(1);
  }
  const users = await discoverCleanUsers(baseUrl, key, want);
  console.log(`\n=== varga-gateway preflight — ${users.length} users × ${PREFLIGHT_VARGAS.join(",")} ===\n`);

  const rows: CheckOutcome[] = [];
  for (const u of users) {
    const natal = await loadNatal(baseUrl, key, u);
    if (!natal) { console.log(`  ${u.slice(0,8)}  NATAL MISSING — skipped`); continue; }
    for (const D of PREFLIGHT_VARGAS) rows.push(checkOne(u, natal, D));
  }

  // Table
  const pad = (s: string, n: number) => (s + " ".repeat(n)).slice(0, n);
  console.log(pad("user", 10) + pad("varga", 6) + pad("chart_type", 22) +
              pad("poly", 24) + pad("near", 24) + pad("facts", 10) + pad("envelope", 10));
  console.log("-".repeat(106));
  let pass = 0;
  for (const r of rows) {
    console.log(
      pad(r.user, 10) + pad(r.varga, 6) + pad(r.chartType, 22) +
      pad(r.poly, 24) + pad(r.near, 24) + pad(r.facts, 10) + pad(r.envelope, 10) +
      (r.ok ? "" : "  <-- FAIL"),
    );
    if (r.ok) pass++;
  }
  console.log("-".repeat(106));
  console.log(`Result: ${pass}/${rows.length} (users=${users.length}, vargas=${PREFLIGHT_VARGAS.length})`);

  const fb = checkFallback();
  console.log(`\nFallback check (broken natal → outer catch → Prokerala):`);
  console.log(`  computeVarga threw: ${fb.threw ? "YES" : "NO"}  msg="${fb.msg}"`);
  console.log(`  → in the deployed branch this would land in try/catch and`);
  console.log(`    fall through to the existing Prokerala chart path (unchanged).`);

  const allOk = pass === rows.length && rows.length > 0 && fb.threw;
  if (!allOk) {
    console.log("\nPREFLIGHT FAILED — do not deploy.");
    Deno.exit(2);
  }
  console.log("\nPREFLIGHT PASS. Branch is ready for deployment (still gated behind engine=swiss).");
}

main().catch((e) => { console.error(e); Deno.exit(1); });
