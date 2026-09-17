# AstroSaathi — Current UI and Interaction Baseline

**Action:** 0.5 — Capture current visual and interaction baseline  
**Status:** Discovery documentation only  
**Captured:** 8 September 2026  
**Preview audited:** local Vite application at `127.0.0.1:8080`  
**Companion documents:** [ASTROSAATHI_3_REDESIGN_PLAN.md](./ASTROSAATHI_3_REDESIGN_PLAN.md) and [ASTROSAATHI_FRONTEND_BACKEND_CONTRACT_MAP.md](./ASTROSAATHI_FRONTEND_BACKEND_CONTRACT_MAP.md)

---

## 1. Purpose and boundary

This document freezes the current AstroSaathi experience before redesign. It records what exists, how the screens are structured, which interaction and data states are present, and which UX qualities must be preserved or deliberately replaced.

This action did **not**:

- Change React, CSS, routing, Supabase, Edge Functions or business logic.
- Create an application user, insert fixture data or mutate production data.
- Change authentication, RLS, caching or redirects.
- Implement the proposed Cosmic Atelier direction.
- Treat source-inferred protected states as visually verified populated states.

The only created artifacts are this audit and public-screen screenshots in `docs/ui-baseline/screenshots/`.

---

## 2. Evidence levels

Every baseline statement should be read using one of these evidence levels:

| Level | Meaning |
|---|---|
| **V1 — visually verified** | Observed in the running local application. |
| **I1 — interactively verified** | Triggered in the running application and checked through the rendered accessibility tree. |
| **S1 — source verified** | Confirmed in route/component source but not populated with a signed-in end-user session. |
| **U1 — unverified** | Requires a safe test user, controlled fixture or additional environment setup. |

The Supabase CLI login authorizes project administration. It does not create an end-user browser session. Protected screens were therefore not populated by inventing credentials or creating production records.

---

## 3. Capture manifest

### 3.1 Stored public-screen captures

| Capture | Size | Evidence | File |
|---|---:|---|---|
| Landing, light | 1440 × 1100 | V1 | [landing-desktop.png](./docs/ui-baseline/screenshots/landing-desktop.png) |
| Landing, narrow raw capture | 390 × 844 | V1 with capture limitation | [landing-mobile.png](./docs/ui-baseline/screenshots/landing-mobile.png) |
| Authentication, sign-in, light | 1440 × 1100 | V1 | [auth-desktop.png](./docs/ui-baseline/screenshots/auth-desktop.png) |
| Authentication, narrow raw capture | 390 × 844 | V1 with capture limitation | [auth-mobile.png](./docs/ui-baseline/screenshots/auth-mobile.png) |
| Language selection, light | 1440 × 1100 | V1 | [language-desktop.png](./docs/ui-baseline/screenshots/language-desktop.png) |
| Language selection, narrow raw capture | 390 × 844 | V1 with capture limitation | [language-mobile.png](./docs/ui-baseline/screenshots/language-mobile.png) |
| Privacy | 1440 × 1100 | V1 | [privacy-desktop.png](./docs/ui-baseline/screenshots/privacy-desktop.png) |
| Terms | 1440 × 1100 | V1 | [terms-desktop.png](./docs/ui-baseline/screenshots/terms-desktop.png) |

### 3.2 Capture limitation

Headless Chrome on the audit host enforces a content-width floor larger than the requested 390 px window. The raw narrow captures consequently clip the right edge. They are useful evidence for vertical ordering, stacking and density, but **must not** be used as proof of a real mobile overflow defect. Mobile behavior below is also source-verified from the responsive classes, safe-area rules and mobile navigation implementation. A genuine device/emulated-device capture remains part of later visual QA.

### 3.3 Interactively inspected states not stored as project screenshots

- Landing page in dark mode.
- Authentication sign-in mode.
- Authentication sign-up mode.
- Empty-submit validation for sign-up.
- Forgot-password mode.
- Protected `/home` redirect behavior while signed out.

No screenshot containing authenticated customer information was stored.

---

