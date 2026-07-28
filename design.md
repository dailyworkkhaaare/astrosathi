# AstroSaathi — Design System (v2, post-redesign)

This is the single source of truth for AstroSaathi's visual and experiential design.
Status: the full 8-screen redesign described here is IMPLEMENTED in code (July 2026).
Any new screen, feature, or edit must follow this document exactly.

---

## 1. Brand essence

- Product: AstroSaathi — an AI Vedic astrology companion. USP: **"Chat with your Kundli"** — an AI chat personalized by the user's real birth chart (planets, houses, nakshatras, dashas, yogas, divisional charts).
- North star feeling: *"This feels like I have a personal AI astrologer that genuinely understands me."*
- Personality: a wise, calm astrologer by lamplight — intimate, warm, unhurried, premium. Never flashy, never "AI-generated look", never gamified.
- Visual language: **"Celestial Instrument"** — precise engraved 1.5px gold linework (Jantar Mantar instruments, star maps, astrolabes), not cartoon zodiac art.
- Ethical design: no streaks, no red urgency dots, no dark patterns, no fear-based astrology framing. Disclaimers stay visible ("For reflection — not medical, legal, or financial advice").

## 2. Color system (tokens only — never hardcoded hex in UI code)

### Dark theme (default) — "night observatory"
| Role | Token | Reference hex |
|---|---|---|
| Background | `bg-background` | #151732 night indigo |
| Card / surface | `bg-card` | #1E2040 |
| Elevated / popover | `bg-popover` | #262950 |
| Border hairline | `border-border` | #34365A |
| Foreground text | `text-foreground` | #FBF4E4 ivory |
| Muted text | `text-muted-foreground` | #D4D2E3 |
| Primary / accent (gold) | `primary` / `accent` | #E7B85C |
| Deep gold (pressed) | — | #C9A227 |
| Destructive / caution | `destructive` | #D99A3D **amber — never red** |
| Affirmative | — | #7FA97A sage |

### Light theme — "parchment"
- Background #FDFAF2 parchment, ink #2A2B45, same gold. All surfaces via the same tokens; never pure white cards on dark, never black surfaces on light.

### Laws
- **Red ban:** no red anywhere (no `text-red-*`, `bg-red-*`). Caution/destructive = amber token.
- **One gold glow per screen at rest** (`--shadow-glow-gold`). Allowed rest-state glows: primary CTA button, chat send button, Home chat-invitation card, casting-ceremony glow. Hover glows are transient and allowed.
- Gold is an accent, not a fill: gold washes at 5–10% opacity (`bg-accent/[0.05]`, `bg-accent/10`), rings at 20–40% (`ring-accent/20`, `border-accent/60` when selected).
- Google logo SVG keeps its official brand hex colors (exempt from token rule).

## 3. Typography

- Display serif: **Cormorant Garamond** (`font-display`) — page-level H1/H2 and deliberate serif moments only (greeting, nakshatra name, settings about-block, brand wordmark, avatar initial). Never on body copy or small card titles.
- UI sans: **DM Sans** — everything else. Small card/section titles are sans `text-base font-semibold` (NOT serif).
- Devanagari: **Noto Sans Devanagari** for hi/mr.
- H1 recipe: `font-display text-3xl md:text-4xl font-semibold tracking-tight`.
- Chat message body: **16px** (`text-base leading-relaxed`). Never smaller for conversation text.
- Micro-labels: `text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground`.

## 4. Shape, spacing, elevation

- Radius: 12px base (`rounded-xl`); cards `rounded-xl`/`rounded-2xl`; composer & user bubbles `rounded-3xl`; pills `rounded-full`.
- Shadows: `--shadow-soft` for cards, `--shadow-glow-gold` only per the one-glow law.
- Tap targets: **min 44px** (`min-h-11`) on every interactive element; visible `focus-visible:ring-2 ring-ring` everywhere.

## 5. Iconography & illustration

- Icons: **lucide-react only.** No Material Symbols, no emoji icons, no `<img>` icons.
- Brand: `BrandMark` component (gold constellation sigil). The AI has **no avatar in chat** — its presence is the typography itself ("sigil, not face").
- Illustration: engraved 1.5px gold line-work SVGs (constellations, chart wheels). One radial glow max.

## 6. Motion

- Tokens: `--motion-micro: 140ms`, `--motion-standard: 220ms`, `--motion-spatial: 320ms`, `--ease-standard`.
- Entry: `motion-fade-up` with 60ms stagger on lists. Press: `tap-press`.
- Ceremonial moments (rare, earned): the **casting-your-chart interstitial** after birth-data save — full-screen, constellation draw-in ~1200ms via stroke-dasharray, total ~1800ms, then navigate. Only plays when birth data actually changed.
- Always respect `prefers-reduced-motion` (static fallback, no bouncing dots).

## 7. Component recipes (as implemented)

