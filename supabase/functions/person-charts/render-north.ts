// Local North-Indian varga chart renderer.
//
// Produces an SVG byte-compatible with Prokerala's varga output, so the
// existing CSS wrapper (design.md §7) restyles it without changes and both
// the point-in-polygon and the nearest-anchor parsers round-trip cleanly.
//
// TEMPLATE — copied verbatim from a stored Prokerala varga SVG (see
// scratchpad/sample-d1_rashi-*.svg). viewBox "0 0 480 480", 300×300.
//   * Outer square 10..472
//   * Both diagonals
//   * Diamond joining edge midpoints at 242 (NOT 241; Prokerala uses 242)
//
// SIGN DIGITS — bare <text> at fixed anchors, per Phase 2 Step B spec.
//
// PLANETS — <text class="pk-planet-<key>"> at per-house anchors calibrated
// against Prokerala's actual placements (see grep output over 6 stored SVGs).
// Bodies in the same house stack vertically with 20px spacing.
//
// NO gateway wiring here. NO deploy. Pure function.

import { BODY_KEYS, type BodyKey } from "./varga.ts";

// -----------------------------------------------------------------------------
// Fixed template (verbatim from stored Prokerala D1 sample).
// -----------------------------------------------------------------------------
const TEMPLATE_LINES = [
  `<line x1="10" y1="10" x2="10" y2="472" stroke-width="1" stroke="#000000"/>`,
  `<line x1="10" y1="472" x2="472" y2="472" stroke-width="1" stroke="#000000"/>`,
  `<line x1="472" y1="472" x2="472" y2="10" stroke-width="1" stroke="#000000"/>`,
  `<line x1="472" y1="10" x2="10" y2="10" stroke-width="1" stroke="#000000"/>`,
  `<line x1="10" y1="10" x2="472" y2="472" stroke-width="1" stroke="#000000"/>`,
  `<line x1="10" y1="472" x2="472" y2="10" stroke-width="1" stroke="#000000"/>`,
  `<line x1="242" y1="10" x2="472" y2="242" stroke-width="1" stroke="#000000"/>`,
  `<line x1="472" y1="242" x2="242" y2="472" stroke-width="1" stroke="#000000"/>`,
  `<line x1="242" y1="472" x2="10" y2="242" stroke-width="1" stroke="#000000"/>`,
  `<line x1="10" y1="242" x2="242" y2="10" stroke-width="1" stroke="#000000"/>`,
];

// Sign-digit anchors — one per house (Phase 2 Step B spec).
// Index 0 unused; houses 1..12.
const HOUSE_DIGIT_ANCHORS: Array<{ x: number; y: number }> = [
  { x: 0,   y: 0   }, // unused
  { x: 237, y: 216 }, // h1
  { x: 123, y: 98  }, // h2
  { x: 98,  y: 123 }, // h3
  { x: 216, y: 241 }, // h4
  { x: 98,  y: 359 }, // h5
  { x: 123, y: 384 }, // h6
  { x: 241, y: 266 }, // h7
  { x: 359, y: 384 }, // h8
  { x: 384, y: 359 }, // h9
  { x: 266, y: 241 }, // h10
  { x: 376, y: 123 }, // h11
  { x: 351, y: 98  }, // h12
];

