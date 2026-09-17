# AstroSaathi 3.0 — Five Hero Journey Prototypes

**Action:** 1.7 — Prototype the five hero journeys  
**Status:** Approved 8 September 2026  
**Created:** 8 September 2026  
**Type:** Interactive concept prototype and UX specification only  
**Implementation authorization:** None  
**Interactive prototype:** `astrosaathi-hero-journeys.html` in the task-owned Codex visualization workspace  
**Companion documents:** [Future information architecture](./ASTROSAATHI_FUTURE_INFORMATION_ARCHITECTURE.md), [global context behavior](./ASTROSAATHI_GLOBAL_CONTEXT_BEHAVIOR.md), [content system](./ASTROSAATHI_CONTENT_AND_ETHICAL_LANGUAGE_SYSTEM.md), [design tokens](./ASTROSAATHI_DESIGN_TOKEN_SYSTEM.md), [component system](./ASTROSAATHI_COMPONENT_SYSTEM.md), [backend contract map](./ASTROSAATHI_FRONTEND_BACKEND_CONTRACT_MAP.md)

---

## 1. Purpose

This action tests whether the approved AstroSaathi 3.0 system works as complete user journeys rather than isolated screens. It prototypes the five highest-value loops across mobile and desktop:

1. New user → first personalized insight.
2. Today → transit evidence → Ask.
3. Chart → house exploration → contextual question.
4. Person → compatibility → relationship conversation.
5. Life event → timeline → journal reflection.

The goal is not visual polish for its own sake. Each journey must prove orientation, progressive disclosure, context integrity, emotional safety and compatibility with current backend contracts.

---

## 2. Boundary

This action does **not**:

- Modify the production application.
- Create React components, routes, CSS tokens or assets in `src`.
- Invoke Supabase, create users or use real customer information.
- Change authentication, onboarding, chart, chat, compatibility, event or journal behavior.
- Claim that every prototype control is currently supported.
- Approve new arbitrary-date, relationship-timing or structured-chat-context backend capabilities.
- Begin Phase 2 fixtures or test infrastructure.

The interactive prototype is a self-contained conceptual walkthrough with synthetic names and content. It demonstrates intended hierarchy and transitions, not production data or exact final copy.

---

## 3. Understanding lock

### 3.1 Confirmed intent

1. The reimagined app must be premium and playful while keeping chart evidence more important than decoration.
2. Users navigate through Today, My Cosmos, Ask, Journey and Connections.
3. Simple meaning leads; Detailed evidence and Technical method remain available on demand.
4. Subject, Time and source context are previewed before Ask and shown as applied only after the system actually uses them.
5. No prototype may conceal current backend limitations behind a convincing interaction.
6. Mobile is the baseline; desktop uses additional space for persistent orientation and simultaneous evidence.
7. Every happy path needs recovery paths for loading, partial, unavailable, stale, permission and mutation failure.

The user's approval of the IA, context, content, token and component systems and instruction to proceed are treated as confirmation of this understanding.

### 3.2 Assumptions

- “Prototype” means an interactive annotated concept sufficient to approve journey hierarchy, not a production-code prototype.
- Synthetic user **Anaya** and saved person **Aarav** are illustrative and contain no real data.
- The first chart reveal may use Ascendant, Moon and Nakshatra only when each value is available from authoritative chart data.
- Ask-from-anywhere continues to use current `seed` and optional saved-person bridge until a future contract is approved.
- Current authenticated users bypass onboarding according to stored state.
- Event and journal stamping remains best-effort after the user record is safely persisted.

### 3.3 Non-functional requirements

- **Performance:** first meaning appears before decorative media; the prototype assumes progressive loading and bounded atmosphere.
- **Scale:** the flows remain usable with long conversations, ten saved people, long translations and many life events.
- **Privacy/security:** no sensitive content in URLs, analytics or unauthorised subject previews.
- **Reliability:** state transitions never replace missing/failed data with plausible generic results.
- **Maintenance:** every screen is composed from the approved component inventory rather than journey-specific controls.
- **Measurement:** success is defined through comprehension and task completion, not engagement alone.

### 3.4 Deferred implementation questions

