// Mangal (Manglik) Dosha — pure, deterministic computation.
//
// Matches the Prokerala mangal_dosha artifact envelope so it drops into
// chart_artifacts.chart_jsonb without breaking consumers.
//
// Envelope: { status: "ok", data: { has_dosha, description } }
//
// Rule (whole-sign houses from Lagna):
//   houses [1, 2, 4, 7, 8, 12] with Mars => Manglik.
//   houses [7, 8]              => "strong" Manglik Dosha.
//   houses [1, 2, 4, 12]       => "mild"   Manglik Dosha.
//
// Reads Mars (id 4) and Lagna (id 100) from computeNatalPayload's
// planet_position array. Each entry carries { longitude, rasi: { id } };
// house = ((planetSign - ascSign + 12) % 12) + 1.

export type MangalDoshaPayload = {
  status: "ok";
  data: {
    has_dosha: boolean;
    description: string;
  };
};

const MANGLIK_HOUSES = new Set([1, 2, 4, 7, 8, 12]);
const STRONG_HOUSES = new Set([7, 8]);

function ordinal(n: number): string {
  if (n === 1) return "1st";
  if (n === 2) return "2nd";
  if (n === 3) return "3rd";
  return `${n}th`;
}

function signIdOf(p: unknown): number {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rasi = (p as any)?.rasi;
  const id = Number(rasi?.id);
  if (!Number.isFinite(id)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lon = Number((p as any)?.longitude);
    if (Number.isFinite(lon)) return Math.floor(((lon % 360) + 360) % 360 / 30);
    throw new Error("mangal: missing rasi.id/longitude");
  }
  return id;
}

export function computeMangalDoshaPayload(natalPayload: unknown): MangalDoshaPayload {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inner: any = (natalPayload as any)?.data ?? natalPayload;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const arr: any[] = inner?.planet_position ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mars = arr.find((p: any) => p?.id === 4);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const asc = arr.find((p: any) => p?.id === 100);
  if (!mars || !asc) throw new Error("mangal: Mars or Ascendant missing from natal");
  const marsSign = signIdOf(mars);
  const ascSign = signIdOf(asc);
  const marsHouse = ((marsSign - ascSign + 12) % 12) + 1;
  const has_dosha = MANGLIK_HOUSES.has(marsHouse);
  const severity = STRONG_HOUSES.has(marsHouse) ? "strong" : "mild";
  const description = has_dosha
    ? `The person is Manglik. Mars is positioned in the ${ordinal(marsHouse)} house, it is ${severity} Manglik Dosha`
    : `The person is Not Manglik`;
  return { status: "ok", data: { has_dosha, description } };
}
