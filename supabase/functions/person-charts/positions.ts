// Local sidereal positions engine — EXTRACTED VERBATIM from chart-gateway
// (astronomy-engine, Lahiri/Chitrapaksha ayanamsa, Parasara). Copied here so
// person-charts is self-contained and NEVER imports from / mutates the drifted
// chart-gateway backbone. Keep the constants and math byte-identical to the
// gateway so a saved person's charts match the app's own charts exactly.
//
// Validated (in gateway) 2026-07-28 against 4 reference charts to <0.01 deg.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const Deno: any;

export const SWISS_ENGINE_VERSION = "astronomy-engine@2.1.19+lahiri-v1";
const AYANAMSA_J2000 = 23.85292; // Lahiri ayanamsa at J2000.0 (degrees)

export const ENG_SIGNS = [
  "Aries",
  "Taurus",
  "Gemini",
  "Cancer",
  "Leo",
  "Virgo",
  "Libra",
  "Scorpio",
  "Sagittarius",
  "Capricorn",
  "Aquarius",
  "Pisces",
];
// Sign lords (Parasara), 0 = Aries .. 11 = Pisces.
const ENG_SIGN_LORDS = [
  "Mars",
  "Venus",
  "Mercury",
  "Moon",
  "Sun",
  "Mercury",
  "Venus",
  "Mars",
  "Jupiter",
  "Saturn",
  "Saturn",
  "Jupiter",
];

const eNorm360 = (x: number): number => ((x % 360) + 360) % 360;
const eNorm180 = (x: number): number => {
  const v = eNorm360(x);
  return v > 180 ? v - 360 : v;
};
const eD2r = (d: number): number => (d * Math.PI) / 180;
const eR2d = (r: number): number => (r * 180) / Math.PI;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function eJulianCenturiesTT(A: any, date: Date): number {
  return A.MakeTime(date).tt / 36525;
}
function ePrecessionSinceJ2000(T: number): number {
  return 1.3969713 * T + 0.0003086 * T * T;
}
function eAyanamsaDeg(T: number): number {
  return AYANAMSA_J2000 + ePrecessionSinceJ2000(T);
}
function eMeanObliquity(T: number): number {
  return 23.4392911 - 0.0130041667 * T - 1.638889e-7 * T * T + 5.036111e-7 * T * T * T;
}
// astronomy-engine Ecliptic() returns ecliptic-of-date longitude, so we subtract
// the of-date ayanamsa for EVERY body (validated fix).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function eEclipticLonOfDate(A: any, body: any, date: Date, aberration: boolean): number {
  const vec = A.GeoVector(body, date, aberration);
  const ecl = A.Ecliptic(vec);
  return eNorm360(ecl.elon);
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function eSiderealLonOfBody(A: any, body: any, date: Date, aberration: boolean, T: number): number {
  return eNorm360(eEclipticLonOfDate(A, body, date, aberration) - eAyanamsaDeg(T));
}
function eMeanNodeOfDate(T: number): number {
  const om =
    125.0445479 -
    1934.1362891 * T +
    0.0020754 * T * T +
    (T * T * T) / 467441 -
    (T * T * T * T) / 60616000;
  return eNorm360(om);
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function eIsRetrograde(A: any, body: any, date: Date, aberration: boolean): boolean {
  const l1 = eEclipticLonOfDate(A, body, date, aberration);
  const later = new Date(date.getTime() + 3600 * 1000);
  const l2 = eEclipticLonOfDate(A, body, later, aberration);
  return eNorm180(l2 - l1) < 0;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function eSiderealAscendant(A: any, date: Date, latDeg: number, lonDeg: number, T: number): number {
  const gastHours = A.SiderealTime(date); // Greenwich apparent sidereal time (hours)
  const ramc = eNorm360(gastHours * 15 + lonDeg);
  const eps = eMeanObliquity(T);
  const R = eD2r(ramc);
  const E = eD2r(eps);
  const P = eD2r(latDeg);
  const mc = eNorm360(eR2d(Math.atan2(Math.sin(R), Math.cos(R) * Math.cos(E))));
  let asc = eNorm360(
    eR2d(Math.atan2(Math.cos(R), -(Math.sin(R) * Math.cos(E) + Math.tan(P) * Math.sin(E)))),
  );
  // Keep the ascendant on the eastern horizon (MC-based 180 deg guard).
  if (eNorm360(asc - mc) > 180) asc = eNorm360(asc + 180);
  return eNorm360(asc - eAyanamsaDeg(T));
}

// Build one Prokerala-shaped body entry from a sidereal longitude.
function eBody(id: number, name: string, sidLon: number, retro: boolean) {
  const L = eNorm360(sidLon);
  const signIndex = Math.floor(L / 30);
  const degInSign = L - signIndex * 30;
  return {
    id,
    name,
    longitude: L,
    degree: degInSign,
    is_retrograde: retro,
    position: signIndex + 1,
    rasi: {
      id: signIndex,
      name: ENG_SIGNS[signIndex],
      lord: {
        name: ENG_SIGN_LORDS[signIndex],
        vedic_name: ENG_SIGN_LORDS[signIndex],
      },
    },
  };
}

// Compute a natal planet-position payload in the exact shape Prokerala returns,
// so it is a drop-in for the web app (charts.ts normalizers).
export async function computeNatalPayload(
  datetimeUsed: string,
  lat: number,
  lon: number,
): Promise<unknown> {
  // Dynamic import isolates any load failure to this call.
  // @ts-ignore esm.sh import resolved at deploy/runtime
  const A: any = await import("https://esm.sh/astronomy-engine@2.1.19");
  const date = new Date(datetimeUsed);
  if (Number.isNaN(date.getTime())) {
    throw new Error("invalid datetime for swiss engine");
  }
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
  // Rahu (mean node, always retrograde) + Ketu (opposite).
  const rahu = eNorm360(eMeanNodeOfDate(T) - eAyanamsaDeg(T));
  planet_position.push(eBody(101, "Rahu", rahu, true));
  planet_position.push(eBody(102, "Ketu", eNorm360(rahu + 180), true));
  // Ascendant (Lagna).
  const asc = eSiderealAscendant(A, date, lat, lon, T);
  planet_position.push(eBody(100, "Ascendant", asc, false));

  return {
    status: "ok",
    provider: "astronomy-engine",
    provider_version: SWISS_ENGINE_VERSION,
    ayanamsa: "lahiri",
    system: "parashara",
    computed_utc: date.toISOString(),
    data: { planet_position },
  };
}

// ---------- Deterministic hashing (copied from chart-gateway) ----------

export async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Canonical JSON with sorted keys (deterministic).
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return "[" + value.map(canonicalJson).join(",") + "]";
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonicalJson(obj[k])).join(",") + "}";
}

// ---------- Timezone-aware ISO builder (copied from chart-gateway) ----------

function tzOffsetMinutes(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(date).reduce<Record<string, string>>((acc, p) => {
    if (p.type !== "literal") acc[p.type] = p.value;
    return acc;
  }, {});
  const asUTC = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour === "24" ? "00" : parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return Math.round((asUTC - date.getTime()) / 60_000);
}

// Build IANA-timezone-aware ISO-8601 string with offset, from a local
// (date, time, tz) triple.
export function isoWithOffset(dateStr: string, timeStr: string, timeZone: string): string {
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
