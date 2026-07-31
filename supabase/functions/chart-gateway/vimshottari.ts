// Vimshottari dasha — pure, deterministic computation.
//
// Matches the Prokerala vimshottari_dasha artifact envelope field-for-field so
// it drops into chart_artifacts.chart_jsonb without breaking either consumer
// (src/lib/charts.ts getDasha, and formatDasha in astrologer-chat / daily-horoscope).
//
// Envelope: { status: "ok", data: { dasha_balance, dasha_periods } }
// Depth   : maha -> antardasha -> pratyantardasha (leaf). Exactly 3.
// Period  : { id, name, start, end, [antardasha|pratyantardasha] }. No vedic_name.
// IDs     : 0 Sun, 1 Moon, 2 Mercury, 3 Venus, 4 Mars, 5 Jupiter, 6 Saturn,
//           101 Rahu, 102 Ketu. Same at every level.
// Dates   : ISO-8601 with the birth-profile fixed offset (e.g. +05:30), seconds
//           precision, no milliseconds, no Z.
// Chaining: within a parent, first child.start = parent.start; last child.end =
//           parent.end; each sibling.start = previous sibling.end + 1 second.
//           Mahadashas chain continuously (no top-level +1s gap).

export type DashaLord = { id: number; name: string; vedic_name: string };
export type DashaPeriodLeaf = {
  id: number;
  name: string;
  start: string;
  end: string;
};
export type DashaAntar = DashaPeriodLeaf & {
  pratyantardasha: DashaPeriodLeaf[];
};
export type DashaMaha = DashaPeriodLeaf & { antardasha: DashaAntar[] };
export type DashaBalance = {
  lord: DashaLord;
  duration: string;
  description: string;
};
export type VimshottariPayload = {
  status: "ok";
  data: { dasha_balance: DashaBalance; dasha_periods: DashaMaha[] };
};

// Canonical Parasara cycle. Order MUST NOT change.
const LORDS: Array<{
  id: number;
  name: string;
  vedic: string;
  years: number;
}> = [
  { id: 102, name: "Ketu", vedic: "Ketu", years: 7 },
  { id: 3, name: "Venus", vedic: "Shukra", years: 20 },
  { id: 0, name: "Sun", vedic: "Surya", years: 6 },
  { id: 1, name: "Moon", vedic: "Chandra", years: 10 },
  { id: 4, name: "Mars", vedic: "Mangala", years: 7 },
  { id: 101, name: "Rahu", vedic: "Rahu", years: 18 },
  { id: 5, name: "Jupiter", vedic: "Guru", years: 16 },
  { id: 6, name: "Saturn", vedic: "Shani", years: 19 },
  { id: 2, name: "Mercury", vedic: "Budha", years: 17 },
];
const CYCLE_YEARS = 120;
const NAK_SPAN = 360 / 27; // 13.333...

function pad2(n: number): string {
  return n < 10 ? "0" + n : String(n);
}

// Format an instant as YYYY-MM-DDTHH:mm:ss+HH:MM using a FIXED offset.
// Prokerala emits every dasha date in the birth-profile offset (no DST shifts).
function formatFixedOffset(instantMs: number, offsetMinutes: number): string {
  const shifted = new Date(instantMs + offsetMinutes * 60_000);
  const YYYY = String(shifted.getUTCFullYear()).padStart(4, "0");
  const MM = pad2(shifted.getUTCMonth() + 1);
  const DD = pad2(shifted.getUTCDate());
  const hh = pad2(shifted.getUTCHours());
  const mm = pad2(shifted.getUTCMinutes());
  const ss = pad2(shifted.getUTCSeconds());
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMinutes);
  return `${YYYY}-${MM}-${DD}T${hh}:${mm}:${ss}${sign}${pad2(Math.floor(abs / 60))}:${pad2(abs % 60)}`;
}

