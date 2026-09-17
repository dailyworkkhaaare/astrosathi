# AstroSaathi 3.0 — Redesign and Gated Implementation Plan

**Status:** Planning only — no implementation authorized  
**Created:** 8 September 2026  
**Proposed product direction:** Cosmic Atelier — pending approval  
**Project:** AstroSaathi — personalized Vedic astrology and “Chat with your Kundli”

---

## 1. Purpose

This document turns the proposed AstroSaathi 3.0 reimagination into a sequence of small, reviewable actions. Work must proceed **one action at a time**. After each action, the user reviews the result and explicitly says to continue before the next action begins.

The redesign is intended to transform AstroSaathi from a collection of astrology screens into a connected “living personal cosmos” built around five questions:

1. What matters to me today?
2. Why am I experiencing this?
3. Where does this appear in my chart?
4. What can I do with this insight?
5. What pattern is unfolding across my life and relationships?

This is a UX, information-architecture, visual-system, interaction and content redesign. It is **not** authorization to change astrological calculations, backend behavior, database schemas, authentication rules or business logic.

---

## 2. Working protocol: one action at a time

The following protocol applies to every action in this plan.

### Before an action

Codex must state:

- The exact action number and outcome.
- The files expected to be read or changed.
- Whether the action is presentation-only, integration-touching or logic-touching.
- The behavior that must remain unchanged.
- How the result will be verified.

### During an action

- Perform only the approved action.
- Do not silently begin the next action.
- Do not combine adjacent screens simply because they are technically convenient.
- Preserve unrelated user changes in the worktree.
- Do not rewrite published Git history, force-push, rebase pushed commits, amend pushed commits or squash published Lovable history.
- Stop if an unexpected dependency requires broader changes than approved.

### After an action

Codex must report:

- What changed.
- What did not change.
- Validation performed and its result.
- Any known limitation or newly discovered risk.
- The next proposed action, without starting it.

The next action begins only after the user explicitly approves it, for example by saying **“next”** or naming the action.

### Risk classifications

- **Presentation-only:** Styling, layout, animation or copy structure without changing data contracts or event behavior.
- **Integration-touching:** Existing API/query results are displayed or invoked differently, but the backend contract remains unchanged.
- **Logic-touching:** Any change to calculations, validation rules, query behavior, persistence, authorization, database schema or Edge Functions. These actions require separate, explicit approval and are outside the default redesign scope.

---

## 3. Product north star

### Positioning

**AstroSaathi — Your living Vedic cosmos**

AstroSaathi should combine:

- The authenticity and depth of a Vedic astrology platform.
- The emotional clarity of a premium reflection and wellbeing product.
- The responsiveness of a personalized AI companion.
- Transparent chart evidence behind important AI guidance.

It should not feel like:

- A generic purple AI dashboard.
- A marketplace for astrologers.
- A collection of unrelated calculators.
- A static kundli PDF placed inside an app.
- A fear-driven prediction or remedy product.

### Emotional sequence

**Wonder → recognition → understanding → guidance → reflection**

### Recommended creative direction: Cosmic Atelier

Cosmic Atelier is approximately:

- 70% premium celestial atmosphere.
- 20% playful, tactile personality.
- 10% ceremonial Indian astronomical detail.

The style combines luminous gradients, rich dark and light themes, restrained glass surfaces, sculptural celestial objects, subtle grain, editorial typography, hand-drawn star details and purposeful motion.

---

## 4. Future information architecture

The app will be organized into five primary product worlds.

| World | Core question | Existing capabilities included |
|---|---|---|
| **Today** | What is affecting me now? | Daily horoscope, Panchang, transits, nudges, mantra, market outlook |
| **My Cosmos** | Who am I astrologically? | Kundli, vargas, houses, predictions, dashas, doshas, remedies, Ashtakavarga, numerology, Lo Shu |
| **Ask** | What does this mean for me? | AI chat, voice, context, history and follow-up questions |
| **Journey** | How is my life unfolding? | Life timeline, events, journal and reflective patterns |
| **Connections** | How do our charts interact? | Saved people, person charts and compatibility |