- Exact final routes for the five new world landing pages.
- Whether structured applied-context metadata is available before or after early UI migration.
- Which existing chart interactions can be supported without changing returned SVG markup.
- Whether a standalone component workshop is introduced in Phase 2/3.

---

## 4. Prototype approaches considered

### A — Static flow diagrams only

Fast and precise for route/data relationships, but unable to test hierarchy, density, progressive disclosure or mobile/desktop transformation.

**Decision:** insufficient by itself.

### B — High-fidelity disconnected screen gallery

Visually persuasive, but it can hide broken transitions and implies implementation detail before contracts are ready.

**Decision:** rejected for this gate.

### C — Annotated, step-through journey prototype

One interactive frame switches among the five journeys, lets the reviewer advance through steps and compare desktop/mobile composition. Every step includes a visible contract-preservation note.

**Decision:** recommended and produced. It is detailed enough to validate flows while remaining intentionally non-production.

---

## 5. Shared journey grammar

Every hero journey uses the same six-part rhythm:

```text
Orient → Choose → Preview → Commit → Confirm → Continue
```

- **Orient:** show world, subject, time and current state.
- **Choose:** provide one clear next action without auto-commit.
- **Preview:** expose data/context/consequence before a consequential action.
- **Commit:** submit exactly one explicit user intent.
- **Confirm:** distinguish accepted, saved, pending and failed.
- **Continue:** offer one primary continuation and one lower-emphasis alternative.

Not every path renders six separate screens, but every consequence respects this order.

### 5.1 Context grammar

Each personalized screen answers:

- **Who?** Self, saved person or relationship pair.
- **When?** Now, exact date, approximate date or calculated period.
- **From what?** Applied chart/timing/event/compatibility evidence.
- **At what depth?** Simple, Detailed or Technical.

### 5.2 Transition grammar

- World navigation changes place, not hidden subject/time semantics.
- Local selection does not update global applied context prematurely.
- Ask handoff always pauses at an editable preview.
- Destructive or private attachment actions require literal consequence copy.
- Completion animation never masks pending backend work.

---

## 6. Shared shell prototype

### 6.1 Desktop

- Persistent labelled rail for five worlds.
- Profile utility separated from primary navigation.
- World header with Subject and Time lenses.
- Main content capped to an intentional reading/data width.
- Evidence/detail can occupy a stable second column.
- Ask is a primary world, not a floating sixth destination.

### 6.2 Mobile

- Five-world bottom navigation with Ask emphasized inside the bar.
- Compact world header and visible Subject; Time may compress but remains discoverable.
- Detail/inspector becomes a bottom sheet or in-flow expansion.
- One-column narrative order.
- Composer docks above keyboard and navigation safe area.
- No action depends on hover or a right-side panel.

### 6.3 Shared visual behavior

- One atmosphere per screen.
- Solid truth/reading panels.
- Glass restricted to controls/navigation.
- Evidence is visible but quiet in Simple mode.
- Playful light/shape response stops in sensitive, destructive or financial moments.

---

## 7. Journey 1 — New user to first personalized insight

### 7.1 User intent

“Show me why this is worth my birth details, help me enter them safely and give me a meaningful first result.”

### 7.2 Success moment

The user reaches My Cosmos, understands one personalized pattern, can identify at least one source fact and knows how to explore or ask without being forced into either.

### 7.3 Storyboard

| Step | Screen/state                  | Primary content                                              | Main action           | Contract protected                                   |
| ---- | ----------------------------- | ------------------------------------------------------------ | --------------------- | ---------------------------------------------------- |
| 1    | Public welcome                | Kundali-grounded promise, language and privacy orientation   | Create my cosmos      | Signed-in users route by existing onboarding state   |
| 2    | Consent                       | Required age/terms/privacy separated from optional memory    | Continue              | Consent receipt version and profile onboarding state |
| 3    | Birth details                 | Date, time, place, precision and why each matters            | Calculate my chart    | Existing geocoding/timezone/upsert behavior          |
| 4    | Profile saved/chart preparing | Honest save confirmation and non-blocking chart preparation  | Continue to My Cosmos | `prime-charts` remains conditional/fire-and-forget   |
| 5    | First reveal                  | Ascendant, Moon, Nakshatra or only values actually available | Explore my chart      | Chart resources remain authoritative                 |
| 6    | Personalized insight          | Simple meaning + evidence + depth choices                    | Explore or Ask        | Ask preview does not auto-send                       |

