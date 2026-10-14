# Mabrouk V5 Release Record

## Current status

- V4 engineering: `V4_ENGINEERING_COMPLETE`.
- V4 automated validation: `V4_AUTOMATED_VALIDATION_PASS`.
- V4 production: `V4_PRODUCTION_VERIFICATION_PENDING` because exact Render/Vercel deployment SHA and authenticated smoke evidence are unavailable.
- V5: implementation, full local browser E2E, and prior source CI are complete. The final E2E/login-readiness follow-up is committed for fresh CI; PR #39 remains a draft until that exact head passes. V5 is not merged or production verified.

## Source

- Repository: `wessalOrg/Wesal-Platform`.
- Base SHA: `5a60fdb3cc24e8936659cb1b335cc8ec33f1288c`.
- Branch: `feat/mabrouk-retrieval-recommendation-v5`.
- Implementation commit SHA: `50d4f0c` (`feat: add Mabrouk V5 retrieval and recommendations`).
- Retrieval fix commit SHA: `ec8273600cd67c285ef55392b862638a802ab412`.
- Pull request: [#39](https://github.com/wessalOrg/Wesal-Platform/pull/39), draft.
- CI-validated source SHA: `ec8273600cd67c285ef55392b862638a802ab412`; a documentation-only follow-up records this evidence.
- Documentation follow-up source head: `4458c52cc6e765b1c1b2e056c2ba50378c8436c9`.
- Previous pushed candidate head: `2d64acf0e76bf2baf6c3804133c7cdb50895fdac`.
- Final E2E follow-up commit: pending; record exact SHA after commit.
- Merge SHA: none.
- Current `origin/main`: `5a60fdb3cc24e8936659cb1b335cc8ec33f1288c` (unchanged at this continuation).

## Validation evidence

- Backend restore: passed (`dotnet restore Wesal.slnx`).
- Release backend build: passed (`dotnet build Wesal.slnx -c Release --no-restore`; existing test analyzer warnings remain).
- Full Release backend regression: 2,654 passed, 0 failed, 0 skipped on current head `e418033d0a0d20f5de5ef3e08ee66512f69de01b` in PR CI run `38530695203`; PostgreSQL 16 was provisioned and 16 integration tests ran. The preceding candidate passed 2,653 tests.
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
- Browser E2E: the final stable isolated PostgreSQL-backed run on 2026-10-14 passed **20/20, 0 failed, 0 skipped** in 5.8 minutes; the runner confirmed the stack remained healthy throughout. It used a runner copy and temp directory on D: while leaving the existing 2 GB C: free-space guard intact. C: had 3.43 GB free and D: 128.80 GB at completion. Focused follow-ups also passed: knowledge library 5/5, learning loop 2/2, admin auth 4/4, English RTL/LTR persistence 1/1, and the final simulator draft test 1/1. Fixes covered React login-form remembered-email initialization readiness, locale-aware error copy, and waiting for knowledge rows before measuring the no-create invariant.
- Secret scan: passed on PR CI using Gitleaks v8.30.1.
- PR CI run `38373205013` on source SHA `ec8273600cd67c285ef55392b862638a802ab412`: backend, PostgreSQL 16, frontend, and changed-source Gitleaks all passed. An earlier CI revision exposed exact-alias lexical leakage after archiving a built-in override; the fix and regression are included in this validated source SHA.
- Vercel Preview check passed for this PR. This is preview evidence, not production deployment/SHA or authenticated smoke evidence.
- Latest checks on documentation head `4458c52cc6e765b1c1b2e056c2ba50378c8436c9` passed in CI run `38373722312` (backend, PostgreSQL-backed suite, frontend, Gitleaks, and Vercel Preview).
- Candidate CI run `38531924141` passed on `2d64acf0e76bf2baf6c3804133c7cdb50895fdac`: backend 2,654/2,654 including PostgreSQL integration, frontend lint/contracts/environment/build, changed-source Gitleaks, and Vercel Preview. Fresh CI for the final E2E/login-readiness follow-up commit is required before marking PR ready or merging.
- `git diff --check`: passed before final documentation/commit.

## Retrieval and recommendation

- Retrieval corpus: 18 labeled cases; V5 uses bounded lexical query concepts and reranking. No embedding provider or vector schema was added.
- V4 baseline → V5: top-1 62.50% → 75.00%; top-3 68.75% → 93.75%; wrong-source 22.22% → 0%; fallback 16.67% → 11.11%; mean latency 5.56 ms → 13.05 ms; p95 37.92 ms → 55.51 ms. These are local in-process timings with an empty dynamic repository.
- Recommendation: explicit criteria are hard filters on current live hall details; price/capacity/location ranking is deterministic, and “why this hall?” uses those live fields. Budget replacement and rejected-area updates are session scoped. No-match asks which criterion to adjust and does not search with relaxed constraints.
- pgvector: not adopted. Actual Neon/PostgreSQL extension availability and a semantic-embedding quality gain were not demonstrated; exact and lexical retrieval remain available without a vector extension.

## Preservation and remaining work

- Built-in knowledge Markdown: 27 files total (the original 26 plus the existing additive Mabrouk development-team entry); no built-in Markdown file changed in this V5 diff. The source baseline remains the existing 20 verified entries and five categories.
- Learning Loop / Create Answer: full backend regression passed locally, including existing punctuation-only duplicate-alias coverage; PR CI also exercised the PostgreSQL-backed suite.
- Before merge: push the final verified follow-up, require all CI/security/preview checks on its exact SHA, inspect PR #39 for mergeability and unresolved blocking reviews, then mark ready and merge under the repository policy. The stable-stack Playwright gate is now PASS (20/20). Production deployment SHA/authenticated smoke remains separate external verification debt and does not block engineering merge when source gates are green.
- Production verification: V5 Render/Vercel deployment SHA and authenticated smoke remain `PRODUCTION_VERIFICATION_PENDING` until access and evidence are available.
- Production smoke (2026-10-13): frontend and `/health`, `/health/live` returned HTTP 200; deployed SHA was not exposed, and the active Render CLI workspace does not contain the Wesal service. Two booking questions returned the same trusted guidance. The current served assistant returned generic help for recommendation follow-ups and an honest no-result for an impossible request. Since V5 is unmerged, these observations describe the currently served version and do not verify V5.