- **Segmented pill control:** track `rounded-full bg-muted p-0.5 border`, selected item `bg-background shadow-sm`.
- **Chip tabs (Home):** pill buttons; active `border-primary/60 bg-primary/10 text-primary`; roving tabIndex + ArrowLeft/Right preserved.
- **Custom checkbox:** `appearance-none h-6 w-6 rounded-md border border-input bg-background`, checked `bg-primary border-primary` + overlaid Check icon (`pointer-events-none`).
- **Selected/consent card:** unchecked `bg-card border-border rounded-xl px-4 py-4`; checked `border-accent/60 bg-accent/[0.06]`.
- **Chat-invitation hero card (Home):** `rounded-2xl border-accent/30 bg-accent/[0.05] p-5` + Sparkles + serif title.
- **User chat bubble:** `max-w-[85%] rounded-3xl rounded-tr-lg bg-accent/10 ring-1 ring-accent/20 px-4 py-3 text-base`.
- **Assistant reply:** **manuscript style** — plain 16px ivory text directly on the background. No bubble, no avatar, no star column. Quiet ghost icon actions below (visible on mobile, hover-revealed on md+).
- **Typing state:** three tiny gold bouncing dots in a subtle pill + italic muted "Consulting your chart…" (`chat.typing`).
- **Composer:** `rounded-3xl border-border/70 bg-card/80 p-2 backdrop-blur-xl`, muted plus icon, circular gold send button (ArrowUp icon) — the screen's one glow.
- **Kundli chart (provider SVG):** never parse/modify the SVG string. Style via CSS wrapper only: container `mx-auto w-full max-w-md overflow-hidden rounded-lg border border-border bg-background p-2`; selectors `[&_svg]:block [&_svg]:h-auto [&_svg]:w-full [&_svg_line]:stroke-primary [&_svg_path]:stroke-primary [&_svg_rect]:stroke-primary [&_svg_polygon]:stroke-primary [&_svg_text]:fill-foreground`.
- **Planets data (Home):** one responsive card grid at every breakpoint — no separate desktop table. `grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3`; cards `rounded-xl border-border bg-background p-4 hover:border-accent/30` with uppercase 11px mini-labels — same fields/data as before, nothing dropped.
- **Onboarding shell:** flat (no glass panel, no nebula) — `max-w-xl`, StepIndicator, eyebrow → serif H1 → subtitle → content.

## 8. Screen inventory (all implemented)

1. **Landing** — hero with Starfield, step cards (number top-right, gold icon circle top-left), trust strip on card surface, minimal © footer (no links until legal pages exist).
2. **Language** — Stitch language-selection design.
3. **Auth** — mobile starfield hero band, pill tabs, `auth.privacyNote` line, Google button with official logo colors.
4. **Consent** — flattened shell, custom-checkbox consent cards, gold disclosure card.
5. **Birth details** — no card wrapper, date+time 2-col grid, gender pills ("prefer not to say" muted, not gold), place search with MapPin dropdown, ShieldCheck privacy line → **casting ceremony** interstitial (only when data changed).
6. **Home** — greeting + serif H1, chat-invitation hero card, 6 chip tabs (charts/details/doshas/ashtakavarga/numerology/loshu — never rename), chart card with varga select in the title row, unified planets card grid, 12-house grid (`grid-cols-2 gap-3 sm:grid-cols-3`), centered serif nakshatra card. All four cards (chart, planets, houses, nakshatra) stack full-width at every breakpoint — no side-by-side split; each stays proportioned to its own content instead of stretching to match a sibling's height.
7. **Settings** — rashi-glyph avatar, responsive rows, segmented pills, centered italic serif about, amber delete.
8. **Chat** — the hero screen. Slim top bar, manuscript replies, user bubbles, empty state (sigil in gold ring, serif namaste, mid-screen composer, "✦ TRY ASKING" suggestion cards), 280px history sidebar (secondary New chat, search, TODAY/YESTERDAY/PREVIOUS 7 DAYS groups, gold-washed active pill; drawer on mobile). No plans/user footer in the sidebar.
- **App shell:** logged-out header only; signed-in gets icon-only rail `w-20` on md+ with BrandMark on top; mobile bottom tab bar (chat is full-screen immersive, no tab bar).

## 9. Internationalization

- Languages: English (en), हिन्दी (hi), मराठी (mr). **Every user-facing string goes through `t()`** with keys in all three locale files. No hardcoded UI text ever.
- Sanskrit/astrological terms stay transliterated in all languages (Mahadasha, Antardasha, Pratyantardasha, Mangal Dosha, Kaal Sarp, Sade Sati, bindus, Kua, Lo Shu, nakshatra names).
- Tone: warm, respectful, plain-spoken; never fear-based.
- Always test the longest hi/mr strings for overflow at 390px.

## 10. Accessibility floor

- WCAG AA contrast on both themes; 44px tap targets; visible focus rings; aria-labels on icon-only buttons; `role="log" aria-live="polite"` chat stream; keyboard-complete tabs (roving tabIndex + arrow keys); `prefers-reduced-motion` respected; sr-only labels on visual-only controls (e.g. varga select).
