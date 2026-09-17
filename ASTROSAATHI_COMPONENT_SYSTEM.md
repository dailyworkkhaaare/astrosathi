# AstroSaathi 3.0 — Component System

**Action:** 1.6 — Define the component system  
**Status:** Approved 8 September 2026  
**Created:** 8 September 2026  
**Type:** Design specification only  
**Implementation authorization:** None  
**Approved visual blend:** 70% Midnight Rasa + 20% Dawn warmth/readability + 10% Prism precision  
**Companion documents:** [Design token system](./ASTROSAATHI_DESIGN_TOKEN_SYSTEM.md), [future information architecture](./ASTROSAATHI_FUTURE_INFORMATION_ARCHITECTURE.md), [global context behavior](./ASTROSAATHI_GLOBAL_CONTEXT_BEHAVIOR.md), [content and ethical language](./ASTROSAATHI_CONTENT_AND_ETHICAL_LANGUAGE_SYSTEM.md), [backend contract map](./ASTROSAATHI_FRONTEND_BACKEND_CONTRACT_MAP.md)

---

## 1. Purpose

This document defines the complete reusable UI system for AstroSaathi 3.0. It turns the approved product worlds, visual direction, context rules, content hierarchy and tokens into components with explicit anatomy, states, behavior, accessibility and data boundaries.

The system must make the experience feel handcrafted without making each screen bespoke. It must also protect the current backend by ensuring presentation components render authoritative state rather than recompute, infer or silently “improve” business logic.

The component north star is:

> **One system, five worlds, visible evidence, predictable behavior.**

---

## 2. Boundary

This action does **not**:

- Create, modify, rename or delete React components.
- Change routing, navigation, state management or query ownership.
- Install Storybook, visual-regression tooling or other packages.
- Change Supabase schemas, RLS, Edge Functions, prompts or calculations.
- Change chat streaming, voice capture, memory retention or notification behavior.
- Design the final screen flows; Action 1.7 will prototype the five hero journeys.
- Author final translated product copy.

Names in this document describe target responsibilities. They are not mandatory file names or an instruction to replace stable primitives wholesale.

---

## 3. Understanding lock

### 3.1 Confirmed intent

1. AstroSaathi needs a recognizable premium system, not a collection of visually unrelated route redesigns.
2. The five primary worlds are Today, My Cosmos, Ask, Journey and Connections; Settings belongs behind the profile utility.
3. Subject, Time and Ask-from-anywhere must stay visible, capability-aware and truthful to the backend context actually applied.
4. Personalized content must progressively reveal Simple, Detailed and Technical layers with claim provenance.
5. Current calculations, saved data, streaming, memory and voice behaviors remain intact until separately approved implementation actions.
6. Mobile, desktop, English, Hindi, Marathi, keyboard, screen reader and reduced-motion/transparency use are first-class.
7. The component inventory must cover ordinary, partial, stale, unavailable, failure and destructive states—not only polished happy paths.

The user's approval of Actions 1.1–1.5 and instruction to begin the next gated action are treated as confirmation of this understanding.

### 3.2 Assumptions

- The current Radix-based `src/components/ui` layer remains the interaction/accessibility foundation unless a component-specific audit proves otherwise.
- Existing chart SVG/HTML output is authoritative and should be wrapped, not redrawn, during the first visual migration.
- Routes/hooks may initially continue owning data fetching while product components receive explicit view-state props.
- A later refactor may introduce presenter/view-model adapters without changing query or mutation contracts.
- Five-world navigation replaces the current three-destination navigation visually, while legacy routes/deep links remain valid.
- Ask becomes a primary world, so the current floating chat button is not a permanent second navigation system.
- Rich component demos will use synthetic, non-user fixtures when implementation is authorized.

### 3.3 Non-functional requirements

- **Performance:** component composition adds no baseline WebGL, no unbounded effects and no duplicate route fetches.
- **Scale:** the inventory supports every existing route and feature without one-off card forks.
- **Privacy/security:** components display only authorized inputs; context IDs and memory details remain scoped and non-leaking.
- **Reliability:** all async states are explicit and recoverable; visual state never claims data was applied when it was not.
- **Maintenance:** component responsibilities are narrow, variants are finite and visual styling flows through approved tokens.
- **Ownership:** primitives, semantic components and feature compositions have distinct review responsibilities.

### 3.4 Deferred questions

- Exact filesystem organization and export barrels.
- Whether a dedicated component workshop tool is added.
- Which internal current components are evolved in place versus replaced behind compatibility wrappers.
- Whether long chat/history and technical tables require virtualization at measured production scale.

These are implementation decisions and do not prevent approval of the component model.

---

## 4. System approaches considered

### A — Restyle each current route independently

This is visually fast at first and preserves local code ownership, but duplicates card, state, evidence and responsive logic. Drift would return almost immediately.

**Decision:** rejected.

### B — Layered primitives → semantics → product composites

Keep proven headless primitives, introduce AstroSaathi-specific semantic components, then compose them into feature modules and world screens. Business data enters only at controlled feature boundaries.

**Decision:** recommended.

### C — One universal schema-driven page renderer

Every screen would be JSON/config assembled. It offers theoretical consistency but makes unique charts, chat, timelines, voice and accessibility behavior harder to model. It also creates a risky platform rewrite before value is proven.

**Decision:** rejected. Configuration is useful only for narrow repeatable groups such as settings rows or insight lists.

---

## 5. Component architecture

```text
L0  Design tokens and assets
    colour · type · spacing · motion · icons · decorative geometry
                         ↓
L1  Accessible interaction primitives
    button · input · dialog · sheet · menu · tabs · tooltip · table
                         ↓
L2  AstroSaathi semantic components
    claim label · evidence chip · context lens · availability · status
                         ↓
L3  Product composites
    insight card · chart stage · timeline · composer · memory card
                         ↓
L4  Feature modules
    Daily Signal · Kundali Explorer · Compatibility Reading · Ask Thread
                         ↓
L5  World compositions
    Today · My Cosmos · Ask · Journey · Connections
```