Settings will be accessed from the profile/celestial avatar instead of consuming a primary mobile-navigation slot.

### Global context controls

Three global concepts connect the product:

1. **Subject lens:** My chart, another person, or a relationship pair.
2. **Time lens:** Today, a past date, a future date or a saved life event.
3. **Ask from anywhere:** Any house, planet, dasha, transit, dosha, remedy, relationship result or reflection can open chat with that context already attached.

The user must always be able to understand:

- Whose chart is being shown.
- Which date or period is active.
- Which astrological system or layer produced the insight.

---

## 5. Visual and interaction system

### Colour worlds

#### Midnight Rasa

- Deep aubergine-black foundation.
- Indigo and ultraviolet atmospheric depth.
- Solar saffron highlights.
- Aurora rose and electric-blue gradients.
- Warm ivory reading text.

#### Dawn Rasa

- Warm luminous parchment.
- Pale peach and lavender atmosphere.
- Deep plum typography.
- Saffron and magenta accents.
- Soft iridescent surfaces.

### Semantic gradient families

- **Solar:** revelation, confidence and primary actions.
- **Lunar:** reflection, journaling and gentle guidance.
- **Aurora:** AI activity and live personalization.
- **Relationship:** two chart identities interacting.
- **Time:** past, present and future.

Gradients must communicate meaning and hierarchy. They must not be applied indiscriminately to every card.

### Materials

- Solid surfaces for long-form reading and dense chart data.
- Translucent glass for navigation, floating controls and contextual overlays.
- Fine grain and subtle print texture for warmth.
- Gradient borders for active, selected or live elements only.
- One dominant atmospheric light source per screen.
- Strong contrast behind all functional text.

### Typography

- Expressive variable display serif for emotional headlines and ceremonial moments.
- Highly readable sans-serif for interface and long-form content.
- First-class Devanagari type treatment for Hindi and Marathi.
- Editorial numeric styles for dates, houses, degrees and dasha periods.
- Hand-drawn annotation accents used sparingly.

### Illustration

- Sculptural translucent planets.
- Data-driven constellations derived from the user’s chart.
- Hand-drawn stars and tactile imperfections.
- Indian astronomical geometry rather than generic horoscope clip art.
- Small surreal celestial objects used for delight and guidance.

### Motion

Motion must orient, explain, reward or express.

- Micro-interactions: approximately 160–280 ms.
- Spatial transitions: approximately 320–500 ms.
- Ceremonial moments: no more than 2–3 seconds.
- No perpetual animation behind long-form reading.
- Full `prefers-reduced-motion` behavior.
- Smooth interaction on mid-range mobile hardware.

---

## 6. Backend and business-logic preservation contract

### Default rule

The redesign must be presentation-first and contract-preserving. Existing calculation engines, Supabase functions, authentication behavior, persistence rules and data schemas remain unchanged unless the user separately approves a logic change.

### Backend boundaries to preserve

The following existing domains must continue to operate through their current contracts:

- Authentication, onboarding state and route protection.
- Birth-profile creation, editing, geocoding and timezone handling.
- Chart priming, cache invalidation and chart artifact retrieval.
- Rashi and divisional-chart generation.
- North, South and East Indian chart data behavior.
- Planet, sign, house, nakshatra and dignity data.
- Vimshottari Mahadasha, Antardasha and Pratyantardasha.
- Mangal Dosha, Kaal Sarp, Sade Sati and other dosha computations.
- Ashtakavarga calculations.
- Panchang and transit calculations.
- Daily horoscope generation.
- Numerology and Lo Shu calculations.
- Remedies and mantra selection.
- Saved-person chart generation.
- Compatibility, Guna Milan, Mangal comparison and synastry.
- Life events, stamped astrological context and journal persistence.
- AI chat context, streaming, feedback and conversation history.
- Memory inclusion/exclusion and retention preferences.
- Proactive nudges, notification preferences and quiet hours.
- Speech-to-text, text-to-speech, voice and pace preferences.
- Market/barometer/Bradley calculations and their disclaimers.
- English, Hindi and Marathi localization behavior.

