# AstroSaathi 3.0 — Design Token System

**Action:** 1.5 — Define the design tokens  
**Status:** Approved 8 September 2026  
**Created:** 8 September 2026  
**Type:** Design specification only  
**Implementation authorization:** None  
**Approved visual blend:** 70% Midnight Rasa + 20% Dawn warmth/readability + 10% Prism precision  
**Companion documents:** [Design north star](./ASTROSAATHI_COSMIC_ATELIER_NORTH_STAR.md), [future information architecture](./ASTROSAATHI_FUTURE_INFORMATION_ARCHITECTURE.md), [content and ethical language](./ASTROSAATHI_CONTENT_AND_ETHICAL_LANGUAGE_SYSTEM.md), [current UI baseline](./ASTROSAATHI_CURRENT_UI_BASELINE.md)

---

## 1. Purpose

This document converts the approved Cosmic Atelier direction into a production-ready token language. It defines the primitives and semantic decisions from which every future AstroSaathi screen will be composed: colour, gradients, typography, spacing, shape, borders, elevation, glass, motion, responsive layout and accessibility modes.

The visual promise is:

> **Cinematic at first glance, calm while reading, playful while exploring, exact when evidence matters.**

Tokens are not decoration names. A token must explain what a value means, where it can appear and how it behaves across theme, language, accessibility and screen size.

---

## 2. Boundary

This action does **not**:

- Edit `src/styles.css`, Tailwind theme mappings or any component.
- Load, self-host or license a font.
- Replace existing utilities or migrate existing screens.
- Change app behavior, routes, calculation visuals or backend contracts.
- Approve unique component anatomy; that belongs to Action 1.6.
- Claim contrast conformance from token values alone; final rendered combinations must be measured in browsers.

The values below are the approved design target if this action passes review. Their later implementation remains separately gated.

---

## 3. Understanding lock

### 3.1 Confirmed intent

1. Midnight Rasa is the dominant emotional and brand identity.
2. Dawn is an independently art-directed light appearance, not an inverted dark theme.
3. Prism is restricted to technical, live and provenance moments.
4. Gradients carry product meaning; every screen receives at most one dominant atmospheric event.
5. Reading and calculated evidence use solid surfaces. Glass belongs to navigation, selectors and transient controls.
6. English, Hindi and Marathi must retain equal hierarchy and legibility.
7. The system must feel playful through response, shape and light—not through clutter.

The user's prior approval of the North Star blend and instruction to start the next gated action are treated as confirmation of this understanding.

### 3.2 Assumptions

- Mobile is the primary design baseline, beginning at 320 CSS pixels.
- Dark mode is the signature presentation; light mode is preferred for extended reading in bright environments.
- CSS OKLCH remains the canonical implementation colour format because the current project already uses it.
- A limited sRGB-safe core is more valuable than uncontrolled wide-gamut spectacle.
- AstroSaathi can adopt new open-source typefaces later if licensing, payload and Devanagari rendering pass validation.
- The current Tailwind 4 semantic-token architecture can be extended instead of replaced.
- Motion and blur must degrade gracefully on mid-range mobile hardware.

### 3.3 Non-functional requirements

- **Performance:** critical UI renders without image, shader or web-font completion; expensive effects are bounded and lazy.
- **Scale:** semantic tokens support all five worlds, all existing routes and future modules without per-screen colour invention.
- **Privacy/security:** decorative assets contain no chart, name or journal data; theme values never reveal user context.
- **Reliability:** forced colours, reduced motion/transparency and font fallback remain usable.
- **Maintenance:** primitive values are private implementation detail; components consume semantic or component aliases.
- **Ownership:** design owns primitives/semantics; engineering owns platform mapping and validation; accessibility signs off rendered pairs.

### 3.4 Open questions deferred to implementation validation

- Final font file subsets and delivery strategy.
- Browser-specific OKLCH gamut clipping and P3 enhancement eligibility.
- Exact glass blur cost on target Android devices.
- Optical Devanagari size corrections after native-language prototype review.

None changes the proposed token architecture.

---

## 4. Token strategies considered

### A — Extend the current generic semantic palette

Keep `primary`, `secondary`, `muted`, `accent` and add a few gradients. This has the lowest migration cost, but it cannot encode subject, time, evidence, atmosphere and safety clearly. It also encourages unrelated screens to reuse the same purple/gold recipe.

**Decision:** retain these names only as temporary compatibility aliases during migration.

### B — Three-layer semantic token architecture

Use private primitives, public semantic roles and narrowly scoped component aliases. Themes remap semantic roles without making components theme-aware.

**Decision:** recommended. It provides expressive range while making misuse reviewable.

### C — Per-world independent themes

Give Today, My Cosmos, Ask, Journey and Connections their own full palettes. This would look dramatic in mockups but multiply contrast work, fragment the brand and create long-term maintenance debt.

**Decision:** reject. Worlds receive one signature accent/gradient, not five unrelated systems.

---

## 5. Token architecture and naming

### 5.1 Three layers

