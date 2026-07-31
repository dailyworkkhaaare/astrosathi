// doshas-parity.ts — offline parity/QA for the local Mangal + Kaal Sarp engines.
//
// PURPOSE
//   Prove that computeMangalDoshaPayload / computeKaalSarpDoshaPayload
//   reproduce Prokerala's stored artifacts BEFORE we flip the default in
//   chart-gateway. Zero Prokerala spend: reads already-stored artifacts.
//
// USAGE
//   --all
//     For up to `--limit N` (default 20) distinct user_ids that have a stored
//     natal + at least one prokerala dosha artifact, load each user's natal +
//     mangal + kaal-sarp rows, compute local, byte-compare descriptions and
//     compare has_dosha. Print per-user [ok]/[FAIL] + mangal/kaal-sarp
//     match-rate summary.
//
//   --find-kaalsarp
//     Sweep synthetic births across a wide date range at a fixed lat/lon
//     (defaults: Delhi 28.6139N, 77.2090E). For each candidate, run the local
//     natal engine once then compute kaal-sarp; print the first birth
//     (date, time, tz, lat, lon) that flips has_dosha=true. Feed that birth
//     into Prokerala manually to capture a real positive envelope.
//
//   Env required for --all: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

import { computeMangalDoshaPayload } from "../supabase/functions/chart-gateway/mangal.ts";
import { computeKaalSarpDoshaPayload } from "../supabase/functions/chart-gateway/kaalsarp.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const Deno: any;

// ---- Row identification -------------------------------------------------
// Prefer explicit _report.type stamp (new local rows). Fall back to key shape
// (legacy prokerala rows have no stamp).
type DoshaKind = "mangal" | "kaal_sarp" | "sade_sati" | "unknown";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function identify(row: any): DoshaKind {
  const stamped = row?.chart_jsonb?._report?.type as string | undefined;
  if (stamped === "mangal_dosha") return "mangal";
  if (stamped === "kaal_sarp_dosha") return "kaal_sarp";
  if (stamped === "sade_sati") return "sade_sati";
  const d = row?.chart_jsonb?.data ?? row?.chart_jsonb ?? {};
  if ("dosha_type" in d) return "kaal_sarp";
  if ("is_in_sade_sati" in d) return "sade_sati";
  if ("has_dosha" in d) return "mangal";
  return "unknown";
}

// ---- REST helpers -------------------------------------------------------
async function fetchJson(url: string, headers: Record<string, string>) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`REST ${res.status} ${url}`);
  return await res.json();
}