### Dependency rule

Dependencies point downward only. A `ClaimLabel` may consume Badge primitives and tokens; it may not import a chart query. A `ChartStage` may compose chart controls and evidence, but it may not depend on the Today page.

### Business-logic rule

Components may:

- Format already-approved display values.
- Select a presentational variant from explicit state.
- Emit user intents such as `onSelect`, `onRetry` or `onConfirm`.

Components may not:

- Recalculate planets, houses, Dashas, scores, doshas, remedies or market signals.
- Guess absence from a missing field.
- Change query keys, persistence, retention or owner scope.
- Convert an unapplied context selection into an “applied” visual state.

---

## 6. Component API principles

### 6.1 Controlled state at consequential boundaries

Navigation, context selection, destructive confirmations, chat submission, voice recording, memory retention and chart selection must be controlled by their owning feature/controller. Local visual disclosure may be uncontrolled when it has no persistence or data consequence.

### 6.2 Explicit state, not boolean soup

Prefer one finite state:

```text
status = idle | loading | ready | partial | empty | stale | unavailable | error
```

Avoid combinations such as `loading=true`, `hasData=false`, `error=false`, `isStale=true` that allow contradictory UI.

### 6.3 Semantic props

Prefer:

- `tone="warning"`
- `claimType="timing-interpretation"`
- `availability="limited"`
- `depth="simple"`

Avoid:

- `orange`
- `purpleBorder`
- `smallText`
- `isFancy`

### 6.4 Composition before variants

Slots compose headers, evidence, actions and details. Variants are reserved for stable semantic differences, not every layout request.

### 6.5 No hidden side effects

A presentational click emits an intent. It does not silently navigate, submit a prompt, write memory or mutate a profile unless that behavior is the explicitly named component contract.

---

## 7. Foundation primitives

Existing accessible primitives should be audited and restyled, not casually rebuilt.

### 7.1 Actions

#### `ActionButton`

Variants:

- `primary`: main action; one per decision region.
- `secondary`: solid/outlined supporting action.
- `quiet`: low-emphasis utility.
- `danger`: destructive action only.
- `ceremonial`: gradient treatment for an earned, low-frequency reveal.

Sizes: compact, standard and large, while preserving the 44px preferred hit target.

States: default, hover, focus, pressed, loading, success-confirmed, disabled.

Rules:

- Loading retains the label or a stable-width equivalent.
- Disabled actions explain prerequisites nearby; tooltips are not the only explanation.
- `danger` never styles dosha, difficult timing or relationship score.

#### `IconButton`

Requires an accessible name. Badge/count state is announced separately. Shape may be orbit/circle, but hit area remains stable.

#### `TextAction`

For secondary inline navigation, “Why this?”, “View method” and “Ask about this.” Underline or another non-colour cue appears on hover/focus.

### 7.2 Inputs

#### `Field`

Anatomy: visible label, required/optional cue, control, description, error and privacy/context note. Error ownership uses stable IDs and `aria-describedby`.

#### Input families

- `TextField`
- `TextArea`
- `SelectField`
- `SearchField`
- `DateField`
- `TimeField`
- `LocationField`
- `RadioCards`
- `SegmentedChoice`
- `SwitchField`
- `ConsentCheck`
- `OtpField`

Input controls expose idle, active, filled, invalid, disabled, read-only, loading-lookup and unavailable states.

### 7.3 Disclosure and selection

- `Disclosure`
- `Tabs`
- `ChoiceChips`
- `Menu`
- `Tooltip`
- `Popover`
- `Pagination`

Use Tabs only for peer content that can be understood independently. Use Disclosure for progressive detail. Do not put seven unrelated analytical systems into one peer tab row.

### 7.4 Overlays

- `Dialog`: focused decision or compact task.
- `AlertDialog`: irreversible/destructive confirmation.
- `Sheet`: contextual detail, filters, chart inspector or mobile navigation.
- `Drawer`: touch-oriented bottom interaction.
- `Popover`: compact nonessential control on expanded screens.

The same task may map to Sheet on compact and Popover/Dialog on expanded layouts while retaining focus and accessible naming.

---

## 8. Shell and navigation

### 8.1 `CosmicAppShell`

Owns:

- Theme-safe initial surface.
- Safe-area allocation exactly once.
- Primary navigation placement.
- World content region.
- Global context-dock placement.
- Toast/live-region portals.
- Offline/session-expiry overlays.

It does not own feature data or render private content before authentication resolves.

### 8.2 `DesktopWorldRail`

Anatomy:

1. Brand/home anchor.
2. Five world destinations.
3. Optional compact status area.
4. Profile/avatar utility at the bottom.

Behavior:

- Expanded label rail at comfortable desktop widths; compact icon rail only when labels remain discoverable via tooltips and landmarks.
- Active world uses shape, type weight and colour—not colour alone.
- Ask is visibly primary but still one navigation destination.
- Settings is absent from the five-world list.

### 8.3 `MobileWorldBar`

- Five equal logical destinations with Ask emphasized by containment/shape, not detached as a floating sixth control.
- Labels remain visible in every supported language; abbreviated labels require approved translations.
- Active indicator remains inside the target and survives forced colours.
- Safe-area padding is owned by the shell/bar contract once.
- Scrolling content receives the correct bottom reserve.

### 8.4 `WorldHeader`

Slots:

- World eyebrow/title.
- Date or stable subtitle.
- Subject/Time context summary.
- Utility actions.
- Optional one-atmosphere artwork anchor.

