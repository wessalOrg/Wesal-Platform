# Mabrouk Knowledge Studio - Handoff (forensically re-audited)

**Branch:** `feat/mabrouk-knowledge-studio`
**PR:** #31 (DRAFT - must not be merged until the release gate below is green)
**Remote checkpoint at the start of Phase B:** `15ab15622941b8eb91fba64839abb86f34e48cc0`

> This document replaces an earlier OpenCode handoff that contained stale and
> inaccurate statements (a wrong preservation baseline, invented routes and
> endpoints, an inaccurate "secret scan clean" claim, and literal local
> credentials). Sections 1-7 retain the Phase A source audit; Section 10 records
> the current Phase B validation run dated 2026-10-12.

---

## 1. Status ladder (what is actually true)

| Item | State |
|---|---|
| Studio + Learning Loop source changes | committed + pushed (this checkpoint and earlier) |
| Browser E2E (Playwright, 19 tests) | **PASS** - 19 passed, 0 failed/skipped/did-not-run; see section 10 |
| Backend full suite / PG integration | **PASS** - 2,583 tests; PG suite 9/9; see section 10 |
| Frontend install / lint / typecheck / build | **PASS** - exact CI install command; see section 10 |
| Secret scan | **PASS** for current tracked and non-ignored tree; historical note remains in section 7 |
| CI on candidate HEAD | **PASS** on pushed SHA `36d4dcd`; see section 10 |
| Merged / deployed / production smoked | **no** |

## 2. Preservation baseline - VERIFIED against `Backend/documentation/mabrouk-knowledge-preservation-baseline.md`

Captured from production `main` `1c53663`. Inventory only; article content was not modified.

- Built-in Markdown files: **26**
- Verified articles: **20**
- Categories: **5** (`faq`, `hall-owner`, `platform`, `policies`, `user-guide`)
- Allowed additive Studio article: `ai-knowledge/mabrouk/development-team.md`
  (verified Mabrouk-developer fact; does **not** replace `platform/team.md`).
  Current checked-in totals with it: 27 articles / 21 verified. The preservation
  test re-confirmed the original 26 files / 20 verified and the addition's
  presence; the added article's verified status is in its front matter.
- Original audit docs that must stay: `mabrouk-knowledge-coverage-audit.md`,
  `mabrouk-v2-audit.md`, `mabrouk-v3-conversation-audit.md`.

The earlier handoff's "Arabic / English / French / Spanish / Others" categories
were wrong and must not be used as a baseline.

Hybrid trust order (target behavior): security/policy > live application truth >
trusted entity/live facts > capability truth > published verified dynamic Studio
knowledge > verified built-in Markdown > Gemini grounded reasoning > safe
fallback. Built-ins stay read-only and permanent; archive/expiry/draft of a
dynamic override must restore the built-in answer.

## 3. Real routes and endpoints - VERIFIED from code

**Frontend** (`Frontend/src/app/admin/mabrouk/`): `/admin/mabrouk` (overview),
`/admin/mabrouk/knowledge`, `/admin/mabrouk/unanswered`,
`/admin/mabrouk/simulator`, `/admin/mabrouk/analytics`, `/admin/mabrouk/history`.

**Backend** (`AdminMabroukKnowledgeController`, route
`api/v{version}/admin/mabrouk`, policy `RequireAdmin`):

- `GET overview`, `GET analytics`, `GET export`, `POST simulate`
- Knowledge: `GET knowledge`, `GET knowledge/{id}`, `POST knowledge`,
  `PUT knowledge/{id}`, `POST knowledge/{id}/publish|archive|mark-reviewed|duplicate`,
  `GET knowledge/{id}/revisions`, `POST knowledge/{id}/rollback/{revisionId}`,
  `POST knowledge/built-in/{key}/override`, `POST knowledge/ai-draft`,
  `POST knowledge/conflict-check`
- Unanswered inbox: `GET unanswered`, `GET unanswered/count`, `GET unanswered/{id}`,
  `POST unanswered/{id}/review|ignore|link|create-article`,
  `POST unanswered/merge`, `POST unanswered/ai-cluster-suggestions`

The earlier handoff's `/gaps`, `/library`, `/learning-loop`, `/states`, `/i18n`
routes and `/knowledge/library`, `/learning-loop/record` endpoints do not exist.

