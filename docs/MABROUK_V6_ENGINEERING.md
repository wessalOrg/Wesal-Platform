# Mabrouk V6 Engineering Checkpoint

## Starting point

- V5 PR #39 merged on 2026-10-14 as `950a4b0a4da9f7007642cd8691f0f3118d81a0cc`.
- V5 exact-head CI passed on `4beaa36599178bde4e32f9295bbdebe9af94dde0` in run `38541782983`; CI on the merge commit also passed in run `38542190107`.
- V5 stable local Playwright run passed 20/20. Production deployment SHA and authenticated smoke remain `PRODUCTION_VERIFICATION_PENDING`.
- V6 branch: `feat/mabrouk-v6-evaluation-coverage`, based on the V5 merge commit.

## V6 first engineering slice: evaluation coverage

V5's labeled retrieval fixture had 18 cases and documented ambiguous English/policy misses. This first V6 slice adds 16 Arabic/English cases for cancellation after deposit, unconfirmed refund details, booking authentication/status, owner approval/visibility and identity requirements, guest browsing, and Mabrouk team identity. Expected and forbidden keys are checked against the embedded source corpus so labels cannot silently drift. The benchmark now emits a compact failure summary and records that latency is local in-process time with an empty in-memory dynamic repository.

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
| Top-1 expected source | 15.63% (5/32 answerable) |
| Top-3 expected source | 18.75% (6/32 answerable) |
| Wrong/forbidden source | 38.24% (13/34) |
| Empty retrieval / fallback | 38.24% (13/34) |
| Mean in-process latency | 13.218 ms |
| p95 per-case latency | 45.695 ms |

Language breakdown: Arabic Top-1 10.53% (2/19 answerable), Top-3 15.79%; English Top-1 23.08% (3/13), Top-3 23.08%. This first measurement is diagnostic only: the inherited fixture uses shorthand expected/forbidden keys in several legacy rows, while the retriever returns generated stable keys. V6 must migrate all labels to canonical returned keys before using aggregate accuracy as a release threshold. The corpus is small and hand-labeled from current repository knowledge; it is not a population quality claim. Timing excludes database and network latency.

Observed answerable misses include cancellation after deposit, Arabic booking login and status questions, owner visibility/identity questions, guest browsing, Mabrouk team paraphrase, refund details, and English cancellation/status. Four cases include a forbidden or unsupported source in the result list. These cases are priorities for V6 behavioral work and regression coverage.

## Next V6 gates

1. Review labels against product owner intent and current source articles before treating this corpus as an acceptance target.
2. Improve retrieval conservatively for the observed source-family and paraphrase failures; preserve policy verification state and no-hallucinated-refund behavior.
3. Re-run the expanded corpus plus legacy parity, knowledge coverage, learning loop, and PostgreSQL-backed integration suites.
4. Compare before/after against the same 34 cases; require lower wrong-source rate without reducing answerable Top-3 recall.
5. Keep production deployment/SHA/authenticated smoke as a distinct evidence gate.
