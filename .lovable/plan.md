## AstroSaathi UI audit — mid-2026 lens

I looked at the landing, auth, and (via code) the /home hub, chat, onboarding, and shell. Below is an honest audit followed by the direction I'd commit to. Nothing is changed yet — this is the plan you approve.

### What's working

- Clear IA: shell + tabs on /home + dedicated chat route.
- Devanagari-first typography via Noto Sans Devanagari + DM Sans fallback is respectful and legible.
- Semantic token system in `styles.css` (oklch) is already in place — a real redesign is a token swap, not a rewrite.
- Chat reading column and table styling were recently hardened — that quality bar should propagate to the rest of the app.

### What's dating the app (honest critique)

1. **Generic "cream + indigo card on cream page" aesthetic.** The hero, auth, and how-it-works cards all sit on the same near-white background with the same soft indigo card — no hierarchy, no atmosphere. Reads as a 2021 template, not a 2026 spiritual product.
2. **No brand atmosphere.** Astrology is inherently celestial/nocturnal. The app is default-light with zero night sky, star field, gradient depth, or symbolic ornament. Users don't feel they've entered a distinct world.
3. **Typography is one-note.** DM Sans everywhere. No editorial serif or display face for hero/section titles, so nothing feels crafted. Devanagari headings and Latin headings share the same weight/scale — no rhythm.
4. **Flat cards, uniform radius, no depth.** Every surface is `rounded-2xl` + hairline border. No layered shadow, no glass, no gradient edge, no elevation vocabulary — so the eye can't tell primary from secondary.
5. **Mobile chrome is unremarkable.** The top bar is a plain sticky white strip with logo + language `<select>`. No bottom tab bar on mobile despite this being a mobile-first, tab-heavy app — users tab-switch by scrolling to a horizontal row.
6. **Auth screen looks like a form, not an entrance.** Tabs + email + password + Google, all default shadcn. First impression after "Get started" is a bureaucratic form on cream.
7. **Language switcher is a native `<select>`.** Fine for a11y, but visually the loudest control in the header on mobile. Should be a quiet icon-triggered popover with flag/script glyphs.
8. **Home hub tabs are text-only pills.** With 6+ sections (Kundli, Predictions/Chat, Numerology, Lo Shu, Doshas, Ashtakavarga…), text-only tabs overflow and don't scan. No icons, no active-state depth.
9. **Empty/loading/error states are utilitarian.** Skeletons and "Coming soon" text — no personality, no astrological motifs.
10. **A11y hygiene gaps.** Placeholder `<div className="h-8 w-24" aria-hidden />` in `LanguageSwitcher` prevents hydration flash but ships a 32px invisible block on every render; language `<select>` label is sr-only; icon-only controls in chat/home should be audited for `aria-label`.
11. **Dark mode exists in tokens but isn't a first-class experience.** No theme toggle in the shell; the "Celestial Dark" work in Numerology/Doshas hints at where the whole app should live.

### Direction I'd commit to for mid-2026

One sentence: **AstroSaathi should feel like a modern celestial instrument — dark-first, editorial, quietly luxurious — not a light SaaS dashboard.**

Concretely:

**A. Dark-first "night sky" as the default theme**

- Deep indigo/near-black background (`oklch(0.16 0.04 275)`), warm gold accent (already the accent token), muted lavender for secondary text.
- Subtle static star-field / mesh-gradient behind hero and auth (SVG, no motion cost).
- Light mode remains available via a header toggle (sun/moon), not the default.

**B. Editorial typography pairing**

- Display: **Cormorant Garamond** (already loaded!) for hero and section headings — currently unused. Latin headings get real serif elegance.
- Body: keep **DM Sans**.
- Devanagari: keep **Noto Sans Devanagari** for body, and **Noto Serif Devanagari** for headings so mr/hi get the same editorial rhythm as English.
- Tighten scale: hero 44–56px, section 28–32px, body 16/1.7, meta 13px uppercase tracked.

**C. Depth vocabulary (spatial UI, not flat cards)**

- Three surface tiers: `surface-1` (page), `surface-2` (card, +1% lightness + inner top highlight), `surface-3` (elevated / popover, soft outer glow in accent).
- Squircle radii: `rounded-3xl` for hero/cards, `rounded-full` for pills/CTAs.
- Layered shadow tokens (`--shadow-glow-gold`, `--shadow-soft-night`) instead of hairline borders everywhere.

**D. New app shell**

- Top: slim bar — brand mark left, theme toggle + language icon-popover + avatar right.
- Mobile: **bottom tab bar** with 4 anchors (Chart, Chat, Insights, Profile) — icons + label, safe-area padding, active pill in gold.
- Desktop: same anchors as left rail (icon + label), collapsible.
- Retire the "everything in one /home page with a tab strip" pattern for the top-level nav; keep tabs only inside Kundli/Insights.

**E. /home "My Chart" hub redesign**

- Hero row: user's name + today's date + a "sky snapshot" strip (current Nakshatra, Tithi, Moon sign) as a horizontally scrollable metric ribbon.
- Kundli card: large N-Indian chart, gold linework on dark, with a segmented varga selector below (chips, not dropdown).
- Sections become titled bands with editorial serif titles and a one-line dek, not stacked equal cards.

**F. Auth as an entrance, not a form**

- Split screen on desktop: left = celestial illustration + one-line promise in serif; right = single card with Google first (large), email collapsed behind "Use email instead".
- Mobile: same, illustration becomes a top 40vh banner.

**G. Chat polish (already 80% there)**

- Keep the reading column and table work.
- Add: quiet gold "thinking" shimmer instead of dots, message actions on hover (copy, regenerate), and an empty state with 3 real suggested prompts styled as gold-bordered chips.

**H. Motion budget**

- Respect `prefers-reduced-motion` (already in CSS).
- Micro-motion only: 200ms ease-out on tab change, 400ms fade+rise on section mount, subtle 8s parallax on the star field. No confetti, no scroll-jacking.

**I. Accessibility + polish pass**

- Replace native `<select>` language switcher with shadcn Popover + button (44×44 tap target, visible label, keyboard nav).
- Add real skip-link, single `<main>`, audit icon-only buttons for `aria-label`.
- Remove the invisible hydration placeholder in `LanguageSwitcher` — use `suppressHydrationWarning` on the label instead.
- Verify AA contrast on gold-on-dark for body copy (gold is accent only; body stays lavender-white).

### What this is NOT

- Not a rewrite. Routing, data layer, edge functions, and TanStack Query stay untouched.
- Not a re-skin of shadcn — we keep the primitives, restyle via tokens + a few new variants (`Button variant="premium"`, `Card variant="elevated"`).
- No new dependencies beyond fonts already loaded.

### Suggested build order (each is a separate approval)

1. **Foundations** — token refresh (dark-first palette, depth shadows, radii), font pairing wired, theme toggle in shell.
2. **Shell** — bottom tab bar (mobile) / left rail (desktop), language popover, avatar menu.
3. **Auth + Landing** — celestial split layout, Google-first, serif hero.
4. **/home hub** — hero ribbon, kundli hero card, editorial section bands.
5. **Polish pass** — chat empty state + message actions, loading/empty state personality, a11y sweep.

I'd start with **step 1 only** so you can see the new atmosphere applied to the existing screens before we touch layout. Want me to proceed with foundations, or reshuffle the order?
