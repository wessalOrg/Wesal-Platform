# Mabrouk V2 audit and delivery notes

Audit date: 2026-10-09
Repository: `wessalOrg/Wesal-Platform`
Branch: `feat/mabrouk-intelligence-v2`
Starting local and `origin/main` SHA: `1e39ed8f2d97170024839fc7a321e83a5810a9ea`

This document records source-code findings and checks from this branch. It does not claim live Gemini quality, production health, or a production database migration: no billable provider request or production mutation was run.

The branch was created from the recorded `origin/main` commit with a clean worktree, no pre-existing tracked or untracked changes, and no stashes. Local HEAD and `origin/main` both pointed to `1e39ed8f2d97170024839fc7a321e83a5810a9ea` at the start.

## Current architecture

```mermaid
flowchart LR
  UI[Assistant UI / sessionStorage cache] -->|POST /api/v1/ai/sessions/{id}/assistant| API[AiAssistantController]
  API --> OWN[ChatSessionService / owner and TTL checks]
  OWN --> DB[(AiConversationSessions)]
  API --> SVC[AiAssistantService]
  SVC --> CTX[AiContextResolver: page allowlist, trusted date, hall re-fetch]
  CTX --> POL[AiAssistantPolicyGate: navigation, unsupported services, support/payment]
  POL --> FAST[Live hall-context fast path]
  FAST --> ORCH[GeminiToolOrchestrator]
  ORCH --> PROMPT[Prompt + lexical KB + capability registry]
  PROMPT --> SDK[GeminiService / official Google Gen AI SDK]
  SDK --> ORCH
  ORCH --> GATE[WesalToolGateway: 3 read-only tools]
  GATE --> APP[Existing Wesal application services]
  SVC --> FALLBACK[Deterministic classification, search, detail, availability, how-to]
  FAST --> OUT[Typed assistant response]
  ORCH --> OUT
  FALLBACK --> OUT
  POL --> OUT
  OUT --> UI
```

### Sources of truth and boundaries

| Concern | Current source and boundary |
| --- | --- |
| Public hall facts | Existing hall application services and approved/public repositories. The assistant never treats model output or client-provided hall attributes as facts. |
| Page identity and navigation | `WesalNavigationRegistry` resolves only known frontend paths; tests compare registered paths with the frontend route tree. The model supplies no URL. |
| Current capability status | `WesalCapabilityRegistry` supplies status, route, auth, supported/unsupported actions, tools, and knowledge source to policy and prompt context. It distinguishes available, coming soon, unavailable, private booking data, and auth-required booking navigation. |
| Static product facts | Bilingual Markdown articles under `Backend/documentation/ai-knowledge/`, embedded by `Wesal.Infrastructure` and loaded by `WesalKnowledgeService`. Retrieval is bounded lexical/metadata ranking; no vector store was added. |
| Current date | `AiClock` uses configured `Asia/Gaza` time zone; relative dates are resolved by deterministic application code. |
| User identity | The API derives authenticated user ID from `ICurrentUserService`; the model and request body cannot supply it. Public tools contain no private booking read. |
| Conversation continuity | `AiConversationSessions` stores bounded, sanitized turns and structured last intent/hall references with a 30-minute sliding expiry. User ownership is checked on every session access; guest sessions have no user ID and are not adopted by logged-in users. The browser `sessionStorage` copy is a sanitized UI cache only. |

Authenticated booking, messaging, profile, or owner-dashboard data was not added to the public assistant tool surface. Those questions need a separately reviewed read-only design that obtains identity exclusively from trusted server context.

Conversation context currently retains recent text, last intent, last shown halls, and the focused hall. It does not persist every proposed state slot (for example an explicit unresolved-clarification object or separate user goal); this remains a possible follow-up if evaluation shows a need.

## Gemini calls, prompts, and protocol

The infrastructure adapter uses Google’s official `Google.GenAI` .NET SDK behind `IGeminiService` / `IGeminiToolCallService`; Google SDK types stay inside `Wesal.Infrastructure`. The package is pinned to `1.25.0`, the latest official .NET release verified on 2026-10-09. The SDK targets .NET 8 and .NET Standard 2.0, so the application’s .NET 10 target is supported.

