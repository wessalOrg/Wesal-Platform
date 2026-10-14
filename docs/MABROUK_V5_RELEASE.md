# Mabrouk V5 Release Record

## Current status

- V4 engineering: `V4_ENGINEERING_COMPLETE`.
- V4 automated validation: `V4_AUTOMATED_VALIDATION_PASS`.
- V4 production: `V4_PRODUCTION_VERIFICATION_PENDING` because exact Render/Vercel deployment SHA and authenticated smoke evidence are unavailable.
- V5: implementation and CI are complete on the source candidate; PR #39 remains a draft while browser E2E is pending. V5 is not merged or production verified.

## Source

- Repository: `wessalOrg/Wesal-Platform`.
- Base SHA: `5a60fdb3cc24e8936659cb1b335cc8ec33f1288c`.
- Branch: `feat/mabrouk-retrieval-recommendation-v5`.
- Implementation commit SHA: `50d4f0c` (`feat: add Mabrouk V5 retrieval and recommendations`).
- Retrieval fix commit SHA: `ec8273600cd67c285ef55392b862638a802ab412`.
- Pull request: [#39](https://github.com/wessalOrg/Wesal-Platform/pull/39), draft.
- CI-validated source SHA: `ec8273600cd67c285ef55392b862638a802ab412`; a documentation-only follow-up records this evidence.
- Documentation follow-up source head: `4458c52cc6e765b1c1b2e056c2ba50378c8436c9`.
- Merge SHA: none.
- Current `origin/main`: `5a60fdb3cc24e8936659cb1b335cc8ec33f1288c` (unchanged at this continuation).

## Validation evidence

- Backend restore: passed (`dotnet restore Wesal.slnx`).
- Release backend build: passed (`dotnet build Wesal.slnx -c Release --no-restore`; existing test analyzer warnings remain).
- Full Release backend regression: 2,653 passed, 0 failed, 0 skipped in both local runner and PR CI. Local `WESAL_TEST_PG` was unset, but PR CI provisioned PostgreSQL 16 and exercised the real PostgreSQL integration tests.
- Focused V5 retrieval benchmark/regressions and six recommendation regressions are included in the passing full suite.
- PostgreSQL: passed on PR CI with PostgreSQL 16. Local PostgreSQL remains unavailable.
- Frontend install: passed with repository CI command `npm ci --legacy-peer-deps` (394 packages).
- Frontend TypeScript: passed (`npm exec -- tsc --noEmit`).
- Frontend lint: passed; CI marks this step advisory.
- Frontend contracts: API base URL 25 checks, assistant 23 checks, Mabrouk knowledge 7 checks, assistant storage sanitization passed.
- Production environment gate: passed.
- Frontend production build: passed; all 44 static pages generated.
- Production dependency audit: `npm audit --omit=dev` found 0 vulnerabilities. Install reported 5 high-severity issues in the full dependency tree; production-only audit is clean.
- Production-image knowledge check: passed; image contains all 27 of 27 Markdown source articles.
- Browser E2E: a stable isolated PostgreSQL-backed stack is now available. On 2026-10-14, the full 20-test suite ran with 15 passed, 2 failed, 0 skipped, and 3 did-not-run. One failure was caused by a temporary React-internal-value wait in the login helper; that wait was removed. The other exposed a brittle helper condition: the admin login POST and subsequent session request returned 200 and the browser left `/login`, but the helper timed out waiting for navbar test IDs. The helper now waits for the successful login response and navigation; protected admin navigation is asserted by `gotoAdmin`. This correction has not yet been rerun. The runner then refused a new run because C: had 0.23 GB free (minimum 2 GB); after stopping runner-owned services, C: had 0.63 GB free. Full browser E2E remains a release blocker until rerun on a stable stack.
- Secret scan: passed on PR CI using Gitleaks v8.30.1.
- PR CI run `38373205013` on source SHA `ec8273600cd67c285ef55392b862638a802ab412`: backend, PostgreSQL 16, frontend, and changed-source Gitleaks all passed. An earlier CI revision exposed exact-alias lexical leakage after archiving a built-in override; the fix and regression are included in this validated source SHA.
- Vercel Preview check passed for this PR. This is preview evidence, not production deployment/SHA or authenticated smoke evidence.
- Latest checks on documentation head `4458c52cc6e765b1c1b2e056c2ba50378c8436c9` passed in CI run `38373722312` (backend, PostgreSQL-backed suite, frontend, Gitleaks, and Vercel Preview).
- `git diff --check`: passed before final documentation/commit.

## Retrieval and recommendation

- Retrieval corpus: 18 labeled cases; V5 uses bounded lexical query concepts and reranking. No embedding provider or vector schema was added.
- V4 baseline → V5: top-1 62.50% → 75.00%; top-3 68.75% → 93.75%; wrong-source 22.22% → 0%; fallback 16.67% → 11.11%; mean latency 5.56 ms → 13.05 ms; p95 37.92 ms → 55.51 ms. These are local in-process timings with an empty dynamic repository.
- Recommendation: explicit criteria are hard filters on current live hall details; price/capacity/location ranking is deterministic, and “why this hall?” uses those live fields. Budget replacement and rejected-area updates are session scoped. No-match asks which criterion to adjust and does not search with relaxed constraints.
- pgvector: not adopted. Actual Neon/PostgreSQL extension availability and a semantic-embedding quality gain were not demonstrated; exact and lexical retrieval remain available without a vector extension.

## Preservation and remaining work

- Built-in knowledge Markdown: 27 files total (the original 26 plus the existing additive Mabrouk development-team entry); no built-in Markdown file changed in this V5 diff. The source baseline remains the existing 20 verified entries and five categories.
- Learning Loop / Create Answer: full backend regression passed locally, including existing punctuation-only duplicate-alias coverage; PR CI also exercised the PostgreSQL-backed suite.
- Before merge: rerun the full stable-stack Playwright suite after the login-helper correction, then reassess merge readiness. The run on 2026-10-14 is not a passing acceptance result. Re-run backend Release, PostgreSQL integration, production build, and secret scan on the new exact head as part of final acceptance.
- Production verification: V5 Render/Vercel deployment SHA and authenticated smoke remain `PRODUCTION_VERIFICATION_PENDING` until access and evidence are available.
- Production smoke (2026-10-13): frontend and `/health`, `/health/live` returned HTTP 200; deployed SHA was not exposed, and the active Render CLI workspace does not contain the Wesal service. Two booking questions returned the same trusted guidance. The current served assistant returned generic help for recommendation follow-ups and an honest no-result for an impossible request. Since V5 is unmerged, these observations describe the currently served version and do not verify V5.
