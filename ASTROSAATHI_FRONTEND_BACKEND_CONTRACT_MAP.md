# AstroSaathi — Frontend ↔ Backend Contract Map

**Action:** 0.4 — Map frontend-to-backend contracts  
**Status:** Discovery documentation only  
**Captured:** 8 September 2026  
**Linked Supabase project:** `ehgcbgnzwsxqosfbnlcx`  
**Companion plan:** [ASTROSAATHI_3_REDESIGN_PLAN.md](./ASTROSAATHI_3_REDESIGN_PLAN.md)

---

## 1. Purpose and boundary

This document records how the current AstroSaathi frontend reaches authentication, Supabase tables, Supabase Edge Functions, client caches and local storage. It is the preservation reference for the redesign.

This action did **not**:

- Change frontend or backend source.
- Change database schema, rows, RLS or grants.
- Deploy, delete or update an Edge Function.
- Apply, repair, pull or push a migration.
- Change secrets or local credentials.
- Attempt to correct any issue discovered below.

The map reflects repository source plus read-only Supabase CLI metadata. An exact remote column/RLS dump could not be captured because the CLI schema-dump path requires Docker, which is not running. The public PostgREST schema endpoint also returned HTTP 401 with the current local publishable credential. Therefore, remote table columns and RLS are described from code and comments until a later, separately approved schema-synchronization action verifies them.

---

## 2. Runtime architecture

```text
React routes/components
        │
        ├── Supabase Auth
        │     └── session/JWT → route guards and owner-scoped calls
        │
        ├── TanStack Query hooks
        │     ├── direct PostgREST table reads/writes
        │     └── Supabase Edge Function invocation
        │
        ├── direct chat SSE fetch
        │     └── authenticated POST /functions/v1/astrologer-chat
        │
        └── local browser state
              ├── persisted query cache
              ├── theme/tone/answer preferences
              ├── voice preferences
              └── current auth storage managed by Supabase
```

The dominant architectural rule is that the browser uses the publishable key plus the signed-in user JWT. Owner-scoped table operations rely on RLS. Elevated/server operations occur inside Edge Functions.

---

## 3. Global contracts

### 3.1 Authentication and identity

Source: `src/lib/auth.ts`, `src/lib/require-auth.tsx`, `src/routes/auth.tsx`, `src/routes/auth.callback.tsx`.

- Supabase Auth owns the session.
- Supported flows: email/password sign-in, sign-up, password reset and Google OAuth.
- `getSession()` exposes a simplified `{id, email, name}` view of the current Supabase session.
- `refreshAuthSession()` calls `supabase.auth.getSession()`.
- An auth-state listener keeps React state synchronized with Supabase.
- Signed-out users are redirected to `/auth` when a protected route requires authentication.
- Onboarding-aware routes also check `profiles.onboarding_state` and redirect to consent, birth details or home.
- The auth callback supports PKCE code exchange and auth-state events before resolving onboarding state.

Preservation invariants:

- Do not replace Supabase Auth session ownership with visual/local state.
- Do not navigate to a protected destination until the session and onboarding state are resolved.
- Preserve OAuth callback, email confirmation and password-recovery handling.
- Do not expose session tokens to UI, logs or URLs beyond Supabase’s intended callback behavior.

### 3.2 User ownership

- Browser writes generally obtain `auth.getUser()` and include or filter by `user_id`.
- Code comments state that owner RLS protects profiles, birth data, people, memories, life events, journal, proactive preferences and feedback.
- Edge Functions that operate for a user validate the caller JWT where configured.
- Remote CLI metadata shows a mix of JWT-verified user functions and non-JWT background/cron functions; see section 9.

### 3.3 Query cache

Source: `src/lib/queries.ts`, `src/routes/__root.tsx`.

- TanStack Query cache is persisted in browser local storage under `astrosaathi-qc-v1`.
- General chart cache stale time: 24 hours.
- General garbage-collection retention: 7 days.
- Standard retry: 3 attempts with exponential delay capped at 8 seconds.
- Standard focus and reconnect refetch are disabled.
- Today/transit/market/Panchang data: 15-minute stale time and focus refetch enabled.
- People, life events, journal and nudges: 1-minute stale time.
- WhatsApp and proactive settings: 5-minute stale time.
- Birth-data save performs a soft invalidation through the `chart-gateway` root namespace.
- Sign-out and the current settings “delete account” action clear the same root namespace.

Preservation hazards:

- Some report hooks use keys beginning with `report`, not `chart-gateway`; the current birth-save invalidation does not visibly cover those namespaces.
- The comment describing the chart stale window as “short” conflicts with the actual 24-hour value.
- Cache keys must continue to include user ID and relevant chart/person/language parameters.
- Persisted data from one user must never paint for another user.

### 3.4 Error behavior

The code uses three different error styles:

1. Structured result values such as `{errorCode}` for chart/report calls.
2. Thrown errors handled by TanStack Query.
3. Fail-soft empty/default values for optional or secondary features.

Known chart error codes surfaced by the UI include:

- `not_authenticated`
- `birth_profile_incomplete`
- `place_not_resolved`
- `missing_coordinates`
- `provider_error`

Preservation invariants:

- Loading, empty, unavailable and a valid negative result must remain distinct.
- A backend failure must not be presented as “dosha not present,” “not in Sade Sati,” “no nudges,” or “zero market signal.”
- Retry behavior must not duplicate writes or chat turns.

---

## 4. Route-by-route contract matrix

### Public, authentication and onboarding

| Route | Reads | Writes/invocations | Current critical behavior |
|---|---|---|---|
| `/` | Supabase auth session; `profiles.onboarding_state` when signed in | None | Redirects authenticated users to their onboarding/home state; otherwise renders landing |
| `/language` | Local current locale | Local language; may synchronize `profiles.locale` through i18n behavior | Continues to `/auth`; supports `en`, `hi`, `mr` |
| `/auth` | Auth session; onboarding state | `auth.signInWithPassword`, `auth.signUp`, `auth.resetPasswordForEmail`, `auth.signInWithOAuth` | Maps Supabase errors to UI keys; routes confirmed users by onboarding state |
| `/auth/callback` | Callback URL, auth session/events, onboarding state | `auth.exchangeCodeForSession` when code exists | Handles PKCE/implicit flows, password recovery and delayed session readiness |
| `/reset-password` | Auth session | `auth.updateUser({password})` | Requires recovery session, then routes to home |
| `/onboarding/consent` | Authenticated user | Inserts `consent_receipts`; updates `profiles.onboarding_state`, `memory_enabled`, `locale` | Age, terms and privacy required; long-term memory optional; policy version `2026-01` |
| `/onboarding/birth` | `birth_profiles` | Upserts `birth_profiles`; updates `profiles`; conditionally invokes `prime-charts`; invalidates chart cache | Only primes charts when chart-relevant birth data actually changed; priming is fire-and-forget and must not block navigation |
| `/terms` | Static localized content | None | Legal presentation only |
| `/privacy` | Static localized content | None | Legal presentation only |

### My chart and astrological analysis

| Route/surface | Reads | Writes/invocations | Current critical behavior |
|---|---|---|---|
| `/home` shell | Auth/onboarding; birth profile; unread nudges | None | Primary chart destination and gateway to Life, Journal and Nudges |
| Kundli/chart tab | `chart-gateway` chart and planet resources | `chart-gateway` with chart type/style or `resource: planets` | Supports North/South/East display and all declared vargas; chart SVG and normalized planet data must stay aligned |
| Predictions/details tab | Dasha and chart-derived sections | `chart-gateway` reports/resources | Uses current chart context; do not detach prediction labels from evidence |
| Doshas tab | Mangal/Kaal Sarp reports; Sade Sati timeline | `chart-gateway`; `sade-sati-timeline` | Valid absence, uncertainty and provider failure must remain distinguishable |
| Remedies tab | Planet states, dosha states and dasha results | No remote remedy mutation | Remedy ranking is local deterministic selection over current chart outputs |
| Ashtakavarga tab | Sarvashtakavarga and per-planet Bhinnashtakavarga | `chart-gateway` report calls | House scores, contributors and bindus must not be reordered or recomputed by presentation code |
| Numerology tab | Numerology gateway resource | `chart-gateway` with `resource: numerology` | Current year is part of the query key |
| Lo Shu tab | Lo Shu gateway resource | `chart-gateway` with `resource: lo_shu` | Grid, missing/repeated digits, Kua and remedies come from the returned contract |

### Today and markets

