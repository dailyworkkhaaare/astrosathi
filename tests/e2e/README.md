# Critical end-to-end smoke journeys

This suite checks that AstroSaathi's critical routes still compose correctly in a real Chrome browser before visual redesign work begins.

It covers public/auth entry, protected-route behavior, both onboarding gates, chart, chat, Today, people, compatibility, Journey and settings on mobile and desktop viewports.

The authenticated journeys use a visibly synthetic local session and intercept the project's Supabase origin with deterministic, non-writing responses. They do not use production credentials, create users, write database rows, invoke live Edge Functions or assert astrology calculations. Calculation correctness remains covered by the parity scripts and frontend contracts.

Run:

```sh
npm run test:e2e:smoke
```

Failure artifacts are written to ignored `test-results/`; the HTML report directory is also ignored.

The accepted pre-redesign result is recorded in [BASELINE.md](./BASELINE.md).
