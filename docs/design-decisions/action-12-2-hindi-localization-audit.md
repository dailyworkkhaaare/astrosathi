# Action 12.2 — Hindi localization audit

## Scope

Validate Hindi typography, overflow, tone, translation completeness and visible control sizing across the redesigned product without changing data contracts or calling real external services.

## Matrix

- Phone: 320 × 800
- Tablet: 768 × 1024
- Desktop: 1440 × 1100

Routes audited in Hindi, light theme and reduced motion:

- Signed out: `/`, `/language`, `/auth`, `/terms`, `/privacy`
- Signed in with synthetic Supabase fixtures: `/today`, `/today/horoscope`, `/today/panchang`, `/today/markets`, `/home`, `/chat`, `/journey`, `/people`, `/people/:id`, `/people/:id/compatibility`, `/settings`, `/settings/preferences`, `/settings/memory`, `/settings/proactive`, `/settings/voice`

## Decision

Use a focused Playwright localization audit that checks the document language, Devanagari content, horizontal overflow, untranslated key leakage, raw interpolation placeholders, invalid fallback text and visible control sizing. Keep inline prose links exempt from the control-size check; navigation and button-like links remain covered.

## Result

The automated Hindi localization audit passed across all matrix entries. The audit identified and corrected undersized interactive targets for the authentication password-recovery action, the Journey timeline action and shared settings segmented controls. These changes are presentation-only and do not alter Supabase contracts, calculations or business logic.