```text
Primitive value
  night.950 = oklch(0.135 0.035 286)
        ↓
Semantic role
  surface.canvas = night.950 in Midnight / dawn.50 in Dawn
        ↓
Component alias only when necessary
  nav.surface = surface.glass
```

### 5.2 Naming grammar

```text
--as-{category}-{role}-{state?}
```

Examples:

- `--as-color-text-primary`
- `--as-color-surface-raised`
- `--as-gradient-aurora-live`
- `--as-space-6`
- `--as-radius-panel`
- `--as-duration-standard`

### 5.3 Governance rules

- Components never consume a raw hex or OKLCH literal.
- Primitive palette names never appear in product-component code.
- Theme switching changes semantic mappings, not component variants.
- New primitives require a demonstrated missing role, not aesthetic preference.
- Component aliases are permitted only when a reusable component needs a stable exception.
- State meaning is never encoded by colour alone.

---

## 6. Colour foundations

OKLCH values below are canonical targets. Hex values are approximate communication fallbacks and must not become a second source of truth.

### 6.1 Midnight family

| Primitive | OKLCH | Approximate character | Role |
|---|---|---|---|
| `night-1000` | `oklch(0.095 0.026 286)` | Near-black aubergine | Maximum cinematic depth |
| `night-950` | `oklch(0.135 0.035 286)` | Obsidian violet | Dark canvas |
| `night-900` | `oklch(0.165 0.042 284)` | Midnight ink | Canvas variation |
| `night-850` | `oklch(0.190 0.045 283)` | Deep indigo | Reading surface |
| `night-800` | `oklch(0.225 0.050 282)` | Raised indigo | Raised surface |
| `night-700` | `oklch(0.285 0.060 281)` | Twilight | Interactive surface |
| `night-500` | `oklch(0.460 0.075 281)` | Misty indigo | Disabled/decorative |
| `night-300` | `oklch(0.700 0.040 282)` | Lavender mist | Secondary dark text |
| `night-150` | `oklch(0.865 0.022 282)` | Pale lavender | Muted light text |
| `night-50` | `oklch(0.965 0.012 85)` | Moon ivory | Primary dark text |

### 6.2 Dawn family

| Primitive | OKLCH | Character | Role |
|---|---|---|---|
| `dawn-0` | `oklch(1 0 0)` | Pure white | Highest raised surface only |
| `dawn-25` | `oklch(0.992 0.006 85)` | Moon paper | Cards and reading |
| `dawn-50` | `oklch(0.976 0.014 83)` | Luminous ivory | Light canvas |
| `dawn-100` | `oklch(0.950 0.022 81)` | Warm vellum | Subtle surface |
| `dawn-200` | `oklch(0.905 0.032 78)` | Parchment edge | Borders/selection |
| `dawn-300` | `oklch(0.830 0.045 74)` | Sand glow | Decorative warmth |
| `ink-700` | `oklch(0.490 0.030 278)` | Quiet plum | Tertiary readable text |
| `ink-800` | `oklch(0.400 0.035 278)` | Deep plum | Secondary text |
| `ink-950` | `oklch(0.205 0.045 282)` | Aubergine ink | Primary text |

### 6.3 Brand and expressive families

| Family / step | OKLCH | Intended use |
|---|---|---|
| `aurora-cobalt-600` | `oklch(0.510 0.205 268)` | Intelligence anchor, links on light |
| `aurora-cobalt-450` | `oklch(0.640 0.190 265)` | Dark-mode AI edge/light |
| `aurora-violet-600` | `oklch(0.500 0.220 300)` | Deep exploration |
| `aurora-violet-450` | `oklch(0.655 0.205 304)` | Live Aurora highlight |
| `solar-saffron-600` | `oklch(0.690 0.155 70)` | Light-mode action edge/text |
| `solar-saffron-450` | `oklch(0.790 0.150 76)` | Dark-mode action/revelation |
| `rasa-rose-550` | `oklch(0.650 0.180 8)` | Human warmth/relationship A |
| `rasa-rose-400` | `oklch(0.760 0.130 12)` | Dark-mode warm light |
| `prism-cyan-550` | `oklch(0.660 0.115 220)` | Technical/live precision |
| `prism-cyan-400` | `oklch(0.780 0.095 215)` | Dark technical edge |

The brand system uses cobalt/violet for intelligence, saffron for revelation/action, rose for human warmth and cyan only for technical precision. Cyan never becomes the general primary action colour.

### 6.4 Feedback families

Feedback is distinct from astrological meaning.

| Semantic family | Light strong | Dark strong | Use |
|---|---|---|---|
| Success | `oklch(0.48 0.13 155)` | `oklch(0.76 0.12 155)` | Completed/saved/healthy system state |
| Warning | `oklch(0.59 0.14 68)` | `oklch(0.82 0.13 76)` | Recoverable caution or partial data |
| Danger | `oklch(0.52 0.20 25)` | `oklch(0.72 0.16 25)` | Destructive action or serious error |
| Information | `oklch(0.48 0.15 255)` | `oklch(0.75 0.12 245)` | Neutral system information |