Latest EF migrations present: `20261009090000_AddDurableAiConversationSessions`,
`20261009145828_AddMabroukKnowledgeStudio`, `20261009150000_AddAiConversationState`.

## 4. What was included in the remote checkpoint - VERIFIED by source review

Backend source:

- `AiIntentFallbackClassifier` - brand-bearing questions without hall-search
  vocabulary route to HowTo (so true knowledge gaps are not hidden behind hall
  results).
- `AiAssistantService` - fail-open knowledge-gap hook (`TryRecordKnowledgeGapAsync`)
  that records only the generic no-trusted-answer outcome; "what do you offer
  beyond halls" no longer lists halls.
- `HowToService` - `IsGenericFallbackAnswer` / `IsKnownAnswerCategory` predicates,
  strong verified dynamic match is servable, extra owner add-hall phrasing.
- `WesalKnowledgeService` - brand-hijack guard: distinctive question words that
  match nothing distinctive no longer get absorbed by a loosely related article.
  **Touches built-in ranking - gated by preservation + legacy-parity tests.**
- `HybridWesalKnowledgeService` - dynamic-layer failure degrades to built-ins only.
- `MabroukKnowledgeStudioService` / repository - explicit `MarkAliasAdded` to fix
  alias-churn concurrency failures.

Tests/fixtures: preservation + real-user regression fixtures, legacy parity,
learning-loop (incl. prep) and PostgreSQL integration tests
(`MabroukStudioPgShould`, runs only when `WESAL_TEST_PG` is set, otherwise
reports "skipped" - a skipped PG test is **not** a pass).

Frontend: Playwright suite (`Frontend/e2e`, 6 spec files / 19 tests, verified
green in the Phase B run) and `playwright.config.ts`;
`@playwright/test` added to devDependencies.

**Resolved in Phase A:** the lockfile install concern was fixed and validated
with the repository's exact `npm ci --legacy-peer-deps` command. GitHub CI on
remote checkpoint `15ab156` passed both backend and frontend jobs, including
Vercel preview. Current Phase B validation is recorded in section 10.

## 5. E2E status

**Current status (2026-10-12): PASS.** A stable run completed all 19 Playwright
tests with 19 passed, 0 failed, 0 skipped, and 0 did-not-run. The strict stack
runner recorded its readiness/stability checks and controlled shutdown. The
earlier invalid connection-refused runs and the prior partial failures below
are historical evidence only; they were superseded by the passing full run.

The earlier "0/19" figure came from runs that were **invalid** (backend/frontend
processes were killed by foreground tool timeouts, producing
`ERR_CONNECTION_REFUSED`). Earlier valid runs had materially more passing tests,
but no run on a verified-stable stack is on record. Reported fixes (must be
re-inspected in the current spec files; stale duplicate assertions may remain):
`changeNote` via `inputs.last()`, `effectiveFrom/effectiveUntil/reviewAt` input
handling, Arabic UNKNOWN literal restored, i18n via the app's language-change
event, mobile helper not requiring the desktop sidebar, robust FAB open fallback.

Specs read credentials from the environment (no literals in the repo):
`E2E_ADMIN_EMAIL` (defaults to the provisioned test admin) and
`E2E_ADMIN_PASSWORD` (required). Self-registered users and the wrong-password
test use per-run random passwords.

## 6. Local test stack (placeholders only - never commit real values)

Backend (port `5298`) needs, among others:

```
ConnectionStrings__DefaultConnection=Host=127.0.0.1;Port=<LOCAL_E2E_DB_PORT>;Database=<LOCAL_E2E_DB_NAME>;Username=<LOCAL_E2E_DB_USER>;Password=<LOCAL_E2E_DB_PASSWORD>
ASPNETCORE_ENVIRONMENT=Development
PORT=5298
AdminProvisioning__Enabled=true
AdminProvisioning__Admins__0__Email=<LOCAL_E2E_ADMIN_EMAIL>
AdminProvisioning__Admins__0__FullName=E2E Admin
AdminProvisioning__Admins__0__Password=<LOCAL_E2E_ADMIN_PASSWORD>
Jwt__SecretKey=<LOCAL_E2E_JWT_SECRET>
```

Frontend (port `3000`): `npm run dev -- --port 3000`; Playwright then runs with
`E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD` exported to match the provisioned admin.

The processes must run **detached/persistent**. Starting `dotnet run` / `next dev`
in a foreground tool call and letting the tool time out kills them and produces
false connection-refused failures. A local, untracked runner under `.local-e2e/`
(git-ignored) owns orchestration and holds the real local values.