On compact screens, context moves below the title rather than truncating. On long-reading screens, the header becomes quieter/sticky only where orientation benefit exceeds obstruction.

### 8.5 `ProfileLauncher` and `ProfileUtilityMenu`

Provides Settings, language, appearance, privacy/memory, help/legal and sign out. Sign out is visually separated and explicit. Avatar fallback never exposes email unnecessarily.

### 8.6 Secondary navigation

- `BackAction` for mobile detail flow.
- `BreadcrumbTrail` for desktop technical depth.
- `LocalSectionNav` for long reports.
- `JumpNav` for chart/report anchors.

Browser Back behavior remains authoritative; decorative back controls do not invent their own history stack.

---

## 9. Global context components

These components implement the Action 1.3 language without pretending unsupported backend scope exists.

### 9.1 `ContextDock`

Visible summary/control containing:

- `SubjectLens`
- `TimeLens`
- Optional active source count.
- “Ask with this context” action where supported.

States:

- applied
- pending selection
- partially applied
- unsupported
- unavailable
- authorizing/loading

The dock renders the server/route-authoritative applied state, not merely the latest UI selection.

### 9.2 `SubjectLens`

Options can include Self, an authorized saved person or Self + Person relationship. Every option shows name, relation/avatar and capability. Disabled/unsupported choices include an inline reason.

On a material subject switch inside Ask, the owner prompts for a new conversation by default. The component emits the intent but does not perform the conversation mutation.

### 9.3 `TimeLens`

Supported representations:

- Now.
- Exact date.
- Saved event date.
- Active Dasha period.

It shows timezone and precision. An arbitrary date selector appears only when the feature contract can use it. A visible date is never treated as applied until data and metadata agree.

### 9.4 `ContextPreviewSheet`

Opened before Ask-from-anywhere submission. Shows:

- Subject.
- Time.
- Source artifacts to be attached.
- Privacy-sensitive sources.
- Unsupported/excluded sources.
- Editable seed question.
- Remove-source actions.
- A literal Send/Continue action.

Opening the sheet never sends a message.

### 9.5 `AppliedContextStrip`

Read-only summary above an answer/report. It is populated from applied response/route metadata. A “pending” visual must not be promoted to applied while a request is in flight.

### 9.6 `CapabilityNotice`

Explains why a context combination is unavailable and what safe next action exists. It never substitutes generic content under the requested label.

---

## 10. Cards, bento and surfaces

### 10.1 `CosmicCard`

The general semantic surface with finite roles:

- `reading`: solid, quiet, long-form capable.
- `insight`: visual emphasis with evidence.
- `metric`: one value plus clearly named measure.
- `action`: task-focused with one action.
- `technical`: compact, precise, low ornament.
- `warning`: product/data caution, not astrological fear.
- `live`: active generation/current timing with restrained edge.

Anatomy slots:

1. Eyebrow/status.
2. Title.
3. Summary/body.
4. Visual/data region.
5. Evidence/provenance.
6. Actions.
7. Expandable detail.

Not every slot is used. Empty decorative headers are prohibited.

### 10.2 `InsightBentoGrid`

The bento system is narrative, not an equal-tile dashboard.

Rules:

- One lead card owns the first reading position.
- Supporting cards vary by meaning/density, not random collage.
- Source order remains logical when CSS placement changes.
- Cards never span in a way that hides core content below decorative content.
- On compact screens all cards become one intentional sequence.
- A single card does not become a “grid.”

Presets:

- `lead-plus-two`
- `story-stack`
- `metric-cluster`
- `technical-split`

Arbitrary masonry is excluded because it harms predictable reading and localization.

### 10.3 `AtmosphereFrame`

Provides the one permitted dominant atmospheric event: Solar, Lunar, Aurora, Relationship or Time. It is decorative and cannot own content contrast. Reduced-transparency/motion fallbacks are mandatory.

### 10.4 `SectionFrame`

Creates consistent title, description, action, status and content spacing for ordinary modules. Unlike a card, it may be visually open on the canvas.

### 10.5 `GlassControlBar`

For navigation, context lenses, chart controls and composer utilities. It never wraps reports, warnings or data tables.

---

## 11. Content depth and evidence components

### 11.1 `ClaimLabel`

Maps only to the approved claim taxonomy:

- From your chart.
- Current timing.
- Natal pattern.
- Timing influence.
- Traditional view.
- AstroSaathi interpretation.
- From what you shared.
- Reflection prompt.
- Optional practice.
- Experimental market indicator.
- Not enough information.

Icon, text and accessible name convey the type; colour is supporting only.

### 11.2 `EvidenceChip`

Shows a concise trusted signal such as Moon in Taurus, current Mahadasha or an Ashtakavarga value. It requires a real evidence reference. A component cannot create evidence from prose.

### 11.3 `EvidenceStrip`

Groups two to four strongest signals plus “View all evidence.” It handles:

- Available evidence.
- Some sources excluded.
- Limited precision.
- Stale source.
- Method/source unavailable.

### 11.4 `EvidenceDrawer`

The Detailed/Technical expansion with:

- Contributing signals.
- Exact values/dates.
- Calculation/tradition label.
- Ayanamsha/method/version where available.
- Limitations.
- Data freshness.

It never fabricates metadata absent from the backend.

### 11.5 `DepthControl`

Options: Simple, Detailed and Technical. It controls presentation depth, not chat answer-length preference and not data authorization. Technical is disabled/explained when no technical evidence exists.

### 11.6 `AvailabilityBadge`

Distinct states: available, limited, unavailable, stale and failed. “Not detected” is a feature-specific result, not an availability state.

### 11.7 `FreshnessLabel`

Shows last completed time/date/timezone for current or market data. Stale content cannot display “Now.”

---

## 12. Today components

### 12.1 `DailySignalHero`

The single dominant daily story. Anatomy:

- Date/timezone.
- Personalized versus general label.
- Plain-language theme.
- Supporting timing evidence.
- Optional grounded action/reflection.
- Ask handoff.

It does not merge independently failed data into a confident synthesis.

### 12.2 `TimingRibbon`

A compact current/near-future visual for one meaningful transit or Dasha change. It includes exact date range and dismiss/ask behavior when supported. It is not a fear notification.

### 12.3 `PanchangStrip`

Compact Tithi, Nakshatra, Yoga/Karana and location/date summary, with Detailed expansion. Missing locality or date has an explicit state.

### 12.4 `DailyPracticeCard`

Contains mantra or optional low-risk practice with tradition and optionality label. Copy/play controls do not imply guaranteed effect.

### 12.5 `ExperimentalMarketCard`

Visually separated technical surface containing experimental label, instrument/category, date, data freshness, direction with non-colour cue and limitations. No trade CTA is allowed.

### 12.6 `NudgeCard`

Represents proactive guidance with reason, timing, dismiss/snooze/open actions and notification provenance. Dismissal is a real intent passed to its controller, not local-only decoration unless that matches the existing contract.

---

## 13. Chart and astrological evidence components

### 13.1 `ChartStage`

The complete Kundali exploration region:

1. Chart identity/title.
2. `ChartToolbar`.
3. `ChartViewport` containing authoritative chart output.
4. `ChartLegend`.
5. `SelectionSummary`.
6. `ChartInspector`.
7. Evidence/Ask action.

The stage handles layout and selection presentation; it never recalculates the chart.

### 13.2 `ChartFrame`

Evolves the current decorative wrapper. Responsibilities remain strictly presentational:

- Solid truth surface.
- Optional Lotus/observatory geometry.
- One-time reveal.
- Contrast boundary.

It must pass children unchanged and not parse/mutate chart SVG content.

### 13.3 `ChartViewport`

- Maintains aspect ratio.
- Provides a descriptive accessible summary adjacent to inaccessible visual geometry.
- Supports pan/zoom only if the underlying content requires it.
- Has reset and keyboard alternatives.
- Does not trap page zoom or scrolling.
- Fullscreen is progressive enhancement, not required to read core facts.

### 13.4 `ChartToolbar`

Potential controls, shown only when supported:

- Chart/Varga selector.
- North/South/East style if actual output supports it.
- Labels/degree visibility.
- Zoom/reset/fullscreen.
- Technical-depth action.

Controls use visible labels on first encounter and icon-only compacting only when accessible discovery remains.

### 13.5 `ChartSelection`

Explicit selection model for house, planet, sign or aspect. Selected geometry, legend and inspector must agree. Switching selection is local UI state unless a route/query explicitly owns it.

### 13.6 `ChartInspector`

Bottom sheet on compact; side panel on expanded layouts. Contains:

- Selected item identity.
- Simple meaning.
- Exact chart facts.
- Related evidence.
- Technical expansion.
- Ask handoff preview.

### 13.7 `PlanetTable` and `HouseTable`

- Sticky or persistent accessible headers where helpful.
- Tabular numerals.
- Sort only where semantically safe; default order remains calculation-defined.
- Mobile card transformation preserves row/column meaning.
- No colour-only planet identity.

### 13.8 `DoshaResultCard`

States:

- detected.
- not detected.
- limited.
- unavailable.
- failed.

Anatomy includes method, contributing/cancellation factors actually supported, calm interpretation, optional practice and evidence. Detected state never uses Danger red or alarm imagery.

### 13.9 `RemedyCard`

Displays optional practice type, context, instructions, tradition/caution and completion/save action if supported. It does not purchase, guarantee or create urgency.

### 13.10 `ScoreModule`

For Ashtakavarga, Guna Milan or other named measures. Requires:

- Score name.
- Range/denominator.
- What it measures.
- What it does not measure.
- Supporting breakdown.
- Non-colour interpretation.

A circular visual never implies probability unless that is the actual metric.

---

## 14. Timeline system

### 14.1 Shared model

`TemporalCanvas` composes:

- `TimeAxis`
- `PeriodBand`
- `NowMarker`
- `EventNode`
- `RangeSelection`
- `TimelineInspector`
- `TimelineLegend`

It supports Dasha periods, life events and historical nudges without forcing them into one data model.

### 14.2 `DashaTimeline`

Preserves current calculated start/end values and current-period selection. Future anatomy:

- Mahadasha bands proportional to real duration.
- Current marker with text/date.
- Selected period details.
- Antardasha detail only at relevant zoom/selection.
- Horizontal overview plus accessible list/table equivalent.

Colour aliases may aid planet recognition but labels remain required.

### 14.3 `JourneyTimeline`

Combines only deliberately attached items:

- User life event.
- Journal reflection.
- Historical nudge.
- Attached astrological context.

Astrological context is visually secondary to the user's lived event. Missing context does not invalidate the entry.

### 14.4 `EventNode` and `EventCard`

Shows date precision explicitly: exact, month, year or approximate. It never renders an approximate event as an exact day. Private/journal state is visible without exposing content in URLs or notifications.

### 14.5 Timeline responsiveness

- Compact: vertical chronological track, current/selected item expanded inline.
- Medium: vertical track with side detail.
- Expanded: horizontal overview plus synchronized detail pane where appropriate.
- Keyboard traversal follows chronological order, not visual position hacks.

---

## 15. Ask and conversation components

### 15.1 `AskShell`

Owns layout for:

- Conversation navigation/history.
- Thread header and applied context.
- Message log.
- Jump-to-latest control.
- One persistent composer instance.
- Screen-reader progress/final announcements.

It preserves the current requirement that the composer not remount between empty and active thread states.

### 15.2 `ConversationNavigator`