### UI invariants

- A redesign must not rename, reinterpret or reorder astrological data in a way that changes its meaning.
- Planet, sign, house, nakshatra, dasha and dosha identifiers must remain mapped to the correct labels.
- Provider-generated SVG chart content must not be parsed or rewritten merely for styling.
- Existing query keys, cache behavior and invalidation rules must remain intact unless separately approved.
- A missing value must remain visibly different from zero, false or “not present.”
- Loading, partial-data and error states must not present fabricated fallback predictions.
- Unknown birth time must continue to limit time-sensitive claims.
- Financial, medical and legal disclaimers must remain visible where applicable.
- Memory must remain opt-in and controllable.

### Accuracy statement

The visual redesign can preserve the application’s current computational accuracy by leaving calculation and business-logic layers unchanged and validating every integration boundary. However, no responsible software plan can promise literal **100% accuracy** without exhaustive specifications and tests.

For this project, “accuracy preserved” will mean:

1. No intentional change to calculation algorithms or business rules.
2. The same approved inputs produce the same backend outputs before and after redesign.
3. The redesigned UI maps and labels those outputs correctly.
4. Critical journeys pass regression and parity checks.
5. Any pre-existing accuracy limitation remains a separate issue rather than being silently changed during redesign.

### Required regression safeguards

- Run the existing parity scripts for varga, dasha, doshas, Sade Sati, Ashtakavarga, Kaal Sarp and chart rendering.
- Create frozen representative fixtures for known birth charts without exposing real user data.
- Compare old and redesigned UI output mappings for the same fixture responses.
- Add contract tests at query/function boundaries where coverage is missing.
- Add end-to-end tests for authentication, birth profile, chart, chat, Today, people, compatibility, Journey and settings.
- Perform visual regression testing separately from data-parity testing.
- Test incomplete profiles, unknown birth time, partial backend failures and stale caches.
- Test long Hindi and Marathi content at mobile widths.
- Record any action that touches integration behavior in the decision log.

---

## 7. Gated action roadmap

Every numbered item below is a separate approval gate. Finishing one item does not authorize the next.

### Phase 0 — Baseline and protection

#### Action 0.1 — Create this gated redesign plan

- **Type:** Documentation only.
- **Outcome:** A shared roadmap, preservation contract and action sequence.
- **Validation:** Confirm the document exists and contains no code or runtime changes.
- **Status:** Completed when this file is created.

#### Action 0.2 — Capture the repository baseline

- Record current Git status, branch and existing user changes.
- Inventory routes, major components, Edge Functions and existing parity scripts.
- Do not modify files.
- **Type:** Read-only.
- **Validation:** Baseline report approved by the user.

#### Action 0.3 — Establish current technical health

- Run the existing build, lint and applicable parity scripts without changing source.
- Record existing failures separately from redesign regressions.
- **Type:** Read-only verification; test commands may create ignored build artifacts.
- **Validation:** Baseline test report approved.

#### Action 0.4 — Map frontend-to-backend contracts

- Document each screen’s queries, mutations, Edge Functions, payloads, cache behavior and error states.
- Mark high-risk integration points.
- **Type:** Documentation only.
- **Validation:** Contract map approved.

#### Action 0.5 — Capture current visual and interaction baseline

- Capture representative desktop and mobile states for all reachable routes.
- Include empty, loading, error and populated states where fixtures are available.
- **Type:** Read-only product audit.
- **Validation:** Baseline screen inventory approved.

### Phase 1 — Product and design specification

#### Action 1.1 — Approve the Cosmic Atelier design north star

- Produce three focused moodboard directions using shared reference criteria.
- Select colour, typography, illustration, material and motion principles.
- **Type:** Design specification only.
- **Validation:** User approves one direction.

#### Action 1.2 — Approve the future information architecture

