// ashtakavarga-parity.ts — offline parity/QA for the local Ashtakavarga +
// Sarvashtakavarga engine.
//
// PURPOSE
//   Prove that computeAshtakavargaPayload / computeSarvashtakavargaPayload
//   reproduce Prokerala's stored artifacts BEFORE we flip the default in
//   chart-gateway. Zero Prokerala spend: reads already-stored artifacts.
//
// USAGE
//   --all [--limit N]
//     For up to N distinct user_ids (default 20) that have a stored natal +
//     at least one prokerala ashtakavarga artifact, load each user's natal +
//     7 bhinna (keyed by _report.params.planet, falling back to key-shape
//     detection for legacy rows) + 1 sarva row, compute local, deep-value
//     compare (values, not JSON strings, since jsonb reorders keys):
//       prastara     — grand score + every house score + every contributor
//                       value  <- HARD gate, must be 100%
//       trikona / ekaadhipatya — grand score + every house score (reported,
//                       not hard-gated — the two shodhana conventions are
//                       still being confirmed against real captures)
//     Prints a user x planet matrix + summary.
//
//   Env required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

import {
  computeAshtakavargaPayload,
  computeSarvashtakavargaPayload,
} from "../supabase/functions/chart-gateway/ashtakavarga.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const Deno: any;

// ---- Row identification -------------------------------------------------
type AvKind = "bhinna" | "sarva" | "unknown";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function identify(row: any): { kind: AvKind; planet: number | null } {
  const stamped = row?.chart_jsonb?._report?.type as string | undefined;
  if (stamped === "ashtakavarga") {
    const p = Number(row?.chart_jsonb?._report?.params?.planet);
    return { kind: "bhinna", planet: Number.isFinite(p) ? p : null };
  }
  if (stamped === "sarvashtakavarga") return { kind: "sarva", planet: null };
  const d = row?.chart_jsonb?.data ?? row?.chart_jsonb ?? {};
  if (d.sarvashtakavarga) return { kind: "sarva", planet: null };
  if (d.ashtakavarga) {
    // Legacy Prokerala bhinna row: recover planet id from provider_params if
    // present, else leave null (matched positionally below as a fallback).
    const p = Number(row?.provider_params?.planet ?? row?.chart_jsonb?.planet);
    return { kind: "bhinna", planet: Number.isFinite(p) ? p : null };
  }
  return { kind: "unknown", planet: null };
}

// ---- REST helpers -------------------------------------------------------
async function fetchJson(url: string, headers: Record<string, string>) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`REST ${res.status} ${url}`);
  return await res.json();
}

type Fixture = {
  userId: string;
  natal: unknown;
  bhinna: Map<number, unknown>; // planet id -> prokerala chart_jsonb
  sarva: unknown | null;
};

async function loadUserFixture(baseUrl: string, key: string, userId: string): Promise<Fixture> {
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "content-type": "application/json",
  };
  const natalRows = (await fetchJson(
    `${baseUrl}/rest/v1/chart_artifacts?user_id=eq.${userId}&chart_type=eq.natal&order=created_at.desc&limit=1&select=chart_jsonb`,
    headers,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  )) as any[];
  if (!natalRows[0]) throw new Error(`no natal for ${userId}`);

  const avRows = (await fetchJson(
    `${baseUrl}/rest/v1/chart_artifacts?user_id=eq.${userId}&chart_type=eq.ashtakavarga&provider=eq.prokerala&order=created_at.desc&limit=50&select=chart_jsonb,created_at`,
    headers,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  )) as any[];

  const bhinna = new Map<number, unknown>();
  let sarva: unknown | null = null;
  // Latest-first; only keep the first (newest) row per planet / sarva.
  for (const r of avRows) {
    const { kind, planet } = identify(r);
    if (kind === "sarva" && !sarva) sarva = r.chart_jsonb;
    else if (kind === "bhinna" && planet !== null && !bhinna.has(planet)) {
      bhinna.set(planet, r.chart_jsonb);
    }
  }
  return { userId, natal: natalRows[0].chart_jsonb, bhinna, sarva };
}

