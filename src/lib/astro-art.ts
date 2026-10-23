// Rendered artwork for the 12 rashis and 9 grahas (public/assets/astro).
// Decorative only: never the source of chart facts, never below ~40px.

export const SIGN_ART = [
  "aries",
  "taurus",
  "gemini",
  "cancer",
  "leo",
  "virgo",
  "libra",
  "scorpio",
  "sagittarius",
  "capricorn",
  "aquarius",
  "pisces",
] as const;
export type SignArt = (typeof SIGN_ART)[number];

export const GRAHA_ART = [
  "sun",
  "moon",
  "mars",
  "mercury",
  "jupiter",
  "venus",
  "saturn",
  "rahu",
  "ketu",
] as const;
export type GrahaArt = (typeof GRAHA_ART)[number];

export type AstroArtKind = "sign" | "graha";

/** Zero-based sign index (0 = Aries / Mesha) to its artwork. */
export function signArtByIndex(index: number | null | undefined): SignArt | null {
  if (index == null || !Number.isInteger(index)) return null;
  return SIGN_ART[((index % 12) + 12) % 12];
}

/** Provider planet name (any case) to its artwork; Ascendant and unknowns return null. */
export function grahaArtByName(name: string | null | undefined): GrahaArt | null {
  const key = name?.trim().toLowerCase();
  return (GRAHA_ART as readonly string[]).includes(key ?? "") ? (key as GrahaArt) : null;
}

export function astroArtSrc(kind: AstroArtKind, name: SignArt | GrahaArt, px: 256 | 512) {
  return `/assets/astro/${kind === "sign" ? "sign" : "planet"}-${name}-${px}.webp`;
}
