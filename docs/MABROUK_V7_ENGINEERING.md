# Mabrouk V7 engineering record

## Scope and baseline

V7 is developed from V6 merge `f930a5367b3770dd68cb48082d97d164d81a66ee` on `feat/mabrouk-v7-contextual-agent-quality` in an isolated worktree. The existing dirty checkout was left untouched. V7 extends `AiConversationState` and the existing assistant routes; it does not add autonomous browser control or booking submission.

## Reproduced root causes and changes

| Failure | Root cause in current code | V7 change |
| --- | --- | --- |
| Recommendation forgets search constraints | `AiSemanticPlanResolver.Validate` rebuilt region, area, capacity, and price only from the current utterance, stripping values inherited from a previous result-set plan. | A recommendation explicitly referencing the last result set retains validated prior constraints; current parsed values still take precedence. The recommendation service re-fetches current hall details and does not relax hard constraints. |
| Repeated alternatives | Shown result IDs and a selected result were conflated; advancing did not reliably mark the selected hall. | Added bounded `SeenHallIds` and `LastSelectedHallId`; collection reset clears selection, and explicit selection records only the selected hall. |
| Contextual “take me there” fails | Hall context did not convert the contextual deictic request into a registered navigation action. | Narrowly recognized phrases create an `auto` action using `WesalNavigationRegistry.HallDetails` and a hall ID already resolved by backend context. |
| Platform services question answers about the hall | Hall-context shortcut ran before generic platform services retrieval, and the resulting answer did not change topic state. | A narrow platform-services classifier routes through verified `HowToService` before hall facts, labels the turn `PlatformKnowledge`, and retains the active hall/task for explicit resumption. |

## State and action contract

Persisted state remains in `AiConversationState` within the existing session JSON. The new fields are bounded at persistence: seen hall IDs are deduplicated and capped with the existing remembered-hall limit. `CurrentTopic` can change independently of `ActiveGoal`. `LastSelectedHallId` is only updated for a resolved detail/availability selection. Navigation hrefs are produced by the trusted registry and action gate, never by model output.

Booking preview remains a preview. The assistant does not submit bookings or payments. Hall facts are re-fetched using trusted IDs. Missing, unpublished, or deleted halls fail closed through existing service behavior.

## Regression evidence

`Backend/tests/Wesal.Tests/Ai/Fixtures/mabrouk-v7-real-conversation-regressions.json` records the anonymized ten conversation families from the V7 request in order, without production prices or availability. Focused deterministic tests cover recommendation context retention, selection/seen separation, and trusted contextual navigation. The pre-existing suite includes conversation, policy, booking-preview, retrieval, Learning Loop, and navigation contracts.

Test status from this V7 worktree:

- Release solution build succeeded.
- Backend full suite: 2,673 passed, 0 failed, 0 skipped, with the isolated PostgreSQL 16.15 connection enabled; all 10 PostgreSQL Learning Loop/Knowledge Studio integration tests ran against that server.
- Focused conversation-intelligence suite: 36 passed, 0 failed, 0 skipped; the focused Gemini API-key header regression also passed after the test-server timeout fix.
- Frontend TypeScript, ESLint, assistant contract (23 checks), storage contract, API-base contract (25 checks), and optimized production build passed after a clean lockfile install.
- `npm ci --dry-run` and `npm ci` succeeded after adding the single missing optional `@emnapi/wasi-threads@1.2.3` lock entry.
- Production-only npm audit reported 0 vulnerabilities. Full audit reports 5 high-severity development-tree findings through `eslint-config-next` → `@next/eslint-plugin-next` → `fast-glob` → `micromatch` → `braces`; npm currently offers no compatible in-place fix in the existing Next toolchain. The advisory identifies `braces <=3.0.3` as affected ([GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)).
- Playwright now contains 31 tests: eight V7 contextual and booking-assistance acceptance cases plus the 23 existing regressions. V7 passed 8/8, then the existing suite passed 23/23 as the final regression gate. Runs used a local API/frontend stack and isolated PostgreSQL 16 seeded with three controlled, published Gaza halls; Google AI was disabled. No production data was used.
- No provider call or production mutation was made.

## Known limitations pending acceptance

- The browser tests found that “وديني هناك” after choosing a result fell through to generic help: the resolved turn had no hall payload despite a trusted session `LastSelectedHallId`. `AiAssistantService` now re-fetches the hall by that saved ID for the narrow navigation phrase and returns the registered details-page action. The scoped flow passes in the browser.
- Booking-assistance browser tests exposed that chat could not start a booking draft or carry missing date/time/name details between turns. A bounded draft now captures only explicit values, asks for missing fields, verifies the hall again, and produces a non-submitting preview plus the registered hall-details action. The flow uses the existing booking form and does not create a booking.
- The booking draft classifier excludes questions about how booking works, preserving the established grounded HowTo answer and hall-page suggestion; only an explicit booking request starts draft collection.
- The fixture remains a transcript inventory and does not itself prove all ten broader conversation families. The V7 contextual and booking-assistance browser cases are covered, but other fixture families and any authenticated submitted-booking lifecycle remain outside this scoped acceptance.
- Production frontend/API responded with HTTP 200, API `/health` returned `Healthy`, and API root returned generic version `v1`; these are availability checks, not source SHA proof. The authenticated Render account currently exposes no service for `wessalOrg/Wesal-Platform`, Vercel CLI/project access is unavailable, and no public frontend/backend commit provenance was found. Production SHA and release verification remain pending.

## Release decision

Engineering acceptance passed locally: backend, isolated PostgreSQL, frontend contracts, build, all eight scoped V7 browser cases, and all 23 existing Playwright regressions. PR #45 was marked Ready for Review and merged after exact-head checks passed. GitHub reported no branch protection or repository rulesets for `main`, no mandatory approval requirement, and no review records. No safeguards were bypassed.

## Merge and post-merge verification

- PR: [#45](https://github.com/wessalOrg/Wesal-Platform/pull/45), merged 2026-10-15.
- PR head: `3fa8282d1d64ae542c932c0e350983ac6b56aaa2`.
- Merge commit: `beceadc51eb4dd245aa6b0f6c8bb14f179248520`.
- Exact-head PR checks passed: Backend restore/build/test, Frontend install/lint/build, changed-source secret scan, Vercel Preview Comments, and Vercel Preview deployment.
- Main CI run `38740749751` passed on merge commit `beceadc51eb4dd245aa6b0f6c8bb14f179248520`.
- Production deployment and deployed-source SHA verification remain separate and were not performed by this merge.
