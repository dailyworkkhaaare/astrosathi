# Mobile Native UI Audit for Capacitor Readiness

## Scope

This audit reviews AstroSaathi as a mobile-first product that will be wrapped with Capacitor for iOS and Android. The focus is UI, interaction feel, information architecture, and native-app polish. It does not change business logic, astrology calculations, authentication, or Supabase contracts.

Evidence used:

- Current mobile captures from the local app at 390 x 844 with synthetic authenticated data.
- Existing visual regression anchors at 320 x 800 and 390 x 844.
- Source review of the app shell, navigation, chat, Today, Cosmos, Journey, People, Life Timeline, Settings, and route inventory.
- Existing accessibility and performance audit tests.

Temporary current captures were generated at `/tmp/astrosaathi-mobile-audit/*.png`.

## Executive Summary

AstroSaathi is already ahead of many web-to-native candidates. It has:

- A strong visual identity.
- Safe-area handling in key shell areas.
- Five-world mobile navigation in current source.
- 44px mobile touch-target tests.
- Reduced-motion and semantic contrast tests.
- Mobile visual regression anchors.
- A strong Chat/Ask direction after the recent dynamic reading-state work.

The main gap is not basic responsiveness. The main gap is that several screens still feel like a responsive web app inside a phone rather than a native mobile product. The app needs a stronger mobile shell policy, route-level hierarchy, sheet-first interactions, native keyboard behavior, denser but calmer information design, and device-level polish.

## Priority Findings

### P0 - Native Shell and Capacitor Foundations

The app needs a native-shell readiness layer before shipping inside Capacitor.

Gaps:

- No explicit Capacitor safe-area/token contract yet.
- Browser-style route transitions and page loading remain visible in places.
- Android back behavior, iOS swipe/back expectations, and hardware back handling need a unified policy.
- Status bar and navigation bar styling are not documented per theme/screen.
- Chat has a custom full-screen shell while most screens use the shared shell. This can be good, but it needs a rule.

Plan:

1. Add a `NativeShell` policy document and implementation checklist.
2. Define status bar style per theme: dark immersive for Ask/Today dark, light for Dawn screens.
3. Define Android navigation-bar color and contrast.
4. Add Capacitor keyboard behavior rules:
   - composer docks above keyboard
   - no double bottom padding
   - focused inputs scroll into view
   - destructive sheets are not hidden behind keyboard
5. Add Android back-button routing rules:
   - close sheet/drawer first
   - then close chat sidebar
   - then route back
   - then confirm app exit only at root worlds
6. Audit every `100vh`/`100dvh` and fixed-bottom element against native webview behavior.

Acceptance:

- App opens without visible browser chrome assumptions.
- Status/nav bars match the active theme.
- Keyboard does not cover any composer, CTA, or form submit button.
- Hardware back never accidentally exits while a sheet/drawer is open.

### P0 - Mobile Navigation IA Consistency

Current source has five primary worlds: Today, Cosmos, Ask, Journey, People. This is the right direction for a native app. However, route history and screen naming still show legacy structure.

Gaps:

- Some current route names do not match product-world naming: `/home` is Cosmos, `/life` is timeline inside Journey, `/settings` is profile utility outside the main five worlds.
- Settings is accessed through the profile button, not primary nav, which is correct, but this needs stronger native profile affordance.
- Chat/Ask top bar differs strongly from world screens.
- Context chips appear on most world screens but not in the same way on Ask.

Plan:

1. Keep five bottom tabs: Today, Cosmos, Ask, Journey, People.
2. Treat Settings as account/profile utility, never as a bottom tab.
3. Add a consistent native top area:
   - context chips on world screens
   - profile/avatar affordance at top-right
   - no redundant page chrome
4. Define special full-screen shell rules:
   - Ask can be full-screen
   - onboarding/auth can be full-screen
   - charts and timelines stay in world shell
5. Native deep-link aliases map familiar world names without adding duplicate web routes:
   - `/cosmos` -> `/home`
   - `/ask` -> `/chat`
   - `/connections` -> `/people`

Acceptance:

- A user can explain the app as five worlds.
- No bottom-tab item disappears across authenticated screens.
- Utility screens have predictable back behavior.

### P0 - First-Viewport Usefulness

Several mobile first viewports spend too much space before a useful action or meaningful content.

Observed:

- Today: visually premium, but the first useful card can be an empty state that takes large space.
- Chat: one current synthetic capture showed almost blank space above the composer. The code has an empty-state hero, so this may be timing/data state, but it is high risk for Ask.
- Life Timeline: clean but sparse empty state with limited action guidance.
- Cosmos: clear hero, but horizontal tabs clip and hide important choices.

Plan:

1. For each primary world, define the first viewport contract:
   - one clear H1
   - one primary current-state card
   - one obvious primary action
   - one path to Ask
2. Shrink empty-state hero cards on mobile.
3. Add action-bearing empty states:
   - Today: "Complete today's reading" / "Ask about today"
   - Life: templates like Job, Move, Relationship, Health
   - Chat: always show greeting or recent context suggestions; never blank
4. Add skeletons that preserve useful layout but do not dominate the screen.

