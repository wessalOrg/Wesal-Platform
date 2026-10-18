# Mabrouk V5 Retrieval Evaluation

## Baseline (before V5 retrieval changes)

- Base: `origin/main` at `5a60fdb3cc24e8936659cb1b335cc8ec33f1288c`.
- Retrieval: `HybridWesalKnowledgeService`; dynamic published candidates use normalized alias/title/substring scoring; embedded Markdown uses deterministic keyword/content overlap. Dynamic candidates are concatenated before built-ins. No semantic/vector retrieval.
- Corpus: 18 labeled cases in `Backend/tests/Wesal.Tests/Ai/Fixtures/mabrouk-v5-retrieval-eval.json`, covering Arabic and English exact aliases, paraphrases, typo, short/long query, capability, ambiguous team/policy, and true unknown. Expected trusted article keys and forbidden source keys are explicit. Palestinian Arabic is represented, but the corpus is still small and does not support broad population claims.
- Runner: `MabroukV5RetrievalBaselineShould`; each case is warmed once and measured 10 times in-process against the production retriever with an empty dynamic repository. Latencies are local process measurements, not production or database measurements.

| Metric | Baseline |
|---|---:|
| Top-1 correct trusted article | 62.50% (10/16 answerable) |
| Top-3 recall | 68.75% (11/16 answerable) |
| Wrong-source rate | 22.22% (4/18; includes forbidden source exposure and unsupported non-fallback hits) |
| Fallback rate | 16.67% (3/18) |
| Average retrieval latency | 5.56 ms |
| p95 per-case latency | 37.92 ms |

Language breakdown: Arabic Top-1 72.73% (8/11 answerable), Top-3 72.73%; English Top-1 40.00% (2/5), Top-3 60.00%.

Observed failures include Arabic cancellation paraphrase retrieving booking instructions, English cancellation retrieving a payment-terms article, a photographer capability question retrieving hall details, and Mabrouk developer queries exposing the separate Wesal team article among candidates. A true unknown also matched a booking document because dynamic candidate SQL used substring matching (`book` inside `booking`). These are baseline defects, not acceptable behavior.

The initial cold sample included JIT and embedded-document startup (over 2.5 seconds); it is excluded from the reported latency after warm-up and retained only as a cold-start caveat. This benchmark is synthetic/offline; it makes no PostgreSQL, production, or provider claim.

## V5 architecture and results

V5 keeps the existing service and adds bounded query-concept expansion, token-boundary matching for dynamic articles, source-family eligibility, exact-alias precedence, and a rerank across eligible dynamic and embedded articles. Published/effective-state candidate filtering remains in the repository; dynamic verification status still outranks relevance, and verified active overrides suppress only their corresponding built-in key. Query concepts cover observed cancellation, booking, owner onboarding, and capability paraphrases. There is no embedding provider or vector query in runtime.

Hall recommendations extend the V4 semantic plan. “Most suitable” follows the last result set, refetches those hall IDs from the live details service, enforces explicit minimum/maximum price, capacity, region, and area constraints, then ranks valid candidates by target-price distance, lower price under a budget, capacity margin, and stated location. A request without usable criteria asks what matters; no matching candidate produces an honest no-match response. Explanations use the selected hall's current published price, capacity, region, and address. Availability continues to use the existing live slot service when explicitly requested.

The same labeled corpus and benchmark runner were used before and after the retrieval change. This is an offline in-process comparison with an empty dynamic repository, not PostgreSQL or production latency.

| Metric | V4 baseline | V5 | Change |
|---|---:|---:|---:|
| Top-1 correct trusted article | 62.50% (10/16) | 75.00% (12/16) | +12.50 pp |
| Top-3 recall | 68.75% (11/16) | 93.75% (15/16) | +25.00 pp |
| Wrong-source rate | 22.22% (4/18) | 0.00% (0/18) | -22.22 pp |
| Fallback rate | 16.67% (3/18) | 11.11% (2/18) | -5.56 pp |
| Average retrieval latency | 5.56 ms | 13.05 ms | +7.49 ms |
| p95 per-case latency | 37.92 ms | 55.51 ms | +17.59 ms |

Language breakdown in V5: Arabic Top-1 81.82% (9/11 answerable), Top-3 100% (11/11); English Top-1 60.00% (3/5), Top-3 80.00% (4/5). Remaining Top-1 misses are an ambiguous Wesal-team query, ambiguous cancellation-policy queries, and one English cancellation paraphrase. The small corpus does not support broad language-quality claims. The latency increase comes with a more complete candidate union/rerank and is measured on a local process; production/database timing is unknown.

Focused V5 recommendation tests cover live-price/capacity ranking, clarification without criteria, hard-filter no-match without a new search, and a grounded “why this hall?” explanation. The full backend regression suite passes. Live PostgreSQL is not configured in this environment, so the PostgreSQL-specific suite reports its existing no-server behavior; this is not PostgreSQL validation.

## pgvector decision

The repository has no pgvector dependency, migration, or embedding provider. Hosted Neon availability cannot be proven without querying the actual project/database. The upstream pgvector project documents `CREATE EXTENSION vector` as a per-database opt-in and supports exact nearest-neighbor search by default, with approximate HNSW/IVFFlat as optional indexes. Until a safe isolated PostgreSQL environment confirms extension availability and an embedding experiment beats the labeled baseline, V5 will not add the extension or vector schema. Retrieval remains functional without embeddings.

## Known limits

- Eighteen cases are too few to claim general Arabic quality; expand with reviewed source labels before considering semantic retrieval.
- The current local timing excludes query/database network latency and is sensitive to process load.
- The current English and ambiguous-policy misses need reviewed cases and targeted improvements before claiming broader coverage.
- Dynamic article trust/effective-state tests must continue to use the repository-backed Learning Loop suite.
- Production deployment SHA and authenticated smoke remain `PRODUCTION_VERIFICATION_PENDING` from V4.