### 7.4 First reveal hierarchy

1. Completion acknowledgment: “Your chart is ready” only when the required chart resource is actually available.
2. One visual chart/identity anchor.
3. One sentence of personalized meaning.
4. Up to three calculated facts.
5. “Why this?” evidence disclosure.
6. Explore Kundali and Ask actions.

Do not introduce doshas, remedies, market signals or a dense report in the first emotional payoff.

### 7.5 Mobile behavior

- Focused onboarding shell hides five-world navigation until onboarding is complete.
- One field group per understandable chunk, not necessarily one field per page.
- Place lookup result and timezone are visible before save.
- Unknown birth time is a real choice with an explanation of limitations.
- First reveal occupies one screenful where practical; Technical detail stays collapsed.

### 7.6 Desktop behavior

- Birth form and benefit/precision explanation may form a two-column composition.
- The second column cannot display fake chart data before calculation.
- First reveal may place the chart beside the insight/evidence column.
- Keyboard focus follows form order, then result heading after completion.

### 7.7 Recovery and edge paths

#### Existing authenticated user

Skip language/auth/complete onboarding as stored state requires. Never overwrite existing birth data because the landing CTA was selected.

#### Email confirmation or OAuth delay

Show a real auth transition state. Do not render protected chart placeholders containing personal-looking sample data.

#### Place unresolved

Keep entered values, explain resolution requirement and offer search correction. Do not silently save approximate coordinates unless the current contract supports and labels them.

#### Unknown/approximate time

Allow completion with visible limitations. House-based facts are limited/unavailable, not inferred.

#### Profile saved but chart request fails

Land in My Cosmos with profile-safe confirmation plus retry/unavailable state. Do not send the user back through consent or lose birth details.

### 7.8 Validation tasks

- New user can explain why time/place is requested.
- Optional memory is not mistaken for required consent.
- User recognizes whether their time is exact, approximate or unknown.
- First insight is correctly identified as interpretation supported by chart facts.
- User can reach chart exploration or an editable Ask preview.

---

## 8. Journey 2 — Today to transit evidence to Ask

### 8.1 User intent

“Tell me what matters today, show why it is relevant to me and let me ask a grounded follow-up.”

### 8.2 Success moment

The user can distinguish a personalized timing insight from a general horoscope, inspect the strongest evidence and begin a question with the intended context visible.

### 8.3 Storyboard

| Step | Screen/state    | Primary content                                            | Main action       | Contract protected                           |
| ---- | --------------- | ---------------------------------------------------------- | ----------------- | -------------------------------------------- |
| 1    | Today           | One daily signal, date, timezone and personalization label | Why this today?   | Current date/timezone logic unchanged        |
| 2    | Evidence detail | Strongest transit/Dasha reasons and limitations            | Ask about this    | Only applied sources labelled                |
| 3    | Ask preview     | Self + Now + selected sources + editable seed              | Continue to Ask   | No auto-send; unsupported sources excluded   |
| 4    | New Ask         | Editable question in persistent composer                   | Send              | Existing conversation/stream start           |
| 5    | Grounded answer | Meaning, evidence, range, agency and provenance            | Follow up/explore | Persisted metadata remains provenance source |

### 8.4 Today hierarchy

1. Date and timezone.
2. Personalized/general distinction.
3. Daily Signal hero.
4. Current timing evidence.
5. Supporting Panchang/horoscope/practice modules.
6. Visually separated experimental markets.

Independent module loading/failure remains independent. A successful Daily Horoscope cannot hide a failed transit source inside a combined confident story.

### 8.5 Ask preview payload at current capability

The first implementation bridge may contain:

- Editable `seed` question.
- Self as implicit subject.
- Human-readable preview of Today source.

It may not claim that a structured time/evidence envelope reached `astrologer-chat` until that contract exists. The preview must distinguish “used to prepare your question” from “applied by the answer.”

### 8.6 Mobile behavior

- Daily Signal appears before supporting cards.
- Evidence opens in a sheet/in-flow region with a clear close and Ask action.
- Ask preview fits above the keyboard; source chips wrap.
- Back returns to Today without submitting or losing the original page state where feasible.

### 8.7 Desktop behavior