- Desktop side panel; mobile modal sheet.
- New Ask action.
- Search.
- Date-grouped conversations.
- Active thread.
- Rename and delete.
- Empty/loading/error states.

Delete uses `AlertDialog`; failed deletion is visible rather than ignored in the future target experience, while mutation semantics remain unchanged.

### 15.3 `AskEmptyState`

Contains a restrained brand moment, context-aware greeting and a small set of prompt starters. Starters fill the composer but never auto-send.

### 15.4 `MessageGroup`

Groups a user turn and assistant answer while preserving each message as a semantic item. Assistant answers have:

- Content.
- Applied-context strip.
- Evidence/provenance.
- Streaming state.
- Read aloud.
- Copy.
- Feedback.
- Retry/regenerate where contractually valid.

Generated prose and calculated evidence are visually distinguishable.

### 15.5 `StreamingStatus`

Finite phases:

- connecting.
- grounding/context preparation.
- generating.
- reconnecting/fallback.
- interrupted with partial response.
- complete.
- failed.

One polite live region announces phase changes; the streaming text itself does not continuously overwhelm screen readers.

### 15.6 `AskComposer`

Anatomy:

1. Applied/pending context tray.
2. Auto-growing text input.
3. Attachment/source affordance when supported.
4. Voice input.
5. Send/stop action.
6. Privacy/scope microcopy when context demands it.

Composer states:

- empty.
- focused.
- populated.
- context pending.
- sending.
- streaming/stop available.
- recording.
- transcribing.
- recoverable input error.
- offline.
- disabled by auth/session state.

Enter sends only when not composing an IME sequence. Shift+Enter remains newline. Mobile keyboard/safe-area behavior remains a first-class contract.

### 15.7 `PromptStarter`

Uses a real question label and optional evidence source. It populates editable text only. It does not masquerade as an answer or send on first tap.

### 15.8 `MessageActions`

Actions appear persistently on touch and on focus/hover desktop. Icon buttons have labels; feedback selection has pressed state. Copy success is announced without shifting layout.

---

## 16. Voice components

### 16.1 `VoiceInputButton`

States:

- unavailable/unsupported.
- permission not requested.
- permission requesting.
- ready.
- recording.
- stopping.
- transcribing.
- error.

The button label and icon change together. Recording cannot begin without a clear system permission path.

### 16.2 `VoicePermissionPrimer`

Optional first-use sheet explaining what audio is used for, when it stops and what is stored under the current backend behavior. It cannot promise local-only processing unless true.

### 16.3 `RecordingDock`

Anatomy:

- Recording status and elapsed time.
- `AudioWaveform` decoration.
- Text status alternative.
- Cancel.
- Stop/use recording.

Animation is not the only recording indication. Cancel and stop targets are spatially separated.

### 16.4 `AudioWaveform`

Progressive visual enhancement. If Web Audio, canvas, permission or stream fails, the semantic recording state still works. Under reduced motion, show a static level/status treatment.

### 16.5 `TranscriptPreview`

The user can review/edit transcription before submission when the existing workflow supports it. Low-confidence or failed transcription is never silently sent as the user's words.

### 16.6 `ReadAloudControl`

States: ready, loading, playing, paused/stopped and failed. Only one message plays at a time. New user submission stops active playback, preserving current behavior.

---

## 17. Memory and privacy components

### 17.1 `MemoryStatus`

A compact, non-invasive indicator for memory enabled/disabled and current conversation behavior. It never implies all data is remembered.

### 17.2 `MemoryDisclosure`

Explains the difference between:

- Current conversation context.
- Saved topic memory.
- Learned response preferences.
- Emotional state memory where present.
- Profile and chart data.

It links to controls but does not expose sensitive remembered text in a public/shared context.

### 17.3 `MemoryTopicCard`

Anatomy:

- Topic label.
- Concise remembered item.
- Last updated.
- Retention state.
- Included/excluded-from-AI state.
- Change retention.
- Delete.

Expired/`never` memory is labelled excluded, not silently treated as active.

### 17.4 `RetentionSelector`

Options map exactly to current supported values: forever, 30 days, chat and never. Display language must explain consequence. Optimistic update state and rollback error are visible.

### 17.5 `LearnedPreferenceCard`

Displays only recognized stored preference keys and separates them from personal topic memory. Reset is a confirmed mutation.

### 17.6 `MemoryDangerZone`

Contains export, reset learned preferences, clear emotional state and delete-all flows with explicit scope. Delete-all preserves the current two-step confirmation requirement.

### 17.7 Privacy invariant

An Ask-from-anywhere preview may list that an approved memory source will be used, but must not reveal unrelated hidden memory. Exclusion and retention settings cannot be overridden by a local component selection.

---

## 18. Connections components

### 18.1 `PersonCard`

Shows name, relation, birth-data precision, generation status and safe actions. Birth details are secondary and never exposed more broadly than needed.

### 18.2 `PersonPicker`

Searchable single-selection control for an authorized saved person. Eligibility and unavailable chart generation states are explicit. It never accepts an arbitrary row ID as trusted display state.

### 18.3 `RelationshipHeader`

Displays both subjects, relationship context and calculation availability. Neither person's identity is visually subordinate.

### 18.4 `CompatibilityOverview`

Order:

1. Balanced dynamic summary.
2. Areas of ease.
3. Areas for conversation.
4. Named traditional score.
5. Dosha module.
6. Evidence/method.
7. Conversation prompts.

It never produces a good/bad verdict card.

### 18.5 `CompatibilityDimension`

Named measure, score/range, plain meaning, evidence and limits. Colours do not imply relationship safety or destiny.

### 18.6 `RelationshipPrompt`

Practical discussion/reflection prompt that can prefill Ask with both identities shown. It never sends automatically.

---

## 19. Journey and reflection components

### 19.1 `JournalComposer`

