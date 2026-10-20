# LavaGuard Phase 6 handoff — October 19, 2026

**Local engineering review only. MODEL_NOT_VALIDATED_FOR_PRODUCTION. Phase 7 release/staging: NO-GO without the prerequisites below.** Work stays on the owner's existing dirty `feature/lavaguard-phase5` tree based on `8fc9eb0`. Nothing was committed, pushed, published, deployed or enabled in production.

## A. Existing work and exact changes

Phase 5 already supplied the original lava circle/physics, mandatory WebAuthn, protocol protections, bounded consent exports, strict imports, robust/response extraction, connected cohorts, calibration/final guards, portable inference and advisory environment evidence. All original changes/data are preserved. Baseline reproduction passed 118 TypeScript, 16 console, 42 Python and 23 importer checks before Phase 6 edits. Publishable-file baseline hashes and original test logs remain in the ignored local cache.

Added an independent outcome schema, broad browser/API matrix, event-based response-v4 diagnostics, synthetic nuisance/leakage controls, a private immutable observation registry, bounded shadow metrics, failure containment, a separate local Worker adapter, runtime/load benchmarks, a real-SQL sharding/index prototype, offline comparison view, regression tests and reproducible reports. Existing shared parsers were hardened against malformed JSON enum objects, off inference now avoids parsing, and private withdrawal invalidates the new formats. Authentication/production router/storage migration/UI semantics are unchanged.

