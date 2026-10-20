# Phase 7B local scaling measurements

All measurements are local Node 24.13.0/workerd/SQLite and synthetic callers. No edge capacity, provider billing, real-user traffic or 10k/100k concurrent-user support is established. The underlying application still uses its original global Durable Objects. Results are observational on one active desktop; index and other local activity can affect timings. They are not controlled historical speedup estimates.

[The complete load artifact](../ml/artifacts/phase7-local-load.json) records five fresh frozen Workers, bundle/asset/config hashes, expected 429/503, actual/skipped evaluations, all-request and accepted-only latency, successful RPS, host CPU/RSS, storage counts, metrics and one-winner/recovery probes. Refusals are availability failures, never successful service capacity.

<!-- PHASE7_LOAD_START -->
| Concurrency | Issues 200/actual | Issue 503 | Eval 200/actual | Eval 503 / skipped | Accepted issue/eval p95 ms |
| --- | --- | --- | --- | --- | --- |
| 1 | 32/32 | 0 | 32/32 | 0 / 0 | 46.32 / 36.68 |
| 4 | 32/32 | 0 | 32/32 | 0 / 0 | 135.62 / 81.48 |
| 16 | 32/32 | 0 | 32/32 | 0 / 0 | 417.86 / 274.03 |
| 64 | 44/64 | 20 | 17/44 | 27 / 20 | 1092.60 / 381.24 |
| 128 | 35/128 | 93 | 25/35 | 10 / 93 | 1297.39 / 581.48 |
<!-- PHASE7_LOAD_END -->

Every level recovered with an actual 200 after pressure drained. Eight competing clearance redemptions produced one winner. Credential-free sessions remained 401. Broader same-network cookie-reset probes retain their actual rate/admission results. No main issuance/evaluation request had an unexpected 5xx or transport error in the completed run. The separate slow-stream transport failure remains unresolved and is not included as a successful capacity request.

The [sharding artifact](../ml/artifacts/phase7-sharding.json) contains six 256-operation Node SQL experiments: 1/4/16 shards, spread versus approximately 80% hot context, 1,536 successful one-use redemptions, 10,752 rejected replays, 1,536 credential reads and 1,536 session revocations. Local composite-operation p95 ranged roughly 3.77–6.53 ms. Promise races run in one Node process; they do not measure distributed parallel shard throughput. A keyed router cannot spread one deliberately hot context across shards without breaking atomicity.

The [index artifact](../ml/artifacts/phase7-index.json) uses 10,000 synthetic session rows and selects the same 5,000 expired rows before/after a disposable expiry index. SQLite changes SCAN to SEARCH. Thirty-sample before/after quantiles are retained in the artifact; small machine-dependent differences are not throughput guarantees. Existing user/credential lookups use their indexes. The production schema is unchanged, and 10,000 SQL rows do not represent 10,000 concurrent users.

## Proposed operating targets and cost model

These are proposals for an owner-reviewed pilot, **not measured SLO achievements**: evaluate an admitted-traffic p95 below 500 ms and p99 below one second at an explicitly bounded pilot load; alert on sustained unexpected 5xx/timeouts above 0.1% or 503/429 availability fractions above the approved budget. Use all actual requests as the error denominator and accepted requests for successful throughput. Distinguish abusive traffic from shared-budget harm; neither IP nor retry proves an identity or intent. No alert service was started.

Budget separately for Worker requests, rate-object RPCs, guard/challenge RPCs, user/credential/session operations, SQL rows/storage, optional provider calls and metric writes. An illustrative assumption of 15 DO operations per complete attempt yields 15k/1.5m/15m operations for 1k/100k/1m daily attempts; **15 is a scenario input, not an audited billing count**. Replays, failures, retries, metrics and cache behavior change it. Price coefficients, real account usage, edge CPU and actual cost remain unknown/null; no money was spent. A central routing directory or per-request global metric write could dominate cost and contention.

Production scale remains blocked on the directory/global-budget design, ownership migration, actual serving-path slow-client behavior, edge/multi-isolate measurements, operator traffic/budget approval and independent security/usability review. See [architecture](LAVAGUARD_PHASE7B_ARCHITECTURE.md) and [release gates](LAVAGUARD_PHASE7_STAGING.md).
