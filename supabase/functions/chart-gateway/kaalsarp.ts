// Kaal Sarp Yoga — pure, deterministic computation.
//
// Matches the Prokerala kaal_sarp_dosha artifact envelope so it drops into
// chart_artifacts.chart_jsonb without breaking consumers.
//
// Envelope: { status: "ok", data: { type, has_dosha, dosha_type, description } }
//
// Definition (working hypothesis — refine after we capture a real Prokerala
// positive via scripts/doshas-parity.ts --find-kaalsarp):
//   Kaal Sarp forms when ALL seven visible-planet ids (0..6) sit strictly
//   inside the Rahu -> Ketu arc, measured forward from Rahu (0 < delta < 180).
//   `isContained` isolates that convention so we can flip / extend it easily.
//
// `type` (the flavor name, e.g. "Anant") is keyed off the whole-sign HOUSE of
// Rahu from Lagna. Mapping below is the standard Vedic table pending
// confirmation from a real Prokerala positive.
//
// Reads Rahu (id 101), Ketu (id 102), Ascendant (id 100), and planets 0..6
// from computeNatalPayload's planet_position array.

export type KaalSarpDoshaPayload = {
  status: "ok";
  data: {
    type: string;
    has_dosha: boolean;
    dosha_type: string;
    description: string;
  };
};

// Rahu-house -> Kaal Sarp flavor. Confirm against a real Prokerala positive
// before flipping. Index 0 unused (houses are 1-based).
const KAALSARP: readonly string[] = [
  "",
  "Anant",
  "Kulik",
  "Vasuki",
  "Shankhpal",
  "Padma",
  "Mahapadma",
  "Takshak",
  "Karkotak",
  "Shankhachud",
  "Ghatak",
  "Vishdhar",
  "Sheshnag",
];

function signIdOf(p: unknown): number {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rasi = (p as any)?.rasi;
  const id = Number(rasi?.id);
  if (!Number.isFinite(id)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lon = Number((p as any)?.longitude);
    if (Number.isFinite(lon)) return Math.floor(((lon % 360) + 360) % 360 / 30);
    throw new Error("kaalsarp: missing rasi.id/longitude");
  }
  return id;
}

function lonOf(p: unknown): number {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lon = Number((p as any)?.longitude);
  if (!Number.isFinite(lon)) throw new Error("kaalsarp: missing longitude");
  return ((lon % 360) + 360) % 360;
}

// Central containment predicate. Given each visible-planet delta from Rahu
// (measured forward, 0..360), return true if every planet is strictly inside
// the forward Rahu->Ketu semicircle. Isolate here so we can flip the
// convention or add exclusive/inclusive boundary handling in one place.
function isContained(deltas: number[]): boolean {
  return deltas.every((d) => d > 0 && d < 180);
}

export function computeKaalSarpDoshaPayload(natalPayload: unknown): KaalSarpDoshaPayload {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inner: any = (natalPayload as any)?.data ?? natalPayload;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const arr: any[] = inner?.planet_position ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rahu = arr.find((p: any) => p?.id === 101);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const asc = arr.find((p: any) => p?.id === 100);
  if (!rahu || !asc) throw new Error("kaalsarp: Rahu or Ascendant missing from natal");
  const rahuLon = lonOf(rahu);
  const rahuSign = signIdOf(rahu);
  const ascSign = signIdOf(asc);
  const rahuHouse = ((rahuSign - ascSign + 12) % 12) + 1;

  const deltas: number[] = [];
  for (let id = 0; id <= 6; id++) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = arr.find((x: any) => x?.id === id);
    if (!p) throw new Error(`kaalsarp: planet id=${id} missing from natal`);
    const d = ((lonOf(p) - rahuLon) % 360 + 360) % 360;
    deltas.push(d);
  }

  const has_dosha = isContained(deltas);
  const type = KAALSARP[rahuHouse] ?? "";
  // TODO: fill from a real Prokerala positive (see scripts/doshas-parity.ts
  // --find-kaalsarp). Leaving placeholder empties so the field-shape matches
  // and byte-compare on negatives still holds.
  const dosha_type = has_dosha ? "" : "";
  const description = has_dosha
    ? ""
    : `You do not have Kaal Sarp Yoga. `;
  return { status: "ok", data: { type, has_dosha, dosha_type, description } };
}
