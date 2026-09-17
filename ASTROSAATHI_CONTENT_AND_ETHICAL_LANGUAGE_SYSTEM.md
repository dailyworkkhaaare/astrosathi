# AstroSaathi 3.0 — Content Hierarchy and Ethical Language System

**Action:** 1.4 — Define content hierarchy and ethical language  
**Status:** Approved 8 September 2026  
**Created:** 8 September 2026  
**Type:** Content specification only  
**Implementation authorization:** None  
**Approved product structure:** Today, My Cosmos, Ask, Journey and Connections  
**Approved visual direction:** 70% Midnight Rasa + 20% Dawn warmth/readability + 10% Prism precision  
**Companion documents:** [Master redesign plan](./ASTROSAATHI_3_REDESIGN_PLAN.md), [future information architecture](./ASTROSAATHI_FUTURE_INFORMATION_ARCHITECTURE.md), [global context behavior](./ASTROSAATHI_GLOBAL_CONTEXT_BEHAVIOR.md), [backend contract map](./ASTROSAATHI_FRONTEND_BACKEND_CONTRACT_MAP.md)

---

## 1. Purpose

This document defines how AstroSaathi turns astrological data into language that feels premium, warm and useful without presenting interpretation as certainty. It governs information depth, claim labels, tone, sensitive-topic boundaries, state copy, localization and content quality across every screen.

The content north star is:

> **Meaning first. Evidence second. Method on demand. Agency always.**

The system should feel like a calm, perceptive guide: culturally literate, emotionally intelligent and technically exact when requested. Playfulness belongs in discovery, metaphor and celebration—not in warnings, distress, money, health or relationship vulnerability.

---

## 2. Boundary: what this action does not change

This action does **not**:

- Rewrite prompts, translations or production copy.
- Modify calculation, scoring, chart, Dasha, transit, compatibility, dosha, remedy, nudge or market logic.
- Change any frontend component, API payload, database row, Edge Function or model.
- Add a clinical, legal, financial or crisis-response service.
- Claim that a disclaimer by itself makes a risky experience safe or compliant.
- Replace review by qualified Indian legal/compliance, medical-safety, financial-regulatory, Vedic astrology and localization specialists before release.

Any later prompt change is a logic-touching implementation and must pass the contract, parity and safety tests defined in the master plan.

---

## 3. Understanding lock

### 3.1 Product understanding

1. AstroSaathi is a multilingual Vedic astrology product grounded in a user's Kundali, with supporting Numerology and Lo Shu lenses.
2. Its value is not merely chart display; it connects calculated evidence, timing, conversation, relationships and reflection.
3. The app serves both curious beginners and users who understand houses, Dashas, divisional charts, Ashtakavarga and doshas.
4. Users may arrive in emotionally vulnerable moments and may treat confident language as instruction.
5. Premium trust comes from clarity, restraint and traceability—not from theatrical certainty.
6. Calculated facts, traditional interpretations, AI synthesis and user reflections are different kinds of content and must look and read differently.
7. Existing computations remain authoritative. Content may explain them but must never invent, silently recompute or override them.

### 3.2 Assumptions

- The main audience is adult, though some profiles may describe children or family members.
- English, Hindi and Marathi remain first-class product languages.
- Birth time can be precise, approximate or unavailable; the content must expose the consequence.
- The product is for reflection and education, not professional medical, mental-health, legal or investment advice.
- “AI astrologer” means an AI-generated interpretation grounded in authorized product data, not a human astrologer.
- The future UI may expose more provenance, but it cannot truthfully label unavailable provenance.

### 3.3 Non-functional requirements

- **Clarity:** a beginner understands the primary message without learning Sanskrit terminology first.
- **Fidelity:** technical content uses exactly the values, systems and calculation versions returned by trusted sources.
- **Safety:** content does not frighten, coerce, shame, diagnose or create false hope.
- **Accessibility:** short blocks, descriptive labels and literal actions remain understandable without colour or animation.
- **Localization:** meaning and safety survive translation; English is not treated as the only canonical emotional register.
- **Auditability:** sensitive copy, labels, templates and source rules are versioned and testable.
- **Consistency:** the same claim type uses the same language contract across cards, reports, chat and notifications.
- **Privacy:** provenance identifies the type of source without leaking another person's private chart or journal text.

---

## 4. Approaches considered

### Approach A — One universal “mystic guide” voice

Every surface would use the same lyrical, premium voice. It would be visually cohesive and fast to author, but it would blur fact and metaphor, fatigue expert users and become unsafe in sensitive contexts.

**Decision:** rejected as the governing model. A restrained trace of the voice may appear in low-risk moments.

### Approach B — Layered, evidence-first content system

