// backfill-chart-facts.ts — one-shot backfill of chart_facts for all users
// with a birth profile.
//
// For each user:
//   birth_profile → computeNatalPayload (astronomy-engine, sidereal Lahiri)
//                 → computeAllVargas
//                 → upsert 16 chart_facts rows (onConflict user_id,chart_type)
//
// Direct DB writes with the SERVICE ROLE (no JWT/impersonation). Idempotent —
// safe to re-run. Does NOT write chart_artifacts (the gateway warms those
// lazily under the new engine-keyed hash).
//
// The natal-computation helpers below are copied verbatim from
// supabase/functions/chart-gateway/index.ts. Duplication is intentional:
// keeps this one-shot backfill decoupled from the deployed function so it
// cannot ever risk a regression in the live edge function.
//
// USAGE
//   deno run -A scripts/backfill-chart-facts.ts [--limit N] [--dry-run]
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  (source .env)

import {
  BODY_KEYS,
  computeAllVargas,
  computeVarga,
  VARGAS,
  VARGA_TO_ENUM,
  type VargaKey,
} from "../supabase/functions/chart-gateway/varga.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const Deno: any;

// -----------------------------------------------------------------------------
// Natal helpers — copied from chart-gateway/index.ts (Phase 0 swiss engine).
// -----------------------------------------------------------------------------
const SWISS_ENGINE_VERSION = "astronomy-engine@2.1.19+lahiri-v1";
const PROVIDER_VERSION = `${SWISS_ENGINE_VERSION}+varga-v1`;
const AYANAMSA_J2000 = 23.85292;
const ENG_SIGNS = ["Aries","Taurus","Gemini","Cancer","Leo","Virgo","Libra","Scorpio","Sagittarius","Capricorn","Aquarius","Pisces"];
const ENG_SIGN_LORDS = ["Mars","Venus","Mercury","Moon","Sun","Mercury","Venus","Mars","Jupiter","Saturn","Saturn","Jupiter"];

