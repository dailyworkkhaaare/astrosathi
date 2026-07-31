// Kaal Sarp Yoga — pure, deterministic computation.
//
// Matches the Prokerala kaal_sarp_dosha artifact envelope so it drops into
// chart_artifacts.chart_jsonb without breaking consumers.
//
// Envelope: { status: "ok", data: { type, has_dosha, dosha_type, description } }
//
// Definition (locked against Prokerala captures — see scripts/capture-kaalsarp.ts):
//   Kaal Sarp forms when ALL seven visible-planet ids (0..6) sit strictly on
//   ONE side of the Rahu-Ketu axis — either the FORWARD Rahu->Ketu arc
//   (deltas in (0, 180)) OR the REVERSE Ketu->Rahu arc (deltas in (180, 360)).
//   Prokerala treats both as Kaal Sarp and does not label the arc separately.
//   Isolated in isContained(deltas) so future refinements land in one place.
//
// Field values (locked against Prokerala captures):
//   type        — always null (Prokerala does not emit a house-flavor name for
//                 this endpoint; the classical Ananta/Kulika 12-name split
//                 does NOT appear in the /kaal-sarp-dosha response).
//   dosha_type  — "Kaal Amrita" when has_dosha, null otherwise.
//   description — "You have Kaal Amrita Yoga because all the planets are
//                 between Rahu and Ketu" when has_dosha,
//                 "You do not have Kaal Sarp Yoga. " (trailing space) otherwise.
//
// Reads Rahu (id 101), Ketu (id 102), Ascendant (id 100), and planets 0..6
// from computeNatalPayload's planet_position array. Ascendant is not needed
// for has_dosha (arc-containment only depends on planet longitudes relative
// to Rahu) but we still require it so the shape matches natal payloads.

export type KaalSarpDoshaPayload = {
  status: "ok";
  data: {
    type: string | null;
    has_dosha: boolean;
    dosha_type: string | null;
    description: string;
  };
};

function lonOf(p: unknown): number {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lon = Number((p as any)?.longitude);
  if (!Number.isFinite(lon)) throw new Error("kaalsarp: missing longitude");
  return ((lon % 360) + 360) % 360;
}

// Central containment predicate. Given each visible-planet delta from Rahu
// (measured forward, 0..360), return true if every planet is strictly inside
// EITHER the forward Rahu->Ketu semicircle OR the reverse Ketu->Rahu
// semicircle. Prokerala flags both as Kaal Sarp (Kaal Amrita variant).
function isContained(deltas: number[]): boolean {
  const allForward = deltas.every((d) => d > 0 && d < 180);
  const allReverse = deltas.every((d) => d > 180 && d < 360);
  return allForward || allReverse;
}

export function computeKaalSarpDoshaPayload(natalPayload: unknown): KaalSarpDoshaPayload {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inner: any = (natalPayload as any)?.data ?? natalPayload;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const arr: any[] = inner?.planet_position ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rahu = arr.find((p: any) => p?.id === 101);
  if (!rahu) throw new Error("kaalsarp: Rahu missing from natal");
  const rahuLon = lonOf(rahu);

  const deltas: number[] = [];
  for (let id = 0; id <= 6; id++) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = arr.find((x: any) => x?.id === id);
    if (!p) throw new Error(`kaalsarp: planet id=${id} missing from natal`);
    const d = ((lonOf(p) - rahuLon) % 360 + 360) % 360;
    deltas.push(d);
  }

  const has_dosha = isContained(deltas);
  const dosha_type: string | null = has_dosha ? "Kaal Amrita" : null;
  const description = has_dosha
    ? "You have Kaal Amrita Yoga because all the planets are between Rahu and Ketu"
    : "You do not have Kaal Sarp Yoga. ";
  return { status: "ok", data: { type: null, has_dosha, dosha_type, description } };
}
