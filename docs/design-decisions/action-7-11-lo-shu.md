# Action 7.11 — Lo Shu construction reveal

## Understanding summary

- Redesign only the existing Lo Shu grid presentation.
- Reveal the authoritative nine cells once, in their existing order.
- Preserve all digits, counts, cell labels and all surrounding Lo Shu sections.
- Render the completed static grid immediately for reduced-motion users.
- Keep loading, error, navigation, disclosure and query behavior unchanged.
- Add no calculations, requests, recommendations or persistence.

## Assumptions

- A CSS-only opacity and transform transition is sufficient for the construction effect.
- The existing grid DOM remains the accessible source of truth throughout the reveal.
- Animation is bounded to initial rendering and adds no continuous work.

## Decision log

| Decision                           | Alternatives considered                   | Reason                                                                                       |
| ---------------------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------- |
| Use a single sequential CSS reveal | One full-grid fade; continuous shimmer    | It creates a quiet construction moment without sustained visual noise or runtime complexity. |
| Use media-query fallback           | Scripted motion preference handling       | CSS keeps the fallback immediate, reliable and dependency-free.                              |
| Preserve cell order and content    | Reorder or transform values for animation | Protects calculation-output and accessibility parity.                                        |