## 7. Known security note

Literal local E2E database/admin/JWT test values were present in the previously
pushed checkpoint `5e2305c`. They were throwaway values for an isolated local
Docker database, are removed from the working tree here, and remain only in that
one commit's history (history is not rewritten; no force push). If those values
were ever reused anywhere real, rotate them.

## 8. Release gate for PR #31

The Phase B evidence recorded in section 10 establishes the local release gates.
The intended source changes and handoff document are committed and pushed.
GitHub CI and Vercel Preview passed on `36d4dcd`; PR #31 is still OPEN and DRAFT
at the time of this snapshot. The historical-credential finding in section 7
remains visible and was not removed by rewriting history.

## 9. Do not

- Do not start Semantic Intelligence V4 inside this PR/branch.
- Do not merge PR #31 or mark it ready before the gate above is green.
- Do not force push, reset, rebase, or discard untracked files.
- Do not delete built-in or dynamic knowledge during any smoke test.

## 10. Phase B validation evidence - 2026-10-12

All commands were run in the authoritative checkout `D:\Wesal-Knowledge-Studio`
on `feat/mabrouk-knowledge-studio`, based on `15ab15622941b8eb91fba64839abb86f34e48cc0`.
The remote PR #31 was OPEN and DRAFT at that checkpoint. Validated source
changes were committed as `ad31af9`, followed by handoff status commit
`36d4dcd`, then pushed. GitHub Actions run `38225170485` passed both the backend
restore/build/test job and frontend install/lint/contracts/build job; Vercel
Preview also passed. The documentation-only status update that follows is
covered by PR #31 checks; check the current PR status before merge.

### Source changes under validation

- Conflict checking now excludes the article being edited, so an unchanged
  saved article does not conflict with itself.
- Wedding-consultant aliases route to the event-planner page, and capability
  claims that are unavailable stay truthful as Coming Soon instead of being
  presented as current service or recorded as knowledge gaps.
- Learning-loop and navigation regressions cover those outcomes. Playwright
  waits for the actual assistant response, React form readiness, API completion,
  and language persistence instead of racing delayed UI state.

### Backend

- `dotnet restore Backend/Wesal.slnx`: passed; dependencies up to date.
- `dotnet build Wesal.slnx -c Release --no-restore`: passed, 0 warnings and
  0 errors.
- Full `Wesal.Tests` run with PostgreSQL configured: **2,583 passed, 0 failed,
  0 skipped**.
- Separately named gates: Knowledge Studio **16/16**; Learning Loop **12/12**;
  preservation/preparation **22/22** (including the 26-file, 20-verified,
  five-category baseline and additive development-team article); V3 conversation
  intelligence **18/18**; knowledge coverage **8/8** (including the 13-prompt
  assistant-router corpus); legacy knowledge-recovery corpus **1/1**; real-user
  regressions **1/1**; PostgreSQL integration **9/9**, with `WESAL_TEST_PG`
  configured. None of these runs skipped tests.
- The focused edited behavior suite also passed **63/63**.

### Frontend and browser

- `npm ci --legacy-peer-deps`: passed (the repository CI workflow uses this exact
  command); 394 packages installed. `npm run lint` passed, and
  `npm exec -- tsc --noEmit` passed.
- Production `npm run build`: passed, including production environment
  verification, TypeScript, and all 44 static pages.
- Contract checks passed: API base URL **25**, assistant **23**, Mabrouk
  knowledge **7**, and assistant storage sanitization.
- `npm audit --omit=dev`: **0 vulnerabilities**. The full dependency tree audit
  reported 5 high-severity advisories in development dependencies.
- Stable Playwright run: **19 passed, 0 failed, 0 skipped, 0 did-not-run**.

### Secret scan and release boundary

- Scanned 1,352 tracked and non-ignored files for exact local E2E/JWT/PostgreSQL
  runtime values plus high-confidence credential patterns. **No current-tree
  matches.** `.local-e2e/` remains ignored and local; no runtime values were
  added to this handoff.
- This scan covers the current tree. It does not erase or reclassify the
  previously documented throwaway local test values in historical commit
  `5e2305c`; history was not rewritten.
- Remaining at the time of this snapshot: mark PR ready, merge, verify the
  production deployment, and run the required production smoke. Do not start V4
  until those are complete.
