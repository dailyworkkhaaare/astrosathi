// varga-parity.ts — offline parity/QA for the local Divisional (Shodasavarga)
// engine at supabase/functions/chart-gateway/varga.ts.
//
// PURPOSE
//   Prove that computeVarga() reproduces every user's stored chart_facts
//   BEFORE we wire the gateway or the renderer to it. Zero Prokerala spend:
//   reads already-stored natal + chart_facts rows.
//
// USAGE
//   --all [--limit N]     compare all 16 vargas across all users (default 20)
//   --user <uuid>         limit to a single user
//   --varga D9,D30        limit to specific varga(s), comma-separated
//   --verbose             per-body mismatch dump on failure
//
//   Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//
// HARD gate: asc_sign + every body's sign must match for every varga.
// (house is derived from those two; we check it too as a sanity signal.)

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

// ---- REST helpers -------------------------------------------------------
async function fetchJson(url: string, headers: Record<string, string>) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`REST ${res.status} ${url}`);
  return await res.json();
}

type StoredFact = {
  chart_type: string;
  asc_sign: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  positions: Array<{ key: string; sign: number; house: number }>;
};

type Provenance = {
  input_hash: string | null;
  created_at: string | null;
  provider: string | null;
};

type Fixture = {
  userId: string;
  natal: unknown;
  natalProv: Provenance | null;
  facts: Map<string, StoredFact>; // keyed by chart_type enum
  // provenance of any varga chart_artifact per enum (nullable — some vargas
  // may only exist as chart_facts if the artifact was culled). Used only for
  // the "different generations?" diagnostic.
  vargaProv: Map<string, Provenance>;
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
    `${baseUrl}/rest/v1/chart_artifacts?user_id=eq.${userId}&chart_type=eq.natal&order=created_at.desc&limit=1&select=chart_jsonb,input_hash,created_at,provider`,
    headers,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  )) as any[];
  if (!natalRows[0]) throw new Error(`no natal for ${userId}`);
  const natalRow = natalRows[0];

  const enums = Object.values(VARGA_TO_ENUM);
  const inList = enums.map((e) => `"${e}"`).join(",");
  const factRows = (await fetchJson(
    `${baseUrl}/rest/v1/chart_facts?user_id=eq.${userId}&chart_type=in.(${inList})&select=chart_type,asc_sign,positions`,
    headers,
  )) as StoredFact[];
  const facts = new Map<string, StoredFact>();
  for (const r of factRows) facts.set(r.chart_type, r);

  // Provenance for each varga chart_artifact (newest per enum), to compare
  // against the natal artifact's snapshot.
  const artifactRows = (await fetchJson(
    `${baseUrl}/rest/v1/chart_artifacts?user_id=eq.${userId}&chart_type=in.(${inList})&order=created_at.desc&select=chart_type,input_hash,created_at,provider`,
    headers,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  )) as any[];
  const vargaProv = new Map<string, Provenance>();
  for (const r of artifactRows) {
    if (!vargaProv.has(r.chart_type)) {
      vargaProv.set(r.chart_type, {
        input_hash: r.input_hash ?? null,
        created_at: r.created_at ?? null,
        provider: r.provider ?? null,
      });
    }
  }

  return {
    userId,
    natal: natalRow.chart_jsonb,
    natalProv: {
      input_hash: natalRow.input_hash ?? null,
      created_at: natalRow.created_at ?? null,
      provider: natalRow.provider ?? null,
    },
    facts,
    vargaProv,
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
  const factRows = (await fetchJson(
    `${baseUrl}/rest/v1/chart_facts?select=user_id&limit=2000`,
    headers,
  )) as Array<{ user_id: string }>;
  const seen = new Set<string>();
  const list: string[] = [];
  for (const r of factRows) {
    if (!seen.has(r.user_id)) {
      seen.add(r.user_id);
      list.push(r.user_id);
    }
  }
  const natalRows = (await fetchJson(
    `${baseUrl}/rest/v1/chart_artifacts?chart_type=eq.natal&select=user_id&limit=2000`,
    headers,
  )) as Array<{ user_id: string }>;
  const natal = new Set(natalRows.map((r) => r.user_id));
  const both: string[] = [];
  for (const u of list) if (natal.has(u) && both.length < limit) both.push(u);
  return both;
}

