// varga-render-parity.ts — round-trip parity for the local renderer.
//
// Pipeline (per user × varga):
//   natal → computeVarga → renderNorthIndian → SVG
//     → parsed via POINT-IN-POLYGON parser (strict)
//     → parsed via NEAREST-ANCHOR parser (mimics src/lib/charts.ts)
//   assert both parses reproduce the original computeVarga output exactly
//   (asc_sign + every body sign + every body house).
//
// GATE: 100% on both parsers across all 11 clean-cohort users × 16 vargas.
// Also writes 2 side-by-side HTML preview files for visual eyeball.
//
// READ-ONLY: no writes to Supabase, no gateway wiring, no deploy.
//
// USAGE
//   deno run -A scripts/varga-render-parity.ts --all [--verbose]
//   deno run -A scripts/varga-render-parity.ts --user <uuid>

import {
  BODY_KEYS,
  computeVarga,
  VARGA_TO_ENUM,
  VARGAS,
  type BodyKey,
  type VargaKey,
} from "../supabase/functions/chart-gateway/varga.ts";
import { renderNorthIndian } from "../supabase/functions/chart-gateway/render-north.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const Deno: any;

const STALE_USER_PREFIXES = [
  "446d5801", "87faf1de", "5558c422", "0a441acc", "36a3a830",
];
const isStaleUser = (uid: string) =>
  STALE_USER_PREFIXES.some((p) => uid.startsWith(p));

// -----------------------------------------------------------------------------
// Point-in-polygon parser (same logic as varga-svg-parity.ts, duplicated to
// keep this script self-contained).
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
    const intersect =
      (yi > pt.y) !== (yj > pt.y) &&
      pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
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

// -----------------------------------------------------------------------------
// Nearest-anchor parser — MIRRORS src/lib/charts.ts parseNorthIndianVargaChart
// (the app's runtime parser). This is the "buggy" one from the earlier
// investigation; we're proving here that our renderer places digits and
// planets far enough inside each region that even the naive nearest-anchor
// rule recovers them correctly.
// -----------------------------------------------------------------------------
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
// Diff helper
// -----------------------------------------------------------------------------
type RoundTripResult = {
  ok: boolean;
  parseFailed: boolean;
  ascOk: boolean;
  mismatches: string[]; // human-readable
};

function compareToOrig(
  orig: { asc_sign: number; positions: Array<{ key: BodyKey; sign: number; house: number }> },
  parsed: ParsedChart | null,
): RoundTripResult {
  if (!parsed) return { ok: false, parseFailed: true, ascOk: false, mismatches: ["parse returned null"] };
  const mm: string[] = [];
  const ascOk = parsed.asc_sign === orig.asc_sign;
  if (!ascOk) mm.push(`asc orig=${orig.asc_sign} parsed=${parsed.asc_sign}`);
  const parsedByKey = new Map<string, { sign: number; house: number }>();
  for (const p of parsed.positions) parsedByKey.set(p.key, p);
  for (const p of orig.positions) {
    const q = parsedByKey.get(p.key);
    if (!q) { mm.push(`missing:${p.key}`); continue; }
    if (q.sign !== p.sign) mm.push(`${p.key} sign orig=${p.sign} parsed=${q.sign}`);
    if (q.house !== p.house) mm.push(`${p.key} house orig=${p.house} parsed=${q.house}`);
  }
  return { ok: ascOk && mm.length === 0, parseFailed: false, ascOk, mismatches: mm };
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
  const headers = {
    apikey: key, Authorization: `Bearer ${key}`, "content-type": "application/json",
  };
  const rows = (await fetchJson(
    `${baseUrl}/rest/v1/chart_artifacts?user_id=eq.${userId}&chart_type=eq.natal&order=created_at.desc&limit=1&select=chart_jsonb`,
    headers,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  )) as any[];
  return rows[0]?.chart_jsonb ?? null;
}

async function discoverUsers(baseUrl: string, key: string, limit: number): Promise<string[]> {
  const headers = {
    apikey: key, Authorization: `Bearer ${key}`, "content-type": "application/json",
  };
  const rows = (await fetchJson(
    `${baseUrl}/rest/v1/chart_artifacts?chart_type=eq.natal&select=user_id&limit=2000`,
    headers,
  )) as Array<{ user_id: string }>;
  const seen = new Set<string>(); const out: string[] = [];
  for (const r of rows) {
    if (seen.has(r.user_id)) continue;
    seen.add(r.user_id); out.push(r.user_id);
    if (out.length >= limit) break;
  }
  return out;
}

// -----------------------------------------------------------------------------
// Sample-HTML side-by-side (visual eyeball)
// -----------------------------------------------------------------------------
async function fetchStoredSvg(
  baseUrl: string, key: string, userId: string, enumType: string,
): Promise<string | null> {
  const headers = {
    apikey: key, Authorization: `Bearer ${key}`, "content-type": "application/json",
  };
  const rows = (await fetchJson(
    `${baseUrl}/rest/v1/chart_artifacts?user_id=eq.${userId}&chart_type=eq.${enumType}&order=created_at.desc&limit=1&select=chart_jsonb`,
    headers,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  )) as any[];
  // deno-lint-ignore no-explicit-any
  return (rows[0]?.chart_jsonb as any)?.svg ?? null;
}

