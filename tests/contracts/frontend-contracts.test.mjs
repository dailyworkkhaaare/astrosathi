import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  findAscendantSignIndex,
  houseFor,
  INGRESS_SOON_MS,
  PLANET_KEY_BY_CODE,
} from "../../src/lib/todayTransits.ts";
import { DOSHA_REMEDIES, PLANET_REMEDIES } from "../../src/lib/remedies.ts";
import { isJourneyAskToken } from "../../src/lib/journey-ask.ts";

const ROOT = new URL("../../", import.meta.url);
const readProjectFile = (path) => readFile(new URL(path, ROOT), "utf8");

const PLANETS = ["sun", "moon", "mars", "mercury", "jupiter", "venus", "saturn", "rahu", "ketu"];
const KUTA_MAP = {
  Varna: "varna",
  Vashya: "vashya",
  Tara: "tara",
  Yoni: "yoni",
  "Graha Maitri": "grahaMaitri",
  Gana: "gana",
  Bhakoot: "bhakoot",
  Nadi: "nadi",
};
const GUNA_VERDICTS = ["excellent", "very_good", "good", "average", "needs_care"];
const MANGAL_VERDICTS = ["both_manglik_balanced", "none_manglik", "one_manglik"];
const COMPATIBILITY_ERRORS = [
  "no_self_profile",
  "not_compat_eligible",
  "missing_self_coordinates",
  "missing_partner_coordinates",
];

function atPath(object, path) {
  return path.split(".").reduce((value, segment) => value?.[segment], object);
}

function placeholders(value) {
  return [...String(value).matchAll(/{{\s*([\w.-]+)\s*}}/g)].map((match) => match[1]).sort();
}