- Specify Today, My Cosmos, Ask, Journey and Connections.
- Define profile/settings placement and desktop/mobile navigation.
- **Type:** UX specification only.
- **Validation:** Sitemap and navigation model approved.

#### Action 1.3 — Define global context behavior

- Specify Subject lens, Time lens and Ask-from-anywhere behavior.
- Define context inheritance, switching and reset rules.
- **Type:** UX and integration specification.
- **Validation:** Context-state diagrams approved.

#### Action 1.4 — Define content hierarchy and ethical language

- Specify simple, detailed and technical explanation levels.
- Define natal tendency, timing, tradition, AI inference and reflection labels.
- Define dosha, compatibility, remedies and market-language safeguards.
- **Type:** Content specification only.
- **Validation:** Content rules approved.

#### Action 1.5 — Define the design tokens

- Specify colour, gradients, typography, spacing, radii, elevation and responsive breakpoints.
- Include dark/light, Hindi/Marathi and accessible contrast behavior.
- **Type:** Design specification only.
- **Validation:** Token proposal approved before source changes.

#### Action 1.6 — Define the component system

- Specify navigation, bento cards, chart evidence, chart controls, timeline, composer, voice, memory and state components.
- **Type:** Design specification only.
- **Validation:** Component inventory approved.

#### Action 1.7 — Prototype the five hero journeys

- New user → first personalized insight.
- Today → transit evidence → chat.
- Chart → house exploration → contextual question.
- Person → compatibility → conversation.
- Life event → timeline → journal reflection.
- **Type:** Prototype only.
- **Validation:** User reviews mobile and desktop flows.

### Phase 2 — Safety harness before visual implementation

#### Action 2.1 — Add representative non-user test fixtures

- Define synthetic birth-profile and relationship fixtures.
- Ensure no real personal data is committed.
- **Type:** Test-only; integration-touching.
- **Validation:** Fixture outputs reviewed against current behavior.

#### Action 2.2 — Add missing frontend contract tests

- Cover high-risk data-to-label mappings before screens are changed.
- **Type:** Test-only; integration-touching.
- **Validation:** Tests fail on intentional mapping errors and pass on current code.

#### Action 2.3 — Add critical end-to-end smoke journeys

- Cover auth routing, onboarding, chart, chat, Today, people, compatibility, Journey and settings.
- **Type:** Test infrastructure.
- **Validation:** Baseline smoke suite result recorded.

#### Action 2.4 — Add visual-regression foundations

- Define viewport, theme and locale matrix.
- Keep visual snapshots separate from calculation assertions.
- **Type:** Test infrastructure.
- **Validation:** Stable baseline snapshots approved.

### Phase 3 — Shared visual foundation

#### Action 3.1 — Introduce approved semantic design tokens

- Update token definitions only.
- Preserve existing semantic names where required for compatibility.
- **Type:** Presentation-only.
- **Validation:** Contrast audit, build and snapshot review.

#### Action 3.2 — Introduce approved typography

- Add display, UI, Devanagari and numeric typography behavior.
- **Type:** Presentation-only.
- **Validation:** English, Hindi and Marathi specimen review.

#### Action 3.3 — Create shared atmospheric backgrounds and textures

- Implement Midnight Rasa and Dawn Rasa foundations.
- **Type:** Presentation-only.
- **Validation:** Performance, contrast and reduced-motion review.

#### Action 3.4 — Create shared motion primitives

- Add micro, spatial, ceremonial and reduced-motion behaviors.
- **Type:** Presentation-only.
- **Validation:** Motion review on desktop and mid-size mobile viewport.

#### Action 3.5 — Redesign shared loading, empty and error states

- Preserve all existing error conditions and retry behavior.
- **Type:** Presentation-only unless a missing retry hook is separately approved.
- **Validation:** State matrix review.

### Phase 4 — Public and onboarding journey

#### Action 4.1 — Redesign the landing page

- Add product demonstration, kundli-to-chat story, feature bento and trust layer.
- **Type:** Presentation-only.
- **Validation:** Responsive, performance and localization review.