- Evidence can open beside the Daily Signal without obscuring the date/context.
- Continue to Ask changes world while preserving the seed draft.
- Applied-context strip remains visible above the response, not as a transient toast.

### 8.8 Recovery and edge paths

- **Transit pending:** skeleton only for transit-dependent region.
- **Transit failed, horoscope available:** show horoscope and a transit error; no blended personalized conclusion.
- **Stale current data:** show timestamp; remove “Now.”
- **Seed removed:** Ask remains a blank new conversation.
- **Network loss before send:** retain local draft; show offline send state.
- **Interrupted stream with partial text:** retain partial answer, label interruption and offer safe retry.

### 8.9 Validation tasks

- User identifies whether the daily card is personalized.
- User finds at least one evidence source.
- User predicts that tapping Ask will not immediately send.
- User recognizes pending versus applied context.
- User returns to Today without accidental duplicate conversation creation.

---

## 9. Journey 3 — Chart to house exploration to contextual question

### 9.1 User intent

“Help me understand this Kundali visually, then let me ask about the part I selected.”

### 9.2 Success moment

The user selects a house, sees the same selection across chart, label and inspector, understands one plain-language meaning and carries that context into an editable Ask preview.

### 9.3 Storyboard

| Step | Screen/state       | Primary content                                              | Main action          | Contract protected                    |
| ---- | ------------------ | ------------------------------------------------------------ | -------------------- | ------------------------------------- |
| 1    | My Cosmos overview | Stable anchors and current chapter                           | Open Kundali         | Existing routes/data remain canonical |
| 2    | Chart Stage        | Authoritative Rashi/Varga chart with supported controls      | Select a house       | Returned chart remains unchanged      |
| 3    | House selected     | Visual marker + House 10 label + meaning                     | Open inspector       | Local selection does not recalculate  |
| 4    | Inspector          | Simple meaning, facts, relationships and Technical expansion | Ask about this house | Only returned evidence shown          |
| 5    | Ask preview        | Self + natal chart + selected house + editable question      | Continue to Ask      | Sensitive data absent from URL        |

### 9.4 Chart interaction model

- Chart type/style controls list only values the current gateway can return.
- Chart, selection label, legend and inspector share one controlled selection.
- Visual selection uses outline/marker/text, not colour alone.
- Technical tables provide an accessible alternative to spatial geometry.
- Reset restores overview without re-fetching unchanged chart data.
- Browser zoom and page scrolling remain available.

### 9.5 House inspector hierarchy

1. House number and traditional name where approved.
2. Plain-language domain meaning.
3. Calculated facts: sign, lord, occupying planets and supported relationships.
4. Balanced natal interpretation.
5. Missing-data limitation.
6. Technical method.
7. Ask handoff.

The inspector cannot derive aspects or lordship rules independently from the trusted data adapter.

### 9.6 Mobile behavior

- Chart fills available width on a solid panel.
- Control labels may move into a “Chart options” sheet.
- Selection summary appears immediately under the chart.
- Inspector opens as a bottom sheet with enough collapsed chart still visible for orientation.
- Ask preview replaces the sheet only after explicit action.

### 9.7 Desktop behavior

- Chart and inspector can remain side by side.
- Technical table expands below or within the inspector without shifting the chart offscreen.
- Local section navigation supports Kundali, Planets, Houses and supported Vargas without turning every report into a peer tab.

### 9.8 Recovery and edge paths

- **Chart resource loading:** stable aspect-ratio skeleton with one parent status.
- **SVG unavailable but normalized data available:** accessible table and unavailable visual notice.
- **Chart error code:** map `birth_profile_incomplete`, `place_not_resolved`, `missing_coordinates` and provider failure distinctly.
- **Unsupported Varga/style:** option unavailable, never silently replaced.
- **Selected data absent:** say what is unavailable; do not produce a generic house reading labelled personal.
- **Ask context unsupported:** keep editable question but explain that the source will not be attached.

### 9.9 Validation tasks

- User can select House 10 by pointer and keyboard.
- Selected identity remains consistent across visual and inspector.
- User distinguishes calculated fact from natal interpretation.
- User finds Technical evidence without being forced through it.
- User predicts what will accompany the Ask draft.

---

## 10. Journey 4 — Person to compatibility to conversation

