# AstroSaathi synthetic contract fixtures

## Scope

This directory contains synthetic, source-controlled inputs for AstroSaathi's safety harness. Action 2.1 covers birth-profile, saved-person and relationship-contract scenarios only.

The fixtures contain no customer exports, authentication credentials, email addresses, phone numbers, API keys, chat text, journal text or production row identifiers. All names begin with `Fixture`, IDs use a visibly reserved deterministic range, and place labels identify themselves as synthetic. Coordinates are approximate public city centres, not private addresses.

These files must never be used to seed production.

## Why JSON plus a dependency-free validator

The repository does not yet have a general frontend test runner. Three approaches were considered:

1. Inline fixture objects inside future tests: rejected because each suite would drift.
2. SQL production-like seed data: rejected because it would couple Action 2.1 to local Supabase/auth setup and increase misuse risk.
3. One portable JSON catalog plus a Node validator: selected because future unit, component and end-to-end tests can share it without network access or production writes.

## Files

- `astrosaathi.synthetic.json` — versioned fixture catalog and expected contract states.
- `../../scripts/validate-synthetic-fixtures.mjs` — privacy, shape, relationship and current-contract validator.

Run:

```sh
npm run test:fixtures
```

## Covered birth-profile states

- Precise birth time in `Asia/Kolkata`.
- Unknown birth time with valid coordinates.
- Missing coordinates.
- Non-India positive-offset timezone and southern-hemisphere coordinates.
- Incomplete profile without a birth date.

## Covered relationship states

- Eligible precise partner pair.
- Eligible partner with unknown birth time.
- Ineligible sibling and family relations.
- Missing partner coordinates.
- Missing self coordinates.
- Ambiguous/same-gender directional Guna-role assumption flag.
- Missing saved-person record.
- Incomplete self profile.
- Long mixed Devanagari/Latin name for layout stress.

## Expected-state boundary

The catalog records readiness, availability and current function error outcomes. It deliberately does not hard-code planetary positions, chart SVG, Guna scores, Manglik results or synastry values. Inventing those would create false golden data. Numerical calculation parity remains owned by the existing parity scripts and later contract tests.

Expected relationship errors mirror current function evaluation order:

1. Incomplete self profile → `no_self_profile`.
2. Missing saved person → `not_found`.
3. Unsupported relation → `not_compat_eligible`.
4. Missing self coordinates → `missing_self_coordinates`.
5. Missing partner coordinates → `missing_partner_coordinates`.

`person-charts` separately returns `not_found` or `missing_coordinates`. Unknown time remains computable using the current noon fallback, but the UI expectation is `limited`, never fully precise.

## Maintenance rules

- Never replace a synthetic fixture with a real user's row “temporarily.”
- Never add secrets or auth-session material.
- Keep expected codes aligned with source contracts; a changed code requires intentional review.
- Preserve exact/unknown time and missing-coordinate cases.
- Add a scenario only when it protects a distinct behavior or state.
- Calculation outputs, when added elsewhere, need documented engine/version provenance.
- Increment `fixture_set.version` for a breaking fixture-shape change.

## Non-functional assumptions

- Fixtures are deterministic and offline.
- Validation requires only the supported Node runtime.
- Future tests may transform catalog records into local-only database rows, but must keep RLS/owner boundaries and never target production.
- The fixture catalog is small enough to review manually and broad enough to exercise high-risk UI mappings.

## Decision log

| Decision                            | Alternatives                                           | Reason                                                           |
| ----------------------------------- | ------------------------------------------------------ | ---------------------------------------------------------------- |
| Use visibly synthetic names and IDs | Realistic pseudonyms and random UUIDs                  | Reduces accidental confusion with customer data.                 |
| Use city-centre coordinates         | Exact-looking residential data; no coordinate fixtures | Exercises coordinate behavior without private location data.     |
| Keep JSON as the shared source      | Test-local objects; SQL seeds                          | Portable across future test layers and network-free.             |
| Validate privacy recursively        | Rely on reviewer attention                             | Fails fast if sensitive-looking fields or values appear.         |
| Model expected states/codes         | Hard-code astrology results                            | Protects UI contracts without inventing numerical truth.         |
| Include unknown time                | Precise-only happy paths                               | Preserves a major product limitation and noon-fallback behavior. |
| Include ineligible relations        | Partner-only fixtures                                  | Protects the current compatibility scope.                        |
| Keep Action 2.1 narrow              | Add chat/journal/market fixtures now                   | Follows the approved one-action-at-a-time plan.                  |
