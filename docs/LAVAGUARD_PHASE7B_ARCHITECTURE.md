# Phase 7B architecture and routing prototype

Production routing is unchanged. [env.ts](../src/worker/env.ts) still uses `idFromName("global")` for challenges/guard state, sessions and users; rates use independent key-derived objects. This is not a deployed sharding migration. Cloudflare's [Durable Object rules](https://developers.cloudflare.com/durable-objects/best-practices/rules-of-durable-objects/) inform the actor/consistency boundary; actual queries and measurements here come from repository code and disposable local stores.

| State | Required consistency | Existing access/index and limitation |
| --- | --- | --- |
| WebAuthn challenge | One-use consume, expiry, exact challenge binding | Global ChallengeStore; 60-second default; server entropy retained |
| Guard attempt/clearance | Atomic nonce evaluation and one-use context/origin/scope redemption | Global guard SQL; attempts 120 seconds, clearances 90 seconds; bounded rows/history |
| Account/credential | Unique username/credential and authoritative counter updates | Global UserStore, username unique and credential primary key, transactional creation |
| Session | Authoritative expiry and revoke/revoke-all | Global SessionStore; primary ID and user index; expiry-on-read, existing cleanup limitations remain |
| Rates | Atomic per-key windows plus deliberate broader budgets | Network/context/global keys, expiry alarms and stale-alarm protection |
| Metrics | Best-effort bounded counts, never auth authority | Existing fixed-name production-disabled metrics; separate per-shard prototype |

## Opt-in local prototype

[ResearchShardRouter](../src/worker/guard/research-router.ts) requires explicit enablement, a server-owned HMAC key, known key/version and an epoch catalog (1/4/16 shards). Keyed context placement reduces client-selected placement; it is not a complete defense against many-context search or hot-context DoS. Signed claims bind scope, opaque server ID, context/origin hashes, expiry, epoch and shard. They are integrity-protected, not encrypted. Client data cannot choose another authoritative shard by changing a claim.

A bounded authoritative SQL directory fixes `(scope,id)` ownership and rejects duplicate ownership. Verification checks the MAC, binding, acceptance window, expected placement and directory before dispatch. Unknown key/epoch, bad MAC, unavailable directory, missing shard or ambiguous parent fails closed. A failed signed hint never scans shards or falls back to an old routing algorithm. Legacy opaque IDs require an explicit directory entry and still need normal store verification; lookup alone grants no permission.

[ResearchRoutedGuard](../src/worker/guard/research-routed-guard.ts) wraps actual LavaEnforcer SQL methods. Evaluation spends the nonce at the original epoch and seals its clearance to that same authority, even if the active epoch changes. If sealing a granted clearance fails, the underlying token is revoked. There are no production imports, bindings or migrations for these modules. Prototype SQL/crypto errors are explicit failures; production API error behavior was not replaced.

The benchmark uses real LavaEnforcer, SessionStore and UserStore methods on disposable Node SQLite; only the DurableObject base is stubbed. Six 256-operation runs cover spread/hot traffic at 1/4/16 shards, eight competing redemptions per operation, credential lookups and session revocation. A separate SQL migration exercise copies an unconsumed clearance to another epoch: injected new-shard redemption is rejected, old authority has one winner, duplicate directory registration is rejected and restart does not resurrect revoked sessions. Nonce, expiry, revocation, directory loss and invalid SQL have executable tests. Synthetic public-key bytes exercise SQL only; actual WebAuthn is tested separately through local Workers.

## Migration and rollback design

Keep legacy and new routing catalogs side by side. New issuance uses the selected epoch; outstanding attempts/clearances/challenges stay at their original authority. Drain at least the actual outstanding 120/90/60-second lifetimes plus reviewed skew before retiring those mappings. Sessions can live seven days and need their own revocation-aware directory lifetime, not a 90-second cutover. Credentials/accounts need stable per-account partitioning, a credential-to-account directory and preserved username uniqueness; this prototype does not migrate them.

Never dual-redeem, copy an unconsumed token and make both copies authoritative, accept stale routing-cache ownership or guess a fallback after a miss. Promotion of copied state requires a separately designed atomic authority transition. Rollback stops new epoch issuance but retains the authority/catalog for already issued IDs until they expire or are explicitly revoked. Keep the signing key through outstanding-token drain; the prototype uses one active key and does not implement a production overlapping key-ring rotation. Lost keys safely fail but can interrupt availability.

Per-shard 4,096-row limits cannot preserve a global budget by multiplication. A production design needs reviewed capacity reservations/admission, migration conflict rules, user/credential uniqueness, revocation fan-out and cross-region behavior. The prototype's single SQL directory can itself become a hot bottleneck and is **not production ready**. It is bounded at 4,096 entries per experiment and discarded after the run. Distributed directory throughput, multi-isolate consistency, cross-region latency and storage/namespace costs are not measured.

## Metrics and resilience

[ResearchShardMetrics](../src/shared/shard-metrics.ts) accepts fixed event/model/policy labels, coarse hours and numeric shard IDs, with 24-hour filtering, 1,024-row capacity and explicit dropped-event count. It has no visitor ID, context, IP, trajectory, credential or remote sink. Each shard can flush independently in a future design; a rotating bounded fan-in reader must avoid a global write on every request. No such service was started.

Coverage combines new SQL/cold-restart/directory/metrics-failure tests with existing actual-Worker nonce/origin/replay, stale-alarm, provider-failure, cancellation and missing/OOD model tests. The isolated Phase 7 Worker subclass injects metrics failure only in its disposable store; normal production handler requests still succeed and cannot create a session without credentials. Rollback migration behavior is local authority simulation, not a tested cloud deployment rollback. See [scaling measurements](LAVAGUARD_PHASE7B_SCALING_RESULTS.md), [transport diagnosis](LAVAGUARD_PHASE7B_TRANSPORT.md) and [staging gates](LAVAGUARD_PHASE7_STAGING.md).
