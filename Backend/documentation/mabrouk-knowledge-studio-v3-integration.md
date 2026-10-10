# Mabrouk V3 × Knowledge Studio Integration (Mabrouk side)

Production V3 base: `1c53663` (PR #29 `d712f59` + PR #30 `1c53663`, both merged).
Prep branch: `feat/mabrouk-learning-loop-integration-prep` (this branch, no merges, no deploys).

The Knowledge Studio is built separately by Codex. This document is the
Mabrouk-side handoff: what V3 guarantees, where a gap may be recorded, and
what the Studio must provide. Mabrouk code here is preparation only
(detection predicate + tests); there is deliberately NO recorder, NO gap
storage, and NO cluster model on this side — one recorder, one storage, one
cluster model, all owned by the Studio.

## 1. Architecture stays hybrid and additive

```
Live application data (halls, slots, bookings)
+ Capability Registry (Coming Soon / unavailable services)
+ Dynamic published Knowledge (Studio-owned, future)
+ Built-in Markdown Knowledge (26 files, 20 verified — NEVER replaced)
+ Gemini reasoning (grounded, optional)
+ Safe deterministic fallback
```

Dynamic Knowledge is ADDITIVE. Built-in Markdown must remain loadable even
when the Dynamic store is empty or down. Deletions of built-in files: 0.
Baseline: `Backend/documentation/mabrouk-knowledge-preservation-baseline.md`
(26 files, 20 verified, 5 categories, blob hashes).

## 2. Production V3 pipeline (audited on main)

Per assistant turn, `AiAssistantService.ProcessMessageAsync`
(`Backend/src/Wesal.Infrastructure/AiAssistant/AiAssistantService.cs`):

1. Session ownership (`ChatSessionService.GetSessionAsync`; 404 before any AI
   work) → conversation context load (turns, last intent/halls/hall, V3 state).
2. Pending-date resume (`AiConversationStateResolver.TryResume`): active hall +
   `بكرة`-style date → live availability, pending cleared on success.
3. Collection questions bypass hall context → trusted public search.
4. Next-result (`غيرها`) / bare ordinals (`الثانية`) against last halls with
   durable `ShownHallIds` fallback; cursor advanced in state.
5. Policy gate (`AiAssistantPolicyGate.TryHandleAsync`): payments, support,
   Coming Soon / unavailable capabilities, explicit navigation. All
   registry-backed, all terminal for the turn.
6. Hall-context shortcut: price/capacity/location/availability questions about
   the resolved hall answered from live data (availability without a date asks
   for the date and stores pending clarification).
7. Built-in knowledge (`HowToService.TryAnswerKnownQuestionAsync`).
8. Gemini tool orchestration (grounded, read-only tools); any failure falls
   through — never a gap by itself.
9. Deterministic degradation by intent (`HandleDeterministicAsync`):
   HowTo / Search (incl. NoResults) / Featured / Details / Availability /
   Unsupported / Clarification.
10. Contextual navigation suggestions (registry only), state persistence
    (`Advance` / `AdvanceOrdinal` / `AdvanceSelection` / `WithCollectionResults`
    in `AiAssistantController`), HTTP response unchanged.

Rate limiting (`assistant` policy on the endpoint) rejects with 429 BEFORE the
service runs. Auth/session/guest/expiry rules live in `ChatSessionService`.

## 3. Structured outcome taxonomy (internal, never public)

A turn resolves through exactly one source. Names below are the handoff
vocabulary (implementation may keep its own route strings):

LiveHall, LiveAvailability, LiveSearch, Capability, Navigation, Policy,
DynamicKnowledge (future), BuiltInKnowledge, Clarification, UnsupportedKnown,
NoResults, TrustedModelTool, TrueFallbackUnknown, OperationalError.

Current V3 already exposes enough to distinguish them WITHOUT new public
fields: `AiAssistantResponse.Kind`, `Intent`, `Halls/HallDetails/Availability`
payloads, `Actions[].PageKey/Href`, plus the server `route=` log. No public
`AiAssistantResponse` change is required.

## 4. True knowledge gap (only these enter the future inbox)

A turn is gap-eligible ONLY when ALL hold:

- HTTP 200 with a final assistant answer (no exception, no 429, no 404).
- Route is the deterministic HowTo path (`HandleHowToAsync`, intent HowTo).
- `HowToService.AskHowToAsync(allowModel: false).Category` is the generic
  no-information fallback, i.e. `HowToService.IsGenericFallbackAnswer` true
  (Category `"general"`).
- Zero additional Gemini calls were made to decide this.

Example: "هل يوجد خصم للعرسان في شهر رمضان؟" → generic fallback → eligible.

## 5. Never gaps (enforced by hook placement + tests)

No-results search, no available slot, hall not found, missing hall/date/
capacity clarifications, pending V3 slot state, end of `غيرها` list, known
Coming Soon / unavailable capabilities, read-only limitations, navigation
answers, auth failures, 429s, Gemini timeouts, backend/DB errors, invalid
input. All resolve outside the deterministic-HowTo-generic path (distinct
kinds, intents, null-intent policy answers, or pre-service rejection), so a
hook placed per §6 cannot see them. Pinned by
`MabroukKnowledgeGapPrepShould.OperationalOutcomesDoNotRouteThroughGenericHowTo`.

## 6. Exact integration hook (for the future integration branch)

- FILE: `Backend/src/Wesal.Infrastructure/AiAssistant/AiAssistantService.cs`
- METHOD: `HandleHowToAsync` (called only from the `HowTo` arm of
  `HandleDeterministicAsync`, i.e. after every trusted source declined).
- LOCATION: after `answer` is computed, before `Build(...)`.
- WHY: at that point the final outcome is known, all trusted sources
  (live data, capability/policy, collection/references, built-in knowledge,
  Gemini orchestration) have had their chance, and 429/auth/session failures
  are already excluded by construction. The predicate
  `HowToService.IsGenericFallbackAnswer(answer)` is the structured,
  string-matching-free signal (§5 of the mission explicitly forbids matching
  answer text like "ما بعرف").
- SHAPE (integration branch only, using Codex's recorder contract):
  resolve response → check eligibility → `try { await recorder.RecordAsync(...) }`
  `catch { structured warning, no user text }` → return ORIGINAL response
  unchanged. Exactly one attempt per turn. No clustering, no Admin logic, no
  user-facing change ("تم الإرسال للإدارة" must never appear; no cluster ids,
  scores, or routes leak).

## 7. Recording is secondary / fail-open; privacy contract

Recorder/DB failure must never break Mabrouk (HTTP still 200, safe fallback
still returned) and must never log the raw question. The future event carries
only bounded, sanitized data: question (redacted, length-bounded), language,
reason, assistant route, high-level intent, occurred-at. Never: JWT/headers/API
keys/passwords, full conversations, booking/owner/message/identity data, raw
payloads. Defense in depth: V3 sanitizes before emitting; Studio sanitizes
again before storing.

## 8. Dynamic Knowledge insertion (Studio-owned, recommended seam)

The natural read seam is the official-knowledge lookup inside
`HowToService.AskHowToAsync` / `TryAnswerKnownQuestionAsync`, composed with
`IWesalKnowledgeService` (whose contract doc already anticipates richer
backends; callers must not depend on index/vector internals). Requirements:
Dynamic answers outrank weak built-in matches once published; take effect with
no restart/redeploy; an empty or failing Dynamic store leaves built-in
behavior exactly as today (failure test required).

## 9. Known caveat: weak official-match absorption (proven, pinned)

`MabroukKnowledgeGapPrepShould.BrandBearingUnknownsAreAbsorbedByOfficialArticle`
proves that brand-bearing unknowns ("هل وصال عنده خطة مؤكدة يفتح بخانيونس؟",
"هل يوجد مكتب لوصال في رفح؟") currently match the official platform article
(Category `platform`) via brand-keyword scoring, so the generic-only hook does
not see them. The Studio hybrid ranking must resolve this (scored matches with
a weakness threshold that the hook can consult); Mabrouk must NOT silently
rewrite verified facts to work around it. Until then, the §17-style plan
question is the acceptance probe for the ranking fix, and this test pins
current behavior so any change is deliberate.

## 10. Expected Studio contracts (Codex-owned; NOT duplicated here)

Recorder interface (single), gap candidate DTO (question/language/reason/
route/intent/occurred-at), gap reasons, sanitization, cluster persistence +
occurrence counting, Admin APIs (`/admin/mabrouk` Unanswered → cluster →
Create Answer → publish), simulator, migrations. Compatibility table against
the requirements above is PENDING until the Studio branch lands on the remote
(no Studio branch/PR exists there yet; the local `feat/mabrouk-knowledge-studio`
has no implementation commits).

## 11. Conflict risk / integration order

Likely shared touch points: `HowToService` (official-KB seam), `WesalKnowledge*`
DTOs/service, `ApplicationDbContext` + migrations, `AiAssistantService` (hook
call only), Admin API surface (Studio-only). Recommended order: Studio lands
first on its own branch → NEW branch `feat/mabrouk-knowledge-learning-loop-integration`
based on the Studio branch → bridge (hook call + hybrid read seam + loop test)
→ draft PR targeting the Studio branch, never merged by Mabrouk side.

## 12. Test matrix status (this branch)

Record: 2× genuine-unknown → generic category. Do-not-record: no-results,
missing date/hall/capacity, Coming Soon, unavailable service, read-only
request, navigation, rate limit (structural), provider timeout (structural:
orchestrator failure → deterministic, no extra model call), operational Error,
hall not found, end-of-results, built-in knowledge, live facts, availability,
multi-turn context (81-conversation / 269-turn executor green). Learning-loop
end-to-end (§30), recorder-failure, and Dynamic-failure tests belong to the
integration branch once Studio contracts exist. Feedback (👍/👎) is prepared
for, not blocking.

## 13. Learning-loop acceptance (for the integration branch)

Unknown → safe unknown response + one unresolved gap; Admin publishes Dynamic
answer; same question asked again in the SAME backend process → Dynamic answer
immediately, no restart/deploy, no new unresolved occurrence. Existing
knowledge (team, add-hall, support, capabilities, navigation) must never
create gaps; V3 conversation regression (search → date → `بكرة` → `غيرها` →
price, and collection → ordinal → facts) must record 0 gaps; full backend +
frontend suites stay green with zero extra per-turn Gemini calls for detection.
