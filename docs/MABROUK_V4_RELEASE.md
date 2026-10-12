# Mabrouk V4 Release Closure

**Verdict: `V4_RELEASE_BLOCKED` (verified 2026-10-12).** V4 is implemented, merged, and CI-green. The production deployment SHAs and end-to-end production smoke are not verified. The user-provided production screenshot also records a failed Create Answer attempt. Do not start V5 until these release gates pass.

## Source and merge

- Repository: `wessalOrg/Wesal-Platform`.
- PR: [#34](https://github.com/wessalOrg/Wesal-Platform/pull/34), merged 2026-10-12.
- V4 merge SHA and `origin/main` at closure: `99dd3b1d62f0637a4d1f62b719f38539508c7b11`.
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
- GitHub deployment metadata lists the latest successful `Production` deployment for the matching `wesalplatformgaza-2838` Vercel project as deployment `7011650299`, built from `e96c755e66a15d59f5e3e8da310e805a7f0cfd57` at 2026-10-12 10:17 UTC. Its deployment URL is `https://wesal-platform-hahajpvvg-wesalplatformgaza-2838.vercel.app`.
- That SHA predates the V4 merge. GitHub lists **no deployment for `99dd3b1d62f0637a4d1f62b719f38539508c7b11`**. The alias-to-deployment mapping could not be independently read from Vercel, so the alias's exact deployed SHA remains unverified.
- The user-provided Admin screenshot displays the inline Create Answer failure state added in V4. This is evidence that the observed page includes that V4 frontend behavior, but it does not identify the exact deployment SHA or prove the full app/backend release is current.
- Vercel status: **BLOCKED / NOT VERIFIED** for V4 production deployment.

## Render production

- Canonical service: [https://wesal-platform-p0iv.onrender.com](https://wesal-platform-p0iv.onrender.com).
- `GET /health`: HTTP 200 (`Healthy`).
- `GET /health/live`: HTTP 200 (`{"status":"healthy"}`).
- `GET /`: HTTP 200 (`Wesal API`, status `running`, API version `v1`).
- These endpoints prove the service responds; they do not identify its deployed Git SHA. Render deployment history, startup logs, and migration logs were not available in the connected session.
- Render status: **HEALTHY RESPONSE / DEPLOYED SHA BLOCKED**.

## Production smoke evidence

### Public reachability

- Public Vercel page: HTTP 200.
- Public API session and featured-halls requests: HTTP 200.
- Mabrouk search, budget, follow-up, entity, date, and compound-intent conversations were **NOT EXECUTED** against production in this closure because no authenticated production browser session was available.

### Knowledge Studio and Create Answer

- The user-provided screenshot shows `/admin/mabrouk/unanswered` rendering real gap rows, while the page reports `تعذر تحميل معرفة مبروك. حاول مرة أخرى.` and the Create Answer action reports `تعذر تجهيز المسودة. تحقق من الاتصال وحاول مرة أخرى.`
- Create Answer production result: **FAIL (observed)**. The screenshot confirms the action failed, but does not include its HTTP status or response body, so the underlying server cause is **UNKNOWN**.
- Source behavior: the button POSTs `/api/v1/admin/mabrouk/unanswered/{id}/create-article` and catches any failure into the same generic inline message. The service allows `New` and `Reviewed` gaps; only `Resolved` and `Ignored` gaps are rejected as closed. The selected row's `Reviewed` state alone does not explain the failure.
- A no-credentials POST to a dummy ID returned HTTP 401, as expected for an Admin-protected endpoint. This confirms neither an authenticated success nor the production failure cause.
- No production draft was created or published during this closure.
- Knowledge Studio overall: **FAIL / BLOCKED** because the user screenshot shows a live load error and no authenticated network response is available to diagnose it.

### Authentication and security

- The user screenshot visually shows an Admin session. The non-Admin production access check was **NOT EXECUTED**.
- Source enforces `ApplicationPolicies.RequireAdmin` on the controller; exact-merge CI's changed-source secret scan passed.
- Production Admin API authorization and role behavior were not fully smoke-tested.
- Security checks: **PASS for source/CI evidence; production role smoke NOT EXECUTED**.

## Why the Create Answer issue is not marked fixed

The failure UX hides the actual HTTP error, and the connected browser session could not access the user's signed-in Edge tab (`Unable to load browser request-header policy`). The separate browser session was unauthenticated and redirected from the Admin path. The screenshot's V4 inline failure state means a stale frontend is not established as the cause. The production API's public health endpoints cannot reveal the private request's error. Therefore there is not enough evidence to attribute this to credentials, authorization, backend deployment, or database state, and no production data was changed to probe it.

Required evidence to finish diagnosis: the failed `create-article` request's HTTP status and response body from the existing browser Network log, with cookies and authorization headers omitted, or the matching sanitized Render error log. Do not repeat the production button action solely for diagnosis unless using a designated smoke record.

## Release gate summary

| Gate | Result | Evidence |
|---|---|---|
| Implemented | PASS | V4 source merged in PR #34 |
| Merged | PASS | `99dd3b1d62f0637a4d1f62b719f38539508c7b11` |
| Exact-SHA CI | PASS | Runs 38275491358 and 38275560564 |
| Vercel alias reachable | PASS | HTTP 200 |
| Vercel deployment contains V4 | BLOCKED | Latest recorded Production deployment is pre-V4 `e96c755`; alias binding not independently available |
| Render health | PASS | `/health` and `/health/live` HTTP 200 |
| Render deployment contains V4 | BLOCKED | Exact deployed SHA/logs unavailable |
| Production Mabrouk conversation matrix | NOT EXECUTED | No authenticated browser session |
| Knowledge Studio production UI | FAIL / BLOCKED | User screenshot shows load error |
| Create Answer production action | FAIL (observed) | User screenshot shows inline failure; server error unknown |
| Non-Admin production security smoke | NOT EXECUTED | No safe non-Admin session |

## Final decision

V4 is **not production-verified**. Keep V5 stopped. First obtain the V4 deployment on both Vercel and Render, then run the production conversation matrix and diagnose/fix the observed Create Answer failure using its actual sanitized response or server log. Do not publish test knowledge or alter a real unanswered item as a diagnostic probe.
