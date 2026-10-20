# Phase 6 threat model and predeclared experiment design

Version `lava-phase6-threat-v1`, October 19, 2026. Engineering experiments target only isolated localhost Workers. Existing uncommitted Phase 5 changes and private data are retained. No release, production flags, migration, paid agent or remote monitoring is authorized.

| Objective | Attacker capability | Independent observation |
| --- | --- | --- |
| Clear visual ring | Open-loop or DOM-informed browser input | Actual ring completion, including incomplete/abandoned traces |
| Obtain clearance/options | Schema-valid aggregate fabrication, replay, cookie/context changes | Issuance, evaluation, clearance, options HTTP |
| Evade research score | Adaptive paths, acquisition changes, forged hints | Score availability and frozen research threshold; no identity inference |
| Cause false challenges | Hints present, smooth/erratic or assisted-like input | Auth regression; genuine-user impact requires participants |
| Exhaust resources | Bounded concurrent callers, resets and replay | Accepted, 429, 503, unexpected failures, recovery and latency |
| Corrupt study provenance | Declared human takeover, missing/contradictory metadata | Strict schema, connected lineage and no inferred labels |
| Authenticate without a credential | API-only or tampering caller | Session creation remains behind WebAuthn verification |

API attackers can fabricate plausible client vectors. A nonce verifies freshness/binding, not motion or humanity. Browser hashes are integrity checks, not attestation. Environment hints have zero policy authority and are correlated, forgeable disclosures. A credential attacker with a valid passkey is outside the credential-free experiment; risk estimation does not replace passkey security.

Every experiment records the independent fields in [the outcome schema](../src/shared/phase6-outcome.ts). Unknown/not measured is null, not false. A completed harness can observe an incomplete ring; incomplete motion earns no classifier credit. HTTP 401 without a credential is an authentication boundary observation, never an ML detection success.

## Initial implementation matrix

| Area | Initial state | Work authorized locally |
| --- | --- | --- |
| WebAuthn, UI, protocol, advisory environment, robust/response features, connected splits | EXISTING | Reproduce regression checks |
| Broader agent harness, immutable registry, response-v4 event diagnostics, shadow metrics | MISSING | Implement and run controlled tests |
| Worker inference/load, sharding prototype, indexes and rollback drill | MISSING/PARTIAL Phase 4 tools | Isolated snapshot and simulator; no cutover |
| Application calibration, FPR, participant generalization and usability | REQUIRES_REAL_DATA | Audit counts; no invented human labels |
| Independent security review, external vision/LLM agent, staging/edge, deployment | REQUIRES_OWNER_APPROVAL or independent resources | Interface/protocol/design only; mark unavailable |

## Frozen engineering design

Browser generator seeds are fixed at 6101/6102; repeated seeds are not independent authors/families. Related coordinate, timing, replay and cadence variants retain lineage. The original physics is used; a disclosed client-only seeded Math.random may control initial physics in designated cases, but scheduling and WebGL remain nondeterministic. Server crypto is never replaced. Every run has immutable source/config hashes and its own isolated state; failed first trials remain in checkpoints and report history.

Existing Phase 5 model thresholds remain frozen and descriptive. Phase 6 registry outputs have only observation authority. Synthetic negative controls use the existing fixed connected-group split seed, training-only preprocessing, separate development calibration and label-shuffled fitting controls. Environment/source/cadence controls are diagnostic only. Application final cohorts are never read for tuning. With no genuine humans, population FPR, calibrated application probability, participant generalization and punitive readiness are unavailable.

LavaGuard adds protocol abuse controls and experimental risk estimation; client-side behavior is forgeable and passkeys provide identity security.
