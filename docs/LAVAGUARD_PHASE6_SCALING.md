# Phase 6 scaling profile and sharding ADR

Status: **prototype evaluated; production cutover NO-GO**. [Local HTTP load](../ml/artifacts/phase6-local-load.json), [retained first failure](../ml/artifacts/phase6-local-load-initial.json), [SQLite prototype](../ml/artifacts/phase6-sharding.json).

## Actual backend profile

`env.ts` maps ChallengeStore, SessionStore and UserStore to one globally named object each. RateLimiter is keyed separately for global, IP, context and user operations. This makes shared storage a hotspot hypothesis, not a proven edge throughput maximum. Guard issuance/evaluation/clearance and WebAuthn challenge consumption share ChallengeStore; metrics and retention work add calls/queries. Existing atomic synchronous SQL sections preserve one-use semantics.

Guard attempts/clearances have 4096 global row caps, three pending rows per context, context-bound nonces, 120-second attempt/90-second clearance lifetimes, 16 recent context rows, a ten-minute history window and bounded global cleanup. Step-ups have separate bounded stores. The router admits at most 16 ordinary guard POSTs and four verification POSTs per isolate. These are isolate admission controls, not a global user quota or distributed-capacity promise.

Challenge/guard/metric alarms and index-based lookups were reviewed. A new real-SQL RateLimiter test invokes the actual alarm method with a new window already active and confirms that an old alarm reschedules rather than erasing the new counter. Its Cloudflare base class/storage host is a test adapter; the rate logic and SQL are the actual source. Existing expiry/global-cap/metric-retention tests remain active.

SessionStore has a user index and removes an expired session when read, but has no general expiry sweep/alarm. Untouched expired sessions therefore remain a growth risk. UserStore uses credential primary-key lookup joined to users; per-user session/revocation and discovery mappings need careful design before sharding. No session/credential/schema behavior was changed.

## Frozen local load results

Each level used fresh state and a frozen source/assets snapshot on dedicated port 8807. Synthetic local client headers spread test rate keys; these are not real network identities.

| Concurrent callers | Issue accepted / attempted | Evaluate accepted / actual sent | Issue p95 ms | Evaluate p95 ms | Recovery |
| --- | --- | --- | --- | --- | --- |
| 1 | 32/32 | 32/32 | 51.864 | 39.676 | 200 |
| 4 | 32/32 | 32/32 | 283.896 | 134.921 | 200 |
| 16 | 32/32 | 32/32 | 417.845 | 284.191 | 200 |
| 64 | 33/64 | 17/33 | 848.812 | 277.675 | 200 |
| 128 | 26/128 | 17/26 | 736.851 | 249.252 | 200 |

At 64, issuance/evaluation intentionally rejected 31/16 with 503; at 128, 102/9 with 503. Skipped evaluations follow failed issuance and are explicitly excluded from sent-request denominators. The main issuance/evaluation phases had zero unexpected 5xx, transport errors or timeouts; this excludes the distinct slow-stream failure-injection case below. Accepted throughput and p50/p95/p99, same-network resets/429, parallel first-winner redemption, process CPU/RSS, aggregate metrics and SQL counts are in the artifact. All five recovery checks succeeded and unauthenticated sessions stayed 401. Historical Phase 4 load evidence is untouched.

**Failure injection limitation:** oversized external streaming was rejected with 400. A deliberately unfinished external chunked request received a local bridge HTTP 500 in about 155 ms, before an application request appeared in the Worker log. An unfinished stream constructed inside the same actual workerd entry reached the unchanged production body reader and returned 400 after about 3063 ms. The initial run's failed 400 assertion is retained separately; its pre-checkpoint latency/count arrays were not reconstructed. This local bridge failure remains unresolved and is not called a successful rejection or an application/edge guarantee. Approved staging must verify the actual external slow-client path. No production hardening change was justified from a development transport error alone.

## Sharding decision

The simulator routes a 43-character context to 1/4/16 Node SQLite instances using the actual LavaEnforcer. Across each 512-operation workload, all 512 first redemptions succeeded and 512 replays were refused. Routing, collision/context binding, expiry and parallel one-winner tests passed. Node p95 operation times were approximately 0.933/0.790/0.752 ms; this sequential single-process prototype demonstrates correctness under its assumptions, not distributed speedup.

A 10,000-row synthetic session expiry query changed from SCAN to indexed SEARCH in a disposable database. It returned the same 5000 rows; median selection time changed from about 2.521 to 2.213 ms. This is a proposed index/cleanup experiment, not a production migration or ten-thousand-user capacity result. Full-table counts/cap sweeps need query-plan and load analysis at realistic row bounds; a plan that says SCAN alone does not establish its cost.

Proposed future routing uses an authenticated opaque server-issued routing envelope or a stable reviewed server mapping, so issue/evaluate/redeem reach the same authoritative shard. The prototype's public FNV placement is deliberately not adversarial-placement protection. Cookie resets and chosen contexts bypass per-context quotas; independent edge/global/network admission is still necessary. Per-shard caps multiply global capacity and are **not equivalent** to today's shared cap. No sharding cutover is approved.

WebAuthn challenge purpose/user binding, discoverable credential lookup, user/session routing and revoke-all need separate stable identity mappings and generation markers. Migration needs dual-version lookup without double redemption, a bounded compatibility period, idempotent reads, explicit write authority, expiry draining, recovery and audited rollback. Never dual-write single-use clearances into independently redeemable authorities. Do not rename/bind classes or change migrations until independent correctness and owner review permit it.

## 10K / 100K capacity risk model

No 10,000-concurrent or 100,000-user support claim is made. For a conditional planning example, 10,000 total users with 10% active and a 30-second think time imply roughly 33 attempts/s; 100,000 with the same assumptions imply 333 attempts/s. Four logical authentication API operations per attempt would imply about 133/1333 API requests/s before assets, retries, metrics, abuse and actual DO fan-out. These are assumed workload inputs, not measured demand or supported capacity.

The active fraction, service/queue times at a real hot object, isolate count/distribution, platform limits, SQLite growth, RTT, retries, external verification, regional behavior, edge CPU and error budget are unknown. A shared object with an assumed 20 ms serialized service time would hypothetically saturate near 50 operations/s; that service time is not measured here. Local client HTTP latency cannot substitute for server service time. Later approved staging must ramp bounded arrivals, measure DO/Worker CPU and tails, enforce spend limits, drain load and demonstrate rollback before any larger claim.