// ISO-8601 duration between two instants using calendar Y/M/D borrowing,
// matching Prokerala's dasha_balance.duration style (e.g. "P9Y8M6DT1H8M39S").
function isoDurationBetween(startMs: number, endMs: number): string {
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    return "P0D";
  }
  const s = new Date(startMs);
  const e = new Date(endMs);
  let years = e.getUTCFullYear() - s.getUTCFullYear();
  let months = e.getUTCMonth() - s.getUTCMonth();
  let days = e.getUTCDate() - s.getUTCDate();
  let hours = e.getUTCHours() - s.getUTCHours();
  let mins = e.getUTCMinutes() - s.getUTCMinutes();
  let secs = e.getUTCSeconds() - s.getUTCSeconds();
  if (secs < 0) {
    secs += 60;
    mins -= 1;
  }
  if (mins < 0) {
    mins += 60;
    hours -= 1;
  }
  if (hours < 0) {
    hours += 24;
    days -= 1;
  }
  if (days < 0) {
    const daysInPrevMonth = new Date(
      Date.UTC(e.getUTCFullYear(), e.getUTCMonth(), 0),
    ).getUTCDate();
    days += daysInPrevMonth;
    months -= 1;
  }
  if (months < 0) {
    months += 12;
    years -= 1;
  }
  const datePart =
    (years > 0 ? `${years}Y` : "") +
    (months > 0 ? `${months}M` : "") +
    (days > 0 ? `${days}D` : "");
  const timePart =
    (hours > 0 ? `${hours}H` : "") +
    (mins > 0 ? `${mins}M` : "") +
    (secs > 0 ? `${secs}S` : "");
  return "P" + (datePart || "0D") + (timePart ? "T" + timePart : "");
}

// Human summary matching Prokerala's dasha_balance.description ("9 years 8 months 6 days").
function humanDurationBetween(startMs: number, endMs: number): string {
  const iso = isoDurationBetween(startMs, endMs);
  const m = iso.match(/^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)D)?/);
  const y = Number(m?.[1] ?? 0);
  const mo = Number(m?.[2] ?? 0);
  const d = Number(m?.[3] ?? 0);
  return `${y} year${y === 1 ? "" : "s"} ${mo} month${mo === 1 ? "" : "s"} ${d} day${d === 1 ? "" : "s"}`;
}

// Build 9 sub-periods inside [parentStart, parentEnd], starting from
// startLordIdx in the cyclic order. Applies the sibling "+1s" convention and
// pins first.start / last.end to the parent's boundaries.
function buildChildren(
  startLordIdx: number,
  parentStartMs: number,
  parentEndMs: number,
  offsetMin: number,
): Array<{
  id: number;
  name: string;
  start: string;
  end: string;
  startMs: number;
  endMs: number;
}> {
  const parentSpan = parentEndMs - parentStartMs;
  // Continuous nominal cuts (floating), rounded to the nearest second at emit.
  const cuts: number[] = [parentStartMs];
  let acc = 0;
  for (let i = 0; i < 9; i++) {
    const lord = LORDS[(startLordIdx + i) % 9];
    acc += (lord.years / CYCLE_YEARS) * parentSpan;
    cuts.push(parentStartMs + acc);
  }
  cuts[cuts.length - 1] = parentEndMs; // pin last to parent

  const out: Array<{
    id: number;
    name: string;
    start: string;
    end: string;
    startMs: number;
    endMs: number;
  }> = [];
  for (let i = 0; i < 9; i++) {
    const lord = LORDS[(startLordIdx + i) % 9];
    // Round the internal cut to the nearest second; end always rounded.
    const endMs =
      i === 8 ? parentEndMs : Math.round(cuts[i + 1] / 1000) * 1000;
    const startMs =
      i === 0 ? parentStartMs : out[i - 1].endMs + 1000;
    out.push({
      id: lord.id,
      name: lord.name,
      start: formatFixedOffset(startMs, offsetMin),
      end: formatFixedOffset(endMs, offsetMin),
      startMs,
      endMs,
    });
  }
  return out;
}