// ---- Comparison ---------------------------------------------------------
type VargaCmp = {
  ok: boolean;
  ascOk: boolean;
  signMismatches: Array<{ key: string; pro: number; loc: number }>;
  houseMismatches: Array<{ key: string; pro: number; loc: number }>;
  missingLocal: string[];
  missingStored: string[];
  ascPro: number;
  ascLoc: number;
};

function compareVarga(stored: StoredFact, natal: unknown, D: VargaKey): VargaCmp {
  const local = computeVarga(natal, D);
  const cmp: VargaCmp = {
    ok: true,
    ascOk: Number(stored.asc_sign) === local.asc_sign,
    signMismatches: [],
    houseMismatches: [],
    missingLocal: [],
    missingStored: [],
    ascPro: Number(stored.asc_sign),
    ascLoc: local.asc_sign,
  };
  if (!cmp.ascOk) cmp.ok = false;

  const storedByKey = new Map<string, { sign: number; house: number }>();
  for (const p of stored.positions ?? []) {
    storedByKey.set(String(p.key), { sign: Number(p.sign), house: Number(p.house) });
  }
  const localByKey = new Map<string, { sign: number; house: number }>();
  for (const p of local.positions) {
    localByKey.set(p.key, { sign: p.sign, house: p.house });
  }

  for (const k of BODY_KEYS) {
    const s = storedByKey.get(k);
    const l = localByKey.get(k);
    if (!s && !l) continue;
    if (!s) {
      cmp.missingStored.push(k);
      continue;
    }
    if (!l) {
      cmp.missingLocal.push(k);
      cmp.ok = false;
      continue;
    }
    if (s.sign !== l.sign) {
      cmp.signMismatches.push({ key: k, pro: s.sign, loc: l.sign });
      cmp.ok = false;
    }
    if (s.house !== l.house) {
      cmp.houseMismatches.push({ key: k, pro: s.house, loc: l.house });
      // house is derived from sign+asc_sign; a house-only mismatch means
      // stored data has an inconsistency, not a formula failure.
    }
  }
  return cmp;
}

// ---- Main ---------------------------------------------------------------
type Args = {
  limit: number;
  wantAll: boolean;
  user: string | null;
  vargas: VargaKey[];
  verbose: boolean;
};

function parseArgs(argv: string[]): Args {
  const out: Args = {
    limit: 20,
    wantAll: false,
    user: null,
    vargas: [...VARGAS],
    verbose: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--all") out.wantAll = true;
    else if (a === "--limit") out.limit = Number(argv[++i]);
    else if (a === "--user") out.user = String(argv[++i]);
    else if (a === "--verbose") out.verbose = true;
    else if (a === "--varga") {
      const vs = String(argv[++i]).split(",").map((s) => s.trim().toUpperCase()) as VargaKey[];
      out.vargas = vs.filter((v): v is VargaKey => (VARGAS as string[]).includes(v));
    }
  }
  return out;
}

