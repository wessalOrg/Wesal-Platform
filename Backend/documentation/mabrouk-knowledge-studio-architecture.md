# Mabrouk Knowledge Studio architecture

## Repository audit

This feature was developed on an isolated worktree based on V3 commit 51ae2b35c15ebde281db05d3a06100216d6be97c. The active checkout for V3 was left untouched.

The existing Admin experience is hosted by Frontend/src/app/admin/layout.tsx. AdminManagementGuard waits for account state and redirects unauthenticated users and non-admins; AdminManagementShell supplies the shared Wesal dashboard header, responsive sidebar, language switcher, and content frame. AdminSidebar is the existing navigation surface. Account routes live in account-profile-path.ts, private route recognition lives in wesal-routes.ts, and bilingual strings are in i18n/messages/ar.ts and en.ts. Admin API calls use the shared Axios client in lib/api.ts and existing dashboard styles and CSS variables.

Backend admin controllers use ApplicationPolicies.RequireAdmin. ApplicationDbContext uses the wesal schema and EF Core migrations. The existing IWesalKnowledgeService is a small async search contract. WesalKnowledgeService loads bounded bilingual Markdown articles embedded from Backend/documentation/ai-knowledge; the existing wesal team article remains owned by that Markdown source. HowToService uses official knowledge before its fallback. GeminiService uses the existing Google.GenAI integration behind IGeminiService; its credentials and calls remain server-side. GeminiToolOrchestrator and AiAssistantService keep routing, policy, and live-tool decisions in code. The Capability Registry is code truth. ChatSessionService bounds and redacts persisted conversation turns, while operational logs record route metadata and timings rather than raw user messages.

## Target architecture

Knowledge has four sources with distinct ownership:

1. Security and policy checks.
2. Live application data, including hall identity, prices, and availability.
3. Active trusted entities and current conversation context.
4. The code-owned Capability Registry.
5. Verified, currently effective dynamic knowledge in PostgreSQL.
6. Verified built-in Markdown knowledge.
7. Gemini wording and reasoning grounded in those sources.
8. A safe fallback.

Dynamic knowledge cannot change application behavior or turn a Coming Soon capability into an available operation. Publication checks apply deterministic capability and live-data conflict rules. Gemini only proposes structured bilingual wording, aliases, source, review date, and potential conflicts; it never saves or publishes an article.

The scoped HybridWesalKnowledgeService searches currently published dynamic articles from the scoped EF repository on each request and combines those with the existing embedded Markdown results. It filters by effective dates and publication state, ranks exact aliases before title and token matches, and returns source, key, version, verification status, and matched aliases. NeedsVerification results retain that status so the existing answer composer returns a cautious message. Draft snapshots are kept separate from the published fields, so editing a published article does not replace the live answer until a separate publish action. No retrieval cache is used; after a successful database publish, the next request in the same backend process can read it.

A dynamic article may name an explicit OverridesBuiltInKey. A currently active verified override replaces the matching built-in result. Draft, expired, or archived overrides do not suppress the built-in source. Built-in Markdown is listed as read-only and can be copied into an editable dynamic override.

## Data model and migration

The additive EF migration creates four tables in the existing wesal schema:

- AiKnowledgeArticles stores bounded article fields, status, verification, effective and review dates, audit user IDs, current and published versions, an optional pending draft snapshot, and normalized search text.
- AiKnowledgeAliases stores bounded Arabic or English example questions with normalized text.
- AiKnowledgeRevisions stores immutable version snapshots, action, user, timestamp, and required change note. Rollback writes a new revision.
- AiKnowledgeGapClusters stores a sanitized canonical question, normalized key, language, status, occurrence count, first and last seen times, reason, up to five redacted samples, and optional linked or merged references.

Unique article keys, per-article alias keys, revision versions, and active gap keys have indexes. Article text and aliases have explicit length limits. No existing business table is renamed, dropped, or rewritten.

The migration is 20261009145828_AddMabroukKnowledgeStudio.cs and is ordered before the V3 conversation-state migration by its generated migration ID. It adds only the Studio tables and indexes. No local PostgreSQL service or Docker engine was available during this work, so the migration was compiled and inspected but not applied to a database. It must be applied through the normal release migration process after review. Production databases were not accessed.

## Admin flow

The Admin-only /admin/mabrouk section is rendered inside the existing Admin guard and shell. Its overview reports stored article and gap counts, review and expiry dates, built-in article count, and recent rows; it does not invent conversation totals. The library combines read-only built-in records with dynamic records and supports search and filters. The editor has explicit draft save, conflict check, preview, publish, archive, and revision/rollback actions. Separate views provide an unanswered gap inbox, knowledge simulator, analytics, and change history.

The simulator has Knowledge only and Full Mabrouk modes. Knowledge only labels the source as Dynamic DB, Built-in KB, Draft preview, or Fallback. Draft preview is Admin-only and does not call the assistant route. Full Mabrouk calls the existing single-turn IAiAssistantService with no conversation state; its allowlisted application tools are read-only public hall search, detail, and availability lookups. Optional page path and hall ID are validated by the same navigation and entity resolver used for real turns. The assistant response contract does not expose Gemini call counts, so those diagnostics are reported as unavailable for this mode.

## Privacy and unanswered-question capture

AiKnowledgeGapSanitizer bounds question samples and redacts bearer tokens, JWT-shaped tokens, secret assignments, email addresses, phone numbers, and control characters. AiKnowledgeGapRecorder stores only the sanitized question candidate, language, coarse reason, timestamps, and a maximum of five samples per cluster. It does not persist a conversation, assistant answer, identity, authorization header, or request payload. Near-duplicate clustering uses normalized text and token overlap; exact active keys have a partial unique index.

The recorder and fail-closed outcome detector are implemented, but this feature branch intentionally does not change the active V3 assistant route. The current V3 integration point and required classification are documented in mabrouk-knowledge-studio-v3-integration.md. Until that seam is integrated and reviewed on the finalized V3 branch, the inbox can display and manage recorded gaps, but normal Mabrouk traffic does not populate it automatically.

## Dependency lifetimes

WesalKnowledgeService remains a singleton embedded-source loader and startup-count provider. IWesalKnowledgeService is now scoped because the hybrid implementation uses scoped EF persistence; IHowToService is scoped because it depends on the scoped knowledge service. AiKnowledgeStartupCheck consumes the singleton statistics interface. The gap recorder, Studio service, repository, and assistant dependencies that use database state are scoped. GeminiService remains the existing server-side provider.

## Files to review

- Backend/src/Wesal.Infrastructure/AiAssistant/HybridWesalKnowledgeService.cs
- Backend/src/Wesal.Infrastructure/AiAssistant/MabroukKnowledgeStudioService.cs
- Backend/src/Wesal.Infrastructure/AiAssistant/AiKnowledgeGapRecorder.cs
- Backend/src/Wesal.API/Controllers/AdminMabroukKnowledgeController.cs
- Backend/src/Wesal.Persistence/Data/ApplicationDbContext.cs
- Frontend/src/components/admin/mabrouk
- Frontend/src/app/admin/mabrouk
