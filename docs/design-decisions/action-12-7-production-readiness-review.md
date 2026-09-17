# Action 12.7 — Production readiness review

## Scope

Review the completed redesign for release risk across errors, observability, rollback and Lovable/Vercel deployment behavior. This action does not commit, push, deploy or alter Supabase.

## Release evidence

- Production Vercel/Nitro build succeeds and emits a valid `.vercel/output` with immutable hashed assets and an SSR fallback.
- Action 12.6 verified contracts, fixtures, TypeScript, calculation parity and the complete desktop integration suite.
- The redesign contains no changed Supabase function, migration or schema file.
- Only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are required by the frontend. Their presence in the Vercel project must be confirmed before release; Supabase Edge Function secrets remain a separate deployment concern.
- No added secret-like values were found in the redesign diff.

## Error handling and observability

- TanStack's root error boundary provides localized retry and home recovery.
- Catastrophic SSR failures are normalized to a stable HTML error page and logged to Vercel's server logs.
- Browser boundary failures report through Lovable's installed error event bridge when it is available.
- Feature-level query and voice failures retain visible retry or toast feedback.
- There is no independent alerting service, release marker or error-rate dashboard in this repository. Vercel logs and the Lovable bridge are therefore the current operational baseline; post-release checks must be performed manually.

## PWA and caching

The build still warns that the PWA plugin's `dist` precache glob matches no Vercel output. This is expected in the current configuration: the generated worker is absent from `.vercel/output`, and `PwaRegister` actively unregisters old workers to avoid stale-cache risk. The web manifest remains available, but offline/service-worker behavior is intentionally disabled. This warning is non-blocking and should be removed only as a separate PWA decision.

TanStack Query persistence is tied to `APP_VERSION`, and sign-out clears chart-gateway cache data. The redesign does not change query response contracts, so a cache-buster change is not required for this release.

## Dependency review

`npm audit --omit=dev --audit-level=high` reports three high-severity transitive advisories with non-breaking fixes available:

- `fast-uri` 3.1.4 through AJV/Workbox
- `js-yaml` 4.3.0 through build tooling
- `nanoid` 3.3.16 through PostCSS/Vite

These paths are build/tooling dependencies rather than AstroSaathi business logic, but the lockfile should be refreshed to the patched versions and the build, typecheck and targeted smoke suite rerun before production approval. The audit fix was inspected with `--dry-run`; it was not applied because dependency installation requires a separate explicit approval.

## Commit and deployment impact

- The current branch is `main`; pushing a commit triggers Vercel auto-deployment and synchronizes the commit back to Lovable.
- A pushed redesign commit will replace the current production frontend UI. It is not a test-only overlay.
- Supabase Edge Functions are deployed separately and will not change from this frontend push.
- The worktree contains the complete redesign plus audit documents and tests. Stage intended files deliberately; exclude `supabase/.temp/cli-latest` and all local build/test output.
- Do not amend, rebase, squash or force-push published commits.

## Rollback plan

1. Create one normal redesign release commit after the dependency audit is clean.
2. Record the commit SHA and successful Vercel deployment URL.
3. Smoke-test landing, authentication, Today, My Cosmos, Ask, Journey, Connections and Settings in production.
4. If the frontend release regresses, use Vercel's prior deployment for immediate traffic rollback, then create a normal `git revert` commit and push it so GitHub, Lovable and Vercel converge without rewriting history.
5. Do not redeploy or roll back Supabase functions for a frontend-only redesign issue.

## Readiness decision

**Conditional no-go for production deployment.** The redesign itself has passed its functional and visual readiness gates, but production approval remains blocked until:

1. the three high-severity transitive dependency advisories are patched and reverified;
2. Vercel's two frontend environment variables are confirmed;
3. the intended redesign files are staged without the Supabase CLI temp artifact; and
4. the user explicitly approves the commit/push/deployment step.

No deployment-related action has been performed.
