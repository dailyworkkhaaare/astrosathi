# Action 12.4 — Accessibility audit

## Scope

Audit the redesigned shared shell and representative signed-out and authenticated screens for the approved WCAG AA concerns without changing data contracts, calculations or business logic.

Representative authenticated routes: `/today`, `/home`, `/chat`, `/journey`, `/people` and `/settings`. The signed-out authentication screen is included in keyboard testing.

## Checks

- One main landmark and a visible level-one heading per representative route
- Accessible names for visible controls, alternative text for images and unique element IDs
- Live announcement regions on Ask and Journey
- Visible keyboard focus through representative tab sequences
- The 44 × 44px AstroSaathi mobile target baseline, with the approved inline-text exception
- WCAG AA contrast for the shared background, card, muted and primary semantic pairs in Dawn and Midnight
- Effectively static animation and transitions under reduced motion

## Decision

Use focused browser-native checks with the existing Playwright and synthetic Supabase fixtures. No additional accessibility dependency is needed for this action. This is a product-focused regression audit, not a claim of exhaustive assistive-technology certification.

## Result

All four automated audit groups passed. The audit found and corrected two shared switch issues: settings and WhatsApp switches now expose accessible names, and keyboard focus rings are applied to the actual focusable switch buttons. No critical accessibility failures remain in the audited surface.
