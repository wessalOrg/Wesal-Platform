# Wesal AI Assistant — Deep Architecture + Behavior Audit

- **Repository:** `wessalOrg/Wesal-Platform`
- **Audited commit:** `main` @ `c385450f8f83861a17e3b220706bae5bc9f8bba7` (matches the expected SHA)
- **Mode:** audit only. No code, prompt, routing, tool, migration, commit or deployment change was made. The only artifact produced is this file.
- **Evidence types used:** (a) source reading of every AI file; (b) live, anonymous calls to the public production endpoint `https://wesal-platform.onrender.com/api/v1/ai/sessions/...` (the same calls the website makes; in-memory sessions, no data mutated). Claims are tagged **[CODE]** (proven by reading code), **[LIVE]** (observed on production) or **UNKNOWN** (evidence missing, stated what is needed).

---

## 1. Executive summary

The assistant is **architecturally sound on paper but, in production today, it behaves as a keyword FAQ bot that cannot search halls.** Four independent defects stack on top of each other:

1. **[CODE+LIVE] The Knowledge Base is not shipped in the production image.** `Backend/.dockerignore` excludes `documentation/`, but the KB lives in `Backend/documentation/ai-knowledge/` and is compiled in as embedded resources. On Render the glob matches zero files, so `WesalKnowledgeService` loads 0 articles. Live proof: "ما هي ساعات الدعم؟", "ما سعر وصال؟", "شو هو وصال؟" all return the generic "I can help you with how to use Wesal…" text.
2. **[CODE+LIVE] Whenever Gemini is unavailable, hall search/details/availability are completely dead.** `GeminiToolOrchestrator` falls back to `HowToService` and reports `Success = true`, so `AiAssistantService` never reaches its deterministic intent/search path (that path only runs if the orchestrator *throws*, which it effectively never does). Live: "هات قاعات بغزة", "احكيلي عن قاعة النور", "هل قاعة النور متاحة يوم 2026-10-20؟" return how-to boilerplate although the halls exist in the DB.
3. **[CODE+LIVE] Gemini is, in practice, mostly off.** One failed/timed-out call (timeout is 5 s; observed Gemini latency ≈ 5 s) opens a **process-wide static circuit breaker for 60 s**, silently degrading every user to the deterministic path. Live: a Gemini attempt after cooldown took 5.7 s, returned a fallback, and the next calls were instant (0.5–0.9 s).
4. **[CODE+LIVE] The deterministic fallback mis-routes.** The subscription-payment detector fires on bare words ("كيف أدفع", "دفع", "pay", "payment"): "كيف أدفع الحجز؟" returns the *hall-owner subscription* answer. Meanwhile "كم سعر الاشتراك لصاحب القاعة؟" (with "ال") is **missed** (the `\b` anchor does not match inside "الاشتراك") and answers with *how to message a hall owner*. "كيف اتواصل مع الدعم الفني؟" also answers with hall-owner messaging.

Beyond those, structural problems that stop it from ever becoming "one reliable assistant":

- The primary (Gemini) path returns **plain text only** (`Kind = Answer`, `Intent = null`). The frontend's hall cards, details and availability cards, and the backend's carried-forward search context (`LastIntent`) are **unreachable in the primary path**.
- Conversation memory is an in-process dictionary that stores **only user messages** (never assistant replies or tool results), so "شو سعر الثانية؟" cannot be resolved. It is lost on restart/redeploy and is not shared across instances. A persistent `AISession` table/repository exists but **nothing uses it**.
- Gemini is never told today's date, so "الجمعة / بكرة" cannot be grounded.
- Two contradictory "official" sources exist for pricing/contact (KB FAQ says there is no fixed price and lists WhatsApp `+970567581412`; `SubscriptionPaymentOptions` defaults to 120 ILS / 30 days and WhatsApp `+972597744476`). Which one a user sees depends on whether Gemini is up.
- A latent tool-calling defect: `GeminiService` sends only `contents.Take(7)`, which can split a `functionCall` from its `functionResponse` in longer chats (details §8). Combined with the global circuit breaker, a single long chat can disable the assistant for everyone for 60 s.

Good news: the **tool gateway is well built** (allow-list, strict validation, auth-material rejection, public-only projections, bounded rounds and repeat guard, API key in header not URL). The fixes are mostly *routing and plumbing*, not a rewrite.

---

## 2. Current architecture (verified)

```
Browser (Next.js)
  AiAssistantProvider ─ useAiAssistant ─ POST /api/v1/ai/sessions            (create session, in-memory, TTL 30 min sliding)
  AiAssistantPanel ─ useAiChat ─ sendAiChatTurn
        │ POST /api/v1/ai/sessions/{id}/assistant   {message}     (anonymous, 25 s client timeout)
        ▼
AiAssistantController.AskAssistant
  1. ChatSessionService.GetSessionAsync  (404 if unknown/expired; slides TTL)
  2. GetConversationContextAsync         (≤5 prior USER texts + LastIntent)
  3. AiAssistantService.ProcessMessageAsync
        ├─ PRIMARY: GeminiToolOrchestrator.ExecuteAsync
        │     ├─ Gemini unavailable (disabled / no key / breaker open / any failure)
        │     │      └─► HowToService.AskHowToAsync  ──► returns Success=true  (ends here)
        │     └─ Gemini available:
        │           KB search (platform|faq|policies only, ≤2 injected, ≤2000 chars) ─► system prompt
        │           loop ≤4 rounds: GenerateToolTurn ─► functionCall? ─► WesalToolGateway
        │                 search_halls | get_hall_details | check_hall_availability
        │                 (repeat guard: same call > 2× ⇒ safe-termination text)
        │           final free text ─► AiAssistantResponse{Kind=Answer, Intent=null}
        └─ SAFETY NET (only if orchestrator THROWS): GeminiAiIntentExtractor ─► AiIntentFallbackClassifier
              ─► HowTo | RecommendationService | Featured | HallDetails | Availability | Unsupported | Clarification
  4. ChatSessionService.SaveTurnAsync(user text, response.Intent)   (Intent is null in primary path ⇒ LastIntent never saved)
  ▼
AiAssistantResponse{Kind, Message, ResponseLanguage, Halls[], HallDetails, Availability, Intent}
  ▼  ai-chat.ts mapAssistant ─► AiChatMessage ─► bubble + hall cards / availability card / WhatsApp linkification
```

Legacy, still mounted but **unused by the frontend** (`grep` of `Frontend/src`): `POST …/{id}/how-to` → `HowToService`; `POST …/{id}/recommend` → `RecommendationService` (deterministic extractor only, no Gemini).

---

## 3. File / symbol map

Legend — **Live** = on the real request path; **Fallback** = only on degraded paths; **Dead** = no production caller.

### 3.1 Backend

