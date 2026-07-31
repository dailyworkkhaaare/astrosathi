// capture-kaalsarp.ts — throwaway Prokerala kaal-sarp capture.
//
// Fetches Prokerala's raw kaal_sarp_dosha response for a hard-coded list of
// synthetic births (the forward positives + one reverse from --find-kaalsarp).
// Purpose: capture the real `type`, `dosha_type`, `has_dosha`, `description`
// so we can port the positive-side template into supabase/functions/chart-
// gateway/kaalsarp.ts before we flip the default.
//
// Zero side effects: no chart_artifacts row, no astrology_provider_runs row,
// no app profile. Runs directly against Prokerala with client_credentials.
//
// Env required:
//   PROKERALA_CLIENT_ID
//   PROKERALA_CLIENT_SECRET
//
// Usage:
//   set -a && . ./.env && set +a &&
//     deno run --allow-net --allow-env scripts/capture-kaalsarp.ts

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const Deno: any;

type Birth = {
  label: string;
  datetime: string; // ISO-8601 with offset, e.g. "1901-12-10T12:00:00+05:30"
  coordinates: string; // "lat,lon"
  kind: "forward" | "reverse";
  expectedRahuHouse?: number;
};

// From scripts/doshas-parity.ts --find-kaalsarp sweep (Delhi 28.6139N/77.2090E,
// 06:30 IST). Distinct forward rahu-houses picked to validate the flavor map.
// Convert each UTC probe to the birth-tz offset for Prokerala. 06:30 UTC at
// +05:30 = 12:00 local, well inside any daytime cutoff.
const BIRTHS: Birth[] = [
  {
    label: "forward#1_rahuHouse9",
    datetime: "1901-12-10T12:00:00+05:30",
    coordinates: "28.6139,77.2090",
    kind: "forward",
    expectedRahuHouse: 9,
  },
  {
    label: "forward#2_rahuHouse8",
    datetime: "1902-01-06T12:00:00+05:30",
    coordinates: "28.6139,77.2090",
    kind: "forward",
    expectedRahuHouse: 8,
  },
  {
    label: "forward#3_rahuHouse7",
    datetime: "1902-01-15T12:00:00+05:30",
    coordinates: "28.6139,77.2090",
    kind: "forward",
    expectedRahuHouse: 7,
  },
  {
    label: "reverse#1_rahuHouse3",
    datetime: "1906-02-23T12:00:00+05:30",
    coordinates: "28.6139,77.2090",
    kind: "reverse",
    expectedRahuHouse: 3,
  },
];

async function getToken(id: string, secret: string): Promise<string> {
  const res = await fetch("https://api.prokerala.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: id,
      client_secret: secret,
    }).toString(),
  });
  if (!res.ok) throw new Error(`token ${res.status}: ${await res.text()}`);
  const j = (await res.json()) as { access_token?: string };
  if (!j.access_token) throw new Error("no access_token in response");
  return j.access_token;
}

async function fetchKaalSarp(
  token: string,
  b: Birth,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  const params = new URLSearchParams({
    ayanamsa: "1",
    coordinates: b.coordinates,
    datetime: b.datetime,
    la: "en",
  });
  const url = `https://api.prokerala.com/v2/astrology/kaal-sarp-dosha?${params.toString()}`;
  const res = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  const text = await res.text();
  if (!res.ok) {
    return { _http: res.status, _error: text };
  }
  try {
    return JSON.parse(text);
  } catch {
    return { _http: res.status, _raw: text };
  }
}

async function main() {
  const id = Deno.env.get("PROKERALA_CLIENT_ID");
  const secret = Deno.env.get("PROKERALA_CLIENT_SECRET");
  if (!id || !secret) {
    console.error(
      "PROKERALA_CLIENT_ID and PROKERALA_CLIENT_SECRET must be set (append to .env).",
    );
    Deno.exit(2);
  }
  const token = await getToken(id, secret);
  console.log(`token ok (${token.slice(0, 12)}...)\n`);
  for (const b of BIRTHS) {
    console.log("=".repeat(72));
    console.log(`${b.label}  (${b.kind}, expected rahuHouse=${b.expectedRahuHouse})`);
    console.log(`  datetime=${b.datetime}  coordinates=${b.coordinates}`);
    try {
      const resp = await fetchKaalSarp(token, b);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = (resp as any)?.data ?? resp;
      console.log("data =", JSON.stringify(data, null, 2));
    } catch (e) {
      console.log("ERROR:", (e as Error).message);
    }
  }
}

await main();