Hard rule: difficult astrological periods and doshas do **not** use Danger red. Danger means a real product consequence, error or safety concern—not “inauspicious.”

### 6.5 Semantic mapping: Dawn/light

| Semantic token | Mapping |
|---|---|
| `surface-canvas` | `dawn-50` |
| `surface-subtle` | `dawn-100` |
| `surface-reading` | `dawn-25` |
| `surface-raised` | `dawn-0` |
| `surface-inverse` | `night-950` |
| `text-primary` | `ink-950` |
| `text-secondary` | `ink-800` |
| `text-tertiary` | `ink-700` |
| `text-on-inverse` | `night-50` |
| `border-subtle` | `oklch(0.875 0.026 80 / 0.72)` |
| `border-strong` | `oklch(0.710 0.050 282 / 0.66)` |
| `action-primary` | `oklch(0.430 0.170 282)` |
| `action-primary-text` | `night-50` |
| `action-warm` | `solar-saffron-450` |
| `action-warm-text` | `ink-950` |
| `focus-inner` | `dawn-0` |
| `focus-outer` | `aurora-cobalt-600` |

### 6.6 Semantic mapping: Midnight/dark

| Semantic token | Mapping |
|---|---|
| `surface-canvas` | `night-950` |
| `surface-subtle` | `night-900` |
| `surface-reading` | `night-850` |
| `surface-raised` | `night-800` |
| `surface-inverse` | `dawn-25` |
| `text-primary` | `night-50` |
| `text-secondary` | `night-150` |
| `text-tertiary` | `night-300` |
| `text-on-inverse` | `ink-950` |
| `border-subtle` | `oklch(0.965 0.012 85 / 0.10)` |
| `border-strong` | `oklch(0.865 0.022 282 / 0.28)` |
| `action-primary` | `solar-saffron-450` |
| `action-primary-text` | `ink-950` |
| `action-intelligence` | `aurora-violet-450` |
| `focus-inner` | `night-950` |
| `focus-outer` | `solar-saffron-450` |

### 6.7 Contrast targets

Token design targets:

- Normal text: at least 4.5:1.
- Large text: at least 3:1.
- Essential icons, component boundaries and state indicators: at least 3:1.
- Primary long-form text target: at least 7:1 where feasible.
- Keyboard focus: a solid dual-ring treatment whose qualifying region reaches at least 3:1 against adjacent colours.

The proposed primary pairs were mathematically checked from their OKLCH values before implementation: primary text/canvas exceeds 16:1 in both themes; secondary text exceeds 8:1; tertiary text exceeds 5.8:1; light text on indigo action exceeds 8:1; ink on saffron exceeds 9:1. These calculations are design checks, not substitutes for rendered browser QA.

WCAG 2.2 requires at least 4.5:1 for ordinary text and 3:1 for large text; it also requires target sizing/spacing and visible focus. See [W3C contrast guidance](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum), [target-size guidance](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum) and [focus appearance guidance](https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance).

---

## 7. Semantic gradient system

Gradients are named for meaning, never by colour.

### 7.1 Gradient recipes

| Token | Recipe | Meaning/use |
|---|---|---|
| `gradient-atmosphere-midnight` | Radial cobalt at 16% 0%, violet at 86% 18%, fading into `night-950` by 68% | Signature dark shell/hero |
| `gradient-atmosphere-dawn` | Radial saffron wash at 82% -10%, rose at 8% 4%, fading into `dawn-50` by 64% | Signature light shell/hero |
| `gradient-solar-reveal` | 118° saffron → warm rose → transparent gold | Action, clarity, revealed insight |
| `gradient-lunar-reflection` | 145° pale lavender → moon ivory → mist blue | Journal/reflection; quiet only |
| `gradient-aurora-live` | 112° cobalt → violet → rose with one moving highlight | AI activity/personal synthesis |
| `gradient-relationship` | 105° subject-A rose → shared violet → subject-B cobalt | Two subjects/shared field |
| `gradient-time` | 90° muted lavender → saffron present marker → cobalt future edge | Past/present/future orientation |
| `gradient-prism-edge` | 90° transparent → cyan → violet → transparent | Technical/provenance boundary only |
| `gradient-scrim-dark` | 180° transparent → `night-1000 / 0.86` | Text protection over art |
| `gradient-scrim-light` | 180° transparent → `dawn-25 / 0.94` | Text protection over light art |

### 7.2 Gradient rules

- One dominant atmosphere per screen.
- Never put body text directly on an uncontrolled multicolour gradient.
- Buttons use a solid action colour by default; gradient buttons are reserved for one primary ceremonial action.
- Gradient does not encode success, danger or selected state without shape/text/icon support.
- Relationship endpoints always have explicit subject labels.
- Market direction never uses the brand Aurora gradient; use accessible chart encodings.
- Animated gradients pause after their bounded purpose or on loss of focus/visibility.

### 7.3 Grain and texture

