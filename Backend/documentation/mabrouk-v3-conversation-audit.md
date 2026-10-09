# Mabrouk V3 Conversation Audit

## Starting point

V3 is stacked on PR #29 head `0653321b1b12cb7df6a84adb9de11004b763e42d`, because the recovery PR was open and mergeable. The V2 policy gate, tool registry, deterministic knowledge service, and durable session store remain the source-of-truth boundaries.

## Observed root causes

| Reported behavior | Root cause in the starting code | V3 resolution |
|---|---|---|
| `بكرة` after an availability date question went to generic HowTo | `ChatSessionService` retained recent turns/last intent/halls, but no pending slot or resume intent. A one-word date was classified as a fresh request and fell through deterministic HowTo. | Store `PendingClarification=date`, `PendingIntent=CheckHallAvailability`, and active hall reference in bounded `ConversationStateJson`; resolve date against `AiClock` and fetch current hall/availability before normal classification. |
| `غيرها` fell through | `AiReferenceResolver` handled ordinals only; there was no selected result cursor. | Resolve next-result phrases against the last shown hall references and advance selected index without looping. |
| Generic hall listing answered about prior focused hall | `AiContextResolver` could select the last hall when `AiHallQuestionClassifier` classified `احكيلي` as details, before deterministic search. | Collection-level questions now bypass prior/pinned/page hall context and call the trusted public search service. |
| Plural hall wording reused singular context | Hall context resolution had no collection-vs-singular precedence. | Explicit plural/list task takes precedence; singular pronouns remain eligible for live hall facts. |
| `وديني علقاعات` was missed | Shared page noun matching does not tokenize the attached typo/clitic phrase as a registry noun; existing preposition prefix support only applied to the noun itself. | Add a narrow attached-clitic phrase rule for hall navigation; action href still comes from `WesalNavigationRegistry`. |
| Photographer question had generic fallback | The existing capability registry/gate already contains the Coming Soon answer; the missed route occurs when wording is not matched by unavailable-topic intent detector or gets classified as another request. | Preserve deterministic capability check before model and keep explicit navigation as a separate registry-backed path; regression tests pin both phrases. |

## State and precedence

`AiConversationState` is an 8 KB bounded JSON value on `AiConversationSessions`. It stores task labels, pending field/intent, active hall id/name, up to ten shown hall ids, selected result index, concise criteria, requested fact labels, date, navigation target, question type, and stage. It stores no raw payload, credentials, or token. The nullable additive migration preserves older sessions. Existing ownership, guest identity, TTL, and revision concurrency checks are unchanged.

Turn precedence is: policy/security gate; resumable pending date; explicit collection request; next-result/ordinal; explicit entity; singular live hall context; verified knowledge; grounded tools/Gemini; deterministic fallback. Search and availability remain read-only. A completed date resolution clears the pending clarification when the controller advances the exchange state.

## Evidence and limits

Baseline PR #29 knowledge coverage and 126-turn offline evaluation passed before V3 edits (9 focused tests). V3 focused tests exercise date resume through two service instances sharing the session store, ownership isolation, plural collection override, result navigation, clitic navigation, photographer capability/navigation distinction, verified developer identity, and add-hall knowledge.

This checkout has no local PostgreSQL connection string or compose file. Therefore process-restart persistence is represented by a fresh `ChatSessionService` over the same persistent-store abstraction; a real backend process restart against PostgreSQL has not been claimed. Collection/search and availability tests use the existing in-memory service doubles, not connected production data. Full local API smoke and production-data semantics still require an environment with the configured database and public hall corpus.
