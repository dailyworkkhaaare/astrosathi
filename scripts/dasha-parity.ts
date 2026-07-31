// dasha-parity.ts — offline parity/QA for the local Vimshottari engine.
//
// PURPOSE
//   Prove that computeVimshottariDashaPayload reproduces Prokerala's
//   vimshottari_dasha artifact within tolerance BEFORE we flip the default in
//   chart-gateway. Zero Prokerala spend: reads already-stored artifacts (natal
//   + vimshottari_dasha) from chart_artifacts.
//
// USAGE
//   A) Query stored artifacts by user (needs SUPABASE_URL + SERVICE key):
//      SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//        deno run --allow-net --allow-env scripts/dasha-parity.ts \
//          --user <uuid> [--user <uuid> ...]
//
//   B) Local JSON fixtures (no network):
//      deno run --allow-read scripts/dasha-parity.ts \
//        --pair natal.json:dasha.json:+05:30 [--pair ...]
//      Where natal.json is a stored natal chart_jsonb, dasha.json is a stored
//      vimshottari_dasha chart_jsonb, and +05:30 is the birth-profile offset.
//
//   C) Add the §3 reference chart explicitly:
//      --ref-moon 99.58 --ref-birth 1992-06-05T00:35:00+05:30 \
//        --ref-dasha reference-dasha.json
//
// OUTPUT
//   Per year-length variant (365.25, 365.2422, 360.0), a PASS/FAIL table
//   covering: current maha lord + boundaries, current antar lord + boundaries,
//   first 5 maha boundaries, and dasha_balance (lord + duration). Winner =
//   variant with all-PASS across all charts; tiebreak = smallest max delta.
//
// TOLERANCE
//   <= 1 day per boundary. A uniform small offset across every chart is a
//   tuning signal, not a pass — try another yearDays.

import { computeVimshottariDashaPayload } from "../supabase/functions/chart-gateway/vimshottari.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const Deno: any;

// ---- CLI parsing --------------------------------------------------------
type Fixture = {
  label: string;
  natal: unknown;
  dasha: unknown;
  offsetMinutes: number;
  // Ground-truth birth instant. Preferred: from birth_profiles. Fallback for
  // offline --pair mode: reverse-derived from Prokerala's firstMaha.end minus
  // its balance.duration (approximate — do not trust to sub-day precision).
  birthUtcMs?: number;
};

function parseOffset(s: string): number {
  const m = s.match(/^([+-])(\d{2}):(\d{2})$/);
  if (!m) throw new Error(`bad offset: ${s}`);
  return (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3]));
}

async function loadJson(path: string): Promise<unknown> {
  const text = await Deno.readTextFile(path);
  return JSON.parse(text);
}