- `texture-grain-opacity`: 0.018 Dawn / 0.028 Midnight.
- `texture-paper-opacity`: maximum 0.035 on reflective/reading panels.
- Texture is monochrome, non-semantic and cannot reduce text contrast.
- Disable texture under increased-contrast, forced-colours or reduced-transparency modes.

---

## 8. Typography

### 8.1 Approved type families

| Role | Latin | Devanagari | Rationale |
|---|---|---|---|
| Display | **Fraunces Variable** | **Noto Serif Devanagari** | Fraunces adds premium editorial warmth and controlled play; Noto Serif preserves mature Devanagari shaping. |
| Interface/body | **DM Sans Variable** | **Noto Sans Devanagari** | Clear, contemporary and compact for chat, controls and dense reports. |
| Numeric/data | DM Sans with lining + tabular numerals | Noto Sans Devanagari, tabular support verified per build | Keeps degrees, dates, houses and tables aligned. |
| Annotation | SVG/vector marks only | SVG/vector marks only | Avoids a novelty third font and translation problems. |

Fraunces replaces Cormorant Garamond as the proposed Latin display face because it supports a more distinctive 2026 editorial personality without sacrificing warmth. This replacement is not implemented by this document.

### 8.2 Font axes and style policy

- Fraunces: optical size active; weights 500–700; Softness/Wonkiness used only in hero or celebratory titles.
- DM Sans: weights 400, 500, 600 and 700; optical size if available.
- Body text never uses italic as the only cue.
- Display face never appears below 20px or in dense tables/forms.
- Technical labels and code-like data stay in the interface family; no monospace unless displaying literal machine identifiers.
- Maximum two font families visible in a screen region.

### 8.3 Type-size tokens

| Token | Size | Line height | Default use |
|---|---:|---:|---|
| `text-micro` | 11px | 16px | Nonessential metadata only; never primary action/meaning |
| `text-caption` | 12px | 17px | Timestamps, provenance metadata |
| `text-label` | 13px | 18px | Chips, compact controls |
| `text-body-sm` | 14px | 21px | Secondary descriptions |
| `text-body` | 16px | 25px | Default reading and chat |
| `text-body-lg` | 18px | 29px | Lead insight copy |
| `text-title-sm` | 20px | 26px | Card/section title |
| `text-title-md` | `clamp(24px, 2.3vw, 30px)` | 1.18 | Page section/compact page title |
| `text-title-lg` | `clamp(32px, 4.2vw, 52px)` | 1.06 | World/page hero title |
| `text-display` | `clamp(44px, 7vw, 84px)` | 0.98 | Rare marketing/ceremonial statement |
| `text-numeric-hero` | `clamp(48px, 8vw, 96px)` | 0.9 | Date/score/house number with adjacent label |

### 8.4 Tracking tokens

- `tracking-display`: `-0.025em` Latin only.
- `tracking-title`: `-0.015em` Latin only.
- `tracking-body`: `0`.
- `tracking-label`: `0.01em`; uppercase Latin labels may use `0.06em` sparingly.
- Hindi/Marathi/Devanagari: no negative tracking and no forced uppercase analogue.

### 8.5 Line length and rhythm

- Long-form reading measure: 58–72 Latin characters.
- Hindi/Marathi: validate at 36–56 Devanagari characters as a starting range, then adjust optically.
- Chat answer measure: maximum 68ch desktop; near full-width mobile with 16px minimum side padding.
- Paragraph gap: `space-4` for ordinary reading, `space-5` in reflective/editorial surfaces.
- Display headings use balanced wrapping only when it does not create a one-word final line in any supported language.

### 8.6 Font loading requirements

- Use WOFF2 and only approved weights/axes.
- Subset by script without breaking Devanagari conjunct coverage.
- `font-display: swap` or a measured optional strategy; critical content must never wait for a web font.
- Define metric-compatible fallbacks to reduce layout shift.
- Test English/Hindi/Marathi mixed-script strings, numerals, Sanskrit passages and punctuation.
- Font licensing and redistribution terms must be archived before self-hosting.

---

## 9. Spacing and density

### 9.1 Primitive scale

The system uses a 4px rhythm with 2px optical exceptions.

| Token | Value | Typical role |
|---|---:|---|
| `space-0` | 0 | Reset |
| `space-0.5` | 2px | Optical alignment only |
| `space-1` | 4px | Tight icon/text correction |
| `space-1.5` | 6px | Compact chip interior |
| `space-2` | 8px | Inline gap |
| `space-3` | 12px | Compact control gap |
| `space-4` | 16px | Mobile base gutter/card interior minimum |
| `space-5` | 20px | Comfortable group gap |
| `space-6` | 24px | Default card interior |
| `space-8` | 32px | Section group |
| `space-10` | 40px | Large section gap |
| `space-12` | 48px | Page-section transition |
| `space-16` | 64px | Desktop major section |
| `space-20` | 80px | Editorial breathing room |
| `space-24` | 96px | Hero separation |
| `space-32` | 128px | Rare wide-screen ceremony |