The main unified assistant endpoint uses `GeminiToolOrchestrator`: one initial tool-capable generation, followed by zero or more bounded tool rounds. It exposes exactly three read-only tools: `search_halls`, `get_hall_details`, and `check_hall_availability`. Every call is checked against the declared name/schema and delegated to existing application services. There are no assistant write tools or private user-data tools.

Other existing provider entry points remain available behind the same adapter:

| Adapter operation | Current caller / purpose | Prompt and output |
| --- | --- | --- |
| `GenerateToolTurnWithThinkingAsync` | Unified assistant orchestration | `BuildToolSystemInstruction` plus bounded recent conversation, current page/hall context, up to two ranked KB articles, and capability/tool context; returns provider response continuation plus typed tool calls or text. |
| `GenerateTextAsync` | Legacy `/how-to` route, only after trusted static/policy knowledge and deterministic support answers do not apply | `BuildSystemInstruction` and user question; bounded text response. The unified assistant’s deterministic degradation calls `AskHowToAsync(..., allowModel: false)`, so it cannot make a second model call after orchestration failure. |
| `GenerateStructuredAsync<T>` | `GeminiAiIntentExtractor.ExtractAsync` contract | `BuildIntentSystemInstruction`, bounded conversation/current message, and JSON schema. The unified endpoint’s fallback intentionally uses `ExtractWithoutModelAsync`; the legacy structured extractor is not chained after a failed tool turn. |

The adapter caps a single HTTP request at the configured timeout (default 10 seconds; clamped to 1–120), disables SDK retries (`Attempts = 1`), and the tool orchestrator enforces a whole-turn budget (default 15 seconds), at most four model rounds, and at most two repeated identical tool calls. The deterministic route handles a `NotHandled`, timeout, disabled/unavailable provider, or provider error. The circuit breaker opens after three consecutive failures for 30 seconds; it is process-local, not coordinated across Render instances.

Gemini function-call and continuation data is retained without reconstructing a reduced model message. The SDK response content is carried in an opaque, bounded in-memory provider-continuation field between model rounds; returned calls retain IDs; corresponding function responses reuse each exact call ID; parallel parts stay in order. Provider fields modeled by the SDK, including thought signatures, are replayed exactly. Local loopback HTTP tests exercise the SDK adapter’s request/response protocol and continuation handling without Google credentials or provider traffic.

Official documentation checked on 2026-10-09:

- [Google Gen AI .NET SDK and release notes](https://github.com/googleapis/dotnet-genai), [SDK changelog](https://github.com/googleapis/dotnet-genai/blob/main/CHANGELOG.md)
- [Function calling](https://ai.google.dev/gemini-api/docs/generate-content/function-calling)
- [Thought signatures](https://ai.google.dev/gemini-api/docs/generate-content/thought-signatures)
- [Thinking levels](https://ai.google.dev/gemini-api/docs/generate-content/thinking)
- [Gemini 3.6 Flash](https://ai.google.dev/gemini-api/docs/models/gemini-3.6-flash), [Gemini 3.8 Flash](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash), and [model catalog](https://ai.google.dev/gemini-api/docs/models)

Google’s current Generate Content docs require thought signatures to be returned in the original part for Gemini 3 function calls and require exact function-call IDs in function responses. The SDK and opaque continuation approach address this protocol requirement; the loopback tests are protocol evidence, not live provider compatibility evidence. Structured output uses the SDK’s JSON response schema surface. Per-call timeout and one-attempt retry configuration are explicit in the adapter.

### Model and thinking policy

The configured default remains `gemini-3.6-flash`, with `low` fast, `medium` normal, and `high` deep thinking configured in `GoogleAiSettings`. The orchestrator selects high only for at least three explicit search constraints; medium for two constraints or multiple remembered halls; otherwise low. Static policy/navigation and live hall-context answers avoid Gemini when handled before orchestration. A normal tool turn makes one initial model call; additional calls occur only for the bounded tool loop.

Official Google docs list `gemini-3.8-flash` as the latest stable Flash as of this audit date, while 3.6 remains a stable model. No live model benchmark ran, so there is no evidence here for a 3.8 quality, latency, or cost win on Mabrouk’s Arabic/tool workloads. Recommendation: keep 3.6 as configured and run a separately authorized, cost-bounded 3.6-vs-3.8 model evaluation before changing the deployment model. No Render model value was changed.

## Product knowledge and retrieval

The current KB contains 23 articles. The top-ranked article is respected for official platform facts; a lower-ranked broad article can no longer override a more specific feature guide. Official articles inject no more than two results into the main tool prompt. The 126-turn offline dataset includes Arabic, dialect, English, spelling variants, short queries, support/payment distinctions, homepage questions, and overlapping knowledge queries. Retrieval is lexical/metadata-based; given this small corpus and no measured semantic-recall advantage, embeddings were not added.

Articles marked `verified` are backed by current repository implementation or current official project facts. `needs-verification` means a mutable product or policy statement could not be confirmed from code alone and must not be presented as settled policy.

| Status | Articles |
| --- | --- |
| Verified (15) | `faq/faq.md`; `hall-owner/availability.md`; `hall-owner/hall-approval.md`; `hall-owner/hall-management.md`; `hall-owner/subscription.md`; `platform/contact.md`; `platform/homepage.md`; `platform/support-hours.md`; `platform/team.md`; `user-guide/booking-status.md`; `user-guide/contact-owner.md`; `user-guide/hall-details.md`; `user-guide/login.md`; `user-guide/registration.md`; `user-guide/search.md` |
| Needs verification (8) | `hall-owner/owner-guide.md`; `platform/about-wesal.md`; `policies/privacy.md`; `user-guide/booking.md`; `user-guide/cancellation.md`; `user-guide/comments.md`; `user-guide/guest-users.md`; `user-guide/ratings.md` |

The booking and cancellation articles now distinguish the code-confirmed hourly-slot/Pending/Accepted flow from unconfirmed deposit and refund policy. The cancellation article explicitly records the conflict between earlier product wording and the current cancellation endpoint. Homepage knowledge now describes the current three category cards and Coming Soon status rather than a stale featured-halls layout; live featured-hall data remains a separate API concern.

## Re-run of requested legacy risks (A–R)

| Risk | Status | Evidence and limitation |
| --- | --- | --- |
| A. Knowledge Base production packaging | FIXED | `AiKnowledgePackagingShould` verifies every KB article is inside the Docker build context, the infrastructure project embeds it, unrelated docs stay excluded, and all source articles load. This is local build-context evidence; no Render image was built or deployed here. |
| B. Gemini failure fallback | FIXED | Unified orchestration returns `NotHandled` on provider unavailability/failure/timeout; deterministic handling uses `ExtractWithoutModelAsync` and `allowModel: false`, removing the second-model fallback. Covered by local tests; no live outage injection against production. |
| C. Timeout configuration | FIXED | 10-second single-call default plus 15-second whole-turn budget; user cancellation is linked through SDK calls. |
| D. Circuit breaker | PARTIALLY FIXED | Three consecutive failures, 30-second cool-down, and recovery are per-process. Multiple Render instances do not share breaker state. |
| E. Tool-call history pairing | FIXED | Official SDK, provider continuation round-trip, call ID to response ID pairing, and a loopback fake-server test; no live Gemini request. |
| F. Date/time grounding | FIXED | `Asia/Gaza` business clock plus deterministic relative-date resolution and testable current-date context. |
| G. Support vs. hall-owner contact | FIXED | Contact-intent separation and KB ranking/contact-interference tests keep Wesal Help Center guidance from replacing hall-owner messaging instructions. |
| H. Booking payment vs. owner subscription | FIXED | Deterministic payment intent routes owner subscription to trusted settings, booking deposit to booking KB, and ambiguous requests to clarification. |
| I. Current-page context | FIXED | Path is matched against the navigation registry; dynamic IDs are parsed and re-fetched from public application services. Client fields do not authorize access. |
| J. Pinned hall context | FIXED | A valid pinned hall ID is re-fetched; client-supplied hall name/price/capacity is ignored. Explicit hall names and ordinal references have defined precedence. |
| K. Ordinal references | FIXED | Recent shown-hall references are kept in session state and the ordinal resolver maps references such as “الثانية” to those IDs. |
| L. Session ownership isolation | FIXED IN CODE; DEPLOYMENT UNVERIFIED | Durable EF-backed records, guest/user identity checks, bounded sanitized memory, optimistic revision updates, expiry cleanup, and owner-isolation tests. The additive database migration has not been applied to production. |
| M. Frontend session recovery | FIXED | One 404/expiry recovery creates one new session and replays the turn at most once; 429 has localized UI handling. |
| N. Safe navigation | FIXED | Actions resolve to allowlisted internal routes only; arbitrary URLs/private admin routes are blocked; coming-soon browsing is separated from an explicit request to open its status page. |
| O. Unsupported/Coming Soon truth | FIXED FOR REGISTERED SERVICES | Capability statuses drive prompt context and deterministic responses for photographers, event planners, catering, private bookings, and hall actions. Registry scope is assistant-specific; the older general platform-feature inventory remains for the legacy `/how-to` prompt. |
| P. Stale product knowledge | PARTIALLY FIXED | 23 articles reviewed, homepage and current booking/hourly behavior corrected, and stale/colliding ranking covered. Eight mutable/policy articles remain `needs-verification`; product confirmation is still needed. |
| Q. Model/API compatibility | PARTIALLY FIXED | Custom REST adapter replaced with official SDK 1.25.0, local protocol tests exercise calls and continuation; 3.8 is now latest stable while 3.6 is configured. No live 3.6/3.8 behavior, latency, or cost comparison was authorized or run. |
| R. Cost-abuse protection | PARTIALLY FIXED | Dedicated assistant-only token bucket (six initial burst; six refill every 30 seconds, for twelve per minute), concurrency cap two, authenticated-user/IP partition, and friendly 429 UI. Limiting is per-process, has no session partition, and IP rotation/distributed quotas are not covered. |

## Evaluation and validation boundary

`Backend/tests/Wesal.Tests/Ai/Fixtures/mabrouk-golden-eval.json` contains 126 diverse turns across all 17 requested dimensions, including multi-turn context and ownership cases. `MabroukOfflineEvaluationShould` uses real deterministic application services and scripted model/tool outputs, records dimension scores, marks `offlineOnly=true` and `providerCalls=0`, and writes `TestResults/mabrouk-eval-report.json` during the test run. The passing score is a deterministic/offline regression score; it is not a Gemini-language-quality score.

The expected report dimensions are: intent accuracy, context resolution, hall reference resolution, date resolution, knowledge retrieval, capability truth, tool selection, tool arguments, grounded response type, navigation safety, fallback quality, dialect understanding, English understanding, prompt-injection resistance, unsupported actions, session ownership, and conversation continuity.

The backend has explicit tests for SDK wire compatibility against a loopback HTTP fake, session isolation, knowledge packaging, rate-limit policy, Arabic/Persian numeral normalization, hall search capacity pagination, knowledge ranking, and navigation allowlists.

### Validation run on 2026-10-09

- `dotnet restore Backend/Wesal.slnx`: passed.
- `dotnet build Backend/Wesal.slnx -c Release --no-restore`: passed, 0 warnings and 0 errors.
- `dotnet test Backend/Wesal.slnx -c Release --no-build`: passed, 2,491/2,491 tests. The focused assistant regression rerun passed 187/187.
- Offline golden evaluation: 126/126 turns, 100% aggregate and 100% in each of 17 dimensions, `offlineOnly=true`, `providerCalls=0`. The generated report is `Backend/tests/Wesal.Tests/TestResults/mabrouk-eval-report.json` (ignored test output). This measures deterministic application behavior with scripted model output, not live-model quality.
- `npm ci --legacy-peer-deps`: passed from the committed lockfile, 391 packages installed.
- Frontend API URL guard: 25/25 checks passed; assistant contract: 23/23 checks passed; session-storage sanitization passed; `npx tsc --noEmit` passed; ESLint passed for all changed frontend TypeScript files; `npm run build` passed on Next.js 16.4.0.
- The full `npm run lint` command still reports four `react-hooks/set-state-in-effect` errors in unchanged `RegisterFormCard.tsx`, `StorySection.tsx` (two), and `OwnerInboxList.tsx`, plus three existing warnings. The changed frontend files pass targeted ESLint.
- `npm audit --omit=dev --json`: 0 vulnerabilities. Full `npm audit` reports five high-severity entries, all from one development-only dependency chain ending in `braces@3.0.3` through `eslint-config-next` / `@next/eslint-plugin-next` / `fast-glob` / `micromatch`. The [GitHub advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) has no patched `braces` release. `npm audit fix --force` proposes downgrading `eslint-config-next` to 14.2.35, which would mismatch Next 16; that breaking downgrade was not applied. Compatible lockfile updates set `source-map-js` to 1.2.2, `js-yaml` to 4.3.2, and `brace-expansion` to 1.1.21 / 5.0.12.
- `git diff --check`: passed. A secret-pattern scan over the changed branch files found no API-key, token, AWS-key, or private-key-header matches.

## Merge recommendation

**Safe to merge: NO, pending review of the remaining toolchain advisory and repository-wide lint result.** The production dependency audit is clean and all changed frontend files pass targeted lint, but the full audit still has one high-severity, development-only advisory with no upstream patch, and full lint reports four errors in files untouched by this branch. No downgrade or unrelated frontend code edit was made to conceal those findings.

## Security, cost, observability, and latency

- All three model tools are public read-only lookups. Unknown tool names/arguments are rejected; no private booking, identity, payment, messaging, booking-write, approval, or owner mutation tool is exposed.
- Prompt-injection instructions in user text, tool data, hall text, and knowledge are treated as untrusted data by the prompt and tested offline. Tool output remains authoritative; unsupported actions are answered without claiming execution.
- Session memory redacts common JWT/bearer/secret-assignment patterns, caps input/history, uses a sliding 30-minute expiry, and is owner-scoped. Expired rows are swept every five minutes. The DB migration and live cross-instance behavior still need deployment verification.
- Assistant logs record route, response kind, page key, context type, action count, stage timings, model/thinking level, tool counts/rounds, aggregate token counts when supplied, and fallback reason. Exception details are reduced to exception type. No user prompt or full tool payload is emitted. These are application logs, not a production metrics dashboard; provider HTTP status-class and cross-instance circuit metrics are not yet a shared telemetry series.
- The direct frontend packages were updated to `next` / `eslint-config-next` 16.4.0 and `axios` 1.20.0, and compatible transitive advisories were patched in the lockfile. The production dependency audit is clean; the remaining development-only `braces` advisory and whole-repository lint errors remain merge blockers until upstream publishes a patch or the team explicitly accepts that toolchain risk.
- Fast policy and hall-context paths make zero model calls; the main model path starts with one tool-capable call and is bounded to four rounds/15 seconds. A failed main model path does not call the model again during deterministic fallback. No production p50/p95 or token/cost measurements are available.
- Rate limiting applies only to the assistant by default; the global API limiter remains opt-in. The current limiter partitions authenticated traffic by user ID and guests by forwarded remote IP and runs in each process.

## Migration, merge, and production smoke plan

No production configuration, Render/Vercel/Supabase state, deployment, or database was changed. The branch adds one additive `AiConversationSessions` migration. `Program.cs` applies EF migrations on API startup and also supports the explicit release command `dotnet Wesal.API.dll --migrate`; production migration execution was not tested here. The current branch does not require a Gemini model/key change. Existing `GoogleAI__*` values should remain as they are until a model benchmark is approved. The assistant rate policy is code-defaulted on; `RateLimiting:Assistant:*` overrides are optional.

After PR review/merge and an approved deployment, use this smoke sequence:

1. Run the existing Render release migration command once; verify the deployment log reports successful EF migration and the `wesal.AiConversationSessions` table and expiry index exist. Do not print connection strings or credentials.
2. Check `/health` and `/health/live`, then load the frontend and verify the assistant initializes a new guest session.
3. Ask “open the FAQ” / “افتح الأسئلة الشائعة”; confirm a typed internal `/faq` action and that the client follows it only after the user selects it.
4. Ask “find photographers” / “بدي مصورين”; confirm Mabrouk states Coming Soon and does not claim to search/book. Then ask “open the photographers page” / “افتح صفحة المصورين”; confirm only the real `/photographers` route appears.
5. Ask for an approved public hall using a real region and capacity; verify returned hall IDs/names/capacities match the live catalog and `totalCount`/pagination. Continue with “the second” and then an availability question for a real date; verify the same hall is resolved and availability comes from current services.
6. Create sessions for a guest and an authenticated test user in a non-production verification environment; verify each can read only its own session, and that logout invalidates the authenticated user’s sessions. Do not inspect another user’s private data.
7. Send seven rapid policy-only assistant turns from one same-IP guest partition; confirm the configured six-request burst is accepted, the next returns 429, and the localized frontend message is friendly. Confirm ordinary API and health endpoints remain reachable.
8. Review logs for stage timing/fallback values and absence of prompt text, hall payloads, or credentials. A provider-specific smoke call is a separate, explicitly authorized billable check; it was not run for this branch.

## Exact file inventory

The PR diff is the authoritative complete inventory. This audit groups the changed sources and tests by purpose; it is not a production-change list:

- Backend assistant orchestration, policy, context, SDK integration, configuration and rate limiting: `Backend/src/Wesal.API/Controllers/AiAssistantController.cs`, `Backend/src/Wesal.API/Program.cs`, `Backend/src/Wesal.API/RateLimiting.cs`, `Backend/src/Wesal.API/RateLimitingOptions.cs`, `Backend/src/Wesal.Application/Ai/NaturalLanguageCriteriaExtractor.cs`, `Backend/src/Wesal.Application/Ai/Navigation/AiNavigationIntentDetector.cs`, `Backend/src/Wesal.Application/Ai/Navigation/WesalNavigationRegistry.cs`, `Backend/src/Wesal.Application/Ai/WesalCapabilityRegistry.cs`, `Backend/src/Wesal.Application/Common/Interfaces/IAiIntentExtractor.cs`, `Backend/src/Wesal.Application/Common/Interfaces/IChatSessionService.cs`, `Backend/src/Wesal.Application/Common/Interfaces/IGeminiToolCallService.cs`, `Backend/src/Wesal.Application/Common/Interfaces/Persistence/IAiConversationSessionStore.cs`, `Backend/src/Wesal.Application/Common/Interfaces/Persistence/IHallRepository.cs`, `Backend/src/Wesal.Application/Common/Models/HallSearchRequest.cs`, `Backend/src/Wesal.Application/Common/Models/WesalToolDtos.cs`, `Backend/src/Wesal.Infrastructure/AiAssistant/AiAssistantPolicyGate.cs`, `Backend/src/Wesal.Infrastructure/AiAssistant/AiAssistantService.cs`, `Backend/src/Wesal.Infrastructure/AiAssistant/AiContextResolver.cs`, `Backend/src/Wesal.Infrastructure/AiAssistant/ChatSessionService.cs`, `Backend/src/Wesal.Infrastructure/AiAssistant/GeminiAiIntentExtractor.cs`, `Backend/src/Wesal.Infrastructure/AiAssistant/GeminiPromptBuilder.cs`, `Backend/src/Wesal.Infrastructure/AiAssistant/GeminiService.cs`, `Backend/src/Wesal.Infrastructure/AiAssistant/GeminiToolOrchestrator.cs`, `Backend/src/Wesal.Infrastructure/AiAssistant/GoogleAiSettings.cs`, `Backend/src/Wesal.Infrastructure/AiAssistant/HowToService.cs`, `Backend/src/Wesal.Infrastructure/AiAssistant/WesalToolGateway.cs`, `Backend/src/Wesal.Infrastructure/DependencyInjection.cs`, `Backend/src/Wesal.Infrastructure/Halls/HallSearchService.cs`, `Backend/src/Wesal.Infrastructure/Wesal.Infrastructure.csproj`.
- Durable session persistence and hall filtering: `Backend/src/Wesal.Domain/Entities/AiConversationSession.cs`, `Backend/src/Wesal.Persistence/Data/ApplicationDbContext.cs`, `Backend/src/Wesal.Persistence/DependencyInjection.cs`, `Backend/src/Wesal.Persistence/Migrations/20261009090000_AddDurableAiConversationSessions.cs`, `Backend/src/Wesal.Persistence/Migrations/ApplicationDbContextModelSnapshot.cs`, `Backend/src/Wesal.Persistence/Repositories/AiConversationSessionStore.cs`, `Backend/src/Wesal.Persistence/Repositories/HallRepository.cs`, `Backend/src/Wesal.Persistence/Services/AiConversationSessionCleanupService.cs`.
- Backend tests and offline evaluation: `Backend/tests/Wesal.Tests/Ai/AiNavigationIntentDetectorShould.cs`, `Backend/tests/Wesal.Tests/Ai/MabroukContextualAssistantShould.cs`, `Backend/tests/Wesal.Tests/Ai/MabroukHarness.cs`, `Backend/tests/Wesal.Tests/Ai/MabroukOfflineEvaluationShould.cs`, `Backend/tests/Wesal.Tests/Ai/NaturalLanguageCriteriaExtractorShould.cs`, `Backend/tests/Wesal.Tests/Ai/WesalNavigationRegistryShould.cs`, `Backend/tests/Wesal.Tests/Ai/Fixtures/mabrouk-golden-eval.json`, `Backend/tests/Wesal.Tests/Api/RateLimitingShould.cs`, `Backend/tests/Wesal.Tests/Infrastructure/ChatSessionServiceShould.cs`, `Backend/tests/Wesal.Tests/Infrastructure/GeminiFailoverShould.cs`, `Backend/tests/Wesal.Tests/Infrastructure/GeminiSdkTestServer.cs`, `Backend/tests/Wesal.Tests/Infrastructure/GeminiServiceShould.cs`, `Backend/tests/Wesal.Tests/Infrastructure/GeminiStructuredOutputShould.cs`, `Backend/tests/Wesal.Tests/Infrastructure/GeminiToolCallingShould.cs`, `Backend/tests/Wesal.Tests/Infrastructure/GeminiToolOrchestratorShould.cs`, `Backend/tests/Wesal.Tests/Infrastructure/HallSearchServiceShould.cs`, `Backend/tests/Wesal.Tests/Infrastructure/HowToServiceKnowledgeShould.cs`, `Backend/tests/Wesal.Tests/Infrastructure/PassiveInvitationSessionValidationShould.cs`, `Backend/tests/Wesal.Tests/Infrastructure/WesalToolGatewayShould.cs`, `Backend/tests/Wesal.Tests/Persistence/HallSearchRepositoryShould.cs`, `Backend/tests/Wesal.Tests/Wesal.Tests.csproj`.
- Knowledge and deployment documentation: `Backend/documentation/ai-knowledge/hall-owner/availability.md`, `Backend/documentation/ai-knowledge/platform/contact.md`, `Backend/documentation/ai-knowledge/platform/homepage.md`, `Backend/documentation/ai-knowledge/platform/team.md`, `Backend/documentation/ai-knowledge/user-guide/booking-status.md`, `Backend/documentation/ai-knowledge/user-guide/booking.md`, `Backend/documentation/ai-knowledge/user-guide/cancellation.md`, `Backend/documentation/ai-knowledge/user-guide/hall-details.md`, `Backend/documentation/ai-knowledge/user-guide/search.md`, `Backend/documentation/mabrouk-v2-audit.md`, `Backend/documentation/mcp.md`, `Backend/documentation/render-deploy-checklist.md`.
- Frontend storage/recovery and response UX support: `Frontend/README.md`, `Frontend/package.json`, `Frontend/package-lock.json`, `Frontend/scripts/verify-ai-chat-storage.ts`, `Frontend/scripts/verify-assistant-contract.ts`, `Frontend/src/i18n/messages/ar.ts`, `Frontend/src/i18n/messages/en.ts`, `Frontend/src/lib/ai-chat-storage.ts`, `Frontend/src/lib/wesal-routes.ts`, `Frontend/src/services/ai-chat.ts`.