### 10.1 User intent

“Help me explore a relationship carefully, without reducing it to a score or losing track of whose chart is whose.”

### 10.2 Success moment

The user sees both identities, understands areas of ease and effort before any score, recognizes the score's limited scope and starts a new subject-focused conversation deliberately.

### 10.3 Storyboard

| Step | Screen/state             | Primary content                                   | Main action          | Contract protected                  |
| ---- | ------------------------ | ------------------------------------------------- | -------------------- | ----------------------------------- |
| 1    | Connections              | Saved people with relation and chart readiness    | Open person          | Owner scope and ten-person limit    |
| 2    | Person detail            | Person identity, precision and chart availability | Compare our charts   | Self profile cannot be mutated      |
| 3    | Comparison confirmation  | Self + selected person + eligible relation        | View compatibility   | Correct `related_chart_id`          |
| 4    | Compatibility overview   | Ease and effort before named score                | Explore evidence     | Guna/Mangal/synastry pair integrity |
| 5    | Evidence/dosha detail    | Method, actual factors and calm limitations       | Ask about connection | No invented severity/cancellation   |
| 6    | Relationship Ask preview | Self + person, source and editable question       | Start new Ask        | Current buffered first-turn bridge  |

### 10.4 Connections hierarchy

- Person identity and data readiness precede analysis.
- Relationship pair is repeated in the header and Subject lens.
- Compatibility starts with dynamics, not a giant percentage.
- Areas of ease and areas for conversation receive equivalent visual weight.
- Guna/Mangal/synastry modules name what they measure.
- No marriage, breakup or other-person behavior prediction appears.

### 10.5 Compatibility score presentation

Required adjacent context:

- Metric name.
- Value and denominator.
- Tradition/method.
- Plain meaning.
- What it does not predict.

Avoid radial progress that reads as “relationship success probability.” A segmented named breakdown is preferred.

### 10.6 Mobile behavior

- Both people appear in a compact relationship header without tiny text.
- Compatibility overview stacks: dynamics → ease → effort → score → dosha → evidence.
- Each identity remains visible when opening an evidence sheet.
- Relationship Ask starts in a new conversation by default.

### 10.7 Desktop behavior

- People list/person detail may use master-detail layout.
- Compatibility pairs related dimensions side by side while source order remains accessible.
- Evidence drawer can remain adjacent without hiding both identities.

### 10.8 Recovery and edge paths

- **No saved people:** explain how and why to add one.
- **Limit reached:** surface actual `related_charts_limit_reached`; do not suggest unlimited additions.
- **Unknown birth time:** show precision limitation on person and affected modules.
- **Charts preparing:** person remains saved; compatibility waits honestly.
- **Ineligible relationship type:** disable/explain comparison before invocation.
- **Deleted/unauthorized ID:** exit detail safely without showing cached content.
- **Compatibility function failure:** preserve pair header; show retry, not a zero score.
- **Only one Manglik result:** use approved calm content; no alarm/Danger red.
- **Subject switch inside active Ask:** offer new conversation rather than silently mixing people.

### 10.9 Validation tasks

- User names both people at every consequential step.
- User explains what the score does and does not mean.
- User finds both ease and effort before dosha content.
- Low-score state does not create a “doomed” interpretation.
- Ask preview correctly communicates a new relationship-focused conversation.

---

## 11. Journey 5 — Life event to timeline to journal reflection

### 11.1 User intent

“Record something that happened, see its timing context and reflect in my own words without the app rewriting my experience.”

### 11.2 Success moment

The event is safely persisted before enrichment, appears with correct date precision, and the user saves a private reflection whose authorship remains visibly separate from astrology.

### 11.3 Storyboard

| Step | Screen/state          | Primary content                                               | Main action       | Contract protected                    |
| ---- | --------------------- | ------------------------------------------------------------- | ----------------- | ------------------------------------- |
| 1    | Journey               | One chronology for events, journal and past guidance          | Add life event    | Existing record types remain distinct |
| 2    | Event form            | Title, category, precision/date and optional note             | Save event        | User event is the primary record      |
| 3    | Saved/context pending | Event confirmation plus separate stamping progress            | View timeline     | Insert precedes best-effort stamp     |
| 4    | Event on timeline     | Event/date first, calculated context second                   | Reflect on this   | Failed stamp is not “no influence”    |
| 5    | Journal composer      | Private user text + deliberate optional context               | Save reflection   | Journal persists before stamping      |
| 6    | Reflection saved      | User words first; any AI/astrology region labelled separately | Return to Journey | Content never rewritten by context    |