### 9.2 Density modes

- **Comfortable:** default for consumer screens, Ask and Journey.
- **Compact:** only for technical tables, ephemeris-like data and dense chart controls.
- Compact mode reduces internal spacing one step; it never reduces body text below 14px or touch target below 44px.
- No global user density setting is proposed yet; this is a component/context rule.

### 9.3 Alignment rules

- Visible content aligns to the layout grid, but celestial decoration may break it.
- Nested surfaces reduce padding by one step, never more than two.
- A card with only one sentence should not receive 32px padding merely to look premium.
- Vertical rhythm is more important than equal-height bento cards.

---

## 10. Shape and radii

### 10.1 Primitive radii

| Token | Value | Role |
|---|---:|---|
| `radius-none` | 0 | Data grid seams |
| `radius-xs` | 6px | Tiny badge/technical marker |
| `radius-sm` | 10px | Inputs inside dense technical UI |
| `radius-md` | 14px | Standard buttons/inputs |
| `radius-lg` | 18px | Compact cards/popovers |
| `radius-xl` | 24px | Primary cards/sheets |
| `radius-2xl` | 32px | Hero panels/large modals |
| `radius-orbit` | 999px | Pills, avatars and circular/orbital controls |

### 10.2 Semantic aliases

- `radius-control`: 14px.
- `radius-card`: 24px.
- `radius-card-nested`: 16px.
- `radius-sheet`: 28px top corners on compact screens; 32px all corners when floating.
- `radius-dialog`: 28px.
- `radius-technical`: 12px.
- `radius-pill`: 999px.

### 10.3 Expressive corner policy

Not every object is rounded equally. Hero/ceremonial containers may use one of three pre-authored asymmetric corner sets, each based on the radius scale. Arbitrary blob border-radius values are prohibited.

- **Solar:** larger upper-right/lower-left radii; forward and revealing.
- **Lunar:** larger upper-left/lower-right radii; reflective and held.
- **Orbit:** pill/circular geometry for selectors and moving context.

Shape never carries status alone, and long text still sits in stable rectangular reading geometry.

---

## 11. Borders, dividers and focus

### 11.1 Stroke tokens

- `stroke-hairline`: 1px; standard dividers and surface boundaries.
- `stroke-selected`: 1.5px where subpixel rendering is stable, otherwise 2px.
- `stroke-focus`: 2px solid outer ring plus 2px offset/inner separation.
- `stroke-technical`: 1px with Prism colour used only for active technical provenance.

### 11.2 Focus token

Use a dual-tone focus ring:

```text
2px solid focus-outer
2px offset using focus-inner
```

This remains visible over gradients and both themes. Glow may decorate focus but can never be the only indicator.

### 11.3 Divider policy

- Prefer space and surface change to repeated borders.
- Dense tables may use hairline dividers.
- Gold borders are not a default premium treatment.
- Dashed borders mean incomplete/drop/attach affordance, not mystical uncertainty.

---

## 12. Elevation and material

### 12.1 Elevation layers

| Token | Intended layer | Dawn shadow character | Midnight shadow character |
|---|---|---|---|
| `elevation-0` | Canvas/inset | None | None |
| `elevation-1` | Reading/card | 1px highlight + short plum ambient | 1px pale inset + subtle black depth |
| `elevation-2` | Raised card/menu | 12–28px soft plum shadow | 18–36px black shadow |
| `elevation-3` | Floating nav/composer | 24–48px layered shadow | 24–56px black + faint violet ambient |
| `elevation-4` | Modal/sheet | 36–72px soft shadow + scrim | 36–80px deep shadow + scrim |
| `elevation-glow` | Active/live accent | Local colour glow only | Local colour glow only |

Exact shadow recipes map to colour tokens and use multiple low-opacity layers, never a single opaque black blur.

### 12.2 Material tiers

1. **Atmosphere:** canvas gradient, optional grain, decorative only.
2. **Truth surface:** opaque or ≥96% visually opaque reading/data surface.
3. **Control glass:** navigation, subject/time lenses, composer and transient overlays.
4. **Live edge:** a restrained Aurora/Prism boundary for current generation or live evidence.

### 12.3 Glass tokens

| Token | Compact/mobile | Expanded/desktop | Fallback |
|---|---|---|---|
| `glass-control-fill` | Theme surface at 82–90% opacity | 76–86% | Opaque `surface-raised` |
| `glass-control-blur` | 16px | 20px | 0 |
| `glass-control-saturate` | 115% | 120% | 100% |
| `glass-border` | `border-strong` at controlled alpha | Same | Solid `border-strong` |

No glass behind paragraphs, charts, tables, warnings or form error text. Under reduced transparency, data saver, unsupported backdrop filtering or measured frame drops, glass becomes solid automatically.

### 12.4 Scrims

- Modal scrim Dawn: plum/indigo at 36–48%.
- Modal scrim Midnight: near-black at 58–68%.
- Scrims must not obscure the focused dialog boundary.
- Only one scrim layer may be active; nested modals are a component-design failure.