Anatomy:

- Private entry field.
- Date.
- Optional mood/tags supported by contract.
- Optional context attachment preview.
- Save state.
- Privacy cue.

Attaching astrology is deliberate; it is not injected into the user's writing.

### 19.2 `ReflectionCard`

User words remain primary. AI/astrological reflection, if requested and supported, occupies a visibly labelled separate region.

### 19.3 `LifeEventForm`

Supports exact/month/year/approximate precision and preserves that precision through display. Validation explains why information is requested.

### 19.4 `PatternCard`

Appears only when sufficient real events support a retrospective pattern. It lists contributing entries and never rewrites or diagnoses the user's life.

---

## 20. State components

### 20.1 One state vocabulary

| State | Meaning | Visual component |
|---|---|---|
| Loading | Request expected and pending | `LoadingState` / shaped skeleton |
| Empty | Supported, completed, no user/data items | `EmptyState` |
| Unavailable | Required capability/input absent | `UnavailableState` |
| Partial | Some trusted sources succeeded | `PartialDataNotice` + visible content |
| Stale | Last successful data shown after freshness boundary | `StaleDataNotice` |
| Error | Supported request failed | `ErrorState` |
| Offline | Network unavailable | `OfflineNotice` |
| Unauthorized/session expired | Access cannot continue | `SessionState` |
| Saving | Mutation pending | Inline control state |
| Saved | Mutation confirmed | Non-disruptive status/toast |
| Destructive pending | Awaiting explicit confirmation | `AlertDialog` |

### 20.2 Scope variants

Every state component has:

- `inline`: one row or small module.
- `panel`: a card/section.
- `page`: route-critical state.

Do not use a full-page spinner when only one independent Today card is loading.

### 20.3 `AsyncBoundary`

A composition helper may normalize view states, but it must not own fetching. It requires explicit content for loading, empty, unavailable, partial and error. Stale data remains visible with a notice rather than being replaced by a spinner.

### 20.4 Skeleton rules

- Match final component geometry closely.
- Do not animate under reduced motion.
- Do not show fake chart values or text.
- Keep layout stable.
- Use `aria-hidden`; one parent status communicates loading.

### 20.5 Error rules

- State what failed.
- State what remained unchanged where meaningful.
- Offer Retry only if retry is safe.
- Do not swallow mutation failures.
- Preserve partial user input.

---

## 21. Feedback, alerts and notifications

### 21.1 `InlineNotice`

Information, success, warning and danger variants. Astrology-specific “challenging” language is not a feedback tone.

### 21.2 `Toast`

For confirmed low-complexity outcomes such as copied, saved or preference updated. It is not the only location for errors that require correction. Critical/destructive errors persist inline.

### 21.3 `ProactiveBanner`

Shows time-bounded guidance with reason, source, dismiss and settings control. No fear, scarcity or paywall conversion pattern.

### 21.4 `ProgressStatus`

Used for chart generation, exports or longer tasks. Determinate only when true progress exists; otherwise labelled indeterminate. Completion has text, not confetti alone.

---

## 22. Responsive component transformations

| Component | Compact | Medium | Expanded |
|---|---|---|---|
| Primary navigation | Five-item bottom bar | Bottom bar or labelled rail by space | Labelled world rail |
| World header | Stacked title/context | Two-row | Title/context/actions aligned |
| Context dock | Sticky compact bar + bottom sheet | Inline bar + sheet | Inline lenses + popover/detail |
| Bento grid | One narrative stack | 2-column selective spans | 12-column narrative layout |
| Chart inspector | Bottom sheet | Side sheet | Persistent side panel when useful |
| Timeline | Vertical | Vertical + side detail | Overview axis + detail pane |
| Conversation history | Modal sheet | Collapsible rail | Persistent/resizable side panel |
| Ask composer | Full-width dock above nav/keyboard | Centered dock | Centered max-width dock |
| Compatibility | Stacked two-person header | Split summary | Side-by-side evidence groups |
| Technical tables | Scroll region/card rows | Scroll/table | Full table with sticky headers |
| Dialog task | Bottom drawer when touch-friendly | Centered dialog | Centered dialog |

Source order, accessible names and action consequences stay constant across transformations.

---

## 23. Accessibility contracts

### 23.1 Keyboard and focus

- Every action is keyboard reachable.
- Focus order follows reading/task order.
- Sheets/dialogs trap focus correctly and restore it to the trigger.
- Route changes move focus to the page title or announced content landmark.
- Roving tabindex is used only for composite widgets that require it.
- No custom single-key shortcut is active in text inputs or without discoverability/control.

### 23.2 Screen readers

- One `main` landmark per rendered shell.
- Primary/secondary nav labels are unique.
- Charts provide accessible data summaries or tables.
- Timelines provide chronological list/table equivalents.
- Streaming uses phase/final announcements without token-by-token noise.
- Loading, saved and error states use appropriate live-region politeness.
- Decorative planets, grain, lotus corners and waveforms are hidden.

### 23.3 Touch and gesture

- Preferred 44px targets.
- Swipe/drag has button alternatives.
- Pinch/zoom never disables browser zoom.
- Destructive and safe actions are spatially separated.
- Hover-only actions remain visible on touch and keyboard focus.

### 23.4 Language and reflow

- No fixed heights for translated copy.
- Hindi/Marathi labels may wrap before icons shrink or text truncates.
- Technical Sanskrit terms retain definitions.
- `lang` changes at the correct scope for pronunciation.
- Every component is tested at 200% text and 320px width.

### 23.5 Motion/transparency

- Component variants consume global reduced-motion/transparency token mappings.
- No state is encoded by glow, movement or glass alone.
- Canvas waveform and ceremonial reveals have static alternatives.

---

## 24. Backend and business-logic integrity

### 24.1 Presentation boundary