## 4. Current visual language

### 4.1 Brand palette and material

**V1 + S1**

- Light mode uses warm parchment backgrounds, near-white cards, deep indigo text and restrained gold accents.
- Dark mode uses a deep celestial indigo surface, warm gold primary actions and lavender-white text.
- The landing and authentication experiences use a dark radial night gradient with a generated starfield.
- Product interiors rely primarily on solid cards, thin borders and soft shadows; the celestial atmosphere becomes much less visible after entry.
- Destructive/caution UI intentionally uses amber rather than red.

Current tokens already provide a credible premium foundation: OKLCH semantic colours, night/on-night colours, gold and violet glows, three elevation families and light/dark variants. The weakness is not the absence of a design system; it is that most product screens reduce that system to repeated neutral bordered cards.

### 4.2 Typography

**V1 + S1**

- Display: Cormorant Garamond, with Noto Serif Devanagari fallback.
- Interface/body: DM Sans, with Noto Sans Devanagari fallback.
- Display headings communicate editorial/premium character effectively.
- Small uppercase labels with wide tracking are repeatedly used for metadata and section labels.
- Hindi and Marathi receive explicit font-family handling rather than relying on accidental fallback.

The serif/sans pairing is distinctive and culturally adaptable. Hierarchy becomes less expressive in dense screens because many card titles, values, labels and controls occupy a narrow range of size and weight.

### 4.3 Shape, elevation and decoration

**S1**

- Shape vocabulary is broad: full pills, circles, `rounded-md`, `rounded-lg`, `rounded-xl`, `rounded-2xl` and `rounded-3xl` all appear frequently.
- Pills are the dominant interactive form: tabs, segmented controls, badges, primary actions and floating chat.
- Soft/elevated/glow shadows exist, but most interior cards use a thin border plus a subtle shadow.
- Decorative Indian/celestial detail is concentrated in the brand mark, starfield, chart frame and lotus-corner motifs.

The result is coherent but conservative. Rounded cards and pills are used so widely that special moments do not always feel special.

### 4.4 Motion

**V1 + S1**

- The system defines micro, standard and spatial timings at approximately 140, 220 and 320 ms.
- Repeated fade-up entrances are used across most page sections.
- Additional patterns include fade-in, pop, chart-unfurl, corner-draw, glow-pulse, tap/bounce feedback and skeleton animation.
- Reduced-motion preferences are respected globally.

Motion is tasteful and technically considerate, but repeated fade-up choreography creates a uniform reveal rhythm rather than screen-specific personality.

---

## 5. Current application shell and navigation

### 5.1 Signed-out shell

**V1**

- Sticky translucent header on ordinary public routes.
- Brand at left; theme and language controls at right.
- Content constrained to a centered `max-w-4xl` canvas.
- Authentication and language routes replace the standard header with bespoke full-height layouts.

### 5.2 Signed-in desktop shell

**S1**

- Fixed 80 px icon-only rail.
- Three primary destinations: Home, Today and Settings.
- Chat is a floating circular action and uses a separate full-screen shell.
- Main content stays within `max-w-4xl`, leaving substantial unused width on large displays.

### 5.3 Signed-in mobile shell

**S1**

- Fixed bottom bar with Home, Today and Settings.
- Chat floats above the bottom bar.
- Safe-area insets are handled explicitly.
- Main content reserves space for the fixed bar.

### 5.4 Navigation-model observation

The current navigation exposes technical containers rather than the user’s broader life journey. Life Timeline, Journal, Nudges and People are reached through home cards or Settings. Chat is globally available but visually detached from the three-item information architecture. This increases discoverability cost for high-value recurring behaviors.

---

## 6. Screen inventory

The repository contains 27 leaf route screens, three layout-only routes and global not-found/error states.

### 6.1 Public, authentication and legal

