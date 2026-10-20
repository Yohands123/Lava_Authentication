# Phase 5 security and privacy review

Scope: local engineering, October 18, 2026. No deployment, push, PR, participant recruitment, production telemetry or model activation is authorized by the Phase 5 request.

## Preserved authentication boundary

Phase 5 changes no WebAuthn handler, challenge store, credential verification, cookies, signature checks, cryptographic random generation, clearance redemption, rate policy, production environment or lamp physics. Every authentication still requires its independent passkey ceremony. Existing Worker protocol enforcement remains authoritative. The new estimator is an unused offline seam, supports only off/shadow, and can return only an observation. No model grants authentication, permanent BLOCK or permanent bans.

The real-browser capture demonstrates the distinction: 20 completed automated attempts received CLEAR/options access under advisory ML; all 30 measured attempts returned session 401 without credentials. Ten incomplete rings are not detector successes. This does not establish resistance to sophisticated bots, nor human false-positive performance. Existing enforcement tests additionally cover fabricated summaries, replay, binding, expiration and required passkeys.

## Untrusted evidence

Pointer events, timing, labels, consent metadata, generator families, devices, outcomes, study codes and derived vectors are forgeable. Exact schema checks prevent accidental malformed datasets; they do not authenticate provenance. Source hashes provide integrity/lineage, not independent identity or truthful consent. Raw/canonical-path hashes catch known exact/normalized replays, not arbitrary near-duplicate attacks. Study supervision and prospective independence remain research requirements.

The portable format has strict bounded fields/coefficients, finite arithmetic guards, dataset/version checks, unsupported-device/OOD fallback and live withdrawal checks. Prepared models are cloned so caller mutation cannot change cached coefficients. No executable payload, network loader or untrusted pickle deserialization is used. Python measures serialization size of its own in-memory models only.

## Local data boundary

Research requires opt-in before an attempt and is bounded to 32 in-memory attempts, 1,024 points each. Exports are explicit downloads; no raw route or background collection is added. Unknown labels, devices, insufficient movement and cancellations cannot acquire training eligibility through a verdict. Human captures under model-enforcement modes are excluded. Production ML/metrics/Lab flags stay off.

`ml/private/`, environment secrets, raw corpora, caches, model candidates and local server state remain Git-ignored. Public artifacts contain aggregate automation evidence or explicitly synthetic inference fixtures. The publication scanner checks tracked and untracked publishable files for secret patterns, private paths, JSON validity, case-correct local links and required screenshots. Pattern scanning is useful review evidence, not a proof that every possible secret format is absent.

## Withdrawal and integrity

The withdrawal command defaults to dry-run and validates every resolved target against the chosen private root. It refuses symlink escapes and performs no recursive removal. Revocations are written first using atomic replacement, so interruption makes old data ineligible before cleanup. Matching private raw exports and mixed batches are deleted/filtered; matching JSONL copies are filtered. Application artifacts/reports are invalidated conservatively, since coefficients cannot be reliably unlearned by deleting rows. Final-test-use history remains. Retraining and another manual review are required.

The tool covers supported local formats, not arbitrary renamed binary backups or files outside `ml/private/`. Downloaded copies and external backups need manual deletion. Revocation hashes remain sensitive linkage metadata with a separate justified retention policy. They prevent accidental reimport; they are not a claim of total erasure. Public aggregate reports may need superseding if a future participant's withdrawal changes published counts. No genuine participant appears in the present public reports.

## Remaining risks

Calibration and OOD support checks are conservative heuristics. A self-reported unknown device cannot be classified reliably. Touch, pen, assistive hardware, takeover scenarios, browser scheduling, slow hardware, matched acquisition and accessibility all require approved prospective validation. Native Python allocation is not covered by `tracemalloc`; Node latency is not an edge CPU measurement. The final-test lock is a local workflow guard and can be deliberately deleted by an operator; independent review/prospective preregistration is still needed.

Staging, production monitoring, external model loading, recruitment, data sharing and any deployment require a new owner decision supported by the [roadmap acceptance criteria](LAVAGUARD_PHASE5_ROADMAP.md).
