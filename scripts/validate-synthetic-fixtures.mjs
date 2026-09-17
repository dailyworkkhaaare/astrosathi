import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const fixtureUrl = new URL("../tests/fixtures/astrosaathi.synthetic.json", import.meta.url);
const fixture = JSON.parse(await readFile(fixtureUrl, "utf8"));

const UUID_FIXTURE_PATTERN = /^00000000-0000-4000-8000-000000000\d{3}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^\d{2}:\d{2}:\d{2}$/;
const COMPAT_RELATIONS = new Set(["wife", "husband", "partner"]);
const RELATIONS = new Set([
  "wife",
  "husband",
  "partner",
  "father",
  "mother",
  "brother",
  "sister",
  "son",
  "daughter",
  "grandmother",
  "grandfather",
  "other",
]);
const GENDERS = new Set(["male", "female", null]);
const FORBIDDEN_KEY =
  /(email|phone|password|passcode|token|secret|api.?key|service.?role|access.?key)/i;
const FORBIDDEN_VALUE = /(@|eyJ[a-zA-Z0-9_-]{8,}|(?:sk|sb)[-_][a-zA-Z0-9_-]{12,})/;

function validatePrivacy(value, path = "fixture") {
  if (Array.isArray(value)) {
    value.forEach((item, index) => validatePrivacy(item, `${path}[${index}]`));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      assert.equal(FORBIDDEN_KEY.test(key), false, `Forbidden sensitive key at ${path}.${key}`);
      validatePrivacy(child, `${path}.${key}`);
    }
    return;
  }
  if (typeof value === "string") {
    assert.equal(FORBIDDEN_VALUE.test(value), false, `Suspicious sensitive value at ${path}`);
  }
}

function validateCoordinates(record, label) {
  const bothNull = record.latitude === null && record.longitude === null;
  const bothNumbers = Number.isFinite(record.latitude) && Number.isFinite(record.longitude);
  assert.ok(bothNull || bothNumbers, `${label}: coordinates must both be null or both be finite`);
  if (bothNumbers) {
    assert.ok(record.latitude >= -90 && record.latitude <= 90, `${label}: latitude out of range`);
    assert.ok(
      record.longitude >= -180 && record.longitude <= 180,
      `${label}: longitude out of range`,
    );
  }
}

function validateBirthRecord(record, label) {
  assert.ok(UUID_FIXTURE_PATTERN.test(record.user_id), `${label}: user_id is not fixture-reserved`);
  assert.ok(
    record.full_name.startsWith("Fixture "),
    `${label}: name must visibly identify fixture data`,
  );
  assert.ok(GENDERS.has(record.gender), `${label}: unsupported gender contract value`);
  assert.ok(
    record.birth_date === null || DATE_PATTERN.test(record.birth_date),
    `${label}: invalid date shape`,
  );
  assert.ok(
    record.birth_time === null || TIME_PATTERN.test(record.birth_time),
    `${label}: invalid time shape`,
  );
  assert.equal(
    record.birth_time_known,
    record.birth_time !== null,
    `${label}: birth_time_known and birth_time disagree`,
  );
  assert.ok(
    record.birth_place_label === "" || record.birth_place_label.endsWith("(synthetic fixture)"),
    `${label}: place label must disclose synthetic origin`,
  );
  assert.ok(record.birth_timezone.includes("/"), `${label}: expected an IANA timezone`);
  validateCoordinates(record, label);
}

function expectedPersonCharts(related) {
  if (!related) return { result: "error", error: "not_found" };
  if (related.record.latitude === null || related.record.longitude === null) {
    return { result: "error", error: "missing_coordinates" };
  }
  return {
    result: related.record.birth_time_known ? "computable" : "computable_limited",
  };
}

function expectedCompatibility(self, related) {
  if (!self?.record?.birth_date) return { result: "error", error: "no_self_profile" };
  if (!related) return { result: "error", error: "not_found" };
  if (!COMPAT_RELATIONS.has(related.record.relation)) {
    return { result: "error", error: "not_compat_eligible" };
  }
  if (self.record.latitude === null || self.record.longitude === null) {
    return { result: "error", error: "missing_self_coordinates" };
  }
  if (related.record.latitude === null || related.record.longitude === null) {
    return { result: "error", error: "missing_partner_coordinates" };
  }
  const limited = !self.record.birth_time_known || !related.record.birth_time_known;
  return { result: limited ? "computable_limited" : "computable" };
}