<!-- PHASE6_FILES_START -->
| File | Phase 6 change |
| --- | --- |
| [docs/LAVAGUARD_PHASE6_ADVERSARIAL_RESULTS.md](../docs/LAVAGUARD_PHASE6_ADVERSARIAL_RESULTS.md) | Added in Phase 6 |
| [docs/LAVAGUARD_PHASE6_HANDOFF.md](../docs/LAVAGUARD_PHASE6_HANDOFF.md) | Added in Phase 6 |
| [docs/LAVAGUARD_PHASE6_INFERENCE.md](../docs/LAVAGUARD_PHASE6_INFERENCE.md) | Added in Phase 6 |
| [docs/LAVAGUARD_PHASE6_ML_RESULTS.md](../docs/LAVAGUARD_PHASE6_ML_RESULTS.md) | Added in Phase 6 |
| [docs/LAVAGUARD_PHASE6_ROADMAP.md](../docs/LAVAGUARD_PHASE6_ROADMAP.md) | Added in Phase 6 |
| [docs/LAVAGUARD_PHASE6_SCALING.md](../docs/LAVAGUARD_PHASE6_SCALING.md) | Added in Phase 6 |
| [docs/LAVAGUARD_PHASE6_SECURITY_ACCESSIBILITY.md](../docs/LAVAGUARD_PHASE6_SECURITY_ACCESSIBILITY.md) | Added in Phase 6 |
| [docs/LAVAGUARD_PHASE6_THREAT_MODEL.md](../docs/LAVAGUARD_PHASE6_THREAT_MODEL.md) | Added in Phase 6 |
| [ml/artifacts/phase6-adversarial.json](../ml/artifacts/phase6-adversarial.json) | Added in Phase 6 |
| [ml/artifacts/phase6-environment-coverage.json](../ml/artifacts/phase6-environment-coverage.json) | Added in Phase 6 |
| [ml/artifacts/phase6-inference-performance-initial.json](../ml/artifacts/phase6-inference-performance-initial.json) | Added in Phase 6 |
| [ml/artifacts/phase6-inference-performance.json](../ml/artifacts/phase6-inference-performance.json) | Added in Phase 6 |
| [ml/artifacts/phase6-local-load-initial.json](../ml/artifacts/phase6-local-load-initial.json) | Added in Phase 6 |
| [ml/artifacts/phase6-local-load.json](../ml/artifacts/phase6-local-load.json) | Added in Phase 6 |
| [ml/artifacts/phase6-ml.json](../ml/artifacts/phase6-ml.json) | Added in Phase 6 |
| [ml/artifacts/phase6-perturbations.json](../ml/artifacts/phase6-perturbations.json) | Added in Phase 6 |
| [ml/artifacts/phase6-readiness.json](../ml/artifacts/phase6-readiness.json) | Added in Phase 6 |
| [ml/artifacts/phase6-sharding.json](../ml/artifacts/phase6-sharding.json) | Added in Phase 6 |
| [ml/artifacts/phase6-verification.json](../ml/artifacts/phase6-verification.json) | Added in Phase 6 |
| [ml/phase6.py](../ml/phase6.py) | Added in Phase 6 |
| [ml/study_withdraw.py](../ml/study_withdraw.py) | Modified existing local file |
| [ml/test_phase6.py](../ml/test_phase6.py) | Added in Phase 6 |
| [package.json](../package.json) | Modified existing local file |
| [playwright.phase6.config.ts](../playwright.phase6.config.ts) | Added in Phase 6 |
| [PROGRESS.md](../PROGRESS.md) | Modified existing local file |
| [README.md](../README.md) | Modified existing local file |
| [scripts/phase6/adversarial.mjs](../scripts/phase6/adversarial.mjs) | Added in Phase 6 |
| [scripts/phase6/api-cases.mjs](../scripts/phase6/api-cases.mjs) | Added in Phase 6 |
| [scripts/phase6/benchmark.mjs](../scripts/phase6/benchmark.mjs) | Added in Phase 6 |
| [scripts/phase6/browser-case.mjs](../scripts/phase6/browser-case.mjs) | Added in Phase 6 |
| [scripts/phase6/candidate.mjs](../scripts/phase6/candidate.mjs) | Added in Phase 6 |
| [scripts/phase6/features.mjs](../scripts/phase6/features.mjs) | Added in Phase 6 |
| [scripts/phase6/generators.mjs](../scripts/phase6/generators.mjs) | Added in Phase 6 |
| [scripts/phase6/load.mjs](../scripts/phase6/load.mjs) | Added in Phase 6 |
| [scripts/phase6/local-worker.mjs](../scripts/phase6/local-worker.mjs) | Added in Phase 6 |
| [scripts/phase6/registry-store.mjs](../scripts/phase6/registry-store.mjs) | Added in Phase 6 |
| [scripts/phase6/registry.mjs](../scripts/phase6/registry.mjs) | Added in Phase 6 |
| [scripts/phase6/report.mjs](../scripts/phase6/report.mjs) | Added in Phase 6 |
| [scripts/phase6/runtime.ts](../scripts/phase6/runtime.ts) | Added in Phase 6 |
| [scripts/phase6/serve.mjs](../scripts/phase6/serve.mjs) | Added in Phase 6 |
| [scripts/phase6/sharding.mjs](../scripts/phase6/sharding.mjs) | Added in Phase 6 |
| [scripts/phase6/storage.test.mjs](../scripts/phase6/storage.test.mjs) | Added in Phase 6 |
| [scripts/phase6/verify.mjs](../scripts/phase6/verify.mjs) | Added in Phase 6 |
| [scripts/phase6/view.mjs](../scripts/phase6/view.mjs) | Added in Phase 6 |
| [scripts/phase6/worker.ts](../scripts/phase6/worker.ts) | Added in Phase 6 |
| [src/shared/automation-environment.ts](../src/shared/automation-environment.ts) | Modified existing local file |
| [src/shared/dynamic-response.ts](../src/shared/dynamic-response.ts) | Added in Phase 6 |
| [src/shared/observation-budget.ts](../src/shared/observation-budget.ts) | Added in Phase 6 |
| [src/shared/observation-registry.ts](../src/shared/observation-registry.ts) | Added in Phase 6 |
| [src/shared/phase6-outcome.ts](../src/shared/phase6-outcome.ts) | Added in Phase 6 |
| [src/shared/portable-model.ts](../src/shared/portable-model.ts) | Modified existing local file |
| [src/shared/research.ts](../src/shared/research.ts) | Modified existing local file |
| [src/shared/shadow-metrics.ts](../src/shared/shadow-metrics.ts) | Added in Phase 6 |
| [src/worker/guard/sharding-simulator.ts](../src/worker/guard/sharding-simulator.ts) | Added in Phase 6 |
| [tests/fixtures/sqlite-guard.ts](../tests/fixtures/sqlite-guard.ts) | Added in Phase 6 |
| [tests/phase6/shadow.spec.ts](../tests/phase6/shadow.spec.ts) | Added in Phase 6 |
| [tests/unit/phase6.test.ts](../tests/unit/phase6.test.ts) | Added in Phase 6 |
| [tsconfig.phase6.json](../tsconfig.phase6.json) | Added in Phase 6 |
<!-- PHASE6_FILES_END -->