async function loadUserFixture(
  baseUrl: string,
  key: string,
  userId: string,
): Promise<{
  userId: string;
  natal: unknown;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mangal: any | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  kaalSarp: any | null;
}> {
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
  const doshaRows = (await fetchJson(
    `${baseUrl}/rest/v1/chart_artifacts?user_id=eq.${userId}&chart_type=eq.doshas&provider=eq.prokerala&order=created_at.desc&limit=20&select=chart_jsonb,created_at`,
    headers,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  )) as any[];
  let mangal: unknown = null;
  let kaalSarp: unknown = null;
  for (const r of doshaRows) {
    const kind = identify(r);
    if (kind === "mangal" && !mangal) mangal = r.chart_jsonb;
    else if (kind === "kaal_sarp" && !kaalSarp) kaalSarp = r.chart_jsonb;
    if (mangal && kaalSarp) break;
  }
  return { userId, natal: natalRows[0].chart_jsonb, mangal, kaalSarp };
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
  const doshaRows = (await fetchJson(
    `${baseUrl}/rest/v1/chart_artifacts?chart_type=eq.doshas&provider=eq.prokerala&select=user_id&order=created_at.desc&limit=${Math.max(limit * 8, 200)}`,
    headers,
  )) as Array<{ user_id: string }>;
  const seen = new Set<string>();
  const list: string[] = [];
  for (const r of doshaRows) {
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

// ---- Comparisons --------------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function inner(x: any) {
  return x?.data ?? x;
}

function cmpMangal(
  natal: unknown,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pro: any,
): { has: "Y" | "N"; desc: "Y" | "N"; hasProDosha?: boolean; hasLocDosha?: boolean; proDesc?: string; locDesc?: string } {
  const loc = computeMangalDoshaPayload(natal);
  const p = inner(pro);
  const l = loc.data;
  return {
    has: p?.has_dosha === l.has_dosha ? "Y" : "N",
    desc: p?.description === l.description ? "Y" : "N",
    hasProDosha: p?.has_dosha,
    hasLocDosha: l.has_dosha,
    proDesc: p?.description,
    locDesc: l.description,
  };
}

function cmpKaalSarp(
  natal: unknown,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pro: any,
): { has: "Y" | "N"; descOnNegative: "Y" | "N" | "-"; hasProDosha?: boolean; hasLocDosha?: boolean; proDesc?: string; locDesc?: string } {
  const loc = computeKaalSarpDoshaPayload(natal);
  const p = inner(pro);
  const l = loc.data;
  const hasMatch = p?.has_dosha === l.has_dosha;
  // Only byte-compare description when Prokerala says NO dosha; positive
  // descriptions require the real Prokerala template (still TBD).
  const descNegMatch =
    p?.has_dosha === false && l.has_dosha === false
      ? p?.description === l.description ? "Y" : "N"
      : "-";
  return {
    has: hasMatch ? "Y" : "N",
    descOnNegative: descNegMatch,
    hasProDosha: p?.has_dosha,
    hasLocDosha: l.has_dosha,
    proDesc: p?.description,
    locDesc: l.description,
  };
}

// ---- --find-kaalsarp sweep ---------------------------------------------
async function runFindKaalSarp(opts: {
  lat: number;
  lon: number;
  startYear: number;
  endYear: number;
  stepDays: number;
  tzOffsetMinutes: number;
  hour: number;
  minute: number;
}) {
  // @ts-ignore esm.sh import resolved at runtime
  const A: any = await import("https://esm.sh/astronomy-engine@2.1.19");
  const AYAN_J2000 = 23.85292;
  const AYAN_RATE = 50.2708 / 3600;
  const norm = (x: number) => ((x % 360) + 360) % 360;
  const jc = (d: Date) =>
    ((d.getTime() - Date.UTC(2000, 0, 1, 12)) / 86400000) / 36525;
  const ayan = (T: number) => AYAN_J2000 + AYAN_RATE * T * 100;
  const sidLon = (body: any, d: Date, aberration: boolean, T: number) => {
    // Mirror chart-gateway/index.ts eEclipticLonOfDate: Ecliptic(GeoVector).elon
    // works for every body including the Moon in astronomy-engine 2.1.19.
    const vec = A.GeoVector(body, d, aberration);
    const ecl = A.Ecliptic(vec);
    return norm(ecl.elon - ayan(T));
  };
  const meanNode = (T: number) => {
    // Meeus mean lunar ascending node (tropical). Convert to sidereal via ayanamsa.
    const trop =
      125.04452 - 1934.136261 * T + 0.0020708 * T * T + (T * T * T) / 450000;
    return norm(trop - ayan(T));
  };

  // Build a rough Ascendant by whole-sign — but Kaal Sarp only depends on
  // planets + Rahu longitudes, not the ascendant. So skip ascendant here.
  const bodies = [
    { id: 0, body: A.Body.Sun, ab: true },
    { id: 1, body: A.Body.Moon, ab: false },
    { id: 2, body: A.Body.Mercury, ab: true },
    { id: 3, body: A.Body.Venus, ab: true },
    { id: 4, body: A.Body.Mars, ab: true },
    { id: 5, body: A.Body.Jupiter, ab: true },
    { id: 6, body: A.Body.Saturn, ab: true },
  ];

  const start = new Date(Date.UTC(opts.startYear, 0, 1, opts.hour, opts.minute));
  const end = new Date(Date.UTC(opts.endYear, 11, 31));
  const stepMs = opts.stepDays * 86400_000;
  let scanned = 0;
  for (let t = start.getTime(); t <= end.getTime(); t += stepMs) {
    const d = new Date(t);
    const T = jc(d);
    const planet_position: any[] = [];
    for (const g of bodies) {
      const lon = sidLon(g.body, d, g.ab, T);
      planet_position.push({
        id: g.id,
        longitude: lon,
        rasi: { id: Math.floor(lon / 30) },
      });
    }
    const rahu = meanNode(T);
    planet_position.push({
      id: 101,
      longitude: rahu,
      rasi: { id: Math.floor(rahu / 30) },
    });
    planet_position.push({
      id: 102,
      longitude: norm(rahu + 180),
      rasi: { id: Math.floor(norm(rahu + 180) / 30) },
    });
    // Kaal Sarp needs an ascendant for the `type` label but not for has_dosha.
    // Provide a stub ascendant so the module doesn't throw.
    planet_position.push({
      id: 100,
      longitude: 0,
      rasi: { id: 0 },
    });
    const natal = { data: { planet_position } };
    try {
      const res = computeKaalSarpDoshaPayload(natal);
      scanned++;
      if (res.data.has_dosha) {
        const offSign = opts.tzOffsetMinutes >= 0 ? "+" : "-";
        const absOff = Math.abs(opts.tzOffsetMinutes);
        const offStr =
          offSign +
          String(Math.floor(absOff / 60)).padStart(2, "0") +
          ":" +
          String(absOff % 60).padStart(2, "0");
        console.log(`\nFOUND kaal-sarp positive after ${scanned} probes:`);
        console.log(
          JSON.stringify(
            {
              date_utc: d.toISOString().slice(0, 10),
              time_utc: d.toISOString().slice(11, 19),
              tz_offset: offStr,
              lat: opts.lat,
              lon: opts.lon,
              rahu_lon: rahu.toFixed(4),
              deltas_from_rahu: planet_position
                .filter((p) => p.id <= 6)
                .map((p) => norm(p.longitude - rahu).toFixed(2)),
            },
            null,
            2,
          ),
        );
        return;
      }
    } catch (_e) {
      // Skip probes where the ephemeris throws (e.g. exact-conjunction edge).
    }
  }
  console.log(`no positive across ${scanned} probes.`);
}

// ---- Main ---------------------------------------------------------------
async function main() {
  const args = Deno.args as string[];
  let mode: "all" | "find" | null = null;
  let limit = 20;
  const findOpts = {
    lat: 28.6139,
    lon: 77.2090,
    startYear: 1900,
    endYear: 2050,
    stepDays: 7,
    tzOffsetMinutes: 330,
    hour: 6,
    minute: 30,
  };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--all") mode = "all";
    else if (args[i] === "--find-kaalsarp") mode = "find";
    else if (args[i] === "--limit") limit = Number(args[++i]);
    else if (args[i] === "--step-days") findOpts.stepDays = Number(args[++i]);
    else if (args[i] === "--start-year") findOpts.startYear = Number(args[++i]);
    else if (args[i] === "--end-year") findOpts.endYear = Number(args[++i]);
  }
  if (!mode) {
    console.error("usage: --all [--limit N]  |  --find-kaalsarp [--step-days N] [--start-year Y] [--end-year Y]");
    Deno.exit(2);
  }

  if (mode === "find") {
    await runFindKaalSarp(findOpts);
    return;
  }

  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for --all");
    Deno.exit(2);
  }
  const users = await discoverUsers(url, key, limit);
  console.log(`discovered ${users.length} user(s) with natal + prokerala doshas (cap ${limit})\n`);

  let mHas = 0, mHasTot = 0, mDesc = 0, mDescTot = 0;
  let kHas = 0, kHasTot = 0, kDescNeg = 0, kDescNegTot = 0;
  console.log("user_id                                mangal(has/desc)  kaal-sarp(has/descNeg)  notes");
  console.log("------------------------------------   ----------------  ----------------------  -----");
  for (const uid of users) {
    try {
      const fx = await loadUserFixture(url, key, uid);
      const notes: string[] = [];
      let mCol = " -/-", kCol = " -/-";
      if (fx.mangal) {
        const r = cmpMangal(fx.natal, fx.mangal);
        mHasTot++;
        mDescTot++;
        if (r.has === "Y") mHas++;
        if (r.desc === "Y") mDesc++;
        mCol = ` ${r.has}/${r.desc}`;
        if (r.has === "N") notes.push(`mangal has: pro=${r.hasProDosha} loc=${r.hasLocDosha}`);
        if (r.desc === "N") notes.push(`mangal desc: pro="${r.proDesc}" loc="${r.locDesc}"`);
      } else notes.push("no mangal row");
      if (fx.kaalSarp) {
        const r = cmpKaalSarp(fx.natal, fx.kaalSarp);
        kHasTot++;
        if (r.has === "Y") kHas++;
        if (r.descOnNegative !== "-") {
          kDescNegTot++;
          if (r.descOnNegative === "Y") kDescNeg++;
        }
        kCol = ` ${r.has}/${r.descOnNegative}`;
        if (r.has === "N") notes.push(`kaal-sarp has: pro=${r.hasProDosha} loc=${r.hasLocDosha}`);
        if (r.descOnNegative === "N")
          notes.push(`kaal-sarp desc(neg): pro="${r.proDesc}" loc="${r.locDesc}"`);
      } else notes.push("no kaal-sarp row");
      const status = notes.length === 0 || (mCol === " Y/Y" && kCol === " Y/Y") ? "[ok]" : "[FAIL]";
      console.log(`${uid}   ${mCol.padEnd(16)}  ${kCol.padEnd(22)}  ${status} ${notes.join(" | ")}`);
    } catch (e) {
      console.log(`${uid}   ${" -/-".padEnd(16)}  ${" -/-".padEnd(22)}  [LOAD-FAIL] ${(e as Error).message}`);
    }
  }
  console.log(
    `\nSummary:\n  mangal has_dosha:  ${mHas}/${mHasTot} match\n  mangal description: ${mDesc}/${mDescTot} byte-match\n  kaal-sarp has_dosha: ${kHas}/${kHasTot} match\n  kaal-sarp negative description: ${kDescNeg}/${kDescNegTot} byte-match`,
  );
}

await main();