---

## 13. Motion

### 13.1 Duration tokens

| Token | Value | Use |
|---|---:|---|
| `duration-instant` | 0ms | Reduced-motion state swaps |
| `duration-press` | 110ms | Press compression/release |
| `duration-micro` | 160ms | Hover, icon, chip, colour |
| `duration-quick` | 220ms | Tooltip, popover, local disclosure |
| `duration-standard` | 300ms | Card/state transition |
| `duration-spatial` | 420ms | Sheet, world or context movement |
| `duration-ceremonial` | 1400ms | One earned reveal |
| `duration-ambient` | 4800ms | One bounded breathing cycle |

### 13.2 Easing tokens

- `ease-standard`: `cubic-bezier(0.22, 1, 0.36, 1)` — entering/morphing.
- `ease-exit`: `cubic-bezier(0.4, 0, 1, 1)` — elements leaving.
- `ease-emphasized`: `cubic-bezier(0.16, 1, 0.3, 1)` — meaningful spatial transition.
- `ease-spring-soft`: platform spring target approximately mass 1, stiffness 260, damping 26; CSS fallback uses `ease-standard`.
- `ease-linear`: progress only, never spatial interface movement.

### 13.3 Motion distances

- Press scale: minimum 0.97; never below 0.96.
- Local reveal translate: 4–8px.
- Sheet travel: follows the sheet's real edge, maximum its own dimension.
- World crossfade/slide: 12–24px, not full-screen carousel travel.
- Parallax: prohibited behind reading; optional 2–6px pointer response on a decorative desktop hero only.

### 13.4 Motion budget

- At most one ambient animation visible per viewport.
- Ceremonial motion occurs once per earned event and never on routine navigation.
- No essential information appears only after animation.
- Pause ambient work when the document is hidden or the effect leaves the viewport.
- Prefer transform and opacity; measure blur/filter/gradient animation before use.
- No flashing or rapid luminance oscillation.

### 13.5 Reduced motion

When `prefers-reduced-motion: reduce` is active:

- Spatial translation, parallax, orbiting, particles and looping glow stop.
- State change is immediate or uses a ≤120ms opacity transition only if comfortable.
- Chart drawing renders in its completed state.
- AI activity uses a static high-contrast status plus text.
- Success is communicated with icon/text, never bounce/confetti.

---

## 14. Responsive layout tokens

### 14.1 Breakpoints

| Token | Minimum width | Design intent |
|---|---:|---|
| `bp-base` | 0 | Single-column compact baseline |
| `bp-sm` | 30rem / 480px | Large phone/small split opportunities |
| `bp-md` | 48rem / 768px | Tablet, rail/sheet changes |
| `bp-lg` | 64rem / 1024px | Desktop navigation and 12-column layouts |
| `bp-xl` | 80rem / 1280px | Expanded editorial composition |
| `bp-2xl` | 96rem / 1536px | Wide whitespace; content does not stretch indefinitely |

320px is a required validation width, not a breakpoint.

### 14.2 Grid

| Range | Columns | Gutter | Outer margin |
|---|---:|---:|---:|
| Base–479px | 4 | 12px | 16px |
| 480–767px | 4 | 16px | 20px |
| 768–1023px | 8 | 20px | 24px |
| 1024–1279px | 12 | 24px | 32px |
| ≥1280px | 12 | 24–32px | Fluid, at least 40px |

### 14.3 Container widths

- `container-reading`: 43rem / 688px.
- `container-content`: 72rem / 1152px.
- `container-wide`: 90rem / 1440px.
- `container-dialog-sm`: 28rem / 448px.
- `container-dialog-md`: 40rem / 640px.
- `container-technical`: 80rem / 1280px, with horizontal overflow handled inside the data module, not the page.

### 14.4 Fluid gutters

Default page gutter:

```text
clamp(16px, 3vw, 40px)
```

Safe-area insets are added once at the shell boundary. Component padding must not independently double them.

### 14.5 Responsive rules

- Layout changes at content stress points, not by device names.
- Navigation changes mode at `bp-lg`; bottom navigation remains fully operable before that.
- Cards stack before text, controls or Devanagari labels truncate.
- Technical tables may scroll inside a labelled region; core meaning remains above them.
- Reading lines stop growing at `container-reading` even on ultrawide screens.
- Mobile landscape and 200% text are separate test states, not inferred from width alone.

---

## 15. Sizing, touch and control density

- Default interactive target: 44 × 44px minimum.
- Compact technical target: visual control may be 32px, but hit area remains at least 44px unless inline-text exception applies.
- Primary mobile button height: 52px.
- Standard control height: 44px.
- Compact technical control height: 36px with expanded hit region.
- Bottom navigation target: minimum 48px high plus safe area.
- Icon-only controls require accessible names and tooltips where discovery needs them.
- Adjacent targets retain at least 8px comfortable separation when possible.

WCAG's formal minimum target criterion is 24 × 24 CSS pixels or sufficient spacing; AstroSaathi intentionally targets 44px as the premium usability baseline.