#### Action 4.2 — Redesign language selection

- Preserve locale persistence and routing.
- **Type:** Presentation-only.
- **Validation:** All three language selections behave identically to baseline.

#### Action 4.3 — Redesign sign-in and sign-up

- Preserve Supabase authentication, Google sign-in and validation rules.
- **Type:** Integration-touching.
- **Validation:** Auth smoke tests and error-state review.

#### Action 4.4 — Redesign auth callback and password-reset states

- Preserve token handling and post-auth routing.
- **Type:** Integration-touching.
- **Validation:** Callback/reset journey tests.

#### Action 4.5 — Redesign consent

- Clarify required versus optional permissions.
- Preserve consent persistence and memory opt-in behavior.
- **Type:** Integration-touching.
- **Validation:** Consent combinations and route transitions.

#### Action 4.6 — Redesign birth-details entry

- Introduce the approved staged experience.
- Preserve validation, geocoding, timezone, unknown-time and save behavior.
- **Type:** Integration-touching.
- **Validation:** Field-level parity and fixture journeys.

#### Action 4.7 — Redesign the chart-casting ceremony

- Add the signature reveal without delaying or duplicating backend generation.
- Preserve the current “regenerate only when birth data changed” rule.
- **Type:** Presentation-only around an integration boundary.
- **Validation:** Changed and unchanged birth-profile cases.

### Phase 5 — Application shell and navigation

#### Action 5.1 — Implement the mobile five-world navigation shell

- Today, My Cosmos, Ask, Journey and Connections.
- **Type:** Integration-touching routing change.
- **Validation:** Every destination and active state.

#### Action 5.2 — Implement the desktop celestial dock

- Responsive expanded/collapsed behavior.
- **Type:** Presentation and routing.
- **Validation:** Keyboard, tooltip and breakpoint behavior.

#### Action 5.3 — Implement the profile/settings entry

- Relocate settings access without removing any settings capability.
- **Type:** Routing presentation.
- **Validation:** All settings destinations remain reachable.

#### Action 5.4 — Implement Subject and Time lens shells

- UI state only at first; no data contract change.
- **Type:** Integration-touching.
- **Validation:** Context ownership and reset rules.

### Phase 6 — Today

#### Action 6.1 — Redesign Today overview

- Daily theme, celestial weather and personalized priority.
- Preserve existing daily data sources.
- **Type:** Integration-touching.
- **Validation:** Same input data, approved new hierarchy.

#### Action 6.2 — Redesign daily horoscope detail

- **Type:** Presentation-only.
- **Validation:** Horoscope data and reason/evidence parity.

#### Action 6.3 — Redesign Panchang detail

- **Type:** Presentation-only.
- **Validation:** Date, location and Panchang value parity.

#### Action 6.4 — Redesign transit highlights and evidence

- Connect insights to chart context and Ask.
- **Type:** Integration-touching.
- **Validation:** Transit mapping and contextual-chat seed tests.

#### Action 6.5 — Redesign mantra and daily-practice cards

- Preserve selection logic.
- **Type:** Presentation-only.
- **Validation:** Existing result parity and audio/translation states.

#### Action 6.6 — Redesign market, barometer and Bradley views

- Visually separate experimental market astrology from personal guidance.
- Preserve existing calculations and disclaimers.
- **Type:** Integration-touching and high-risk content.
- **Validation:** Data parity, disclaimer and error-state review.

#### Action 6.7 — Redesign the nudges inbox

- Preserve frequency, quiet hours and dismissal behavior.
- **Type:** Integration-touching.
- **Validation:** Nudge lifecycle tests.

### Phase 7 — My Cosmos

#### Action 7.1 — Build the My Cosmos overview hierarchy

- Kundli, core placements, current dasha and life-area gateways.
- **Type:** Integration-touching.
- **Validation:** Existing chart data parity.

#### Action 7.2 — Redesign the interactive kundli frame

- Add selection and explanation layers without modifying provider SVG data.
- **Type:** Presentation and interaction.
- **Validation:** North/South/East rendering parity and accessibility list view.

