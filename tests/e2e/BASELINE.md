# Action 2.3 — Pre-redesign smoke baseline

**Recorded:** 8 September 2026  
**Result:** PASS — 24/24 tests  
**Duration:** 2.2 minutes  
**Browser:** Installed Google Chrome via Playwright's `chrome` channel  
**Server:** Local Vite development server at `127.0.0.1:4173`

## Matrix

Each journey passed once with Playwright's Pixel 7 profile and once with its Desktop Chrome profile:

1. Landing, language and sign-in entry points render.
2. A protected route returns an unauthenticated visitor to sign-in.
3. A consent-pending account cannot bypass consent.
4. A birth-pending account cannot bypass birth details.
5. The authenticated chart screen renders.
6. The authenticated chat screen renders.
7. The authenticated Today screen renders.
8. The authenticated People screen renders.
9. The authenticated compatibility screen renders.
10. The authenticated Journey/Life Timeline screen renders.
11. The authenticated Settings screen renders.
12. People opens a synthetic saved partner and exposes the compatibility action.

## Isolation and safety

- Authentication, profile and person records are visibly synthetic.
- Supabase requests are intercepted at the browser boundary and receive deterministic local responses.
- No production or development Supabase account is used.
- No database row is created, updated or deleted.
- No live Edge Function or external astrology provider is invoked.
- The smoke suite does not replace calculation parity, frontend contract or fixture validation.

## Baseline limitations

This baseline proves critical route composition, auth/onboarding gates, primary screen rendering and the People-to-compatibility navigation seam. It deliberately does not exercise real login delivery, onboarding submission, database writes, chat streaming, provider availability or astrology calculation accuracy. Those behaviors require separately authorized integration environments and remain protected by their existing contracts and parity checks.

## Command

```sh
npm run test:e2e:smoke
```