Acceptance:

- At 390 x 844, every primary tab shows content and an action without scrolling.
- No primary screen first viewport is mostly empty unless intentionally meditative and clearly useful.

### P1 - Horizontal Scrollers Feel Webby

Cosmos uses a horizontally scrolling tab row. At 390px, "Predictions" or later items are clipped with no strong scroll affordance.

Gaps:

- Hidden overflow can make users think content is cut off.
- Pills consume too much vertical and horizontal space.
- Many chart sections are peer-level tabs when mobile users need progressive disclosure.

Plan:

1. Replace long tab scrollers with a compact native segmented/menu pattern:
   - top-level: Overview, Kundli, Timing, Remedies
   - secondary options inside each section as chips/sheets
2. Add an end fade or "More" affordance if horizontal scrolling remains.
3. Use bottom sheets for advanced chart type selection instead of long horizontal controls.

Acceptance:

- No important option is only discoverable by accidental horizontal scroll.
- The chart area feels like an instrument panel, not a web tab strip.

### P1 - Native Sheet-First Interaction Model

The UI currently uses cards, drawers, dialogs, popovers, and inline forms. For mobile native feel, consequential secondary tasks should use bottom sheets.

Targets:

- Profile/settings menu.
- Subject selector.
- Time selector.
- Varga chart selector.
- Chat history on mobile.
- Add/edit life event.
- Add/edit person.
- Feedback details on chat answers.
- Memory/privacy details.

Plan:

1. Standardize `NativeSheet` anatomy:
   - drag handle
   - title
   - short description only when needed
   - scroll body
   - sticky bottom action area
   - safe-area bottom padding
2. Replace modal-like mobile interactions with sheets.
3. Keep destructive confirmation explicit and thumb-reachable.

Acceptance:

- Mobile secondary flows open as sheets, not desktop dialogs.
- Forms can be completed with keyboard open.
- Back gesture/button closes the sheet first.

### P1 - Information Density and Card Hierarchy

The visual identity is strong, but many authenticated screens still stack rounded cards. This can feel premium at first, then repetitive.

Observed:

- Today has multiple large cards, including empty cards.
- People is richer now but still a vertical card feed.
- Settings uses large grouped cards that work, but long lists need native grouping polish.
- Cosmos has card plus tab plus card layering.

Plan:

1. Define three mobile surface types:
   - hero/state cards for rare, important states
   - compact list rows for repeated objects
   - technical panels for charts/tables
2. Reduce card nesting.
3. Use native grouped-list style for Settings and repeated People rows.
4. Promote summary rows over large empty cards.
5. Reserve glow/gradient cards for high-value moments only.

Acceptance:

- Repeated objects scan quickly.
- Empty or unavailable states do not occupy hero-card space unless they teach or offer action.

### P1 - Chat/Ask Mobile Experience

The dynamic reading-state improvement is in the right direction. The remaining work is native polish.

Gaps:

- Chat has a very different shell from the other worlds.
- Empty state can feel too centered/heroic or, in one current capture, absent.
- Chat history sidebar is desktop-like even if adapted to mobile.
- Composer is strong but must be tested deeply under Capacitor keyboard.

Plan:

1. Keep Ask as a full-screen native conversation world.
2. Make empty Ask state more compact on mobile:
   - greeting
   - 3 contextual prompt chips
   - recent context line
3. Convert history sidebar to a native sheet/drawer with clear grab/back behavior.
4. Add "context applied" capsule above composer only when meaningful.
5. Test with iOS and Android keyboard open, dictation, and read-aloud controls.

Acceptance:

- Ask never opens to a blank-looking screen.
- Composer remains stable above keyboard.
- Reading prep feels alive but not artificial.

### P1 - Today Needs a Stronger Daily Story

Today is visually strong, but it can become a stack of module cards.

Gaps:

- The "daily signal" empty state dominates.
- Current timing and support sections are separated like a dashboard.
- Users need one simple daily takeaway before modules.

Plan:

1. Add a compact top "Today at a glance" strip:
   - mood/timing
   - Moon/current sky
   - one action: Ask about today
2. Collapse unavailable modules into smaller rows.
3. Make Panchang/mantra/supporting cards secondary.
4. Add pull-to-refresh behavior for native.

Acceptance:

- First viewport answers: "What should I know today?"
- Empty modules do not feel like broken content.

### P1 - Cosmos Needs Progressive Depth

Cosmos is the technical heart, but mobile users need simple-to-technical progression.

Gaps:

- Technical modules are exposed as many peer tabs.
- Chart controls and tables can become dense on mobile.
- Horizontal tab clipping is visible.

Plan:

1. Split into progressive levels:
   - At a glance
   - Kundli explorer
   - Timing
   - Technical details
2. Use bottom sheet for chart controls.
3. Add "Ask about this" sticky contextual action when a planet/house is selected.
4. Use compact data rows rather than wide tables on mobile.

Acceptance:

- A non-technical user can use Cosmos without understanding every chart term.
- A technical user can still reach all details.

### P2 - Native Motion and Haptics

The app has reduced-motion support and tasteful motion, but native wrappers should add physical feedback.