---

## 16. Data visualization and astrological colour

### 16.1 Data-series palette

Charts use a colour-blind-aware sequence tested on the actual theme surface:

1. Cobalt.
2. Saffron.
3. Cyan.
4. Rose.
5. Violet.
6. Leaf green.
7. Warm grey.

Every series also receives a label, direct annotation, marker shape or stroke pattern. Colour alone never identifies a planet, score band or state.

### 16.2 Planet aliases

Planet colours may support recognition but cannot override chart readability:

| Alias | Direction |
|---|---|
| Sun | Solar saffron |
| Moon | Moon ivory with contrasting outline |
| Mars | Warm coral |
| Mercury | Leaf/mint |
| Jupiter | Deep gold |
| Venus | Rasa rose |
| Saturn | Slate-indigo |
| Rahu | Aurora violet |
| Ketu | Smoky plum |

Labels and glyphs remain mandatory. Traditional associations are design aids, not positive/negative judgments.

### 16.3 Chart rules

- Natal chart lines meet non-text contrast against their surface.
- Current selection uses stroke width + halo/marker + label, not colour alone.
- “Favourable/challenging” never maps mechanically to green/red.
- Market up/down may use green/red only with direction arrows and signed values.
- Dense technical charts use solid surfaces and no atmospheric gradient underneath.

---

## 17. Accessibility modes

### 17.1 Increased contrast

- Remove texture.
- Replace subtle borders with strong borders.
- Raise tertiary text to secondary text colour.
- Make focus a solid dual-tone ring.
- Reduce transparent surface stacking.
- Preserve brand colour only where its contrast passes.

### 17.2 Reduced transparency

- Glass maps to opaque `surface-raised`.
- Gradient scrims map to solid protective surfaces.
- No information or hierarchy changes when blur is removed.

### 17.3 Forced colours

- Use system colours for text, surfaces, borders, buttons and focus.
- Disable nonessential gradients, shadows, glass, grain and planet colours.
- Preserve selected/current/error meaning with native states, text and icons.

### 17.4 Colour vision

- Avoid red/green-only comparison.
- Maintain distinct luminance, shape or stroke pattern for adjacent series.
- Test common protan, deutan and tritan simulations, then validate actual labels without simulation dependence.

### 17.5 Text resize/reflow

- Support 200% browser text size without loss of content or function.
- Do not set fixed heights on translated text containers.
- Hero typography steps down based on available inline size and content length.
- Tooltips are never required for core information.

---

## 18. Theme behavior

### 18.1 Modes

- `system`: follows platform preference until the user makes an explicit choice.
- `dawn`: intentional light appearance.
- `midnight`: signature dark appearance.

Theme preference is visual only and must not affect data, calculations, content or user context.

### 18.2 Transition

- Theme changes use a maximum 180ms colour/surface crossfade.
- Do not animate every descendant independently.
- Under reduced motion, switch immediately.
- Prevent a wrong-theme flash before hydration using a safe shell-level strategy during implementation.

### 18.3 Cross-theme equivalence

- Semantic hierarchy, selected state and information density remain equivalent.
- Dawn receives warm light and paper depth; Midnight receives atmospheric depth and controlled emission.
- A component is not accepted if it only feels premium in Midnight.

---

## 19. World-level accent assignments

Worlds share the same system. Accents guide orientation without becoming independent themes.

| World | Signature accent | Dominant semantic gradient | Material emphasis |
|---|---|---|---|
| Today | Solar saffron | Atmosphere + Solar reveal | Canvas atmosphere, solid insight card |
| My Cosmos | Deep violet + gold | Restrained Midnight / Prism edge in technical detail | Precious instrument on solid truth surfaces |
| Ask | Cobalt + Aurora violet | Aurora live | Control glass composer, solid answers |
| Journey | Lunar lavender + rose | Lunar reflection / Time | Paper-like reflective surfaces |
| Connections | Rose + cobalt | Relationship | Two identities, shared field, solid analysis |
| Settings/utility | Neutral indigo/plum | None by default | Quiet, literal utility surfaces |
| Markets | Cobalt/cyan data palette | None behind data | Precision surfaces with explicit status |

No world may recolour feedback semantics or invent a new action colour.

---

## 20. Compatibility aliases and migration boundary

The current code consumes generic tokens such as `background`, `foreground`, `card`, `primary`, `accent`, `destructive`, `border` and `ring`. During later implementation, these may temporarily alias the new semantic system:

| Current token | Temporary semantic alias |
|---|---|
| `background` | `surface-canvas` |
| `foreground` | `text-primary` |
| `card` | `surface-reading` |
| `card-foreground` | `text-primary` |
| `popover` | `surface-raised` |
| `primary` | `action-primary` |
| `primary-foreground` | `action-primary-text` |
| `muted` | `surface-subtle` |
| `muted-foreground` | `text-secondary` |
| `accent` | Context-specific warm/interactive accent |
| `destructive` | Real Danger semantic only |
| `border` | `border-subtle` |
| `ring` | `focus-outer` |