// ---- Artifact accessors -------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function moonLonFromNatal(natal: any): number {
  const inner = natal?.data ?? natal;
  const arr: unknown[] =
    inner?.planet_position ?? inner?.planetPosition ?? inner?.planets ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const moon = arr.find((p: any) => p?.id === 1 || /moon/i.test(p?.name ?? ""));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lon = Number((moon as any)?.longitude);
  if (!Number.isFinite(lon)) throw new Error("moon longitude missing in natal");
  return ((lon % 360) + 360) % 360;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function periods(dasha: any): any[] {
  const inner = dasha?.data?.data ?? dasha?.data ?? dasha;
  return Array.isArray(inner?.dasha_periods) ? inner.dasha_periods : [];
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function balance(dasha: any): any {
  const inner = dasha?.data?.data ?? dasha?.data ?? dasha;
  return inner?.dasha_balance ?? null;
}

function findCurrent<
  T extends { id: number; name: string; start: string; end: string },
>(arr: T[], now = Date.now()): T | null {
  for (const p of arr) {
    const s = Date.parse(p.start);
    const e = Date.parse(p.end);
    if (Number.isFinite(s) && Number.isFinite(e) && now >= s && now < e) {
      return p;
    }
  }
  return null;
}

// ---- Comparison ---------------------------------------------------------
const DAY_MS = 86_400_000;
function deltaDays(aIso: string, bIso: string): number {
  return Math.abs(Date.parse(aIso) - Date.parse(bIso)) / DAY_MS;
}

type Check = { label: string; delta: number | null; pass: boolean; note?: string };

function compare(
  fx: Fixture,
  yearDays: number,
): { checks: Check[]; maxDelta: number; passed: boolean } {
  const moonSidLon = moonLonFromNatal(fx.natal);
  const proPeriods = periods(fx.dasha);
  const proBalance = balance(fx.dasha);
  if (proPeriods.length === 0) {
    return {
      checks: [{ label: "artifact", delta: null, pass: false, note: "no periods in stored dasha" }],
      maxDelta: Infinity,
      passed: false,
    };
  }

  // Birth anchor: prefer the exact instant from birth_profiles (Fixture.birthUtcMs).
  // Fall back only for offline --pair mode where the row isn't available; that
  // fallback uses parseIsoDurationMs's approximate calendar and can be off by
  // several days for multi-year balances.
  const birthUtcMs =
    fx.birthUtcMs ??
    (Date.parse(proPeriods[0].end) -
      parseIsoDurationMs(proBalance?.duration ?? "P0D"));

  const localPayload = computeVimshottariDashaPayload({
    moonSidLon,
    birthUtcMs,
    offsetMinutes: fx.offsetMinutes,
    yearDays,
  });
  const locPeriods = localPayload.data.dasha_periods;
  const locBalance = localPayload.data.dasha_balance;

  const checks: Check[] = [];

  // 1. First 5 maha boundaries (id + start + end).
  for (let i = 0; i < Math.min(5, proPeriods.length, locPeriods.length); i++) {
    const pro = proPeriods[i];
    const loc = locPeriods[i];
    if (pro.id !== loc.id) {
      checks.push({
        label: `maha[${i}] lord`,
        delta: null,
        pass: false,
        note: `pro=${pro.name}(${pro.id}) loc=${loc.name}(${loc.id})`,
      });
      continue;
    }
    const ds = deltaDays(pro.start, loc.start);
    const de = deltaDays(pro.end, loc.end);
    checks.push({
      label: `maha[${i}] ${pro.name} start`,
      delta: ds,
      pass: ds <= 1,
    });
    checks.push({
      label: `maha[${i}] ${pro.name} end`,
      delta: de,
      pass: de <= 1,
    });
  }

  // 2. Current maha + antar.
  const curProMaha = findCurrent(proPeriods);
  const curLocMaha = findCurrent(locPeriods);
  if (curProMaha && curLocMaha) {
    checks.push({
      label: "current maha lord",
      delta: null,
      pass: curProMaha.id === curLocMaha.id,
      note:
        curProMaha.id === curLocMaha.id
          ? undefined
          : `pro=${curProMaha.name} loc=${curLocMaha.name}`,
    });
    checks.push({
      label: "current maha start",
      delta: deltaDays(curProMaha.start, curLocMaha.start),
      pass: deltaDays(curProMaha.start, curLocMaha.start) <= 1,
    });
    checks.push({
      label: "current maha end",
      delta: deltaDays(curProMaha.end, curLocMaha.end),
      pass: deltaDays(curProMaha.end, curLocMaha.end) <= 1,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const curProAntar = findCurrent((curProMaha as any).antardasha ?? []);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const curLocAntar = findCurrent((curLocMaha as any).antardasha ?? []);
    if (curProAntar && curLocAntar) {
      checks.push({
        label: "current antar lord",
        delta: null,
        pass: curProAntar.id === curLocAntar.id,
        note:
          curProAntar.id === curLocAntar.id
            ? undefined
            : `pro=${curProAntar.name} loc=${curLocAntar.name}`,
      });
      checks.push({
        label: "current antar start",
        delta: deltaDays(curProAntar.start, curLocAntar.start),
        pass: deltaDays(curProAntar.start, curLocAntar.start) <= 1,
      });
      checks.push({
        label: "current antar end",
        delta: deltaDays(curProAntar.end, curLocAntar.end),
        pass: deltaDays(curProAntar.end, curLocAntar.end) <= 1,
      });
    }
  }

  // 3. dasha_balance: lord id + duration (allow <= 1 day drift).
  if (proBalance) {
    const proLordId = proBalance?.lord?.id;
    checks.push({
      label: "balance lord id",
      delta: null,
      pass: proLordId === locBalance.lord.id,
      note:
        proLordId === locBalance.lord.id
          ? undefined
          : `pro=${proBalance?.lord?.name} loc=${locBalance.lord.name}`,
    });
    const proDurMs = parseIsoDurationMs(proBalance?.duration ?? "P0D");
    const locDurMs = parseIsoDurationMs(locBalance.duration);
    const dDays = Math.abs(proDurMs - locDurMs) / DAY_MS;
    checks.push({
      label: "balance duration",
      delta: dDays,
      pass: dDays <= 1,
    });
  }

  const maxDelta = checks.reduce(
    (m, c) => (c.delta != null && c.delta > m ? c.delta : m),
    0,
  );
  const passed = checks.every((c) => c.pass);
  return { checks, maxDelta, passed };
}

// Cheap ISO-8601 duration -> ms. Calendar months treated as 30d, years 365d
// (only used for delta comparison, not date arithmetic).
function parseIsoDurationMs(s: string): number {
  const m = s.match(
    /^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/,
  );
  if (!m) return NaN;
  const y = Number(m[1] ?? 0);
  const mo = Number(m[2] ?? 0);
  const d = Number(m[3] ?? 0);
  const h = Number(m[4] ?? 0);
  const mi = Number(m[5] ?? 0);
  const se = Number(m[6] ?? 0);
  return (
    y * 365 * DAY_MS +
    mo * 30 * DAY_MS +
    d * DAY_MS +
    h * 3600_000 +
    mi * 60_000 +
    se * 1000
  );
}

// ---- Supabase REST loader ----------------------------------------------
async function loadFixturesForUser(
  baseUrl: string,
  serviceKey: string,
  userId: string,
): Promise<Fixture> {
  const headers = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    "content-type": "application/json",
  };
  const natalRes = await fetch(
    `${baseUrl}/rest/v1/chart_artifacts?user_id=eq.${userId}&chart_type=eq.natal&order=created_at.desc&limit=1&select=chart_jsonb`,
    { headers },
  );
  const dashaRes = await fetch(
    `${baseUrl}/rest/v1/chart_artifacts?user_id=eq.${userId}&chart_type=eq.vimshottari_dasha&provider=eq.prokerala&order=created_at.desc&limit=1&select=chart_jsonb`,
    { headers },
  );
  const birthRes = await fetch(
    `${baseUrl}/rest/v1/birth_profiles?user_id=eq.${userId}&select=birth_timezone,birth_date,birth_time,birth_time_known`,
    { headers },
  );
  if (!natalRes.ok || !dashaRes.ok || !birthRes.ok) {
    throw new Error(
      `REST failure: natal=${natalRes.status} dasha=${dashaRes.status} birth=${birthRes.status}`,
    );
  }
  const [natalRows, dashaRows, birthRows] = await Promise.all([
    natalRes.json(),
    dashaRes.json(),
    birthRes.json(),
  ]);
  if (!natalRows[0] || !dashaRows[0] || !birthRows[0]) {
    throw new Error(`missing artifacts for user ${userId}`);
  }
  // Ground truth birth instant, straight from the same row chart-gateway used
  // to hit Prokerala. When birth_time is unknown, chart-gateway defaults to
  // 12:00:00 local — mirror that so the anchor matches what Prokerala received.
  const tz = birthRows[0].birth_timezone || "Asia/Kolkata";
  const birthDate = birthRows[0].birth_date;
  const timeKnown = birthRows[0].birth_time_known !== false;
  const birthTime = timeKnown
    ? (birthRows[0].birth_time ?? "12:00:00").slice(0, 8)
    : "12:00:00";
  const offsetMinutes = tzOffsetMinutesAt(tz, `${birthDate}T${birthTime}`);
  const birthUtcMs =
    Date.parse(`${birthDate}T${birthTime}Z`) - offsetMinutes * 60_000;
  return {
    label: userId.slice(0, 8),
    natal: natalRows[0].chart_jsonb,
    dasha: dashaRows[0].chart_jsonb,
    offsetMinutes,
    birthUtcMs,
  };
}

// Discover user_ids that have BOTH a natal AND a prokerala vimshottari_dasha
// artifact. Returns up to `limit` distinct ids, newest-first by dasha creation.
async function discoverUsersWithBothArtifacts(
  baseUrl: string,
  serviceKey: string,
  limit: number,
): Promise<string[]> {
  const headers = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    "content-type": "application/json",
  };
  // Fetch a generous window of prokerala dasha rows, dedupe client-side,
  // then intersect with the set of user_ids that also have a natal.
  const dashaRes = await fetch(
    `${baseUrl}/rest/v1/chart_artifacts?chart_type=eq.vimshottari_dasha&provider=eq.prokerala&select=user_id&order=created_at.desc&limit=${Math.max(limit * 6, 100)}`,
    { headers },
  );
  if (!dashaRes.ok) {
    throw new Error(`discover dasha REST ${dashaRes.status}`);
  }
  const dashaRows = (await dashaRes.json()) as Array<{ user_id: string }>;
  const seen = new Set<string>();
  const dashaUsers: string[] = [];
  for (const r of dashaRows) {
    if (!seen.has(r.user_id)) {
      seen.add(r.user_id);
      dashaUsers.push(r.user_id);
    }
  }
  const natalRes = await fetch(
    `${baseUrl}/rest/v1/chart_artifacts?chart_type=eq.natal&select=user_id&limit=1000`,
    { headers },
  );
  if (!natalRes.ok) {
    throw new Error(`discover natal REST ${natalRes.status}`);
  }
  const natalRows = (await natalRes.json()) as Array<{ user_id: string }>;
  const natalUsers = new Set(natalRows.map((r) => r.user_id));
  const both: string[] = [];
  for (const u of dashaUsers) {
    if (natalUsers.has(u) && both.length < limit) both.push(u);
  }
  return both;
}

// Extract per-category lord-id match verdicts from the check list produced by
// compare(). A category is "match" if there is NO check whose label ends in
// "lord" or "lord id" for that scope and that failed. Absence of a failing
// lord check == ids agreed at that level.
function lordVerdicts(checks: Check[]): {
  mahaLord: boolean;
  antarLord: boolean;
  balanceLord: boolean;
} {
  let mahaLord = true;
  let antarLord = true;
  let balanceLord = true;
  for (const c of checks) {
    if (!c.pass) {
      if (/^maha\[\d+\] lord$/.test(c.label)) mahaLord = false;
      else if (c.label === "current maha lord") mahaLord = false;
      else if (c.label === "current antar lord") antarLord = false;
      else if (c.label === "balance lord id") balanceLord = false;
    }
  }
  return { mahaLord, antarLord, balanceLord };
}

// IANA timezone offset (minutes) at a given local wall-clock instant.
function tzOffsetMinutesAt(tz: string, localIso: string): number {
  // Treat local wall-clock as UTC to get an approximate anchor, then
  // measure how the tz labels that instant vs UTC — difference = offset.
  const asUtc = Date.parse(localIso + "Z");
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(new Date(asUtc));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g = (t: string) => Number(parts.find((p: any) => p.type === t)?.value);
  const asTz = Date.UTC(
    g("year"),
    g("month") - 1,
    g("day"),
    g("hour") === 24 ? 0 : g("hour"),
    g("minute"),
    g("second"),
  );
  return Math.round((asTz - asUtc) / 60_000);
}

// ---- Main ---------------------------------------------------------------
async function main() {
  const args = Deno.args as string[];
  const fixtures: Fixture[] = [];

  const users: string[] = [];
  const pairs: string[] = [];
  let refMoon: number | null = null;
  let refBirth: string | null = null;
  let refDashaPath: string | null = null;
  let allMode = false;
  let allLimit = 20;
  // If true, floor birthUtcMs to the whole minute before comparing. Tests the
  // hypothesis that Prokerala truncates birth-time to the minute internally.
  let minuteTruncate = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--user") users.push(args[++i]);
    else if (args[i] === "--pair") pairs.push(args[++i]);
    else if (args[i] === "--ref-moon") refMoon = Number(args[++i]);
    else if (args[i] === "--ref-birth") refBirth = args[++i];
    else if (args[i] === "--ref-dasha") refDashaPath = args[++i];
    else if (args[i] === "--all") allMode = true;
    else if (args[i] === "--limit") allLimit = Number(args[++i]);
    else if (args[i] === "--minute-truncate") minuteTruncate = true;
  }

  // --all: discover up to `allLimit` distinct user_ids that have BOTH
  // artifacts, then run the standard comparison at yearDays=365.25 only and
  // print a compact table. No variant bake-off.
  if (allMode) {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) {
      console.error(
        "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for --all",
      );
      Deno.exit(2);
    }
    const discovered = await discoverUsersWithBothArtifacts(url, key, allLimit);
    console.log(
      `discovered ${discovered.length} user(s) with both natal + prokerala dasha artifacts (cap ${allLimit})\n`,
    );
    const rows: Array<{
      label: string;
      loaded: boolean;
      err?: string;
      maha: string;
      antar: string;
      balance: string;
      maxDelta: number;
      passed: boolean;
      flagged: boolean;
    }> = [];
    if (minuteTruncate) {
      console.log("(minute-truncate on: birthUtcMs floored to whole minute)\n");
    }
    for (const uid of discovered) {
      try {
        const fx = await loadFixturesForUser(url, key, uid);
        if (minuteTruncate && fx.birthUtcMs != null) {
          fx.birthUtcMs = Math.floor(fx.birthUtcMs / 60_000) * 60_000;
        }
        const r = compare(fx, 365.25);
        const v = lordVerdicts(r.checks);
        const flagged = !(v.mahaLord && v.antarLord && v.balanceLord);
        rows.push({
          label: uid,
          loaded: true,
          maha: v.mahaLord ? "Y" : "N",
          antar: v.antarLord ? "Y" : "N",
          balance: v.balanceLord ? "Y" : "N",
          maxDelta: r.maxDelta,
          passed: r.passed,
          flagged,
        });
      } catch (e) {
        rows.push({
          label: uid,
          loaded: false,
          err: (e as Error).message,
          maha: "-",
          antar: "-",
          balance: "-",
          maxDelta: 0,
          passed: false,
          flagged: false,
        });
      }
    }
    console.log(
      "user_id                                maha antar bal   maxΔ(d)  status",
    );
    console.log(
      "------------------------------------   ---- ----- ---   -------  ------",
    );
    for (const r of rows) {
      if (!r.loaded) {
        console.log(`${r.label}   -    -     -     -        LOAD-FAIL (${r.err})`);
        continue;
      }
      const status = r.passed
        ? "PASS"
        : r.flagged
          ? "FAIL (lord mismatch)"
          : `FAIL (boundary > 1d)`;
      console.log(
        `${r.label}   ${r.maha}    ${r.antar}     ${r.balance}     ${r.maxDelta.toFixed(3).padStart(6)}   ${status}`,
      );
    }
    const flagged = rows.filter((r) => r.flagged);
    const passed = rows.filter((r) => r.passed).length;
    const worst = rows.reduce((m, r) => (r.maxDelta > m ? r.maxDelta : m), 0);
    console.log(
      `\nSummary: ${passed}/${rows.length} PASS. Worst boundary Δ = ${worst.toFixed(3)} d. Lord-id mismatches: ${flagged.length}.`,
    );
    if (flagged.length) {
      console.log("\nFlagged (lord id differs from Prokerala at some level):");
      for (const r of flagged) {
        console.log(`  ${r.label}  maha=${r.maha} antar=${r.antar} balance=${r.balance}`);
      }
    }
    Deno.exit(flagged.length ? 1 : 0);
  }

  // A) Supabase REST
  if (users.length) {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) {
      console.error(
        "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for --user fixtures",
      );
      Deno.exit(2);
    }
    for (const u of users) {
      try {
        fixtures.push(await loadFixturesForUser(url, key, u));
      } catch (e) {
        console.error(`user ${u}: ${(e as Error).message}`);
      }
    }
  }

  // B) Local JSON pairs
  for (const p of pairs) {
    const [natalPath, dashaPath, offStr] = p.split(":");
    if (!natalPath || !dashaPath || !offStr) {
      console.error(`bad --pair (need natal.json:dasha.json:+05:30): ${p}`);
      continue;
    }
    fixtures.push({
      label: `${natalPath.split("/").pop()}`,
      natal: await loadJson(natalPath),
      dasha: await loadJson(dashaPath),
      offsetMinutes: parseOffset(offStr),
    });
  }

  // C) Reference chart (synthetic natal — only the Moon.longitude is used).
  if (refMoon != null && refBirth && refDashaPath) {
    const dasha = await loadJson(refDashaPath);
    fixtures.push({
      label: "ref-1992-06-05",
      natal: { data: { planet_position: [{ id: 1, name: "Moon", longitude: refMoon }] } },
      dasha,
      offsetMinutes: parseOffset(refBirth.slice(-6)),
    });
  }

  if (fixtures.length === 0) {
    console.error(
      "no fixtures. Pass --user <uuid> or --pair natal.json:dasha.json:+05:30 or --ref-moon/--ref-birth/--ref-dasha.",
    );
    Deno.exit(2);
  }

  const variants = [365.25, 365.2422, 360.0];
  const summary: Array<{
    yearDays: number;
    allPass: boolean;
    maxDelta: number;
    perChart: Array<{ label: string; passed: boolean; maxDelta: number }>;
  }> = [];

  for (const yd of variants) {
    console.log(`\n===== year-length variant: ${yd} days =====`);
    let allPass = true;
    let overallMax = 0;
    const perChart: Array<{ label: string; passed: boolean; maxDelta: number }> = [];
    for (const fx of fixtures) {
      const r = compare(fx, yd);
      overallMax = Math.max(overallMax, r.maxDelta);
      allPass = allPass && r.passed;
      perChart.push({ label: fx.label, passed: r.passed, maxDelta: r.maxDelta });
      console.log(
        `\n  chart ${fx.label}: ${r.passed ? "PASS" : "FAIL"} (max Δ ${r.maxDelta.toFixed(3)} d)`,
      );
      for (const c of r.checks) {
        const tag = c.pass ? "  ok" : "FAIL";
        const d = c.delta != null ? `${c.delta.toFixed(3)}d` : "-";
        const note = c.note ? `  (${c.note})` : "";
        console.log(`    [${tag}] ${c.label.padEnd(24)}  Δ=${d}${note}`);
      }
    }
    summary.push({ yearDays: yd, allPass, maxDelta: overallMax, perChart });
  }

  console.log("\n===== summary =====");
  for (const s of summary) {
    console.log(
      `  yearDays=${s.yearDays.toString().padEnd(9)} allPass=${s.allPass}  maxΔ=${s.maxDelta.toFixed(3)}d`,
    );
  }

  const winners = summary
    .filter((s) => s.allPass)
    .sort((a, b) => a.maxDelta - b.maxDelta);
  if (winners.length) {
    console.log(`\nWINNER: yearDays=${winners[0].yearDays}`);
    Deno.exit(0);
  } else {
    // Uniform-offset guard: if every chart in a variant fails by roughly the
    // same delta, that's a tuning signal, not a pass.
    const near = summary
      .map((s) => ({
        s,
        spread: Math.max(...s.perChart.map((p) => p.maxDelta)) -
                Math.min(...s.perChart.map((p) => p.maxDelta)),
      }))
      .sort((a, b) => a.s.maxDelta - b.s.maxDelta)[0];
    console.log(
      `\nno all-PASS variant. Closest: yearDays=${near.s.yearDays}  maxΔ=${near.s.maxDelta.toFixed(3)}d  spread=${near.spread.toFixed(3)}d`,
    );
    console.log(
      near.spread < 0.5
        ? "Small spread across charts — try another yearDays or revisit ayanamsa."
        : "Deltas vary per chart — likely a real algorithm issue, not a year-length tune.",
    );
    Deno.exit(1);
  }
}

if (import.meta.main) {
  await main();
}
