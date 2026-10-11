# Mabrouk Knowledge Studio - Handoff (forensically re-audited)

**Branch:** `feat/mabrouk-knowledge-studio`
**PR:** #31 (DRAFT - must not be merged until the release gate below is green)
**Last remote checkpoint before this audit:** `5e2305cb1e78bf8e561236cfe8d58751d375a31f`

> This document replaces an earlier OpenCode handoff that contained stale and
> inaccurate statements (a wrong preservation baseline, invented routes and
> endpoints, an inaccurate "secret scan clean" claim, and literal local
> credentials). Everything below is labelled **VERIFIED** (checked against the
> code/git in the Phase A audit) or **UNVERIFIED** (carried over, must be
> re-proven before it is relied on). Final release evidence is added in the
> release phase; nothing here claims a green gate.

---

## 1. Status ladder (what is actually true)

| Item | State |
|---|---|
| Studio + Learning Loop source changes | committed + pushed (this checkpoint and earlier) |
| Browser E2E (Playwright, 19 tests) | **NOT YET PROVEN GREEN** - see section 5 |
| Backend full suite / PG integration | **NOT YET RE-RUN** on this checkout |
| Frontend `npm ci` / lint / build | **NOT YET RE-RUN** on this checkout |
| CI on exact HEAD | not yet checked |
| Merged / deployed / production smoked | **no** |

## 2. Preservation baseline - VERIFIED against `Backend/documentation/mabrouk-knowledge-preservation-baseline.md`

Captured from production `main` `1c53663`. Inventory only; article content was not modified.

- Built-in Markdown files: **26**
- Verified articles: **20**
- Categories: **5** (`faq`, `hall-owner`, `platform`, `policies`, `user-guide`)
- Allowed additive Studio article: `ai-knowledge/mabrouk/development-team.md`
  (verified Mabrouk-developer fact; does **not** replace `platform/team.md`).
  Expected totals with it: 27 articles / 21 verified (UNVERIFIED until the
  preservation test is re-run).
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

## 4. What the local (previously uncommitted) work contains - VERIFIED by diff review

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

Frontend: Playwright suite (`Frontend/e2e`, 6 spec files / 19 tests per the
earlier handoff - UNVERIFIED count) and `playwright.config.ts`;
`@playwright/test` added to devDependencies.

**Open item:** `Frontend/package-lock.json` was regenerated with a different npm
(11.x on Windows). Top-level `@emnapi/runtime` / `@emnapi/core` entries disappeared
and many packages gained `"peer": true`. This may break `npm ci` on Linux CI /
Vercel. Must be validated (clean `npm ci` + CI) and, if needed, rebuilt from the
`main` lockfile with only the Playwright addition.

## 5. E2E status - UNVERIFIED

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

## 8. Release gate for PR #31 (all required, none claimed yet)

Clean intended `git status`; preservation baseline PASS; backend full suite PASS;
PG integration PASS (not skipped); frontend `npm ci` + lint + build PASS;
Playwright 19/19 PASS with none skipped; scoped secret scan PASS; no committed
credentials; no lost original knowledge; CI green on exact HEAD.

## 9. Do not

- Do not start Semantic Intelligence V4 inside this PR/branch.
- Do not merge PR #31 or mark it ready before the gate above is green.
- Do not force push, reset, rebase, or discard untracked files.
- Do not delete built-in or dynamic knowledge during any smoke test.