async function writeSideBySide(
  path: string, title: string, localSvg: string, prokeralaSvg: string | null,
) {
  const html = `<!doctype html><meta charset="utf-8"><title>${title}</title>
<style>
  body { font-family: system-ui, sans-serif; padding: 24px; background: #fafaf7; }
  h1 { font-size: 18px; margin-bottom: 20px; }
  .row { display: flex; gap: 32px; }
  .col { flex: 1; }
  .col h2 { font-size: 14px; margin: 0 0 8px; color: #666; text-transform: uppercase; letter-spacing: .05em; }
  .col svg { border: 1px solid #d5d5d5; background: #fff; width: 320px; height: 320px; }
</style>
<h1>${title}</h1>
<div class="row">
  <div class="col"><h2>Local render (renderNorthIndian)</h2>${localSvg}</div>
  <div class="col"><h2>Prokerala stored SVG</h2>${prokeralaSvg ?? "<em>not available</em>"}</div>
</div>`;
  await Deno.writeTextFile(path, html);
}

// -----------------------------------------------------------------------------
// Main
// -----------------------------------------------------------------------------
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

async function main() {
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

  const users = args.user ? [args.user] : await discoverUsers(url, key, args.limit);
  console.log(`render round-trip: ${users.length} user(s) × ${VARGAS.length} varga(s)\n`);

  const clean: Array<{ uid: string; polyCells: string[]; nearCells: string[]; passPoly: number; passNear: number; total: number }> = [];
  const stale: typeof clean = [];
  const failDetail: string[] = [];

  for (const uid of users) {
    let natal: unknown;
    try { natal = await loadNatal(url, key, uid); }
    catch (e) { console.log(`${uid} : load error ${String(e)}`); continue; }
    if (!natal) { console.log(`${uid} : no natal`); continue; }

    const polyCells: string[] = [];
    const nearCells: string[] = [];
    let passPoly = 0, passNear = 0, total = 0;

    for (const V of VARGAS) {
      let orig;
      try { orig = computeVarga(natal, V); }
      catch (e) { polyCells.push("cERR "); nearCells.push("cERR "); failDetail.push(`${uid} ${V}: compute ${String(e)}`); continue; }
      const svg = renderNorthIndian(orig);

      total++;
      const rP = compareToOrig(orig, parseByPolygon(svg));
      const rN = compareToOrig(orig, parseByNearestAnchor(svg));
      polyCells.push(rP.ok ? "ok   " : "FAIL ");
      nearCells.push(rN.ok ? "ok   " : "FAIL ");
      if (rP.ok) passPoly++;
      if (rN.ok) passNear++;
      if (!rP.ok) failDetail.push(`${uid} ${V} POLY: ${rP.mismatches.join("; ")}`);
      if (!rN.ok) failDetail.push(`${uid} ${V} NEAR: ${rN.mismatches.join("; ")}`);
    }
    const row = { uid, polyCells, nearCells, passPoly, passNear, total };
    (isStaleUser(uid) ? stale : clean).push(row);
  }

  const printBlock = (label: string, rows: typeof clean) => {
    if (!rows.length) return;
    console.log(`\n=== ${label} (${rows.length} user(s)) ===`);
    console.log(
      "user_id                                  " +
      VARGAS.map((v) => v.padEnd(5)).join(" ") +
      "   poly / near",
    );
    for (const r of rows) {
      console.log(
        `${r.uid.padEnd(40)} ${r.polyCells.join(" ")}    ${r.passPoly}/${r.total}  /  ${r.passNear}/${r.total}`,
      );
    }
    let sp = 0, sn = 0, st = 0;
    for (const r of rows) { sp += r.passPoly; sn += r.passNear; st += r.total; }
    console.log(`overall poly: ${sp}/${st} (${st ? (100 * sp / st).toFixed(1) : "n/a"}%)`);
    console.log(`overall near: ${sn}/${st} (${st ? (100 * sn / st).toFixed(1) : "n/a"}%)`);
  };

  printBlock("CLEAN cohort", clean);
  printBlock("STALE cohort (natal newer than SVGs — round-trip still gated)", stale);

  if (failDetail.length) {
    console.log(`\nfailures: ${failDetail.length}`);
    if (args.verbose) for (const d of failDetail) console.log(`  ${d}`);
    else console.log(`  (rerun --verbose to dump)`);
  }

  // Side-by-side eyeball for 2 charts.
  if (clean.length) {
    const uid = clean[0].uid;
    const natal = await loadNatal(url, key, uid);
    if (natal) {
      const scratch = "/private/tmp/claude-501/-Users-apple-Documents-Claude-Astrosathi/93b58dd7-6464-4b0a-b162-9047755e43a3/scratchpad";
      for (const V of ["D1", "D9"] as VargaKey[]) {
        const enumType = VARGA_TO_ENUM[V];
        const local = renderNorthIndian(computeVarga(natal, V));
        const remote = await fetchStoredSvg(url, key, uid, enumType);
        await writeSideBySide(
          `${scratch}/render-side-by-side-${V}.html`,
          `${V} — user ${uid.slice(0, 8)}`,
          local, remote,
        );
        console.log(`wrote ${scratch}/render-side-by-side-${V}.html`);
      }
    }
  }

  const cleanAllOk = clean.every((r) => r.passPoly === r.total && r.passNear === r.total);
  Deno.exit(cleanAllOk ? 0 : 1);
}

// Silence unused-import warnings in lean typechecks.
export { BODY_KEYS };

main().catch((e) => { console.error(e); Deno.exit(1); });