async function discoverUsers(baseUrl: string, key: string, limit: number): Promise<string[]> {
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "content-type": "application/json",
  };
  const avRows = (await fetchJson(
    `${baseUrl}/rest/v1/chart_artifacts?chart_type=eq.ashtakavarga&provider=eq.prokerala&select=user_id&order=created_at.desc&limit=${Math.max(limit * 8, 200)}`,
    headers,
  )) as Array<{ user_id: string }>;
  const seen = new Set<string>();
  const list: string[] = [];
  for (const r of avRows) {
    if (!seen.has(r.user_id)) {
      seen.add(r.user_id);
      list.push(r.user_id);
    }
  }
  const natalRows = (await fetchJson(
    `${baseUrl}/rest/v1/chart_artifacts?chart_type=eq.natal&select=user_id&limit=1000`,
    headers,
  )) as Array<{ user_id: string }>;
  const natal = new Set(natalRows.map((r) => r.user_id));
  const both: string[] = [];
  for (const u of list) if (natal.has(u) && both.length < limit) both.push(u);
  return both;
}

// ---- Deep-value comparisons ----------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function inner(x: any) {
  return x?.data ?? x;
}

type GridCmp = { scoreOk: boolean; houseMismatches: number; detail: string[] };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function cmpReducedGrid(pro: any, loc: any): GridCmp {
  const detail: string[] = [];
  const scoreOk = Number(pro?.score) === Number(loc?.score);
  if (!scoreOk) detail.push(`score: pro=${pro?.score} loc=${loc?.score}`);
  let houseMismatches = 0;
  const proHouses = pro?.houses ?? [];
  const locHouses = loc?.houses ?? [];
  for (let i = 0; i < 12; i++) {
    const ph = proHouses.find((h: { house: { number: number } }) => h.house?.number === i + 1);
    const lh = locHouses.find((h: { house: { number: number } }) => h.house?.number === i + 1);
    if (Number(ph?.score) !== Number(lh?.score)) {
      houseMismatches++;
      detail.push(`house ${i + 1}: pro=${ph?.score} loc=${lh?.score}`);
    }
  }
  return { scoreOk, houseMismatches, detail };
}

type PrastaraCmp = GridCmp & { contributorMismatches: number };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function cmpPrastara(pro: any, loc: any): PrastaraCmp {
  const base = cmpReducedGrid(pro, loc);
  let contributorMismatches = 0;
  const proHouses = pro?.houses ?? [];
  const locHouses = loc?.houses ?? [];
  for (let i = 0; i < 12; i++) {
    const ph = proHouses.find((h: { house: { number: number } }) => h.house?.number === i + 1);
    const lh = locHouses.find((h: { house: { number: number } }) => h.house?.number === i + 1);
    const pPlanets = ph?.planets ?? [];
    const lPlanets = lh?.planets ?? [];
    for (const lp of lPlanets) {
      const pp = pPlanets.find((x: { planet: { id: number } }) => x.planet?.id === lp.planet.id);
      if (Number(pp?.score) !== Number(lp.score)) {
        contributorMismatches++;
        base.detail.push(
          `house ${i + 1} planet ${lp.planet.id}: pro=${pp?.score} loc=${lp.score}`,
        );
      }
    }
  }
  return { ...base, contributorMismatches };
}

