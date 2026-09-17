# Action 8.1 — Ask shell and empty state

## Understanding summary

- Redesign the Ask route frame and first-message empty state only.
- Preserve conversation loading, authentication, history selection and persistence.
- Preserve the existing composer instance and all seed, validation, voice, streaming and send behavior.
- Preserve current message rendering, feedback and retry behavior for later actions.
- Keep desktop history rail and mobile drawer behavior intact.
- Make prompt starters optional prefills, never automatic submissions.

## Assumptions

- Existing shell markup can be restyled without moving state ownership.
- The current suggested prompt source remains authoritative and is not relabelled as chart evidence.
- No request, dependency, privacy or persistence behavior changes.

## Decision log

| Decision | Alternatives considered | Reason |
| --- | --- | --- |
| Use a manuscript-style shell | Dense messaging chrome; dashboard hero | It creates a calm reading frame while keeping this action presentational. |
| Keep one composer mounted through all states | Empty-state-specific composer | Protects focus, keyboard, voice and seed parity. |
| Keep existing history mechanisms | Replace history navigation | Preserves established auth and persistence behavior. |
