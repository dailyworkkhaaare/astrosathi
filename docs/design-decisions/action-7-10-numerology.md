# Action 7.10 — Numerology provenance

## Understanding summary

- Redesign the existing Numerology tab as a distinct numerology lens.
- Preserve all current calculated values, meanings, reductions, master markers and system groupings.
- Make the source boundary visible: this is separate from Jyotish chart calculation.
- Keep the current data query, no-data, loading, error and retry behavior unchanged.
- Maintain a compact mobile-first reading order.
- Do not add recommendations, synthesis, persistence, requests or navigation.

## Assumptions

- The existing payload remains the authoritative source for all displayed values and input availability.
- Core numbers are birth-date-derived and name-system results use the saved name where provided.
- The presentation remains static and introduces no dependencies or privacy exposure.

## Decision log

| Decision                                                         | Alternatives considered                       | Reason                                                                                      |
| ---------------------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Use a two-layer provenance layout                                | Separate tabs; a single disclaimer            | It makes the system boundary apparent while retaining the current information architecture. |
| Render only existing payload fields                              | Recalculate or infer sources in the component | Protects calculation and query contracts.                                                   |
| Keep Pythagorean and Chaldean together as a secondary name layer | Flatten all numbers into one metric grid      | Preserves the existing system grouping and improves reading order.                          |