| File | Symbol | Responsibility | Caller | Depends on | State | Tests | Status |
|---|---|---|---|---|---|---|---|
| `API/Controllers/AiAssistantController.cs` | `AiAssistantController` | Session create/get, `/assistant`, legacy `/how-to`, `/recommend` | Frontend (`/ai/sessions`, `/assistant`) | `IChatSessionService`, `IAiAssistantService`, `IHowToService`, `IRecommendationService` | none | **No controller/API-level AI test** (only DI composition tests) | Live (`/assistant`,`/ai/sessions`); `/how-to`,`/recommend` unused |
| `Infrastructure/AiAssistant/AiAssistantService.cs` | `AiAssistantService` | Unified turn: orchestrator first, deterministic dispatcher as safety net; `MergeWithContext` | Controller | Orchestrator, intent extractor, HowTo, Recommendation, Featured/Details/Search/HourlySlot services | none | `AiAssistantServiceShould` (32) | Live (thin) + Fallback (thick) |
| `…/GeminiToolOrchestrator.cs` | `GeminiToolOrchestrator` | Bounded tool-calling loop, KB injection, HowTo fallback | `AiAssistantService` | `IGeminiToolCallService`, `IWesalToolGateway`, `IWesalKnowledgeService`, `IHowToService` | none | `GeminiToolOrchestratorShould` (17), `GeminiToolCallingShould` (15) | Live |
| `…/GeminiService.cs` | `GeminiService` (`IGeminiService` + `IGeminiToolCallService`) | REST client: text, structured JSON, tool turn; static circuit breaker | Orchestrator, HowTo, intent extractor | `IHttpClientFactory`, `GoogleAiSettings` | **static** breaker ticks | `GeminiServiceShould`(17), `GeminiFailoverShould`(25), `GeminiStructuredOutputShould`(14) | Live |
| `…/GeminiPromptBuilder.cs` | `GeminiPromptBuilder` | All prompts (tool, text, intent), KB block, schema | Gemini callers | `WesalPlatformKnowledge` | none | partly via above | Live |
| `…/WesalToolGateway.cs` | `WesalToolGateway` | Tool allow-list, validation, execution, public projection | Orchestrator | `IHallSearchService`, `IHallDetailsService`, `IHourlySlotService` | none | `WesalToolGatewayShould` (23) | Live |
| `…/HowToService.cs` | `HowToService` | Payment → KB → creator → Gemini text → keyword matcher | Orchestrator fallback, safety net, legacy `/how-to` | `ISubscriptionPaymentService`, detector, `IGeminiService`, KB | none | 6 test files, 67 tests | Live (as fallback) |
| `…/WesalKnowledgeService.cs` | `WesalKnowledgeService` | Loads embedded `.md` KB, ranks by keyword/stem/token overlap | Orchestrator, HowTo | embedded resources | in-memory docs | `WesalKnowledgeServiceShould` (28) | Live — **but loads 0 docs in prod** |
| `…/GeminiAiIntentExtractor.cs` | `GeminiAiIntentExtractor` | Gemini structured intent → validated DTO, else deterministic | `AiAssistantService` safety net only | `IGeminiService`, `AiIntentFallbackClassifier` | none | `GeminiStructuredOutputShould` | Fallback |
| `Application/Ai/AiIntentFallbackClassifier.cs` | `AiIntentFallbackClassifier` | Regex intent classifier | Extractor | `IRecommendationCriteriaExtractor` | none | `AiIntentFallbackClassifierShould` (17) | Fallback |
| `Application/Ai/NaturalLanguageCriteriaExtractor.cs` | `NaturalLanguageCriteriaExtractor` | Region/area/date/capacity regex | Recommendation, classifier | — | none | via Recommendation tests | Fallback + legacy |
| `…/RecommendationService.cs`, `HallRecommendationMatcher.cs` | recommend pipeline | Criteria → search (page 50) → capacity filter | Safety net, legacy `/recommend` | `IHallSearchService` | none | 13 + 12 tests | Fallback |
| `…/ChatSessionService.cs` | `ChatSessionService` | In-memory sessions, context | Controller | `ConcurrentDictionary` | **process memory** | `ChatSessionServiceShould` (23) | Live |
| `…/SubscriptionPaymentService.cs`, `SubscriptionPaymentOptions.cs` | payment facts | Admin WhatsApp, price, cycle (config-bound, defaults hard-coded) | HowTo only | `IOptions` | config | `HowToPaymentContactShould` (6) | Live via HowTo only |
| `Application/Ai/SubscriptionPaymentIntentDetector.cs` | detector | Keyword payment intent | HowTo | — | none | within HowTo tests | Live via HowTo |
| `Application/Ai/AiLanguageDetector.cs` | detector | Arabic/Latin ratio (60 %) | Controller-path services (×4 copies) | — | none | 11 tests | Live |
| `Application/Ai/WesalPlatformKnowledge.cs` | static feature list | Grounds HowTo's Gemini text call | `GeminiPromptBuilder.BuildSystemInstruction` | — | static | 5 tests | Live via HowTo only |
| `Infrastructure/AiAssistant/GoogleAiSettings.cs` | settings | `GoogleAI:*` | DI | config | config | — | Live |
| `Domain/Entities/AISession.cs`, `Persistence/Repositories/AISessionRepository.cs`, `IAISessionRepository`, migration `AISessionStorage` | persistent session table | Never read/written by the assistant | **nobody** (only registered in DI + tests) | EF | DB table exists | `AISessionRepositoryTests` (6) | **Dead** |
| `Application/Common/Models/AiHowToDtos.cs` (`AiHowToRequest/Response`) | DTOs | validator-only | none | — | — | `AiHowToQuestionValidatorShould` | **Dead** |
| `API/Mcp/WesalHallMcpTools.cs` | MCP server `/mcp` | Same 3 tools (+`startTime`) for external MCP clients | external | same services | none | 4 tests | Separate surface |

### 3.2 Frontend

| File | Responsibility | Notes |
|---|---|---|
| `components/assistant/AiAssistantProvider.tsx` | Mounts once in root layout; FAB + panel; **closes panel on every route change** | Panel is rendered only while open |
| `hooks/useAiAssistant.ts` | Session lifecycle `idle → loading → active | error | unavailable`, throttle, offline/online recovery, language-switch re-init | Session only in React state |
| `hooks/useAiChat.ts` | Thread state, send/retry, abort, in-flight guard | **Lives inside the panel ⇒ thread lost on close/navigation** |
| `services/ai-assistant.ts` | `POST /ai/sessions`, error classification | — |
| `services/ai-chat.ts` | `POST …/assistant`, DTO → `AiChatTurn` mapper; `isUsageQuestion`/`isHallSearchQuestion` (skeleton choice only) | Reads `availability.periods` (backend sends `slots`) |
| `types/ai-assistant.ts`, `types/ai-chat.ts` | Types | — |
| `components/assistant/*` | Panel, composer, thread, message bubble, hall list/cards, availability card, no-results, WhatsApp link, error banner/boundary, unavailable notice | — |
| `lib/ai-chat-whatsapp.ts` | **Linkifies any phone/WhatsApp-looking text in assistant output** | Applies to model-generated text too |
| `i18n/messages/{ar,en}.ts` (`assistant.*`, `errors.assistant.*`) | Copy; persona name is **"Mabrouk / مبروك"** | Frontend has no AI test scripts (`Frontend/scripts` has none for assistant) |

---

## 4. Request flows

### 4.1 Main example — "بدي قاعة بغزة لـ 300 شخص الجمعة"

