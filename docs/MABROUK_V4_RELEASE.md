# Mabrouk V4 Candidate Evidence

**Status: candidate only. V4 is not released.** Merge, exact production deployments, and authenticated production smoke remain pending.

## Repository and scope

- Repository: `wessalOrg/Wesal-Platform`
- Base: `e96c755e66a15d59f5e3e8da310e805a7f0cfd57` (`origin/main`, freshly fetched)
- Branch: `feat/mabrouk-semantic-intelligence-v4`
- Implementation commit: `6098477cfffef3d53fe2cf9b7e2fa094943a4525`.
- Draft pull request: [#34](https://github.com/wessalOrg/Wesal-Platform/pull/34).
- Final merge SHA and post-merge `main` SHA: pending.
- V4 adds a typed semantic plan for price/budget, date ranges, regions/areas, entity references, follow-up navigation, compound search requests, and bounded conversation result memory. Existing assistant and Knowledge Studio regressions remain covered.
- The unanswered-question action creates a draft article that still requires admin editing, verification, and explicit publication. The button now shows its pending state and an inline error when the request fails.
- No database schema migration is included.

## Local validation

Backend:

- `dotnet restore Backend/Wesal.slnx`: passed; projects up to date.
- `dotnet build Backend/Wesal.slnx -c Release --no-restore`: passed, 0 warnings and 0 errors.
- Full `Wesal.Tests` with `WESAL_TEST_PG` connected to the isolated local PostgreSQL container: 2,640 passed, 0 failed, 0 skipped.
- `MabroukStudioPgShould`: 9 passed, 0 failed, 0 skipped.

Frontend:

- `npm ci --legacy-peer-deps`: completed.
- `npm run lint`: passed.
- `npm exec -- tsc --noEmit`: passed.
- `npm run verify:production-env`: passed.
- `npm run verify:api-base-url`: 25 checks passed.
- `npm run verify:assistant`: 23 checks passed.
- `npm run verify:mabrouk-knowledge`: 7 checks passed.
- `npm run verify:assistant-storage`: passed.
- `npm run build` with the CI API base URL: passed.
- `npm audit --omit=dev`: 0 production dependency vulnerabilities.
- The dependency installation reported 5 high-severity vulnerabilities including development dependencies; the production-only audit is clean.

Browser and learning-loop evidence:

- Local stack readiness and stability checks passed before and after the run.
- Playwright: 20 passed. This includes creating a draft from an unanswered question, opening the editor, explicitly publishing the answer, and confirming Mabrouk uses it; a separate regression confirms a failed create request is shown beside the button.
- The local E2E PostgreSQL database and copied local test credential file were removed after the run. The existing PostgreSQL container was preserved.

## Security evidence

- A targeted scan of changed, non-ignored files checked six credential patterns and found no candidates.
- The official Gitleaks binary/container could not be fetched from this machine because the GitHub/CDN requests timed out during TLS negotiation. A Gitleaks job has been added to GitHub CI to scan the exact candidate diff; that result is pending.

## Release gates still pending

- CI on the exact final PR head SHA, including PostgreSQL-backed backend tests and the Gitleaks diff scan.
- Merge and confirmation of the resulting `main` SHA.
- Verification that Vercel and Render use that exact merge SHA.
- Authenticated production smoke for Mabrouk and Knowledge Studio. Vercel team access is still awaiting approval; no production write was performed.
- V5 must not begin until the exact production versions are verified and smoke-tested.

## Current limitation

The local create-answer workflow is verified working. The production behavior is not verified against the current Vercel/Render deployment, so this candidate does not establish that the live site is running this code or that the production endpoint succeeds.