| Route/state | Current composition | Responsive behavior | Evidence |
|---|---|---|---|
| `/` | Starfield hero, brand promise, primary CTA, sign-in link, three how-it-works cards, trust strip and footer | Hero/card stack on narrow layouts; three-column steps at `sm` | V1/S1 |
| `/language` | Centered logo, language radio cards and bottom/primary Continue CTA | Single-column selection; full-width action | V1/I1 |
| `/auth` — sign in | Desktop celestial split panel plus form card; Google, email/password and recovery | Mobile hero band above form | V1/I1 |
| `/auth` — sign up | Same shell with name, email, password and confirmation | Single-column form | I1 |
| `/auth` — forgot | Simplified email form with back action | Single-column form | I1 |
| `/auth/callback` | OAuth/PKCE progress and routing state | Centered status | S1 |
| `/reset-password` | Compact reset form and success/error handling | Centered narrow form | S1 |
| `/privacy` | Long-form legal page | Narrow readable measure | V1/S1 |
| `/terms` | Long-form legal page | Narrow readable measure | V1/S1 |

Baseline character: public entry feels the most explicitly premium and celestial. Authentication is polished and calm, but its very wide desktop split creates a large low-information region. Legal pages are functional and visually quiet.

### 6.2 Onboarding

| Route | Current composition | Important states | Evidence |
|---|---|---|---|
| `/onboarding/consent` | Branded onboarding shell, privacy explanation, grouped consent concepts, acceptance action | Loading, validation/error, accepted | S1/U1 |
| `/onboarding/birth` | Branded onboarding shell with birth-details form | Create, edit, field validation, place lookup, save/prime progress and error | S1/U1 |

The onboarding shell creates continuity, but consent and birth capture are conventional document/form screens. The emotional payoff—what the user will discover—is not continuously previewed.

### 6.3 My chart/home

| Route/state | Current composition | Important states | Evidence |
|---|---|---|---|
| `/home?tab=charts` | Greeting, title, Life/Nudges/Journal shortcuts, seven-tab scroller, Varga selector, North Indian chart, planets, houses and nakshatra | Profile incomplete, chart loading, table loading, chart error, populated | S1/U1 |
| `tab=details` | Dasha summary and timeline | Loading, unavailable/error, populated periods | S1/U1 |
| `tab=doshas` | Mangal, Kaal Sarp and Sade Sati result sections | Loading, valid absence, detected result, provider failure | S1/U1 |
| `tab=remedies` | Suggested remedies in cards/lists | Loading, empty, populated | S1/U1 |
| `tab=ashtakavarga` | Score/grid-heavy technical analysis | Loading skeleton, error, populated grids | S1/U1 |
| `tab=numerology` | Number cards and interpretation lists | Skeleton, error, populated | S1/U1 |
| `tab=loshu` | Lo Shu grid and interpretation | Loading, error, populated | S1/U1 |

Baseline character: this is the densest analytical area. Seven peer tabs flatten very different levels of importance and expertise. The screen is functionally rich, but the user is asked to interpret multiple technical modules without a clear narrative bridge between “what this means,” “why now” and “what can I ask next.”

### 6.4 Today and markets

| Route | Current composition | Important states | Evidence |
|---|---|---|---|
| `/today` | Date/title, mantra, transit highlight, sky/transit sections, Panchang, horoscope and barometer summaries | Independent loading/error/populated cards | S1/U1 |
| `/today/horoscope` | Full daily horoscope | Loading, error, populated explanation | S1/U1 |
| `/today/panchang` | Full Panchang details | Loading, unavailable, populated | S1/U1 |
| `/today/markets` | Market outlook with barometer, Bradley and SBC modules | Independent loading/error/no-data/populated states | S1/U1 |

Baseline character: Today behaves as a vertical dashboard of separately fetched modules. It is comprehensive, but urgency, personal relevance and confidence are not expressed through one dominant daily story.

### 6.5 Ask/chat and voice

