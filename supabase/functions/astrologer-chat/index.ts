// Supabase Edge Function: astrologer-chat
// Grounded Vedic AI astrologer. Loads the user's computed chart artifacts
// (numerology, Lo Shu + Kua, doshas, dasha, ashtakavarga) and their birth
// profile, then answers via OpenRouter. Persists the conversation.
//
// Runtime: Deno (Supabase Edge Functions).
// Secrets required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
//   OPENROUTER_API_KEY, and optionally OPENROUTER_MODEL.

// @ts-ignore - esm.sh import (resolved at deploy time)
import {
  createClient,
  type SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2.45.4";
// @ts-ignore - esm.sh import (resolved at deploy time). Same validated engine as transit-compute.
import { getAscendant } from "https://esm.sh/gh/heirmez/vedic-ephemeris@main/index.mjs";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const Deno: any;

// ---------- CORS ----------
const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Max-Age": "86400",
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...CORS_HEADERS },
  });
}

function err(status: number, code: string, message?: string): Response {
  return json(status, { error: { code, message: message ?? code } });
}

async function fetchWithTimeout(
  url: string,
  init: Record<string, unknown>,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal } as never);
  } finally {
    clearTimeout(id);
  }
}

// CI-5.3: embed a query string with OpenAI text-embedding-3-small (1536-dim)
// for knowledge-base retrieval. Best-effort: returns null on any failure.
async function embedQuery(
  apiKey: string,
  text: string,
): Promise<number[] | null> {
  try {
    const resp = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: text.slice(0, 8000),
        dimensions: 1536,
      }),
    });
    if (!resp.ok) return null;
    const jr = await resp.json();
    const emb = jr?.data?.[0]?.embedding;
    return Array.isArray(emb) ? (emb as number[]) : null;
  } catch (_e) {
    return null;
  }
}

// Chart types we surface to the model as grounding context.
const CONTEXT_CHART_TYPES = [
  "natal",
  "numerology",
  "lo_shu",
  "doshas",
  "vimshottari_dasha",
  "ashtakavarga",
];
// Rolling-summary memory tuning. Recent turns are sent verbatim; older turns
// are folded into a compact running summary so long chats stay cheap.
const SUMMARY_TRIGGER = 20; // fold once this many un-summarized messages exist
const SUMMARY_FOLD_BATCH = 10; // oldest messages folded into the summary per pass
const SUMMARY_MAX_MESSAGES = 50; // safety cap on verbatim messages loaded per turn
const SUMMARY_MAX_WORDS = 300; // target length of the rolling summary
const FACTS_MAX_WORDS = 300; // cap on the durable, cross-conversation user-facts memory

// --- Companion Intelligence (CI-1.2) ---
// Allowed structured-memory topics; must match the user_topic_memory CHECK.
const TOPIC_MEMORY_TOPICS = new Set([
  "career",
  "health",
  "marriage",
  "relationships",
  "finance",
  "children",
  "education",
  "travel",
  "property",
  "business",
  "spirituality",
  "family",
  "other",
]);
// Default lifetime for an auto-detected emotional-state note.
const EMOTIONAL_DEFAULT_TTL_DAYS = 14;

// CI-1.3 Reasoning Planner: lightweight keyword -> life-area classifier used to
// retrieve ONLY the structured topic memory relevant to the current question.
const TOPIC_KEYWORDS: Array<[string, string[]]> = [
  [
    "career",
    [
      "job",
      "career",
      "work",
      "promotion",
      "boss",
      "office",
      "salary",
      "interview",
      "resign",
      "appraisal",
      "naukri",
      "kaam",
      "daftar",
    ],
  ],
  [
    "health",
    [
      "health",
      "illness",
      "disease",
      "sick",
      "body",
      "mental",
      "stress",
      "anxiety",
      "depress",
      "sehat",
      "bimar",
      "bimari",
      "tabiyat",
      "aarogya",
    ],
  ],
  [
    "marriage",
    [
      "marriage",
      "marry",
      "wedding",
      "spouse",
      "wife",
      "husband",
      "divorce",
      "shaadi",
      "vivah",
      "lagna",
      "patni",
      "pati",
    ],
  ],
  [
    "relationships",
    [
      "relationship",
      "love",
      "boyfriend",
      "girlfriend",
      "breakup",
      "crush",
      "affair",
      "partner",
      "rishta",
      "pyaar",
      "prem",
      "premika",
      "premi",
    ],
  ],
  [
    "finance",
    [
      "money",
      "finance",
      "wealth",
      "loan",
      "debt",
      "invest",
      "savings",
      "income",
      "paisa",
      "dhan",
      "kharch",
      "daulat",
      "paise",
    ],
  ],
  [
    "children",
    [
      "child",
      "children",
      "baby",
      "kids",
      "pregnan",
      "conceive",
      "son",
      "daughter",
      "bachcha",
      "santaan",
      "santan",
      "aulad",
      "garbh",
    ],
  ],
  [
    "education",
    [
      "education",
      "study",
      "studies",
      "exam",
      "college",
      "university",
      "degree",
      "school",
      "admission",
      "padhai",
      "pariksha",
      "shiksha",
    ],
  ],
  [
    "travel",
    [
      "travel",
      "trip",
      "abroad",
      "foreign",
      "visa",
      "relocat",
      "journey",
      "migrate",
      "videsh",
      "pardes",
      "yatra",
      "safar",
    ],
  ],
  [
    "property",
    [
      "property",
      "house",
      "home",
      "land",
      "plot",
      "real estate",
      "flat",
      "apartment",
      "ghar",
      "makaan",
      "zameen",
      "jameen",
      "sampatti",
    ],
  ],
  [
    "business",
    [
      "business",
      "startup",
      "venture",
      "entrepreneur",
      "trade",
      "vyapar",
      "vyavsay",
      "dhandha",
      "dukaan",
    ],
  ],
  [
    "spirituality",
    [
      "spiritual",
      "temple",
      "puja",
      "pooja",
      "mantra",
      "meditat",
      "karma",
      "moksha",
      "dharma",
      "bhakti",
      "sadhana",
      "prayer",
    ],
  ],
  [
    "family",
    [
      "family",
      "mother",
      "father",
      "parents",
      "brother",
      "sister",
      "mom",
      "dad",
      "maa",
      "mata",
      "pita",
      "papa",
      "bhai",
      "behan",
      "parivar",
      "gharwale",
    ],
  ],
];

// Map the user's message to the set of life-areas it touches (may be empty).
function classifyTopics(message: string): string[] {
  const m = message.toLowerCase();
  const hits: string[] = [];
  for (const [topic, kws] of TOPIC_KEYWORDS) {
    if (kws.some((k) => m.includes(k))) hits.push(topic);
  }
  return hits;
}

// Render structured preferences into a short, plain instruction (or "").
function buildPreferenceInstruction(
  prefs: Record<string, unknown> | null,
): string {
  if (!prefs || typeof prefs !== "object") return "";
  const p = prefs as Record<string, unknown>;
  const lines: string[] = [];
  if (typeof p.preferred_language === "string" && p.preferred_language.trim()) {
    lines.push(
      `They generally prefer ${p.preferred_language.trim()} - but always mirror the language of their current message.`,
    );
  }
  if (typeof p.preferred_tone === "string" && p.preferred_tone.trim()) {
    lines.push(`Preferred tone: ${p.preferred_tone.trim()}.`);
  }
  if (p.detail_level === "brief")
    lines.push("Keep answers short and to the point.");
  else if (p.detail_level === "detailed")
    lines.push("Give thorough, detailed explanations.");
  else if (p.detail_level === "balanced")
    lines.push("Keep answers moderate in length.");
  if (p.likes_tables === false)
    lines.push("Avoid tables; prefer flowing prose or simple lists.");
  else if (p.likes_tables === true)
    lines.push("Tables are welcome when genuinely helpful.");
  if (p.remedies_first === true)
    lines.push("Lead with practical remedies before deeper explanation.");
  if (p.wants_practical === true)
    lines.push("Favor practical, actionable guidance over theory.");
  if (p.likes_followup === true)
    lines.push("Ending with one gentle follow-up question is welcome.");
  else if (p.likes_followup === false)
    lines.push("Do not end with follow-up questions.");
  if (
    typeof p.communication_style === "string" &&
    p.communication_style.trim()
  ) {
    lines.push(`Communication style: ${p.communication_style.trim()}.`);
  }
  return lines.join(" ");
}

// ---------------------------------------------------------------------------
// Chart normalization for the LLM context.
//
// The provider stores raw JSON in which a body's `position` is the SIGN
// ordinal, NOT the house, and houses must be derived whole-sign from the
// ascendant. Feeding that raw (and previously mid-truncated) JSON to the model
// caused it to misread houses, degrees and dasha timing. So we pre-compute
// clean, unambiguous facts here and hand the model ground truth it cannot
// misparse. This mirrors the frontend's charts.ts normalization.
// ---------------------------------------------------------------------------

