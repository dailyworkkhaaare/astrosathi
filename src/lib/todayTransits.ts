// Shared helpers for rendering today's transit facts (Home's "Today" panorama
// and Chat's suggested-prompt chips both derive houses from the same natal
// ascendant lookup — kept in one place so they never drift apart).

import type { NormalizedPlanet } from "@/lib/charts";
import type { PlanetKey } from "@/lib/chart-types";

export const INGRESS_SOON_MS = 10 * 24 * 60 * 60 * 1000;

export const PLANET_KEY_BY_CODE: Record<number, PlanetKey> = {
  0: "sun",
  2: "mercury",
  3: "venus",
  4: "mars",
  5: "jupiter",
  6: "saturn",
  101: "rahu",
  102: "ketu",
};

export function findAscendantSignIndex(planets: NormalizedPlanet[]): number | null {
  const asc =
    planets.find((p) => /ascend|lagna/i.test(p.name)) ?? planets.find((p) => p.house === 1) ?? null;
  return asc?.signIndex ?? null;
}

export function houseFor(transitSignIndex: number, ascSignIndex: number): number {
  return ((transitSignIndex - ascSignIndex + 12) % 12) + 1;
}