The target dependency flow is:

```text
Existing query/mutation/Edge Function
              ↓
Compatibility adapter / view model
              ↓
Explicit component state + authoritative values
              ↓
Rendered UI and emitted user intent
```

The adapter can rename fields for presentation and distinguish states. It cannot alter values or create new astrological rules.

### 24.2 Required view-state distinctions

Every feature adapter must distinguish at minimum:

- `data` absent because loading.
- `data` absent because valid empty/not detected.
- `data` absent because required input missing.
- `data` absent because provider/query failed.
- cached data present but stale.
- partial source success.

### 24.3 Identity and time integrity

- Subject labels derive from authorized records/route state.
- Applied context derives from actual response/query metadata.
- Time labels include the source date/timezone and never infer support.
- Query keys continue to include every dimension required to prevent cross-subject/time leakage.
- Sign-out/session loss clears protected presentation state as defined by current auth behavior.

### 24.4 Mutation integrity

- Buttons emit one named intent per activation.
- Pending controls prevent accidental duplicate mutations where current behavior requires it.
- Optimistic UI includes rollback and visible failure.
- Destructive scope is displayed before confirmation.
- A toast never announces success before the underlying mutation confirms unless explicitly labelled pending.

### 24.5 Chat integrity

- One composer instance survives empty/active-state transitions.
- Current buffered saved-person first-turn path remains distinct until streaming parity is separately implemented.
- Abort, partial stream, retry, regenerate and provenance hydration remain separate states.
- Components do not fabricate provenance or treat a pending Subject lens as applied.

### 24.6 Accuracy statement

The component system is designed to preserve current backend architecture and business logic by construction, but design documentation alone cannot guarantee “100% accurate.” That confidence comes later from contract tests, synthetic fixtures, parity checks, visual state coverage and controlled incremental migration. No component is considered complete merely because it looks correct.

---

## 25. Current-to-target component disposition

| Current component/family | Disposition | Target role |
|---|---|---|
| `src/components/ui/*` Radix/shadcn layer | Retain and audit | L1 accessible primitives |
| `AppShell` | Evolve carefully | `CosmicAppShell` + five-world navigation |
| Current floating chat button | Retire after nav migration | Ask becomes a world destination |
| `OnboardingShell` | Evolve | Dedicated focused-flow shell |
| `Card` / repeated route cards | Retain base, add semantics | `CosmicCard`, `SectionFrame`, bento compositions |
| `ExpandableSection` | Evolve | Content-depth disclosure with evidence states |
| `ChartFrame` / `LotusCorners` | Retain contract, restyle | Presentational truth frame |
| `DashaTimeline` | Evolve without recalculation | Shared temporal components + accessible equivalent |
| `TodaySection` and summary cards | Decompose gradually | Daily hero and supporting semantic cards |
| `TransitHighlightBand` | Evolve | `TimingRibbon` with context/evidence |
| `DoshasSection` | Decompose | `DoshaResultCard` + method/evidence |
| `RemediesSection` | Decompose | `RemedyCard` + optional-practice language |
| Ashtakavarga/Numerology/Lo Shu modules | Wrap/decompose selectively | Technical/other-lens feature modules |
| Chat route-local UI | Extract behind parity | Ask shell, message, composer, navigator |
| `RecordingWaveform` | Retain as enhancement | `AudioWaveform` inside semantic recording dock |
| Settings primitives | Consolidate | Standard form/group, memory/privacy composites |
| Current state components | Expand and normalize | Complete state vocabulary and scopes |
| `Starfield` | Restrict | Atmosphere asset for limited signature moments |

No disposition authorizes deletion. Retirement occurs only after route parity and user-approved implementation gates.

---

## 26. Component inventory by ownership

### Foundation team / shared UI

- ActionButton, IconButton, TextAction.
- Field and input families.
- Tabs, Disclosure, Menu, Tooltip, Popover.
- Dialog, AlertDialog, Sheet, Drawer.
- Table, ScrollArea, Separator.
- Toast, InlineNotice, ProgressStatus.
- Loading/Empty/Unavailable/Partial/Stale/Error/Offline/Session states.

### Design-system/product UI

- CosmicCard, InsightBentoGrid, AtmosphereFrame, SectionFrame, GlassControlBar.
- ClaimLabel, EvidenceChip, EvidenceStrip, EvidenceDrawer.
- DepthControl, AvailabilityBadge, FreshnessLabel.
- ContextDock, SubjectLens, TimeLens, ContextPreviewSheet, AppliedContextStrip.

### Navigation/platform

- CosmicAppShell, DesktopWorldRail, MobileWorldBar, WorldHeader.
- ProfileLauncher, ProfileUtilityMenu, BackAction, BreadcrumbTrail, LocalSectionNav.

### Astrology features

- DailySignalHero, TimingRibbon, PanchangStrip, DailyPracticeCard.
- ChartStage, ChartFrame, ChartViewport, ChartToolbar, ChartInspector.
- ChartSelection, ChartLegend, PlanetTable, HouseTable.
- DoshaResultCard, RemedyCard, ScoreModule, ExperimentalMarketCard.
- TemporalCanvas, DashaTimeline, JourneyTimeline, EventNode, EventCard.

### Ask, voice and memory

- AskShell, ConversationNavigator, AskEmptyState, MessageGroup.
- StreamingStatus, AskComposer, PromptStarter, MessageActions.
- VoiceInputButton, VoicePermissionPrimer, RecordingDock, AudioWaveform.
- TranscriptPreview, ReadAloudControl.
- MemoryStatus, MemoryDisclosure, MemoryTopicCard, RetentionSelector.
- LearnedPreferenceCard, MemoryDangerZone.

### Connections and Journey