const eNorm360 = (x: number): number => ((x % 360) + 360) % 360;
const eNorm180 = (x: number): number => { const v = eNorm360(x); return v > 180 ? v - 360 : v; };
const eD2r = (d: number): number => (d * Math.PI) / 180;
const eR2d = (r: number): number => (r * 180) / Math.PI;
// deno-lint-ignore no-explicit-any
function eJulianCenturiesTT(A: any, date: Date): number { return A.MakeTime(date).tt / 36525; }
function ePrecessionSinceJ2000(T: number): number { return 1.3969713 * T + 0.0003086 * T * T; }
function eAyanamsaDeg(T: number): number { return AYANAMSA_J2000 + ePrecessionSinceJ2000(T); }
function eMeanObliquity(T: number): number {
  return 23.4392911 - 0.0130041667 * T - 1.638889e-7 * T * T + 5.036111e-7 * T * T * T;
}
// deno-lint-ignore no-explicit-any
function eEclipticLonOfDate(A: any, body: any, date: Date, aberration: boolean): number {
  const vec = A.GeoVector(body, date, aberration);
  const ecl = A.Ecliptic(vec);
  return eNorm360(ecl.elon);
}
// deno-lint-ignore no-explicit-any
function eSiderealLonOfBody(A: any, body: any, date: Date, aberration: boolean, T: number): number {
  return eNorm360(eEclipticLonOfDate(A, body, date, aberration) - eAyanamsaDeg(T));
}
function eMeanNodeOfDate(T: number): number {
  const om =
    125.0445479 - 1934.1362891 * T + 0.0020754 * T * T +
    (T * T * T) / 467441 - (T * T * T * T) / 60616000;
  return eNorm360(om);
}
// deno-lint-ignore no-explicit-any
function eIsRetrograde(A: any, body: any, date: Date, aberration: boolean): boolean {
  const l1 = eEclipticLonOfDate(A, body, date, aberration);
  const later = new Date(date.getTime() + 3600 * 1000);
  const l2 = eEclipticLonOfDate(A, body, later, aberration);
  return eNorm180(l2 - l1) < 0;
}
// deno-lint-ignore no-explicit-any
function eSiderealAscendant(A: any, date: Date, latDeg: number, lonDeg: number, T: number): number {
  const gastHours = A.SiderealTime(date);
  const ramc = eNorm360(gastHours * 15 + lonDeg);
  const eps = eMeanObliquity(T);
  const R = eD2r(ramc); const E = eD2r(eps); const P = eD2r(latDeg);
  const mc = eNorm360(eR2d(Math.atan2(Math.sin(R), Math.cos(R) * Math.cos(E))));
  let asc = eNorm360(eR2d(Math.atan2(Math.cos(R), -(Math.sin(R) * Math.cos(E) + Math.tan(P) * Math.sin(E)))));
  if (eNorm360(asc - mc) > 180) asc = eNorm360(asc + 180);
  return eNorm360(asc - eAyanamsaDeg(T));
}
function eBody(id: number, name: string, sidLon: number, retro: boolean) {
  const L = eNorm360(sidLon);
  const signIndex = Math.floor(L / 30);
  const degInSign = L - signIndex * 30;
  return {
    id, name, longitude: L, degree: degInSign, is_retrograde: retro,
    position: signIndex + 1,
    rasi: { id: signIndex, name: ENG_SIGNS[signIndex],
      lord: { name: ENG_SIGN_LORDS[signIndex], vedic_name: ENG_SIGN_LORDS[signIndex] } },
  };
}
async function computeNatalPayload(datetimeUsed: string, lat: number, lon: number): Promise<unknown> {
  // deno-lint-ignore no-explicit-any
  const A: any = await import("https://esm.sh/astronomy-engine@2.1.19");
  const date = new Date(datetimeUsed);
  if (Number.isNaN(date.getTime())) throw new Error("invalid datetime for swiss engine");
  const T = eJulianCenturiesTT(A, date);
  const grahas = [
    { id: 0, name: "Sun", body: A.Body.Sun, ab: true, canRetro: false },
    { id: 1, name: "Moon", body: A.Body.Moon, ab: false, canRetro: false },
    { id: 2, name: "Mercury", body: A.Body.Mercury, ab: true, canRetro: true },
    { id: 3, name: "Venus", body: A.Body.Venus, ab: true, canRetro: true },
    { id: 4, name: "Mars", body: A.Body.Mars, ab: true, canRetro: true },
    { id: 5, name: "Jupiter", body: A.Body.Jupiter, ab: true, canRetro: true },
    { id: 6, name: "Saturn", body: A.Body.Saturn, ab: true, canRetro: true },
  ];
  const planet_position: unknown[] = [];
  for (const g of grahas) {
    const sid = eSiderealLonOfBody(A, g.body, date, g.ab, T);
    const retro = g.canRetro ? eIsRetrograde(A, g.body, date, g.ab) : false;
    planet_position.push(eBody(g.id, g.name, sid, retro));
  }
  const rahu = eNorm360(eMeanNodeOfDate(T) - eAyanamsaDeg(T));
  planet_position.push(eBody(101, "Rahu", rahu, true));
  planet_position.push(eBody(102, "Ketu", eNorm360(rahu + 180), true));
  const asc = eSiderealAscendant(A, date, lat, lon, T);
  planet_position.push(eBody(100, "Ascendant", asc, false));
  return {
    status: "ok", provider: "astronomy-engine", provider_version: SWISS_ENGINE_VERSION,
    ayanamsa: "lahiri", system: "parashara", computed_utc: date.toISOString(),
    data: { planet_position },
  };
}

