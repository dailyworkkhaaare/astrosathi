# Action 12.6 — Full calculation and integration parity run

## Scope

Run the existing fixture, contract, calculation-parity and desktop integration suites after the approved redesign. Preserve every Supabase contract, astrology calculation, validation, geocoding, timezone and business-logic path.

## Static and contract verification

- Synthetic fixtures: passed for 5 birth profiles, 6 saved people and 8 relationship scenarios
- Contract suite: 22/22 passed
- TypeScript: passed with `tsc --noEmit`
- Production build: passed; the previously recorded PWA precache-glob warning remains for Action 12.7
- Calculation and Supabase implementation files have no redesign diff

## Calculation parity

- Varga calculation parity: 320/320 passed across 20 users and all 16 Vargas
- Varga gateway preflight: 16/16 passed across 4 users and D1, D9, D30 and D60
- Varga render round-trip: 320/320 polygon and near-coordinate checks passed. The optional preview-file writer could not create its hard-coded temporary scratchpad directory after the comparison completed; this did not affect the parity result.
- Sade Sati: all required offline reference and 12-sign invariant checks passed; the optional Prokerala spot-check was skipped because its separate test credentials were unavailable
- Kaal Sarp: 15/15 stored-provider comparisons passed
- Mangal Dosha: 14/15 stored-provider comparisons passed; the single historical artifact differs on whether fourth-house Mars is mild Manglik
- Varga SVG: 228/229 clean-cohort checks and 79/80 stale-cohort checks passed, with one stored D45 and one stale D60 SVG mismatch
- Dasha: 14/15 stored artifacts retained matching lord IDs; 6/15 also met the script's strict one-day boundary tolerance. Eight additional records differed only in boundaries by 1.275–5.067 days, while one historical record differed at the lord level.
- Ashtakavarga stored-artifact comparison: Prastara and Trikona gates passed 105/113; Ekaadhipatya passed 58/113

The non-perfect stored-provider comparisons above reproduce against historical Supabase artifacts while the relevant calculation sources remain unchanged. They are baseline artifact/provider-generation discrepancies, not regressions introduced by the UI redesign. No astrology logic was changed to force stored historical output to match.

## Integration verification

The full desktop-Chrome run exercised 86 tests. The first run exposed five stale selectors that still expected pre-redesign element roles or split text nodes; those assertions were updated without weakening their supplied-data checks. It also exposed a repeatable `/today` layout shift caused by optional loading placeholders collapsing after data resolution.

The final broad run produced 83 passes, 2 project-conditional skips and only the layout-shift audit failure. The layout was corrected by reserving the daily-signal and current-sky card footprints and removing the optional transit band's collapsing loading placeholder. The performance audit then passed three consecutive runs. All five reconciled critical-journey tests passed targeted reruns.

## Decision

Action 12.6 passes for the redesign: contracts, fixtures, type safety, calculation sources and end-to-end business-data assertions remain intact. Historical parity exceptions are explicitly recorded rather than hidden by calculation changes. Production-readiness review remains Action 12.7.