const NAKSHATRAS = [
  "Ashwini",
  "Bharani",
  "Krittika",
  "Rohini",
  "Mrigashira",
  "Ardra",
  "Punarvasu",
  "Pushya",
  "Ashlesha",
  "Magha",
  "Purva Phalguni",
  "Uttara Phalguni",
  "Hasta",
  "Chitra",
  "Swati",
  "Vishakha",
  "Anuradha",
  "Jyeshtha",
  "Mula",
  "Purva Ashadha",
  "Uttara Ashadha",
  "Shravana",
  "Dhanishta",
  "Shatabhisha",
  "Purva Bhadrapada",
  "Uttara Bhadrapada",
  "Revati",
];
const NAK_LORDS = [
  "Ketu",
  "Venus",
  "Sun",
  "Moon",
  "Mars",
  "Rahu",
  "Jupiter",
  "Saturn",
  "Mercury",
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ctxPick(obj: any, ...keys: string[]): any {
  for (const k of keys) if (obj && obj[k] != null) return obj[k];
  return undefined;
}

function ctxNum(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (v != null && v !== "" && !Number.isNaN(Number(v))) return Number(v);
  return null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function deepFindArray(payload: any, keys: string[]): any[] {
  if (!payload || typeof payload !== "object") return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const queue: any[] = [payload];
  while (queue.length) {
    const cur = queue.shift();
    if (!cur || typeof cur !== "object") continue;
    for (const k of keys) if (Array.isArray(cur[k])) return cur[k];
    for (const v of Object.values(cur)) {
      if (v && typeof v === "object") queue.push(v);
    }
  }
  return [];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isPlanetLike(o: any): boolean {
  return (
    !!o &&
    typeof o === "object" &&
    (o.rasi != null ||
      o.sign != null ||
      o.zodiac != null ||
      o.longitude != null)
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractPlanetArray(payload: any): any[] {
  const keyed = deepFindArray(payload, [
    "planet_position",
    "planetPosition",
    "planets",
  ]);
  if (keyed.length) return keyed;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const queue: any[] = [payload];
  while (queue.length) {
    const cur = queue.shift();
    if (!cur || typeof cur !== "object") continue;
    if (Array.isArray(cur)) {
      if (cur.length && cur.every(isPlanetLike)) return cur;
      for (const v of cur) if (v && typeof v === "object") queue.push(v);
      continue;
    }
    for (const v of Object.values(cur)) {
      if (v && typeof v === "object") queue.push(v);
    }
  }
  return [];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ctxRasiId(p: any): number | null {
  const r = p?.rasi ?? p?.sign ?? p?.zodiac;
  return ctxNum(r?.id);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ctxIsAsc(p: any): boolean {
  const name = String(p?.name ?? p?.planet ?? "")
    .trim()
    .toLowerCase();
  const id = p?.id;
  return name === "ascendant" || name === "lagna" || id === 100 || id === "100";
}

function ctxNakshatra(
  lonRaw: number,
): { name: string; lord: string; pada: number } | null {
  if (!Number.isFinite(lonRaw)) return null;
  const lon = ((lonRaw % 360) + 360) % 360;
  const SPAN = 360 / 27;
  const PADA = SPAN / 4;
  const idx = Math.floor(lon / SPAN);
  const pada = Math.floor((lon % SPAN) / PADA) + 1;
  return { name: NAKSHATRAS[idx], lord: NAK_LORDS[idx % 9], pada };
}

function ctxDate(s: unknown): string {
  const str = String(s ?? "");
  const d = new Date(str);
  if (Number.isNaN(d.getTime())) return str;
  return d.toISOString().slice(0, 10);
}

// ----- Planet dignity & state helpers (Parasara tradition) -----
// Sign indices are 0-based: 0 = Aries ... 10 = Aquarius, 11 = Pisces
// (matches the provider's rasi.id numbering).

// Navamsa (D9) sign index from sidereal longitude. Each navamsa spans
// 3\u00B020' (30/9). Counting navamsas from 0\u00B0 Aries and taking modulo 12
// yields the correct navamsa sign for movable, fixed and dual signs alike.
function navamsaSignIndex(lon: number): number {
  const L = ((lon % 360) + 360) % 360;
  return Math.floor(L / (30 / 9)) % 12;
}

type Dignity = {
  exaltSign: number;
  exaltDeg: number;
  debilSign: number;
  own: number[];
  moola?: { sign: number; from: number; to: number };
};

const DIGNITY: Record<string, Dignity> = {
  sun: {
    exaltSign: 0,
    exaltDeg: 10,
    debilSign: 6,
    own: [4],
    moola: { sign: 4, from: 0, to: 20 },
  },
  moon: { exaltSign: 1, exaltDeg: 3, debilSign: 7, own: [3] },
  mars: {
    exaltSign: 9,
    exaltDeg: 28,
    debilSign: 3,
    own: [0, 7],
    moola: { sign: 0, from: 0, to: 12 },
  },
  mercury: { exaltSign: 5, exaltDeg: 15, debilSign: 11, own: [2, 5] },
  jupiter: {
    exaltSign: 3,
    exaltDeg: 5,
    debilSign: 9,
    own: [8, 11],
    moola: { sign: 8, from: 0, to: 10 },
  },
  venus: {
    exaltSign: 11,
    exaltDeg: 27,
    debilSign: 5,
    own: [1, 6],
    moola: { sign: 6, from: 0, to: 15 },
  },
  saturn: {
    exaltSign: 6,
    exaltDeg: 20,
    debilSign: 0,
    own: [9, 10],
    moola: { sign: 10, from: 0, to: 20 },
  },
};

const PLANET_ALIAS: Record<string, string> = {
  surya: "sun",
  ravi: "sun",
  chandra: "moon",
  mangala: "mars",
  mangal: "mars",
  kuja: "mars",
  angaraka: "mars",
  budha: "mercury",
  budh: "mercury",
  guru: "jupiter",
  brihaspati: "jupiter",
  shukra: "venus",
  sukra: "venus",
  shani: "saturn",
  sani: "saturn",
};

const COMBUST_ORB: Record<string, { normal: number; retro?: number }> = {
  moon: { normal: 12 },
  mars: { normal: 17 },
  mercury: { normal: 14, retro: 12 },
  jupiter: { normal: 11 },
  venus: { normal: 10, retro: 8 },
  saturn: { normal: 15 },
};

function normPlanetKey(name: string): string {
  const n = name.trim().toLowerCase();
  return PLANET_ALIAS[n] ?? n;
}

function angularSep(a: number, b: number): number {
  let d = Math.abs(a - b) % 360;
  if (d > 180) d = 360 - d;
  return d;
}

// Returns readable state tags for a planet in the D1 chart: dignity
// (Exalted / Debilitated / Moolatrikona / Own sign), Combust, Vargottama and
// Retrograde. Dignity and combustion are not applied to Rahu/Ketu.
function planetStates(args: {
  name: string;
  lon: number | null;
  degInSign: number | null;
  signIdx: number | null;
  retro: boolean;
  sunLon: number | null;
}): string[] {
  const { name, lon, degInSign, signIdx, retro, sunLon } = args;
  const key = normPlanetKey(name);
  const tags: string[] = [];

  const dig = DIGNITY[key];
  if (dig && signIdx != null) {
    if (signIdx === dig.exaltSign) {
      const deep = degInSign != null && Math.abs(degInSign - dig.exaltDeg) <= 1;
      tags.push(deep ? "Exalted (deep)" : "Exalted");
    } else if (signIdx === dig.debilSign) {
      const deep = degInSign != null && Math.abs(degInSign - dig.exaltDeg) <= 1;
      tags.push(deep ? "Debilitated (deep)" : "Debilitated");
    } else if (
      dig.moola &&
      signIdx === dig.moola.sign &&
      degInSign != null &&
      degInSign >= dig.moola.from &&
      degInSign <= dig.moola.to
    ) {
      tags.push("Moolatrikona");
    } else if (dig.own.includes(signIdx)) {
      tags.push("Own sign");
    }
  }

  const orb = COMBUST_ORB[key];
  if (orb && lon != null && sunLon != null) {
    const limit = retro && orb.retro != null ? orb.retro : orb.normal;
    if (angularSep(lon, sunLon) <= limit) tags.push("Combust");
  }

  if (lon != null && signIdx != null && navamsaSignIndex(lon) === signIdx) {
    tags.push("Vargottama");
  }

  if (retro) tags.push("Retrograde");
  return tags;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatNatal(natal: any): string | null {
  const arr = extractPlanetArray(natal);
  if (!arr.length) return null;
  const asc = arr.find(ctxIsAsc);
  const ascRasiId = asc ? ctxRasiId(asc) : null;
  const lines: string[] = [];
  if (asc) {
    const ascRasi = asc.rasi ?? asc.sign ?? asc.zodiac ?? {};
    const ascSign = String(ascRasi?.name ?? "");
    const ascDeg = ctxNum(ctxPick(asc, "degree"));
    const ascLon = ctxNum(ctxPick(asc, "longitude", "long", "lon"));
    const deg = ascDeg != null ? ascDeg : ascLon != null ? ascLon % 30 : null;
    lines.push(
      `Ascendant (Lagna): ${ascSign || "?"}${deg != null ? " " + deg.toFixed(2) + "\u00B0" : ""}`,
    );
  }
  const sunEntry = arr.find(
    (p) =>
      !ctxIsAsc(p) &&
      normPlanetKey(String(ctxPick(p, "name", "planet") ?? "")) === "sun",
  );
  let sunLon: number | null = null;
  if (sunEntry) {
    const sLon = ctxNum(ctxPick(sunEntry, "longitude", "long", "lon"));
    const sRasi = ctxRasiId(sunEntry);
    const sDeg = ctxNum(ctxPick(sunEntry, "degree"));
    sunLon =
      sLon != null
        ? sLon
        : sRasi != null && sDeg != null
          ? sRasi * 30 + sDeg
          : null;
  }
  let planetCount = 0;
  for (const p of arr) {
    if (ctxIsAsc(p)) continue;
    const name = String(ctxPick(p, "name", "planet") ?? "").trim();
    if (!name) continue;
    const rasi = p.rasi ?? p.sign ?? p.zodiac ?? {};
    const signName = String(rasi?.name ?? "");
    const lord =
      typeof rasi?.lord === "string"
        ? rasi.lord
        : String(rasi?.lord?.vedic_name ?? rasi?.lord?.name ?? "");
    const rasiId = ctxRasiId(p);
    let house: number | null = null;
    if (ascRasiId != null && rasiId != null) {
      house = ((rasiId - ascRasiId + 12) % 12) + 1;
    }
    const degRaw = ctxNum(ctxPick(p, "degree"));
    const lon = ctxNum(ctxPick(p, "longitude", "long", "lon"));
    const degInSign = degRaw != null ? degRaw : lon != null ? lon % 30 : null;
    const nak = lon != null ? ctxNakshatra(lon) : null;
    const retro = Boolean(
      ctxPick(p, "is_retrograde", "isRetrograde", "retrograde", "retro"),
    );
    const parts = [
      `${name}:`,
      `${signName || "?"}${degInSign != null ? " " + degInSign.toFixed(2) + "\u00B0" : ""}`,
      house != null ? `in House ${house}` : "in House ?",
    ];
    if (lord) parts.push(`(sign lord: ${lord})`);
    if (nak) {
      parts.push(
        `nakshatra ${nak.name} pada ${nak.pada}, nakshatra lord ${nak.lord}`,
      );
    }
    const effLon =
      lon != null
        ? lon
        : rasiId != null && degInSign != null
          ? rasiId * 30 + degInSign
          : null;
    const states = planetStates({
      name,
      lon: effLon,
      degInSign,
      signIdx: rasiId,
      retro,
      sunLon,
    });
    if (states.length) parts.push(`[${states.join(", ")}]`);
    lines.push("- " + parts.join(" "));
    planetCount++;
  }
  if (!planetCount) return null;
  return lines.join("\n");
}

// ---------- Placement guardrail (deterministic anti-fabrication net) ----------
// Enterprise safety net: an LLM must never state a planetary placement that
// contradicts the authoritative computed chart(s). We parse the exact placements
// out of the SAME context we send the model (the formatNatal lines for the user
// AND any attached FOCUS PERSON), then verify the reply against them. A claim is a
// violation only if it contradicts EVERY chart in context (union of allowed
// values) -> high precision, and it fails open so it can never break the chat.
function parsePlacementTruth(
  contextText: string,
): Map<string, { houses: Set<number>; signs: Set<string> }> {
  const truth = new Map<string, { houses: Set<number>; signs: Set<string> }>();
  if (!contextText) return truth;
  // formatNatal emits: "- Venus: Libra 18.22\u00B0 in House 1 (sign lord: Venus) ..."
  const re =
    /^-\s+([A-Za-z][A-Za-z ]*?):\s+([A-Za-z]+)\s+[\d.]+\u00B0\s+in House (\d+)/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(contextText)) !== null) {
    const planet = m[1].trim().toLowerCase();
    const sign = m[2].trim().toLowerCase();
    const house = parseInt(m[3], 10);
    if (!truth.has(planet))
      truth.set(planet, { houses: new Set(), signs: new Set() });
    const t = truth.get(planet)!;
    if (Number.isFinite(house)) t.houses.add(house);
    if (sign) t.signs.add(sign);
  }
  return truth;
}

function verifyReplyPlacements(
  reply: string,
  truth: Map<string, { houses: Set<number>; signs: Set<string> }>,
): string[] {
  const violations: string[] = [];
  if (!reply || truth.size === 0) return violations;
  const HOUSE_WORDS: Record<string, number> = {
    first: 1,
    second: 2,
    third: 3,
    fourth: 4,
    fifth: 5,
    sixth: 6,
    seventh: 7,
    eighth: 8,
    ninth: 9,
    tenth: 10,
    eleventh: 11,
    twelfth: 12,
  };
  const SIGNS = [
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
  ];
  const LORD_WORDS = [
    "lord",
    "ruler",
    "rules",
    "ruling",
    "owner",
    "owns",
    "governs",
    "governing",
    "dispositor",
  ];
  const lower = reply.toLowerCase();
  const houseRe =
    /\b(?:in|placed in|sits in|sitting in|occupies|occupying|resides in|residing in|positioned in|located in)\b[^.]{0,30}?\b(\d{1,2}(?:st|nd|rd|th)?|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth)\s+house\b/;
  const signRe = /\bin\s+(?:the\s+sign\s+of\s+)?([a-z]+)\b/;
  for (const [planet, t] of truth) {
    let idx = lower.indexOf(planet);
    while (idx !== -1) {
      const win = lower.slice(idx, idx + 90);
      if (t.houses.size) {
        const hm = win.match(houseRe);
        if (hm) {
          const between = win.slice(0, hm.index ?? 0);
          if (!LORD_WORDS.some((w) => between.includes(w))) {
            const raw = hm[1];
            let n = HOUSE_WORDS[raw];
            if (n == null) n = parseInt(raw, 10);
            if (Number.isFinite(n) && n >= 1 && n <= 12 && !t.houses.has(n)) {
              violations.push(
                planet +
                  ": reply says house " +
                  n +
                  " but computed house(s) = " +
                  Array.from(t.houses).join("/"),
              );
            }
          }
        }
      }
      if (t.signs.size) {
        const sm = win.match(signRe);
        if (sm) {
          const s = sm[1];
          if (SIGNS.includes(s)) {
            const between = win.slice(0, sm.index ?? 0);
            if (
              !LORD_WORDS.some((w) => between.includes(w)) &&
              !t.signs.has(s)
            ) {
              violations.push(
                planet +
                  ": reply says sign " +
                  s +
                  " but computed sign(s) = " +
                  Array.from(t.signs).join("/"),
              );
            }
          }
        }
      }
      idx = lower.indexOf(planet, idx + planet.length);
    }
  }
  return violations;
}

// ---------- CI-2 Trust: answer provenance + a calm, honest confidence tag ----------
// Zero extra model call. We reuse the SAME grounded placements already sent to the
// model (parsePlacementTruth), detect which of them the reply leans on, and whether
// the answer is forward-looking. Persisted to chat_messages.metadata so the UI can
// show "the chart behind this" + a confidence tag, and feedback can attach to a
// concrete, still-meaningful prediction. Never throws (callers stay best-effort).
type AnswerProvenance = {
  version: number;
  confidence: "high" | "medium" | "low" | null;
  is_prediction: boolean;
  chart_loaded: boolean;
  basis: string[];
  has_remedy: boolean;
};

function buildAnswerProvenance(
  reply: string,
  contextText: string,
): AnswerProvenance {
  const ctx = String(contextText || "");
  const out: AnswerProvenance = {
    version: 1,
    confidence: null,
    is_prediction: false,
    // The emitted sentinel reads "CHART_NOT_LOADED \u2014 ..."; the instruction text
    // uses "CHART_NOT_LOADED, ...", so this only trips on a real missing chart.
    chart_loaded: !ctx.includes("CHART_NOT_LOADED \u2014"),
    basis: [],
    has_remedy: false,
  };
  try {
    const text = String(reply || "");
    if (!text.trim()) return out;
    const lower = text.toLowerCase();

    // 1) Which grounded natal placements does the reply actually reference?
    const truth = parsePlacementTruth(ctx);
    const CAP: Record<string, string> = {
      ascendant: "Ascendant",
      sun: "Sun",
      moon: "Moon",
      mercury: "Mercury",
      venus: "Venus",
      mars: "Mars",
      jupiter: "Jupiter",
      saturn: "Saturn",
      rahu: "Rahu",
      ketu: "Ketu",
    };
    const cap = (w: string) => CAP[w] || w.charAt(0).toUpperCase() + w.slice(1);
    for (const [planet, t] of truth) {
      if (out.basis.length >= 6) break;
      const p = planet.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (!new RegExp("\\b" + p + "\\b").test(lower)) continue;
      const sign = t.signs.size ? cap(Array.from(t.signs)[0]) : null;
      const house = t.houses.size ? Array.from(t.houses)[0] : null;
      let s = cap(planet);
      if (sign && house != null) s += " in " + sign + " (House " + house + ")";
      else if (sign) s += " in " + sign;
      else if (house != null) s += " in House " + house;
      out.basis.push(s);
    }

    // 2) Non-natal chart mechanics the answer leans on.
    const has = (arr: string[]) => arr.some((w) => lower.includes(w));
    if (
      has([
        "dasha",
        "mahadasha",
        "antardasha",
        "vimshottari",
        "vimśottarī",
        "daśā",
        "दशा",
        "महादशा",
      ])
    )
      out.basis.push("Vimśottarī daśā period");
    if (
      has([
        "transit",
        "gochar",
        "gochara",
        "गोचर",
        "current sky",
        "currently moving through",
      ])
    )
      out.basis.push("Current transits (gochara)");
    if (has(["nakshatra", "नक्षत्र"])) out.basis.push("Nakshatra placement");

    // 3) Forward-looking prediction? (inherently less certain, even if grounded)
    const PREDICTION_WORDS = [
      "will ",
      "going to",
      "upcoming",
      "in the future",
      "future",
      "next year",
      "next month",
      "coming month",
      "coming week",
      "coming year",
      "timing",
      "when will",
      "predict",
      "forecast",
      "expect",
      "likely",
      "period ahead",
      "bhavishya",
      "hoga",
      "hogi",
      "honge",
      "aane wala",
      "aane wali",
      "भविष्य",
      "होगा",
      "होगी",
      "कब",
      "आने वाला",
      "होणार",
    ];
    out.is_prediction = PREDICTION_WORDS.some((w) => lower.includes(w));

    // 5) Did the answer actually suggest a remedy/upaya? Lets the UI ask
    // "did the remedy help?" ONLY on replies that contain one.
    const REMEDY_WORDS = [
      "remedy",
      "remedies",
      "upaya",
      "upay",
      "mantra",
      "chant",
      "recite",
      "gemstone",
      "rudraksha",
      "yantra",
      "donate",
      "donation",
      "charity",
      "puja",
      "pooja",
      "fasting",
      "fast on",
      "offer water",
      "light a lamp",
      "उपाय",
      "मंत्र",
      "रत्न",
      "दान",
      "पूजा",
      "व्रत",
      "जप",
      "यंत्र",
    ];
    out.has_remedy = REMEDY_WORDS.some((w) => lower.includes(w));

    // 4) Calibrate a calm, honest confidence.
    const grounded = out.basis.length;
    if (!out.chart_loaded) out.confidence = "low";
    else if (grounded === 0) out.confidence = null;
    else if (out.is_prediction) out.confidence = "medium";
    else if (grounded >= 2) out.confidence = "high";
    else out.confidence = "medium";
  } catch (_e) {
    /* best-effort: never break persistence over provenance */
  }
  return out;
}

// ---------- Divisional charts (Shodasavarga D1-D60) ----------
// Three-letter sign labels, 0 = Aries .. 11 = Pisces.
const SIGN_ABBR = [
  "Ari",
  "Tau",
  "Gem",
  "Can",
  "Leo",
  "Vir",
  "Lib",
  "Sco",
  "Sag",
  "Cap",
  "Aqu",
  "Pis",
];

// ---------- Current sky (Gochara / live transits) ----------
// Full sign names, 0 = Aries .. 11 = Pisces (matches the 0-based sign index
// used in the transit_* tables and in the natal rasi.id numbering).
const SIGN_FULL = [
  "Aries",
  "Taurus",
  "Gemini",
  "Cancer",
  "Leo",
  "Virgo",
  "Libra",
  "Scorpio",
  "Sagittarius",
  "Capricorn",
  "Aquarius",
  "Pisces",
];

function skyNorm360(x: number): number {
  return ((x % 360) + 360) % 360;
}

function skySignName(idx: number): string {
  return Number.isInteger(idx) && idx >= 0 && idx < 12 ? SIGN_FULL[idx] : "?";
}

function skyNakName(idx: number | null): string {
  return idx != null && Number.isInteger(idx) && idx >= 0 && idx < 27
    ? NAKSHATRAS[idx]
    : "?";
}

// Whole-sign house of a transiting sign counted from a natal reference sign.
function skyHouse(signIdx: number, refSignIdx: number | null): number | null {
  if (refSignIdx == null || !Number.isInteger(signIdx)) return null;
  return ((signIdx - refSignIdx + 12) % 12) + 1;
}

function skyDeg(deg: number | null): string {
  return deg != null && Number.isFinite(deg) ? deg.toFixed(2) + "°" : "";
}

// Order + labels for the transit_planets rows, keyed by their planet id.
const TRANSIT_PLANET_ORDER = [
  { id: 0, name: "Sun" },
  { id: 2, name: "Mercury" },
  { id: 3, name: "Venus" },
  { id: 4, name: "Mars" },
  { id: 5, name: "Jupiter" },
  { id: 6, name: "Saturn" },
  { id: 101, name: "Rahu" },
  { id: 102, name: "Ketu" },
];

type TransitPlanetRow = {
  planet: number;
  planet_name: string | null;
  sign: number;
  deg: number | null;
  nakshatra: number | null;
  pada: number | null;
  retrograde: boolean | null;
  next_ingress_ts: string | null;
  next_sign: number | null;
  source: string | null;
  updated_at: string | null;
};

type MoonRow = {
  slot_hour: number;
  slot_ts: string;
  moon_sign: number;
  moon_deg: number | null;
  moon_nakshatra: number | null;
  moon_pada: number | null;
};

// A near, meaningful sign-ingress note (distant linear estimates are noisy).
function skyIngressNote(
  nextTs: string | null,
  nextSign: number | null,
): string {
  if (!nextTs || nextSign == null) return "";
  const d = new Date(nextTs);
  if (Number.isNaN(d.getTime())) return "";
  const days = Math.round((d.getTime() - Date.now()) / 86400000);
  if (days < 0 || days > 45) return "";
  const when = d.toISOString().slice(0, 10);
  return (
    " [enters " +
    skySignName(nextSign) +
    " ~" +
    when +
    (days <= 14 ? " (~" + days + "d)" : "") +
    "]"
  );
}

function formatCurrentSky(args: {
  planets: TransitPlanetRow[];
  moon: MoonRow | null;
  natalAscSign: number | null;
  natalMoonSign: number | null;
  liveAsc: { sign: number; deg: number } | null;
}): string | null {
  const { planets, moon, natalAscSign, natalMoonSign, liveAsc } = args;
  const byId: Record<number, TransitPlanetRow> = {};
  for (const p of planets) byId[p.planet] = p;
  const lines: string[] = [];

  if (liveAsc) {
    const nk = ctxNakshatra(liveAsc.sign * 30 + liveAsc.deg);
    lines.push(
      "Ascendant rising NOW: " +
        skySignName(liveAsc.sign) +
        " " +
        skyDeg(liveAsc.deg) +
        (nk ? " - nakshatra " + nk.name + " pada " + nk.pada : ""),
    );
  }

  if (moon) {
    const h = skyHouse(moon.moon_sign, natalAscSign);
    lines.push(
      "Moon: " +
        skySignName(moon.moon_sign) +
        " " +
        skyDeg(moon.moon_deg) +
        (h != null ? " - House " + h : "") +
        (moon.moon_nakshatra != null
          ? " - nakshatra " +
            skyNakName(moon.moon_nakshatra) +
            " pada " +
            (moon.moon_pada ?? "?")
          : ""),
    );
  }

  for (const entry of TRANSIT_PLANET_ORDER) {
    const p = byId[entry.id];
    if (!p) continue;
    const h = skyHouse(p.sign, natalAscSign);
    const retro = p.retrograde ? " (R)" : "";
    const nk =
      p.nakshatra != null
        ? " - nakshatra " + skyNakName(p.nakshatra) + " pada " + (p.pada ?? "?")
        : "";
    lines.push(
      entry.name +
        ": " +
        skySignName(p.sign) +
        " " +
        skyDeg(p.deg) +
        retro +
        (h != null ? " - House " + h : "") +
        nk +
        skyIngressNote(p.next_ingress_ts, p.next_sign),
    );
  }

  if (!lines.length) return null;

  const ref =
    "Houses above are whole-sign from the natal Ascendant (" +
    (natalAscSign != null ? skySignName(natalAscSign) : "?") +
    "). Natal Moon sign is " +
    (natalMoonSign != null ? skySignName(natalMoonSign) : "?") +
    " - for Chandra-lagna (Moon-based) gochara, count these same planets from the natal Moon sign instead.";

  return lines.join("\n") + "\n" + ref;
}

// Dignity of a planet purely by the sign it sits in (used for divisional
// charts, where we resolve the sign but not the degree). Not for Rahu/Ketu.
function dignityBySign(key: string, signIdx: number): string | null {
  const dig = DIGNITY[key];
  if (!dig) return null;
  if (signIdx === dig.exaltSign) return "Exalted";
  if (signIdx === dig.debilSign) return "Debilitated";
  if (dig.own.includes(signIdx)) return "Own sign";
  return null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatDasha(dasha: any): string | null {
  const periods = deepFindArray(dasha, ["dasha_periods", "dashaPeriods"]);
  if (!periods.length) return null;
  const now = Date.now();
  const lines: string[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const within = (x: any) => {
    const s = new Date(x?.start).getTime();
    const e = new Date(x?.end).getTime();
    return Number.isFinite(s) && Number.isFinite(e) && now >= s && now <= e;
  };
  const curMaha = periods.find(within);
  if (curMaha) {
    lines.push(
      "As of TODAY, the CURRENTLY RUNNING periods are (state these exactly \u2014 do not work them out from dates yourself):",
    );
    lines.push(
      `Current Mahadasha: ${curMaha.name} (${ctxDate(curMaha.start)} \u2192 ${ctxDate(
        curMaha.end,
      )}).`,
    );
    const antars = Array.isArray(curMaha.antardasha) ? curMaha.antardasha : [];
    const curAntar = antars.find(within);
    if (curAntar) {
      lines.push(
        `Current Antardasha (sub-period): ${curMaha.name}\u2013${curAntar.name} (${ctxDate(
          curAntar.start,
        )} \u2192 ${ctxDate(curAntar.end)}).`,
      );
      const praty = Array.isArray(curAntar.pratyantardasha)
        ? curAntar.pratyantardasha
        : [];
      const curPraty = praty.find(within);
      if (curPraty) {
        lines.push(
          `Current Pratyantardasha: ${curPraty.name} (${ctxDate(
            curPraty.start,
          )} \u2192 ${ctxDate(curPraty.end)}).`,
        );
      }
    }
  }
  const upcoming = periods
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((m: any) => new Date(m?.start).getTime() > now)
    .slice(0, 5);
  if (upcoming.length) {
    lines.push("Mahadashas still to come (future \u2014 NOT current):");
    for (const m of upcoming) {
      lines.push(`  - ${m.name}: ${ctxDate(m.start)} \u2192 ${ctxDate(m.end)}`);
    }
  }
  return lines.length ? lines.join("\n") : null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatDoshas(list: any[]): string | null {
  if (!list?.length) return null;
  const lines: string[] = [];
  for (const raw of list) {
    const d = raw?.data?.data ?? raw?.data ?? raw;
    if (!d || typeof d !== "object") continue;
    // Sade Sati is now computed locally in its own SADE SATI section; skip any
    // Prokerala Sade Sati payload so the model never echoes it.
    if (d.is_in_sade_sati !== undefined || d.sade_sati) continue;
    const label =
      d.mangal_dosha || d.has_mangal_dosha !== undefined
        ? "Mangal Dosha"
        : d.kaal_sarp_dosha || d.has_kaal_sarp_dosha !== undefined
          ? "Kaal Sarp Dosha"
          : "Dosha";
    const has =
      ctxPick(d, "has_dosha", "has_mangal_dosha", "has_kaal_sarp_dosha") ??
      (d?.mangal_dosha?.has_dosha as unknown) ??
      (d?.kaal_sarp_dosha?.has_dosha as unknown);
    const desc = String(
      ctxPick(d, "description") ??
        d?.mangal_dosha?.description ??
        d?.kaal_sarp_dosha?.description ??
        "",
    ).slice(0, 700);
    const hasStr =
      has === true ? "PRESENT" : has === false ? "not present" : "see details";
    lines.push(`- ${label}: ${hasStr}${desc ? " \u2014 " + desc : ""}`);
  }
  return lines.length ? lines.join("\n") : null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
// Prokerala planet ids used in bhinnashtakavarga requests (stamped into the
// artifact's _report by the gateway).
const AV_PLANET_BY_ID: Record<string, string> = {
  "0": "Sun",
  "1": "Moon",
  "2": "Mercury",
  "3": "Venus",
  "4": "Mars",
  "5": "Jupiter",
  "6": "Saturn",
};

// Pull the RAW bindu grid (prastara) for an ashtakavarga artifact, NOT the
// reduced trikona grid. Sarva lives under data.sarvashtakavarga, each planetary
// Bhinna under data.ashtakavarga. We navigate explicitly because a generic deep
// search would return the trikona "houses" array first (it appears earlier).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function avPrastaraHouses(root: any, key: string): any[] {
  const data = root?.data ?? root;
  const node = data?.[key];
  const houses = node?.prastara?.houses ?? node?.houses;
  return Array.isArray(houses) ? houses : [];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatAvHouses(houses: any[]): string | null {
  const parts: string[] = [];
  let total = 0;
  for (const h of houses) {
    const sign = String(h?.rasi?.name ?? h?.sign?.name ?? h?.sign ?? "").trim();
    const num = ctxNum(ctxPick(h?.house, "number", "id"));
    const score = ctxNum(
      ctxPick(h, "score", "points", "total", "ashtakavarga_points"),
    );
    if (!sign || score == null) continue;
    total += score;
    parts.push(num != null ? `H${num} ${sign}: ${score}` : `${sign}: ${score}`);
  }
  if (!parts.length) return null;
  return parts.join(", ") + ` (total ${total})`;
}

// Our chart_type enum for each varga (must match chart-gateway's slug map keys).
const VARGA_TO_ENUM: Record<string, string> = {
  D1: "d1_rashi",
  D2: "d2_hora",
  D3: "d3_drekkana",
  D4: "d4_chaturthamsha",
  D7: "d7_saptamsha",
  D9: "d9_navamsha",
  D10: "d10_dashamsha",
  D12: "d12_dwadashamsha",
  D16: "d16_shodashamsha",
  D20: "d20_vimshamsha",
  D24: "d24_chaturvimshamsha",
  D27: "d27_bhamsha",
  D30: "d30_trimshamsha",
  D40: "d40_khavedamsha",
  D45: "d45_akshavedamsha",
  D60: "d60_shashtiamsha",
};

type ParsedVarga = {
  ascSignIndex: number; // 0 = Aries .. 11 = Pisces
  positions: Array<{ key: string; signIndex: number; house: number }>;
};

const DIV_PLANET_ORDER = [
  "sun",
  "moon",
  "mars",
  "mercury",
  "jupiter",
  "venus",
  "saturn",
  "rahu",
  "ketu",
];
const DIV_PLANET_NAME: Record<string, string> = {
  sun: "Sun",
  moon: "Moon",
  mars: "Mars",
  mercury: "Mercury",
  jupiter: "Jupiter",
  venus: "Venus",
  saturn: "Saturn",
  rahu: "Rahu",
  ketu: "Ketu",
};

// Build the DIVISIONAL CHARTS fact block from parsed Prokerala varga SVGs:
// each body's sign AND whole-sign house per varga, Vargottama (D1 vs D9 by
// Prokerala's own charts), and a dignity-by-sign tally. Matches the app tables.
function formatDivisionalFromParsed(
  parsedByVarga: Record<string, ParsedVarga | null>,
): string | null {
  const order = Object.keys(VARGA_TO_ENUM); // D1..D60, classical order
  const available = order.filter((v) => parsedByVarga[v]);
  if (!available.length) return null;

  const signOf = (v: string, key: string): number | null => {
    const pv = parsedByVarga[v];
    if (!pv) return null;
    const p = pv.positions.find((x) => x.key === key);
    return p ? p.signIndex : null;
  };

  const lines: string[] = [];

  // Ascendant: sign per varga (its house is always 1 by definition).
  const ascEntries = available.map(
    (v) => `${v} ${SIGN_ABBR[parsedByVarga[v]!.ascSignIndex]}`,
  );
  lines.push(`- Ascendant (Lagna): [${ascEntries.join(", ")}]`);

  for (const key of DIV_PLANET_ORDER) {
    const entries: string[] = [];
    for (const v of available) {
      const pos = parsedByVarga[v]!.positions.find((x) => x.key === key);
      if (!pos) continue;
      entries.push(`${v} ${SIGN_ABBR[pos.signIndex]} H${pos.house}`);
    }
    if (!entries.length) continue;
    let line = `- ${DIV_PLANET_NAME[key]}: [${entries.join(", ")}]`;
    const s1 = signOf("D1", key);
    const s9 = signOf("D9", key);
    if (s1 != null && s9 != null) {
      line += `. Vargottama: ${s1 === s9 ? "yes" : "no"}`;
    }
    if (DIGNITY[key]) {
      const keyDigs: string[] = [];
      const d9dig = s9 != null ? dignityBySign(key, s9) : null;
      const s10 = signOf("D10", key);
      const s60 = signOf("D60", key);
      const d10dig = s10 != null ? dignityBySign(key, s10) : null;
      const d60dig = s60 != null ? dignityBySign(key, s60) : null;
      if (d9dig) keyDigs.push(`D9 ${d9dig}`);
      if (d10dig) keyDigs.push(`D10 ${d10dig}`);
      if (d60dig) keyDigs.push(`D60 ${d60dig}`);
      if (keyDigs.length) line += `. Dignity — ${keyDigs.join(", ")}`;
      let strong = 0;
      let weak = 0;
      let counted = 0;
      for (const v of available) {
        const si = signOf(v, key);
        if (si == null) continue;
        counted++;
        const dg = dignityBySign(key, si);
        if (dg === "Exalted" || dg === "Own sign") strong++;
        else if (dg === "Debilitated") weak++;
      }
      if (counted)
        line += `. Overall: strong (own/exalted) in ${strong}/${counted} vargas, debilitated in ${weak}/${counted}`;
    }
    lines.push(line);
  }
  return lines.length ? lines.join("\n") : null;
}

// @ts-ignore - EdgeRuntime is provided by the Supabase Edge runtime.
declare const EdgeRuntime: any;

// Schedule background work that should outlive the response. Supabase keeps the
// worker alive for waitUntil promises; otherwise we fall back to fire-and-forget.
function runBackground(task: Promise<unknown>): void {
  const guarded = Promise.resolve(task).catch(() => {});
  try {
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) {
      EdgeRuntime.waitUntil(guarded);
      return;
    }
  } catch {
    /* fall through to fire-and-forget */
  }
  void guarded;
}

// Defensively parse a { "summary", "facts" } JSON object from a model reply,
// tolerating code fences or stray prose around it. Returns null if unusable.
function parseSummaryFactsJson(
  raw: string,
): { summary: string; facts: string } | null {
  let text = raw.trim();
  const fence = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fence) text = fence[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const obj = JSON.parse(text.slice(start, end + 1)) as {
      summary?: unknown;
      facts?: unknown;
    };
    const summary = typeof obj.summary === "string" ? obj.summary.trim() : "";
    const facts = typeof obj.facts === "string" ? obj.facts.trim() : "";
    if (!summary && !facts) return null;
    return { summary, facts };
  } catch {
    return null;
  }
}

// Defensively parse the richer Companion-Intelligence memory JSON
// ({ summary, facts, topics[], preferences{}, emotional{} }) from a model
// reply, tolerating code fences or stray prose. Returns null if unusable.
type CompanionTopicMemory = {
  topic: string;
  summary: string;
  data: Record<string, unknown>;
  confidence: number | null;
};
type CompanionEmotional = {
  state: Record<string, unknown>;
  ttlDays: number | null;
};
type CompanionLifeEvent = {
  title: string;
  description: string | null;
  category: string;
  eventDate: string;
  datePrecision: string;
  valence: string | null;
  confidence: string | null;
};
function parseCompanionMemoryJson(raw: string): {
  summary: string;
  facts: string;
  topics: CompanionTopicMemory[];
  preferences: Record<string, unknown> | null;
  emotional: CompanionEmotional | null;
  lifeEvents: CompanionLifeEvent[];
} | null {
  let text = raw.trim();
  const fence = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fence) text = fence[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }

  const summary = typeof obj.summary === "string" ? obj.summary.trim() : "";
  const facts = typeof obj.facts === "string" ? obj.facts.trim() : "";

  const topics: CompanionTopicMemory[] = [];
  if (Array.isArray(obj.topics)) {
    for (const entry of obj.topics) {
      if (!entry || typeof entry !== "object") continue;
      const row = entry as Record<string, unknown>;
      let topic =
        typeof row.topic === "string" ? row.topic.trim().toLowerCase() : "";
      if (!topic) continue;
      if (!TOPIC_MEMORY_TOPICS.has(topic)) topic = "other";
      const tSummary =
        typeof row.summary === "string" ? row.summary.trim() : "";
      const data =
        row.data && typeof row.data === "object" && !Array.isArray(row.data)
          ? (row.data as Record<string, unknown>)
          : {};
      let confidence: number | null = null;
      if (typeof row.confidence === "number" && isFinite(row.confidence)) {
        confidence = Math.max(0, Math.min(1, row.confidence));
      }
      if (!tSummary && Object.keys(data).length === 0) continue;
      topics.push({ topic, summary: tSummary, data, confidence });
    }
  }

  let preferences: Record<string, unknown> | null = null;
  if (
    obj.preferences &&
    typeof obj.preferences === "object" &&
    !Array.isArray(obj.preferences)
  ) {
    const p = obj.preferences as Record<string, unknown>;
    if (Object.keys(p).length > 0) preferences = p;
  }

  let emotional: CompanionEmotional | null = null;
  if (
    obj.emotional &&
    typeof obj.emotional === "object" &&
    !Array.isArray(obj.emotional)
  ) {
    const e = { ...(obj.emotional as Record<string, unknown>) };
    let ttlDays: number | null = null;
    if (typeof e.ttl_days === "number" && isFinite(e.ttl_days as number)) {
      ttlDays = Math.max(1, Math.min(120, Math.round(e.ttl_days as number)));
    }
    delete e.ttl_days;
    if (Object.keys(e).length > 0) emotional = { state: e, ttlDays };
  }

  const lifeEvents: CompanionLifeEvent[] = [];
  if (Array.isArray(obj.life_events)) {
    for (const entry of obj.life_events) {
      if (!entry || typeof entry !== "object") continue;
      const row = entry as Record<string, unknown>;
      const title = typeof row.title === "string" ? row.title.trim() : "";
      if (!title) continue;
      const rawDate = typeof row.date === "string" ? row.date.trim() : "";
      const parts = rawDate.split("-");
      const digits = (s: string) =>
        s.length > 0 && [...s].every((ch) => ch >= "0" && ch <= "9");
      let eventDate = "";
      let datePrecision = "exact";
      if (
        parts.length === 3 &&
        parts[0].length === 4 &&
        digits(parts[0]) &&
        parts[1].length === 2 &&
        digits(parts[1]) &&
        parts[2].length === 2 &&
        digits(parts[2])
      ) {
        eventDate = rawDate;
        datePrecision = "exact";
      } else if (
        parts.length === 2 &&
        parts[0].length === 4 &&
        digits(parts[0]) &&
        parts[1].length === 2 &&
        digits(parts[1])
      ) {
        eventDate = rawDate + "-01";
        datePrecision = "month";
      } else if (
        parts.length === 1 &&
        parts[0].length === 4 &&
        digits(parts[0])
      ) {
        eventDate = rawDate + "-01-01";
        datePrecision = "year";
      } else {
        continue;
      }
      if (typeof row.date_precision === "string") {
        const dp = row.date_precision.trim().toLowerCase();
        if (["exact", "month", "year", "approx"].includes(dp))
          datePrecision = dp;
      }
      let category =
        typeof row.category === "string"
          ? row.category.trim().toLowerCase()
          : "other";
      if (!TOPIC_MEMORY_TOPICS.has(category)) category = "other";
      const description =
        typeof row.description === "string" && row.description.trim()
          ? row.description.trim()
          : null;
      let valence: string | null = null;
      if (typeof row.valence === "string") {
        const v = row.valence.trim().toLowerCase();
        if (["positive", "negative", "neutral", "mixed"].includes(v))
          valence = v;
      }
      let confidence: string | null = null;
      if (typeof row.confidence === "number" && isFinite(row.confidence)) {
        confidence =
          row.confidence >= 0.75
            ? "high"
            : row.confidence >= 0.4
              ? "medium"
              : "low";
      } else if (typeof row.confidence === "string") {
        const c = row.confidence.trim().toLowerCase();
        if (["high", "medium", "low"].includes(c)) confidence = c;
      }
      lifeEvents.push({
        title,
        description,
        category,
        eventDate,
        datePrecision,
        valence,
        confidence,
      });
      if (lifeEvents.length >= 8) break;
    }
  }

  if (
    !summary &&
    !facts &&
    topics.length === 0 &&
    !preferences &&
    !emotional &&
    lifeEvents.length === 0
  )
    return null;
  return { summary, facts, topics, preferences, emotional, lifeEvents };
}

// Rolling-summary + durable-facts memory. When enough messages have piled up
// beyond what the summary already covers, fold the oldest batch into a fresh
// compact summary using a cheap model; when the user has memory enabled, the
// same call also refreshes the durable, cross-conversation user-facts.
// Best-effort: any failure leaves the chat untouched.
async function maybeSummarizeConversation(opts: {
  svc: SupabaseClient;
  conversationId: string;
  userId: string;
  currentSummary: string | null;
  summarizedCount: number;
  apiKey: string;
  model: string;
  rememberFacts: boolean;
  currentFacts: string | null;
  authHeader: string;
  supabaseUrl: string;
}): Promise<void> {
  const {
    svc,
    conversationId,
    userId,
    currentSummary,
    summarizedCount,
    apiKey,
    model,
    rememberFacts,
    currentFacts,
    authHeader,
    supabaseUrl,
  } = opts;

  const { count } = await svc
    .from("chat_messages")
    .select("*", { count: "exact", head: true })
    .eq("conversation_id", conversationId)
    .eq("user_id", userId);
  const total = count ?? 0;
  if (total - summarizedCount < SUMMARY_TRIGGER) return;

  const { data: batchRows } = await svc
    .from("chat_messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .range(summarizedCount, summarizedCount + SUMMARY_FOLD_BATCH - 1);
  const batch = (batchRows ?? []) as Array<{ role: string; content: string }>;
  if (batch.length === 0) return;

  const batchText = batch
    .map(
      (m) =>
        `${m.role === "assistant" ? "Astrologer" : "Person"}: ${m.content}`,
    )
    .join("\n");

  const existingSummary =
    currentSummary && currentSummary.trim()
      ? currentSummary.trim()
      : "(none yet)";

  let sumSystem: string;
  let sumUser: string;

  if (rememberFacts) {
    const existingFacts =
      currentFacts && currentFacts.trim() ? currentFacts.trim() : "(none yet)";
    sumSystem = [
      "You maintain long-term memory for a Vedic astrology companion app, based on one ongoing conversation.",
      'Return ONLY a single JSON object with these fields: "summary" (string), "facts" (string), "topics" (array), "preferences" (object), "emotional" (object), "life_events" (array). No code fences, no commentary.',
      `"summary": an updated running summary of THIS conversation - merge the EXISTING SUMMARY with the NEW MESSAGES, under ${SUMMARY_MAX_WORDS} words, compact third-person notes, dropping greetings, small talk and repetition.`,
      `"facts": an updated list of durable facts about this specific person that stay true across conversations - their life situation, relationships, work, recurring concerns, goals, stated preferences, and important guidance already given. Merge the EXISTING FACTS with anything new and lasting from the messages, and drop anything transient or already superseded. At most 25 facts, one concise fact per line, third person, under ${FACTS_MAX_WORDS} words total.`,
      '"topics": an array of structured per-life-area memories, each an object { "topic", "summary", "data", "confidence" }. "topic" MUST be exactly one of: career, health, marriage, relationships, finance, children, education, travel, property, business, spirituality, family, other. "summary" is a one or two sentence digest of that life area for this person. "data" is a small flat object of concrete key facts (for example current_company, role, concern, goal, timeline). "confidence" is a number from 0 to 1. Only include a topic when the messages contain real signal about it; otherwise return an empty array. Never invent details.',
      '"preferences": an object capturing how this person likes to be answered, only when clearly evidenced. Recognized keys: preferred_language, preferred_tone, detail_level (one of brief, balanced, detailed), likes_tables (boolean), remedies_first (boolean), wants_practical (boolean), likes_followup (boolean), communication_style. Omit any key you are unsure about; return an empty object when nothing is clear.',
      '"emotional": a SHORT-LIVED note about the person\'s current emotional state, only if clearly present. Object with keys: mood (string), sensitivities (array of strings), guidance (array of short tone instructions), ttl_days (integer days to keep this relevant, default 14). Return an empty object when there is no clear emotional signal.',
      '"life_events": an array of REAL, dated life events the person mentions about their OWN life (for example a job change, marriage, childbirth, relocation, bereavement, a health episode, starting a business, buying property). Each item is an object { "title", "description", "category", "date", "date_precision", "valence", "confidence" }. "title" is a short label. "category" MUST be one of the topic values listed above. "date" is when it happened, given as "YYYY-MM-DD", or "YYYY-MM", or "YYYY" when only partly known; OMIT the event entirely if not even a year can be inferred. "date_precision" is one of exact, month, year, approx. "valence" is one of positive, negative, neutral, mixed. "confidence" is a number from 0 to 1. Only include events the person actually states have happened or are scheduled - never predictions, hypotheticals, or astrological transits. Return an empty array when none.',
      "Never fabricate; prefer omission over guessing.",
    ].join(" ");
    sumUser =
      "EXISTING SUMMARY:\n" +
      existingSummary +
      "\n\nEXISTING FACTS:\n" +
      existingFacts +
      "\n\nNEW MESSAGES:\n" +
      batchText;
  } else {
    sumSystem = [
      "You maintain a running MEMORY SUMMARY of an ongoing conversation between a person and their Vedic astrology companion.",
      "Merge the EXISTING SUMMARY with the NEW MESSAGES into one updated summary.",
      `Keep it under ${SUMMARY_MAX_WORDS} words.`,
      "Preserve durable, useful facts: the person's life situation, concerns, goals, relationships, decisions or timings discussed, and guidance already given.",
      "Drop greetings, small talk, and repetition. Write compact third-person notes, not dialogue.",
      "Output ONLY the updated summary text, nothing else.",
    ].join(" ");
    sumUser =
      "EXISTING SUMMARY:\n" +
      existingSummary +
      "\n\nNEW MESSAGES:\n" +
      batchText;
  }

  const res = await fetchWithTimeout(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": "https://astrosathi.app",
        "X-Title": "AstroSaathi",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: sumSystem },
          { role: "user", content: sumUser },
        ],
        temperature: 0.3,
        max_tokens: rememberFacts ? 1400 : 600,
      }),
    },
    30000,
  );
  if (!res.ok) return;
  const j = await res.json();
  const rawOut = String(j?.choices?.[0]?.message?.content ?? "").trim();
  if (!rawOut) return;

  let newSummary = "";
  let newFacts = "";
  let companion: ReturnType<typeof parseCompanionMemoryJson> = null;
  if (rememberFacts) {
    companion = parseCompanionMemoryJson(rawOut);
    if (companion) {
      newSummary = companion.summary;
      newFacts = companion.facts;
    } else {
      // Couldn't parse JSON: salvage the reply as the summary, skip structured memory.
      newSummary = rawOut;
    }
  } else {
    newSummary = rawOut;
  }

  // Only advance the fold pointer when we captured a usable summary, so the
  // conversation never loses context to a failed or empty summarization.
  if (!newSummary) return;
  await svc
    .from("chat_conversations")
    .update({
      memory_summary: newSummary,
      summarized_count: summarizedCount + batch.length,
    })
    .eq("id", conversationId)
    .eq("user_id", userId);

  // Durable facts are independent of the fold pointer and only persisted when
  // the person has memory enabled.
  if (rememberFacts && newFacts) {
    await svc.from("user_memory").upsert(
      {
        user_id: userId,
        facts: newFacts,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
  }

  // --- Companion Intelligence (CI-1.2): structured memory, preferences, emotion ---
  // Best-effort and additive. Never blocks the chat and never alters the flat
  // user_memory fallback above. All writes use the service-role client.
  if (rememberFacts && companion) {
    // 1) Structured per-topic memory: one evolving row per user x topic.
    for (const t of companion.topics) {
      try {
        await svc.from("user_topic_memory").upsert(
          {
            user_id: userId,
            topic: t.topic,
            summary: t.summary || null,
            data: t.data ?? {},
            confidence: t.confidence,
            source_conversation_id: conversationId,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,topic" },
        );
      } catch {
        // Ignore a single malformed topic row.
      }
    }

    // 2) Answer preferences: shallow-merge into profiles.preferences.
    if (companion.preferences) {
      try {
        const { data: prof } = await svc
          .from("profiles")
          .select("preferences")
          .eq("user_id", userId)
          .maybeSingle();
        const existingPrefs =
          prof &&
          typeof (prof as { preferences?: unknown }).preferences === "object" &&
          (prof as { preferences?: unknown }).preferences
            ? (prof as { preferences: Record<string, unknown> }).preferences
            : {};
        const mergedPrefs = { ...existingPrefs, ...companion.preferences };
        await svc
          .from("profiles")
          .update({ preferences: mergedPrefs })
          .eq("user_id", userId);
      } catch {
        // Ignore preference-merge failures.
      }
    }

    // 3) Short-lived emotional state: single row per user, auto-expiring.
    if (companion.emotional) {
      try {
        const ttl = companion.emotional.ttlDays ?? EMOTIONAL_DEFAULT_TTL_DAYS;
        const expiresAt = new Date(Date.now() + ttl * 86400000).toISOString();
        await svc.from("user_emotional_state").upsert(
          {
            user_id: userId,
            state: companion.emotional.state,
            expires_at: expiresAt,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" },
        );
      } catch {
        // Ignore emotional-state write failures.
      }
    }

    // 4) Life-timeline events (CI-3.3): file REAL dated events the person
    // mentioned, deduped against earlier auto-extractions, then trigger the
    // CI-3.2 stamper so each new event gets its dasha/transit context.
    if (companion.lifeEvents.length > 0) {
      try {
        const { data: existing } = await svc
          .from("user_life_events")
          .select("title, event_date")
          .eq("user_id", userId)
          .eq("source", "ai_extracted");
        const seen = new Set(
          (existing ?? []).map(
            (r: { title: string; event_date: string }) =>
              `${r.event_date}|${String(r.title).trim().toLowerCase()}`,
          ),
        );
        const toInsert: Record<string, unknown>[] = [];
        for (const le of companion.lifeEvents) {
          const key = `${le.eventDate}|${le.title.toLowerCase()}`;
          if (seen.has(key)) continue;
          seen.add(key);
          toInsert.push({
            user_id: userId,
            title: le.title,
            description: le.description,
            category: le.category,
            event_date: le.eventDate,
            date_precision: le.datePrecision,
            valence: le.valence,
            source: "ai_extracted",
            confidence: le.confidence,
            source_conversation_id: conversationId,
            astro_context: {},
          });
        }
        if (toInsert.length > 0) {
          const { error: insErr } = await svc
            .from("user_life_events")
            .insert(toInsert);
          if (insErr) {
            console.error(
              "[astrologer-chat] life_events insert failed:",
              insErr.message,
            );
          } else if (supabaseUrl && authHeader) {
            // Fire-and-forget stamping; failure just leaves events unstamped.
            try {
              await fetchWithTimeout(
                `${supabaseUrl}/functions/v1/life-event-context`,
                {
                  method: "POST",
                  headers: {
                    "content-type": "application/json",
                    Authorization: authHeader,
                  },
                  body: JSON.stringify({}),
                },
                20000,
              );
            } catch {
              // Stamping is best-effort.
            }
          }
        }
      } catch {
        // Ignore life-event write failures.
      }
    }
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return err(405, "method_not_allowed", "Only POST is supported");
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
  const MODEL =
    Deno.env.get("OPENROUTER_MODEL") || "google/gemini-2.0-flash-001";
  const SUMMARY_MODEL =
    Deno.env.get("OPENROUTER_SUMMARY_MODEL") ||
    "google/gemini-2.0-flash-lite-001";

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return err(500, "server_misconfigured", "Supabase env missing");
  }
  if (!OPENROUTER_API_KEY) {
    return err(500, "server_misconfigured", "OpenRouter API key missing");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any;
  try {
    body = await req.json();
  } catch {
    return err(400, "invalid_json", "Request body must be valid JSON");
  }

  const message = String(body.message ?? "").trim();
  if (!message) {
    return err(400, "empty_message", "A non-empty 'message' is required");
  }
  const requestedConversationId = body.conversation_id
    ? String(body.conversation_id)
    : "";
  // When true, reply is streamed token-by-token as Server-Sent Events.
  // When false/absent, the original single-shot JSON response is returned.
  const wantStream = body.stream === true;

  // Auth client (caller identity via forwarded Authorization header)
  const authHeader = req.headers.get("Authorization") ?? "";
  const authClient: SupabaseClient = createClient(SUPABASE_URL, SERVICE_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userErr } = await authClient.auth.getUser();
  if (userErr || !userData?.user) {
    return err(401, "not_authenticated");
  }
  const userId = userData.user.id;

  // Service-role client (bypasses RLS)
  const svc: SupabaseClient = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // ---------- Load grounding context ----------
  const { data: birth } = await svc
    .from("birth_profiles")
    .select(
      "full_name, birth_date, birth_time, birth_time_known, birth_place_label, birth_timezone, latitude, longitude, gender",
    )
    .eq("user_id", userId)
    .maybeSingle();

  const { data: arts } = await svc
    .from("chart_artifacts")
    .select("chart_type, chart_jsonb, created_at")
    .eq("user_id", userId)
    .in("chart_type", CONTEXT_CHART_TYPES)
    .order("created_at", { ascending: false })
    .limit(40);

  const profileGender = birth?.gender ? String(birth.gender).toLowerCase() : "";

  // Collect artifacts by type (query returns newest-first).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const byType: Record<string, any> = {};
  const doshaList: unknown[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const loShuCandidates: any[] = [];
  // All ashtakavarga artifacts (1 Sarva + up to 7 planetary Bhinna) share the
  // same chart_type, so collect them all instead of collapsing to one row.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ashtakavargaArts: any[] = [];
  for (const a of arts ?? []) {
    if (a.chart_type === "doshas") {
      if (doshaList.length < 3) doshaList.push(a.chart_jsonb);
      continue;
    }
    if (a.chart_type === "lo_shu") {
      loShuCandidates.push(a);
      continue;
    }
    if (a.chart_type === "ashtakavarga") {
      ashtakavargaArts.push(a.chart_jsonb);
      continue;
    }
    if (!(a.chart_type in byType)) byType[a.chart_type] = a.chart_jsonb;
  }

  // Lo Shu / Kua depends on gender. Multiple artifacts (e.g. from testing)
  // can coexist, so prefer the one whose Kua gender matches the user's
  // profile; otherwise fall back to the newest (arts is newest-first).
  let loShu: unknown = undefined;
  if (loShuCandidates.length) {
    let chosen = loShuCandidates[0];
    if (profileGender) {
      const match = loShuCandidates.find((a) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const g = String(
          (a.chart_jsonb as any)?.kua?.gender ?? "",
        ).toLowerCase();
        return g === profileGender;
      });
      if (match) chosen = match;
    }
    loShu = chosen.chart_jsonb;
  }

  // Build context as labelled sections. Small, high-value data (numerology,
  // Lo Shu/Kua, doshas) goes FIRST and is always kept in full; large
  // artifacts (dasha, ashtakavarga) go last and are individually capped so
  // they can never crowd the compact data out of the context window.
  const capJson = (v: unknown, max: number): string => {
    const s = JSON.stringify(v);
    return s.length > max ? s.slice(0, max) + '..."[truncated]"' : s;
  };
  const sections: string[] = [];
  if (birth) {
    sections.push(
      "BIRTH: " +
        JSON.stringify({
          name: birth.full_name ?? null,
          birth_date: birth.birth_date ?? null,
          birth_time: birth.birth_time_known
            ? (birth.birth_time ?? null)
            : null,
          birth_time_known: !!birth.birth_time_known,
          place: birth.birth_place_label ?? null,
          timezone: birth.birth_timezone ?? null,
          gender: birth.gender ?? null,
        }),
    );
  }
  // Vedic kundali is the primary lens, so the natal chart and dasha timeline
  // come first as clean, pre-computed FACTS (not raw JSON), then doshas and
  // Ashtakavarga, then numerology and Lo Shu as supporting layers. The natal
  // chart and dasha are normalized so the model reads correct houses, degrees,
  // nakshatras and timing instead of misparsing raw provider JSON.
  const natalText = byType.natal ? formatNatal(byType.natal) : null;
  if (natalText)
    sections.push(
      "VEDIC NATAL CHART (kundali) \u2014 authoritative placements. Houses are whole-sign, counted from the Ascendant. Use these EXACT signs, degrees and houses; do NOT recompute or infer them:\n" +
        natalText,
    );
  else if (byType.natal)
    sections.push(
      "VEDIC NATAL CHART (kundali) \u2014 raw data:\n" +
        capJson(byType.natal, 7000),
    );
  // Divisional charts: pull each varga's north-Indian SVG through chart-gateway
  // (Prokerala token + generation + freshness + caching all live there) and
  // parse it the SAME way the app does, so the AI reads the exact signs AND
  // houses shown in the app's varga tables/images. We never use our in-house
  // varga math here — it diverges from Prokerala for the higher divisionals.
  const parsedByVarga: Record<string, ParsedVarga | null> = {};
  {
    // Read the pre-computed varga facts that chart-gateway wrote at generation
    // time (sign + whole-sign house per body), instead of re-pulling all 16
    // varga SVGs through the gateway on every single chat message. This is ONE
    // DB read with ZERO gateway round-trips and ZERO chance of a chat message
    // triggering Prokerala spend. The facts are refreshed whenever birth data
    // changes (prime-charts regenerates them), so they always match the charts
    // shown in the app. Any varga missing from chart_facts simply stays null
    // and is skipped by formatDivisionalFromParsed — never fabricated.
    const enumToVarga: Record<string, string> = {};
    for (const [vk, en] of Object.entries(VARGA_TO_ENUM)) enumToVarga[en] = vk;
    for (const vk of Object.keys(VARGA_TO_ENUM)) parsedByVarga[vk] = null;
    const { data: factRows } = await svc
      .from("chart_facts")
      .select("chart_type, asc_sign, positions")
      .eq("user_id", userId)
      .in("chart_type", Object.values(VARGA_TO_ENUM));
    for (const row of factRows ?? []) {
      const vk = enumToVarga[row.chart_type as string];
      if (!vk) continue;
      const rawPositions = Array.isArray(row.positions) ? row.positions : [];
      const positions = rawPositions
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((p: any) => ({
          key: String(p.key),
          signIndex: Number(p.sign),
          house: Number(p.house),
        }))
        .filter(
          (p) =>
            p.key && Number.isFinite(p.signIndex) && Number.isFinite(p.house),
        );
      if (!positions.length) continue;
      const ascSignIndex = Number(row.asc_sign);
      if (!Number.isFinite(ascSignIndex)) continue;
      parsedByVarga[vk] = { ascSignIndex, positions };
    }
  }
  const divText = formatDivisionalFromParsed(parsedByVarga);
  if (divText)
    sections.push(
      "DIVISIONAL CHARTS (Shodasavarga D1\u2013D60) \u2014 read directly from this person's own Prokerala varga charts, so they MATCH the charts shown in the app exactly. Each entry gives the body's sign and its whole-sign house (Hn, counted from that varga's ascendant). Use these for finer judgement: D9/Navamsa = marriage, dharma & inner strength; D10/Dasamsa = career & status; D7 = children; D4 = home/property; D12 = parents; D24 = education; D30 = adversity & character; D60 = overall karma & fine detail. A body holding good dignity across many vargas is reliably strong; Vargottama (same sign in D1 and D9) is a major strength:\n" +
        divText,
    );
  const dashaText = byType.vimshottari_dasha
    ? formatDasha(byType.vimshottari_dasha)
    : null;
  if (dashaText)
    sections.push(
      "VIMSHOTTARI DASHA (planetary period timeline) \u2014 use for any timing / 'when' question:\n" +
        dashaText,
    );
  else if (byType.vimshottari_dasha)
    sections.push(
      "VIMSHOTTARI DASHA \u2014 raw data:\n" +
        capJson(byType.vimshottari_dasha, 6000),
    );
  const doshaText = doshaList.length ? formatDoshas(doshaList) : null;
  if (doshaText) sections.push("DOSHAS (Mangal / Kaal Sarp):\n" + doshaText);
  else if (doshaList.length)
    sections.push("DOSHAS \u2014 raw data:\n" + capJson(doshaList, 6000));
  // ASHTAKAVARGA — every stored row shares chart_type "ashtakavarga": one
  // Sarvashtakavarga (total bindus per sign, the key house-strength metric)
  // plus up to 7 planetary Bhinnashtakavarga tables. Read the RAW prastara grid
  // (what the app shows), identify Sarva by its sarvashtakavarga key, and label
  // each Bhinna from the planet id the gateway stamps into _report. Older
  // Bhinna rows written before the stamp have no recoverable planet, so we skip
  // them rather than guess — we never fabricate a planet.
  let sarvaAv: unknown = undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bhinnaByPlanet: Record<string, any> = {};
  for (const av of ashtakavargaArts) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = (av as any)?.data ?? av;
    if (data?.sarvashtakavarga) {
      if (!sarvaAv) sarvaAv = av;
      continue;
    }
    if (data?.ashtakavarga) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rep = (av as any)?._report;
      const planetId = String(rep?.params?.planet ?? rep?.planet ?? "");
      const name = AV_PLANET_BY_ID[planetId];
      if (name && !(name in bhinnaByPlanet)) bhinnaByPlanet[name] = av;
    }
  }
  const avLines: string[] = [];
  if (sarvaAv) {
    const s = formatAvHouses(avPrastaraHouses(sarvaAv, "sarvashtakavarga"));
    if (s)
      avLines.push(
        "Sarvashtakavarga (combined benefic points/bindus each sign receives across all planets; higher = stronger house):\n" +
          s,
      );
  }
  for (const key of DIV_PLANET_ORDER) {
    const name = DIV_PLANET_NAME[key];
    const av = name ? bhinnaByPlanet[name] : undefined;
    if (!av) continue;
    const s = formatAvHouses(avPrastaraHouses(av, "ashtakavarga"));
    if (s)
      avLines.push(
        "Bhinnashtakavarga " +
          name +
          " (this planet's own bindus per sign, 0-8):\n" +
          s,
      );
  }
  if (avLines.length) sections.push("ASHTAKAVARGA:\n" + avLines.join("\n"));
  if (byType.numerology)
    sections.push(
      "NUMEROLOGY (Vedic number reading \u2014 supporting layer):\n" +
        capJson(byType.numerology, 100000),
    );
  if (loShu)
    sections.push(
      "LO SHU GRID & KUA (supporting layer):\n" + capJson(loShu, 100000),
    );
  // ---------- Current sky (Gochara / live transits) ----------
  // Planets + Moon are read from the shared transit_* tables, kept fresh by the
  // transit-compute and transit-planets-refresh cron jobs. The Ascendant rising
  // right now is cast live from the validated ephemeris (its raw ascendant is
  // 180 deg off, so we correct it). This whole block does ZERO Prokerala spend.
  try {
    let natalAscSign: number | null = null;
    let natalMoonSign: number | null = null;
    if (byType.natal) {
      const natalArr = extractPlanetArray(byType.natal);
      const ascP = natalArr.find(ctxIsAsc);
      natalAscSign = ascP ? ctxRasiId(ascP) : null;
      const moonP = natalArr.find(
        (p) =>
          !ctxIsAsc(p) &&
          normPlanetKey(String(ctxPick(p, "name", "planet") ?? "")) === "moon",
      );
      natalMoonSign = moonP ? ctxRasiId(moonP) : null;
    }

    const { data: transitPlanets } = await svc
      .from("transit_planets")
      .select(
        "planet, planet_name, sign, deg, nakshatra, pada, retrograde, next_ingress_ts, next_sign, source, updated_at",
      );

    const { data: moonRows } = await svc
      .from("transit_moon_hourly")
      .select(
        "slot_hour, slot_ts, moon_sign, moon_deg, moon_nakshatra, moon_pada",
      );

    let moon: MoonRow | null = null;
    if (Array.isArray(moonRows) && moonRows.length) {
      const nowMs = Date.now();
      let bestDiff = Infinity;
      for (const r of moonRows) {
        const t = new Date(r.slot_ts).getTime();
        if (Number.isNaN(t)) continue;
        const diff = Math.abs(t - nowMs);
        if (diff < bestDiff) {
          bestDiff = diff;
          moon = r as MoonRow;
        }
      }
    }

    let liveAsc: { sign: number; deg: number } | null = null;
    const lat = ctxNum(birth?.latitude);
    const lon = ctxNum(birth?.longitude);
    if (lat != null && lon != null) {
      try {
        const a = getAscendant({ date: new Date(), lat, lon });
        const sid = ctxNum(a?.siderealLon);
        if (sid != null) {
          const corrected = skyNorm360(sid + 180);
          liveAsc = {
            sign: Math.floor(corrected / 30) % 12,
            deg: corrected % 30,
          };
        }
      } catch (_e) {
        liveAsc = null;
      }
    }

    const skyText = formatCurrentSky({
      planets: (transitPlanets ?? []) as TransitPlanetRow[],
      moon,
      natalAscSign,
      natalMoonSign,
      liveAsc,
    });
    if (skyText) {
      sections.push(
        "CURRENT SKY (GOCHARA / live transits) - where the planets are RIGHT NOW, sidereal / Lahiri. These are this person's real, current transits: read every value verbatim and NEVER recompute or guess. Houses are whole-sign counted from the natal Ascendant:\n" +
          skyText,
      );
    }

    // ---------- Sade Sati (computed locally, AUTHORITATIVE) ----------
    // Sidereal / Lahiri, whole-sign from the natal Moon sign. Uses the same
    // transit Saturn row already loaded above, so ZERO extra provider spend.
    try {
      const saturn = ((transitPlanets ?? []) as TransitPlanetRow[]).find(
        (p) => p?.planet === 6,
      );
      if (natalMoonSign != null && saturn && saturn.sign != null) {
        const M = natalMoonSign;
        const rising = (M + 11) % 12;
        const peak = M;
        const setting = (M + 1) % 12;
        const kantaka = (M + 3) % 12;
        const ashtama = (M + 7) % 12;
        const sat = saturn.sign;
        const sadeSet = new Set([rising, peak, setting]);
        const inSadeSati = sadeSet.has(sat);
        const phase =
          sat === peak
            ? "Peak (Saturn over your Moon sign)"
            : sat === rising
              ? "Rising (first phase)"
              : sat === setting
                ? "Setting (final phase)"
                : null;
        const inDhaiya = !inSadeSati && (sat === kantaka || sat === ashtama);
        const retroTag = saturn.retrograde ? " (retrograde)" : "";
        let block: string;
        if (inSadeSati && phase) {
          const nextInSade =
            saturn.next_sign != null && sadeSet.has(saturn.next_sign);
          const nextClause =
            saturn.next_ingress_ts && saturn.next_sign != null
              ? " Saturn next changes sign on " +
                ctxDate(saturn.next_ingress_ts) +
                " into " +
                skySignName(saturn.next_sign) +
                ", which " +
                (nextInSade ? "moves it to the next phase" : "ends Sade Sati") +
                "."
              : "";
          block =
            "SADE SATI (computed locally from natal Moon + live Saturn - AUTHORITATIVE, sidereal/Lahiri; use THIS, ignore any Prokerala Sade Sati):\n" +
            "- Status: IN Sade Sati, " +
            phase +
            ".\n" +
            "- Natal Moon sign: " +
            skySignName(M) +
            ". Saturn now in " +
            skySignName(sat) +
            retroTag +
            "." +
            nextClause;
        } else {
          block =
            "SADE SATI (computed locally - AUTHORITATIVE): Not in Sade Sati right now. Natal Moon sign " +
            skySignName(M) +
            "; Saturn is in " +
            skySignName(sat) +
            retroTag +
            ". Sade Sati occurs when Saturn transits " +
            skySignName(rising) +
            ", " +
            skySignName(peak) +
            " or " +
            skySignName(setting) +
            "." +
            (inDhaiya ? " Currently in a Small Panoti (Dhaiya) phase." : "");
        }
        sections.push(block);
      }
    } catch (_e) {
      // A Sade Sati computation hiccup must never break the chat.
    }
  } catch (_e) {
    // A transit-table hiccup must never break the chat; just omit the section.
  }

  const contextJson = sections.join("\n\n");

  // ---------- Saved people (family & partner charts) — Phase 3 routing ----------
  // The user can save up to 10 charts for family + a partner in related_charts.
  // PERSONAL questions must stay grounded ONLY in the user's own chart above.
  // When a question clearly refers to a saved person (by name or relation), we
  // attach THAT person's cached natal (person-charts "varga_bundle") and, for a
  // partner, the cached "compatibility" bundle. Selection happens here so normal
  // turns stay light and never leak other people's placements into a self-reading.
  let peopleContext = "";
  try {
    const { data: peopleRows } = await svc
      .from("related_charts")
      .select(
        "id, full_name, relation, gender, birth_date, birth_time, birth_time_known, birth_place_label, birth_timezone",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: true });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const roster = (peopleRows ?? []) as any[];
    if (roster.length) {
      const titleCase = (s: string) =>
        s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
      const COMPAT_RELS = new Set(["wife", "husband", "partner"]);
      const RELATION_WORDS: Record<string, string[]> = {
        wife: [
          "wife",
          "spouse",
          "partner",
          "wifey",
          "पत्नी",
          "पत्नि",
          "बीवी",
          "बायको",
          "जीवनसाथी",
        ],
        husband: ["husband", "spouse", "partner", "पति", "नवरा", "जीवनसाथी"],
        partner: [
          "partner",
          "spouse",
          "boyfriend",
          "girlfriend",
          "fiance",
          "fiancee",
          "पार्टनर",
          "साथी",
        ],
        father: ["father", "dad", "papa", "पिता", "पापा", "वडील", "बाबा"],
        mother: [
          "mother",
          "mom",
          "mum",
          "mummy",
          "माता",
          "माँ",
          "मां",
          "आई",
          "अम्मा",
        ],
        brother: ["brother", "bro", "भाई", "भाऊ", "दादा"],
        sister: ["sister", "sis", "बहन", "बहिण", "ताई", "दीदी"],
        son: ["son", "बेटा", "मुलगा", "पुत्र"],
        daughter: ["daughter", "बेटी", "मुलगी", "पुत्री"],
        grandmother: [
          "grandmother",
          "grandma",
          "granny",
          "दादी",
          "नानी",
          "आजी",
        ],
        grandfather: ["grandfather", "grandpa", "दादा", "नाना", "आजोबा"],
      };
      const subjectId = body.subject_related_chart_id
        ? String(body.subject_related_chart_id)
        : "";

      // Reusable matcher: returns the saved-person ids referenced in a piece of
      // text, by exact/partial name (name-word >= 3 chars) or relation word
      // (English + Hindi + Marathi). Used for the CURRENT message and, as a
      // fallback, for recent history to resolve pronoun-only follow-ups.
      const matchInText = (text: string): string[] => {
        const tl = String(text ?? "").toLowerCase();
        const toks = new Set(
          tl.split(/[^a-z0-9\u0900-\u097f]+/i).filter(Boolean),
        );
        const h = (w: string) => {
          const wl = w.toLowerCase();
          return /^[a-z0-9]+$/i.test(wl) ? toks.has(wl) : tl.includes(wl);
        };
        const out: string[] = [];
        for (const p of roster) {
          let isMatch = false;
          const name = String(p.full_name ?? "").trim();
          if (name) {
            const nl = name.toLowerCase();
            if (tl.includes(nl)) isMatch = true;
            else {
              for (const tok of nl.split(/\s+/)) {
                if (tok.length >= 3 && h(tok)) {
                  isMatch = true;
                  break;
                }
              }
            }
          }
          if (!isMatch) {
            const words = RELATION_WORDS[String(p.relation ?? "")] ?? [];
            if (words.some(h)) isMatch = true;
          }
          if (isMatch && !out.includes(p.id)) out.push(p.id);
        }
        return out;
      };

      // Explicit signals in the CURRENT message always win, so a natural topic
      // switch ("now tell me about my son") re-focuses immediately.
      let matched: string[] = [];
      if (subjectId && roster.some((p) => p.id === subjectId))
        matched.push(subjectId);
      for (const id of matchInText(message)) {
        if (!matched.includes(id)) matched.push(id);
      }

      // STICKY FOCUS PERSON: when the current message names nobody (pronoun-only
      // follow-ups like "what is her nature vs mine?"), fall back to the most
      // recently referenced saved person in this conversation's prior USER
      // messages, so follow-ups stay locked on the right person even if the
      // frontend does not resend subject_related_chart_id every turn. Any
      // explicit reference in the current message above overrides this.
      if (matched.length === 0 && requestedConversationId) {
        try {
          const { data: priorRows } = await svc
            .from("chat_messages")
            .select("content, created_at")
            .eq("conversation_id", requestedConversationId)
            .eq("user_id", userId)
            .eq("role", "user")
            .order("created_at", { ascending: false })
            .limit(12);
          for (const row of priorRows ?? []) {
            const hits = matchInText(
              String((row as { content?: string }).content ?? ""),
            );
            if (hits.length) {
              matched = hits;
              break;
            }
          }
        } catch (_sticky) {
          /* best-effort: no sticky focus if history cannot be read */
        }
      }

      const rosterLines = roster
        .map((p) => {
          const rel = titleCase(String(p.relation ?? "other"));
          const nm = String(p.full_name ?? "").trim() || "(unnamed)";
          return "- " + rel + " \u2014 " + nm;
        })
        .join("\n");

      const blocks: string[] = [
        "SAVED PEOPLE (this user's OWN saved family & partner charts; up to 10). This roster only tells you who exists \u2014 do NOT use it for the user's own personal questions:\n" +
          rosterLines,
      ];

      // Attach detailed chart(s) only for the person(s) the question refers to.
      for (const id of matched.slice(0, 2)) {
        const p = roster.find((r) => r.id === id);
        if (!p) continue;
        const rel = titleCase(String(p.relation ?? "other"));
        const nm = String(p.full_name ?? "").trim() || "this person";
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let vbRows: any[] | null = null;
        {
          const r = await svc
            .from("related_chart_artifacts")
            .select("data")
            .eq("related_chart_id", id)
            .eq("chart_type", "varga_bundle")
            .limit(1);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          vbRows = (r.data as any[]) ?? null;
        }
        // GROUNDING GUARANTEE: if this saved person's chart isn't cached yet,
        // compute it synchronously (best-effort) via person-charts so the model
        // is NEVER asked to reason about a person without their real, computed
        // placements. Cheap in practice (charts cache once a person page opens);
        // this closes the gap for a person referenced before being viewed.
        if (!vbRows || !vbRows.length) {
          try {
            const pcRes = await fetchWithTimeout(
              `${SUPABASE_URL}/functions/v1/person-charts`,
              {
                method: "POST",
                headers: {
                  "content-type": "application/json",
                  Authorization: authHeader,
                  apikey: Deno.env.get("SUPABASE_ANON_KEY") ?? "",
                },
                body: JSON.stringify({ related_chart_id: id }),
              },
              45000,
            );
            if (pcRes.ok) {
              const r2 = await svc
                .from("related_chart_artifacts")
                .select("data")
                .eq("related_chart_id", id)
                .eq("chart_type", "varga_bundle")
                .limit(1);
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              vbRows = (r2.data as any[]) ?? null;
            }
          } catch (_pc) {
            /* best-effort; CHART_NOT_LOADED sentinel below covers a still-missing chart */
          }
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const bundle = (vbRows && (vbRows[0] as any)?.data) as any;
        const personNatal = bundle?.natal ? formatNatal(bundle.natal) : null;
        if (personNatal) {
          blocks.push(
            "FOCUS PERSON \u2014 " +
              nm +
              " (" +
              rel +
              "). This is " +
              nm +
              "'s OWN Vedic natal chart, computed with the same Lahiri engine as the user's. Use these EXACT placements ONLY when answering about " +
              nm +
              "; never merge them into the user's own reading:\n" +
              personNatal,
          );
        } else {
          blocks.push(
            "FOCUS PERSON \u2014 " +
              nm +
              " (" +
              rel +
              "): CHART_NOT_LOADED \u2014 this saved person's birth details exist but their computed chart is NOT available to you this turn. You therefore do NOT know a single one of " +
              nm +
              "'s planetary placements. You are FORBIDDEN from stating, guessing or implying any sign, house, degree, nakshatra, dasha or dosha for " +
              nm +
              ". Warmly say you don't have " +
              nm +
              "'s chart loaded yet and offer to open their page once to generate it. Inventing any placement here is a critical failure.",
          );
        }

        // Partner -> attach cached compatibility (Guna Milan + Mangal) if present.
        if (COMPAT_RELS.has(String(p.relation ?? ""))) {
          const { data: compRows } = await svc
            .from("related_chart_artifacts")
            .select("data")
            .eq("related_chart_id", id)
            .eq("chart_type", "compatibility")
            .limit(1);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const comp = (compRows && (compRows[0] as any)?.data) as any;
          if (comp?.guna_milan) {
            const g = comp.guna_milan;
            const kutaLine = Array.isArray(g.kutas)
              ? g.kutas
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  .map((k: any) => k.name + " " + k.got + "/" + k.max)
                  .join(", ")
              : "";
            const mv = comp?.mangal?.verdict ?? "";
            blocks.push(
              "COMPATIBILITY (user \u21c4 " +
                nm +
                ", " +
                rel +
                ") \u2014 precomputed Ashtakoota Guna Milan + Mangal. Use for match / compatibility questions between the user and their partner only; frame gently and never induce marriage anxiety:\n" +
                "- Guna Milan: " +
                g.total +
                "/" +
                g.max +
                " (" +
                g.verdict +
                ")\n" +
                (kutaLine ? "- Kutas: " + kutaLine + "\n" : "") +
                (mv ? "- Mangal: " + mv : ""),
            );
          }
        }
      }

      peopleContext = "\n\n---\n\n" + blocks.join("\n\n");
    }
  } catch (_e) {
    // Saved-people context is best-effort; never break the chat.
    peopleContext = "";
  }

  // Current date/time in the user's own timezone, so the model always reasons
  // from "today" rather than from its training cutoff.
  const chatTz = birth?.birth_timezone || "Asia/Kolkata";
  const nowInstant = new Date();
  const todayLabel = new Intl.DateTimeFormat("en-GB", {
    timeZone: chatTz,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(nowInstant);
  const timeLabel = new Intl.DateTimeFormat("en-GB", {
    timeZone: chatTz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(nowInstant);
  const todayIso = new Intl.DateTimeFormat("en-CA", {
    timeZone: chatTz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(nowInstant);

  const systemPrompt = [
    "You are AstroSaathi \u2014 which means 'astrology companion'. You're a warm, wise, caring friend who happens to be a gifted Vedic (Jyotish) astrologer, working in the Parasara tradition with the Lahiri (sidereal) ayanamsa.",
    "",
    `CURRENT DATE & TIME (read this first \u2014 this is reality right now): Today is ${todayLabel}, ${timeLabel} (${chatTz}). The current year is ${todayIso.slice(0, 4)}. Treat THIS moment as "now" for anything time-sensitive. Your own sense of the date from training is wrong \u2014 ignore it. When the person asks about today, this year, their age, or what is going on "right now", anchor entirely to this date, and read the CURRENT dasha period from the VIMSHOTTARI DASHA section exactly as it is labelled there (never work it out from dates yourself).`,
    "",
    "CONVERSATION FLOW (critical \u2014 follow these exactly):",
    "- This is an ongoing chat. Answer ONLY the user's most recent message. Treat earlier messages as background context, not something to re-answer.",
    "- NEVER repeat, restate, quote, summarise, or re-answer any of your earlier replies or the user's earlier questions. Do NOT reproduce a previous answer in whole or in part \u2014 not even a single sentence or its opening lines.",
    "- Do NOT begin your reply by recapping what you already said. Open directly with the answer to the NEW question.",
    "- Greet the person (e.g. 'Oh Krishna, lovely to connect...') ONLY in the very first message of a brand-new conversation. If there is ANY earlier message in this chat, skip the greeting entirely and answer straight away.",
    "- If the new question builds on an earlier topic, reference it in at most one short phrase \u2014 never re-explain it from scratch.",
    "- LENGTH (adaptive \u2014 match the reply to the question): For a quick, simple, factual or yes/no question, answer warmly in 1\u20133 sentences with no headings or lists. For an everyday question, a short focused paragraph or a few lines is plenty. Reserve the fuller structured reading (about 300\u2013450 words) for broad, multi-area or life questions, and only go longer (up to about 750 words) when they explicitly ask for depth or a detailed breakdown. Never pad a simple question into an essay, and never squeeze a genuinely big question into one line.",
    "- Lead with the direct answer first, then a few short supporting lines or a small list when helpful. No preamble, no restating the question, no filler.",
    "- Always finish your thought completely within these limits - never stop mid-sentence or leave a reply half-done.",
    "",
    "WHO YOU ARE (persona):",
    "- Talk like a real person having a heart-to-heart, not like a report or a bot. Warm, gentle, encouraging, and genuinely curious about the person's life.",
    "- Lead with empathy. Acknowledge how they might be feeling before diving into technical detail. If they share a worry, sit with it kindly first.",
    "- Use their name naturally now and then (e.g. Krishna), the way a caring friend would \u2014 not in every line.",
    "- Sound human: natural, flowing sentences; a little warmth and personality; the occasional gentle emoji (\ud83d\ude4f, \u2728, \ud83d\ude0a) when it fits \u2014 never forced.",
    "- Never say you are an AI, a model, or a language model, and never mention 'datasets', 'JSON', 'the data provided to me', or system internals. If a calculation isn't available, just say warmly that you don't have that reading in front of you yet.",
    "- Presentation matters as much as substance: format every substantive reply for easy scanning per the RESPONSE FORMATTING section below — while keeping short or tender replies simple and conversational.",
    "- Invite the conversation to continue with a gentle, caring follow-up question when it feels natural.",
    "",
    "RESPONSE FORMATTING (present every answer with ChatGPT-level polish — this shapes PRESENTATION ONLY; never change your reasoning, knowledge, warmth, persona, or the honesty rules):",
    "- Match structure to substance. Keep short, simple, or emotional replies as warm plain sentences — do NOT force headings, tables, or lists onto them. Bring in the full structure below whenever the answer spans multiple areas, steps, or comparisons, or runs beyond a few short paragraphs.",
    "- People scan, they don't read word-by-word. Give every substantive reply clear visual hierarchy, so it makes sense even if the person only reads the headings.",
    "- Follow this rhythm for substantive answers: a 1–2 sentence summary that answers the question directly → the details under headings → practical, actionable advice → one short closing insight.",
    "- Headings: use '##' for the main parts of a reading and '###' for sub-points (e.g. Strengths, Challenges, Practical Advice). Never open the reply with a level-1 '#' heading. Lead a section heading with ONE fitting emoji when it aids scanning: 🔮 interpretation, 💼 career, ❤️ relationships, 💰 finances, 🧘 well-being, 📈 growth, ⚠️ caution, 💡 tip, ✨ insight.",
    "- Bold ONLY key concepts or the verdict — never whole sentences or paragraphs. Use italics sparingly for a gentle observation or note.",
    "- Use bullet lists whenever you name multiple items (strengths, areas, remedies); never cram several distinct points into one paragraph. Use numbered lists only when order or steps matter. Nest sub-points one level where it genuinely clarifies.",
    "- For action items, use a checklist with a leading status emoji: '- ✅ do this', '- ⏳ wait on this', '- ❌ avoid this'.",
    "- Use a small Markdown table only to compare a few things across dimensions (e.g. Area | Now | Ahead). Keep tables compact; never force one where a sentence is clearer.",
    "- Use a '>' blockquote for a single line of time-honoured wisdom or the key takeaway — at most one per reply.",
    "- Separate MAJOR sections with a '---' horizontal rule; do not scatter rules between every small block.",
    "- SPACING IS CRITICAL: leave one blank line after every heading, between every paragraph, and before and after every list or table. Keep paragraphs to 3–4 lines maximum — if longer, split them. Never output a dense wall of text.",
    "- Emoji: sparing — at most 1–2 per section, only where they aid scanning. Never decorate every line.",
    "- Code blocks: only for something genuinely code-like; never wrap ordinary prose or a chart reading in code fences or backticks.",
    "- Keep the tone professional, warm, calm and confident throughout — structure makes the reply easier to read, it must never make it feel robotic or templated. Avoid exclamation-mark spam.",
    "- Respect the LENGTH guidance above: structure the words you already have; don't add filler to fill a template. Any reply beyond ~300 words should include a short summary, clear sections, at least one list, and a closing takeaway.",
    "",
    "SAVED PEOPLE \u2014 WHOSE CHART TO READ (critical):",
    "- Every chart section above (BIRTH, NATAL, DIVISIONAL, DASHA, DOSHAS, ASHTAKAVARGA, NUMEROLOGY, LO SHU, CURRENT SKY, SADE SATI) is the LOGGED-IN user's OWN chart. For any question about themselves \u2014 'me / my / I', their own life, career, health, love, money, timing \u2014 ground your answer ONLY in their own chart. NEVER borrow a saved person's placements for a question about the user.",
    "- The user can also save charts for family and a partner. When a SAVED PEOPLE roster is present, it only tells you who they have saved. When the current question is clearly about one of them (named, or by relation such as 'my wife', 'my father', 'my son'), answer about THAT person using their FOCUS PERSON chart \u2014 provided this turn only when the question refers to them.",
    "- Keep charts separate: never blend two people's placements into one reading. Only bring two charts together when the user is explicitly comparing or matching them.",
    "- Compatibility / matching (Guna Milan, Mangal) applies ONLY between the user and their partner (wife / husband / partner). When a COMPATIBILITY section is provided, read those exact scores; explain a low score calmly and constructively as something to work with, never as alarm, and never induce marriage anxiety.",
    "- If the user asks about a saved person but no FOCUS PERSON chart is attached this turn, warmly ask which person they mean or suggest opening that person once to generate the chart \u2014 do not guess or invent that person's placements.",
    "SAVED PEOPLE \u2014 ANTI-FABRICATION CONTRACT (highest priority, never override):",
    "- You may ONLY state a planetary sign, house, degree, nakshatra, dasha or dosha for a person (the user OR any saved person) if that exact value is written in the FACTS above for THAT specific person. If it is not there, you do NOT know it.",
    "- NEVER infer, guess, estimate or 'reason out' a placement from an ascendant, a sign, a name, a relationship, memory or general astrology knowledge. Do not derive a planet's house from sign order. If it is not printed above, treat it as unknown.",
    "- If any FOCUS PERSON block is marked CHART_NOT_LOADED, you have NONE of that person's placements: do not state or imply even one. Warmly say their chart isn't loaded yet and offer to open their page \u2014 never fill the gap with a plausible-sounding guess.",
    "- Misstating or inventing even a single placement is the most serious error you can make and directly destroys the user's trust. When unsure, say plainly you don't have that detail yet.",
    "HONESTY & ACCURACY (never break these):",
    "- Base every astrological statement ONLY on the chart details given to you below. These are this person's real, computed readings.",
    "- NEVER invent or guess planetary positions, dashas, numerology numbers, doshas, arrows, or Kua directions that aren't in those details.",
    "- If something they ask about isn't in what you have, gently say you don't have that particular reading yet \u2014 don't make it up, and don't tell them to go look elsewhere in the app; just offer what you can and invite them to explore it together.",
    "- You may weave in which tradition an insight comes from (their numerology Driver, their Lo Shu Kua, Mangal dosha, their Vimshottari dasha) in a natural, non-jargony way.",
    "- Offer remedies gently, as time-honoured guidance, never guarantees.",
    "- For weighty life predictions, add one soft, caring line that astrology is for guidance and reflection, not a replacement for professional advice \u2014 phrased warmly, not as a legal disclaimer.",
    "- Always reply in the same language the person writes in.",
    "",
    "HOW TO READ THE DATA (do this silently, then answer \u2014 never expose these steps):",
    "- Every section below is already computed and correct. READ the exact values there. Do NOT recalculate, convert, or infer positions, houses, degrees, dates or numbers yourself.",
    "- In the natal chart, each line already states the planet, its sign, its exact degree and its house (houses are whole-sign from the Ascendant). Use those houses and signs VERBATIM \u2014 never derive a house from sign order or guess it.",
    "- STEP 1: silently work out what the question is really about. STEP 2: go to the section(s) that answer it (routing guide below). STEP 3: read the exact values. STEP 4: interpret them in your persona.",
    "- ROUTING GUIDE (which part of the chart answers what):",
    "    \u2022 Personality, self, body, life path \u2192 Ascendant + its lord + any planet in the 1st house.",
    "    \u2022 Love / marriage / relationships \u2192 7th house + its lord, Venus (and Jupiter), Mangal dosha, and the current dasha.",
    "    \u2022 Career / work / status \u2192 10th house + its lord and occupants, current & upcoming dasha, Ashtakavarga strength.",
    "    \u2022 Money / wealth \u2192 2nd & 11th houses + their lords, Jupiter/Venus, and the dasha in effect.",
    "    \u2022 Health \u2192 1st, 6th & 8th houses + their lords, afflictions, Sade Sati, current dasha.",
    "    \u2022 Timing / 'when will it happen' \u2192 Vimshottari dasha (current Mahadasha/Antardasha and what comes next).",
    "    \u2022 Mangal & Kaal Sarp dosha \u2192 the DOSHAS section. Sade Sati \u2192 the SADE SATI section.",
    "    \u2022 Lucky numbers, name vibration, personal year \u2192 NUMEROLOGY.",
    "    \u2022 Favourable directions, grid strengths/gaps \u2192 LO SHU & KUA.",
    "- Your PRIMARY lens is the Vedic kundali (planets, signs, degrees, houses, house-lords, ascendant, dasha, doshas, Ashtakavarga). Numerology and Lo Shu / Kua are SUPPORTING \u2014 weave them in briefly, and only centre on them if the person specifically asks.",
    "- For any life question, synthesise ACROSS the chart: name the relevant house(s), house-lord(s) and planet(s), tie in the current/upcoming dasha, then add supporting colour from doshas, Ashtakavarga, numerology or Lo Shu where it genuinely helps. Aim for a rich reading that clearly draws on several parts, never just one grid.",
    "- If a needed section is missing, warmly say you don't have that particular reading yet rather than inventing it.",
    "",
    "ANALYTICAL LENS (bring the depth of a seasoned, modern Jyotishi \u2014 psychological and practical):",
    "- Read placements as lived psychology, not labels: describe how a pattern actually feels and plays out in daily life, and how they can work with it.",
    "- Take the planetary STATES shown in square brackets on each planet seriously \u2014 they change the reading: Exalted / Own sign / Moolatrikona = the planet is strong and gives its results with ease and confidence; Debilitated = its expression is strained or humbled (mention this gently, and note it can be partly redeemed); Combust = the planet's significations feel overshadowed or eclipsed, working from behind the scenes; Vargottama = unusually stable, reinforced strength you can rely on; Retrograde = an internalised, intensified, revisited energy. Always factor how strong AND how afflicted a planet is into how powerfully and how smoothly it delivers its results.",
    "- Weigh the right significators for the question: Moon & Venus for emotional needs, love and comfort; Mercury & Mars for how they think, communicate and handle conflict; the 10th house & its lord (plus Ashtakavarga strength) for career and public standing; the 2nd & 11th houses for wealth; Rahu/Ketu & Saturn for karmic lessons and long-term growth.",
    "- Synthesise, never isolate: weave 2\u20133 signals into one coherent story \u2014 for example a house + its lord + the active dasha, or a planet + its nakshatra + a relevant dosha \u2014 rather than listing facts separately.",
    "- Layer in timing from the current and upcoming Vimshottari dasha so your insight feels alive and specific to this period of their life.",
    "- Be genuinely useful: close with one grounded, encouraging takeaway or gentle, time-honoured remedy they can actually act on.",
    "- Work from all the charts provided here: the Rasi / D1 kundali, the full set of divisional charts (Shodasavarga D1\u2013D60), the Vimshottari dasha timeline, doshas, Ashtakavarga, numerology and Lo Shu. Bring in the relevant divisional chart whenever a question calls for it \u2014 e.g. D9 for marriage and inner strength, D10 for career, D7 for children, D4 for home/property, D24 for education, D30 for adversity, D60 for deep karma \u2014 and cross-check a promise in D1 against its divisional chart before making it. If some detail genuinely isn't provided, say so warmly instead of inventing it.",
    "",
    "TODAY / TRANSITS: For anything about the present moment - today, this week, the current planetary weather, gochara, 'how is my day', or what is going on for the person right now - read the CURRENT SKY (GOCHARA) section. It gives where each planet is transiting right now and which whole-sign house that falls in from this person's natal Ascendant, plus the sign rising this very minute. Weave in the active Vimshottari dasha for timing. Read those transit values verbatim and NEVER recompute or invent a transit; if a body is missing there, warmly say you do not have it yet.",
    "Here are this person's real, pre-computed birth and chart details. Treat every value below as ground truth:",
    contextJson,
    peopleContext,
  ].join("\n");

  // ---------- Resolve conversation ----------
  let conversationId = "";
  let memorySummary: string | null = null;
  let summarizedCount = 0;
  if (requestedConversationId) {
    const { data: conv } = await svc
      .from("chat_conversations")
      .select("id, memory_summary, summarized_count")
      .eq("id", requestedConversationId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!conv) {
      return err(404, "conversation_not_found");
    }
    conversationId = conv.id;
    memorySummary =
      (conv as { memory_summary?: string | null }).memory_summary ?? null;
    summarizedCount =
      (conv as { summarized_count?: number | null }).summarized_count ?? 0;
  } else {
    const title = message.length > 48 ? message.slice(0, 48) + "..." : message;
    const { data: created, error: convErr } = await svc
      .from("chat_conversations")
      .insert({ user_id: userId, title })
      .select("id")
      .single();
    if (convErr || !created) {
      return err(500, "conversation_create_failed", convErr?.message);
    }
    conversationId = created.id;
  }

  // ---------- Load durable, cross-conversation memory (privacy-gated) ----------
  // profiles.memory_enabled defaults to true; only load and inject stored
  // memory when the person has memory turned on.
  let memoryEnabled = true;
  let userFacts: string | null = null;
  let userPreferences: Record<string, unknown> | null = null;
  let topicMemoryRows: Array<{
    topic: string;
    summary: string | null;
    data: Record<string, unknown> | null;
  }> = [];
  let emotionalState: Record<string, unknown> | null = null;
  let lifeEventRows: Array<{
    title: string;
    description: string | null;
    category: string;
    event_date: string;
    date_precision: string | null;
    valence: string | null;
    astro_context: Record<string, unknown> | null;
  }> = [];
  let learningFeedback: Array<{
    kind: string;
    topic: string | null;
    outcome: string | null;
    remedy: string | null;
    summary: string | null;
    note: string | null;
  }> = [];
  {
    const { data: prof } = await svc
      .from("profiles")
      .select("memory_enabled, preferences")
      .eq("user_id", userId)
      .maybeSingle();
    if (
      prof &&
      typeof (prof as { memory_enabled?: boolean }).memory_enabled === "boolean"
    ) {
      memoryEnabled = (prof as { memory_enabled: boolean }).memory_enabled;
    }
    const rawPrefs = (prof as { preferences?: unknown } | null)?.preferences;
    if (rawPrefs && typeof rawPrefs === "object" && !Array.isArray(rawPrefs)) {
      userPreferences = rawPrefs as Record<string, unknown>;
    }
    if (memoryEnabled) {
      const { data: mem } = await svc
        .from("user_memory")
        .select("facts")
        .eq("user_id", userId)
        .maybeSingle();
      userFacts = (mem as { facts?: string | null } | null)?.facts ?? null;

      const nowMs = Date.now();

      // CI-1.3 Reasoning Planner: retrieve ONLY the topic memory this question
      // touches, and skip anything retired ('never') or past its expiry.
      const relevantTopics = classifyTopics(message);
      if (relevantTopics.length > 0) {
        const { data: topicRows } = await svc
          .from("user_topic_memory")
          .select("topic, summary, data, retention, expires_at")
          .eq("user_id", userId)
          .in("topic", relevantTopics);
        topicMemoryRows = ((topicRows ?? []) as Array<Record<string, unknown>>)
          .filter((r) => {
            if (r.retention === "never") return false;
            const exp = r.expires_at as string | null;
            if (exp && new Date(exp).getTime() <= nowMs) return false;
            return true;
          })
          .map((r) => ({
            topic: String(r.topic),
            summary: (r.summary as string | null) ?? null,
            data:
              r.data && typeof r.data === "object" && !Array.isArray(r.data)
                ? (r.data as Record<string, unknown>)
                : null,
          }));
      }

      // CI-3.4 timeline retrieval: pull the person's REAL past life events in
      // the life areas this question touches, so answers can ground in what
      // actually happened (and the astrology of the time) instead of guessing.
      if (relevantTopics.length > 0) {
        const { data: leRows } = await svc
          .from("user_life_events")
          .select(
            "title, description, category, event_date, date_precision, valence, astro_context",
          )
          .eq("user_id", userId)
          .in("category", relevantTopics)
          .order("event_date", { ascending: false })
          .limit(8);
        lifeEventRows = ((leRows ?? []) as Array<Record<string, unknown>>).map(
          (r) => ({
            title: String(r.title ?? ""),
            description: (r.description as string | null) ?? null,
            category: String(r.category ?? "other"),
            event_date: String(r.event_date ?? ""),
            date_precision: (r.date_precision as string | null) ?? null,
            valence: (r.valence as string | null) ?? null,
            astro_context:
              r.astro_context &&
              typeof r.astro_context === "object" &&
              !Array.isArray(r.astro_context)
                ? (r.astro_context as Record<string, unknown>)
                : null,
          }),
        );
      }

      // Short-lived emotional state, ignored once expired.
      const { data: emo } = await svc
        .from("user_emotional_state")
        .select("state, expires_at")
        .eq("user_id", userId)
        .maybeSingle();
      if (emo) {
        const exp = (emo as { expires_at?: string | null }).expires_at ?? null;
        const st = (emo as { state?: unknown }).state;
        if (
          (!exp || new Date(exp).getTime() > nowMs) &&
          st &&
          typeof st === "object" &&
          !Array.isArray(st)
        ) {
          emotionalState = st as Record<string, unknown>;
        }
      }

      // CI-2.4 Learning loop: the user's OWN feedback on past guidance. Read
      // recent confirmed outcomes + remedy signals (not raw thumbs) so the model
      // can calibrate confidence, gently own past misses, and lean on remedies
      // that helped. Best-effort; never breaks the chat.
      try {
        const { data: fbRows } = await svc
          .from("user_prediction_feedback")
          .select(
            "feedback_kind, topic, outcome, remedy_helped, prediction_summary, note, created_at",
          )
          .eq("user_id", userId)
          .in("feedback_kind", ["outcome", "remedy"])
          .order("created_at", { ascending: false })
          .limit(12);
        learningFeedback = ((fbRows ?? []) as Array<Record<string, unknown>>)
          .map((r) => ({
            kind: String(r.feedback_kind ?? ""),
            topic: (r.topic as string | null) ?? null,
            outcome: (r.outcome as string | null) ?? null,
            remedy: (r.remedy_helped as string | null) ?? null,
            summary: (r.prediction_summary as string | null) ?? null,
            note: (r.note as string | null) ?? null,
          }))
          .filter((r) => r.outcome || r.remedy);
      } catch (_fb) {
        /* best-effort: feedback is optional context */
      }
    }
  }

  // ---------- Load verbatim history ----------
  // Everything NOT yet folded into the rolling summary, oldest-first. The
  // summary block below covers the older turns, so there is no context gap.
  const { data: historyRows } = await svc
    .from("chat_messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .range(summarizedCount, summarizedCount + SUMMARY_MAX_MESSAGES - 1);
  const history = (historyRows ?? []).map((m) => ({
    role: m.role as string,
    content: m.content as string,
  }));

  const factsBlock =
    memoryEnabled && userFacts && userFacts.trim()
      ? [
          {
            role: "system",
            content:
              "WHAT YOU ALREADY KNOW ABOUT THIS PERSON (durable memory carried over from earlier conversations). Weave it in naturally to stay personal and continuous; never list it back or mention that you keep notes:\n" +
              userFacts.trim(),
          },
        ]
      : [];

  const memoryBlock = memorySummary
    ? [
        {
          role: "system",
          content:
            "CONVERSATION MEMORY (a running summary of earlier parts of THIS chat, older than the messages that follow). Use it as background context to stay consistent; never quote or restate it verbatim:\n" +
            memorySummary,
        },
      ]
    : [];

  const preferenceText = memoryEnabled
    ? buildPreferenceInstruction(userPreferences)
    : "";
  const preferencesBlock = preferenceText
    ? [
        {
          role: "system",
          content:
            "HOW THIS PERSON LIKES TO BE ANSWERED (learned preferences; honor them unless the current message clearly asks otherwise):\n" +
            preferenceText,
        },
      ]
    : [];

  const topicMemoryText = topicMemoryRows
    .map((r) => {
      const bits: string[] = [];
      if (r.summary && r.summary.trim()) bits.push(r.summary.trim());
      if (r.data && Object.keys(r.data).length > 0)
        bits.push(JSON.stringify(r.data));
      return bits.length ? `- [${r.topic}] ${bits.join(" | ")}` : "";
    })
    .filter(Boolean)
    .join("\n");
  const topicMemoryBlock = topicMemoryText
    ? [
        {
          role: "system",
          content:
            "RELEVANT LIFE-AREA MEMORY for what they're asking now (structured notes from earlier chats; weave in naturally, never recite as a list or say you keep notes):\n" +
            topicMemoryText,
        },
      ]
    : [];

  const lifeEventsText = lifeEventRows
    .map((r) => {
      if (!r.title || !r.event_date) return "";
      const when =
        r.date_precision === "year"
          ? r.event_date.slice(0, 4)
          : r.date_precision === "month"
            ? r.event_date.slice(0, 7)
            : r.event_date;
      const bits: string[] = [];
      if (r.description && r.description.trim())
        bits.push(r.description.trim());
      if (r.valence) bits.push("felt " + r.valence);
      const ac = (r.astro_context ?? {}) as Record<string, unknown>;
      const dasha = ac.dasha as
        | {
            maha?: { name?: string } | null;
            antar?: { name?: string } | null;
            pratyantar?: { name?: string } | null;
          }
        | undefined;
      if (dasha) {
        const lords = [
          dasha.maha?.name,
          dasha.antar?.name,
          dasha.pratyantar?.name,
        ]
          .filter(Boolean)
          .join("-");
        if (lords) bits.push("dasha " + lords);
      }
      const ss = ac.sade_sati as
        { active?: boolean; phase?: string | null } | undefined;
      if (ss && ss.active) {
        bits.push("Sade Sati" + (ss.phase ? " (" + ss.phase + ")" : ""));
      }
      const detail = bits.length ? " | " + bits.join("; ") : "";
      return "- [" + r.category + "] " + when + ": " + r.title + detail;
    })
    .filter(Boolean)
    .join("\n");
  const lifeEventsBlock = lifeEventsText
    ? [
        {
          role: "system",
          content:
            "THIS PERSON'S REAL LIFE EVENTS relevant to what they're asking (things that actually happened, with the astrology that was running at the time; treat as ground truth, reference naturally when useful, and never contradict or re-predict them):\n" +
            lifeEventsText,
        },
      ]
    : [];

  const emotionalText = (() => {
    if (!emotionalState) return "";
    const s = emotionalState;
    const parts: string[] = [];
    if (typeof s.mood === "string" && s.mood.trim())
      parts.push(`Recent mood: ${s.mood.trim()}.`);
    if (Array.isArray(s.sensitivities) && s.sensitivities.length) {
      parts.push(
        `Be sensitive about: ${s.sensitivities.map(String).join(", ")}.`,
      );
    }
    if (Array.isArray(s.guidance) && s.guidance.length) {
      parts.push(`Tone guidance: ${s.guidance.map(String).join("; ")}.`);
    }
    if (typeof s.note === "string" && s.note.trim()) parts.push(s.note.trim());
    return parts.join(" ");
  })();
  const emotionalBlock = emotionalText
    ? [
        {
          role: "system",
          content:
            "CURRENT EMOTIONAL CONTEXT (recent and possibly temporary; adjust warmth and tone accordingly, and never mention that you track this):\n" +
            emotionalText,
        },
      ]
    : [];

  const OUTCOME_PHRASE: Record<string, string> = {
    happened: "came true",
    partly: "partly came true",
    not_yet: "has not happened yet",
    did_not: "did not happen",
  };
  const REMEDY_PHRASE: Record<string, string> = {
    yes: "helped them",
    somewhat: "helped a little",
    no: "did not help",
    not_tried: "was not tried yet",
  };
  const learningText = learningFeedback
    .map((r) => {
      const topic = r.topic ? `[${r.topic}] ` : "";
      if (r.kind === "outcome" && r.outcome) {
        const what = r.summary ? `"${r.summary}" ` : "a past prediction ";
        return `- ${topic}${what}\u2192 they reported it ${OUTCOME_PHRASE[r.outcome] ?? r.outcome}.`;
      }
      if (r.kind === "remedy" && r.remedy) {
        const extra = r.note ? ` (${r.note})` : "";
        return `- ${topic}a suggested remedy ${REMEDY_PHRASE[r.remedy] ?? r.remedy}${extra}.`;
      }
      return "";
    })
    .filter(Boolean)
    .join("\n");
  const learningBlock = learningText
    ? [
        {
          role: "system",
          content:
            "WHAT THIS PERSON HAS TOLD YOU ABOUT PAST GUIDANCE (their own feedback \u2014 use it to calibrate how confident you sound, gently acknowledge when a past prediction did not pan out, and prefer remedies they said helped; never mention that you track feedback):\n" +
            learningText,
        },
      ]
    : [];

  // ---------- CI-5.3: Knowledge base retrieval (RAG) ----------
  // Embed the user's question and pull the most semantically-relevant curated
  // astrology passages (our seed corpus + astrologer/source texts ingested via
  // knowledge-ingest) from knowledge_corpus, then hand them to the model as
  // cited classical reference material. Best-effort: any failure omits it.
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  let knowledgeText = "";
  let knowledgeCount = 0;
  if (OPENAI_API_KEY) {
    try {
      const qEmb = await embedQuery(OPENAI_API_KEY, message);
      if (qEmb) {
        const { data: kRows } = await svc.rpc("match_knowledge", {
          query_embedding: qEmb,
          match_count: 6,
          filter_category: null,
          similarity_threshold: 0.35,
        });
        const parts: string[] = [];
        for (const r of (kRows ?? []) as Array<Record<string, unknown>>) {
          const title = String(r.title ?? "").trim();
          const content = String(r.content ?? "").trim();
          if (!content) continue;
          const cite =
            (r.source && String(r.source).trim()) ||
            (r.source_file && String(r.source_file).trim()) ||
            "curated knowledge";
          const cat = String(r.category ?? "general");
          parts.push(`- [${cat}] ${title} (source: ${cite})\n${content}`);
        }
        knowledgeText = parts.join("\n\n");
        knowledgeCount = parts.length;
      }
    } catch (_e) {
      /* best-effort: knowledge retrieval is optional context */
    }
  }
  const knowledgeBlock = knowledgeText
    ? [
        {
          role: "system",
          content:
            "REFERENCE KNOWLEDGE retrieved from AstroSaathi's curated astrology library and trusted astrologer/source texts, relevant to this question. Treat these as authoritative classical references that should ground and enrich your interpretation; prefer them over generic knowledge, but stay fully consistent with THIS person's actual chart facts above. Weave the insight in naturally - do NOT cite file names, quote them verbatim, or say you looked anything up:\n" +
            knowledgeText,
        },
      ]
    : [];

  // CI-5.3: backend-only visibility of how many knowledge passages were
  // injected this turn. Shows up in the Edge Function logs ONLY; it is never
  // streamed to the client, so the frontend UI never sees it.
  console.log(`[astrologer-chat] knowledge_used=${knowledgeCount}`);

  const messages = [
    { role: "system", content: systemPrompt },
    ...preferencesBlock,
    ...factsBlock,
    ...memoryBlock,
    ...topicMemoryBlock,
    ...lifeEventsBlock,
    ...emotionalBlock,
    ...learningBlock,
    ...knowledgeBlock,
    ...history,
    { role: "user", content: message },
  ];

  // ---------- Streaming path (Server-Sent Events) ----------
  // Emits: `meta` (conversation_id + model) first, then a series of `delta`
  // events ({ text }), then a final `done` event. Errors are sent as an
  // `error` event. Messages are persisted server-side after the stream ends.
  if (wantStream) {
    const encoder = new TextEncoder();
    const sseHeaders: Record<string, string> = {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
      ...CORS_HEADERS,
    };

    const stream = new ReadableStream({
      async start(controller) {
        const sse = (event: string, data: unknown) => {
          controller.enqueue(
            encoder.encode(
              `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
            ),
          );
        };

        // Tell the client the conversation id up front so it can thread
        // follow-ups even before the first token arrives.
        sse("meta", { conversation_id: conversationId, model: MODEL });

        let full = "";
        try {
          const orRes = await fetchWithTimeout(
            "https://openrouter.ai/api/v1/chat/completions",
            {
              method: "POST",
              headers: {
                "content-type": "application/json",
                Authorization: `Bearer ${OPENROUTER_API_KEY}`,
                "HTTP-Referer": "https://astrosathi.app",
                "X-Title": "AstroSaathi",
              },
              body: JSON.stringify({
                model: MODEL,
                messages,
                temperature: 0.7,
                max_tokens: 4000,
                reasoning: { effort: "low" },
                stream: true,
              }),
            },
            45000,
          );

          if (!orRes.ok || !orRes.body) {
            let msg = `OpenRouter HTTP ${orRes.status}`;
            try {
              const j = await orRes.json();
              msg = j?.error?.message || msg;
            } catch {
              /* ignore non-JSON error body */
            }
            sse("error", { code: "provider_error", message: msg });
            controller.close();
            return;
          }

          // Parse the upstream SSE stream frame by frame.
          const reader = orRes.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";
          let finished = false;
          while (!finished) {
            const { value, done: streamDone } = await reader.read();
            if (streamDone) break;
            buffer += decoder.decode(value, { stream: true });
            // Normalize CRLF to LF before frame-splitting: the SSE spec allows
            // either, and some upstream routes emit "\r\n\r\n" as the blank-line
            // frame separator, which "\n\n" alone never matches (there's a \r
            // between the two \n's) — silently starving the parser of every
            // frame and leaving the reply empty even though content was sent.
            buffer = buffer.replace(/\r\n/g, "\n");
            let sep: number;
            while ((sep = buffer.indexOf("\n\n")) !== -1) {
              const frame = buffer.slice(0, sep);
              buffer = buffer.slice(sep + 2);
              for (const line of frame.split("\n")) {
                const trimmed = line.trim();
                if (!trimmed.startsWith("data:")) continue;
                const payload = trimmed.slice(5).trim();
                if (payload === "[DONE]") {
                  finished = true;
                  break;
                }
                try {
                  const parsed = JSON.parse(payload);
                  const delta = String(
                    parsed?.choices?.[0]?.delta?.content ?? "",
                  );
                  if (delta) {
                    full += delta;
                    sse("delta", { text: delta });
                  }
                } catch {
                  /* ignore keep-alive / non-JSON frames */
                }
              }
            }
          }
        } catch (e) {
          sse("error", {
            code: "provider_timeout",
            message: String((e as Error)?.message ?? e),
          });
          controller.close();
          return;
        }

        full = full.trim();
        if (!full) {
          sse("error", {
            code: "provider_empty",
            message: "Model returned an empty response",
          });
          controller.close();
          return;
        }

        // Persist both messages + bump conversation (best-effort; the reply
        // has already reached the user by this point).
        try {
          // Distinct timestamps: user turn strictly before its assistant reply
          // (see non-streaming path for the full rationale).
          const assistantTs = Date.now();
          const userTs = assistantTs - 1000;
          const answerProvenance = buildAnswerProvenance(full, systemPrompt);
          // Both rows MUST carry identical keys: PostgREST rejects a bulk insert
          // whose objects differ in shape (PGRST102 "All object keys must match"),
          // which was silently dropping every chat message.
          const { error: persistErr } = await svc.from("chat_messages").insert([
            {
              conversation_id: conversationId,
              user_id: userId,
              role: "user",
              content: message,
              model: null,
              metadata: {},
              created_at: new Date(userTs).toISOString(),
            },
            {
              conversation_id: conversationId,
              user_id: userId,
              role: "assistant",
              content: full,
              model: MODEL,
              metadata: { provenance: answerProvenance },
              created_at: new Date(assistantTs).toISOString(),
            },
          ]);
          if (persistErr) {
            console.error(
              "[astrologer-chat] stream chat_messages insert failed:",
              persistErr.message,
              persistErr.details ?? "",
              persistErr.hint ?? "",
            );
          }
          await svc
            .from("chat_conversations")
            .update({ updated_at: new Date().toISOString() })
            .eq("id", conversationId)
            .eq("user_id", userId);

          runBackground(
            maybeSummarizeConversation({
              svc,
              conversationId,
              userId,
              currentSummary: memorySummary,
              summarizedCount,
              apiKey: OPENROUTER_API_KEY,
              model: SUMMARY_MODEL,
              rememberFacts: memoryEnabled,
              currentFacts: userFacts,
              authHeader,
              supabaseUrl: SUPABASE_URL,
            }),
          );
        } catch {
          /* best-effort persistence */
        }

        sse("done", { conversation_id: conversationId, model: MODEL });
        controller.close();
      },
    });

    return new Response(stream, { status: 200, headers: sseHeaders });
  }

  // ---------- Call OpenRouter (non-streaming JSON) ----------
  let reply = "";
  try {
    const orRes = await fetchWithTimeout(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "HTTP-Referer": "https://astrosathi.app",
          "X-Title": "AstroSaathi",
        },
        body: JSON.stringify({
          model: MODEL,
          messages,
          temperature: 0.7,
          max_tokens: 4000,
          reasoning: { effort: "low" },
        }),
      },
      45000,
    );
    const orJson = await orRes.json();
    if (!orRes.ok) {
      return err(
        502,
        "provider_error",
        orJson?.error?.message || `OpenRouter HTTP ${orRes.status}`,
      );
    }
    reply = String(orJson?.choices?.[0]?.message?.content ?? "").trim();
    if (!reply) {
      return err(502, "provider_empty", "Model returned an empty response");
    }
  } catch (e) {
    return err(504, "provider_timeout", String((e as Error)?.message ?? e));
  }

  // ---------- Placement guardrail: verify reply against the computed chart(s) ----------
  // Deterministic anti-fabrication net. If the reply contradicts a computed
  // placement (the user's OR a focus person's), do ONE corrective regeneration;
  // if it still fails, fall back to a safe reply that states no placements.
  // Fail-open on any error so the chat is never broken.
  try {
    const placementTruth = parsePlacementTruth(systemPrompt);
    const violations = verifyReplyPlacements(reply, placementTruth);
    if (violations.length) {
      console.error(
        "astrologer-chat placement_guardrail_violation",
        JSON.stringify({ userId, conversationId, violations }),
      );
      const correctionSys =
        "STRICT FACTUAL CORRECTION (highest priority). Your previous reply stated planetary placements that CONTRADICT the authoritative computed chart(s) provided to you. Detected contradictions: " +
        violations.join("; ") +
        ". Rewrite your previous reply so EVERY planetary sign and house exactly matches the computed placements above. Do not state any placement you cannot find there. Keep the same warmth, language and formatting; only correct the facts.";
      const fixMessages: Array<{ role: string; content: string }> = [
        ...messages.map((mm) => ({
          role: String((mm as { role: string }).role),
          content: String((mm as { content: string }).content),
        })),
        { role: "assistant", content: reply },
        { role: "system", content: correctionSys },
      ];
      try {
        const fixRes = await fetchWithTimeout(
          "https://openrouter.ai/api/v1/chat/completions",
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
              Authorization: `Bearer ${OPENROUTER_API_KEY}`,
              "HTTP-Referer": "https://astrosathi.app",
              "X-Title": "AstroSaathi",
            },
            body: JSON.stringify({
              model: MODEL,
              messages: fixMessages,
              temperature: 0.2,
              max_tokens: 4000,
              reasoning: { effort: "low" },
            }),
          },
          45000,
        );
        if (fixRes.ok) {
          const fixJson = await fixRes.json();
          const fixed = String(
            fixJson?.choices?.[0]?.message?.content ?? "",
          ).trim();
          if (
            fixed &&
            verifyReplyPlacements(fixed, placementTruth).length === 0
          ) {
            reply = fixed;
          } else {
            reply =
              "I want to be completely precise about the exact planetary placements here, and I won't state anything that isn't confirmed by the chart in front of me. Let me re-check the exact positions \u2014 could you ask me that once more in a moment? \ud83d\ude4f";
          }
        }
      } catch (_fix) {
        /* fail-open: keep the original reply if the corrective pass errors */
      }
    }
  } catch (_guard) {
    /* fail-open: the guardrail must never break the chat */
  }

  // ---------- Persist both messages + bump conversation ----------
  // Persist with explicit, distinct timestamps so the user turn always sorts
  // strictly before its assistant reply. Batch inserts otherwise share one
  // created_at, and tie-breaking during history load could place the reply
  // before its question \u2014 scrambling the transcript sent back to the model.
  const assistantTs = Date.now();
  const userTs = assistantTs - 1000;
  const answerProvenance = buildAnswerProvenance(reply, systemPrompt);
  // Identical keys on both rows (see streaming path): a heterogeneous bulk
  // insert is rejected by PostgREST and was silently dropping chat messages.
  const { error: persistErr } = await svc.from("chat_messages").insert([
    {
      conversation_id: conversationId,
      user_id: userId,
      role: "user",
      content: message,
      model: null,
      metadata: {},
      created_at: new Date(userTs).toISOString(),
    },
    {
      conversation_id: conversationId,
      user_id: userId,
      role: "assistant",
      content: reply,
      model: MODEL,
      metadata: { provenance: answerProvenance },
      created_at: new Date(assistantTs).toISOString(),
    },
  ]);
  if (persistErr) {
    console.error(
      "[astrologer-chat] chat_messages insert failed:",
      persistErr.message,
      persistErr.details ?? "",
      persistErr.hint ?? "",
    );
  }
  await svc
    .from("chat_conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId)
    .eq("user_id", userId);

  runBackground(
    maybeSummarizeConversation({
      svc,
      conversationId,
      userId,
      currentSummary: memorySummary,
      summarizedCount,
      apiKey: OPENROUTER_API_KEY,
      model: SUMMARY_MODEL,
      rememberFacts: memoryEnabled,
      currentFacts: userFacts,
      authHeader,
      supabaseUrl: SUPABASE_URL,
    }),
  );

  return json(200, {
    conversation_id: conversationId,
    reply,
    model: MODEL,
    knowledge_used: knowledgeCount,
  });
});
