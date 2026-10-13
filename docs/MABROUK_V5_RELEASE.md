# Mabrouk V5 Release Record

## Current status

- V4 engineering: `V4_ENGINEERING_COMPLETE`.
- V4 automated validation: `V4_AUTOMATED_VALIDATION_PASS`.
- V4 production: `V4_PRODUCTION_VERIFICATION_PENDING` because exact Render/Vercel deployment SHA and authenticated smoke evidence are unavailable.
- V5: implementation and local backend/frontend checks are complete; PostgreSQL, browser E2E, remote CI, and PR review are pending. Do not describe V5 as merged or production verified.

## Source

- Repository: `wessalOrg/Wesal-Platform`.
- Base SHA: `5a60fdb3cc24e8936659cb1b335cc8ec33f1288c`.
- Branch: `feat/mabrouk-retrieval-recommendation-v5`.
- Implementation commit: pending.
- Pull request: pending.
- Merge SHA: none.
- Current `origin/main`: `5a60fdb3cc24e8936659cb1b335cc8ec33f1288c` at work start.

## Validation evidence

- Backend restore: passed (`dotnet restore Wesal.slnx`).
- Release backend build: passed (`dotnet build Wesal.slnx -c Release --no-restore`; existing test analyzer warnings remain).
- Full Release backend regression: 2,652 passed, 0 failed, 0 skipped in the local runner. This run does not establish PostgreSQL validation: `WESAL_TEST_PG` was unset, and the repository's PG test fixtures return without connecting when it is absent.
- Focused V5 retrieval benchmark/regressions and six recommendation regressions are included in the passing full suite.
- PostgreSQL: pending. No local PostgreSQL service or Docker daemon is available. PR CI provisions PostgreSQL 16 and should provide the real integration result.
- Frontend install: passed with repository CI command `npm ci --legacy-peer-deps` (394 packages).
- Frontend TypeScript: passed (`npm exec -- tsc --noEmit`).
- Frontend lint: passed; CI marks this step advisory.
- Frontend contracts: API base URL 25 checks, assistant 23 checks, Mabrouk knowledge 7 checks, assistant storage sanitization passed.
- Production environment gate: passed.
- Frontend production build: passed; all 44 static pages generated.
- Production dependency audit: `npm audit --omit=dev` found 0 vulnerabilities. Install reported 5 high-severity issues in the full dependency tree; production-only audit is clean.
- Browser E2E: pending. Local Playwright requires the isolated PostgreSQL-backed Admin stack; Docker and a PostgreSQL service are unavailable. No invalid browser run was counted.
- Secret scan: local Gitleaks binary unavailable; the repository PR CI runs Gitleaks v8.30.1 on the candidate diff.
- `git diff --check`: passed before final documentation/commit.

## Retrieval and recommendation

- Retrieval corpus: 18 labeled cases; V5 uses bounded lexical query concepts and reranking. No embedding provider or vector schema was added.
- V4 baseline → V5: top-1 62.50% → 75.00%; top-3 68.75% → 93.75%; wrong-source 22.22% → 0%; fallback 16.67% → 11.11%; mean latency 5.56 ms → 13.05 ms; p95 37.92 ms → 55.51 ms. These are local in-process timings with an empty dynamic repository.
- Recommendation: explicit criteria are hard filters on current live hall details; price/capacity/location ranking is deterministic, and “why this hall?” uses those live fields. Budget replacement and rejected-area updates are session scoped. No-match asks which criterion to adjust and does not search with relaxed constraints.
- pgvector: not adopted. Actual Neon/PostgreSQL extension availability and a semantic-embedding quality gain were not demonstrated; exact and lexical retrieval remain available without a vector extension.

## Preservation and remaining work

- Built-in knowledge Markdown: 27 files total (the original 26 plus the existing additive Mabrouk development-team entry); no built-in Markdown file changed in this V5 diff. The source baseline remains the existing 20 verified entries and five categories.
- Learning Loop / Create Answer: full backend regression passed locally, including existing punctuation-only duplicate-alias coverage; the real PostgreSQL version remains pending.
- Before merge: run PR CI on the exact candidate SHA, obtain real PostgreSQL integration results, complete stable-stack Playwright E2E, review the final secret scan, then reassess merge readiness.
- Production verification: V5 Render/Vercel deployment SHA and authenticated smoke remain `PRODUCTION_VERIFICATION_PENDING` until access and evidence are available.