- PersonCard, PersonPicker, RelationshipHeader.
- CompatibilityOverview, CompatibilityDimension, RelationshipPrompt.
- JournalComposer, ReflectionCard, LifeEventForm, PatternCard.

---

## 27. Validation strategy

### 27.1 Component state matrix

Each product component must be demonstrated with synthetic fixtures for:

- Dawn/Midnight.
- English/Hindi/Marathi.
- Compact/expanded layout.
- Default/focus/pressed/disabled.
- Loading/ready/empty/limited/unavailable/stale/error.
- Reduced motion/transparency and increased contrast.
- Long names, long translations, extreme values and missing optional fields.

### 27.2 Interaction tests

- Keyboard and focus return.
- Dialog/sheet dismissal and destructive confirmation.
- Context pending/applied transitions.
- Chart selection synchronization.
- Timeline chronological traversal.
- Composer IME, mobile keyboard, safe-area and persistent-instance behavior.
- Voice permission/record/cancel/transcribe failures.
- Memory optimistic update/rollback and two-step deletion.

### 27.3 Contract tests

- Adapters preserve exact backend values.
- Valid absence differs from provider failure.
- Unauthorized saved-person identifiers never render private context.
- Applied context matches request/response metadata.
- Chat streaming and buffered results map to the same visible state vocabulary.
- No raw prompt text or sensitive data enters URLs through a component.

### 27.4 Visual regression

Golden states should prioritize:

- Five-world shell.
- Daily Signal hero.
- Kundali chart + inspector.
- Dasha and Journey timelines.
- Ask empty, streaming, partial-failure and applied-context states.
- Compatibility low-score/dosha-safe state.
- Memory privacy/destructive flows.
- 320px Hindi/Marathi and 200% text.

### 27.5 Performance checks

- Component mount does not duplicate queries.
- Offscreen ceremonial assets are not loaded eagerly.
- Long conversations/history remain responsive at measured realistic sizes.
- Canvas/audio animation stops when inactive.
- Expanding Technical detail does not block the Simple layer.
- One ambient-effect-per-viewport rule is enforced in composition review.

---

## 28. Anti-patterns

- One new card component per route.
- A universal `variant` prop with dozens of visual options.
- Data fetching inside low-level presentational components.
- Generic absence displayed as “No dosha.”
- Scores styled as probabilities.
- Evidence text generated without an evidence reference.
- Glass around tables, reports or warnings.
- Nested carousels or horizontal scroll as default mobile organization.
- Hover-only message/chart controls.
- Auto-sending prompt starters or Ask-from-anywhere handoffs.
- Context selection that changes the chip before the data actually changes.
- Rebuilding Radix semantics with styled `div` elements.
- Using red for difficult astrology or gold glow on every selected card.
- Hard-coded English widths/heights.
- Component success judged only through screenshots.

---

## 29. Acceptance checklist

Action 1.6 can be approved when the user agrees that:

- The component architecture is layered from accessible primitives to world compositions.
- Existing Radix/shadcn primitives are retained and audited rather than blindly replaced.
- Product components consume explicit semantic state and do not recalculate business logic.
- Five-world navigation replaces the long-term floating-chat/three-tab model.
- Subject, Time and applied context remain separate, capability-aware component states.
- Bento layouts follow narrative order and collapse predictably.
- Chart output is wrapped unchanged initially, with accessible inspection/equivalents.
- Simple/Detailed/Technical depth and evidence/provenance are first-class components.
- Today, timelines, Ask, voice, memory, compatibility and states have complete component families.
- Valid empty, unavailable, partial, stale and failed states remain distinct.
- Responsive transformations preserve source order, semantics and actions.
- Every consequential action is controlled and has explicit pending/failure behavior.
- The current-to-target disposition table is accepted as migration guidance, not deletion authorization.
- Component completion requires contract, interaction, accessibility, visual and performance validation.

---

## 30. Decision log

| Decision | Alternatives | Reason |
|---|---|---|
| Use layered component architecture | Route restyling; universal page renderer | Balances reuse, feature specificity and low migration risk. |
| Retain accessible primitives | Rebuild controls | Preserves proven semantics and reduces regression surface. |
| Use semantic finite states | Boolean combinations | Prevents contradictory or dishonest UI. |
| Keep consequential state controlled | Local component mutation | Preserves route/backend authority. |
| Make Ask a world destination | Keep floating sixth action | Aligns navigation with approved IA. |
| Use narrative bento presets | Equal tile/masonry grid | Protects reading order and localization. |
| Separate context pending/applied | One selected chip state | Keeps visible context truthful. |
| Make evidence a component family | Put provenance in ad hoc footnotes | Ensures trust and progressive depth across features. |
| Wrap chart output before redrawing | Rebuild chart engine during visual work | Preserves calculation/rendering contracts. |
| Give timelines a shared visual grammar, not shared data model | Force Dasha/events into one schema | Reuses behavior without corrupting domain meaning. |
| Preserve one Ask composer instance | Remount by thread state | Protects focus, mobile keyboard and recording behavior. |
| Treat waveform as enhancement | Make canvas the recording state | Keeps voice usable across failure/accessibility modes. |
| Expose memory categories distinctly | One “memory on/off” abstraction | Matches current retention/control realities. |
| Expand state vocabulary | Loading/error only | Real product reliability requires partial, stale and unavailable states. |
| Use compatibility adapters | Bind redesigned UI directly to raw responses | Makes mapping explicit and testable without altering backend logic. |
| Validate behavior and contracts, not screenshots alone | Visual review only | Premium appearance cannot prove correctness. |

---

## 31. Approval record

The user approved the component architecture, inventory, responsibilities, state vocabulary and migration boundaries on 8 September 2026.

Action 1.6 is complete. The approval authorizes subsequent design/prototype actions one at a time; it does not authorize components, CSS, routes, assets, queries, database or Edge Function implementation.
