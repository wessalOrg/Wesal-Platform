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
- Playwright now contains 28 tests: five V7 contextual acceptance cases plus the 23 existing regressions. The five V7 cases passed, then the existing suite passed 23/23 as the final regression gate. Runs used a local API/frontend stack and isolated PostgreSQL 16 seeded with three controlled, published Gaza halls; Google AI was disabled. No production data was used.
- No provider call or production mutation was made.

## Known limitations pending acceptance

- The browser tests found that “وديني هناك” after choosing a result fell through to generic help: the resolved turn had no hall payload despite a trusted session `LastSelectedHallId`. `AiAssistantService` now re-fetches the hall by that saved ID for the narrow navigation phrase and returns the registered details-page action. The scoped flow passes in the browser.
- The fixture remains a transcript inventory and does not itself prove all ten broader conversation families. Availability lookup, booking-detail collection, preview, and booking-form handoff still need end-to-end browser acceptance.
- Returning to a selected hall is a safe details-page navigation; booking form continuity depends on the existing frontend session behavior and still requires browser validation.
- Availability and booking preview remain dependent on the existing date, authentication, and availability services.
- Production frontend/API responded with HTTP 200, API `/health` returned `Healthy`, and API root returned generic version `v1`; these are availability checks, not source SHA proof. The authenticated Render account currently exposes no service for `wessalOrg/Wesal-Platform`, Vercel CLI/project access is unavailable, and no public frontend/backend commit provenance was found. Production SHA and release verification remain pending.

## Release decision

Not releasable yet. Backend, isolated PostgreSQL, frontend contracts, build, the five scoped V7 browser cases, and all 23 existing Playwright regressions are locally verified. Broader availability/booking workflow acceptance, full-audit remediation or accepted review, exact-head CI for the follow-up commit, review policy, merge requirements, and production SHA verification remain outstanding. Keep PR #45 in Draft; merge must not bypass repository protections. Production verification is separately gated from engineering CI.