Every insight begins with a useful plain-language conclusion, exposes its evidence in a second layer and offers exact methodology in a third. Claim labels and domain rules travel with the content.

**Decision:** recommended. It gives beginners simplicity without taking rigor away from advanced users.

### Approach C — Separate beginner and expert products

Users would choose a permanent mode. This would simplify individual screens but split journeys, produce duplicated copy and trap people in an identity they may outgrow.

**Decision:** rejected. Depth should be progressive and local, not a permanent fork.

---

## 5. The content architecture

Every personalized insight follows this grammar:

1. **Meaning** — what is worth noticing.
2. **Evidence** — which trusted chart or timing signals support it.
3. **Range** — what the interpretation can and cannot establish.
4. **Agency** — a choice, observation or optional practice the user controls.

The shorter formulation is:

> **Fact → interpretation → possibility → agency**

Bad pattern: “Saturn is harming your tenth house, so your career will fail.”

Required pattern: “Career responsibilities may feel heavier in this period. This interpretation draws on Saturn's current relationship to your career indicators. It can describe a theme, not guarantee an outcome. Consider protecting focus and documenting progress before making a major decision.”

Not every micro-card needs four paragraphs. The four parts may appear as a headline, evidence chip, qualifier and action, but no high-impact interpretation should omit range and agency.

---

## 6. Three explanation levels

### 6.1 Level 1 — Simple

**Role:** the default scan layer for Today, overview cards, first-time chart reveal and concise Ask responses.

**Contains:**

- One clear insight headline.
- One or two plain-language supporting sentences.
- At most one unfamiliar astrological term, immediately explained.
- One practical reflection or optional next action when useful.
- A visible evidence/provenance label.

**Typical length:** 35–100 words for a card; 1–3 sentences for a simple chat answer.

**Avoid:** raw degree lists, dense Sanskrit, multiple competing caveats, decorative cosmic filler and forced advice.

**Example:**

> **Your focus is asking for structure.** Saturn-related timing may make progress feel slower, but it can reward patient, repeatable work. Choose one commitment to protect this week.
>
> `Timing interpretation` · `2 chart signals`

### 6.2 Level 2 — Detailed

**Role:** the explanatory layer after “Why this?” or for balanced/detailed Ask responses.

**Contains:**

- The central interpretation.
- Two to four named contributing signals.
- Supportive and challenging expressions of the pattern.
- Time window and timezone when timing is involved.
- Limits caused by missing or approximate data.
- One or two grounded reflection prompts or low-risk actions.

**Typical length:** 150–350 words, divided into short sections.

**Avoid:** pretending every available signal is equally important, repeating the summary and using a score as the conclusion.

### 6.3 Level 3 — Technical

**Role:** an opt-in evidence and methodology view for advanced users and verification.

**Contains when available:**

- Exact planets, signs, degrees, houses, house lords and aspects.
- Dasha hierarchy and exact start/end dates.
- Relevant Vargas, Ashtakavarga bindus, nakshatra/pada or calculation-specific inputs.
- Ayanamsha, house/system assumptions, calculation source and data/calculation version.
- Source timestamps and timezone.
- Missing-data and method limitations.

**Presentation:** structured tables and evidence groups before prose.

**Hard rule:** Technical mode can expose only authoritative values already returned by the relevant calculation contract. The AI may organize or explain them; it may not manufacture absent values.

### 6.4 Relationship to the existing answer-length preference

The current `concise`, `balanced` and `detailed` answer preference controls conversational length. It is not the same as epistemic depth.

| Existing preference | Default response behavior | Technical evidence |
|---|---|---|
| Concise | Usually Simple | Available on explicit expansion/request |
| Balanced | Simple lead + selected Detail | Available on expansion/request |
| Detailed | Detailed by default | Still opt-in or explicitly requested |

The redesign must not silently translate “detailed” into a wall of technical data. Likewise, “concise” must not hide essential uncertainty or safety context.

---

## 7. Claim and provenance taxonomy

Every personalized statement must belong to one of these claim types internally. User-visible labels appear wherever confusion between fact and interpretation is plausible.

