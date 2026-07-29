// Deterministic panchang math from sidereal Sun/Moon longitudes.
// Sidereal is correct here: tithi uses (moon - sun) so ayanamsa cancels, and
// Vedic (nirayana) yoga uses the sidereal sum. Nakshatra names come from
// NAKSHATRAS in charts.ts. No external API, no AI — pure arithmetic.

export const TITHI_NAMES = [
  "Pratipada", "Dwitiya", "Tritiya", "Chaturthi", "Panchami",
  "Shashthi", "Saptami", "Ashtami", "Navami", "Dashami",
  "Ekadashi", "Dwadashi", "Trayodashi", "Chaturdashi", "Purnima",
] as const;

export const YOGA_NAMES = [
  "Vishkambha", "Priti", "Ayushman", "Saubhagya", "Shobhana",
  "Atiganda", "Sukarma", "Dhriti", "Shula", "Ganda",
  "Vriddhi", "Dhruva", "Vyaghata", "Harshana", "Vajra",
  "Siddhi", "Vyatipata", "Variyana", "Parigha", "Shiva",
  "Siddha", "Sadhya", "Shubha", "Shukla", "Brahma",
  "Indra", "Vaidhriti",
] as const;

// 7 movable (chara) karanas; the 4 fixed (sthira) karanas are handled inline.
export const KARANA_MOVABLE = [
  "Bava", "Balava", "Kaulava", "Taitila", "Gara", "Vanija", "Vishti",
] as const;

// Vara (weekday) names, indexed 0=Sunday .. 6=Saturday.
export const VARA_NAMES = [
  "Ravivara", "Somavara", "Mangalavara", "Budhavara",
  "Guruvara", "Shukravara", "Shanivara",
] as const;

const norm360 = (d: number) => ((d % 360) + 360) % 360;

export type PakshaKey = "shukla" | "krishna";

export type PanchangResult = {
  tithiIndex: number; // 0..29
  tithiName: string; // "Panchami" / "Purnima" / "Amavasya"
  tithiNumber: number; // 1..15 within the paksha
  paksha: PakshaKey; // waxing / waning half
  yogaIndex: number; // 0..26
  yogaName: string;
  karanaIndex: number; // 0..59 half-tithis in the lunar month
  karanaName: string;
  nakshatraIndex: number; // 0..26 from Moon's sidereal longitude
  nakshatraPada: number; // 1..4 quarter within the nakshatra
};

export function computePanchang(sunLon: number, moonLon: number): PanchangResult {
  const elong = norm360(moonLon - sunLon);
  const tithiIndex = Math.floor(elong / 12); // 0..29
  const paksha: PakshaKey = tithiIndex < 15 ? "shukla" : "krishna";
  const withinHalf = tithiIndex % 15; // 0..14
  let tithiName: string = TITHI_NAMES[withinHalf];
  if (tithiIndex === 29) tithiName = "Amavasya"; // new moon
  const tithiNumber = withinHalf + 1; // 1..15

  const yogaIndex = Math.floor(norm360(sunLon + moonLon) / (360 / 27)); // 0..26
  const yogaName = YOGA_NAMES[yogaIndex] ?? "";

  // Karana: 60 half-tithis per lunar month (each = 6 deg of elongation).
  // n=0 -> Kimstughna; n=1..56 -> 8 cycles of the 7 movable karanas;
  // n=57 -> Shakuni, n=58 -> Chatushpada, n=59 -> Naga.
  const karanaIndex = Math.floor(elong / 6); // 0..59
  let karanaName: string;
  if (karanaIndex === 0) karanaName = "Kimstughna";
  else if (karanaIndex === 57) karanaName = "Shakuni";
  else if (karanaIndex === 58) karanaName = "Chatushpada";
  else if (karanaIndex === 59) karanaName = "Naga";
  else karanaName = KARANA_MOVABLE[(karanaIndex - 1) % 7];

  // Nakshatra index + pada from the Moon's sidereal longitude.
  const NAK_ARC = 360 / 27; // 13deg20' per nakshatra
  const moonSid = norm360(moonLon);
  const nakshatraIndex = Math.floor(moonSid / NAK_ARC); // 0..26
  const nakshatraPada = Math.floor((moonSid % NAK_ARC) / (NAK_ARC / 4)) + 1; // 1..4

  return {
    tithiIndex, tithiName, tithiNumber, paksha,
    yogaIndex, yogaName,
    karanaIndex, karanaName,
    nakshatraIndex, nakshatraPada,
  };
}