| Route/surface | Reads | Writes/invocations | Current critical behavior |
|---|---|---|---|
| `/today` | Daily horoscope, current transits, Panchang inputs, mantra, market/barometer summaries | `daily-horoscope` | Aggregates independently loading modules; one failure should not collapse every module |
| `/today/horoscope` | `daily-horoscopes` response through function | `daily-horoscope` with `{lang}` | Language participates in cache identity; returned reasons are distinct from prose |
| `/today/panchang` | `transit_planets`, `transit_moon_hourly`, `birth_profiles` | None | Computes Panchang/day times locally from current Sun/Moon plus user location/timezone |
| Today transit band | `profiles.timezone`, `transit_moon_hourly`, `transit_planets` | Contextual navigation to Ask | Selects Moon slot by absolute timestamp, not integer local hour |
| Daily mantra | Local date and static mantra catalog | None | Deterministic daily index; no remote persistence |
| `/today/markets` outlook | `market_predictions` | None from client | Uses latest available trade date and approximately 31 days for accuracy summary |
| Composite barometer | `financial_barometer_daily` | None from client | Uses latest date; keeps source coverage separate from directional probability |
| Bradley | `bradley_siderograph_daily` | None from client | Reads approximately 30 days past to 60 days future |
| SBC | `sbc_vedha_daily` | None from client | Missing date is different from a computed date with zero vedhas |

### Ask/chat and voice

| Route/surface | Reads | Writes/invocations | Current critical behavior |
|---|---|---|---|
| `/chat` conversations | `chat_conversations` | Delete conversation; update title | Sorted by `updated_at`; current active conversation can be resumed |
| `/chat` messages | `chat_messages`, feedback | Edge Function persists turns; frontend hydrates last assistant metadata | Only user/assistant roles display; provenance is read from message metadata |
| Chat streaming | Supabase session/token | Raw authenticated SSE POST to `astrologer-chat` | Two attempts only before content appears; prevents duplicated/rewound visible text |
| Chat buffered fallback | Current conversation/subject | `astrologer-chat` invoke | Sends message, optional conversation ID and optional related-person subject; empty reply is an error |
| Chat feedback | `user_prediction_feedback` | Delete/insert rating, outcome or remedy feedback | Rating toggle uses delete-then-insert due partial unique index behavior |
| Voice input | Local voice settings | `speech-to-text` with encoded audio contract | Client comments document JSON/base64 transport due multipart invocation reliability |
| Read aloud | Local voice settings | `text-to-speech` | Markdown is stripped before speech; speaker and pace are local preferences |

Chat request contract:

```ts
{
  message: string;
  conversation_id?: string;
  subject_related_chart_id?: string;
  stream?: boolean;
}
```

Buffered response contract used by the frontend:

```ts
{
  reply?: string;
  conversation_id?: string;
}
```

SSE behavior additionally delivers metadata containing the conversation ID and incremental text deltas.

### Journey: life events and journal

| Route | Reads | Writes/invocations | Current critical behavior |
|---|---|---|---|
| `/life` | `user_life_events`; dasha for timeline | Insert/update/delete events; `life-event-context` | New events persist first, then astrology stamping is best-effort; stamping failure must not lose the event |
| `/journal` | `user_reflection_journal` | Insert/update/delete entries; `journal-context` | Entry persists first; date changes trigger restamping, content/mood/tag-only edits do not |

Life-event stamping request:

```ts
{ event_id: string; force?: true }
```

Journal stamping request:

```ts
{ entry_id: string; force?: true }
```

Shared stamped context includes:

- Engine/version/computed time.
- Whether birth time is known.
- Natal Moon.
- Maha, Antar and Pratyantar lords.
- Saturn and Jupiter transits.
- Sade Sati state and phase.

### Connections and compatibility

| Route | Reads | Writes/invocations | Current critical behavior |
|---|---|---|---|
| `/people` | `related_charts` | None | Ordered by creation time; database limit is 10 people per user |
| `/people/new` | Auth user | Inserts `related_charts` | Surfaces the trigger error `related_charts_limit_reached`; preserves known/unknown birth time |
| `/people/:id` | `related_charts`; person chart bundle | `person-charts({related_chart_id})` | Person ID must remain part of query key and every derived view |
| `/people/:id/edit` | Selected `related_charts` row | Updates/deletes row; invalidates `related-charts` cache | Must never mutate the signed-in user’s own birth profile |
| `/people/:id/compatibility` | Compatibility bundle and person charts | `compatibility({related_chart_id})` | Supports only compatible relationship types; Guna, Mangal and synastry belong to the correct pair |

### Nudges and settings

