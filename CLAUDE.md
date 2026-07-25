# CLAUDE.md — AstroSaathi working agreement

You are working on **AstroSaathi**, an AI Vedic astrology app (React + TypeScript + Vite + TanStack Router + Tailwind + shadcn/ui + i18next, Supabase backend with Edge Functions). USP: "Chat with your Kundli" — AI chat personalized by the user's real birth chart.

The full UI/UX redesign is COMPLETE and audited. Your job from here is to keep that quality bar while adding features. **Read `design.md` in this repo root — it is law.**

---

## 1. Absolute rules

1. **Never change without explicit approval from me:**
   - Astrology calculation logic and provider integration (chart data, planets, dashas, yogas)
   - Everything in `supabase/functions/` (astrologer-chat SSE contract, chart-gateway, prime-charts) — request/response shapes are frozen
   - Authentication, database schema, data models, business rules
   - The streaming plumbing in `src/routes/chat.tsx` (streamAstrologerReply, bufferRef/rafRef, scheduleFlush, typewriterReveal, abortActiveStream, sendToBackend, scroll pinning)
2. **Design tokens only.** Never hardcode hex/rgb/hsl colors in classNames or inline styles (exceptions: Google logo SVG, Starfield/ceremony SVG internals). Amber for destructive/caution — **never red**. One gold glow per screen at rest.
3. **i18n always.** Every user-facing string goes through `t()` with keys added to `src/i18n/locales/en.json`, `hi.json`, AND `mr.json` in the same commit. Keep Sanskrit/astrology terms transliterated, not translated. Never replace a `t()` call with a string literal.
4. **Typography law:** `font-display` (Cormorant Garamond serif) only on page-level headings and the deliberate serif moments listed in design.md. Small card titles stay sans.
5. **Accessibility floor:** 44px tap targets (`min-h-11`), `focus-visible:ring-2 ring-ring`, aria-labels on icon buttons, `prefers-reduced-motion` respected, keyboard operability preserved (chip tabs use roving tabIndex + arrow keys — do not break).
6. **Icons:** lucide-react only. The AI has **no avatar in chat** — assistant replies are plain manuscript-style text (see design.md §7). Do not add one.
7. **Never parse or string-modify the provider kundli SVG.** Style it only via the CSS wrapper selectors documented in design.md §7.
8. **Secrets:** never hardcode keys or URLs. Env vars in `.env` only (gitignored). If you need a credential, ask me. Never ask for or accept a `service_role` key.

## 2. Workflow — mini-actions

- Work in **small mini-actions: ONE feature or fix at a time.**
- Before editing, show me a short plan (files to touch, approach). Wait for my OK on anything non-trivial.
- Prefer small targeted diffs over rewrites. Never "improve" adjacent code you weren't asked to touch.
- After each mini-action: typecheck must pass, tell me exactly what to verify in the browser, then make **one git commit**.
- Commit format: `feat(scope): …`, `fix(scope): …`, `polish(scope): …`, `i18n(scope): …`, `test(scope): …` (matches existing history: `redesign(home): …`).
- If something breaks, we `git revert` — never patch forward blindly.
- Ask me before running anything that installs packages, touches the network, or modifies Supabase.

## 3. Verification checklist for UI work

- Test at 390px, 768px, 1280px.
- Test dark AND light theme (parchment — no black surfaces on light, no white cards on dark).
- Switch to हिन्दी and मराठी; check the longest strings for overflow.
- For chat changes: send a real message — dots pill → smooth stream-in → final Markdown render; regenerate works; scrolling up mid-stream shows the jump-to-bottom arrow without yanking.
- For birth-flow changes: re-saving unchanged data must NOT replay the casting ceremony or refetch charts.
- For Home changes: varga switching stays debounced (400ms); all 6 tabs keep their exact keys and labels (`home.tabs.*`) — never rename or remove tabs or table columns.

## 4. Key architecture notes

- Routes in `src/routes/` (TanStack Router file routes): index (landing), language, auth, onboarding.consent, onboarding.birth, home, chat, settings, reset-password, auth.callback, __root.
- Shell: `src/components/layout/AppShell.tsx` — logged-out header; signed-in icon rail (md+) + mobile bottom tabs; chat renders full-screen without the tab bar.
- Data: `src/lib/queries.ts` (useChart, usePlanets, cache controls), `birth-profile.ts`, `consent.ts`, `geocode.ts`, `charts.ts` (buildVargaTable). TanStack Query with stale-while-revalidate.
- Chat: SSE streaming from the `astrologer-chat` edge function with rAF-buffered flushes; buffered-invoke + typewriter fallback; conversations/messages in Supabase (`chat_conversations`, `chat_messages`).
- i18n: i18next, locales en/hi/mr in `src/i18n/locales/`.

## 5. Current backlog (in priority order — one mini-action each)

1. **Test safety net:** Vitest component tests + one Playwright journey (onboarding → chart → chat) before feature work.
2. **Live streaming Markdown** in chat (render Markdown during the stream instead of plain-text swap at the end) — UI-only; do not touch the SSE plumbing itself.
3. **Context chips in chat replies** ("✦ Saturn in 10th house") — needs my approval for the backend meta-event change first.
4. **"Today for you" daily insight** on Home — needs my approval for new edge function work.
5. Conversation rename/delete + timestamps in the chat sidebar.
6. Terms & Privacy pages, then wire the dormant landing-footer/consent links.
7. PWA: manifest + service worker (installable, offline shell).
8. Share/export: kundli as a rendered image.

Deferred ideas live at the bottom of design.md's spirit: no streaks, no notifications-pressure, no gamification — ever.