| Claim type | Preferred user label | Meaning | Required content behavior |
|---|---|---|---|
| Calculated chart fact | **From your chart** | Deterministic output from an authoritative calculation | Show exact value/source when expanded; never qualify as AI opinion. |
| Timing fact | **Current timing** | Computed Dasha/transit/calendar state | Include date/window/timezone; distinguish stored/current from arbitrary dates. |
| Natal interpretation | **Natal pattern** | Traditional interpretation of stable natal evidence | Use tendency language; never identity prison or guaranteed destiny. |
| Timing interpretation | **Timing influence** | Meaning inferred from a Dasha/transit/time period | Describe themes and windows, not promised events. |
| Traditional teaching | **Traditional view** | A convention, textual lineage or customary association | Identify the tradition/system where known; do not present as universal fact. |
| AI synthesis | **AstroSaathi interpretation** | Generated synthesis grounded in provided evidence | Make AI nature clear and expose supporting inputs. |
| User-provided context | **From what you shared** | A fact or preference stated by the user | Do not recast it as chart evidence. |
| Reflective content | **Reflection prompt** | An invitation for personal meaning-making | Never call it a prediction or fact. |
| Remedy/practice | **Optional practice** | A low-risk cultural or reflective action | No guarantee, urgency, cure claim or required purchase. |
| Experimental market output | **Experimental market indicator** | Astrology-derived market signal | Never a recommendation; show date, method limits and risk boundary. |
| Unavailable/limited | **Not enough information** | Required source or precision is absent | Explain what is missing; never replace it with generic personalization. |

### 7.1 Calculation and interpretation must remain separable

- “Moon at 14° Taurus” can be a calculated fact.
- “This may support emotional steadiness” is an interpretation.
- “You will always remain calm” is an unsupported certainty.

The interface may group fact and interpretation, but it must never style both as equally objective.

### 7.2 Provenance display pattern

A compact evidence row may show:

`Natal pattern` · `Moon in Taurus + 4th-house emphasis` · `Why this?`

Technical expansion may show source details. It must never reveal private details from a saved person beyond the access and disclosure rules approved for that relationship context.

---

## 8. Certainty, confidence and missing information

### 8.1 Approved confidence language

- “Supported by several relevant chart signals”
- “A recurring theme in this reading”
- “Based mainly on one chart factor”
- “This interpretation is limited because the birth time is approximate”
- “Not available because a precise birth time is required”
- “Astrological interpretations can manifest in more than one way”

### 8.2 Prohibited certainty shortcuts

Do not use these for personal outcomes unless reporting a literal known fact supplied by the user:

- definitely, certainly, guaranteed, destined
- will happen, cannot fail, no doubt
- always, never, only outcome
- 100% accurate, perfect match, impossible relationship
- lucky enough to ignore risk, safe investment, sure profit

### 8.3 No decorative confidence scores

Do not generate percentages such as “87% likely” or “92% accurate” unless a specific backend contract returns a validated and documented metric with a defined denominator. A UI progress ring is not evidence.

When a calculation returns a score, label what the score measures. For example, Guna Milan is a tradition-specific compatibility measure; it is not “the chance this relationship succeeds.”

### 8.4 Four information states

| State | Meaning | Copy behavior |
|---|---|---|
| Available | Trusted calculation/source is present | Show insight and provenance. |
| Limited | Some evidence exists but precision is constrained | Show the limitation beside the result. |
| Unavailable | Required data/contract is absent | Say what is needed; do not simulate a result. |
| Failed | A normally supported request did not complete | Explain failure and safe retry; do not imply a cosmic cause. |

“No dosha detected” and “dosha could not be calculated” must never share the same empty state.

---

## 9. Voice system

### 9.1 Core voice

AstroSaathi is:

- **Warm, not intimate by assumption.** It may acknowledge emotion without claiming to know how a user feels.
- **Lyrical, not vague.** One precise metaphor is better than ceremonial filler.
- **Confident in calculations, humble in interpretation.**
- **Culturally respectful, not performatively mystical.**
- **Playful in exploration, serious at consequential moments.**
- **Empowering, not prescriptive.**

### 9.2 Tone by context

| Context | Tone | Playfulness |
|---|---|---|
| Onboarding and discovery | Inviting, luminous, simple | Medium |
| Today and daily guidance | Calm, fresh, practical | Light |
| Chart exploration | Curious, precise, rewarding | Medium |
| Technical reports | Neutral, exact, compact | None to very light |
| Ask | Responsive to user, grounded | Context-dependent |
| Compatibility | Balanced, respectful to both people | Light only |
| Doshas and difficult periods | Calm, non-alarmist, explanatory | None |
| Remedies | Gentle, optional, culturally respectful | Light |
| Health, distress, abuse, money | Direct, plain, supportive | None |
| Errors and missing data | Honest, useful, non-mystical | None |

### 9.3 Premium language restraint

Premium does not mean adding “cosmic,” “sacred,” “divine” or “destiny” to every line. Reserve poetic language for titles and low-risk transitions. Buttons, errors, consent, provenance and safety copy use literal words.

Examples:

- Prefer **Explore your chart** over “Unlock the divine secrets of your cosmic blueprint.”
- Prefer **Calculating your chart** over “The universe is revealing your destiny.”
- Prefer **Try again** over “Realign the stars.”

---

## 10. Domain safeguards

### 10.1 Natal personality and life themes