| Route/state | Current composition | Important states | Evidence |
|---|---|---|---|
| `/chat` empty | Full-screen chat shell, history sidebar, contextual greeting, prompt suggestions and composer | New conversation, no history, subject context | S1/U1 |
| `/chat` conversation | Streaming messages, provenance/context, feedback, copy, read-aloud and scroll controls | Connecting, streaming, abort, reconnect/fallback, error, saved conversation | S1/U1 |
| Voice input | Composer recording state and waveform | Permission denied, recording, transcription, failure | S1/U1 |
| Voice output | Read-aloud controls on assistant messages | Loading, playing, stopped, failure | S1/U1 |

Chat is the application’s most interaction-rich surface and already has its own ChatGPT-style product shell. That independence helps focus but weakens continuity with Home and Today. The route is also the largest frontend file, making visual-only changes especially high-risk without component extraction and behavioral fixtures.

### 6.6 Journey, reflection and proactive guidance

| Route | Current composition | Important states | Evidence |
|---|---|---|---|
| `/life` | Header, year-grouped life-event cards, contextual Dasha band and add/edit overlay | Empty, populated, create, edit, delete confirm, context pending/failure | S1/U1 |
| `/journal` | Header, month-grouped entries and add/edit overlay | Empty, populated, create, edit, delete confirm, context pending/failure | S1/U1 |
| `/nudges` | Header and proactive-guidance list | Loading, empty, unread/read, error | S1/U1 |

These three surfaces express a coherent reflective product opportunity, but they are presently separated routes with similar card-list mechanics and no shared Journey identity.

### 6.7 People and compatibility

| Route | Current composition | Important states | Evidence |
|---|---|---|---|
| `/people` | “Myself” row, related-person list and add action | Skeleton, empty, populated, limit reached | S1/U1 |
| `/people/new` | Relation selector plus birth-details form | Validation, saving, function failure, success | S1/U1 |
| `/people/$id` | Person header, basic Sun/Moon/Ascendant stats, Ask/Compatibility actions, Varga chart and planets | Loading, missing coordinates, provider error, populated | S1/U1 |
| `/people/$id/edit` | Edit form and delete flow | Load, validation, save, regeneration, delete confirm/error | S1/U1 |
| `/people/$id/compatibility` | Guna Milan, Mangal and synastry cards | Loading, partial/unavailable, populated | S1/U1 |

People is functionally complete but visually resembles settings/list-detail software. Relationship meaning is secondary to record management and technical score cards.

### 6.8 Settings and governance

| Route | Current composition | Important states | Evidence |
|---|---|---|---|
| `/settings` | Profile group, birth/people/memory/proactive/voice/journal/life links, appearance preferences, WhatsApp, legal and account groups | Local/profile preference sync, sign-out, delete confirmation | S1/U1 |
| `/settings/memory` | Consent/retention controls, topic memories and emotional-state cards | Loading, empty, populated, retention update, delete | S1/U1 |
| `/settings/proactive` | Enablement, frequency, delivery time and quiet hours | Loading, disabled, saving, error | S1/U1 |
| `/settings/voice` | STT language, speaker and speech pace | Local preference states and preview behavior | S1/U1 |

Settings is orderly but carries too many product destinations. “Delete account” is currently a local-clear-and-sign-out behavior, so its visible language must not imply backend erasure during redesign.

### 6.9 Global system states

| State | Current composition | Evidence |
|---|---|---|
| 404 | Large serif `404`, explanation and return action | S1 |
| Root error | Centered error message and retry/navigation actions | S1 |
| Hydration | Generic pulsing heading/card/tab/content skeleton | S1 |
| Toasts | Sonner notification region | V1/S1 |

---

## 7. Interaction baseline

### 7.1 Inputs and controls

**I1 + S1**

- Minimum touch targets are commonly 44–48 px.
- Focus-visible rings are consistently specified.
- Tabs expose `tablist`, `tab` and `aria-selected`; Home tabs support left/right arrow navigation.
- Forms use inline field errors and top-level form errors.
- Selects, segmented controls, switches, dialogs, drawers and sheets use shared UI primitives.
- Floating chat remains globally accessible on signed-in non-chat screens.

### 7.2 Loading

**S1**