// Datetime + timezone helpers (also from index.ts).
function tzOffsetMinutes(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone, hour12: false, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const parts = dtf.formatToParts(date).reduce<Record<string, string>>((acc, p) => {
    if (p.type !== "literal") acc[p.type] = p.value; return acc;
  }, {});
  const asUTC = Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    Number(parts.hour === "24" ? "00" : parts.hour), Number(parts.minute), Number(parts.second),
  );
  return Math.round((asUTC - date.getTime()) / 60_000);
}
function isoWithOffset(dateStr: string, timeStr: string, timeZone: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm, ss] = timeStr.split(":").map((v) => Number(v || 0));
  const asUTC = Date.UTC(y, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0, ss ?? 0);
  const offsetMin = tzOffsetMinutes(new Date(asUTC), timeZone);
  const sign = offsetMin >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMin);
  const oh = String(Math.floor(abs / 60)).padStart(2, "0");
  const om = String(abs % 60).padStart(2, "0");
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  const local = `${y}-${pad(m)}-${pad(d)}T${pad(hh ?? 0)}:${pad(mm ?? 0)}:${pad(ss ?? 0)}`;
  return `${local}${sign}${oh}:${om}`;
}

// -----------------------------------------------------------------------------
// REST helpers (service role — bypasses RLS).
// -----------------------------------------------------------------------------
async function restGet(baseUrl: string, key: string, path: string): Promise<unknown> {
  const res = await fetch(`${baseUrl}/rest/v1/${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, "content-type": "application/json" },
  });
  if (!res.ok) throw new Error(`GET ${path} -> ${res.status} ${await res.text()}`);
  return await res.json();
}
async function restUpsert(baseUrl: string, key: string, table: string, row: unknown, onConflict: string): Promise<void> {
  const res = await fetch(`${baseUrl}/rest/v1/${table}?on_conflict=${onConflict}`, {
    method: "POST",
    headers: {
      apikey: key, Authorization: `Bearer ${key}`,
      "content-type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(row),
  });
  if (!res.ok) throw new Error(`UPSERT ${table} -> ${res.status} ${await res.text()}`);
}

// -----------------------------------------------------------------------------
// Main
// -----------------------------------------------------------------------------
type BirthProfile = {
  id: string; user_id: string;
  birth_date: string | null; birth_time: string | null;
  birth_time_known: boolean | null; birth_timezone: string | null;
  latitude: number | null; longitude: number | null;
};

async function main() {
  const baseUrl = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!baseUrl || !key) {
    console.error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY required (source .env).");
    Deno.exit(1);
  }
  const argv = (Deno.args ?? []) as string[];
  let limit = 10_000;
  let dryRun = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--limit") limit = Math.max(1, Number(argv[i + 1] || 10000));
    if (argv[i] === "--dry-run") dryRun = true;
  }

  const profiles = (await restGet(
    baseUrl, key,
    `birth_profiles?select=id,user_id,birth_date,birth_time,birth_time_known,birth_timezone,latitude,longitude&limit=${limit}`,
  )) as BirthProfile[];
  console.log(`\n=== chart_facts backfill — ${profiles.length} birth profiles (dry_run=${dryRun}) ===\n`);

  const counters = { profiles: profiles.length, computed: 0, upserted: 0, skipped: 0, failed: 0 };
  const failures: Array<{ user: string; reason: string }> = [];
  const spotcheck: Array<{ user: string; D: VargaKey; asc_sign: number; positions_sample: string }> = [];

  for (const bp of profiles) {
    if (!bp.birth_date || !bp.birth_timezone ||
        typeof bp.latitude !== "number" || typeof bp.longitude !== "number") {
      counters.skipped++;
      failures.push({ user: bp.user_id.slice(0, 8), reason: "incomplete birth profile" });
      continue;
    }
    const timeKnown = bp.birth_time_known !== false;
    const rawTime = timeKnown ? String(bp.birth_time ?? "12:00:00") : "12:00:00";
    const trimmed = rawTime.slice(0, 8);
    const normalizedTime = trimmed.length === 5 ? `${trimmed}:00` : trimmed.padEnd(8, "0");
    const datetimeUsed = isoWithOffset(String(bp.birth_date), normalizedTime, bp.birth_timezone);

    let natal: unknown;
    try {
      natal = await computeNatalPayload(datetimeUsed, bp.latitude, bp.longitude);
    } catch (e) {
      counters.failed++;
      failures.push({ user: bp.user_id.slice(0, 8), reason: `natal compute: ${(e as Error).message}` });
      continue;
    }
    counters.computed++;

    const all = computeAllVargas(natal);

    for (const D of VARGAS) {
      const r = all[D];
      const chartType = VARGA_TO_ENUM[D];
      const row = {
        user_id: bp.user_id,
        birth_profile_id: bp.id,
        chart_type: chartType,
        input_hash: `backfill:${SWISS_ENGINE_VERSION}+varga-v1`,
        provider: "astronomy-engine",
        asc_sign: r.asc_sign,
        positions: r.positions,
        meta: { engine: "swiss", endpoint: "local/varga", provider_version: PROVIDER_VERSION },
      };
      if (dryRun) { counters.upserted++; continue; }
      try {
        await restUpsert(baseUrl, key, "chart_facts", row, "user_id,chart_type");
        counters.upserted++;
      } catch (e) {
        counters.failed++;
        failures.push({ user: bp.user_id.slice(0, 8), reason: `upsert ${chartType}: ${(e as Error).message}` });
      }
    }
    // Save two users' D1/D9/D60 for a spot-check.
    if (spotcheck.filter((s) => s.user === bp.user_id.slice(0, 8)).length === 0 && spotcheck.length < 6) {
      for (const D of ["D1", "D9", "D60"] as VargaKey[]) {
        const r = all[D];
        spotcheck.push({
          user: bp.user_id.slice(0, 8), D, asc_sign: r.asc_sign,
          positions_sample: r.positions.map((p) => `${p.key}=${p.sign}/${p.house}`).join(" "),
        });
      }
    }
  }

  console.log(`\nResult:`);
  console.log(`  profiles seen : ${counters.profiles}`);
  console.log(`  natals ok     : ${counters.computed}`);
  console.log(`  rows upserted : ${counters.upserted}${dryRun ? " (dry-run — no writes)" : ""}`);
  console.log(`  skipped       : ${counters.skipped}`);
  console.log(`  failed        : ${counters.failed}`);
  if (failures.length) {
    console.log(`\nFailures (${failures.length}):`);
    for (const f of failures.slice(0, 30)) console.log(`  ${f.user}  ${f.reason}`);
    if (failures.length > 30) console.log(`  … (${failures.length - 30} more)`);
  }

  console.log(`\nSpot-check (asc_sign + positions from computeVarga; upserted verbatim):`);
  for (const s of spotcheck) {
    console.log(`  ${s.user}  ${s.D}  asc=${s.asc_sign}  ${s.positions_sample}`);
  }

  // Sanity: re-read spot-check users' rows from DB and assert equality.
  if (!dryRun && spotcheck.length) {
    console.log(`\nReadback sanity — must equal computeVarga:`);
    const users = Array.from(new Set(spotcheck.map((s) => s.user)));
    for (const uPrefix of users) {
      const bp = profiles.find((p) => p.user_id.startsWith(uPrefix));
      if (!bp) continue;
      const rows = (await restGet(
        baseUrl, key,
        `chart_facts?user_id=eq.${bp.user_id}&chart_type=in.(d1_rashi,d9_navamsha,d60_shashtiamsha)&select=chart_type,asc_sign,positions`,
      )) as Array<{ chart_type: string; asc_sign: number; positions: Array<{ key: string; sign: number; house: number }> }>;
      for (const s of spotcheck.filter((x) => x.user === uPrefix)) {
        const chartType = VARGA_TO_ENUM[s.D];
        const dbRow = rows.find((r) => r.chart_type === chartType);
        const ok = dbRow && dbRow.asc_sign === s.asc_sign
          && dbRow.positions.map((p) => `${p.key}=${p.sign}/${p.house}`).join(" ") === s.positions_sample
          && dbRow.positions.every((p) => BODY_KEYS.includes(p.key as typeof BODY_KEYS[number]));
        console.log(`  ${uPrefix}  ${s.D}  ${ok ? "OK" : "MISMATCH"}`);
      }
    }
  }

  if (counters.failed > 0) Deno.exit(2);
}

main().catch((e) => { console.error(e); Deno.exit(1); });