## B–C. Experiments, provenance and failures

[Adversarial results](LAVAGUARD_PHASE6_ADVERSARIAL_RESULTS.md) account for 44 initiated cases: 35 browser and nine API cases, 43 completed harness cases and one retained initial cancellation failure. Recovery is a separate attempt. Twenty-one rings completed; incomplete/unknown attempts earn no classifier credit. Thirty-four private declared-bot exports contain 21 eligible and 13 incomplete captures. There are 18 declared family labels with shared lineage; seeds/modes are not independent authors or people. External vision/LLM agents were not run.

Three sets of immutable source manifests/checkpoints preserve the initial 6101 run, its recovery and additional 6102 cases. A separately retained load failure expected external slow streaming to return 400 but observed a local transport 500. The final load suite validates the actual reader directly inside workerd and reports the external bridge limitation openly. An early SQL test adapter lacked the cursor `toArray` method; fixing the adapter let the unchanged RateLimiter's stale-alarm test execute. A TypeScript callback annotation and an unused local variable were also corrected during implementation. No test was weakened to conceal a product failure.

## D–E. Data and models

The existing Phase 5 dataset hash/counts remain unchanged: 30 bots, 20 eligible, 10 incomplete, zero human attempts/codes. No actual application cohorts were formed, no application model was fit and no final application cohort was evaluated. New Phase 6 bot exports/derived views are stored separately and remain ignored. Explicitly synthetic fixture labels never enter either dataset as real people.

Twelve views per new export yielded 408 dependent perturbations with zero nonfinite features. Dynamic targets were observed on 34 traces; 32 had switches. [ML results](LAVAGUARD_PHASE6_ML_RESULTS.md) document nuisance sensitivity and the translation/scale limitations. Logistic, forest, histogram boosting and anomaly engineering paths ran on synthetic fixtures, alongside six negative controls and nested environment comparisons. No genuine-human accuracy, application probability/calibration, fairness or generalization is reported.

## F. Security boundary

Plausible fabricated client aggregates obtained options without visiting the ring; credential-free sessions remained unauthenticated. Clearance is not identity or humanity. New browser tests corrupt an actual assertion signature, confirm failure and one-use consumption, and retain keyboard/no-WebGL passkeys with positive automation flags. [Security/accessibility review](LAVAGUARD_PHASE6_SECURITY_ACCESSIBILITY.md) explains privacy, withdrawal, advisory authority and rollback limits.

## G–H. Performance and architecture

[Inference](LAVAGUARD_PHASE6_INFERENCE.md) distinguishes Node, actual browser and local workerd measurements. Pinned registry Node p50/p95/p99 was about 0.0012/0.0015/0.0031 ms. Prepared shadow workerd HTTP was about 9.159/10.373/10.554 ms per request containing 1000 observations plus wrapper overhead. Actual edge CPU is unavailable; process CPU/RSS is aggregate host data. The before/after runs differ in contention, so no causal edge speedup is claimed.

