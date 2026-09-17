# Frontend contract tests

These tests freeze the high-risk data-to-label seams that the redesign must not silently change:

- transit sign-to-house math and ascendant selection;
- provider planet-code identities;
- graha and dosha remedy lookup relationships;
- compatibility kuta, verdict, error, benefic and assumed-gender vocabulary shared by the Edge Function and UI;
- English, Hindi and Marathi key/placeholder parity for compatibility labels;
- user- and person-scoped React Query cache identities.

Run them with:

```sh
npm run test:contracts
```

The suite uses Node's built-in test runner and TypeScript stripping, so it adds no package or network dependency. It is intentionally offline: it does not authenticate, call Supabase, invoke astrology providers, mutate data, or recalculate charts.

These are contract guards, not a claim that the current UI copy is final. A later content action may deliberately update wording, provided all locale keys and interpolation variables remain aligned.