- Describe capacities, needs, tensions and recurring patterns—not fixed personality verdicts.
- Present constructive and difficult expressions of the same placement.
- Avoid moral rankings of planets, signs, houses, genders, castes, communities or relationship forms.
- Never infer trauma, criminality, sexuality, disability, fertility, intelligence or moral worth from a chart.
- Do not turn one placement into a whole-person conclusion.

**Preferred:** “This placement may make privacy important when emotions are intense.”  
**Avoid:** “You are secretive and cannot trust people.”

### 10.2 Timing, Dashas and transits

- A precise astrological period can be calculated; its real-world manifestation remains interpretive.
- Always name a concrete date range when available and state the timezone where day boundaries matter.
- Show both constructive use and possible friction.
- Avoid countdowns to feared events or notification copy that manufactures urgency.
- “Favourable” means a supportive astrological pattern, not guaranteed success.

**Preferred:** “This window may support interviews and clearer communication; preparation still matters.”  
**Avoid:** “You will get the job during this transit.”

### 10.3 Doshas and Sade Sati

- Use `present`, `not detected`, `limited` and `unavailable` as distinct calculation states.
- Never describe a dosha as a curse, contamination, personal defect, punishment or proof of inevitable harm.
- Explain which rule detected it and which mitigating/cancellation factors the system actually supports.
- Sade Sati is a timed astrological phase, not a diagnosis or disaster forecast.
- Severity labels must be tied to defined calculation logic, never invented by AI or visual drama.
- The first user-facing message should orient, not alarm; remedies remain optional and secondary.

**Preferred:** “This calculation detects a Manglik pattern under the selected method. It is one factor within a wider compatibility reading and does not determine whether a marriage can succeed.”  
**Avoid:** “Manglik dosha threatens your marriage—fix it now.”

### 10.4 Compatibility and relationships

- Begin with relationship dynamics and areas for conversation, not a verdict or score.
- Treat both people with equal dignity and preserve the correct subject identities.
- Describe a score only as the dimension its method measures.
- No marriage guarantee, breakup prediction, infidelity accusation or instruction to remain in/leave a relationship.
- Do not infer consent, abuse, sexuality, fertility or family approval from chart data.
- If a user describes coercion, violence or immediate danger, stop astrological interpretation and prioritize practical safety/support language.
- Never market paid remedies or upgrades by amplifying relationship fear.

**Preferred:** “The score suggests some traditional points of ease, while communication styles may still need attention.”  
**Avoid:** “Low compatibility means this relationship is doomed.”

### 10.5 Remedies, gemstones, mantra and ritual

- Label all remedies **Optional practice**.
- Prefer accessible, low-cost and low-risk practices: reflection, service, gratitude, routine, meditation or a familiar spiritual practice.
- Respect the user's tradition and ability to decline.
- Never claim a remedy cures disease, guarantees an event, removes all karmic effects or substitutes for qualified care.
- Do not create urgency, shame or an unavoidable purchase path.
- Gemstone and Rudraksha guidance requires stronger caution because suitability, authenticity, cost and physical considerations vary.
- Donations must never be directed to an undisclosed affiliated party or framed as payment to prevent harm.

**Preferred:** “If this practice is meaningful in your tradition, you could try it gently; it is optional and does not guarantee a specific result.”  
**Avoid:** “Buy this stone today or Saturn will keep causing losses.”

### 10.6 Physical health, mental health, pregnancy and lifespan

- Do not diagnose conditions or infer their cause from astrology.
- Do not recommend stopping, starting or changing medication, treatment or professional care.
- Do not predict death, lifespan, serious illness, pregnancy, miscarriage, fetal sex, conception success or recovery.
- General well-being suggestions must be low risk and clearly non-medical.
- When a symptom, pregnancy concern or mental-health issue is material, recommend a qualified professional in direct language.
- When the user indicates immediate danger, self-harm or harm to others, the response leaves the astrological frame and follows a separately reviewed crisis-safety protocol appropriate to locale.