async function main() {
  const args = parseArgs(Deno.args as string[]);
  if (!args.wantAll && !args.user) {
    console.error("usage: --all [--limit N] | --user <uuid> [--varga D1,D9,...] [--verbose]");
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
  console.log(
    `parity: ${users.length} user(s) x ${args.vargas.length} varga(s)\n`,
  );

  // Matrix: users on rows, vargas on cols. Cell = "OK" / "FAIL(n)" / "-".
  const header =
    "user_id                                 " +
    args.vargas.map((v) => v.padEnd(6)).join("") +
    " pass";
  const sep =
    "--------------------------------------  " +
    args.vargas.map(() => "----- ").join("") +
    " ----";
  console.log(header);
  console.log(sep);

  // Per-varga rollups: pass / total across users where fact row exists.
  const perVarga = new Map<VargaKey, { pass: number; total: number }>();
  for (const v of args.vargas) perVarga.set(v, { pass: 0, total: 0 });

  // Failing details for later report.
  const failureDetail: string[] = [];

  // Per-user rollup: which vargas failed for each user.
  type UserRoll = {
    pass: number;
    total: number;
    failed: string[]; // varga keys that failed
    hasAny: boolean;
  };
  const perUser = new Map<string, UserRoll>();

  // Body-level detail for D1 and D2: one row per mismatch, so we can see if
  // the natal payload disagrees with chart_facts on the fundamentals.
  type BodyRow = {
    userId: string;
    varga: "D1" | "D2";
    body: string;
    natalLon: number | null;
    natalRasiId: number | null;
    computedSign: number;
    factsSign: number;
  };
  const bodyRows: BodyRow[] = [];

  // Fixtures kept for the post-loop provenance dump on failing users.
  const fixturesByUser = new Map<string, Fixture>();

  // Utility to pull a body's raw longitude + rasi.id straight out of the
  // natal payload (Prokerala shape). Returns nulls if the body isn't found
  // or the field is missing.
  const natalBodyRaw = (
    natal: unknown,
    bodyKey: string,
  ): { lon: number | null; rasiId: number | null } => {
    // deno-lint-ignore no-explicit-any
    const inner: any = (natal as any)?.data ?? natal;
    const arr: unknown[] = Array.isArray(inner?.planet_position)
      ? inner.planet_position
      : Array.isArray(inner?.planets)
        ? inner.planets
        : [];
    const idOfKey: Record<string, number> = {
      sun: 0, moon: 1, mercury: 2, venus: 3, mars: 4,
      jupiter: 5, saturn: 6, rahu: 101, ketu: 102,
    };
    const wantId = idOfKey[bodyKey];
    for (const p of arr) {
      // deno-lint-ignore no-explicit-any
      const pp = p as any;
      const id = Number(pp?.id);
      const name = String(pp?.name ?? pp?.planet ?? "").trim().toLowerCase();
      const match =
        (Number.isFinite(id) && id === wantId) ||
        name === bodyKey ||
        (bodyKey === "mars" && (name === "mangal" || name === "kuja")) ||
        (bodyKey === "mercury" && (name === "budh" || name === "budha")) ||
        (bodyKey === "jupiter" && (name === "guru" || name === "brihaspati")) ||
        (bodyKey === "venus" && name === "shukra") ||
        (bodyKey === "saturn" && name === "shani") ||
        (bodyKey === "sun" && name === "surya") ||
        (bodyKey === "moon" && name === "chandra");
      if (!match) continue;
      const lonRaw = pp?.longitude ?? pp?.long ?? pp?.lon;
      const lon = Number.isFinite(Number(lonRaw)) ? Number(lonRaw) : null;
      const ridRaw = pp?.rasi?.id;
      const rid = Number.isFinite(Number(ridRaw)) ? Number(ridRaw) : null;
      return { lon, rasiId: rid };
    }
    return { lon: null, rasiId: null };
  };

  for (const uid of users) {
    let fx: Fixture;
    try {
      fx = await loadUserFixture(url, key, uid);
    } catch (e) {
      console.log(`${uid.padEnd(38)} ${String(e)}`);
      continue;
    }
    fixturesByUser.set(uid, fx);
    const cells: string[] = [];
    let userPass = 0;
    let userTotal = 0;
    const userFailedVargas: string[] = [];

    for (const V of args.vargas) {
      const enumType = VARGA_TO_ENUM[V];
      const stored = fx.facts.get(enumType);
      if (!stored) {
        cells.push("-    ".padEnd(6));
        continue;
      }
      userTotal++;
      let cmp: VargaCmp;
      try {
        cmp = compareVarga(stored, fx.natal, V);
      } catch (e) {
        cells.push("ERR  ".padEnd(6));
        failureDetail.push(`${uid} ${V}: throw ${String(e)}`);
        perVarga.get(V)!.total++;
        continue;
      }
      const r = perVarga.get(V)!;
      r.total++;
      if (cmp.ok) {
        r.pass++;
        userPass++;
        cells.push("ok   ".padEnd(6));
      } else {
        cells.push("FAIL ".padEnd(6));
        userFailedVargas.push(V);
        const bits: string[] = [];
        if (!cmp.ascOk) bits.push(`asc ${cmp.ascPro}->${cmp.ascLoc}`);
        for (const m of cmp.signMismatches) bits.push(`${m.key} ${m.pro}->${m.loc}`);
        if (cmp.missingLocal.length) bits.push(`missing-local[${cmp.missingLocal.join(",")}]`);
        failureDetail.push(`${uid} ${V}: ${bits.join(", ")}`);

        if (V === "D1" || V === "D2") {
          // Ascendant row (if it drifted).
          if (!cmp.ascOk) {
            bodyRows.push({
              userId: uid, varga: V, body: "ascendant",
              natalLon: (() => {
                // deno-lint-ignore no-explicit-any
                const inner: any = (fx.natal as any)?.data ?? fx.natal;
                const arr: unknown[] = Array.isArray(inner?.planet_position)
                  ? inner.planet_position : [];
                // deno-lint-ignore no-explicit-any
                const p = arr.find((x: any) => Number(x?.id) === 100) as any;
                const l = Number(p?.longitude);
                return Number.isFinite(l) ? l : null;
              })(),
              natalRasiId: (() => {
                // deno-lint-ignore no-explicit-any
                const inner: any = (fx.natal as any)?.data ?? fx.natal;
                const arr: unknown[] = Array.isArray(inner?.planet_position)
                  ? inner.planet_position : [];
                // deno-lint-ignore no-explicit-any
                const p = arr.find((x: any) => Number(x?.id) === 100) as any;
                const r = Number(p?.rasi?.id);
                return Number.isFinite(r) ? r : null;
              })(),
              computedSign: cmp.ascLoc,
              factsSign: cmp.ascPro,
            });
          }
          // Each body mismatch → one row.
          for (const m of cmp.signMismatches) {
            const raw = natalBodyRaw(fx.natal, m.key);
            bodyRows.push({
              userId: uid, varga: V, body: m.key,
              natalLon: raw.lon,
              natalRasiId: raw.rasiId,
              computedSign: m.loc,
              factsSign: m.pro,
            });
          }
        }
      }
    }
    const pass = `${userPass}/${userTotal}`;
    console.log(`${uid.padEnd(38)}  ${cells.join("")} ${pass}`);
    perUser.set(uid, {
      pass: userPass,
      total: userTotal,
      failed: userFailedVargas,
      hasAny: userFailedVargas.length > 0,
    });
  }

  // Per-varga rollup.
  console.log("\nper-varga pass rate:");
  let overallPass = 0;
  let overallTotal = 0;
  for (const V of args.vargas) {
    const r = perVarga.get(V)!;
    overallPass += r.pass;
    overallTotal += r.total;
    const pct = r.total ? ((100 * r.pass) / r.total).toFixed(1) : "n/a";
    const badge = r.total === 0 ? "-" : r.pass === r.total ? "PASS" : "FAIL";
    console.log(`  ${V.padEnd(4)}  ${String(r.pass).padStart(3)}/${String(r.total).padEnd(3)}  ${pct.padStart(5)}%  ${badge}`);
  }
  const overallPct = overallTotal ? ((100 * overallPass) / overallTotal).toFixed(1) : "n/a";
  console.log(`\noverall: ${overallPass}/${overallTotal}  ${overallPct}%`);

  // ---- Diagnostic 1: per-user pass rate + failing vargas -----------------
  console.log("\nper-user pass rate (users with any failure):");
  const failingUsers = [...perUser.entries()]
    .filter(([, r]) => r.hasAny)
    .sort((a, b) => a[1].pass / a[1].total - b[1].pass / b[1].total);
  if (!failingUsers.length) {
    console.log("  (none)");
  } else {
    for (const [uid, r] of failingUsers) {
      const pct = r.total ? ((100 * r.pass) / r.total).toFixed(1) : "n/a";
      console.log(
        `  ${uid}  ${String(r.pass).padStart(2)}/${String(r.total).padEnd(2)}  ${pct.padStart(5)}%  fail: [${r.failed.join(",")}]`,
      );
    }
  }

  // ---- Diagnostic 2: D1/D2 body-level rows -------------------------------
  console.log(
    "\nD1/D2 body-level mismatches (natal_lon | natal_rasi_id | computed_sign | chart_facts_sign):",
  );
  if (!bodyRows.length) {
    console.log("  (none)");
  } else {
    console.log(
      "  user_id                                | varga | body      | natal_lon      | rasi_id | computed | facts",
    );
    for (const b of bodyRows) {
      const lon = b.natalLon != null ? b.natalLon.toFixed(6) : "null";
      const rid = b.natalRasiId != null ? String(b.natalRasiId) : "null";
      console.log(
        `  ${b.userId} | ${b.varga.padEnd(4)}  | ${b.body.padEnd(9)} | ${lon.padStart(14)} | ${rid.padStart(7)} | ${String(b.computedSign).padStart(8)} | ${String(b.factsSign).padStart(5)}`,
      );
    }
  }

  // ---- Diagnostic 3: provenance for every user with a failure ------------
  console.log(
    "\nprovenance for users with any failure (natal artifact vs. one failing varga artifact):",
  );
  if (!failingUsers.length) {
    console.log("  (none)");
  } else {
    console.log(
      "  user_id                                | kind          | chart_type              | provider    | created_at                    | input_hash",
    );
    for (const [uid, r] of failingUsers) {
      const fx = fixturesByUser.get(uid);
      if (!fx) continue;
      const np = fx.natalProv;
      console.log(
        `  ${uid} | ${"natal".padEnd(13)} | ${"natal".padEnd(23)} | ${(np?.provider ?? "?").padEnd(11)} | ${(np?.created_at ?? "?").padEnd(29)} | ${np?.input_hash ?? "?"}`,
      );
      // Pick one failing varga that has an artifact row; if none has an
      // artifact, note that explicitly (chart_facts existed but the source
      // artifact was culled — a separate provenance signal).
      let picked: { V: string; enumType: string; prov: Provenance } | null = null;
      for (const V of r.failed) {
        const en = VARGA_TO_ENUM[V as VargaKey];
        const prov = fx.vargaProv.get(en);
        if (prov) {
          picked = { V, enumType: en, prov };
          break;
        }
      }
      if (picked) {
        console.log(
          `  ${uid} | ${("failing " + picked.V).padEnd(13)} | ${picked.enumType.padEnd(23)} | ${(picked.prov.provider ?? "?").padEnd(11)} | ${(picked.prov.created_at ?? "?").padEnd(29)} | ${picked.prov.input_hash ?? "?"}`,
        );
        const sameHash =
          np?.input_hash != null &&
          picked.prov.input_hash != null &&
          np.input_hash === picked.prov.input_hash;
        console.log(
          `  ${uid} | ${"drift?".padEnd(13)} | input_hash_match=${sameHash}  natal->varga_seconds=${
            np?.created_at && picked.prov.created_at
              ? Math.round(
                (Date.parse(picked.prov.created_at) - Date.parse(np.created_at)) / 1000,
              )
              : "?"
          }`,
        );
      } else {
        console.log(
          `  ${uid} | ${"failing " + r.failed[0]} | (no chart_artifact row for any failing varga — facts came from a prior artifact that has since been superseded)`,
        );
      }
    }
  }

  if (args.verbose && failureDetail.length) {
    console.log("\nfailure detail:");
    for (const line of failureDetail) console.log(`  ${line}`);
  } else if (failureDetail.length) {
    console.log(`\n${failureDetail.length} failure(s). rerun with --verbose for details.`);
  }

  Deno.exit(overallPass === overallTotal ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  Deno.exit(1);
});