- A generic hydration skeleton exists at shell level.
- Chart, planets, houses, nakshatra, Dasha, remedies, numerology, Lo Shu, people and market modules use specialized skeletons.
- Some modules use simple pulse rectangles while others use layout-faithful skeletons.
- Independent Today/Markets requests can resolve progressively.

### 7.3 Empty states

**S1**

- A reusable EmptyState component exists.
- People, journal, life, nudges and several reports also implement route-specific empty copy.
- Empty states vary from centered illustrations/actions to a single muted sentence.

### 7.4 Errors and unavailable states

**S1**

- A reusable ErrorState component exists, but many modules hand-roll amber bordered alerts.
- Some screens offer retry; others only explain unavailability.
- Some backend failures currently collapse into empty/default values, which can visually resemble a valid negative result.

### 7.5 Destructive and privacy-sensitive actions

**S1**

- Person, journal, life-event and memory deletion use explicit controls; confirmations vary by route.
- Account deletion uses a confirmation dialog but does not currently delete the Supabase account or backend records.
- Consent and memory controls have dedicated explanatory content.

---

## 8. Responsive baseline

### 8.1 Confirmed implementation patterns

**S1**

- Mobile-first Tailwind layouts with `sm`, `md`, `lg` and occasional `xl` changes.
- Desktop rail appears at `md`; mobile bottom navigation appears below `md`.
- Authentication changes to a two-column split at `lg`.
- Lists and cards usually move from one column to two or three columns at wider breakpoints.
- Home’s seven tabs intentionally scroll horizontally on narrow screens.
- Chat uses a fixed/drawer history sidebar on mobile and inline sidebar on desktop.
- Safe-area top and bottom insets are explicitly incorporated.
- Devanagari fonts are provided for Hindi and Marathi.

### 8.2 Responsive risks to carry forward

- Seven Home tabs require horizontal discovery and hide later analytical capabilities off-screen.
- Dense tables/grids and North Indian chart SVGs need genuine device-width visual regression coverage.
- Long translated labels can compete with icons, badges and fixed-width segmented controls.
- Floating chat plus fixed bottom navigation creates overlapping priority zones.
- Auth, language and long settings forms need keyboard-open and short-viewport testing.
- Chat needs dedicated safe-area, composer growth, recording and sidebar tests.

---

## 9. Accessibility and localization baseline

### 9.1 Current strengths

**I1 + S1**

- Semantic headings, labeled navigation and descriptive route titles are broadly present.
- Interactive icons usually have accessible names.
- Focus-visible treatment is consistently defined.
- Reduced-motion mode is supported globally.
- Live/status regions exist for chat, recording and selected asynchronous states.
- English, Hindi and Marathi are first-class language options.
- Text direction is deliberately forced only for data such as email where appropriate.

### 9.2 Current risks

**S1**

- Muted text and translucent borders require measured contrast verification in both themes.
- Dense technical tables need keyboard and screen-reader traversal checks.
- Icon-only desktop navigation depends on titles/accessibility labels for meaning.
- Repeated entrance animations can delay perceived readiness even when reduced-motion handling is correct.
- Error, empty and valid-negative states are not always semantically distinct.
- Astrology glyphs and generated SVG charts require meaningful adjacent text because the visuals alone are not sufficient.

---

## 10. What currently works well and should survive reimagination

1. Warm parchment, deep indigo and gold establish a credible, non-gimmicky astrology identity.
2. The serif/sans pairing feels editorial and premium while supporting Devanagari scripts.
3. The landing hero communicates trust, calmness and privacy without fear-based language.
4. Touch targets, focus rings, semantic controls and reduced-motion support show strong accessibility intent.
5. Dark mode is visually convincing and closer to the desired celestial premium atmosphere.
6. Loading states preserve layout for many data-heavy modules.
7. Chat supports streaming, history, feedback, voice and contextual subject selection without forcing those mechanics into every screen.
8. The application already contains complete functional depth: natal chart, timing, doshas, remedies, daily guidance, reflection, people and compatibility.

---

## 11. Principal UX and visual gaps

These are baseline observations, not implementation decisions.

