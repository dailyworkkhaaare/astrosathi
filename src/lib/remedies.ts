// Static, curated Remedies / Upāya dataset. No astronomy here — planet and
// dosha state are computed elsewhere (see charts.ts, remedies-select.ts) and
// looked up against this table. Deity/gemstone/rudraksha proper names are
// kept transliterated (never translated) per design.md's Sanskrit rule; the
// dana item ids below are resolved to localized phrases in i18n
// (`sections.remedies.dana.*`).

import type { PlanetKey } from "@/lib/chart-types";

export type DoshaKey = "mangal_dosha" | "kaal_sarp_dosha" | "sade_sati";

export type MantraRemedy = {
  devanagari: string;
  transliteration: string;
};

// Canonical dana (charity) item ids. Localized text lives in
// sections.remedies.dana.<id> across en/hi/mr.
export type DanaItemId =
  | "wheat"
  | "jaggery"
  | "copperRed"
  | "rice"
  | "milk"
  | "silver"
  | "whiteCloth"
  | "redMasoorDal"
  | "copper"
  | "greenMoong"
  | "greenCloth"
  | "bronze"
  | "turmeric"
  | "chanaDal"
  | "gold"
  | "saffronYellow"
  | "sugar"
  | "curd"
  | "perfume"
  | "blackSesameTil"
  | "mustardOil"
  | "iron"
  | "uradDalBlack"
  | "coconut"
  | "blueBlackCloth"
  | "blanket"
  | "sesame"
  | "multicolourCloth"
  | "feedDogs";

export type PlanetRemedies = {
  mantra: MantraRemedy;
  /** 0 = Sunday .. 6 = Saturday, formatted via Intl for the user's locale. */
  day: number;
  dana: DanaItemId[];
  deity: { name: string; praise?: string };
  gemstone: { name: string; sanskritName: string };
  rudraksha: { mukhi: number };
};