#### Action 7.3 — Redesign varga selection and divisional-chart exploration

- Preserve all supported vargas and labels.
- **Type:** Integration-touching.
- **Validation:** Existing varga parity scripts plus UI mapping tests.

#### Action 7.4 — Redesign planet and house exploration

- Add house inspector and Ask context.
- **Type:** Integration-touching.
- **Validation:** Planet/house/sign/nakshatra mapping fixtures.

#### Action 7.5 — Redesign prediction narratives

- Organize existing prediction output by life area.
- **Type:** Integration-touching.
- **Validation:** No loss or reinterpretation of source fields.

#### Action 7.6 — Redesign the dasha river

- Visualize Maha, Antar and Pratyantar periods.
- **Type:** Integration-touching.
- **Validation:** Boundary-date and nesting parity tests.

#### Action 7.7 — Redesign doshas

- Use contextual, non-alarmist presentation.
- Preserve status, calculation basis and mitigating factors.
- **Type:** Presentation-only around sensitive data.
- **Validation:** All dosha parity scripts and copy review.

#### Action 7.8 — Redesign remedies

- Practice library, save/remind/listen actions only where existing behavior supports them.
- **Type:** Presentation-only by default.
- **Validation:** Remedy-selection parity and disclaimer review.

#### Action 7.9 — Redesign Ashtakavarga

- Heatmap plus accessible numeric view.
- **Type:** Presentation-only.
- **Validation:** Bindus and totals parity.

#### Action 7.10 — Redesign numerology

- Separate numerology-derived insight from Jyotish-derived insight.
- **Type:** Presentation-only.
- **Validation:** Calculation-output parity.

#### Action 7.11 — Redesign Lo Shu

- Animated construction with static reduced-motion fallback.
- **Type:** Presentation-only.
- **Validation:** Grid values and missing/repeated-number parity.

### Phase 8 — Ask AstroSaathi

#### Action 8.1 — Redesign the chat shell and empty state

- Preserve conversation loading, auth and history behavior.
- **Type:** Presentation-only.
- **Validation:** Empty, returning and failed-load states.

#### Action 8.2 — Redesign the contextual composer

- Show subject, time and astrological evidence context.
- Preserve message validation and submission behavior.
- **Type:** Integration-touching.
- **Validation:** Seed/context and send tests.

#### Action 8.3 — Redesign assistant and user messages

- Add structured insight hierarchy while preserving streaming Markdown.
- **Type:** Presentation-only unless response schema changes are separately approved.
- **Validation:** Streaming, code, lists, links, Hindi/Marathi and interrupted replies.

#### Action 8.4 — Add chart-evidence presentation

- Display evidence already present in response/context data.
- Do not fabricate missing evidence.
- **Type:** Integration-touching.
- **Validation:** Evidence-to-chart navigation tests.

#### Action 8.5 — Redesign follow-ups, feedback and retry states

- Preserve feedback persistence and retry logic.
- **Type:** Presentation-only.
- **Validation:** Feedback and failure recovery tests.

#### Action 8.6 — Redesign conversation history

- Add topic/person organization while retaining chronological access.
- **Type:** Integration-touching.
- **Validation:** Create, select, search, rename if supported, and history grouping.

#### Action 8.7 — Redesign voice conversation

- Constellation waveform, transcript and listening/thinking/speaking states.
- Preserve STT/TTS contracts.
- **Type:** Integration-touching.
- **Validation:** Permission, recording, cancellation, failure and playback states.

### Phase 9 — Journey

#### Action 9.1 — Build the Journey overview

- Connect Life and Journal without changing their persistence models.
- **Type:** Integration-touching.
- **Validation:** Both existing destinations and data remain available.

#### Action 9.2 — Redesign the life timeline

- Layer dashas, transits and user events.
- **Type:** Integration-touching.
- **Validation:** Timeline-date and astrological-context parity.

#### Action 9.3 — Redesign life-event creation and editing

