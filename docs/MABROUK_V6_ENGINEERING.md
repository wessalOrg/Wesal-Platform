# Mabrouk V6 Engineering Checkpoint

## Starting point

- V5 PR #39 merged on 2026-10-14 as `950a4b0a4da9f7007642cd8691f0f3118d81a0cc`.
- V5 exact-head CI passed on `4beaa36599178bde4e32f9295bbdebe9af94dde0` in run `38541782983`; CI on the merge commit also passed in run `38542190107`.
- V5 stable local Playwright run passed 20/20. Production deployment SHA and authenticated smoke remain `PRODUCTION_VERIFICATION_PENDING`.
- V6 branch: `feat/mabrouk-v6-evaluation-coverage`, based on the V5 merge commit.
- V6 checkpoint commit: `c99ac785872c382f2ee56c61a8856e5234e2e591`; draft PR [#40](https://github.com/wessalOrg/Wesal-Platform/pull/40).
- Exact-head CI run `38544574808` passed on that V6 SHA: backend/PostgreSQL suite and knowledge image, frontend, Gitleaks, and Vercel Preview.

## V6 first engineering slice: evaluation coverage

V5's labeled retrieval fixture had 18 cases and documented ambiguous English/policy misses. This first V6 slice adds 16 Arabic/English cases for cancellation after deposit, unconfirmed refund details, booking authentication/status, owner approval/visibility and identity requirements, guest browsing, and Mabrouk team identity. The benchmark now emits a compact failure summary and records that latency is local in-process time with an empty in-memory dynamic repository. Fixture identity and minimum-size assertions protect the corpus from accidental deletion or duplicate IDs.

The first evaluation is a baseline only; no production retrieval behavior changes in this checkpoint.

## Baseline on V5 merge

Command:

```powershell
$env:TEMP='D:\WesalMabroukV6Temp'
$env:TMP='D:\WesalMabroukV6Temp'
dotnet test Backend/tests/Wesal.Tests/Wesal.Tests.csproj -c Release --no-restore --filter FullyQualifiedName~MabroukV5RetrievalBaselineShould
```

Result: 1 test passed, 0 failed, 0 skipped. The report was written outside the repository to `D:\WesalMabroukV6Temp\mabrouk-v6-retrieval-baseline.json`.

| Measure | 34-case V6 corpus |
|---|---:|
| Top-1 expected source | Diagnostic only; legacy expected keys do not consistently equal returned stable keys |
| Top-3 expected source | Diagnostic only; legacy expected keys do not consistently equal returned stable keys |
| Wrong/forbidden source | Diagnostic only; some inherited forbidden keys are shorthand |
| Empty retrieval / fallback | 38.24% (13/34) |
| Mean in-process latency | 13.218 ms |
| p95 per-case latency | 45.695 ms |

The report emits per-case results and language breakdown, but aggregate accuracy and wrong-source rate are intentionally not treated as valid quality measurements until all 34 expected and forbidden labels are migrated to canonical returned stable keys. V6 must migrate labels before setting release thresholds. The corpus is small and hand-labeled from current repository knowledge; it is not a population quality claim. Timing excludes database and network latency.

The current run shows fallback on cancellation after deposit, Arabic booking login/status, owner visibility/identity, guest browsing, Mabrouk team paraphrase, refund details, and English payment/refund/account/guest questions. It also surfaces potentially wrong families for English cancellation/status and Arabic refund queries. These cases are V6 investigation priorities; labels need canonicalization before counts are used as quality claims.

## Next V6 gates

1. Review labels against product owner intent and current source articles before treating this corpus as an acceptance target.
2. Improve retrieval conservatively for the observed source-family and paraphrase failures; preserve policy verification state and no-hallucinated-refund behavior.
3. Re-run the expanded corpus plus legacy parity, knowledge coverage, learning loop, and PostgreSQL-backed integration suites.
4. Compare before/after against the same 34 cases; require lower wrong-source rate without reducing answerable Top-3 recall.
5. Keep production deployment/SHA/authenticated smoke as a distinct evidence gate.