### P0 — verify before redesign implementation

1. **Possible protected-content flash:** while signed out, a direct visit to `/home` briefly painted the Home shell and cached-looking chart layout before redirecting to `/auth`. The final accessibility tree was the auth page. This must be reproduced with clean storage and a controlled test user to determine whether it is only a shell transition, persisted-query-cache paint or exposure of user-specific cached content.
2. **Mobile evidence gap:** a genuine emulated/physical-device screenshot set is still required because the current headless host enforces a viewport-width floor.

### P1 — structural experience gaps

1. Core journeys are hidden behind Home shortcuts and Settings rather than represented in primary navigation.
2. Home gives seven technically different tabs equal visual weight.
3. Today is a stack of modules rather than one personalized daily narrative.
4. Chat is powerful but visually and navigationally separated from the rest of the product.
5. People and compatibility prioritize records and scores over relationship stories.
6. Desktop layouts leave useful space unused while dense modules remain constrained.

### P2 — visual-system gaps

1. Celestial atmosphere drops sharply after landing/authentication.
2. Repeated bordered cards and pills flatten hierarchy across premium, routine and cautionary moments.
3. Most surfaces are functional rather than playful; delight is concentrated in starfields and small motion utilities.
4. Motion vocabulary is broad in code but experienced mostly as repeated fade-up entrances.
5. Empty/error states vary in composition and tone.
6. Technical astrology data receives limited progressive disclosure or story-led explanation.

---

## 12. Baseline preservation checklist for every future screen

Before accepting a redesigned route, compare it against this checklist:

- Route remains reachable through the approved information architecture.
- Authentication and onboarding guards resolve before user-specific content is shown.
- Loading, empty, valid-negative, partial, unavailable and error states remain distinguishable.
- Existing actions, fields, filters, tabs and relationship selectors remain available or receive an approved replacement.
- Minimum 44 px touch targets and visible keyboard focus are preserved.
- English, Hindi and Marathi labels fit at target breakpoints.
- Light, dark, reduced-motion and safe-area behavior are checked.
- Chart/report output is never visually mistaken for AI interpretation.
- Destructive actions state their real effect accurately.
- Chat streaming, reconnect, abort, voice and history states are regression-tested separately.
- No new UI writes to Supabase or invokes an Edge Function outside the contract map.

---

## 13. Visual regression set required later

The eventual implementation should maintain a controlled, non-production fixture matrix:

| Persona/state | Required screenshots |
|---|---|
| Signed out | Landing, language, sign-in, sign-up, validation, forgot password, legal |
| New user | Consent, empty birth form, validation, place lookup, save progress |
| Incomplete profile | Home setup hero and constrained navigation |
| Complete chart | All seven Home states in light/dark and desktop/mobile |
| Today | Loading, partial success, populated and module failure |
| Chat | Empty, history, streaming, error, voice recording and narrow viewport |
| Journey | Empty/populated life and journal, create/edit/delete overlays |
| Connections | Empty/list/limit, person detail, edit and all compatibility states |
| Settings | Root, memory empty/populated, proactive off/on, voice and confirmations |
| Localization | English, Hindi and Marathi at phone and desktop widths |
| Accessibility | Keyboard focus, 200% zoom, reduced motion and contrast snapshots |

Fixtures must be synthetic and isolated from real customer records.

---

## 14. Action 0.5 decision log

- Public pages were captured directly from the local running application.
- Authentication modes and client-side validation were exercised without submitting credentials.
- Protected screens were inventoried from source instead of creating or impersonating a user.
- Raw narrow captures were retained with an explicit limitation rather than mislabeling capture-host clipping as an application defect.
- The observed pre-redirect Home paint is recorded as a verification-required risk, not as a confirmed privacy incident.
- No source, database, function or production configuration change was made.

---

## 15. Gate

**Action 0.5 is complete when this baseline inventory and its limitations are approved.**

The next planned action is **Action 1.1 — approve the Cosmic Atelier design north star**. It must not begin until the user explicitly approves this baseline and says to continue.