| Route | Reads | Writes/invocations | Current critical behavior |
|---|---|---|---|
| `/nudges` | Sent, unexpired `user_proactive_nudges` | Status `sent → acted` or `sent → dismissed` | Both writes guard on current `status=sent` to make double actions safe |
| `/settings` | Profile, birth data, planets, preferences, WhatsApp preferences | Preferences/profile updates; sign-out; local “delete account” behavior | Theme/tone/answer length sync locally and to `profiles.preferences` |
| `/settings/memory` | `profiles`, `user_topic_memory`, `user_emotional_state`, legacy `user_memory` | Retention updates, deletes, reset preferences, export | Memory is user-scoped; legacy operations fail soft; delete-all has two confirmations |
| `/settings/proactive` | `user_proactive_settings` | Upsert settings | UI is optimistic and rolls back on save error |
| `/settings/voice` | Local storage | Local voice preference updates | Input enabled, STT language, speaker and pace are currently local-only |

Important existing behavior: the settings action labelled as account deletion currently clears local cache/preferences and signs out; it does **not** delete the Supabase Auth user or remote user data. This must not be silently represented as completed remote deletion during redesign.

---

## 5. Browser-invoked Edge Function contracts

| Function | Auth | Request from frontend | Frontend expectation |
|---|---|---|---|
| `chart-gateway` | User JWT | `{chart_type, chart_style}` | SVG chart envelope or structured error |
| `chart-gateway` | User JWT | `{resource:"planets"}` | Planet-position payload normalized by `mapPlanets` |
| `chart-gateway` | User JWT | `{resource:"report", report_type:"vimshottari_dasha"}` | Nested dasha periods and balance |
| `chart-gateway` | User JWT | `{resource:"report", report_type:"mangal_dosha" | "kaal_sarp_dosha"}` | Nested report data or error code |
| `chart-gateway` | User JWT | `{resource:"report", report_type:"sarvashtakavarga"}` | Sarvashtakavarga prastara houses |
| `chart-gateway` | User JWT | `{resource:"report", report_type:"ashtakavarga", provider_params:{planet}}` | Bhinnashtakavarga houses for planet |
| `chart-gateway` | User JWT | `{resource:"numerology"}` | Numerology payload |
| `chart-gateway` | User JWT | `{resource:"lo_shu"}` | Lo Shu payload |
| `prime-charts` | User JWT | `{}` | Fire-and-forget generation after changed birth data |
| `daily-horoscope` | User JWT | `{lang}` | Daily content plus structured reasons |
| `sade-sati-timeline` | User JWT | `{}` | `{ok, moonSignIndex, moon_time_uncertain, inSadeSati, episode}` |
| `person-charts` | User JWT | `{related_chart_id}` | Person chart bundle |
| `compatibility` | User JWT | `{related_chart_id}` | Compatibility bundle with Guna/Mangal/synastry |
| `life-event-context` | User JWT | `{event_id, force?}` | Updates stored event context |
| `journal-context` | User JWT | `{entry_id, force?}` | Updates stored journal context |
| `astrologer-chat` | User JWT | Message/conversation/subject/stream contract | SSE stream or buffered reply |
| `speech-to-text` | User JWT | Encoded audio plus language configuration | Transcript/error |
| `text-to-speech` | User JWT | Text, speaker and pace | Audio payload/error |

---

## 6. Direct browser table contracts

The following tables are accessed directly by browser code and therefore depend on correct grants and RLS:

| Table | Browser operations | Primary owner/context |
|---|---|---|
| `profiles` | Select/update | Signed-in user |
| `birth_profiles` | Select/upsert | Signed-in user |
| `consent_receipts` | Insert | Signed-in user |
| `transit_moon_hourly` | Select | Authenticated/global |
| `transit_planets` | Select | Authenticated/global |
| `market_predictions` | Select | Authenticated/global |
| `financial_barometer_daily` | Select | Authenticated/global |
| `bradley_siderograph_daily` | Select | Authenticated/global |
| `sbc_vedha_daily` | Select | Authenticated/global |
| `whatsapp_prefs` | Select/upsert | Signed-in user |
| `related_charts` | Select/insert/update/delete | Signed-in user |
| `user_life_events` | Select/insert/update/delete | Signed-in user |
| `user_reflection_journal` | Select/insert/update/delete | Signed-in user |
| `user_proactive_nudges` | Select/update | Signed-in user; server creates rows |
| `user_proactive_settings` | Select/upsert | Signed-in user |
| `chat_conversations` | Select/update/delete | Signed-in user; server creates/persists |
| `chat_messages` | Select | Signed-in user; chat function persists |
| `user_prediction_feedback` | Select/insert/delete | Signed-in user |
| `user_topic_memory` | Select/update/delete | Signed-in user; server creates/updates |
| `user_emotional_state` | Select/delete | Signed-in user; server creates/updates |
| `user_memory` | Select/update | Legacy; may fail soft if owner RLS unavailable |