### 11.4 Journey hierarchy

1. Current chapter/context summary.
2. Add Event and Write Reflection actions.
3. Chronological timeline.
4. Filters by record type only when needed at real scale.
5. Event/reflection detail.

Astrology is an optional lens over autobiographical data. It is not the owner of the story.

### 11.5 Persistence sequence

```text
User confirms Save
        ↓
Persist event or journal entry
        ↓ success                     ↓ failure
Confirm saved record                  Preserve draft + show error
        ↓
Request context stamping best-effort
        ↓ success                     ↓ failure
Attach stamped context                Keep record + show retry/status
```

The prototype deliberately shows `saved + context pending` as a legitimate intermediate state.

### 11.6 Date precision

- Exact date renders an exact day.
- Month precision renders month/year.
- Year precision renders year.
- Approximate adds a visible qualifier.
- Sorting may use stored normalized values internally, but display never implies greater user certainty.
- The Time lens identifies Event date, not Now, when inspecting attached context.

### 11.7 Mobile behavior

- Vertical timeline preserves chronological order.
- Add actions remain reachable without covering the bottom navigation.
- Event form uses native-friendly date controls and visible precision choice.
- Journal editor keeps privacy/context attachment above the Save action.
- Keyboard closing/opening does not lose the draft.

### 11.8 Desktop behavior

- Timeline and selected-event detail may appear side by side.
- Journal editor retains readable measure.
- Dasha/timing evidence expands in a technical region without overpowering the event.

### 11.9 Recovery and edge paths

- **Event insert fails:** draft remains; no stamping request occurs.
- **Stamping fails:** event stays visible with retry/unavailable state.
- **Journal insert fails:** reflection draft remains local in the form state.
- **Date edited:** restamp per existing behavior.
- **Content/mood/tag-only edit:** do not restamp.
- **Entry deleted:** confirmation names record type and scope.
- **Private context selected for Ask:** explicit preview; no journal text in URL.
- **No context available:** reflection remains valid and complete.

### 11.10 Validation tasks

- User understands the event is saved before context finishes.
- User can distinguish event date precision.
- Stamping failure does not look like lost writing.
- User recognizes their own words versus generated interpretation.
- User can decline context attachment without losing the reflection.

---

## 12. Cross-journey handoff matrix

| From          | To               | Preserved                      | Previewed/pending                  | Reset                                    |
| ------------- | ---------------- | ------------------------------ | ---------------------------------- | ---------------------------------------- |
| First reveal  | My Cosmos detail | Self subject, chart section    | Local selection                    | Onboarding progress state                |
| First reveal  | Ask              | Editable seed                  | Chart source                       | No auto-send                             |
| Today         | Ask              | Self, seed                     | Now/source summary                 | Active old conversation by default       |
| Chart house   | Ask              | Self, seed                     | Selected house/chart source        | Local inspector after navigation         |
| Person        | Compatibility    | Person ID, pair identity       | Eligibility                        | Unrelated prior subject                  |
| Compatibility | Ask              | Person ID, seed                | Relationship source                | Active self-only conversation by default |
| Life event    | Journal          | Event reference/date precision | Optional context                   | Unrelated journal draft                  |
| Event/journal | Ask              | Editable seed only             | Sensitive source with confirmation | No hidden memory override                |

“Preserved” never means placed as sensitive plain text in the URL. Owner-scoped identifiers and route/search state follow the Action 1.3 privacy rules.

---

## 13. Cross-journey state matrix