function parseStringMap(source, declarationName) {
  const match = source.match(
    new RegExp(`const ${declarationName}[^=]*=\\s*\\{([\\s\\S]*?)\\n\\};`),
  );
  assert.ok(match, `${declarationName} declaration should remain discoverable`);
  return Object.fromEntries(
    [...match[1].matchAll(/(?:"([^"]+)"|([A-Za-z][\w]*))\s*:\s*"([^"]+)"/g)].map((entry) => [
      entry[1] ?? entry[2],
      entry[3],
    ]),
  );
}

function parseStringSet(source, declarationName) {
  const match = source.match(
    new RegExp(`const ${declarationName}[^=]*=\\s*new Set\\(\\[([\\s\\S]*?)\\]\\)`),
  );
  assert.ok(match, `${declarationName} declaration should remain discoverable`);
  return [...match[1].matchAll(/"([^"]+)"/g)].map((entry) => entry[1]);
}

test("transit signs map to houses with correct wraparound", () => {
  for (let ascendant = 0; ascendant < 12; ascendant += 1) {
    const houses = Array.from({ length: 12 }, (_, transit) => houseFor(transit, ascendant));
    assert.deepEqual(
      [...houses].sort((a, b) => a - b),
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    );
    assert.equal(houseFor(ascendant, ascendant), 1);
    assert.equal(houseFor((ascendant + 11) % 12, ascendant), 12);
  }
});

test("proactive guidance settings preserve delivery preferences and quiet-hour boundaries", async () => {
  const [routeSource, settingsSource, deliverySource, ...localeSources] = await Promise.all([
    readProjectFile("src/routes/settings.proactive.tsx"),
    readProjectFile("src/lib/proactive.ts"),
    readProjectFile("supabase/functions/source 3/index.ts"),
    ...["en", "hi", "mr"].map((locale) => readProjectFile(`src/i18n/locales/${locale}.json`)),
  ]);

  for (const callback of [
    "onToggleEnabled",
    "onChangeFrequency",
    "onChangeQuiet",
    "onToggleKind",
  ]) {
    assert.match(routeSource, new RegExp(`const ${callback} =`));
  }
  assert.match(routeSource, /quiet_hours_start: null, quiet_hours_end: null/);
  assert.match(
    routeSource,
    /const quietHoursActive = local\.quiet_hours_start != null && local\.quiet_hours_end != null/,
  );
  assert.match(routeSource, /saveMutation\.mutateAsync\(patch\)/);
  assert.match(routeSource, /saveMutation\.isPending/);
  assert.match(routeSource, /mutedKindCount/);

  assert.match(settingsSource, /enabled: true/);
  assert.match(settingsSource, /max_per_week: 3/);
  assert.match(settingsSource, /quiet_hours_start: null/);
  assert.match(settingsSource, /quiet_hours_end: null/);
  assert.match(
    settingsSource,
    /\.from\("user_proactive_settings"\)\.upsert\([\s\S]*user_id: userId/,
  );

  assert.match(deliverySource, /if \(hour < 0 \|\| start == null \|\| end == null\) return false/);
  assert.match(deliverySource, /if \(start === end\) return false/);
  assert.match(deliverySource, /if \(start < end\) return hour >= start && hour < end/);
  assert.match(deliverySource, /return hour >= start \|\| hour < end/);

  const localeNames = ["en", "hi", "mr"];
  const locales = Object.fromEntries(
    localeSources.map((source, index) => [localeNames[index], JSON.parse(source)]),
  );
  for (const path of [
    "settings.proactive.enabledDetail",
    "settings.proactive.enabledStatusOn",
    "settings.proactive.enabledStatusOff",
    "settings.proactive.controlsPaused",
    "settings.proactive.saving",
    "settings.proactive.frequencyDetail",
    "settings.proactive.frequencyStatus",
    "settings.proactive.frequencyStatusOff",
    "settings.proactive.quietDetail",
    "settings.proactive.quietStatusActive",
    "settings.proactive.quietStatusOff",
    "settings.proactive.mutedKindsDetail",
    "settings.proactive.mutedKindsStatusAll",
    "settings.proactive.mutedKindsStatusMuted",
  ]) {
    const english = atPath(locales.en, path);
    assert.equal(typeof english, "string", `English key missing: ${path}`);
    for (const locale of localeNames.slice(1)) {
      const translated = atPath(locales[locale], path);
      assert.equal(typeof translated, "string", `${locale} key missing: ${path}`);
      assert.deepEqual(
        placeholders(translated),
        placeholders(english),
        `${locale} placeholders differ: ${path}`,
      );
    }
  }
});

test("ascendant lookup prefers an explicit Lagna over a house-one fallback", () => {
  const planets = [
    { name: "Sun", house: 1, signIndex: 4 },
    { name: "Ascendant", house: 1, signIndex: 8 },
  ];
  assert.equal(findAscendantSignIndex(planets), 8);
  assert.equal(findAscendantSignIndex([{ name: "Moon", house: 1, signIndex: 2 }]), 2);
  assert.equal(findAscendantSignIndex([{ name: "Moon", house: 7, signIndex: 2 }]), null);
});

test("provider planet codes keep their intended frontend identities", () => {
  assert.deepEqual(PLANET_KEY_BY_CODE, {
    0: "sun",
    2: "mercury",
    3: "venus",
    4: "mars",
    5: "jupiter",
    6: "saturn",
    101: "rahu",
    102: "ketu",
  });
  assert.equal(INGRESS_SOON_MS, 864_000_000);
});

test("Journey-to-Ask accepts opaque handoff tokens, never prompt text", () => {
  assert.equal(isJourneyAskToken("8c8f3c63-46f2-4a68-a0b2-49d284c77c67"), true);
  assert.equal(isJourneyAskToken("I wrote a private reflection about work"), false);
  assert.equal(isJourneyAskToken("8c8f3c63-46f2-3a68-a0b2-49d284c77c67"), false);
});

test("Journey-to-Ask copy exists in every locale with safe interpolation", async () => {
  const localeNames = ["en", "hi", "mr"];
  const locales = Object.fromEntries(
    await Promise.all(
      localeNames.map(async (locale) => [
        locale,
        JSON.parse(await readProjectFile(`src/i18n/locales/${locale}.json`)),
      ]),
    ),
  );
  const paths = [
    "chat.journeyDraftTitle",
    "chat.journeyDraftHint",
    "journey.askContext.eyebrow",
    "journey.askContext.title",
    "journey.askContext.description",
    "journey.askContext.eventSource",
    "journey.askContext.reflectionSource",
    "journey.askContext.eventIncluded",
    "journey.askContext.reflectionIncluded",
    "journey.askContext.notIncludedBody",
    "journey.askContext.contextNote",
    "journey.askContext.eventAction",
    "journey.askContext.reflectionAction",
    "journey.askContext.eventDraft",
    "journey.askContext.reflectionDraft",
  ];

  for (const path of paths) {
    const english = atPath(locales.en, path);
    assert.equal(typeof english, "string", `English key missing: ${path}`);
    assert.ok(english.trim(), `English key empty: ${path}`);
    for (const locale of localeNames.slice(1)) {
      const translated = atPath(locales[locale], path);
      assert.equal(typeof translated, "string", `${locale} key missing: ${path}`);
      assert.ok(translated.trim(), `${locale} key empty: ${path}`);
      assert.deepEqual(
        placeholders(translated),
        placeholders(english),
        `${locale} placeholders differ: ${path}`,
      );
    }
  }
});

test("Connections list preserves owner-scoped navigation and truthful birth-time precision", async () => {
  const [routeSource, ...localeSources] = await Promise.all([
    readProjectFile("src/routes/people.index.tsx"),
    ...["en", "hi", "mr"].map((locale) => readProjectFile(`src/i18n/locales/${locale}.json`)),
  ]);
  assert.match(routeSource, /useRelatedCharts\(\)/);
  assert.doesNotMatch(routeSource, /usePersonCharts|useCompatibility/);
  assert.match(routeSource, /to="\/people\/\$id"/);
  assert.match(routeSource, /p\.birth_time_known\s*\?\s*t\("people\.birthTimeKnown"\)/);

  const localeNames = ["en", "hi", "mr"];
  const locales = Object.fromEntries(
    localeSources.map((source, index) => [localeNames[index], JSON.parse(source)]),
  );
  const paths = [
    "people.eyebrow",
    "people.circleTitle",
    "people.count",
    "people.birthTimeKnown",
    "people.birthTimeUnknown",
    "people.loading",
    "people.emptyTitle",
  ];
  for (const path of paths) {
    const english = atPath(locales.en, path);
    assert.equal(typeof english, "string", `English key missing: ${path}`);
    for (const locale of localeNames.slice(1)) {
      const translated = atPath(locales[locale], path);
      assert.equal(typeof translated, "string", `${locale} key missing: ${path}`);
      assert.deepEqual(
        placeholders(translated),
        placeholders(english),
        `${locale} placeholders differ: ${path}`,
      );
    }
  }
});

test("add-person flow preserves validation, known-time handling, and the saved-person cache contract", async () => {
  const [routeSource, ...localeSources] = await Promise.all([
    readProjectFile("src/routes/people.new.tsx"),
    ...["en", "hi", "mr"].map((locale) => readProjectFile(`src/i18n/locales/${locale}.json`)),
  ]);
  assert.match(routeSource, /if \(!form\.timeUnknown && !form\.time\) e\.time/);
  assert.match(routeSource, /if \(!form\.place\.trim\(\) \|\| !form\.placeCoords\) e\.place/);
  assert.match(routeSource, /birth_time:\s*form\.timeUnknown \? null : form\.time/);
  assert.match(routeSource, /birth_time_known:\s*!form\.timeUnknown/);
  assert.match(routeSource, /birth_timezone:\s*form\.placeCoords\?\.timezone \?\? "Asia\/Kolkata"/);
  assert.match(routeSource, /res\.limitReached \? t\("people\.limitReached"\)/);
  assert.match(routeSource, /invalidateQueries\(\{ queryKey: \["related-charts", "list"\] \}\)/);
  assert.match(routeSource, /navigate\(\{ to: "\/people" \}\)/);

  const localeNames = ["en", "hi", "mr"];
  const locales = Object.fromEntries(
    localeSources.map((source, index) => [localeNames[index], JSON.parse(source)]),
  );
  const paths = [
    "people.new.subtitle",
    "people.new.relationTitle",
    "people.new.birthTitle",
    "people.new.timeUnknownHint",
    "people.new.privacyNote",
  ];
  for (const path of paths) {
    const english = atPath(locales.en, path);
    assert.equal(typeof english, "string", `English key missing: ${path}`);
    for (const locale of localeNames.slice(1)) {
      const translated = atPath(locales[locale], path);
      assert.equal(typeof translated, "string", `${locale} key missing: ${path}`);
      assert.deepEqual(
        placeholders(translated),
        placeholders(english),
        `${locale} placeholders differ: ${path}`,
      );
    }
  }
});

test("remedy lookup covers every graha and preserves canonical day relationships", () => {
  assert.deepEqual(Object.keys(PLANET_REMEDIES).sort(), [...PLANETS].sort());
  assert.deepEqual(
    Object.fromEntries(PLANETS.map((planet) => [planet, PLANET_REMEDIES[planet].day])),
    { sun: 0, moon: 1, mars: 2, mercury: 3, jupiter: 4, venus: 5, saturn: 6, rahu: 6, ketu: 2 },
  );
  for (const remedy of Object.values(PLANET_REMEDIES)) {
    assert.match(remedy.mantra.devanagari, /[\u0900-\u097F]/);
    assert.ok(remedy.mantra.transliteration.length > 10);
    assert.ok(remedy.day >= 0 && remedy.day <= 6);
    assert.ok(remedy.dana.length > 0);
  }
  assert.strictEqual(DOSHA_REMEDIES.mangal_dosha.mantra, PLANET_REMEDIES.mars.mantra);
  assert.strictEqual(DOSHA_REMEDIES.sade_sati.mantra, PLANET_REMEDIES.saturn.mantra);
  assert.deepEqual(
    Object.values(DOSHA_REMEDIES)
      .map((remedy) => remedy.noteKey)
      .sort(),
    ["kaalSarpDoshaNote", "mangalDoshaNote", "sadeSatiDoshaNote"],
  );
});

test("compatibility UI maps every backend kuta, verdict and handled error", async () => {
  const [routeSource, backendSource] = await Promise.all([
    readProjectFile("src/routes/people.$id.compatibility.tsx"),
    readProjectFile("supabase/functions/compatibility/index.ts"),
  ]);

  assert.deepEqual(parseStringMap(routeSource, "KUTA_KEY"), KUTA_MAP);
  assert.deepEqual(parseStringSet(routeSource, "KNOWN_ERROR_CODES"), COMPATIBILITY_ERRORS);
  assert.deepEqual(parseStringSet(routeSource, "BENEFIC_PLANETS"), ["venus", "jupiter", "moon"]);

  for (const kuta of Object.keys(KUTA_MAP))
    assert.match(backendSource, new RegExp(`name: "${kuta}"`));
  for (const verdict of GUNA_VERDICTS)
    assert.match(backendSource, new RegExp(`verdict = "${verdict}"`));
  for (const verdict of MANGAL_VERDICTS)
    assert.match(backendSource, new RegExp(`mangalVerdict = "${verdict}"`));
  for (const code of COMPATIBILITY_ERRORS) assert.match(backendSource, new RegExp(`"${code}"`));
  assert.match(backendSource, /assumed_gender:\s*assumedGender/);
});

test("compatibility labels exist in every locale with matching interpolation variables", async () => {
  const localeNames = ["en", "hi", "mr"];
  const locales = Object.fromEntries(
    await Promise.all(
      localeNames.map(async (locale) => [
        locale,
        JSON.parse(await readProjectFile(`src/i18n/locales/${locale}.json`)),
      ]),
    ),
  );
  const paths = [
    "people.compatibility.subtitle",
    "people.compatibility.loadError",
    "people.compatibility.gunaMilan.gotLabel",
    ...COMPATIBILITY_ERRORS.map((code) => `people.compatibility.errors.${code}`),
    ...GUNA_VERDICTS.map((verdict) => `people.compatibility.gunaMilan.verdicts.${verdict}`),
    ...MANGAL_VERDICTS.map((verdict) => `people.compatibility.mangal.verdicts.${verdict}`),
    ...Object.values(KUTA_MAP).flatMap((key) => [
      `people.compatibility.kutas.${key}.name`,
      `people.compatibility.kutas.${key}.meaning`,
    ]),
    "people.compatibility.synastry.subtitle",
    "people.compatibility.synastry.templates.benefic",
    "people.compatibility.synastry.templates.saturn",
    "people.compatibility.synastry.templates.mars",
  ];

  for (const path of paths) {
    const english = atPath(locales.en, path);
    assert.equal(typeof english, "string", `English key missing: ${path}`);
    assert.ok(english.trim(), `English key empty: ${path}`);
    for (const locale of localeNames.slice(1)) {
      const translated = atPath(locales[locale], path);
      assert.equal(typeof translated, "string", `${locale} key missing: ${path}`);
      assert.ok(translated.trim(), `${locale} key empty: ${path}`);
      assert.deepEqual(
        placeholders(translated),
        placeholders(english),
        `${locale} placeholders differ: ${path}`,
      );
    }
  }

  for (const locale of localeNames) {
    for (const planet of PLANETS) {
      assert.ok(
        atPath(locales[locale], `home.planets.${planet}`),
        `${locale} planet label missing: ${planet}`,
      );
    }
  }
});

test("person and compatibility cache identities cannot cross users or saved people", async () => {
  const queriesSource = await readProjectFile("src/lib/queries.ts");
  assert.match(
    queriesSource,
    /queryKey:\s*\["related-charts",\s*"person-charts",\s*userId,\s*relatedChartId\]/,
  );
  assert.match(
    queriesSource,
    /queryKey:\s*\["related-charts",\s*"compatibility",\s*userId,\s*relatedChartId\]/,
  );
  assert.match(queriesSource, /body:\s*\{\s*related_chart_id:\s*relatedChartId\s*\}/);
});

test("person detail keeps the selected saved-person identity on every derived path", async () => {
  const [routeSource, ...localeSources] = await Promise.all([
    readProjectFile("src/routes/people.$id.index.tsx"),
    ...["en", "hi", "mr"].map((locale) => readProjectFile(`src/i18n/locales/${locale}.json`)),
  ]);

  assert.match(routeSource, /usePersonCharts\(id\)/);
  assert.match(routeSource, /subjectRelatedChartId:\s*id/);
  assert.match(routeSource, /to="\/people\/\$id\/compatibility"/);
  assert.match(routeSource, /params=\{\{ id \}\}/);
  assert.match(routeSource, /COMPAT_RELATIONS\.includes\(bundle\.person\.relation\)/);
  assert.match(routeSource, /bundle\.person\.birth_time_known/);
  assert.doesNotMatch(routeSource, /useDasha\(/);

  const localeNames = ["en", "hi", "mr"];
  const locales = Object.fromEntries(
    localeSources.map((source, index) => [localeNames[index], JSON.parse(source)]),
  );
  const paths = [
    "people.detail.eyebrow",
    "people.detail.chartTitle",
    "people.detail.chartLimited",
    "people.detail.compatibilityUnavailableHint",
    "people.detail.timingUnavailable",
  ];
  for (const path of paths) {
    const english = atPath(locales.en, path);
    assert.equal(typeof english, "string", `English key missing: ${path}`);
    for (const locale of localeNames.slice(1)) {
      const translated = atPath(locales[locale], path);
      assert.equal(typeof translated, "string", `${locale} key missing: ${path}`);
      assert.deepEqual(
        placeholders(translated),
        placeholders(english),
        `${locale} placeholders differ: ${path}`,
      );
    }
  }
});

test("edit-person preserves person-scoped save navigation and birth-data cache behavior", async () => {
  const [routeSource, personChartsSource, ...localeSources] = await Promise.all([
    readProjectFile("src/routes/people.$id.edit.tsx"),
    readProjectFile("supabase/functions/person-charts/index.ts"),
    ...["en", "hi", "mr"].map((locale) => readProjectFile(`src/i18n/locales/${locale}.json`)),
  ]);

  assert.match(routeSource, /getRelatedChart\(id\)/);
  assert.match(routeSource, /updateRelatedChart\(id,\s*\{/);
  assert.match(routeSource, /birth_time:\s*form\.timeUnknown \? null : form\.time/);
  assert.match(routeSource, /birth_time_known:\s*!form\.timeUnknown/);
  assert.match(routeSource, /birth_timezone:\s*form\.placeCoords\?\.timezone \?\? "Asia\/Kolkata"/);
  assert.match(routeSource, /invalidateQueries\(\{ queryKey: \["related-charts"\] \}\)/);
  assert.match(routeSource, /navigate\(\{ to: "\/people\/\$id", params: \{ id \} \}\)/);
  assert.match(routeSource, /deleteRelatedChart\(id\)/);
  assert.match(routeSource, /navigate\(\{ to: "\/people" \}\)/);

  assert.match(personChartsSource, /datetime_used:\s*datetimeUsed/);
  assert.match(personChartsSource, /coordinates_used:\s*`\$\{lat\},\$\{lon\}`/);
  assert.match(personChartsSource, /time_confidence:\s*person\.birth_time_known \? "high" : "low"/);
  assert.match(personChartsSource, /\.eq\("input_hash", inputHash\)/);
  assert.match(personChartsSource, /if \(cached && !forceRefresh\)/);

  const localeNames = ["en", "hi", "mr"];
  const locales = Object.fromEntries(
    localeSources.map((source, index) => [localeNames[index], JSON.parse(source)]),
  );
  const paths = [
    "people.edit.subtitle",
    "people.edit.introBody",
    "people.edit.timeUnknownHint",
    "people.edit.saveNote",
    "people.edit.deleteHint",
  ];
  for (const path of paths) {
    const english = atPath(locales.en, path);
    assert.equal(typeof english, "string", `English key missing: ${path}`);
    for (const locale of localeNames.slice(1)) {
      const translated = atPath(locales[locale], path);
      assert.equal(typeof translated, "string", `${locale} key missing: ${path}`);
      assert.deepEqual(
        placeholders(translated),
        placeholders(english),
        `${locale} placeholders differ: ${path}`,
      );
    }
  }
});

test("compatibility overview keeps the selected pair and leads with returned relationship patterns", async () => {
  const [routeSource, ...localeSources] = await Promise.all([
    readProjectFile("src/routes/people.$id.compatibility.tsx"),
    ...["en", "hi", "mr"].map((locale) => readProjectFile(`src/i18n/locales/${locale}.json`)),
  ]);

  assert.match(routeSource, /useCompatibility\(id\)/);
  assert.match(routeSource, /usePersonCharts\(id\)/);
  assert.match(routeSource, /const partnerName = bundle\?\.partner\.name \?\? personBundle/);
  assert.match(
    routeSource,
    /<CompatibilityOverview bundle=\{bundle\} partnerName=\{partnerName\} \/>/,
  );
  assert.match(routeSource, /const \{ highlights \} = bundle\.synastry/);
  assert.match(routeSource, /const \{ total, max \} = bundle\.guna_milan/);
  assert.match(routeSource, /BENEFIC_PLANETS\.has\(match\[1\]\)/);
  assert.match(routeSource, /CONVERSATION_PLANETS\.has\(match\[1\]\)/);
  assert.ok(
    routeSource.indexOf("<CompatibilityOverview bundle={bundle} partnerName={partnerName} />") <
      routeSource.indexOf("<GunaMilanCard bundle={bundle} />"),
    "relationship patterns must precede the named traditional score",
  );

  const localeNames = ["en", "hi", "mr"];
  const locales = Object.fromEntries(
    localeSources.map((source, index) => [localeNames[index], JSON.parse(source)]),
  );
  const paths = [
    "people.compatibility.pairEyebrow",
    "people.compatibility.selfLabel",
    "people.compatibility.overview.summary",
    "people.compatibility.overview.easeTitle",
    "people.compatibility.overview.conversationTitle",
    "people.compatibility.overview.traditionalMethod",
    "people.compatibility.overview.traditionalLimit",
  ];
  for (const path of paths) {
    const english = atPath(locales.en, path);
    assert.equal(typeof english, "string", `English key missing: ${path}`);
    for (const locale of localeNames.slice(1)) {
      const translated = atPath(locales[locale], path);
      assert.equal(typeof translated, "string", `${locale} key missing: ${path}`);
      assert.deepEqual(
        placeholders(translated),
        placeholders(english),
        `${locale} placeholders differ: ${path}`,
      );
    }
  }
});

test("compatibility details retain returned measures and offer retry without alarm styling", async () => {
  const [routeSource, backendSource, ...localeSources] = await Promise.all([
    readProjectFile("src/routes/people.$id.compatibility.tsx"),
    readProjectFile("supabase/functions/compatibility/index.ts"),
    ...["en", "hi", "mr"].map((locale) => readProjectFile(`src/i18n/locales/${locale}.json`)),
  ]);

  assert.match(routeSource, /<ErrorState/);
  assert.match(routeSource, /onRetry=\{\(\) => void query\.refetch\(\)\}/);
  assert.ok(
    routeSource.indexOf("<header") < routeSource.indexOf("<ErrorState"),
    "the explicit pair header must remain visible before a compatibility failure",
  );
  assert.match(routeSource, /const \{ total, max, verdict, kutas \} = bundle\.guna_milan/);
  assert.match(routeSource, /kutas\.map\(\(k\) =>/);
  assert.match(routeSource, /got: kuta\.got, max: kuta\.max/);
  assert.match(routeSource, /const \{ self, partner, verdict \} = bundle\.mangal/);
  assert.match(routeSource, /manglik=\{self\.manglik\}/);
  assert.match(routeSource, /manglik=\{partner\.manglik\}/);
  assert.match(routeSource, /partner_planets_in_self_houses/);
  assert.doesNotMatch(routeSource, /manglik \? "text-destructive-strong"/);

  assert.match(
    backendSource,
    /mangal: \{ self: selfMangal, partner: partnerMangal, verdict: mangalVerdict \}/,
  );
  assert.match(backendSource, /partner_planets_in_self_houses: partnerInSelf/);
  assert.match(backendSource, /highlights: synastryHighlights\(partnerInSelf\)/);

  const localeNames = ["en", "hi", "mr"];
  const locales = Object.fromEntries(
    localeSources.map((source, index) => [localeNames[index], JSON.parse(source)]),
  );
  const paths = [
    "people.compatibility.errorTitle",
    "people.compatibility.gunaMilan.method",
    "people.compatibility.gunaMilan.limit",
    "people.compatibility.mangal.method",
    "people.compatibility.mangal.limit",
    "people.compatibility.synastry.method",
    "people.compatibility.synastry.limit",
  ];
  for (const path of paths) {
    const english = atPath(locales.en, path);
    assert.equal(typeof english, "string", `English key missing: ${path}`);
    for (const locale of localeNames.slice(1)) {
      const translated = atPath(locales[locale], path);
      assert.equal(typeof translated, "string", `${locale} key missing: ${path}`);
      assert.deepEqual(
        placeholders(translated),
        placeholders(english),
        `${locale} placeholders differ: ${path}`,
      );
    }
  }
});

test("settings overview groups utility controls and keeps every destination reachable", async () => {
  const [settingsSource, shellSource, ...localeSources] = await Promise.all([
    readProjectFile("src/routes/settings.index.tsx"),
    readProjectFile("src/components/layout/AppShell.tsx"),
    ...["en", "hi", "mr"].map((locale) => readProjectFile(`src/i18n/locales/${locale}.json`)),
  ]);

  for (const destination of [
    "/onboarding/birth",
    "/settings/memory",
    "/settings/proactive",
    "/settings/voice",
    "/terms",
    "/privacy",
  ]) {
    assert.match(settingsSource, new RegExp(destination));
  }
  assert.match(settingsSource, /to="\/settings\/preferences"/);
  assert.match(settingsSource, /updatePreferences\(\{ memory_opt_in \}\)/);
  assert.match(settingsSource, /await mockAuth\.signOut\(\)/);
  assert.match(settingsSource, /clearSession\(\)/);
  assert.doesNotMatch(settingsSource, /navigate\(\{ to: "\/(people|journal|life)" \}\)/);
  assert.match(shellSource, /to: "\/journey"/);
  assert.match(shellSource, /to: "\/people"/);

  const localeNames = ["en", "hi", "mr"];
  const locales = Object.fromEntries(
    localeSources.map((source, index) => [localeNames[index], JSON.parse(source)]),
  );
  for (const path of [
    "settings.eyebrow",
    "settings.subtitle",
    "settings.experience.title",
    "settings.guidance.title",
    "settings.voice.title",
    "settings.governance.title",
  ]) {
    const english = atPath(locales.en, path);
    assert.equal(typeof english, "string", `English key missing: ${path}`);
    for (const locale of localeNames.slice(1)) {
      const translated = atPath(locales[locale], path);
      assert.equal(typeof translated, "string", `${locale} key missing: ${path}`);
      assert.deepEqual(
        placeholders(translated),
        placeholders(english),
        `${locale} placeholders differ: ${path}`,
      );
    }
  }
});

test("settings account actions keep sign-out and local-clear scopes explicit", async () => {
  const [settingsSource, shellSource, queriesSource, ...localeSources] = await Promise.all([
    readProjectFile("src/routes/settings.index.tsx"),
    readProjectFile("src/components/layout/AppShell.tsx"),
    readProjectFile("src/lib/queries.ts"),
    ...["en", "hi", "mr"].map((locale) => readProjectFile(`src/i18n/locales/${locale}.json`)),
  ]);

  assert.match(settingsSource, /const onSignOut = async \(\) => \{/);
  assert.match(settingsSource, /cache\.clear\(\);[\s\S]*await mockAuth\.signOut\(\)/);
  assert.match(settingsSource, /navigate\(\{ to: "\/auth" \}\)/);
  assert.match(settingsSource, /const onDelete = \(\) => \{/);
  assert.match(settingsSource, /cache\.clear\(\);[\s\S]*clearSession\(\)/);
  assert.match(settingsSource, /window\.localStorage\.removeItem\("astrosaathi\.preferences"\)/);
  assert.match(settingsSource, /setConfirmDelete\(false\);[\s\S]*navigate\(\{ to: "\/auth" \}\)/);
  assert.match(settingsSource, /onClick=\{\(\) => setConfirmDelete\(true\)\}/);
  assert.match(settingsSource, /onCancel=\{\(\) => setConfirmDelete\(false\)\}/);
  assert.match(settingsSource, /onConfirm=\{onDelete\}/);
  assert.match(settingsSource, /confirmTone="danger"/);

  assert.match(shellSource, /useChartGatewayCacheControls/);
  assert.match(shellSource, /cache\.clear\(\);[\s\S]*void mockAuth\.signOut\(\)/);
  assert.match(queriesSource, /qc\.removeQueries\(\{ queryKey: ROOT \}\)/);
  assert.match(queriesSource, /window\.localStorage\.removeItem\(PERSIST_STORAGE_KEY\)/);

  const localeNames = ["en", "hi", "mr"];
  const locales = Object.fromEntries(
    localeSources.map((source, index) => [localeNames[index], JSON.parse(source)]),
  );
  for (const path of [
    "settings.account.signOutHint",
    "settings.account.localDataTitle",
    "settings.account.localDataHint",
    "settings.account.delete",
    "settings.account.deleteTitle",
    "settings.account.deleteBody",
    "settings.account.confirm",
  ]) {
    const english = atPath(locales.en, path);
    assert.equal(typeof english, "string", `English key missing: ${path}`);
    assert.ok(english.trim(), `English key empty: ${path}`);
    for (const locale of localeNames.slice(1)) {
      const translated = atPath(locales[locale], path);
      assert.equal(typeof translated, "string", `${locale} key missing: ${path}`);
      assert.ok(translated.trim(), `${locale} key empty: ${path}`);
      assert.deepEqual(
        placeholders(translated),
        placeholders(english),
        `${locale} placeholders differ: ${path}`,
      );
    }
  }
  assert.match(atPath(locales.en, "settings.account.localDataHint"), /does not delete/i);
  assert.match(atPath(locales.en, "settings.account.deleteBody"), /not deleted/i);
  assert.doesNotMatch(atPath(locales.en, "settings.account.delete"), /account/i);
});

test("legal pages preserve static policy content, cross-links, and methodology labels", async () => {
  const [
    legalPageSource,
    termsRouteSource,
    privacyRouteSource,
    consentRouteSource,
    settingsRouteSource,
    compatibilityRouteSource,
    ...localeSources
  ] = await Promise.all([
    readProjectFile("src/components/LegalPage.tsx"),
    readProjectFile("src/routes/terms.tsx"),
    readProjectFile("src/routes/privacy.tsx"),
    readProjectFile("src/routes/onboarding.consent.tsx"),
    readProjectFile("src/routes/settings.index.tsx"),
    readProjectFile("src/routes/people.$id.compatibility.tsx"),
    ...["en", "hi", "mr"].map((locale) => readProjectFile(`src/i18n/locales/${locale}.json`)),
  ]);

  assert.match(termsRouteSource, /<LegalPage i18nKey="terms" \/>/);
  assert.match(privacyRouteSource, /<LegalPage i18nKey="privacy" \/>/);
  assert.match(legalPageSource, /returnObjects: true/);
  assert.match(legalPageSource, /to=\{alternate\}/);
  assert.ok(legalPageSource.includes("href={`#${i18nKey}-section-${i + 1}`}"));
  assert.doesNotMatch(legalPageSource, /supabase|useMutation|fetch\(|invoke\(/);
  assert.match(consentRouteSource, /href: "\/terms"/);
  assert.match(consentRouteSource, /href: "\/privacy"/);
  assert.match(settingsRouteSource, /to="\/terms"/);
  assert.match(settingsRouteSource, /to="\/privacy"/);

  for (const methodologyKey of [
    "people.compatibility.gunaMilan.method",
    "people.compatibility.gunaMilan.limit",
    "people.compatibility.mangal.method",
    "people.compatibility.mangal.limit",
    "people.compatibility.synastry.method",
    "people.compatibility.synastry.limit",
  ]) {
    assert.match(compatibilityRouteSource, new RegExp(methodologyKey.replaceAll(".", "\\.")));
  }

  const localeNames = ["en", "hi", "mr"];
  const locales = Object.fromEntries(
    localeSources.map((source, index) => [localeNames[index], JSON.parse(source)]),
  );
  for (const legalKey of ["terms", "privacy"]) {
    const englishSections = atPath(locales.en, `${legalKey}.sections`);
    assert.ok(Array.isArray(englishSections), `English ${legalKey} sections missing`);
    for (const locale of localeNames) {
      assert.equal(typeof atPath(locales[locale], `${legalKey}.title`), "string");
      assert.equal(typeof atPath(locales[locale], `${legalKey}.lastUpdated`), "string");
      assert.equal(typeof atPath(locales[locale], `${legalKey}.draftNotice`), "string");
      const sections = atPath(locales[locale], `${legalKey}.sections`);
      assert.equal(sections.length, englishSections.length, `${locale} ${legalKey} section count`);
      sections.forEach((section, index) => {
        assert.equal(typeof section.heading, "string");
        assert.ok(section.heading.trim(), `${locale} ${legalKey} heading ${index + 1}`);
        assert.equal(section.body.length, englishSections[index].body.length);
        section.body.forEach((paragraph) => {
          assert.equal(typeof paragraph, "string");
          assert.ok(paragraph.trim(), `${locale} ${legalKey} paragraph ${index + 1}`);
        });
      });
    }
  }
});

test("experience preferences retain locale and theme persistence contracts", async () => {
  const [
    overviewSource,
    routeSource,
    preferencesSource,
    i18nSource,
    routeTreeSource,
    ...localeSources
  ] = await Promise.all([
    readProjectFile("src/routes/settings.index.tsx"),
    readProjectFile("src/routes/settings.preferences.tsx"),
    readProjectFile("src/lib/preferences.ts"),
    readProjectFile("src/i18n/index.ts"),
    readProjectFile("src/routeTree.gen.ts"),
    ...["en", "hi", "mr"].map((locale) => readProjectFile(`src/i18n/locales/${locale}.json`)),
  ]);

  assert.match(overviewSource, /to="\/settings\/preferences"/);
  assert.match(routeTreeSource, /SettingsPreferencesRoute/);
  assert.match(routeSource, /setLanguage\(option\)/);
  assert.match(routeSource, /update\(\{ theme \}\)/);
  assert.match(routeSource, /update\(\{ tone \}\)/);
  assert.match(routeSource, /update\(\{ answer_length \}\)/);
  assert.match(routeSource, /applyTheme\(patch\.theme\)/);

  assert.match(preferencesSource, /const THEME_KEY = "astrosaathi\.theme"/);
  assert.match(preferencesSource, /window\.localStorage\.getItem\(THEME_KEY\)/);
  assert.match(preferencesSource, /window\.localStorage\.setItem\(THEME_KEY, t\)/);
  assert.match(preferencesSource, /theme === "dark" \|\| \(theme === "system" && prefersDark\)/);
  assert.match(
    preferencesSource,
    /if \(getPreferences\(\)\.theme === "system"\) applyTheme\("system"\)/,
  );

  assert.match(i18nSource, /export const LANG_STORAGE_KEY = "astrosaathi\.lang"/);
  assert.match(i18nSource, /window\.localStorage\.setItem\(LANG_STORAGE_KEY, lang\)/);
  assert.match(i18nSource, /update\(\{ locale: dbLocale \}\)/);

  const localeNames = ["en", "hi", "mr"];
  const locales = Object.fromEntries(
    localeSources.map((source, index) => [localeNames[index], JSON.parse(source)]),
  );
  for (const path of [
    "settings.experience.hint",
    "settings.preferences.eyebrow",
    "settings.preferences.title",
    "settings.preferences.subtitle",
    "settings.preferences.languageTitle",
    "settings.preferences.languageHint",
    "settings.preferences.appearanceTitle",
    "settings.preferences.themeHint",
    "settings.preferences.guidanceTitle",
    "settings.preferences.guidanceHint",
  ]) {
    const english = atPath(locales.en, path);
    assert.equal(typeof english, "string", `English key missing: ${path}`);
    for (const locale of localeNames.slice(1)) {
      const translated = atPath(locales[locale], path);
      assert.equal(typeof translated, "string", `${locale} key missing: ${path}`);
      assert.deepEqual(
        placeholders(translated),
        placeholders(english),
        `${locale} placeholders differ: ${path}`,
      );
    }
  }
});

test("voice settings preview preserves local voice preferences and tap-only playback", async () => {
  const [routeSource, voiceSource, ...localeSources] = await Promise.all([
    readProjectFile("src/routes/settings.voice.tsx"),
    readProjectFile("src/lib/voice/useVoice.ts"),
    ...["en", "hi", "mr"].map((locale) => readProjectFile(`src/i18n/locales/${locale}.json`)),
  ]);

  assert.match(routeSource, /const PREVIEW_ID = "voice-settings-preview"/);
  assert.match(routeSource, /const readAloud = useReadAloud/);
  assert.match(routeSource, /onClick=\{previewVoice\}/);
  assert.match(routeSource, /langToBCP47\(i18n\.language, settings\.sttLang\)/);
  assert.match(routeSource, /speaker: settings\.speaker, pace: settings\.pace/);
  assert.match(routeSource, /update\(\{ inputEnabled: v \}\)/);
  assert.match(routeSource, /update\(\{ sttLang: v as SttLang \}\)/);
  assert.match(routeSource, /update\(\{ speaker: v \}\)/);
  assert.match(routeSource, /update\(\{ pace: Number\(v\) \}\)/);

  assert.match(voiceSource, /const VOICE_SETTINGS_KEY = "astrosaathi\.voice\.v1"/);
  assert.match(voiceSource, /localStorage\.setItem\(VOICE_SETTINGS_KEY, JSON\.stringify\(next\)\)/);
  assert.match(voiceSource, /if \(playingId === messageId\) \{[\s\S]*stop\(\)/);
  assert.match(voiceSource, /voiceProvider\.synthesize\([\s\S]*synthOpts/);

  const localeNames = ["en", "hi", "mr"];
  const locales = Object.fromEntries(
    localeSources.map((source, index) => [localeNames[index], JSON.parse(source)]),
  );
  for (const path of [
    "voice.inputStatusOn",
    "voice.inputStatusOff",
    "voice.previewTitle",
    "voice.previewHint",
    "voice.previewPlay",
    "voice.previewLoading",
    "voice.previewStop",
    "voice.previewError",
    "voice.previewText",
  ]) {
    const english = atPath(locales.en, path);
    assert.equal(typeof english, "string", `English key missing: ${path}`);
    for (const locale of localeNames.slice(1)) {
      const translated = atPath(locales[locale], path);
      assert.equal(typeof translated, "string", `${locale} key missing: ${path}`);
      assert.deepEqual(
        placeholders(translated),
        placeholders(english),
        `${locale} placeholders differ: ${path}`,
      );
    }
  }
});

test("memory settings disclose lifecycle boundaries without changing privacy controls", async () => {
  const [routeSource, memorySource, backendSource, ...localeSources] = await Promise.all([
    readProjectFile("src/routes/settings.memory.tsx"),
    readProjectFile("src/lib/memory-settings.ts"),
    readProjectFile("supabase/functions/astrologer-chat/index.ts"),
    ...["en", "hi", "mr"].map((locale) => readProjectFile(`src/i18n/locales/${locale}.json`)),
  ]);

  assert.match(routeSource, /<DisclosureItem[\s\S]*conversationLabel/);
  assert.match(routeSource, /<DisclosureItem[\s\S]*topicsLabel/);
  assert.match(routeSource, /<DisclosureItem[\s\S]*preferencesLabel/);
  assert.match(routeSource, /<DisclosureItem[\s\S]*moodLabel/);
  assert.match(routeSource, /<DisclosureItem[\s\S]*profileLabel/);
  assert.match(
    routeSource,
    /excluded \? t\("settings\.memory\.excludedFromAi"\) : t\("settings\.memory\.availableToAi"\)/,
  );

  for (const callback of [
    "onToggleMemoryEnabled",
    "onChangeDefaultRetention",
    "onChangeCardRetention",
    "onDeleteCard",
    "onClearMood",
    "onResetPrefs",
    "onDeleteAll",
  ]) {
    assert.match(routeSource, new RegExp(`const ${callback} = async`));
  }
  assert.match(routeSource, /setConfirmDeleteAllStep\(2\)/);
  assert.match(routeSource, /onConfirm=\{onDeleteAll\}/);

  assert.match(memorySource, /export type Retention = "forever" \| "days_30" \| "chat" \| "never"/);
  assert.match(memorySource, /case "days_30":[\s\S]*30 \* 24 \* 60 \* 60 \* 1000/);
  assert.match(memorySource, /case "never":[\s\S]*expires_at: new Date\(\)\.toISOString\(\)/);
  assert.match(memorySource, /\.from\("profiles"\)[\s\S]*\.eq\("user_id", userId\)/);
  assert.match(memorySource, /\.from\("user_topic_memory"\)[\s\S]*\.eq\("user_id", userId\)/);
  assert.match(memorySource, /\.from\("user_emotional_state"\)[\s\S]*\.eq\("user_id", userId\)/);

  assert.match(backendSource, /if \(memoryEnabled\) \{/);
  assert.match(backendSource, /if \(r\.retention === "never"\) return false/);
  assert.match(backendSource, /new Date\(exp\)\.getTime\(\) <= nowMs/);
  assert.match(backendSource, /const preferenceText =\s*memoryEnabled/);

  const localeNames = ["en", "hi", "mr"];
  const locales = Object.fromEntries(
    localeSources.map((source, index) => [localeNames[index], JSON.parse(source)]),
  );
  for (const path of [
    "settings.memory.disclosureTitle",
    "settings.memory.disclosure.conversationLabel",
    "settings.memory.disclosure.topicsDescription",
    "settings.memory.masterDetail",
    "settings.memory.masterStatusOn",
    "settings.memory.masterStatusOff",
    "settings.memory.retentionDetail",
    "settings.memory.memoriesHint",
    "settings.memory.availableToAi",
    "settings.memory.prefsCaption",
    "settings.memory.moodCaption",
    "settings.memory.dangerHint",
    "settings.memory.deleteAll",
    "settings.memory.deleteAllTitle",
    "settings.memory.deleteAllBody1",
    "settings.memory.deleteAllBody2",
  ]) {
    const english = atPath(locales.en, path);
    assert.equal(typeof english, "string", `English key missing: ${path}`);
    for (const locale of localeNames.slice(1)) {
      const translated = atPath(locales[locale], path);
      assert.equal(typeof translated, "string", `${locale} key missing: ${path}`);
      assert.deepEqual(
        placeholders(translated),
        placeholders(english),
        `${locale} placeholders differ: ${path}`,
      );
    }
  }
  assert.match(atPath(locales.en, "settings.memory.deleteAll"), /saved/i);
  assert.match(
    atPath(locales.en, "settings.memory.deleteAllBody1"),
    /preferences aren't affected/i,
  );
});