Server-side code additionally references:

- `chart_artifacts`
- `chart_facts`
- `related_chart_artifacts`
- `astrology_provider_runs`
- `panchanga_daily`
- `market_ohlc`
- `barometer_config`
- `sbc_asset_charts`
- `sbc_config`
- `knowledge_sources`
- `knowledge_corpus`

---

## 7. Local deterministic logic that presentation must not alter

Not every result comes directly from a remote endpoint. The redesign must preserve these local computations and mappings:

- Planet response normalization and label/key mapping.
- Sign and nakshatra indexing.
- Divisional chart lookup/derived tables.
- North Indian SVG parsing used by current chart tables.
- House derivation from ascendant and sign.
- Planet dignity flags.
- Panchang tithi, yoga, karana, vara and day-time calculation.
- Transit-to-house mapping.
- Daily mantra selection.
- Remedy ranking from dosha, dignity and dasha conditions.
- Market presentation calculations such as displayed historical accuracy.
- Bradley window selection.
- SBC heatmap domain and missing-date semantics.
- Life-event and journal date grouping.
- Proactive-nudge priority sorting.
- Voice Markdown stripping and locale-to-BCP47 mapping.

Presentation components may visualize these values differently, but must not duplicate or reimplement their domain formulas inside UI components.

---

## 8. Deployed Edge Function inventory

Read-only CLI metadata reports 24 active remote functions:

| Remote function | JWT verification | Local matching folder |
|---|---:|---:|
| `chart-gateway` | Yes | Yes |
| `astrologer-chat` | Yes | Yes |
| `prime-charts` | Yes | Yes |
| `transit-compute` | No | Yes |
| `transit-planets-refresh` | No | Yes |
| `market-predict` | No | Yes |
| `daily-horoscope` | Yes | Yes |
| `build-guidance` | No | Yes |
| `whatsapp-send` | No | Yes |
| `panchanga-compute` | Yes | Yes |
| `market-ohlc-refresh` | Yes | Yes |
| `bradley-compute` | Yes | Yes |
| `sbc-core` | Yes | Yes |
| `barometer-compute` | Yes | Yes |
| `sade-sati-timeline` | Yes | Yes |
| `person-charts` | Yes | Yes |
| `compatibility` | Yes | Yes |
| `life-event-context` | Yes | Yes |
| `proactive-nudges` | No | Yes |
| `proactive-dispatch` | No | No matching name |
| `knowledge-ingest` | No | Yes |
| `speech-to-text` | Yes | Yes |
| `text-to-speech` | Yes | Yes |
| `journal-context` | Yes | **No** |

Local folder `supabase/functions/source 3` has proactive-dispatch-like table behavior, but the folder name does not match the deployed function. Treating it as the authoritative source for `proactive-dispatch` is only an inference and must be verified before any synchronization.

---

## 9. Remote/local synchronization findings

### Confirmed

- The CLI is authenticated and can read project/function metadata.
- The checkout is linked to project `ehgcbgnzwsxqosfbnlcx`.
- Remote function inventory is accessible read-only.
- Remote migration-history output contains no applied migration versions.
- Local repository contains `20260801000000_daily_horoscopes_add_reasons.sql`, shown as local-only by `supabase migration list --linked`.

### Drift and risk

1. **Remote-only source:** `journal-context` is deployed but has no local function directory.
2. **Naming/source ambiguity:** remote `proactive-dispatch` has no same-name folder; local `source 3` may be its source.
3. **Migration-history gap:** the single local migration is not recorded remotely. It may have been applied manually, applied without history, or may genuinely be absent; no conclusion is safe without schema inspection.
4. **Local application API credentials:** both the service-role parity request and public PostgREST schema request returned HTTP 401. CLI management/database authentication is working, but application `.env` API credentials appear stale, disabled or mismatched.
5. **Remote source parity:** function names and versions are known, but remote function source was not downloaded or compared.
6. **Schema snapshot blocker:** schema-only dump requires Docker, which was not running.
7. **Generated CLI artifact:** `supabase/.temp/cli-latest` is currently untracked. It was preserved and not deleted.