// Per-house planet placement rules. First slot is at `anchor`; subsequent
// bodies stack down by 20px for up to `rowsPerCol` rows, then wrap into a
// new column offset by `colShift.dx` from the previous column. Values
// calibrated so that (a) every slot lies strictly inside the correct house
// polygon (for the point-in-polygon parser) and (b) every slot is still
// nearest to its own house's DIGIT anchor (required for the nearest-anchor
// parser round-trip). Anchors match Prokerala's visual convention.
type StackRule = {
  anchor: { x: number; y: number };
  rowsPerCol: number;
  colShift: { dx: number; dy: number };
};
const HOUSE_STACK: Array<StackRule> = [
  /* 0 */ { anchor: { x: 0,   y: 0   }, rowsPerCol: 1, colShift: { dx: 0,   dy: 0 } },
  /* 1 */ { anchor: { x: 230, y: 119 }, rowsPerCol: 6, colShift: { dx: 15,  dy: 0 } },
  /* 2 */ { anchor: { x: 112, y: 30  }, rowsPerCol: 4, colShift: { dx: 30,  dy: 0 } },
  /* 3 */ { anchor: { x: 25,  y: 120 }, rowsPerCol: 4, colShift: { dx: 25,  dy: 0 } },
  // Interior quads (h4/h7/h10) have tiny Voronoi cells around their digit
  // anchors (all within ~25px of C), so planets that stack far away from the
  // digit anchor drift into a neighbor's cell. Anchor these near the digit.
  /* 4 */ { anchor: { x: 170, y: 241 }, rowsPerCol: 3, colShift: { dx: 15,  dy: 0 } },
  /* 5 */ { anchor: { x: 25,  y: 356 }, rowsPerCol: 4, colShift: { dx: 30,  dy: 0 } },
  /* 6 */ { anchor: { x: 112, y: 440 }, rowsPerCol: 2, colShift: { dx: 30,  dy: 0 } },
  /* 7 */ { anchor: { x: 215, y: 285 }, rowsPerCol: 4, colShift: { dx: 15,  dy: 0 } },
  /* 8 */ { anchor: { x: 348, y: 440 }, rowsPerCol: 2, colShift: { dx: -30, dy: 0 } },
  /* 9 */ { anchor: { x: 435, y: 356 }, rowsPerCol: 3, colShift: { dx: -30, dy: 0 } },
  /* 10 */{ anchor: { x: 300, y: 235 }, rowsPerCol: 4, colShift: { dx: -15, dy: 0 } },
  /* 11 */{ anchor: { x: 435, y: 120 }, rowsPerCol: 3, colShift: { dx: -30, dy: 0 } },
  /* 12 */{ anchor: { x: 348, y: 30  }, rowsPerCol: 3, colShift: { dx: -30, dy: 0 } },
];

// Short label per body, matching Prokerala.
const PLANET_LABEL: Record<BodyKey | "ascendant", string> = {
  sun: "Su", moon: "Mo", mars: "Ma", mercury: "Me", jupiter: "Ju",
  venus: "Ve", saturn: "Sa", rahu: "Ra", ketu: "Ke", ascendant: "Asc",
};

// Order bodies within a stacked house, matches Prokerala convention.
const STACK_ORDER: Array<BodyKey | "ascendant"> = [
  "sun", "moon", "mars", "mercury", "jupiter", "venus", "saturn",
  "rahu", "ketu", "ascendant",
];

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------
export type RenderInput = {
  asc_sign: number; // 0..11
  positions: Array<{ key: BodyKey; sign: number; house: number }>;
};

export function renderNorthIndian(chart: RenderInput): string {
  // Group bodies by house.
  const byHouse: Array<Array<BodyKey | "ascendant">> = Array.from(
    { length: 13 },
    () => [],
  );
  for (const p of chart.positions) {
    if (p.house >= 1 && p.house <= 12) byHouse[p.house].push(p.key);
  }
  // Ascendant lives in house 1 by definition.
  byHouse[1].push("ascendant");

  // Sort each house's bodies into a stable order.
  for (let h = 1; h <= 12; h++) {
    byHouse[h].sort(
      (a, b) => STACK_ORDER.indexOf(a) - STACK_ORDER.indexOf(b),
    );
  }

  const parts: string[] = [];
  parts.push(
    `<svg preserveAspectRatio="none" viewBox="0 0 480 480" width="300" height="300"  xmlns="http://www.w3.org/2000/svg">`,
  );
  for (const line of TEMPLATE_LINES) parts.push(line);

  // Sign digits.
  for (let h = 1; h <= 12; h++) {
    const rasi = ((chart.asc_sign + (h - 1)) % 12) + 1; // 1..12
    const a = HOUSE_DIGIT_ANCHORS[h];
    parts.push(`<text x="${a.x}" y="${a.y}" font-size="16" >${rasi}</text>`);
  }

  // Planets — stack by per-house rule: rowsPerCol rows down, then wrap into a
  // new column offset by colShift.
  for (let h = 1; h <= 12; h++) {
    const list = byHouse[h];
    if (!list.length) continue;
    const rule = HOUSE_STACK[h];
    for (let i = 0; i < list.length; i++) {
      const key = list[i];
      const col = Math.floor(i / rule.rowsPerCol);
      const row = i % rule.rowsPerCol;
      const x = rule.anchor.x + col * rule.colShift.dx;
      const y = rule.anchor.y + row * 20 + col * rule.colShift.dy;
      parts.push(
        `<text x="${x}" y="${y}" font-size="16" class="pk-planet-${key}" >${PLANET_LABEL[key]}</text>`,
      );
    }
  }

  parts.push(`</svg>`);
  return parts.join("\n");
}

// Convenience — silences unused-import warnings on lean builds.
export const _BODY_KEYS = BODY_KEYS;