export const PLANET_REMEDIES: Record<PlanetKey, PlanetRemedies> = {
  sun: {
    mantra: {
      devanagari: "ॐ ह्रां ह्रीं ह्रौं सः सूर्याय नमः",
      transliteration: "Om Hraam Hreem Hraum Sah Suryaya Namah",
    },
    day: 0,
    dana: ["wheat", "jaggery", "copperRed"],
    deity: { name: "Surya", praise: "Aditya Hridaya Stotra" },
    gemstone: { name: "Ruby", sanskritName: "Manik" },
    rudraksha: { mukhi: 1 },
  },
  moon: {
    mantra: {
      devanagari: "ॐ श्रां श्रीं श्रौं सः चन्द्राय नमः",
      transliteration: "Om Shraam Shreem Shraum Sah Chandraya Namah",
    },
    day: 1,
    dana: ["rice", "milk", "silver", "whiteCloth"],
    deity: { name: "Shiva", praise: "Gauri" },
    gemstone: { name: "Pearl", sanskritName: "Moti" },
    rudraksha: { mukhi: 2 },
  },
  mars: {
    mantra: {
      devanagari: "ॐ क्रां क्रीं क्रौं सः भौमाय नमः",
      transliteration: "Om Kraam Kreem Kraum Sah Bhaumaya Namah",
    },
    day: 2,
    dana: ["redMasoorDal", "jaggery", "copper"],
    deity: { name: "Hanuman", praise: "Hanuman Chalisa" },
    gemstone: { name: "Red Coral", sanskritName: "Moonga" },
    rudraksha: { mukhi: 3 },
  },
  mercury: {
    mantra: {
      devanagari: "ॐ ब्रां ब्रीं ब्रौं सः बुधाय नमः",
      transliteration: "Om Braam Breem Braum Sah Budhaya Namah",
    },
    day: 3,
    dana: ["greenMoong", "greenCloth", "bronze"],
    deity: { name: "Vishnu", praise: "Ganesha" },
    gemstone: { name: "Emerald", sanskritName: "Panna" },
    rudraksha: { mukhi: 4 },
  },
  jupiter: {
    mantra: {
      devanagari: "ॐ ग्रां ग्रीं ग्रौं सः गुरवे नमः",
      transliteration: "Om Graam Greem Graum Sah Gurave Namah",
    },
    day: 4,
    dana: ["turmeric", "chanaDal", "gold", "saffronYellow"],
    deity: { name: "Vishnu", praise: "Brihaspati / Vishnu Sahasranama" },
    gemstone: { name: "Yellow Sapphire", sanskritName: "Pukhraj" },
    rudraksha: { mukhi: 5 },
  },
  venus: {
    mantra: {
      devanagari: "ॐ द्रां द्रीं द्रौं सः शुक्राय नमः",
      transliteration: "Om Draam Dreem Draum Sah Shukraya Namah",
    },
    day: 5,
    dana: ["sugar", "rice", "whiteCloth", "curd", "perfume"],
    deity: { name: "Lakshmi" },
    gemstone: { name: "Diamond", sanskritName: "Heera" },
    rudraksha: { mukhi: 6 },
  },
  saturn: {
    mantra: {
      devanagari: "ॐ प्रां प्रीं प्रौं सः शनैश्चराय नमः",
      transliteration: "Om Praam Preem Praum Sah Shanaischaraya Namah",
    },
    day: 6,
    dana: ["blackSesameTil", "mustardOil", "iron", "uradDalBlack"],
    deity: { name: "Shani Dev", praise: "Hanuman Chalisa (Shani Chalisa)" },
    gemstone: { name: "Blue Sapphire", sanskritName: "Neelam" },
    rudraksha: { mukhi: 7 },
  },
  rahu: {
    mantra: {
      devanagari: "ॐ भ्रां भ्रीं भ्रौं सः राहवे नमः",
      transliteration: "Om Bhraam Bhreem Bhraum Sah Rahave Namah",
    },
    day: 6,
    dana: ["mustardOil", "coconut", "blueBlackCloth", "blanket"],
    deity: { name: "Durga", praise: "Bhairava" },
    gemstone: { name: "Hessonite", sanskritName: "Gomed" },
    rudraksha: { mukhi: 8 },
  },
  ketu: {
    mantra: {
      devanagari: "ॐ स्रां स्रीं स्रौं सः केतवे नमः",
      transliteration: "Om Sraam Sreem Sraum Sah Ketave Namah",
    },
    day: 2,
    dana: ["sesame", "blanket", "multicolourCloth", "feedDogs"],
    deity: { name: "Ganesha" },
    gemstone: { name: "Cat's Eye", sanskritName: "Lehsunia" },
    rudraksha: { mukhi: 9 },
  },
};

export type DoshaRemedy = {
  mantra: MantraRemedy;
  day: number;
  dana: DanaItemId[];
  deity: { name: string; praise?: string };
  /** i18n key suffix for the gentle, non-alarming description sentence. */
  noteKey: string;
};

export const DOSHA_REMEDIES: Record<DoshaKey, DoshaRemedy> = {
  mangal_dosha: {
    mantra: PLANET_REMEDIES.mars.mantra,
    day: 2,
    dana: ["redMasoorDal", "jaggery"],
    deity: { name: "Hanuman", praise: "Hanuman Chalisa" },
    noteKey: "mangalDoshaNote",
  },
  kaal_sarp_dosha: {
    mantra: {
      devanagari:
        "ॐ त्र्यम्बकं यजामहे सुगन्धिं पुष्टिवर्धनम् । उर्वारुकमिव बन्धनान् मृत्योर्मुक्षीय मामृतात् ॥",
      transliteration:
        "Om Tryambakam Yajamahe Sugandhim Pushtivardhanam Urvarukamiva Bandhanan Mrityor Mukshiya Mamritat",
    },
    day: 6,
    dana: ["mustardOil"],
    deity: { name: "Shiva", praise: "Mahamrityunjaya" },
    noteKey: "kaalSarpDoshaNote",
  },
  sade_sati: {
    mantra: PLANET_REMEDIES.saturn.mantra,
    day: 6,
    dana: ["blackSesameTil", "mustardOil"],
    deity: { name: "Shani Dev", praise: "Hanuman Chalisa" },
    noteKey: "sadeSatiDoshaNote",
  },
};
