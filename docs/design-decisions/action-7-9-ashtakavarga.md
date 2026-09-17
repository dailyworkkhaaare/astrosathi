# Action 7.9 — Ashtakavarga heatmap

## Understanding summary

- Redesign the existing Ashtakavarga presentation only.
- Show the current Sarvashtakavarga and Bhinnashtakavarga bindus at a glance.
- Retain every exact house score, total, planet selector and contributor disclosure.
- Keep the current Supabase query contracts, calculation output, loading, error and retry behavior unchanged.
- Maintain a readable mobile layout and an immediately available non-colour numeric detail view.
- Do not add forecasts, scoring logic, actions or persistence.

## Assumptions

- Existing score thresholds remain visual presentation only.
- The heatmap is a compact, static enhancement with no new dependency or animation.
- A localized scope note is sufficient to state that bindus do not determine outcomes.

## Decision log

| Decision                                                     | Alternatives considered                        | Reason                                                                                         |
| ------------------------------------------------------------ | ---------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Use a compact heatmap plus the existing numeric detail cards | Heatmap only; colour-accented cards only       | It supports fast visual scanning while retaining exact, accessible values and existing detail. |
| Reuse existing thresholds for heat intensity                 | Recalculate a relative score scale             | Avoids changing interpretation or calculation logic.                                           |
| Keep all data and interactions in place                      | Add new recommendations or drill-down behavior | Keeps the action presentation-only and preserves authoritative contracts.                      |
