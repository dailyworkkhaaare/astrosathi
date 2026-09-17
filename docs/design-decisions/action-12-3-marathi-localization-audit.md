# Action 12.3 — Marathi localization audit

## Scope

Validate Marathi typography, overflow, tone, translation completeness and visible control sizing across the redesigned product without changing data contracts or calling real external services.

## Matrix

- Phone: 320 × 800
- Tablet: 768 × 1024
- Desktop: 1440 × 1100

Routes audited in Marathi, light theme and reduced motion:

- Signed out: `/`, `/language`, `/auth`, `/terms`, `/privacy`
- Signed in with synthetic Supabase fixtures: `/today`, `/today/horoscope`, `/today/panchang`, `/today/markets`, `/home`, `/chat`, `/journey`, `/people`, `/people/:id`, `/people/:id/compatibility`, `/settings`, `/settings/preferences`, `/settings/memory`, `/settings/proactive`, `/settings/voice`

## Decision

Reuse the approved Hindi audit shape for Marathi. The focused Playwright audit checks the document language, Devanagari content, horizontal overflow, untranslated key leakage, raw interpolation placeholders, invalid fallback text and visible control sizing. A direct catalog comparison verifies that Marathi contains every English translation key.

## Result

The automated Marathi localization audit passed across all matrix entries. The Marathi catalog matches all 1,577 English translation keys, and no additional product UI changes were required.