[Scaling](LAVAGUARD_PHASE6_SCALING.md) records fresh-state loads at 1/4/16/64/128 callers, deliberate 503 backpressure, one-winner redemption, recovery, SQL/metrics/process measurements and the external slow-stream limitation. Sequential Node 1/4/16-shard workloads preserve the tested one-use semantics; public routing and multiplied global caps are unresolved for a real cutover. Existing global Challenge/Session/User objects remain unchanged. Ten-thousand-row index tests are not ten-thousand-user support.

## I–J. Privacy, accessibility and commands

The complete [verification artifact](../ml/artifacts/phase6-verification.json) records executed commands, exit codes, durations and log hashes. [Readiness](../ml/artifacts/phase6-readiness.json) is generated after checks finish. Historical screenshots/artifacts are preserved byte-for-byte by the verifier. Physical assistive/touch/pen hardware, independent humans and edge deployments remain untested.

<!-- PHASE6_TESTS_START -->
| Command | Result | Counts / scope |
| --- | --- | --- |
| `npm run check` | PASS; 0 skipped | 132 TS + 16 console + 2 storage tests |
| `npm run build -- --outDir .cache/phase6/verification-build` | PASS; 0 skipped | Isolated production build |
| `npm run test:ml` | PASS; 0 skipped | 46 Python tests |
| `npm run test:research` | PASS; 0 skipped | 23 importer assertions |
| `npm run test:environment` | PASS; 0 skipped | 10 controlled browser probes |
| `npm run test:e2e` | PASS; 0 skipped | 30 browser cases |
| `npm run test:enforce` | PASS; 0 skipped | 8 browser cases |
| `npm run test:enforce [LAVAGUARD_RESEARCH=1]` | PASS; 0 skipped | 8 browser cases |
| `npm run test:hardening` | PASS; 0 skipped | 8 browser cases |
| `npm run test:phase6` | PASS; 0 skipped | 5 browser cases |
| `npm audit --audit-level=low` | PASS; 0 skipped | No vulnerabilities at low-or-higher audit threshold |

Total distinct unit/integration/browser tests: **255**; importer checks and environment probes are additional. Counts exclude repeated verification runs.
<!-- PHASE6_TESTS_END -->

```powershell
npm run phase6:verify
npm run phase6:adversarial
npm run phase6:adversarial -- --recovery
npm run phase6:adversarial -- --unseen-seed
npm run phase6:features
npm run phase6:ml
npm run phase6:registry
npm run phase6:benchmark
npm run phase6:sharding
npm run phase6:load
npm run phase6:view
node scripts/phase6/report.mjs
node scripts/check-publish.mjs
```

The verifier runs check/build/Python/importer/environment/browser/enforcement/research-enforcement/hardening/Phase-6/audit checks using isolated test state, including the existing dedicated E2E reset path. It preserves the owner's pre-run approved PNG bytes and historical Phase 5 artifacts. Experiments freeze assets/source and use only dedicated localhost ports 8806–8809; occupied ports fail instead of taking over another server. Reports retain failures; reruns are new evidence, not silently fresh successes.

## K–M. Completion, blockers and release decision

Locally implemented engineering is ready for review subject to the disclosed development transport limitation and final verification results. Consenting independent human data, matched acquisition/accessibility study, representative physical devices, independently supervised evaluation, untouched prospective application cohorts, external security/accessibility review and real edge CPU/capacity remain unavailable. External model credentials/calls, staging infrastructure, spend and any migration/deployment require explicit owner approval. No such approval is assumed or requested for this local handoff.

[Phase 7 prerequisites](LAVAGUARD_PHASE6_ROADMAP.md) define the exact NO-GO gates, MODEL OFF first and a separately owner-approved GUARD OFF rollback that retains WebAuthn and rate protections. **No push, PR, commit, merge, deployment, production ML activation, monitoring launch, paid service call or participant recruitment occurred.**