export function computeVimshottariDashaPayload(args: {
  // Absolute 0-360 sidereal (Lahiri). Values outside the range are wrapped.
  moonSidLon: number;
  birthUtcMs: number;
  // Birth-profile offset in minutes (e.g. 330 for +05:30). All emitted dates
  // use this fixed offset — no DST logic.
  offsetMinutes: number;
  // Solar-year length in days. Default 365.25 (Prokerala's convention per
  // parity bake-off); parity script may override to 365.2422 or 360.0.
  yearDays?: number;
  // How many full 120y Vimshottari cycles to emit. 2 covers a human lifespan
  // regardless of nakshatra start; matches Prokerala.
  cycles?: number;
}): VimshottariPayload {
  const yearDays = args.yearDays ?? 365.25;
  const yearMs = yearDays * 86400 * 1000;
  const cycles = args.cycles ?? 2;

  const L = ((args.moonSidLon % 360) + 360) % 360;
  const nakIdx = Math.floor(L / NAK_SPAN); // 0..26
  const startLordIdx = nakIdx % 9;
  const fractionElapsed = (L - nakIdx * NAK_SPAN) / NAK_SPAN;

  // First mahadasha: full lord-length, ends at birth + remaining fraction,
  // starts before birth so the pre-birth portion is emitted (matches Prokerala).
  const firstLord = LORDS[startLordIdx];
  const firstFullMs = firstLord.years * yearMs;
  const firstEndMsRaw = args.birthUtcMs + firstFullMs * (1 - fractionElapsed);
  // Round to second precision to line up with the emitted string format.
  const firstEndMs = Math.round(firstEndMsRaw / 1000) * 1000;
  const firstStartMs = firstEndMs - firstFullMs;

  // Continuous mahadasha timeline. No +1s gap between mahadashas — Prokerala's
  // artifact chains them exactly (maha[i+1].start == maha[i].end).
  const mahaSpans: Array<{
    lordIdx: number;
    startMs: number;
    endMs: number;
  }> = [];
  {
    let curMs = firstStartMs;
    for (let c = 0; c < cycles; c++) {
      for (let i = 0; i < 9; i++) {
        const lord = LORDS[(startLordIdx + i) % 9];
        const spanMs = lord.years * yearMs;
        // Force the first maha to end at the second-rounded firstEndMs; all
        // subsequent mahadashas chain nominally.
        const endMs =
          mahaSpans.length === 0 ? firstEndMs : curMs + spanMs;
        mahaSpans.push({
          lordIdx: (startLordIdx + i) % 9,
          startMs: curMs,
          endMs,
        });
        curMs = endMs;
      }
    }
  }

  const dasha_periods: DashaMaha[] = mahaSpans.map((maha) => {
    const lord = LORDS[maha.lordIdx];
    const antars = buildChildren(
      maha.lordIdx,
      maha.startMs,
      maha.endMs,
      args.offsetMinutes,
    );
    return {
      id: lord.id,
      name: lord.name,
      start: formatFixedOffset(maha.startMs, args.offsetMinutes),
      end: formatFixedOffset(maha.endMs, args.offsetMinutes),
      antardasha: antars.map((a) => {
        const antarLordIdx = LORDS.findIndex((L2) => L2.id === a.id);
        const pratys = buildChildren(
          antarLordIdx,
          a.startMs,
          a.endMs,
          args.offsetMinutes,
        );
        return {
          id: a.id,
          name: a.name,
          start: a.start,
          end: a.end,
          pratyantardasha: pratys.map((p) => ({
            id: p.id,
            name: p.name,
            start: p.start,
            end: p.end,
          })),
        };
      }),
    };
  });

  const dasha_balance: DashaBalance = {
    lord: {
      id: firstLord.id,
      name: firstLord.name,
      vedic_name: firstLord.vedic,
    },
    duration: isoDurationBetween(args.birthUtcMs, firstEndMs),
    description: humanDurationBetween(args.birthUtcMs, firstEndMs),
  };

  return { status: "ok", data: { dasha_balance, dasha_periods } };
}