This bridge prevents a flag-day rewrite. It does not permit old and new token meanings to coexist indefinitely.

Important correction for later implementation: the current system uses amber for `destructive`. The future system separates Warning amber from actual Danger crimson, while ensuring doshas/difficult astrological states never inherit Danger styling.

---

## 21. Validation plan

### 21.1 Automated token checks

- Schema and naming validation.
- No raw colour values in migrated component files.
- Contrast checks for every declared text/surface and control/state pair.
- Light/dark/contrast-mode token completeness.
- No circular aliases or undefined fallbacks.
- Snapshot of token output for unintended changes.

### 21.2 Visual QA matrix

- Dawn and Midnight.
- 320, 375, 480, 768, 1024, 1280 and 1536px widths.
- English, Hindi, Marathi and mixed-script content.
- Default, hover, focus, pressed, selected, disabled, loading, error and stale.
- Reduced motion, reduced transparency, increased contrast and forced colours.
- 200% text zoom and browser zoom/reflow.
- Mid-range Android GPU/CPU and iOS Safari backdrop-filter behavior.

### 21.3 Font QA

- First content paint before fonts load.
- Layout shift after each font/script arrives.
- Devanagari conjuncts, matras, punctuation and line breaks.
- Tabular numerals for dates, degrees, Dasha tables and scores.
- Synthetic bold/italic prohibited where a real face is absent.

### 21.4 Performance budgets

Proposed design-system budgets, to be measured rather than assumed:

- Critical font payload: target ≤120KB compressed per active script/language path.
- No baseline WebGL dependency.
- At most one continuously animated decorative layer in view.
- No unbounded blur/filter animation.
- Decorative raster assets excluded from critical content paint and lazy-loaded.
- Static fallback available for every animated or shader-like treatment.

---

## 22. Acceptance checklist

Action 1.5 can be approved when the user agrees that:

- Midnight, Dawn and Prism are one token system with a 70/20/10 hierarchy.
- The architecture uses primitive → semantic → limited component aliases.
- OKLCH is canonical and rendered contrast must still be tested.
- Dawn is an art-directed light mode, not an inversion.
- Cobalt/violet mean intelligence, saffron means action/revelation, rose means human warmth and cyan means technical precision.
- Warning amber and true Danger crimson are separate; astrology never inherits destructive red.
- Gradients are semantic and limited to one dominant atmospheric event per screen.
- Fraunces + Noto Serif Devanagari form the proposed display pair; DM Sans + Noto Sans Devanagari form the interface pair.
- The type scale, 4px spacing rhythm and expressive-but-controlled radius system are accepted.
- Solid surfaces hold truth/reading; glass is limited to controls/navigation/transient layers.
- Motion uses explicit duration/easing/budget tokens and becomes static under reduced motion.
- The responsive system validates from 320px and caps reading/data containers appropriately.
- 44px is the preferred minimum interactive target.
- Accessibility modes are token mappings, not cleanup work.
- Existing generic tokens are temporary migration aliases only.

---

## 23. Decision log

| Decision | Alternatives | Reason |
|---|---|---|
| Use three token layers | Generic palette only; per-world themes | Expressive, maintainable and reviewable. |
| Keep OKLCH canonical | Hex/HSL as source | Matches current architecture and supports perceptual control. |
| Art-direct Dawn separately | Algorithmic inversion | Preserves warmth and long-reading quality. |
| Use restrained sRGB-safe core | Wide-gamut-only spectacle | More reliable across target devices; P3 can enhance later. |
| Separate feedback from astrology | Use red for difficult periods | Prevents fear language and semantic confusion. |
| Use semantic gradients | Decorative per-card gradients | Produces meaning and prevents fatigue. |
| Propose Fraunces for Latin display | Retain Cormorant; use a neutral serif | More distinctive, variable and playful while remaining editorial. |
| Retain DM Sans for interface | Introduce another UI family | Existing fit is strong; reduces migration and font cost. |
| Pair dedicated Noto Devanagari families | Rely on fallback | Preserves script quality and hierarchy. |
| Use 4px rhythm with 2px optical exception | 8px-only grid | Supports compact technical controls without arbitrary spacing. |
| Diversify semantic radii | One 12px base everywhere; blobs | Adds hierarchy without chaos. |
| Solid for truth, glass for control | Glass everywhere | Protects legibility, trust and performance. |
| Target 44px controls | Use WCAG's formal 24px floor | Better mobile usability and premium comfort. |
| One ambient effect per viewport | Multiple perpetual celestial loops | Protects focus, performance and accessibility. |
| Use compatibility aliases during migration | Flag-day token replacement | Reduces regression risk while keeping an explicit end state. |

---

## 24. Approval record

The user approved the token architecture, palette, type, spacing, shape, material, motion and responsive rules on 8 September 2026.

Action 1.5 is complete. The approval authorizes subsequent design-specification actions one at a time; it does not authorize CSS, font, asset, component, route, calculation or backend implementation.