Plan:

1. Add Capacitor haptics for:
   - bottom tab change
   - primary CTA success
   - sheet open/close
   - message send
   - destructive confirmation
2. Use screen transitions:
   - world tab switch: subtle fade/no slide
   - detail push: native horizontal slide
   - sheet: bottom-up spring
3. Avoid perpetual animations on long reading screens.

Acceptance:

- Interactions feel tactile but calm.
- Reduced motion disables spatial movement and haptics can be preference-aware.

### P2 - Device Integration

Plan:

1. Add native share for readings and compatibility summaries.
2. Use native notifications for nudges with permission education.
3. Add offline/poor-network banners suited for mobile.
4. Handle app resume:
   - refresh session
   - refresh Today data if stale
   - preserve chat draft
5. Add deep links:
   - Ask
   - Today
   - People detail
   - notification target

Acceptance:

- The app feels installed, resumable, and aware of device state.

Implemented so far:

- Ask preserves an unfinished question in session-only storage, scoped to the signed-in person and active conversation.
- A draft is restored after a background/resume or reload, never sent to Supabase, and removed only once a complete reply succeeds.
- Signing out clears session-only Ask drafts, and an offline send keeps the question in place until the connection returns.
- Nudge notification targets now deep-link to the matching inbox item, with focused arrival, native refresh, and tactile action feedback.

## Screen-by-Screen Fix Plan

### Landing

Keep:

- Strong brand and premium hero.

Improve:

- Reduce below-fold visual preview height on mobile.
- Add app-store/native trust cues only after Capacitor build exists.
- Ensure CTA stays thumb-reachable on small iPhones.

### Auth

Keep:

- Strong visual tone and clear tabbed auth.

Improve:

- Use iOS/Android autofill friendly input attributes.
- Test keyboard coverage on sign-up and reset-password.
- Consider native social auth flow via Capacitor plugins before production.

### Today

Improve first:

- Compress empty Daily Signal.
- Add primary "Ask about today" action.
- Make unavailable modules compact.
- Add pull-to-refresh later.

### Cosmos

Improve first:

- Replace or redesign horizontal tab scroller.
- Move advanced chart controls into a sheet.
- Add progressive detail levels.
- Make selected chart objects trigger contextual Ask.

### Ask

Improve first:

- Guarantee compact empty state appears.
- Keep dynamic reading loop.
- Turn chat history into mobile sheet.
- Test keyboard/audio states on device.

### Journey and Life Timeline

Improve first:

- Add event templates.
- Add a stronger first-event action.
- Convert add/edit event form to native sheet.
- Turn unavailable timing into actionable recovery.

### People

Improve first:

- Convert saved people into tighter native collection rows.
- Add quick actions: open chart, compatibility, ask about person.
- Use sheet for add/edit person.

### Settings

Improve first:

- Convert to native grouped settings style.
- Make subpages use consistent back header.
- Add app version/build/environment row.
- Add notification permission status row once native notifications are wired.

## Implementation Phases

### Phase 1 - Native Shell Hardening

Files likely involved:

- `src/components/layout/AppShell.tsx`
- `src/routes/__root.tsx`
- `src/styles.css`
- Capacitor config once added

Work:

- Define native safe-area tokens.
- Add Android back behavior policy.
- Add status/nav bar theme policy.
- Review all fixed bottom elements.
- Add mobile shell regression tests for 360 x 780, 390 x 844, 430 x 932.

### Phase 2 - Primary World Mobile Polish

Work:

- Today first viewport.
- Cosmos tab/control redesign.
- Ask empty state and history sheet.
- Journey empty/action states.
- People compact collection rows.

### Phase 3 - Sheet System and Forms

Work:

- Standardize native sheet component.
- Move add/edit person, add/edit life event, chart selector, subject/time selectors into sheets.
- Add keyboard-open screenshots/tests.

### Phase 4 - Native Device Behaviors

Work:

- Haptics.
- Push notification permission UX.
- Native share.
- App resume refresh.
- Deep-link handling.

### Phase 5 - Visual QA and Store Readiness

Work:

- Device screenshots on iPhone SE, iPhone 15/16 class, Pixel compact, Pixel large.
- Dark/light, English/Hindi/Marathi.
- Reduced motion.
- Offline/slow network.
- App icon/splash/status bar checks.

## Suggested Test Additions

- Mobile screenshot matrix at:
  - 360 x 780
  - 390 x 844
  - 430 x 932
- Keyboard-open tests for:
  - auth email/password
  - chat composer
  - add life event
  - add person
  - settings preferences
- Native shell tests after Capacitor:
  - status bar color
  - nav bar color
  - safe-area top and bottom
  - hardware back behavior
  - resume from background

## Recommended First Sprint

1. Add native shell policy and test matrix.
2. Fix Cosmos horizontal tab/scroller pattern.
3. Compress Today empty/unavailable first viewport and add "Ask about today".
4. Guarantee Ask empty state never appears blank.
5. Standardize mobile bottom sheets for Subject, Time, and chat history.
6. Add keyboard-open regression screenshots.

This gives the largest native-feel improvement before any deep Capacitor integration.