| State       | New user                      | Today                    | Chart                | Compatibility       | Journey                |
| ----------- | ----------------------------- | ------------------------ | -------------------- | ------------------- | ---------------------- |
| Loading     | Auth/profile/chart            | Independent modules      | Chart/report         | Person/bundle       | Entries/context        |
| Empty       | No birth profile              | No optional module items | No selected detail   | No saved people     | No events/reflections  |
| Limited     | Unknown birth time            | Partial sources          | Missing house facts  | Person time unknown | Approximate event date |
| Unavailable | Required input absent         | Coverage absent          | Unsupported Varga    | Ineligible relation | Context cannot stamp   |
| Stale       | Existing cached profile/chart | Last current data        | Cached chart/report  | Cached bundle       | Older list/context     |
| Error       | Save/provider                 | Module/stream            | Mapped gateway error | Person/function     | Save/stamp             |
| Offline     | Preserve form                 | Show cached with date    | Show cached if safe  | No new comparison   | Preserve draft         |

No journey collapses all these states into a spinner or generic empty card.

---

## 14. Content and ethical checks in the prototype

- No deterministic future claim.
- No “perfect match” or relationship-success percentage.
- No dosha curse/fear language.
- No remedy used as an onboarding or compatibility conversion hook.
- No medical, pregnancy, lifespan or financial direction.
- Experimental markets remain outside the five hero flows except as a separated Today module.
- AI interpretation is labelled separately from chart fact and user-authored reflection.
- User agency closes every interpretation.
- Playfulness is reduced during consent, errors, privacy, compatibility sensitivity and destructive actions.

---

## 15. Backend integrity matrix

| Journey             | Current contract used                                                                        | Prototype must not imply                                                   |
| ------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| First insight       | Auth/onboarding, birth-profile upsert, conditional `prime-charts`, chart gateway             | Blocking chart priming, invented values, chart ready before response       |
| Today → Ask         | Today queries, `daily-horoscope`, current `seed`, chat stream                                | Arbitrary-date grounding or structured source envelope                     |
| Chart → House       | Chart gateway resources/reports                                                              | Client-side recalculation or unsupported SVG semantics                     |
| Compatibility → Ask | `related_charts`, `person-charts`, `compatibility`, buffered `subject_related_chart_id` turn | Arbitrary pairs, streaming subject parity or deterministic verdict         |
| Event → Journal     | Life/journal tables, best-effort context functions                                           | Atomic save+stamp, lost record on stamp failure or automatic AI attachment |

The prototype is considered misleading if a reviewer reasonably infers a capability that the current system cannot perform and the UI does not label it as pending/future.

---

## 16. Privacy and analytics boundaries

### Allowed journey analytics

- Anonymous step/view identifier.
- Completion/abandonment at a broad step.
- Error category/code without private payload.
- Depth-control use.
- Ask preview opened, cancelled or explicitly submitted.
- Accessibility preference and viewport category when collected under policy.

### Prohibited analytics payloads

- Birth date/time/place.
- Name or saved-person identity.
- Chart positions or full chart JSON.
- Chat prompt or answer text.
- Event/journal content.
- Compatibility details tied to identity.
- Memory contents.

Completion measurement must never require logging the content that made the journey meaningful.

---

## 17. Usability validation plan

### 17.1 Participant mix

The eventual moderated prototype review should include:

- Beginners unfamiliar with Vedic terms.
- Regular astrology users.
- Advanced users who inspect Dashas/houses.
- English, Hindi and Marathi readers.
- Mobile-first and desktop users.
- At least some keyboard/screen-reader and reduced-motion users.

### 17.2 Core questions

For every journey, observe whether the user can answer:

1. Where am I?
2. Whose information am I viewing?
3. What time/date/period is active?
4. Is this a fact, traditional interpretation, AI synthesis or my own writing?
5. What will happen if I select the primary action?
6. Has anything already been saved or sent?
7. How do I inspect evidence or recover from failure?

### 17.3 Proposed success thresholds

These are validation targets, not invented current metrics:

- ≥90% correctly identify world, subject and primary next action without help.
- ≥85% correctly distinguish calculated fact from interpretation.
- ≥90% predict that Ask previews do not auto-send.
- 100% of tested flows preserve user input through simulated recoverable failures.
- 0 critical accessibility blockers in keyboard/screen-reader task completion.
- No participant interprets compatibility score as guaranteed relationship success after reading the adjacent explanation.
- No participant interprets stamp failure as event/journal loss.

### 17.4 Comprehension over speed

Task time is secondary for first-use evidence and consent steps. The primary measures are correct understanding, safe expectation and successful recovery. Routine return journeys may later optimize time-on-task.

---

## 18. Prototype review script

### Task 1