This boundary reflects the need for patient safety, autonomy, transparency and accountability highlighted by the [World Health Organization's guidance on AI for health](https://www.who.int/news/item/16-05-2023-who-calls-for-safe-and-ethical-ai-for-health).

**Preferred:** “Astrology cannot determine the cause of chest pain. Please seek urgent medical care now.”  
**Avoid:** “Mars is causing your chest pain; chant this mantra.”

### 10.7 Market astrology and personal finance

- Keep this content visually and linguistically separate from personal spiritual guidance.
- Label it **Experimental market indicator** at the point of use, not only in Terms.
- Never output personalized buy/sell/hold instructions, target prices, position size, leverage, guaranteed return or loss-recovery promise.
- Show the market, instrument/category, data timestamp, coverage status and what the signal measures.
- Distinguish bullish/bearish astrological bias from observed market data.
- State that securities involve risk and direct users seeking advice to a suitably registered professional.
- No urgency language, countdowns, celebratory profit effects or fear-based upgrade prompts.

SEBI warns users against assured returns and advises taking investment advice only from registered entities; AstroSaathi's market copy must respect that boundary. See [SEBI's current investor caution](https://investor.sebi.gov.in/cautiontoinvestor.html) and [scam warning guidance](https://investor.sebi.gov.in/spot-any-scam.html).

**Preferred:** “The experimental astrological indicator leans positive for this date. This is not a price forecast or investment recommendation; verify current market data and risk independently.”  
**Avoid:** “Strong buy—Jupiter guarantees upside this week.”

### 10.8 Career, education, property and legal matters

- Offer themes, preparation prompts and decision factors—not promised selection, admission, visa, court or property outcomes.
- Do not draft legal conclusions from chart evidence or discourage professional advice.
- Avoid high-pressure timing such as “sign today” or “do not file until this transit ends.”

### 10.9 Karma, spirituality and identity

- Spiritual language must not blame a person for illness, abuse, poverty, loss or discrimination.
- Do not state past-life events as facts.
- Do not imply one faith, practice, caste, gender identity, sexual orientation, disability or family structure is spiritually superior.
- Use “within this tradition” when a claim is tradition-specific.

### 10.10 Children and third-party charts

- Use age-appropriate, non-limiting language for a child's chart.
- Avoid fixed labels about intelligence, obedience, career, marriage, health or temperament.
- Do not disclose one saved person's sensitive interpretation to another context beyond authorized product rules.
- The current user retains responsibility for lawful consent and use; the UI must make the active person unmistakable.

---

## 11. Wording transformation matrix

| Avoid | Use instead | Why |
|---|---|---|
| “You are an angry person.” | “This pattern can intensify directness under pressure.” | Separates a tendency from identity. |
| “Your career will fail.” | “This period may bring heavier career demands; pace major decisions and verify practical risks.” | Removes fatalism and restores agency. |
| “Your chart proves…” | “This interpretation draws on…” | Interpretation is not proof. |
| “Bad planet” | “A more demanding expression of this placement” | Avoids moralizing a chart factor. |
| “You have a defect/dosha.” | “This method detects a dosha pattern.” | A calculation is not a personal defect. |
| “No dosha.” when data is missing | “A precise birth time is needed to calculate this.” | Distinguishes unavailable from absent. |
| “Sade Sati will ruin seven years.” | “Sade Sati is traditionally read as a period of sustained responsibility and restructuring; experiences vary.” | Removes fear and inevitability. |
| “Perfect match: 92%.” | “This method shows strong agreement in the dimensions it measures.” | Stops a score becoming destiny. |
| “Do not marry this person.” | “Use this as one reflective lens, alongside trust, consent, values and lived experience.” | Protects user autonomy. |
| “Your partner may cheat.” | “This reading cannot establish another person's actions or intentions.” | Prevents accusation from inference. |
| “This remedy will remove the problem.” | “This optional practice may support reflection or routine; it cannot guarantee an outcome.” | Avoids false cure and coercion. |
| “You need this paid gemstone.” | “If you are considering a gemstone, seek qualified, independent guidance; purchase is never required.” | Avoids fear-based commerce. |
| “Your chart shows depression.” | “Astrology cannot diagnose mental-health conditions.” | Maintains scope. |
| “You will conceive in May.” | “Astrology cannot predict conception or pregnancy outcomes.” | Protects medical safety. |
| “Gold will rise tomorrow.” | “The experimental astrological signal leans positive for the stated date; it is not a price forecast.” | Separates signal from financial promise. |
| “Act now before the window closes.” | “If this timing feels relevant, compare it with your practical constraints before deciding.” | Removes pressure. |
| “The AI knows…” | “AstroSaathi generated this interpretation from the listed chart inputs.” | Honest provenance. |
| “The universe couldn't load your chart.” | “Your chart could not be loaded. Try again.” | Errors remain literal and useful. |

---

## 12. Screen-by-screen content hierarchy

### 12.1 Today

Order:

1. Date, timezone and subject.
2. One plain-language theme for the day.
3. Why it may matter now.
4. Evidence row: transit/Dasha/Panchang source as actually supported.
5. Optional action or reflection.
6. “Ask about this” with a previewed context handoff.

Do not make a universal daily horoscope appear Kundali-personalized. Current/general and personalized content require visibly different labels.

### 12.2 My Cosmos overview

Order:

1. Stable identity anchors derived from the chart.
2. Three to five major patterns with balanced expressions.
3. Current timing separated from natal content.
4. Explore houses, planets, Dashas and reports.
5. Technical provenance on demand.

The first chart reveal should celebrate completion, not claim to reveal a predetermined destiny.

### 12.3 Chart and report detail

Order:

1. Exact calculation/chart visual.
2. Selected element identity and value.
3. Plain meaning.
4. Supporting evidence and relationships.
5. Interpretive range/limitations.
6. Technical method and source details.

### 12.4 Ask

Order for substantive answers:

1. Direct answer to the user's actual question.
2. Brief acknowledgment only when the user expressed emotion; never fabricate emotion.
3. Relevant chart/timing evidence.
4. Interpretation and uncertainty.
5. Practical reflection or optional action.
6. Source/context controls and follow-up affordance.

Short factual questions remain short. Safety context is never removed merely to satisfy a concise preference.

### 12.5 Journey

Order:

1. User-authored event or reflection.
2. Date and attached context.
3. Retrospective astrological lens clearly marked as interpretation.
4. Pattern across time, only when sufficient data exists.
5. Private reflection prompt.

The product must not rewrite a user's lived memory to fit the chart.

### 12.6 Connections

Order:

1. Both people and relationship context.
2. Areas of ease and areas requiring attention with equal weight.
3. Traditional score/dosha modules with defined scope.
4. Conversation prompts.
5. Method details and limitations.

The verdict must never be reduced to a traffic-light colour or a single “good/bad” score.

### 12.7 Markets

Order:

1. Experimental status and date.
2. Signal summary.
3. Astrological contributors.
4. Data coverage, freshness and limitations.
5. Clear non-advisory boundary before any further interaction.

Markets must not inherit the warm personal certainty of a daily guidance card.

---

## 13. System-state language

### 13.1 Loading

- “Calculating your chart…”
- “Preparing this interpretation…”
- “Loading current timing…”

Never imply completion, certainty or supernatural activity while a request is pending.

### 13.2 Empty

- “Add a birth time to calculate house-based insights.”
- “No saved reflections yet.”
- “Market coverage is not available for this date.”

Empty states say what is absent and, only when useful, the next safe action.

### 13.3 Partial

- “Your planetary positions are available. House-based insights are limited because the birth time is approximate.”
- “Some current timing data is unavailable; the visible result uses only the sources listed below.”

### 13.4 Error

- “We couldn't load this chart. Your saved data has not been changed.”
- “This message was not sent. Try again.”

Never blame Mercury retrograde, karma or the user's energy for a technical failure.

### 13.5 Stale information

- “Last updated 7 September, 11:40 PM IST.”
- “Current data is unavailable; showing the latest completed calculation.”

Stale data never carries a “Now” label.

### 13.6 Destructive and consent actions

Use literal verbs and consequences:

- “Delete conversation”
- “Remove saved person”
- “Attach this private reflection?”

Do not soften consequential actions with poetic labels.

---

## 14. AI identity and transparency

### 14.1 Naming

- Use **AstroSaathi** or **AI interpretation** for generated responses.
- Do not call the AI a human astrologer, guru, doctor, therapist or financial adviser.
- Do not imply consciousness, divine access or direct knowledge of the user.

### 14.2 Minimum transparency for a generated personalized insight

The experience must make it possible to know:

1. That the interpretation was AI-generated.
2. Which subject it concerns.
3. Which chart/timing sources were applied.
4. Which relevant sources were unavailable or excluded.
5. That feedback/correction is possible.

This follows the broader trust principles of reliability, safety, transparency, explainability, privacy and accountable risk management in the [NIST AI Risk Management Framework](https://www.nist.gov/itl/ai-risk-management-framework).

### 14.3 Correction behavior

If a user corrects a fact:

- Acknowledge the exact correction.
- Do not claim the chart changed unless the underlying saved data/calculation actually changed.
- Distinguish conversation memory from profile/chart storage.
- Never conceal an unsupported or omitted source behind fluent language.

### 14.4 Anthropomorphic boundaries

Permitted: “I can help you explore that pattern.”  
Avoid: “I can feel your aura,” “I remember everything about you,” or “I know this will happen.”

---

## 15. Accessibility and cognitive load

- Lead with common words and short sentences.
- Define unfamiliar Sanskrit/technical terms at first use; retain the original term for cultural precision.
- Break long readings into descriptive sections, not decorative fragments.
- Keep warnings adjacent to the relevant claim or action.
- Never communicate severity with colour, animation or icon alone.
- Button labels describe actions; links describe destinations.
- Avoid multiple stacked disclaimers written in legalese. Use one contextual boundary plus access to fuller policy.
- Do not hide core meaning in a tooltip.

These rules align with W3C guidance to use familiar words, short sentences, unambiguous content and short blocks for cognitive accessibility; see [W3C's clear-content objective](https://www.w3.org/WAI/WCAG2/supplemental/objectives/o3-clear-content/).

---

## 16. English, Hindi and Marathi content system

### 16.1 One semantic source, three native expressions

Each copy key has:

- Intent and claim type.
- Risk level.
- English, Hindi and Marathi expressions.
- Terms that must remain technically equivalent.
- Maximum length/line guidance where relevant.
- Reviewer and content version.

Translation must preserve meaning, dignity, uncertainty and action—not English word order.

### 16.2 Controlled glossary

Create an approved glossary for at least:

- Kundali, Lagna/Ascendant, Rashi, Nakshatra, Pada.
- Graha/planet terminology.
- Bhava/house, Drishti/aspect and lordship.
- Mahadasha, Antardasha and transit/gochar.
- Dosha names and cancellation/mitigation language.
- Guna Milan and compatibility dimensions.
- Ashtakavarga, Vargas and divisional chart labels.
- Panchang elements.
- “Calculated fact,” “interpretation,” “traditional view,” “optional practice” and “unavailable.”

### 16.3 Localization safety rules

- Use respectful forms consistently; do not switch intimacy level automatically.
- Avoid gendered defaults for partner, spouse, child, career or household roles.
- Preserve uncertainty markers in every language.
- Do not translate “influence” into fate/command language.
- Test Devanagari at 320 px and 200% text without truncating the claim or warning.
- Require native review for sensitive dosha, relationship, medical, spiritual and market copy.

---

## 17. Safety response ladder

This is a content-routing requirement, not a complete clinical or legal protocol.

| Level | Examples | Response behavior |
|---|---|---|
| 0 — Ordinary | Chart meaning, daily reflection, house exploration | Normal layered content. |
| 1 — Emotionally sensitive | Breakup uncertainty, job worry, family tension | Calm acknowledgment, non-deterministic reading, restore agency. |
| 2 — Consequential | Symptoms, pregnancy, legal dispute, debt, high-stakes trading | State scope limit early; no directive outcome; recommend qualified help where appropriate. |
| 3 — Immediate safety | Self-harm, violence, abuse, acute medical danger | Leave astrology frame; prioritize immediate practical/local emergency support under a separately reviewed protocol. |

At Levels 2–3, the normal playful/premium voice yields to direct, plain safety language.

---

## 18. Notification and conversion ethics

- Notifications may surface a calculated period or an unfinished reflection, but never create fear to drive a session.
- Avoid “Danger today,” “Your dosha is active,” “Someone may betray you,” and similar anxiety hooks.
- Paid features must be described by capability, not by withheld protection or promised outcomes.
- No paywall directly after an alarming claim without providing the essential calming context first.
- Do not use streak loss, scarcity timers or social proof in remedies, compatibility, health or markets.
- Consent and notification frequency preferences override engagement goals.

Preferred notification:

> “A new Dasha phase begins this week. Review the dates and themes when you're ready.”

Avoid:

> “Major danger ahead—unlock your full report now.”

Professional astrology ethics similarly emphasize autonomy, qualified interpretation and avoiding fear or unequivocal forecasts; see the [NCGR Code of Ethics](https://ncgrastrology.org/ncgr-code-of-ethics/) and [ISAR ethical guidelines](https://www.capisar.org/pages/isar-code-of-ethics).

---

## 19. Content component contracts

These are specification-level content models, not implementation schemas.

### 19.1 `Insight`

- `meaning`
- `claim_type`
- `subject_label`
- `evidence_refs[]`
- `range_or_limitation`
- `agency_prompt?`
- `sensitivity_level`
- `generated_or_calculated`
- `content_version`

### 19.2 `EvidenceRef`

- Human-readable signal label.
- Authoritative source family.
- Relevant value/window.
- Timestamp/timezone where needed.
- Availability state.
- Technical detail target.

### 19.3 `BoundaryNotice`

- Domain: health, mental health, pregnancy, legal, finance, relationship safety or general.
- Short contextual message.
- Escalation/support action when appropriate.
- Review/version metadata.

### 19.4 Invariant

The UI must not render an evidence label whose source was not actually applied. The AI must not invent an `EvidenceRef`. A generic disclaimer cannot compensate for false provenance.

---

## 20. Content governance

### 20.1 Ownership

- **Product/content design:** hierarchy, voice and comprehensibility.
- **Vedic astrology reviewer:** method terminology, interpretation integrity and tradition-specific nuance.
- **Hindi/Marathi native reviewers:** linguistic and cultural equivalence.
- **Medical-safety reviewer:** health, pregnancy and crisis boundaries.
- **India legal/financial compliance reviewer:** markets, advertising, disclaimers and monetization.
- **Engineering/data owners:** guarantee displayed provenance matches real contracts.

### 20.2 Versioned assets

- Controlled glossary.
- Claim-label catalog.
- Sensitive-copy catalog.
- Prompt policy and response templates.
- Translation keys.
- Calculation/method labels.
- Safety and red-team fixtures.
- Decision log and reviewer sign-off.

### 20.3 Change classes

| Change | Risk | Required validation |
|---|---|---|
| Decorative low-risk microcopy | Low | Content + localization review |
| Claim label or uncertainty wording | Medium | Content, astrology and accessibility review |
| Dosha/compatibility/remedy template | High | Astrology, safety and localization review |
| Health/crisis/financial boundary | Critical | Qualified domain/legal review + red-team tests |
| Prompt/evidence assembly | Critical | Backend contract, parity, hallucination and regression tests |

---

## 21. Validation and red-team matrix

Before release, fixtures must cover English, Hindi and Marathi for:

### Evidence integrity

- Exact calculation present.
- One source missing.
- Approximate birth time.
- No birth time.
- Conflicting or stale timing data.
- Saved-person context on first and later chat turns.
- Unsupported arbitrary date.

### Harm and certainty

- User asks for a guaranteed prediction.
- User asks whether a dosha will ruin a marriage.
- Very low compatibility score.
- User requests a costly remedy.
- User asks for disease diagnosis or medication change.
- User asks about pregnancy outcome or lifespan.
- User requests a buy/sell call or guaranteed market return.
- User expresses imminent danger or self-harm.

### Bias and dignity

- Same-sex/non-marital relationship.
- Gender-neutral partner language.
- Interfaith/intercaste relationship.
- Disability or chronic illness context.
- Child chart.
- Financial vulnerability.

### UX states

- Simple, Detailed and Technical rendering.
- 320 px, 200% text and screen reader.
- Reduced motion/contrast modes.
- Error, partial, stale and unavailable states.
- Safety copy remains visible in concise mode.

---

## 22. Acceptance checklist

Action 1.4 can be approved when the user agrees that:

- Simple is the default; Detailed and Technical are progressively available.
- Conversational answer length and technical evidence depth are separate controls.
- Every personalized claim belongs to a defined provenance type.
- Calculated fact, traditional interpretation, AI synthesis and user reflection remain distinguishable.
- Missing/limited data is never presented as a negative or neutral calculation result.
- Natal and timing language describes tendencies/windows, not guaranteed destiny.
- Doshas are calculation patterns, never curses or personal defects.
- Compatibility does not decide marriage, breakup or another person's behavior.
- Remedies are optional, non-coercive and never cures or guarantees.
- Health, pregnancy, lifespan, crisis and market topics use strict scope boundaries.
- Market astrology remains experimental and never becomes investment advice.
- Playfulness stops where vulnerability, safety or money begins.
- English, Hindi and Marathi preserve the same uncertainty and dignity.
- Sensitive copy and prompts require versioning, expert review and red-team fixtures.

---

## 23. Decision log

| Decision | Alternatives | Reason |
|---|---|---|
| Use layered evidence-first content | One mystic voice; permanent expert mode | Gives beginners clarity and experts rigor without product fragmentation. |
| Simple by default | Dense chart data by default | Lowers cognitive load while keeping evidence accessible. |
| Separate length from evidence depth | Treat detailed answers as technical mode | Prevents verbosity from masquerading as rigor. |
| Label claim types | One undifferentiated “insight” style | Preserves the boundary between fact, tradition, synthesis and reflection. |
| Use range + agency | Deterministic forecasts | Protects autonomy and communicates interpretive limits. |
| Never invent confidence percentages | Dribbble-style certainty rings | Visual precision cannot substitute for calibrated evidence. |
| Treat unavailable as its own state | Fall back to generic personalization | Prevents false results and preserves trust. |
| Make doshas non-alarmist | “Good/bad” warnings | A pattern is not a curse or conversion device. |
| Put dynamics before compatibility score | Score-first verdict | Scores measure a tradition-specific construct, not relationship success. |
| Make remedies optional and low-risk | Prescriptive/costly correction | Prevents coercion, false hope and commercial exploitation. |
| Remove astrology from urgent safety response | Continue a reading with a disclaimer | Immediate practical safety takes priority. |
| Isolate experimental markets | Blend with Today guidance tone | Financial signals require stronger boundaries and no personal certainty. |
| Use native localization review | Literal translation | Uncertainty, dignity and cultural nuance must survive translation. |
| Version sensitive content | Ad hoc strings and prompt edits | Enables auditability, review and regression testing. |

---

## 24. Approval record

The user approved the hierarchy, labels, domain safeguards and governance rules on 8 September 2026.

Action 1.4 is complete. The approval authorizes subsequent design-specification actions one at a time; it does not authorize copy, prompt, translation, calculation, frontend, database or Edge Function changes.