- Preserve date precision, valence and context-stamping behavior.
- **Type:** Integration-touching.
- **Validation:** Create/edit validation and persisted-result tests.

#### Action 9.4 — Redesign Journal overview and entries

- Preserve mood, text and stamped context.
- **Type:** Integration-touching.
- **Validation:** Create/edit/read grouping and localization tests.

#### Action 9.5 — Add approved Journey-to-Ask context

- Send a selected event or journal context only with clear user action.
- **Type:** Integration-touching and privacy-sensitive.
- **Validation:** Context preview and consent behavior.

### Phase 10 — Connections

#### Action 10.1 — Redesign the people constellation

- Preserve list, selection and add-person behavior.
- **Type:** Presentation-only.
- **Validation:** Empty, loading and populated states.

#### Action 10.2 — Redesign add-person flow

- Reuse approved birth-detail patterns.
- Preserve validation and saved-person persistence.
- **Type:** Integration-touching.
- **Validation:** Create-person fixtures and error states.

#### Action 10.3 — Redesign person detail

- Chart, current timing, relationship role and Ask entry.
- **Type:** Integration-touching.
- **Validation:** Correct person identity on every derived view.

#### Action 10.4 — Redesign edit-person flow

- Preserve regeneration behavior and navigation.
- **Type:** Integration-touching.
- **Validation:** Changed/unchanged birth-data cases.

#### Action 10.5 — Redesign compatibility overview

- Lead with relationship patterns instead of a single score.
- **Type:** Presentation-only around sensitive interpretation.
- **Validation:** Correct pair ordering and bundle mapping.

#### Action 10.6 — Redesign Guna Milan, Mangal and synastry details

- Preserve scores, components and calculation results.
- **Type:** Presentation-only.
- **Validation:** Compatibility contract fixtures and failure states.

### Phase 11 — Profile, settings and governance

#### Action 11.1 — Redesign settings overview

- Reorganize existing destinations without removing capabilities.
- **Type:** Presentation and routing.
- **Validation:** Reachability audit.

#### Action 11.2 — Redesign language and appearance preferences

- Preserve storage, system-theme behavior and locale switching.
- **Type:** Integration-touching.
- **Validation:** Refresh/persistence tests.

#### Action 11.3 — Redesign memory controls

- Show provenance, AI inclusion and retention clearly.
- Preserve opt-in, exclusion and deletion behavior.
- **Type:** Integration-touching and privacy-sensitive.
- **Validation:** Memory lifecycle and authorization tests.

#### Action 11.4 — Redesign proactive-guidance settings

- Preserve frequency, delivery time and quiet-hour behavior.
- **Type:** Integration-touching.
- **Validation:** Preference persistence and boundary times.

#### Action 11.5 — Redesign voice settings

- Add previews while preserving voice and pace values.
- **Type:** Integration-touching.
- **Validation:** Preview and preference persistence.

#### Action 11.6 — Redesign privacy, terms and methodology pages

- Preserve legal meaning; copy changes require explicit review.
- **Type:** Presentation-only unless legal text is separately approved.
- **Validation:** Content and link audit.

#### Action 11.7 — Redesign sign-out and destructive-account actions

- Keep destructive actions unmistakable and confirmed.
- **Type:** Integration-touching and high-risk.
- **Validation:** Confirmation, cancellation and successful-path tests.

### Phase 12 — Whole-product quality pass

#### Action 12.1 — English responsive audit

- Test agreed phone, tablet and desktop viewports.
- **Validation:** Screen matrix approved.

#### Action 12.2 — Hindi localization audit

- Test typography, overflow, tone and missing keys.
- **Validation:** Hindi screen matrix approved.

#### Action 12.3 — Marathi localization audit

- Test typography, overflow, tone and missing keys.
- **Validation:** Marathi screen matrix approved.

#### Action 12.4 — Accessibility audit

- WCAG AA contrast, keyboard, focus, landmarks, announcements, tap targets and reduced motion.
- **Validation:** No unresolved critical accessibility failures.

#### Action 12.5 — Performance audit