// ---- Step B: Sunrise / Sunset / Rahu Kaal (no API, ~±5 min accuracy) ----
const RAD = Math.PI / 180

function gregorianToJDN(y: number, m: number, d: number): number {
  const a = Math.floor((14 - m) / 12)
  const yy = y + 4800 - a
  const mm = m + 12 * a - 3
  return (
    d + Math.floor((153 * mm + 2) / 5) + 365 * yy +
    Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045
  )
}

function jdToDate(jd: number): Date {
  return new Date((jd - 2440587.5) * 86400000)
}

export function sunTimesUTC(
  year: number, month: number, day: number, lat: number, lonEast: number,
): { sunrise: Date; sunset: Date } | null {
  const jdn = gregorianToJDN(year, month, day)
  const n = Math.round(jdn - 2451545.0 + 0.0008)
  const Jstar = n - lonEast / 360
  const M = (357.5291 + 0.98560028 * Jstar) % 360
  const Mr = M * RAD
  const C = 1.9148 * Math.sin(Mr) + 0.02 * Math.sin(2 * Mr) + 0.0003 * Math.sin(3 * Mr)
  const lambda = (M + C + 180 + 102.9372) % 360
  const lr = lambda * RAD
  const Jtransit = 2451545.0 + Jstar + 0.0053 * Math.sin(Mr) - 0.0069 * Math.sin(2 * lr)
  const sinDec = Math.sin(lr) * Math.sin(23.4397 * RAD)
  const dec = Math.asin(sinDec)
  const phi = lat * RAD
  const cosOmega = (Math.sin(-0.833 * RAD) - Math.sin(phi) * sinDec) / (Math.cos(phi) * Math.cos(dec))
  if (cosOmega > 1 || cosOmega < -1) return null
  const omega = Math.acos(cosOmega) / RAD
  return { sunrise: jdToDate(Jtransit - omega / 360), sunset: jdToDate(Jtransit + omega / 360) }
}

const RAHU_SEG = [8, 2, 7, 5, 6, 4, 3] // weekday 0=Sun..6=Sat, 1-indexed 1/8 slot

export type DayTimes = {
  sunrise: Date
  sunset: Date
  rahuStart: Date
  rahuEnd: Date
  abhijitStart: Date
  abhijitEnd: Date
  vara: number // 0=Sunday .. 6=Saturday (calendar-day convention)
  varaName: string
} | null

export function computeDayTimes(
  lat: number, lon: number, timeZone: string, now: Date = new Date(),
): DayTimes {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short",
  }).formatToParts(now)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ""
  const year = Number(get("year"))
  const month = Number(get("month"))
  const day = Number(get("day"))
  const WD: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  const weekday = WD[get("weekday")] ?? 0
  const s = sunTimesUTC(year, month, day, lat, lon)
  if (!s) return null
  const part = (s.sunset.getTime() - s.sunrise.getTime()) / 8
  const seg = RAHU_SEG[weekday]
  const rahuStart = new Date(s.sunrise.getTime() + (seg - 1) * part)
  const rahuEnd = new Date(rahuStart.getTime() + part)
  const muhurta = (s.sunset.getTime() - s.sunrise.getTime()) / 15
  const abhijitStart = new Date(s.sunrise.getTime() + 7 * muhurta)
  const abhijitEnd = new Date(s.sunrise.getTime() + 8 * muhurta)
  const varaName = VARA_NAMES[weekday] ?? ""
  return {
    sunrise: s.sunrise, sunset: s.sunset, rahuStart, rahuEnd,
    abhijitStart, abhijitEnd, vara: weekday, varaName,
  }
}