// ---- Main -----------------------------------------------------------------
async function main() {
  const args = Deno.args as string[];
  let limit = 20;
  let wantAll = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--all") wantAll = true;
    else if (args[i] === "--limit") limit = Number(args[++i]);
  }
  if (!wantAll) {
    console.error("usage: --all [--limit N]");
    Deno.exit(2);
  }

  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
    Deno.exit(2);
  }

  const users = await discoverUsers(url, key, limit);
  console.log(`discovered ${users.length} user(s) with natal + prokerala ashtakavarga (cap ${limit})\n`);

  let prastaraTotal = 0, prastaraOk = 0;
  let trikonaTotal = 0, trikonaOk = 0;
  let ekTotal = 0, ekOk = 0;

  console.log(
    "user_id                                planet  prastara(score/houses/contrib)  trikona(score/houses)  ekaadhipatya(score/houses)",
  );
  console.log(
    "------------------------------------   ------  -------------------------------  ----------------------  ---------------------------",
  );

  for (const uid of users) {
    let fx: Fixture;
    try {
      fx = await loadUserFixture(url, key, uid);
    } catch (e) {
      console.log(`${uid}   [LOAD-FAIL] ${(e as Error).message}`);
      continue;
    }

    for (let planetId = 0; planetId <= 6; planetId++) {
      const proRow = fx.bhinna.get(planetId);
      if (!proRow) continue;
      let loc;
      try {
        loc = computeAshtakavargaPayload(fx.natal, planetId);
      } catch (e) {
        console.log(`${uid}   planet=${planetId}  [COMPUTE-FAIL] ${(e as Error).message}`);
        continue;
      }
      const p = inner(proRow)?.ashtakavarga;
      const l = loc.data.ashtakavarga;

      prastaraTotal++;
      const pc = cmpPrastara(p?.prastara, l.prastara);
      const prastaraPass = pc.scoreOk && pc.houseMismatches === 0 && pc.contributorMismatches === 0;
      if (prastaraPass) prastaraOk++;

      trikonaTotal++;
      const tc = cmpReducedGrid(p?.trikona, l.trikona);
      if (tc.scoreOk && tc.houseMismatches === 0) trikonaOk++;

      ekTotal++;
      const ec = cmpReducedGrid(p?.ekaadhipatya, l.ekaadhipatya);
      if (ec.scoreOk && ec.houseMismatches === 0) ekOk++;

      const status = prastaraPass ? "[ok]" : "[FAIL]";
      console.log(
        `${uid}   planet=${planetId}  ${(prastaraPass ? "Y" : "N").padEnd(2)}/${pc.houseMismatches}/${pc.contributorMismatches}` +
          `                          ${(tc.scoreOk && tc.houseMismatches === 0 ? "Y" : "N").padEnd(2)}/${tc.houseMismatches}` +
          `                    ${(ec.scoreOk && ec.houseMismatches === 0 ? "Y" : "N").padEnd(2)}/${ec.houseMismatches}` +
          `   ${status}`,
      );
      if (!prastaraPass) for (const d of pc.detail) console.log(`      prastara: ${d}`);
      if (!(tc.scoreOk && tc.houseMismatches === 0)) for (const d of tc.detail) console.log(`      trikona: ${d}`);
      if (!(ec.scoreOk && ec.houseMismatches === 0)) for (const d of ec.detail) console.log(`      ekaadhipatya: ${d}`);
    }

    if (fx.sarva) {
      let loc;
      try {
        loc = computeSarvashtakavargaPayload(fx.natal);
      } catch (e) {
        console.log(`${uid}   sarva  [COMPUTE-FAIL] ${(e as Error).message}`);
        continue;
      }
      const p = inner(fx.sarva)?.sarvashtakavarga;
      const l = loc.data.sarvashtakavarga;

      prastaraTotal++;
      const pc = cmpPrastara(p?.prastara, l.prastara);
      const prastaraPass = pc.scoreOk && pc.houseMismatches === 0 && pc.contributorMismatches === 0;
      if (prastaraPass) prastaraOk++;

      trikonaTotal++;
      const tc = cmpReducedGrid(p?.trikona, l.trikona);
      if (tc.scoreOk && tc.houseMismatches === 0) trikonaOk++;

      ekTotal++;
      const ec = cmpReducedGrid(p?.ekaadhipatya, l.ekaadhipatya);
      if (ec.scoreOk && ec.houseMismatches === 0) ekOk++;

      const status = prastaraPass ? "[ok]" : "[FAIL]";
      console.log(
        `${uid}   sarva   ${(prastaraPass ? "Y" : "N").padEnd(2)}/${pc.houseMismatches}/${pc.contributorMismatches}` +
          `                          ${(tc.scoreOk && tc.houseMismatches === 0 ? "Y" : "N").padEnd(2)}/${tc.houseMismatches}` +
          `                    ${(ec.scoreOk && ec.houseMismatches === 0 ? "Y" : "N").padEnd(2)}/${ec.houseMismatches}` +
          `   ${status}`,
      );
      if (!prastaraPass) for (const d of pc.detail) console.log(`      prastara: ${d}`);
      if (!(tc.scoreOk && tc.houseMismatches === 0)) for (const d of tc.detail) console.log(`      trikona: ${d}`);
      if (!(ec.scoreOk && ec.houseMismatches === 0)) for (const d of ec.detail) console.log(`      ekaadhipatya: ${d}`);
    } else {
      console.log(`${uid}   sarva   [no prokerala sarva row]`);
    }
  }

  console.log(
    `\nSummary:\n  prastara (HARD gate):     ${prastaraOk}/${prastaraTotal}\n  trikona:                  ${trikonaOk}/${trikonaTotal}\n  ekaadhipatya:              ${ekOk}/${ekTotal}`,
  );
}

await main();