assert.equal(fixture.fixture_set.classification, "synthetic_test_data");
assert.equal(fixture.fixture_set.contains_real_person_data, false);
assert.equal(fixture.fixture_set.production_seed_allowed, false);
validatePrivacy(fixture);

const birthById = new Map();
for (const entry of fixture.birth_profiles) {
  assert.equal(
    birthById.has(entry.fixture_id),
    false,
    `Duplicate birth fixture ${entry.fixture_id}`,
  );
  validateBirthRecord(entry.record, entry.fixture_id);
  birthById.set(entry.fixture_id, entry);

  const expectedReadiness = entry.record.birth_date ? "ready" : "birth_pending";
  assert.equal(
    entry.expected.onboarding_readiness,
    expectedReadiness,
    `${entry.fixture_id}: readiness drift`,
  );
  const expectedConfidence = entry.record.birth_time_known ? "high" : "low";
  assert.equal(
    entry.expected.time_confidence,
    expectedConfidence,
    `${entry.fixture_id}: confidence drift`,
  );
}

const relatedById = new Map();
for (const entry of fixture.related_charts) {
  assert.equal(
    relatedById.has(entry.fixture_id),
    false,
    `Duplicate related fixture ${entry.fixture_id}`,
  );
  assert.ok(
    birthById.has(entry.owner_birth_fixture_id),
    `${entry.fixture_id}: missing owner birth fixture`,
  );
  validateBirthRecord(entry.record, entry.fixture_id);
  assert.ok(
    UUID_FIXTURE_PATTERN.test(entry.record.id),
    `${entry.fixture_id}: id is not fixture-reserved`,
  );
  assert.ok(RELATIONS.has(entry.record.relation), `${entry.fixture_id}: unsupported relation`);
  assert.equal(
    entry.record.user_id,
    birthById.get(entry.owner_birth_fixture_id).record.user_id,
    `${entry.fixture_id}: owner user_id mismatch`,
  );
  assert.equal(
    entry.expected.compatibility_eligible,
    COMPAT_RELATIONS.has(entry.record.relation),
    `${entry.fixture_id}: eligibility drift`,
  );
  relatedById.set(entry.fixture_id, entry);
}

const scenarioIds = new Set();
for (const scenario of fixture.relationship_scenarios) {
  assert.equal(
    scenarioIds.has(scenario.id),
    false,
    `Duplicate relationship scenario ${scenario.id}`,
  );
  scenarioIds.add(scenario.id);
  const self = birthById.get(scenario.self_birth_fixture_id);
  const related = relatedById.get(scenario.related_chart_fixture_id);
  assert.ok(self, `${scenario.id}: missing self birth fixture`);

  const personCharts = expectedPersonCharts(related);
  assert.equal(
    scenario.expected.person_charts_result,
    personCharts.result,
    `${scenario.id}: person-charts result drift`,
  );
  if (personCharts.error) {
    assert.equal(
      scenario.expected.person_charts_error_code,
      personCharts.error,
      `${scenario.id}: person-charts error drift`,
    );
  }

  const compatibility = expectedCompatibility(self, related);
  assert.equal(
    scenario.expected.compatibility_result,
    compatibility.result,
    `${scenario.id}: compatibility result drift`,
  );
  if (compatibility.error) {
    assert.equal(
      scenario.expected.compatibility_error_code,
      compatibility.error,
      `${scenario.id}: compatibility error drift`,
    );
  }

  if (scenario.expected.compatibility_result.startsWith("computable")) {
    const assumedGender = !(
      (self.record.gender === "male" && related.record.gender === "female") ||
      (self.record.gender === "female" && related.record.gender === "male")
    );
    assert.equal(
      scenario.expected.compatibility_assumed_gender,
      assumedGender,
      `${scenario.id}: assumed-gender expectation drift`,
    );
  }
}

console.log(
  `Synthetic fixtures valid: ${fixture.birth_profiles.length} birth profiles, ` +
    `${fixture.related_charts.length} saved people, ` +
    `${fixture.relationship_scenarios.length} relationship scenarios.`,
);
