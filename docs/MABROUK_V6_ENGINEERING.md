# Mabrouk V6 Engineering Checkpoint

## Starting point

- V5 PR #39 merged on 2026-10-14 as `950a4b0a4da9f7007642cd8691f0f3118d81a0cc`.
- V5 exact-head CI passed on `4beaa36599178bde4e32f9295bbdebe9af94dde0` in run `38541782983`; CI on the merge commit also passed in run `38542190107`.
- V5 release-record PR #41 merged as `96d23555688073ac49c1d3f56804cb76b46dfa78`; `main` CI passed on `9c01dfd8e6456d2476c51ab3281b8ba763827e97` in run `38555188933`.
- V5 stable local Playwright run passed 20/20. Production deployment SHA and authenticated smoke remain `PRODUCTION_VERIFICATION_PENDING`.
- V6 branch: `feat/mabrouk-v6-evaluation-coverage`, updated from latest `main` `9c01dfd8e6456d2476c51ab3281b8ba763827e97`.
- Draft PR [#40](https://github.com/wessalOrg/Wesal-Platform/pull/40). Initial exact-head CI passed on `c99ac785872c382f2ee56c61a8856e5234e2e591` (run `38544574808`) and `517e126a3bb1dc0ef37347e4a0e00df378d62608` (run `38544972314`): backend/PostgreSQL, knowledge image, frontend, Gitleaks, and Vercel Preview. The canonicalized V6 evaluation commit `9d21f0300ee1d73e39d47505c0e4e1aceaf9cf20`, synced with latest `main`, passed exact-head CI in run `38567114102` across backend/PostgreSQL, frontend lint/build, secret scan, and Vercel Preview.

## V6 first engineering slice: evaluation coverage

V5's labeled retrieval fixture had 18 cases and documented ambiguous English/policy misses. This first V6 slice adds 16 Arabic/English cases for cancellation after deposit, unconfirmed refund details, booking authentication/status, owner approval/visibility and identity requirements, guest browsing, and Mabrouk team identity. Expected and forbidden keys are validated against the embedded source corpus. The benchmark emits a compact failure summary and records that latency is local in-process time with an empty in-memory dynamic repository. Fixture identity and minimum-size assertions protect the corpus from accidental deletion or duplicate IDs.

The first evaluation is a baseline only; no production retrieval behavior changes in this checkpoint.

## Baseline on latest main before V6 behavior changes

Command:

```powershell
$env:TEMP='D:\WesalMabroukV6Temp'
$env:TMP='D:\WesalMabroukV6Temp'
dotnet test Backend/tests/Wesal.Tests/Wesal.Tests.csproj -c Release --no-restore --filter FullyQualifiedName~MabroukV5RetrievalBaselineShould
```

Result: 1 test passed, 0 failed, 0 skipped. The report was written outside the repository to `D:\WesalMabroukV6Temp\mabrouk-v6-retrieval-baseline.json`.

| Measure | 34-case V6 corpus |
|---|---:|
| Top-1 expected source | 46.88% (15/32 answerable) |
| Top-3 expected source | 56.25% (18/32 answerable) |
| Wrong/forbidden source | 14.71% (5/34) |
| Empty retrieval / fallback | 38.24% (13/34) |
| Mean in-process latency | 12.855 ms |
| p95 per-case latency | 32.573 ms |

Language breakdown: Arabic Top-1 47.37% (9/19 answerable), Top-3 57.89% (11/19); English Top-1 46.15% (6/13), Top-3 53.85% (7/13). The corpus is small and hand-labeled from current repository knowledge; it is not a population quality claim. Timing excludes database and network latency and is sensitive to local load.

The current run shows fallback on cancellation after deposit, Arabic booking login/status, owner visibility/identity, guest browsing, Mabrouk team paraphrase, refund details, and English payment/refund/account/guest questions. It also surfaces wrong families for an ambiguous Wesal-team query, English cancellation/status, and an Arabic refund query. These cases are V6 investigation priorities.

## Next V6 gates

1. Review labels against product owner intent and current source articles before treating this corpus as an acceptance target.
2. Improve retrieval conservatively for the observed source-family and paraphrase failures; preserve policy verification state and no-hallucinated-refund behavior.
3. Re-run the expanded corpus plus legacy parity, knowledge coverage, learning loop, and PostgreSQL-backed integration suites.
4. Compare before/after against the same 34 cases; require lower wrong-source rate without reducing answerable Top-3 recall.
5. Keep production deployment/SHA/authenticated smoke as a distinct evidence gate.

## V6 retrieval and answer safety closure (2026-10-15)

### Corrected evaluation and retrieval result

The evaluation fixture was audited against the checked-in knowledge source keys and semantics. The V5 18-case cohort remains separately reported within the 34-case corpus. Top-1 source correctness accepts any documented acceptable source; preferred Top-1 is reported separately. Wrong-source is distinct from known forbidden-source selection, and fallback correctness is scored against each case's required/allowed/forbidden fallback expectation. The report records corpus version, stable case IDs, per-case failures, language/cohort breakdowns, average latency, and a global p95 over all measured answerable query runs. These hand-labeled offline results are not a population quality claim.

On the stable 34-case run after retrieval changes:

| Measure | Corrected baseline on latest main | V6 candidate |
|---|---:|---:|
| Top-1 acceptable source, 32 answerable | 46.88% (15/32) | 100% (32/32) |
| Preferred Top-1 | 46.88% (15/32) | 100% (32/32) |
| Top-3 acceptable-source recall | 56.25% (18/32) | 100% (32/32) |
| Wrong Top-1, all 34 cases | 14.71% (5/34) | 0% (0/34) |
| Forbidden Top-1 / Top-3 | baseline not separately emitted | 0% / 0% |
| Fallback rate | 38.24% (13/34) | 5.88% (2/34) |
| Fallback expectation accuracy | not measured correctly in baseline | 100% (34/34) |
| Mean local in-process latency | 12.32 ms | 6.547 ms |
| Global p95 local in-process latency | 18.904 ms | 22.157 ms |

The baseline and candidate timing came from separate local runs. Mean latency improved in this run; global p95 increased by 3.253 ms. Both are local in-process measurements with an empty in-memory dynamic repository and exclude database/network latency; local scheduling makes small samples variable. Do not interpret the 34 cases as statistically representative.

| Cohort/language | Cases / answerable | Top-1 | Preferred Top-1 | Top-3 recall | Fallback |
|---|---:|---:|---:|---:|---:|
| Historical V5 cohort | 18 / 16 | 100% | 100% | 100% | 11.11% |
| Expanded V6 cohort | 16 / 16 | 100% | 100% | 100% | 0% |
| Arabic | 20 / 19 | 100% | 100% | 100% | 5.00% |
| English | 14 / 13 | 100% | 100% | 100% | 7.14% |

Candidate report: `D:\WesalMabroukV6Temp\mabrouk-v6-retrieval-evaluation.json`. The fixture includes the 2 genuine unknowns; both correctly take the required safe fallback. Retrieval remains deterministic and lexical/topic based; no vector database, embeddings, or paid model dependency was introduced.

### Defects fixed

- Added bilingual, including Palestinian Arabic colloquial, cancellation/refund intent routing and ensured it bypasses the unrelated generic payment guard. The answer path prioritizes verified cancellation/refund knowledge, states when refund amounts/timing are unspecified, and uses a cautious no-model fallback.
- Tightened source-family eligibility, token-aware query matching, topical ranking and dynamic-override safety. The reviewed 34-case corpus now has zero known forbidden Top-1/Top-3 results.
- The latest `main` introduced a booking tool whose implementation only validated and returned preview data while the tool description and assistant response claimed a booking was submitted. Updated the tool description and response to say explicitly that the booking is only a preview and remains unsubmitted/unconfirmed, corrected booking hall state selection, and added Arabic/English assistant and gateway tests.
- Corrected the existing Learning Loop browser flow to return to the public homepage and reopen Mabrouk after the Admin publish modal closes. This was an E2E navigation assumption; backend traces showed successful 200 assistant responses. The full suite now passes with the actual public learning check.

### Local gates

- Backend Release solution tests against isolated PostgreSQL: **2667 passed, 0 failed, 0 skipped**. TRX: `D:\WesalMabroukV6Temp\test-results-final3\v6-backend-full-pg-final3.trx`.
- PostgreSQL-backed Studio integration tests are included in that full run; the prior exact filtered integration cohort passed 10/10.
- Playwright full Admin/Knowledge Studio/Learning Loop plus V6 safety suite: **23 passed**, both API `/health` and frontend `/login` ended HTTP 200. This was a stable monitored run on isolated PostgreSQL, with no paid AI key configured.
- Frontend `npm exec -- tsc --noEmit`: passed. API-base URL gate: 25/25; assistant contract: 23/23; Mabrouk Knowledge Studio contract: 7/7; assistant storage sanitization: passed; production environment gate: passed.
- Frontend lint completed with no reported findings on the staged production-dependency installation. CI still treats lint as advisory until its pre-existing findings are cleared.
- Production dependency audit from the staged lockfile: 0 vulnerabilities across 62 production dependencies.
- Production Next build completed successfully on the staged D: copy (Turbopack compile, typecheck, and route collection passed). The C: to D: dependency junction remains untouched.
- Changed-source Gitleaks and real production Docker-image knowledge inclusion are delegated to exact-head GitHub CI; no local result is claimed for those gates.

### Merge and deployment state

Current branch is `feat/mabrouk-v6-evaluation-coverage`; source base is latest fetched `origin/main` `bd2c75c` (the two core retrieval files were confirmed unchanged from the corrected-baseline commit `9c01dfd`). PR #40 is the existing V6 PR. The pre-follow-up candidate is `47ee765`; the safe booking preview follow-up and this closure record are included in the final pushed head recorded by GitHub after push.

Production status remains `PRODUCTION_VERIFICATION_PENDING`: the Render CLI is installed, but this session has no verified Wesal service identity/account access or authenticated production test user. Public health or Preview checks cannot establish the deployed commit or authenticated production behavior. Do not call V6 production verified. V6 engineering passed exact-head CI; PR #40 was marked ready and merged. Merge commit: `f930a5367b3770dd68cb48082d97d164d81a66ee`. The CI workflow on that exact `main` merge SHA also passed all three jobs: backend Release build/tests and production knowledge-image inclusion, frontend lint/contracts/env gate/build, and Gitleaks. The candidate PR exact-head checks, including Vercel Preview, also passed. Production deployment verification remains pending as described above.