- Measure loading, bundle impact, animation smoothness and image behavior.
- **Validation:** Agreed performance budget met or exceptions approved.

#### Action 12.6 — Full calculation and integration parity run

- Run all parity, contract and end-to-end suites.
- Compare representative before/after outputs.
- **Validation:** No unexplained calculation or business-logic regressions.

#### Action 12.7 — Production readiness review

- Review errors, observability, rollback considerations and Lovable/Vercel deployment impact.
- **Validation:** Explicit user approval before deployment-related work.

---

## 8. Proposed acceptance criteria

### Product

- A new user reaches a meaningful personalized insight without needing astrology expertise.
- Every major chart insight provides a clear path to explanation or conversation.
- Today, chart, chat, reflection and relationships feel connected rather than separate tools.
- Technical Vedic details remain available without dominating beginner journeys.

### Visual quality

- Premium, gradient-rich and playful without reducing readability.
- Recognizably AstroSaathi rather than a generic AI or horoscope template.
- Dark and light themes feel intentionally art-directed.
- Mobile and desktop compositions are both designed, not merely resized.

### Trust and accessibility

- Users can see why important guidance appears.
- Doshas, compatibility, remedies and market outputs avoid deterministic or fear-based framing.
- Memory and personal context remain transparent and controllable.
- WCAG AA, keyboard navigation, 44 px touch targets and reduced motion are preserved.

### Technical preservation

- Existing backend contracts remain stable by default.
- Representative inputs retain the same calculation outputs.
- No existing route capability becomes unreachable without explicit approval.
- English, Hindi and Marathi behavior remains complete.
- Existing business rules and disclaimers survive the redesign.

---

## 9. Performance, scale, security and maintenance assumptions

These assumptions require confirmation during Phase 0 and Phase 1:

- Mobile-first responsive web/PWA remains the delivery platform.
- Meaningful mobile content should appear in approximately 2.5 seconds on ordinary 4G where backend latency permits.
- Direct chart manipulation should target 60 fps on supported mid-range devices.
- Heavy illustration and atmospheric assets must load progressively.
- The interface must tolerate partial backend failures without inventing content.
- Birth data, conversations, journal entries and memories remain private and authorization-scoped.
- No third-party analytics or design dependency will receive sensitive chart or journal data without explicit approval.
- The system remains tokenized and component-based for continued maintenance by the existing team and Lovable workflow.
- New dependencies must be justified and approved as their own action.

---

## 10. Decision log

| Decision | Alternatives considered | Reason |
|---|---|---|
| Treat the work as a complete product-experience redesign | Visual reskin only | Existing functionality is deep but fragmented; a skin would not solve discoverability or flow problems |
| Propose Cosmic Atelier for approval | Liquid Observatory; Festival of Stars | Best balance of premium depth, playful character and long-session readability |
| Use five primary product worlds | Keep current Home/Today/Settings model | Makes the true feature set understandable and connects related capabilities |
| Make Ask a global action and primary world | Keep chat isolated | “Chat with your Kundli” is the product differentiator and should connect every insight |
| Preserve backend contracts by default | Rewrite frontend and backend together | Reduces regression risk and protects current calculation/business behavior |
| Use progressive disclosure | Show all technical details immediately | Supports beginners without removing expert depth |
| Require one-action approval gates | Implement by broad phase | Gives the user direct control and makes regressions easier to isolate |

---

## 11. Explicit non-goals without separate approval

- No change to astrological algorithms.
- No change to Supabase database schemas or security policies.
- No change to authentication providers or authorization rules.
- No replacement of backend Edge Functions.
- No monetization, subscription or marketplace implementation.
- No new social-sharing behavior.
- No automatic transmission of journal, memory, birth or relationship data.
- No native iOS or Android rewrite.
- No deployment or production release.
- No Git-history rewriting.

---

## 12. Current checkpoint

The only completed action is **Action 0.1: create this gated redesign plan**.

No implementation action is authorized. The next proposed action, only after user approval, is:

**Action 0.2 — Capture the repository baseline.**
