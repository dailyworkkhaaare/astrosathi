# Design Conformance Audit (post-redesign)

Date: 29 October 2026. Scope: every screen in the approved "AstroSaathi Native Redesign" canvas (73 artboards across Welcome & onboarding, Today, Cosmos, Ask, Journey, People and Settings) compared with the app on `main` after PR #1.

## Method

- Rendered each design artboard locally at 390 px.
- Captured the matching app screens at 390 × 844 in dark and light themes, using the Playwright Supabase mock plus synthetic Journey, Ask and Guidance rows.
- Compared them pair by pair, then checked the code for anything the mock data could not show.

**Limit:** the mock answers chart-gateway with errors for everything except planets. Filled states could not be compared on screen for:

- Cosmos Predictions, Doshas, Remedies, Ashtakavarga, Numerology and Lo Shu;
- the Today signal and glance tiles;
- Horoscope, Panchang and Markets.

Those screens were checked through their loading, empty and error states plus a code read. A live pass with a test account would close this gap.

## Summary

| Area | Matches the design | Fixed in this pass | Deliberate differences |
| --- | --- | --- | --- |
| Welcome & onboarding | Welcome, language, consent, birth "about you", casting, chart ready | Birth casting date in Indian order | Auth options + email sheet → inline form; date/time/place use native inputs |
| Today | Header, daily signal card, sky list, Panchang row, mantra, market lens | Date in Indian order without year; "Current timing" label no longer shows with nothing under it | Context dock above the header; refresh button instead of share |
| Cosmos | Large title, chip tabs, overview placements, Kundli card, timing, explore, Ask card | Removed leftover Life Timeline / Nudges / Journal buttons under every tab; varga labels "D1 · Rashi" without em dashes; Indian-order dates in Doshas | Kundli uses a style picker + varga chips and collapsible Planets/Houses lists |
| Ask | Shell, empty state, prompts, bubbles, no AI avatar, actions, composer, history sheet | History dates in Indian order ("17 Oct") | No regenerate, "Came true?" chips or swipe actions (deferred, need approval) |
| Journey | Hub, chapter, timeline grouped by Mahadasha, journal months, Guidance list, sheets | Indian-order dates in Life and Journal | None of note |
| People | Your chart row, saved list, person profile, compatibility, kuta sheet | None | Saved rows carry Chart / Ask / Compare quick actions |
| Settings | Overview, Preferences, Voice, Memory, Guidance, WhatsApp, Legal | Trailing values on the overview (People count, Guidance frequency, language, WhatsApp On/Off); Indian-order memory dates | Inline memory switch on the overview; no Delete account (no backend) |

## Fixed in this pass

1. **Today date:** read "Thursday, October 29, 2026" (US order with year). It now reads "Thursday, 29 October", as in the design and the en-IN rule.
2. **Today, "Current timing" label:** it rendered even when the timing band had nothing to show, leaving a heading with no content above "Today's sky". The label now renders inside the band and only with it.
3. **Cosmos bottom buttons:** every Cosmos tab ended with the old Life Timeline / Nudges / Reflection Journal buttons. They are not in the design, duplicate the Journey tab and still said "Nudges", so they are gone.
4. **Varga labels:** "D1 — Rashi (birth)" and its siblings used em dashes in visible copy. They now read "D1 · Rashi (birth)" in en/hi/mr, matching the design's "D1 · Rashi".
5. **Settings overview values:** rows now show their current value, as the design does: People count, Guidance "3 per week" or "Off", Preferences language, WhatsApp "On"/"Off".
6. **Indian date order in English:** these used the raw `en` locale and so showed US order, which breaks the "en → en-IN" rule. They now use en-IN:
   - the Ask history ("Oct 17" → "17 Oct");
   - Journal and Life dates;
   - Memory expiry dates;
   - the casting subtitle;
   - Panchang;
   - Doshas;
   - the Bradley and market dates.

## Deliberate differences (kept)

- **Sign-in:** an inline sign-in/sign-up form instead of the options screen and email sheet. Sign in with Apple is deferred.
- **Birth details:** native date and time inputs and an inline place search instead of the custom date sheet and place-search page.
- **Context dock:** the Subject/Time dock on Today, Cosmos, Journey and People is an existing feature the canvas does not show.
- **Kundli:** a chart-style picker with varga chips and collapsible lists, which keeps the 400 ms debounce and the existing table columns.
- **Guidance settings:** "Maximum" and Start/End pickers instead of a weekly segment and a "Pause overnight" switch. Same data, no backend change.
- **Memory:** topic cards instead of a flat list, keeping per-memory retention controls.

## Needs a decision

- **Context dock:** keep it, or follow the canvas and move Subject/Time into Ask only?
- **Inline "Remember our conversations" switch on Settings:** the design shows only "Memory & privacy · On". Remove the switch and show the value instead?
- **Deferred items (need backend or approval):**
  - regenerate;
  - "Came true?" chips;
  - swipe/long-press menus;
  - Delete account;
  - Sign in with Apple;
  - the last-message preview line under each chat in history.

## Follow-ups

- **Em-dash sweep:** about 80 strings per locale still use "—" in visible copy, including:
  - the Ask seed prompts;
  - the market lens explanations;
  - Sade Sati phase text;
  - chart captions;
  - the microphone permission message.

  This is a separate i18n pass because each string needs rewording in all three languages.
- **Live-data pass:** check the data-filled Cosmos and Today screens with a test account.
