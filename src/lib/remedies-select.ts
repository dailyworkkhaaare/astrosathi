// Scores the user's chart against a small set of traditional-remedy triggers
// and returns a ranked, de-duplicated list. Pure logic — no React/i18n — so
// UI components resolve `reasonKey`s to localized sentences.

import type { PlanetKey } from "@/lib/chart-types";
import type { NormalizedPlanet } from "@/lib/charts";
import { planetDignityState } from "@/lib/charts";
import {
  DOSHA_REMEDIES,
  PLANET_REMEDIES,
  type DoshaKey,
  type DoshaRemedy,
  type PlanetRemedies,
} from "@/lib/remedies";

// Natural malefics in the classical sense (Sun is a mild malefic).
const NATURAL_MALEFICS: readonly PlanetKey[] = ["sun", "mars", "saturn", "rahu", "ketu"];

export type RemedyConditionKind = "dosha" | "debilitated" | "combust" | "dasha-lord";

export type RemedyCondition = {
  /** Stable id used for de-duplication: "planet:<key>" or "dosha:<key>". */
  id: string;
  kind: RemedyConditionKind;
  planet?: PlanetKey;
  dosha?: DoshaKey;
  severity: number;
  /** i18n key under sections.remedies.reasons.* — the primary trigger. */
  reasonKey: string;
  /** All trigger reasonKeys that merged into this condition. */
  reasons: string[];
  /** Current Mahādaśā lord — surfaced as timely. */
  activeNow?: boolean;
  /** Dasha lord is a well-placed natural malefic: optional, low-priority framing. */
  supportive?: boolean;
};

export type RankedRemedy = {
  condition: RemedyCondition;
  remedy: PlanetRemedies | DoshaRemedy;
};

export type RemedySelection = {
  top: RankedRemedy[];
  more: RankedRemedy[];
  wellBalanced: boolean;
};

export type RemedySelectionInput = {
  planets: NormalizedPlanet[];
  hasMangalDosha: boolean;
  hasKaalSarpDosha: boolean;
  hasSadeSati: boolean;
  currentDashaLord: PlanetKey | null;
};

const TOP_COUNT = 4;

export function selectRemedies(input: RemedySelectionInput): RemedySelection {
  const { planets, hasMangalDosha, hasKaalSarpDosha, hasSadeSati, currentDashaLord } = input;

  const byId = new Map<string, RemedyCondition>();
  const add = (c: Omit<RemedyCondition, "reasons">) => {
    const existing = byId.get(c.id);
    if (existing) {
      existing.severity = Math.max(existing.severity, c.severity);
      if (!existing.reasons.includes(c.reasonKey)) existing.reasons.push(c.reasonKey);
      if (c.activeNow) existing.activeNow = true;
      if (c.supportive) existing.supportive = true;
    } else {
      byId.set(c.id, { ...c, reasons: [c.reasonKey] });
    }
  };

  // Tier 1 — active doshas (highest priority).
  if (hasMangalDosha) {
    add({
      id: "dosha:mangal_dosha",
      kind: "dosha",
      dosha: "mangal_dosha",
      severity: 100,
      reasonKey: "mangalActive",
    });
  }
  if (hasKaalSarpDosha) {
    add({
      id: "dosha:kaal_sarp_dosha",
      kind: "dosha",
      dosha: "kaal_sarp_dosha",
      severity: 100,
      reasonKey: "kaalSarpActive",
    });
  }
  if (hasSadeSati) {
    add({
      id: "dosha:sade_sati",
      kind: "dosha",
      dosha: "sade_sati",
      severity: 100,
      reasonKey: "sadeSatiActive",
    });
  }

  // Tiers 2-3 — debilitated / combust natal planets.
  for (const p of planets) {
    if (!p.key) continue;
    const flags = planetDignityState(p);
    if (flags.debilitated) {
      add({
        id: `planet:${p.key}`,
        kind: "debilitated",
        planet: p.key,
        severity: 80,
        reasonKey: "debilitated",
      });
    } else if (flags.combust) {
      add({
        id: `planet:${p.key}`,
        kind: "combust",
        planet: p.key,
        severity: 60,
        reasonKey: "combust",
      });
    }
  }

  // Tier 4 — current Mahādaśā lord. Only surfaced as a "defect" when it's
  // genuinely weak (debilitated/combust). A well-placed natural malefic is
  // framed as optional, lower-priority supportive practice — never a defect.
  if (currentDashaLord) {
    const p = planets.find((pl) => pl.key === currentDashaLord);
    const flags = p ? planetDignityState(p) : null;
    const weak = !!(flags && (flags.debilitated || flags.combust));
    if (weak) {
      add({
        id: `planet:${currentDashaLord}`,
        kind: "dasha-lord",
        planet: currentDashaLord,
        severity: 95,
        reasonKey: "dashaLordWeak",
        activeNow: true,
      });
    } else if (NATURAL_MALEFICS.includes(currentDashaLord)) {
      add({
        id: `planet:${currentDashaLord}`,
        kind: "dasha-lord",
        planet: currentDashaLord,
        severity: 20,
        reasonKey: "dashaLordSupportive",
        activeNow: true,
        supportive: true,
      });
    }
  }

  const all = Array.from(byId.values()).sort((a, b) => b.severity - a.severity);

  const ranked: RankedRemedy[] = all.map((condition) => ({
    condition,
    remedy:
      condition.kind === "dosha" && condition.dosha
        ? DOSHA_REMEDIES[condition.dosha]
        : PLANET_REMEDIES[condition.planet as PlanetKey],
  }));

  return {
    top: ranked.slice(0, TOP_COUNT),
    more: ranked.slice(TOP_COUNT),
    wellBalanced: ranked.length === 0,
  };
}
