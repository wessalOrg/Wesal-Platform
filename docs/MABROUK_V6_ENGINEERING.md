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