These are baseline findings. No repair is authorized by Action 0.4.

---

## 10. High-risk behavior invariants for redesign

### Birth details

- Unknown time stores a null time and `birth_time_known=false`.
- Gender accepts only `male`, `female` or null at the database boundary.
- Saving unchanged chart-relevant data must not trigger chart regeneration.
- Changed data primes charts asynchronously and invalidates cached chart views.

### Charts and reports

- Varga and chart-style parameters must stay in the query key.
- Sign/house indexes must remain consistently zero- or one-based according to the existing mapper.
- Provider SVG must not be rewritten for cosmetic styling.
- Nested report envelopes must remain correctly unwrapped.
- Missing report data must not become a valid negative result.

### Today

- Current Moon selection uses absolute timestamps.
- User timezone/location continues to drive localized day calculations.
- Global market rows are not user-personalized natal predictions.
- “Not computed” remains separate from zero/neutral.

### Chat

- Current conversation and selected related-person subject stay attached to the turn.
- A retry before first text may reconnect; a retry after visible text must not duplicate it.
- Aborted partial replies remain internally consistent.
- Provenance and persisted database message IDs must be retained for feedback.

### Journey

- User content saves even when astrology-context stamping fails.
- Restamping only changes context, not the user’s event/journal content.
- Journal/life context is private and must only enter chat after explicit user action.

### Connections

- Related-person ID must remain in every chart and compatibility cache key.
- Compatibility must never mix two saved people or use the owner’s chart as the related chart accidentally.
- The 10-person limit and its database error remain visible.

### Memory and nudges

- Memory remains opt-in and user-controllable.
- `retention: never` and expired memories remain visible in settings but excluded from model context.
- Deleting memories must retain two-step confirmation for bulk deletion.
- Nudge state transitions remain conditional on current `sent` state.

---

## 11. Pre-existing issues to resolve only through separate approval

These findings affect confidence but must not be silently fixed during visual work:

1. Determine why the current frontend publishable key receives HTTP 401.
2. Restore or reconstruct local source for remote `journal-context`.
3. Rename/verify `source 3` against remote `proactive-dispatch`.
4. Reconcile local and remote migration history before any schema change.
5. Verify RLS/grants for every directly accessed browser table.
6. Decide whether non-JWT remote functions have adequate internal authorization for their intended cron/admin use.
7. Expand chart invalidation to all report caches if parity testing confirms stale results after birth edits.
8. Separate “unavailable” from valid negative/default states in fail-soft hooks.
9. Clarify the account-deletion promise because current behavior is local sign-out, not remote deletion.
10. Standardize Edge Function error envelopes to reduce presentation ambiguity.

---

## 12. Contract validation matrix for future screen actions

Every implementation action must select the relevant checks below.

| Contract class | Required validation |
|---|---|
| Auth | Signed-out, signed-in, expired session, OAuth callback, recovery and onboarding routing |
| Owner-scoped CRUD | Correct user rows only; unauthorized IDs rejected by RLS |
| Chart/report | Frozen inputs; exact result and label/index parity |
| Cache | Correct user/subject/date/style key; invalidation after relevant mutation |
| Partial backend failure | Independent modules survive; no fabricated empty/negative interpretation |
| Streaming chat | First byte, reconnect, abort, partial response, buffered fallback and persistence |
| Context stamping | Parent row survives failure; manual restamp works; content unchanged |
| Destructive behavior | Explicit confirmation; exact target; recoverability accurately stated |
| Localization | English/Hindi/Marathi labels preserve domain meaning and do not overflow |
| Accessibility | Equivalent nonvisual representation for charts, heatmaps, motion and status |

---

## 13. Action 0.4 decision log

| Decision | Reason |
|---|---|
| Treat repository source as the current UI contract reference | Exact remote schema/RLS could not be dumped safely in this action |
| Record remote CLI metadata without pulling or deploying | Establishes drift without changing either side |
| Keep remote function mismatches unresolved | Source restoration/renaming is a separate state-changing action |
| Preserve fail-soft behavior for now but flag ambiguity | Visual redesign must not accidentally claim absence when data is unavailable |
| Require contract-first validation before each screen redesign | Prevents visual work from remapping or invalidating astrological/business data |

---

## 14. Current checkpoint

Action 0.4 produces this map and no implementation changes.

The next planned action is **Action 0.5 — Capture the current visual and interaction baseline**. It must not begin until this contract map and its reported risks are reviewed and explicitly approved.

