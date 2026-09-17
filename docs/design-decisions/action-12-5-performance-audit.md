# Action 12.5 — Performance audit

## Scope

Measure the redesigned application against the approved loading, bundle, motion and image budgets without changing data contracts, calculations or business logic.

Representative mobile runtime routes: `/today`, `/home`, `/chat`, `/journey`, `/people` and `/settings` using synthetic Supabase fixtures.

## Budgets and checks

- DOM content loaded within 5 seconds on the warmed local development server
- Cumulative layout shift at or below 0.10
- At most one continuously animated visible layer
- No filter or backdrop-filter animation
- No eager offscreen raster images
- No WebGL baseline dependency or use
- Production build succeeds and preserves route splitting
- Critical local font payload remains below 120KB compressed per active path

## Production measurements

- Shared CSS: 29.14KB gzip
- Largest route chunks: Markets 107.81KB gzip, Ask 66.30KB gzip and My Cosmos 25.40KB gzip
- Shared localization chunk: 107.06KB gzip
- Largest shared entry chunk: 134.74KB gzip
- Local font payload: 0KB; fonts remain externally hosted and use browser/font-cache loading
- Total lazy client JavaScript across every route and shared chunk: approximately 655KB gzip; this is not a single-route initial payload

## Decision

Use the production build report plus one focused browser-native Playwright guardrail instead of adding Lighthouse or another performance dependency. Warm Vite's on-demand development transforms before recording runtime metrics because transform compilation is not part of deployed runtime behavior.

## Result

The production build and runtime audit passed. No WebGL dependency, unbounded filter animation or eager offscreen image was found. The audit replaced the 512px, 69KB brand icon request with the existing 192px, 20KB asset, saving approximately 49KB per uncached logo request without changing its rendered size.

The build continues to report the existing Vite PWA warning that its `dist` precache glob does not match the Vercel output directory. This does not block the agreed redesign performance budgets, but it must be reviewed in Action 12.7 before deployment approval.
