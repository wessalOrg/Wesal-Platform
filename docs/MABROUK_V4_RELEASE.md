# Mabrouk V4 Release Closure

**Verdict: `V4_RELEASE_BLOCKED` (updated 2026-10-12).** V4 and the production alias-collision fix are merged and CI-green. Authenticated production checks reproduce `Create Answer` as HTTP 500. The source-level cause is fixed, but the fix has not yet been deployed to Render or verified in production. Do not start V5 until deployment and production smoke pass.

## Source and merge

- Repository: `wessalOrg/Wesal-Platform`.
- PR: [#34](https://github.com/wessalOrg/Wesal-Platform/pull/34), merged 2026-10-12.
- V4 merge SHA: `99dd3b1d62f0637a4d1f62b719f38539508c7b11`.
- Production blocker fix PR: [#37](https://github.com/wessalOrg/Wesal-Platform/pull/37), merged 2026-10-12 as `fe8e1e8a4d8e290520e6815e368202bfec0a9146`.
- Current `origin/main`: `fe8e1e8a4d8e290520e6815e368202bfec0a9146`.
- `origin/main` contains PR #34 and preserves the preceding PR #31 (Knowledge Studio), #32 (budget/cheapest follow-ups), and #33 (Arabic area continuation).
- The release-closure worktree was created from this exact `origin/main`; the older V4 candidate worktree and the original checkout were left untouched.

## CI on the exact merge SHA

Two GitHub Actions push runs completed successfully on `99dd3b1d62f0637a4d1f62b719f38539508c7b11`:

- [Run 38275560564](https://github.com/wessalOrg/Wesal-Platform/actions/runs/38275560564): backend restore/build/test, frontend install/lint/build, and changed-source secret scan all passed.
- [Run 38275491358](https://github.com/wessalOrg/Wesal-Platform/actions/runs/38275491358): the same three jobs all passed.
- Final CI result: **PASS** on the merge SHA. These CI results do not establish deployment or production behavior.

## Previously recorded candidate validation

The pre-merge candidate evidence recorded 2,640 backend tests passed, PostgreSQL Studio integration 9/9, Playwright 20/20, frontend install/lint/typecheck/build and assistant/knowledge checks passed, and zero production dependency vulnerabilities. These counts are candidate-run evidence; they were not re-run during this closure. The merge-SHA CI jobs above are the current exact-SHA verification.

## Vercel production

- User-facing alias: [https://wesal-platform-alpha.vercel.app](https://wesal-platform-alpha.vercel.app).
- The alias returned HTTP 200 from Vercel during this closure. This proves public reachability only.
- GitHub Production deployment metadata now lists V4 SHA `99dd3b1d62f0637a4d1f62b719f38539508c7b11` as successful at 2026-10-12 17:02 UTC. This verifies the V4 frontend source is deployed.
- The newer fix SHA `fe8e1e8a4d8e290520e6815e368202bfec0a9146` has no Production deployment status yet. The `alpha` alias itself still cannot be independently mapped to a deployment in the connected Vercel session.
- The user-provided Admin screenshot displays the inline Create Answer failure state added in V4. This is evidence that the observed page includes that V4 frontend behavior, but it does not identify the exact deployment SHA or prove the full app/backend release is current.
- Vercel status: **V4 DEPLOYED / HOTFIX NOT YET DEPLOYED**.

## Render production

- Canonical service: [https://wesal-platform-p0iv.onrender.com](https://wesal-platform-p0iv.onrender.com).
- `GET /health`: HTTP 200 (`Healthy`).
- `GET /health/live`: HTTP 200 (`{"status":"healthy"}`).
- `GET /`: HTTP 200 (`Wesal API`, status `running`, API version `v1`).
- These endpoints prove the service responds; they do not identify its deployed Git SHA. The authenticated Render CLI account does not list the Wesal service, so deployment history, startup logs, and migration logs could not be obtained.
- Render status: **HEALTHY RESPONSE / DEPLOYED SHA BLOCKED**.

## Production smoke evidence

### Public reachability

- Public Vercel page: HTTP 200.
- Public API session and featured-halls requests: HTTP 200.
- Production Mabrouk conversation matrix (search, budget, follow-up, entity, date, and compound intent) was **NOT EXECUTED**; this turn focused on the Admin blocker.

### Knowledge Studio and Create Answer

- Authenticated Admin browser checks: `GET /admin/mabrouk/unanswered/count`, `GET /admin/mabrouk/unanswered?unresolvedOnly=true`, and dynamic/published `GET /admin/mabrouk/knowledge` all returned HTTP 200. The analytics endpoint also returned HTTP 200. The earlier knowledge-load error was not reproduced in this session.
- A single click on Create Answer for the user's existing reviewed gap returned HTTP 500 with sanitized response `{ status: 500, code: InternalServerError, traceId: 044ef5407e637b683bba55464791d466 }`. The editor did not open. No answer was entered or published.
- Source behavior: the button POSTs `/api/v1/admin/mabrouk/unanswered/{id}/create-article` and catches any failure into the same generic inline message. The service allows `New` and `Reviewed` gaps; only `Resolved` and `Ignored` gaps are rejected as closed. The selected row's `Reviewed` state alone does not explain the failure.
- Authentication and Admin authorization passed for these GET requests; the authenticated create request reached the backend and failed with HTTP 500.
- Knowledge Studio read paths: **PASS** for the checked GET endpoints. Create Answer: **FAIL** pending hotfix deployment.

### Authentication and security

- The user screenshot visually shows an Admin session. The non-Admin production access check was **NOT EXECUTED**.
- Source enforces `ApplicationPolicies.RequireAdmin` on the controller; exact-merge CI's changed-source secret scan passed.
- Production Admin API authorization and role behavior were not fully smoke-tested.
- Security checks: **PASS for source/CI evidence; production role smoke NOT EXECUTED**.

## Create Answer root cause and fix status

The request used the real reviewed gap whose canonical question and samples differed only by punctuation (for example, a final question mark). The service previously removed only exact raw-string duplicates, while `AiText.Normalize` removes punctuation and the database enforces a unique `(ArticleId, NormalizedText)` alias index. It therefore tried to insert duplicate normalized aliases, producing an unhandled database exception and HTTP 500. This is a source-and-input-supported diagnosis; Render logs were unavailable, so the production trace could not be matched to a server stack trace.

PR #37 fixes this by deduplicating gap aliases using `AiText.Normalize` before creating the draft, with focused unit and PostgreSQL integration regressions. PR checks passed: backend suite, frontend install/lint/build, and secret scan. Local full backend suite passed 2642/2642 on rerun. The PostgreSQL integration case was added but could not run locally because `WESAL_TEST_PG` is unavailable. Production retest must wait until Render runs the merged SHA.

## Release gate summary

| Gate | Result | Evidence |
|---|---|---|
| Implemented | PASS | V4 source merged in PR #34 |
| Merged | PASS | `99dd3b1d62f0637a4d1f62b719f38539508c7b11` |
| Exact-SHA CI | PASS | Runs 38275491358 and 38275560564 |
| Vercel alias reachable | PASS | HTTP 200 |
| Vercel deployment contains V4 | PASS | Production deployment metadata reports V4 SHA `99dd3b1`; alias binding is still not independently available |
| Vercel includes PR #37 hotfix | BLOCKED | No Production deployment for merged SHA `fe8e1e8` yet |
| Render health | PASS | `/health` and `/health/live` HTTP 200 |
| Render deployment contains V4 | BLOCKED | Exact deployed SHA/logs unavailable |
| Production Mabrouk conversation matrix | NOT EXECUTED | Not part of this focused diagnostic |
| Knowledge Studio read APIs | PASS | Authenticated GET endpoints returned HTTP 200 |
| Create Answer production action | FAIL / BLOCKED | Authenticated POST returned HTTP 500; source cause fixed in PR #37 but deployment pending |
| Non-Admin production security smoke | NOT EXECUTED | No safe non-Admin session |

## Final decision

V4 is **not production-verified**. Keep V5 stopped. Deploy PR #37's merged backend SHA to Render, then retry Create Answer on the same reviewed gap and confirm the editor opens with an unpublished Draft. Then run the production conversation matrix. Do not publish test knowledge.