**Primary path (Gemini healthy):**
1. `AiChatComposer` → `useAiChat.dispatch` (`inFlightRef` guard, `validateChatQuestion` ≤ 500 chars) → `sendAiChatTurn` → `POST /ai/sessions/{id}/assistant`, 25 s timeout, `validateStatus` accepts 200/400/404/503.
2. `AiAssistantController`: session lookup (slides 30-min TTL) → `GetConversationContextAsync` (last ≤6 user messages kept, orchestrator takes last 5, plus `LastIntent` = null in practice).
3. `AiAssistantService`: language detected (Arabic ≥ 60 % of letters ⇒ `ar`).
4. `GeminiToolOrchestrator`: KB search (returns nothing in prod, see §7) → system prompt (no date!) → `GenerateToolTurn`. Gemini likely calls `search_halls{region:"Gaza"}` ("300 شخص" has no capacity parameter; "الجمعة" cannot become an ISO date without today's date).
5. `WesalToolGateway` validates → `IHallSearchService.SearchHallsAsync` → `SearchApprovedHallsAsync` (approved halls only, `ORDER BY CreatedAt DESC, Name`, page ≤ 12) → public JSON projection → back to Gemini as `functionResponse`.
6. Gemini writes free text; the orchestrator returns `Answer`.
7. Response `Kind=Answer`, `Halls=[]`, `Intent=null` → frontend shows **a text bubble only** (no cards). `SaveTurnAsync` stores the user text; `LastIntent` unchanged.

**Degraded path (Gemini off — what production does today) [LIVE]:** orchestrator → `HowToService` → no payment match, KB empty, no creator match, Gemini unavailable → `MatchArabic` → no pattern hit → generic help text. **No search is ever executed.**

### 4.2 The other scenarios — which code owns the answer

| # | Question | Gemini healthy (and KB present) | Gemini down (prod today) [LIVE] |
|---|---|---|---|
| A | "شو هو وصال؟" | Orchestrator: KB `platform/about-wesal` injected; Gemini free-text (no tool) | `HowTo` → (KB empty) → generic help text |
| B | "كيف احجز قاعة؟" | Orchestrator: **no KB injected** (`user-guide` category is filtered out); Gemini free text from general knowledge | `HowTo.MatchArabic` booking branch (deterministic, correct) |
| C | "كيف اتواصل مع الدعم الفني؟" | KB `platform/contact` or `faq` injected; Gemini composes | `HowTo` → `MatchArabic` messaging branch ("تواصل") → **wrong: how to contact a hall owner** |
| D | "كم سعر الاشتراك لصاحب القاعة؟" | KB `faq` ("price varies, no fixed price") injected as authoritative; Gemini likely answers "no fixed price" — **contradicts the backend's 120 ILS** | Detector misses "الاشتراك" → messaging branch → **wrong**. ("كم سعر الاشتراك؟" without "ال" → correct payment text.) |
| E | "هات قاعات بغزة" | `search_halls` → text | generic help text, **no halls** |
| F | "شو تفاصيل قاعة X؟" | `search_halls{name}` → `get_hall_details` → text | generic help text |
| G | "هل القاعة متاحة الجمعة؟" | needs hall + date; no current date ⇒ guessed date or clarification | `MatchArabic` availability how-to |
| H | "مين عمل وصال؟" | Creator check happens *only inside HowTo*; with Gemini up it goes to Gemini with KB `platform/team` (if KB present) | `IsCreatorQuestion` ⇒ **hard-coded persona answer** that never names the team [LIVE] (the KB `team.md` answer is bypassed because creator check is after KB only when KB exists; with KB empty the canned text wins) |
| I | Unrelated ("capital of France?") | Gemini answers freely (prompt only says "safe general guidance" when KB empty; nothing forbids off-topic answers) | generic help text |
| J | Gemini unavailable | see right column everywhere | as above |
| K | DB/tool failure | Gateway returns `tool_error` to Gemini; Gemini phrases it; repeated failures hit repeat-guard ⇒ "couldn't complete safely" | n/a (no tools used) |
| L | Expired/unknown session | Controller `404` → frontend shows "session expired… close and reopen" (**does not auto re-initialize**, §13) | same |

---

## 5. Intent / routing matrix

"Primary" = Gemini healthy. "Fallback" = what actually runs when Gemini is off (today's prod).

| Question type | PRIMARY route | FALLBACK route | Source of truth | Model? | Tool? | Can hallucinate? | Context used | Output kind |
|---|---|---|---|---|---|---|---|---|
| Platform/about | Orchestrator + KB `platform` | HowTo: KB `platform` → keyword matcher (generic) | KB (absent in prod) | yes | no | Yes if KB absent (prompt only says "safe general guidance") | last ≤5 user texts | `Answer` |
| FAQ / price of Wesal | Orchestrator + KB `faq` | HowTo KB → generic | KB | yes | no | yes (KB empty) | same | `Answer` |
| Policies / privacy | KB `policies` (status needs-verification; caveat added only by HowTo, only a label "Pending verification" in Gemini prompt) | generic | KB | yes | no | medium | same | `Answer` |
| Technical support / contact / hours | KB `platform/contact`, `support-hours`, `faq` | HowTo KB → else messaging branch (wrong) | KB (absent) | yes | no | **Yes**: a contact number from the model is linkified as WhatsApp by the frontend | same | `Answer` |
| App how-to (login, register, rate, comment…) | Gemini free text (system rule 3), **no KB injected** (filtered categories) | `MatchArabic` deterministic | Gemini knowledge / static strings | yes | no | **Yes**: model has no feature list in the tool prompt | same | `Answer` |
| Booking how-to | same as above | `MatchArabic` booking branch | static strings | yes | no | **Yes** (deposit/cancellation rules live only in `needs-verification` KB that is never served) | same | `Answer` |
| Messaging how-to | same | `MatchArabic` messaging | static strings | yes | no | yes | same | `Answer` |
| Owner subscription / payment | **Gemini + KB `faq`** (no subscription facts anywhere in KB) | `SubscriptionPaymentService` trusted facts (correct, but keyword-fragile) | config (`SubscriptionPaymentOptions`) — but only reached in fallback | yes | no | **Yes**: admin number/price not in prompt when Gemini is up | same | `Answer` |
| Hall search | Gemini → `search_halls` | **none** (HowTo generic) | DB | yes | yes | low for data, but capacity/ordering gaps (§11) | user texts only | `Answer` (no cards) |
| Hall details | `get_hall_details` (after `search_halls`) | none | DB | yes | yes | low | user texts only | `Answer` |
| Hall availability | `check_hall_availability` | none (HowTo availability how-to) | DB | yes | yes | date grounding risk | user texts only | `Answer` |
| Hall comparison | **No tool** — Gemini must call details twice and compare itself | none | DB via repeated details calls | yes | partial | yes (comparison prose) | — | `Answer` |
| Recommendation / refinement | search_halls refined by Gemini | none (and `MergeWithContext` unreachable) | DB | yes | yes | capacity filtered by the model, not the DB | user texts only | `Answer` |
| Creator / team question | Gemini (+KB `team`) | `IsCreatorQuestion` canned persona text | KB / hard-coded | yes | no | low | — | `Answer` |
| Unsupported action ("احجز لي") | Gemini free text (no policy) | generic help | — | yes | no | **Yes**: model might claim to perform an action; nothing enforces `Unsupported` | — | `Answer` |
| Unrelated / general chat | Gemini answers freely | generic help | Gemini | yes | no | yes | — | `Answer` |
| Ambiguous | Gemini may ask or guess | generic help | — | yes | no | medium | — | `Answer` |
| Follow-up | history = user texts only | none (generic help) | — | yes | depends | **Yes**: no assistant turns, no hall ids/results in history | ≤5 user texts | `Answer` |
| Mixed (halls + app help) | Gemini does both | first matching `MatchArabic` branch only | DB + model | yes | yes | medium | — | `Answer` |

**Key observation:** in every row the primary output kind is `Answer`. The structured kinds (`Halls`, `HallDetails`, `Availability`, `Clarification`, `Unsupported`) exist only in the unreachable safety net.

---

## 6. Source-of-truth priority (what actually wins)

| Answer type | Winner when Gemini is healthy | Winner when Gemini is down (prod today) | Should be |
|---|---|---|---|
| Hall data (name, price, capacity, region) | live DB via tools, phrased by Gemini | **nothing** (no answer) | live DB |
| Availability | live DB via tool | nothing | live DB |
| Platform/about, team, support hours, contact | KB (**absent in prod**) → else Gemini | KB (absent) → canned/generic | KB |
| FAQ / Wesal "price" | KB `faq` (absent) → else Gemini | generic | KB |
| Subscription price / admin WhatsApp | **Gemini + KB `faq`** (which says "no fixed price") | config (`SubscriptionPaymentOptions`) when detector matches | config (single owner) |
| Feature how-tos (booking, login, rating…) | **Gemini general knowledge** | hard-coded strings in `HowToService` | KB `user-guide` + feature list |
| Creator | Gemini/KB | hard-coded persona string | KB `team` |

Where the model can invent (path actually permits it): booking rules (deposit, cancellation), subscription facts, support contact, policy text, application capabilities (it has no capability list in the tool prompt; `WesalPlatformKnowledge` feeds only the HowTo text call), and off-topic facts. It **cannot** invent hall records through the tool path because tool results are real, but it can misstate them (prose). It has no access to user data, JWTs, or private fields (§12).

---

## 7. Knowledge Base audit

### 7.1 Mechanism
- **Location:** `Backend/documentation/ai-knowledge/**/*.md`, embedded by `Wesal.Infrastructure.csproj` (`<EmbeddedResource Include="..\..\documentation\ai-knowledge\**\*.md" LogicalName="WesalKnowledge.%(Filename)%(Extension)" />`).
- **Format:** YAML-like front matter (`title, category, language, source, lastUpdated, status, keywords` with `|`-separated keywords) + sections `## العربية` / `## English`.
- **Status mapping:** `verified` / `draft` / anything else ⇒ `NeedsVerification`. **Drafts and unverified articles are still returned** by `SearchAsync` (no filtering by status).
- **Ranking:** title-contains (+2), keyword contained (+keyword length; brand words +2), shared 6-char stem (+len/2), content token overlap (+1 each). Ties: verified first, then `lastUpdated`. Top 1–10 (default 3). **No Arabic normalization** (no hamza/alef/ta-marbuta/diacritic folding), so morphological variants depend on listed keywords.
- **User-facing safety:** "Verification note / ملاحظة تحقق" paragraphs are stripped (`CleanUserFacingParagraphs`). HowTo appends an "unverified" caveat for non-verified articles; the Gemini prompt labels them "Pending verification".
- **Who consumes:** only categories `platform`, `faq`, `policies` are ever used (Orchestrator `OfficialKnowledgeCategories`, HowTo `OfficialFactCategories`). The 12 `user-guide`/`hall-owner` articles are **loaded, ranked, then discarded** — functionally dead content.
- **Injection limits:** max 3 results → filter → max 2 injected → hard-truncated to 2000 chars (truncation can cut mid-sentence, `LimitContext`).
- **Staleness:** `lastUpdated` only used for tie-breaking; nothing expires. All articles are dated 2026-09-16.

### 7.2 Production defect — KB is not in the image **[CODE + LIVE]**
`Backend/.dockerignore` ends with `documentation/   # Documentation — not needed for runtime`. Render builds with context `Backend/` (`Dockerfile`: `COPY . .`), so `Backend/documentation/` is excluded *before* MSBuild evaluates the embedded-resource glob. The glob silently matches nothing, the build succeeds, and `WesalKnowledgeService` runs with zero documents (no startup warning exists). The ignore rule (2026-08-19) predates the KB (2026-09).
Live evidence: "ما هي ساعات الدعم؟", "ما سعر وصال؟", "شو هو وصال؟" — all generic help text; KB would answer them verbatim. Tests do not catch this because they run against the source tree, not the Docker publish output.

### 7.3 Inventory (18 articles; all `lastUpdated: 2026-09-16`; languages ar+en)

| Title | Category | Status | Source | Purpose | Served to users? |
|---|---|---|---|---|---|
| Wesal FAQ | faq | verified | official-project-team | "price of Wesal" (no fixed price), how to contact support | yes (if KB present) |
| About Wesal | platform | needs-verification | official-project-team | platform definition + "Mabrook" assistant | yes (with caveat) |
| Wesal contact information | platform | verified | official-project-team | WhatsApp +970567581412, phones, email | yes |
| Wesal support hours | platform | verified | official-project-team | 9:00–18:00, no days/timezone | yes |
| Wesal team | platform | verified | official-project-team | developers | yes |
| Privacy policy | policies | needs-verification | official-project-team | "NEEDS OFFICIAL PRIVACY POLICY" placeholder | yes (with caveat) |
| Booking a hall | user-guide | needs-verification | official-team-and-repository | request flow, deposit agreement | **never** |
| Booking cancellation | user-guide | needs-verification | same | cancel, deposit loss | **never** |
| Hall comments | user-guide | needs-verification | same | registered users comment | **never** |
| Hall ratings | user-guide | needs-verification | same | "only users who booked" (flagged unconfirmed) | **never** |
| Guest users | user-guide | needs-verification | same | what guests can do | **never** |
| Hall details | user-guide | verified | repository-and-srs | | **never** |
| Login | user-guide | verified | repository-and-srs | | **never** |
| Registration | user-guide | verified | repository-and-srs | password rules | **never** |
| Search for halls | user-guide | verified | repository-and-srs | | **never** |
| Hall Owner guide | hall-owner | needs-verification | official-team-and-repository | notes an unresolved product decision | **never** |
| Hall management | hall-owner | verified | repository-and-srs | | **never** |
| Owner availability management | hall-owner | verified | repository-and-srs | | **never** |

### 7.4 Content conflicts and gaps
- **Conflict:** KB FAQ: no fixed price, contact WhatsApp `+970567581412`. Code: subscription 120 ILS/30 days, admin WhatsApp default `+972597744476` (hard-coded default in `SubscriptionPaymentOptions`; Render override UNKNOWN). Two "official" WhatsApp numbers with no article explaining which is for what. KB phone `590 774 4476` looks like a typo of `0597744476` (UNKNOWN — needs owner confirmation).
- **Persona naming:** UI/KB call the assistant **Mabrouk / Mabrook (مبروك)**; the canned creator answer and system prompts say "Wesal's smart assistant"/"Wesal AI assistant"; the tool prompt contains the nonsensical phrase "Grants-audience wedding-hall booking platform" (`GeminiPromptBuilder.cs:85`).
- **Candidate missing articles** (do not invent; needs product owner): hall-owner subscription (price, cycle, how payment unlocks features, what "locked" means), booking statuses (Pending/Accepted/Rejected/Reserved, deposit handling), hourly-slot model and "ShowBookedSlots", messaging/conversations, notifications, hall approval process for owners, admin-rejection reasons, hall lock/unlock, what the assistant can/cannot do, account/profile management, password reset, language switching, help center/tickets (a Help Center now exists on the site), region/area list, pricing semantics (per day vs hourly), cancellation windows, data/privacy details, service coverage beyond halls.

---

## 8. Gemini orchestration analysis

| Aspect | Verified value |
|---|---|
| Model | `GoogleAI:GeminiModel`, default `gemini-3.6-flash` (appsettings + `GoogleAiSettings`); `Program.cs` warns only if it does not start with `gemini-` and suggests `gemini-2.5-flash` (inconsistent hint) |
| Timeout | `GoogleAI:TimeoutSeconds` = 5 s (per HTTP call); HttpClient timeout uses it |
| Context limit | `MaxContextCharacters` = 2000, applied **only** to HowTo free-text prompt and intent prompt; **not** to tool-calling contents (history ≤5×2000 + message + unbounded tool results) |
| Tool rounds | max 4; repeat guard: identical call (name+args) > 2 ⇒ safe termination text |
| Tools | exactly 3 (see §9); only the **first** function call of a turn is executed (parallel calls silently dropped) |
| History | last ≤5 **user** texts, all sent as role `user`; assistant replies and tool results are **never** replayed |
| KB | categories platform/faq/policies; ≤2 articles; contact article skipped if no support markers |
| System prompt | no current date/time/timezone; rules: tools only for live data, free text for how-to, reject auth material, ignore prompt-override instructions, base Wesal facts on KB |
| Unknown tool | gateway says "not a supported Wesal tool" back to the model |
| Termination | text turn ⇒ done; empty/null turn ⇒ HowTo fallback; budget exhausted ⇒ "couldn't complete safely" |
| Language | detected from message (AR/Latin ratio) ⇒ directive in prompt; session language is only a fallback |
| Cancellation | `OperationCanceledException` propagates; timeouts (inner token not cancelled) are swallowed → `null` |

**Is the orchestrator the main brain?** Yes on paper. In practice it is bypassed/neutralised three ways: (1) KB absent in prod; (2) `IsAvailable == false` (breaker/key/disabled) routes *everything* to `HowToService`; (3) the deterministic intent path is unreachable (every `WesalToolOrchestrationResult` constructor call passes `Success = true`; `AiAssistantService` only falls through on an exception).

Conditions map:
- **Answer directly from Gemini:** model returns text without a function call (how-to, about, off-topic, follow-ups it can answer).
- **Call a tool:** model emits `functionCall`.
- **Inject KB:** every turn with Gemini available, if a platform/faq/policies article scores > 0.
- **Fall to HowTo:** Gemini unavailable; HTTP error/429/5xx; malformed JSON; empty turn; timeout.
- **Reach the secondary (intent) route:** only when `ExecuteAsync` throws `Exception` other than `ArgumentException`/cancellation — practically never.

### Confirmed defect: `Take(7)` splits tool-call pairs **[CODE]**
`GeminiService.TryToolTurnAttemptAsync` (`…/GeminiService.cs`): `contents.Take(7)`. With ≥5 prior user messages (history = 5) + current = 6 contents; after the first tool round the list is 8 (model `functionCall` at #7, `functionResponse` at #8). The next request sends only the first 7 — a `functionCall` with no matching `functionResponse`. Gemini normally rejects that (HTTP 400; exact behavior UNKNOWN, needs a live repro), which returns `null`, **opens the global breaker**, and falls back to HowTo for *all* users for 60 s. Unit test `GeminiToolCallingShould` asserts `contents.Count <= 7`, which encodes the cap rather than catching the split. Fewer prior turns shift the failure to later rounds.

### Other Gemini risks
- **Static, process-wide circuit breaker** shared by text, structured and tool calls; any single failure (even one slow request) disables Gemini for everyone for 60 s [LIVE-consistent: after cooldown, one attempt took 5.7 s then instant fallbacks resumed].
- **Latency vs timeout:** observed Gemini text answers ≈ 5 s against a 5 s timeout (first live batch: two answers with Gemini-style markdown at ~5.5 s wall time, then a failure). Timeout is almost certainly too tight for this model/config. Root cause of the failure (429 quota vs timeout vs model id) is UNKNOWN (needs Render logs — not accessible).
- **Thought-signature risk (UNKNOWN):** function-call parts are rebuilt without any provider metadata (`GeminiWirePart` has only text/functionCall/functionResponse). Some newer Gemini model families require echoing a `thoughtSignature` for multi-step function calling. Whether `gemini-3.6-flash` does cannot be determined offline; verify against a live call with a key.
- **Anonymous cost surface:** each message can cost up to 4 tool rounds + (on fallback) another Gemini call, with no per-IP/session/day cap.

---

## 9. Tool inventory

| Tool | Input schema | Validation | Data source | Public? | Output | Limits | Failure behavior | Auth | Tests |
|---|---|---|---|---|---|---|---|---|---|
| `search_halls` | `name?` (≤120), `region?` enum NorthGaza/Gaza/MiddleArea/SouthGaza, `area?` (≤80), `date?` yyyy-MM-dd, `pageSize?` 1–20 (default 12) | unknown keys rejected; types/lengths/enum/date checked; **at least one of name/region/area/date required** | `IHallSearchService` → approved halls, ordered **newest first** | yes | `{halls[], totalCount}` (id, name, region, address, description, capacity, price, main image) | page 1 only; no pagination param | returns `tool_error` text to model | none; `userId/ownerId/role/jwt/token/authorization/claims` keys rejected | yes |
| `get_hall_details` | `hallId` (GUID, required) | strict GUID | `IHallDetailsService` | yes | explicit public projection (no `Status`, no `IsOwner`) incl. contact phone, photos, upcoming availability | — | NotFound ⇒ "not found or not publicly available" | same | yes |
| `check_hall_availability` | `hallId`, `date` (required) | strict | `IHourlySlotService.GetHourlyCatalogAsync` | yes | `{hallId, date, dayOpen, slots[]}` | no past-date guard in the tool (only in the fallback handler) | error text | same | yes |

**What the assistant can do today:** search halls (name/region/area/date), get hall details, check hourly availability for one date. **It cannot:** filter by **capacity, price, or start time** (MCP exposes `startTime`; the internal gateway does not), compare halls (no tool), browse featured halls via tool (the fallback handler has `GetFeaturedHalls` but the tool list does not), answer booking rules from data, create/cancel bookings, contact owners, send messages, read the user's bookings/profile, read admin data, or modify anything. It has **no user identity at all** (endpoints are anonymous and never read the JWT). The external MCP server (`/mcp`, public) exposes the same three read-only tools.

---

## 10. How-to / FAQ / support routing (`HowToService`)

Actual priority order (`AskHowToAsync`):
1. **Subscription-payment intent** (`SubscriptionPaymentIntentDetector`) → trusted backend text (WhatsApp + price + cycle).
2. **Official KB** (first of top-3 with category platform/faq/policies), unless the contact-interference guard applies.
3. **Creator question** regex (`IsCreatorQuestion`).
4. **Gemini free text** (if available) using `WesalPlatformKnowledge` feature list.
5. **Deterministic keyword matcher** (`MatchArabic`/`MatchEnglish`) — first hit wins, in fixed order: search → booking → rating → comment → contact/owner → register → login → hall detail → availability → homepage → hall owner → language → payment → about → cancel → generic.

Consequences (evidence: code + live):
- **The payment detector is over-broad and runs first.** Bare keywords include `دفع`, `ادفع`, `أدفع`, `اشتراك`, `تجديد`, `جدد`, English `payment`, `pay`, `renew`, `ils`, `subscription`, and phrases like `كيف أدفع`, `how do i pay`. ⇒ "كيف أدفع الحجز؟" **[LIVE]** returns the hall-owner subscription instructions. "How do I pay for my booking?" likewise.
- **…and too narrow at the same time:** single words use `\b…\b`, so "الاشتراك" (ال-prefixed) does not match `اشتراك`. "كم سعر الاشتراك لصاحب القاعة؟" **[LIVE]** fell through to the messaging branch. "كم سعر الاشتراك؟" matched. (Arabic morphology is not handled.)
- **Contact ambiguity:** "كيف أتواصل مع صاحب القاعة؟" vs "…مع دعم وصال؟": with KB present, `IsContactInterference` disambiguates by the markers `wesal/وصال/support/دعم/…`; without KB the matcher's `تواصل` branch always answers with *hall-owner* messaging. "كيف اتواصل مع الدعم الفني؟" **[LIVE]** ⇒ owner messaging.
- **"شو سعر وصال؟" vs "شو سعر القاعة؟":** KB `faq` keywords (`سعر`, `كم سعر`) attract both; KB path gives the FAQ "no fixed price" answer for any "سعر" question that is not caught by the payment detector (including hall prices) — **UNKNOWN in prod because KB is empty**, but it is what the code would do. In the Gemini path, hall prices come from tools, so the clash is mainly in the HowTo fallback.
- **Matcher traps:** Arabic `MatchArabic` mixes English tokens with a stray "about …" prefix (`"about search"`) that never matches; the `MatchArabic` booking branch matches `حجز` inside any sentence; `MatchEnglish` matches substrings like `"pay"` in "pays", `"ils"` in "details"-like words (only the detector uses word boundaries).
- **Creator answer** is the same canned text for "مين عمل وصال؟" / "من هم مطورو وصال؟" **[LIVE]** — the KB `team` article (names the two developers) is unreachable when the KB is empty, and the canned text never names anyone.

---

## 11. Hall search / recommendation flow

Two *different* search semantics exist:

| Aspect | Gemini tools (`WesalToolGateway`) | Deterministic (`NaturalLanguageCriteriaExtractor` + `HallRecommendationMatcher`) |
|---|---|---|
| Name | `name` (partial) | not supported (handled by `TryResolveHallAsync` for details/availability) |
| Region | model picks enum | regex; English `"north"`/`"south"`/`"middle"` anywhere in the text; Arabic governorate and neighborhood words (e.g. النصر, الرمال ⇒ Gaza; رفح ⇒ South) |
| Area | model string | regex `(?:in|at|في)\s+(word)`: **takes the next word after "في"**, e.g. "قاعات في يوم الجمعة" ⇒ area = "يوم" ⇒ zero results (latent bug) |
| Capacity | **not supported** by the tool: model must filter the ≤12 newest results itself | parsed from `\d{2,4} + شخص/people…`; filtered **server-side** (`>=`) over 50 results |
| Date | ISO only (`yyyy-MM-dd`); prompt has no "today" | ISO, `dd/MM/yyyy`, "August 30"/"30 August" (assumes current/next year); **no weekday/relative dates** ("الجمعة", "بكرة", "next week") |
| Booking period | removed (hourly slots now) | removed |
| Price | not supported | not supported |
| Ordering | newest first (`CreatedAt desc`), not relevance | same repository ordering |
| No results | model phrases it | fixed bilingual text `NoResults` |
| Clarification | model-driven | `IncompleteCriteria` when no region/area/capacity/date |
| Availability validation | tool, no past-date guard | handler rejects past dates |
| Fuzzy hall name | model (search then pick) | `TryResolveHallAsync`: search by name, exact-ignore-case else **first result** (may pick the wrong hall silently) |

`RecommendationService`/`HallRecommendationMatcher` set `IsAvailable = true` unconditionally (the date filter is delegated to the search query); there is no per-hall availability validation beyond that. **Gemini and deterministic logic do not share semantics**, so the same question can give different answers depending on which path answered.

Live hall data: `GET /api/v1/halls` returns 4 approved halls; hall images referenced at `/uploads/halls/...` return **404 from Render** (upload storage is ephemeral, `HallMedia__Directory` not durable — startup warns about it); therefore even a working assistant would show broken images.

---

## 12. Safety / trust analysis

**Verified good**
- JWT/auth never reaches the model; endpoints are `[AllowAnonymous]` and never read the principal. Gateway rejects auth-shaped argument keys (`userid, ownerid, role, jwt, token, authorization, claims`) and unknown keys; public projections only (no `Status`/`IsOwner`).
- Tool loop bounded (4 rounds, repeat guard).
- API key is sent in header `x-goog-api-key`, never in the URL; never logged; log lines contain status codes only, no user text, no bodies.
- Gemini errors are swallowed to `null`; nothing leaks to the client.
- Verification notes are stripped from KB answers.
- Frontend renders text as text (no HTML injection).

**Real weaknesses**
1. **No enforcement of "unsupported" actions in the primary path.** The system prompt does not tell the model to refuse booking/cancel/pay requests or off-topic chat; `Unsupported` exists only in the dead classifier.
2. **Indirect prompt injection via tool data.** Hall `description`/name are owner-authored free text passed to the model as function results; system rule 7 only covers the *user* message. KB text is trusted (static, low risk).
3. **Model-invented phone numbers become clickable WhatsApp links** (`ai-chat-whatsapp.ts` linkifies any international/local-mobile pattern in assistant text).
4. **Cost/abuse controls:** global rate limiting is opt-in (`RateLimiting:Enabled=false` in appsettings; Render value UNKNOWN); no per-IP/session/day cap on `/assistant`, unbounded session creation in an in-memory dictionary, tool-context size unbounded.
5. **Global circuit breaker = cross-user denial of service** (one slow/failed call degrades everyone for 60 s; an attacker can trigger it cheaply).
6. Message length: frontend 500 vs backend 2000 (`HowToRequestValidator` also 500): harmless but inconsistent.
7. Language detection duplicated four times (controller-path services) — a divergence risk, not a leak.

---

## 13. Conversation memory analysis

| Property | Value [CODE] |
|---|---|
| Storage | `ConcurrentDictionary<Guid, AiSession>` inside a **singleton**; process memory |
| TTL | 30 min sliding (`GetSessionAsync` extends; `PeekSessionAsync` does not) |
| Cleanup | sweep timer every 5 min + lazy removal on access |
| Stored per turn | **only the user's text**, max 6 messages; plus `LastIntent` (only written when `response.Intent != null`, i.e. only in the unreachable safety-net path) |
| Not stored | assistant replies, tool results, hall ids, selected hall, language changes, hall list order |
| Thread safety | list mutated under `lock(session)`; reads (`GetConversationContextAsync`) are unlocked (`RecordedMessages.Select`) — race possible but low impact |
| Restart / redeploy | all sessions lost ⇒ next `/assistant` returns 404 |
| Multi-instance | sessions are per instance ⇒ random 404s behind a load balancer (Render scale-out) |
| Persistent repo | `AISession` entity + `AISessionRepository` + migration exist and are registered, but **no code path uses them** and the table has no message/intent columns |

Traces:
1. **"هات قاعات بغزة" → "300 شخص" → "يوم الجمعة"**
   - Gemini healthy: turn 1 searches Gaza. Turn 2 sees the earlier *user* message only; it may re-search Gaza and filter ≤12 results by capacity itself (no DB capacity filter). Turn 3: no date anchor; any date is a guess.
   - Gemini down **[LIVE]**: every turn returns the generic help text.
   - `MergeWithContext` (carry-forward of region/area/date/capacity) only runs in the dead path.
2. **"احكيلي عن قاعة النخيل" → "متاحة بكرة؟"**: turn 2's model sees the turn-1 user text but **not** the hall id or the reply, so it must re-search by name; "بكرة" is unresolved without today's date. Works at best by luck.
3. **"كيف احجز؟" → "وبعدها كيف ادفع؟"**: healthy ⇒ model continues coherently from user-only history (booking how-to ungrounded). Down **[LIVE]** ⇒ "كيف ادفع" hits the payment detector ⇒ **hall-owner subscription** answer, which is wrong for a seeker.

**Why the persistent repository is unused:** it was added by an earlier session-storage task ("AISessionStorage", 2026-08-25) before `ChatSessionService` gained conversation context; the controller composes the in-memory service only. No evidence of a planned migration (UNKNOWN).

---

## 14. Frontend state and rendering analysis

**Session state machine (`useAiAssistant`):** `idle → loading → active | error | unavailable`. Open/toggle bursts throttled (800 ms); in-flight requests joined; offline ⇒ `unavailable(network)` immediately; `online` event auto-retries; 404/5xx/network errors classified; language switch re-initializes a new session.

**Conversation states (`useAiChat`):** `idle → sending → success | error`; `inFlightRef` blocks duplicate sends; `AbortController` aborts on session change/unmount; Retry replays the last prompt without a duplicate bubble; 25 s request timeout; `validateStatus` accepts 200/400/404/503.

**Gaps (all [CODE]):**
1. **Chat thread is lost whenever the panel closes or the route changes** (`AiAssistantProvider` closes the panel on every `pathname` change and renders `AiAssistantPanel` only while open; `useAiChat` lives in the panel). The backend session (and its memory) survives, so UI and memory diverge.
2. **Expired/unknown session is a dead end.** A 404 yields an error bubble "Close it and open it again", but nothing re-initializes: `hasUsableSession` trusts `expiresAt` from the *initial* session response (never refreshed although the backend slides it). After a Render restart the user keeps hitting 404 until that stale `expiresAt` passes or the language changes. Conversely, after 30 minutes of active chatting the client may discard a still-valid session on the next open.
3. **Reload/new tab = new session + empty thread** (no persistence of session id or messages).
4. **Availability card is wired to a field the backend doesn't send:** frontend reads `availability.periods[]` (`periodType/periodName/…`); backend sends `slots[]` with `startTime/endTime/status`. The card would always render empty even when `Kind=Availability` (which production never emits today).
5. **Hall/availability/clarification/unsupported renderers are effectively dead** because the primary path always returns `Kind=Answer`.
6. Client-side heuristics `isUsageQuestion`/`isHallSearchQuestion` choose the loading skeleton; if wrong, the user sees "looking for halls…" for a how-to (cosmetic).
7. Persona and strings say **Mabrouk** while backend text says "Wesal's smart assistant".
8. Response fields ignored by the mapper: `intent` (only partly used for criteria), `hallDetails.description/contactPhone/photos` (only cover image kept in the card).

---

## 15. Production configuration analysis

Values are **never printed**; statuses only.

| Setting | Source in repo | Render value | Status |
|---|---|---|---|
| `GoogleAI:Enabled` | appsettings `true` (default in class) | not visible | **CANNOT VERIFY** (behavior shows Gemini is attempted) |
| `GoogleAI:ApiKey` | appsettings `""` (env only) | not visible | **Likely CONFIGURED** (inferred: live calls take ~5 s and one returned Gemini-style markdown) — CANNOT VERIFY |
| `GoogleAI:GeminiModel` | `gemini-3.6-flash` | not visible | CANNOT VERIFY (validity of id unknown) |
| `GoogleAI:BaseUrl` | `https://generativelanguage.googleapis.com/v1beta` | not visible | default assumed |
| `GoogleAI:MaxContextCharacters` | 2000 | not visible | default assumed |
| `GoogleAI:TimeoutSeconds` | 5 | not visible | default assumed; **too tight** vs observed ≈5 s latency |
| `SubscriptionPayment:*` | defaults: +972597744476 / 120 ILS / 30 d | not visible | live fallback text showed the defaults ⇒ **defaults are in force** (no override) [LIVE] |
| `RateLimiting:*` | `Enabled:false` | not visible | CANNOT VERIFY |
| KB embedding | csproj + `.dockerignore` | n/a | **NOT SHIPPED** [CODE+LIVE] |
| `HallMedia__Directory` / `DocumentStorage__Directory` | unset ⇒ temp dir | not visible | upload images 404 [LIVE] ⇒ effectively ephemeral |

Failure-mode behavior (code): missing key / `Enabled=false` ⇒ `IsAvailable=false` ⇒ HowTo for all; timeout/429/5xx/malformed JSON ⇒ `null` ⇒ breaker opens 60 s ⇒ HowTo; tool service failure ⇒ gateway `tool_error` ⇒ model phrases it.

---

## 16. Test coverage

~379 AI tests across 27 files (counts from `[Fact]/[Theory]` attributes). Groups:

| Area | Files (tests) |
|---|---|
| Controller | **none** for `AiAssistantController` (only `ControllerCompositionShould` DI) |
| Sessions | `ChatSessionServiceShould` (23), `AISessionRepositoryTests` (6, dead code) |
| Language | `AiLanguageDetectorShould` (11), `AiBilingualProcessingShould` (11) |
| Knowledge | `WesalKnowledgeServiceShould` (28), `HowToServiceKnowledgeShould` (17), `WesalPlatformKnowledgeShould` (5) |
| Gemini | `GeminiServiceShould` (17), `GeminiFailoverShould` (25), `GeminiStructuredOutputShould` (14), `HowToServiceGeminiShould` (5) |
| Tool calling | `GeminiToolCallingShould` (15), `GeminiToolOrchestratorShould` (17), `WesalToolGatewayShould` (23), MCP (4) |
| Intent | `AiIntentFallbackClassifierShould` (17), validators (6+8+10) |
| Recommendations | `RecommendationServiceShould` (13), `HallRecommendationMatcherShould` (12), `RecommendationResponseShould` (15) |
| Availability | via `AiAssistantServiceShould`, hourly availability parity |
| How-to/FAQ/payment | `HowToServiceShould` (21), `…FaqRegressionShould` (13), `…PaymentContactShould` (6), `…CreatorShould` (5) |
| Frontend mapping | **none** (no assistant scripts in `Frontend/scripts`) |
| Fallback | `AiAssistantServiceShould` (safety-net tests use mocks where the orchestrator returns `Success=false`, a state the real orchestrator never produces) |
| Security | gateway auth-key rejection tests; no rate-limit/abuse test for AI |

**High-value missing tests** (do not add yet): (1) publish-artifact test asserting KB article count > 0 (or startup health check); (2) orchestrator degraded mode returns *search results* when Gemini is down (integration); (3) `GenerateToolTurn` never sends unmatched `functionCall`; (4) "كيف أدفع الحجز؟", "كم سعر الاشتراك لصاحب القاعة؟", "كيف اتواصل مع الدعم الفني؟" route tests; (5) end-to-end conversational scripts with a fake Gemini: search → refine capacity → "الثانية" → availability → booking how-to; (6) session expiry/re-init on the frontend; (7) frontend mapper contract test against the real `AiAssistantResponse` JSON (`slots` vs `periods`); (8) breaker isolation (one user's failure must not disable others); (9) controller tests for 400/404 and message length; (10) prompt-injection-in-hall-description test.

---

## 17. Capability matrix

| Capability | Works today (prod)? | Source | Confidence | Limitation |
|---|---|---|---|---|
| Search halls | **No** (only while Gemini happens to respond) | DB via tools | High (live) | No capacity/price filter; newest-first; text only |
| Refine search | **No** | — | High | `LastIntent` unreachable; history user-only |
| Hall details | Intermittent (Gemini only) | DB via tool | Medium | text only; ambiguous name resolution by model |
| Availability | Intermittent (Gemini only) | DB via tool | Medium | no today's date; frontend card mismatch |
| FAQ | **No** (KB absent) | KB | High (live) | wrong answers possible from Gemini |
| Platform info | **No** | KB | High | generic text |
| Technical support / hours | **No** | KB | High | wrong branch (owner messaging) |
| Contact info | **No** | KB | High | two conflicting numbers in repo |
| Subscription/payment help | **Partly** — only with a matching keyword, else wrong | config | High | detector over/under-matches |
| Booking help | Yes (deterministic text) | static strings | High | not KB-backed; Gemini version ungrounded |
| Messaging help | Yes (but also shown for wrong questions) | static strings | High | — |
| Bilingual AR/EN | Yes | detector + bilingual strings | High | dual language detectors; persona name mismatch |
| Follow-up memory | **Weak** (user texts only) | in-memory | High | no assistant/tool memory |
| Restart persistence | **No** | — | High | |
| Authenticated personalization | **No** | — | High | anonymous endpoints |
| User-specific bookings | **No** | — | High | no tool |
| Booking creation | **No** | — | High | |
| Owner actions | **No** | — | High | |
| Admin actions | **No** | — | High | |

---

## 18. Confirmed issues

### CONFIRMED BUG
| ID | Finding | Evidence | Symptom | Root cause | Severity | Safest later fix direction |
|---|---|---|---|---|---|---|
| B1 | KB not embedded in prod | `Backend/.dockerignore` `documentation/`; csproj glob; live generic answers | support/about/FAQ unanswered | ignore rule excludes the KB source | **Critical** | include `documentation/ai-knowledge` in the build context (negate in `.dockerignore` or move KB under `src/`), add startup log + health/publish test that article count > 0 |
| B2 | Hall search/details/availability dead when Gemini off | `GeminiToolOrchestrator.FallbackToHowToAsync`, `AiAssistantService` (only throws fall through); live | "هات قاعات بغزة" ⇒ boilerplate | fallback returns `Success=true` | **Critical** | degrade into the existing deterministic intent/search path (or return `Success=false` when degraded) |
| B3 | Payment detector mis-routes | `SubscriptionPaymentIntentDetector` keywords; live | "كيف أدفع الحجز؟" ⇒ owner subscription; "…الاشتراك…" missed | bare keywords + `\b` vs Arabic prefixes | High | require subscription/owner context; normalize ال-prefix; gate on role/intent, not single verbs |
| B4 | Support question answered with owner messaging | `MatchArabic` ordering; live | "كيف اتواصل مع الدعم الفني؟" wrong | first-match keyword order, KB absent | High | resolved by B1 + support intent before generic contact |
| B5 | `Take(7)` can split tool-call pair | `GeminiService.cs` | long chats lose tool answers; breaker opens | fixed cap on contents | High (runtime effect UNKNOWN) | keep pairs intact (trim history, not tool turns) |
| B6 | Global static circuit breaker | `GeminiService._circuitOpenUntilUtcTicks` | one failure ⇒ 60 s global outage | static, all call types | High | scope per call type / require consecutive failures / per-instance health |
| B7 | Availability card contract mismatch | backend `Slots` vs frontend `periods` | empty card | DTO drift | Medium | align mapper (when structured output returns) |
| B8 | Expired/lost session dead-end | `ai-chat.ts` 404 path; `useAiAssistant` | stuck until stale `expiresAt` passes | no re-init on 404, client-side TTL never refreshed | High | auto re-create session on 404 and replay |
| B9 | Chat thread lost on close/route change | `AiAssistantProvider`, panel-owned `useAiChat` | conversation disappears, backend still remembers | state scoped to panel | Medium | lift thread state to provider/storage |

### ARCHITECTURAL DUPLICATION
- Intent classification ×3: Gemini tool choice, `GeminiAiIntentExtractor`/`AiIntentFallbackClassifier`, `HowToService` keyword matcher; plus frontend `isUsageQuestion/isHallSearchQuestion`.
- Hall search semantics ×2 (tools vs `HallRecommendationMatcher`).
- FAQ/facts ×3: KB markdown, `WesalPlatformKnowledge`, hard-coded `MatchArabic/MatchEnglish` strings (+ `SubscriptionPaymentService` text).
- Language detection called in controller-path services four times.
- Legacy `/how-to` & `/recommend` endpoints duplicate `/assistant` internals.
- Two persistence designs (in-memory sessions vs `AISession` table).

### GROUNDING RISK (only where a code path permits it)
- G1 Subscription price/contact via Gemini + KB `faq` ("no fixed price") when Gemini is up (contradicts config).
- G2 Booking/cancellation/deposit rules from model general knowledge (user-guide KB never injected).
- G3 Relative dates (no "today" in prompt).
- G4 Capacity filtering done by the model on ≤12 newest results.
- G5 Model-generated phone numbers linkified as WhatsApp.
- G6 Off-topic/unsupported requests not refused (prompt lacks a policy).
- G7 Hall comparison prose generated by the model without a tool.

### CONTEXT / MEMORY GAP
- M1 user-only history; no assistant or tool memory ("الثانية" unresolvable).
- M2 `LastIntent`/`MergeWithContext` unreachable in primary path.
- M3 in-memory only (restart + multi-instance).
- M4 persistent repo unused.

### KNOWLEDGE GAP
- user-guide/hall-owner KB never served; no subscription article; two conflicting contact numbers; `needs-verification` on booking/cancellation/ratings; privacy placeholder; see §7.4.

### FRONTEND UX GAP
- hall/availability cards dead; thread lost; no session recovery; persona naming; 500 vs 2000 limits; skeleton heuristics.

### PRODUCTION CONFIG GAP
- TimeoutSeconds 5 s; model id validity UNKNOWN; rate limiting off by default; upload storage ephemeral (hall images 404); `SubscriptionPayment` defaults in force; Render env not inspectable.

### NOT A PROBLEM (verified fine)
- Tool gateway validation and auth-material rejection; bounded tool rounds and repeat guard; API key in header; no sensitive logging; public-only projections; verification notes stripped; language directive present; creator answer deterministic.

---

## 19. Architectural duplication — KEEP / CONSOLIDATE / WRAP / DEPRECATE / REMOVE-LATER

| Component | Decision | Rationale |
|---|---|---|
| `WesalToolGateway` + 3 tools | **KEEP** | good safety boundary; add tools later behind it |
| `GeminiToolOrchestrator` | **KEEP + evolve** into the single orchestrator; fix fallback and history |
| `GeminiService` | **KEEP**, **CONSOLIDATE** breaker/timeouts |
| `WesalKnowledgeService` | **KEEP**; ship it; add Arabic normalization and status policy |
| `SubscriptionPaymentService/Options` | **KEEP** as single owner of payment facts; expose as a tool or deterministic policy |
| `HowToService` keyword matcher | **WRAP** as the deterministic safety-critical layer (payment/support/creator policies) invoked *by* the orchestrator, not a separate fallback; migrate strings to KB over time |
| `AiIntentFallbackClassifier`, `NaturalLanguageCriteriaExtractor`, `GeminiAiIntentExtractor`, `RecommendationService`, `HallRecommendationMatcher` | **CONSOLIDATE** into the orchestrator's degraded mode (one search semantic); then **REMOVE-LATER** the extractor |
| `AiAssistantService` dispatcher (Halls/Details/Availability handlers) | **WRAP**: reuse these handlers to build structured responses from tool results |
| `WesalPlatformKnowledge` static list | **CONSOLIDATE** into KB |
| Legacy `/how-to`, `/recommend` | **DEPRECATE** (frontend doesn't use them) → **REMOVE-LATER** |
| `AISession` table/repo/migration | **REMOVE-LATER** or **REPURPOSE** as the persistent session store (decision needed) |
| `AiHowToDtos` | **REMOVE-LATER** |
| Frontend `isUsageQuestion`/`isHallSearchQuestion` | **DEPRECATE** (derive skeleton from response kind / a neutral loader) |
| Frontend hall/availability cards | **KEEP** (will be fed by structured output) |

---

## 20. Knowledge gaps

See §7.4 (list of candidate articles and the two source conflicts). Nothing was invented; each needs product-owner input.

---

## 21. Target architecture (incremental, no rewrite)

```
USER MESSAGE
   ▼
Unified Assistant Orchestrator  (existing GeminiToolOrchestrator, evolved)
   ├─ 0. Deterministic POLICY gate (existing HowTo pieces, made precise):
   │        subscription/payment, support/contact, creator, unsupported actions ⇒ trusted text from KB/config
   ├─ 1. Grounding context: today's date/timezone, session language, last results/selected hall (structured),
   │        KB top-N across ALL categories (user-guide/hall-owner included), feature list
   ├─ 2. Gemini decides: KB answer | tool call | clarification | refusal
   │        tools: search_halls (+capacity,+startTime), get_hall_details, check_hall_availability
   │               (later: compare_halls, get_featured_halls; read-only)
   ├─ 3. Degraded mode (Gemini down): SAME tools driven by the deterministic classifier/extractor — no separate behavior
   └─ 4. Structured result: {Kind, message, halls[], hallDetails, availability, sources, intent}
   ▼
Frontend = renderer only (cards from structured kinds; no intent routing)
```

Principles: Gemini = router/reasoner; tools/DB = live truth; KB = static truth; **one** owner per fact (payment facts, contact, pricing); conversation state stores user turns **and** assistant summaries/selected entities; deterministic policies for safety-critical answers; frontend never decides intent.

---

## 22. Prioritized implementation roadmap

**P0 — correctness / wrong answers**
1. Ship the KB to production (fix `.dockerignore`/embedding), add startup warning when article count = 0, add a publish-output test.
2. Degraded-mode routing: when Gemini is unavailable, run the deterministic intent → search/details/availability handlers instead of HowTo-only. Make orchestrator report degradation (`Success=false`/flag) so the safety net is reachable.
3. Fix payment/support/contact routing (precise payment detector incl. Arabic ال-prefix, owner-subscription scoping; "support" intent before generic "تواصل").
4. Fix `Take(7)` pair splitting and make the circuit breaker non-global (per-instance, consecutive-failure, separated by call type); raise/make configurable the 5 s timeout; verify thought-signature requirement live.
5. Inject today's date/timezone into the tool prompt.

**P1 — grounding / routing consistency**
6. Return **structured** results from the primary path (map tool results → `Halls/HallDetails/Availability`), populate `Intent`; fix `slots`↔`periods`.
7. Single owner for subscription/price/contact facts; resolve KB↔config conflict; feed facts to the model via KB/tool.
8. Serve `user-guide` and `hall-owner` KB articles (inject or answer deterministically); add Arabic normalization; status policy for drafts/needs-verification.
9. Add refusal/unsupported policy + off-topic policy to the prompt and/or pre-gate; sanitize/label tool data as untrusted.
10. Add `capacity` (and `startTime`) to `search_halls`; define ordering.

**P2 — memory and persistence**
11. Store assistant replies + selected hall ids/last results in the turn history; restore `LastIntent`.
12. Persist sessions (reuse or replace `AISession`) or make sessions multi-instance safe; TTL policy.
13. Cost/abuse controls: per-IP/session limits on `/assistant` and session creation; cap tool-result size and history.

**P3 — UX**
14. Auto-recreate session on 404 and replay; refresh client `expiresAt`; keep chat thread across close/navigation (and optionally reload).
15. Unify persona ("Mabrouk") across prompts/canned text; fix prompt typo; align 500/2000 limits.
16. Render richer cards from structured kinds; linkify WhatsApp only for trusted contact facts.

**P4 — future capabilities**
17. `compare_halls`, featured halls, booking-status reads for signed-in users (read-only, authenticated tool context), then owner/admin read helpers. No write tools until the above is stable.

---

## WHAT I WOULD CHANGE FIRST AND WHY

1. **Fix `Backend/.dockerignore` so `documentation/ai-knowledge` reaches the build (and add a "KB loaded N articles" startup log/test).** One-line change with the biggest effect: it instantly restores FAQ, about, support hours, contact and team answers, and it removes the main reason the assistant feels random in production. It is also the cheapest thing to verify.
2. **Make Gemini-down mean "degraded but functional", not "help-text only".** Route the fallback through the existing deterministic classifier/search handlers. Today, with Gemini timing out ≈ every call, *the assistant cannot do the one thing users most expect* (find halls). This reuses code that already exists and is tested, so the risk is low.
3. **Correct the payment/support/contact routing and stop the global breaker from punishing everyone.** These produce confidently **wrong** answers ("كيف أدفع الحجز؟" → owner subscription; support → owner messaging) and cause the intermittent "Gemini off" behavior. Raising the 5 s timeout and fixing `Take(7)` belong in the same small change set.
4. **Then** add today's date to the prompt and return structured results so cards and follow-ups work — the path from "working chatbot" to "one reliable assistant".

All four are small, local changes that evolve the current architecture; none requires a rewrite.