“You are new to AstroSaathi. Create your profile, use an unknown birth-time path, and explain what the first result can and cannot tell you.”

### Task 2

“Find what matters today, identify why AstroSaathi says it, and prepare a question without sending it.”

### Task 3

“Open your Kundali, inspect the tenth house, find the exact evidence and prepare a question about it.”

### Task 4

“Compare your chart with Aarav, explain what the compatibility score means, and start a separate relationship-focused question.”

### Task 5

“Record a career event with approximate month precision, continue after context stamping fails, and write a private reflection without attaching it to Ask.”

The reviewer should not coach component names or reveal the expected route.

---

## 19. Prototype limitations

- The walkthrough uses conceptual geometry rather than real Kundali SVG output.
- It does not test actual authentication, keyboard viewport behavior, streaming or audio permission.
- Desktop/mobile toggle demonstrates composition, not final pixel-perfect breakpoints.
- Copy is English-only in the interactive artifact; the specification defines Hindi/Marathi validation requirements.
- It does not resolve future structured context metadata.
- It cannot prove performance, RLS, persistence or calculation parity.
- It is not a substitute for Phase 2 fixtures, contract tests or end-to-end smoke coverage.

---

## 20. Acceptance checklist

Action 1.7 can be approved when the user agrees that:

- The five journeys represent the correct first prototype priorities.
- Each flow uses Orient → Choose → Preview → Commit → Confirm → Continue.
- Mobile and desktop retain the same meaning and action consequences.
- First chart reveal occurs in My Cosmos and avoids premature sensitive content.
- Today clearly separates personalized evidence from general modules.
- Ask handoffs preview editable context and never auto-send.
- Chart selection remains synchronized and does not imply client recalculation.
- Compatibility begins with dynamics and both identities, not a verdict score.
- Relationship Ask starts a new conversation by default.
- Events/journal entries persist before best-effort context stamping.
- User-authored reflection remains primary and separate from AI/astrology.
- Every journey distinguishes loading, empty, limited, unavailable, stale and error.
- The prototype's current-contract limitations are explicit.
- Phase 2 does not begin until separately authorized.

---

## 21. Decision log

| Decision                                                    | Alternatives                                         | Reason                                                                            |
| ----------------------------------------------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------- |
| Build an annotated step-through prototype                   | Static flow only; disconnected high-fidelity screens | Validates transitions and responsive hierarchy without premature production work. |
| Prototype five cross-world loops                            | Prototype every route separately                     | These journeys exercise the highest-value shared components and contracts.        |
| Use one shared shell                                        | Custom shell per journey                             | Tests the five-world architecture rather than art-directed exceptions.            |
| Use Orient → Choose → Preview → Commit → Confirm → Continue | Immediate action shortcuts                           | Makes consequences predictable and protects consent/context integrity.            |
| Reveal chart in My Cosmos                                   | Send new users directly to Today/Ask                 | Establishes evidence foundation and rewards birth-profile completion.             |
| Keep chart priming non-blocking                             | Wait for every report                                | Preserves current contract and reduces onboarding fragility.                      |
| Preview every Ask handoff                                   | Auto-send source prompt                              | Protects agency, privacy and conversation intent.                                 |
| Use current `seed` bridge honestly                          | Depict future context envelope as current            | Prevents prototype from promising unsupported grounding.                          |
| Wrap authoritative chart output                             | Redesign chart calculation/render engine             | Isolates visual work from accuracy-critical logic.                                |
| Put dynamics before compatibility score                     | Lead with total score                                | Reduces fatalistic interpretation.                                                |
| Start new relationship Ask                                  | Mutate current conversation subject                  | Avoids identity mixing.                                                           |
| Confirm save before context stamping                        | Treat save+stamp as atomic                           | Matches current resilient persistence sequence.                                   |
| Make user writing primary                                   | Blend journal and generated interpretation           | Preserves authorship and emotional safety.                                        |
| Measure comprehension first                                 | Optimize clicks/time first                           | Trust and correct expectation are the critical early risks.                       |

---

## 22. Approval record

The user approved the five flows, mobile/desktop transformations and contract limitations on 8 September 2026.

Action 1.7 and Phase 1 product/design specification are complete. The approval does not authorize production UI implementation; subsequent test and implementation actions remain individually gated.
