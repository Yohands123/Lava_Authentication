# Phase 5 engineering handoff ? October 18, 2026

> **Local testing follow-up:** the later owner-requested reusable server and automation console are documented in [the testing guide](LAVAGUARD_LOCAL_TESTING.md) and [its verification report](LAVAGUARD_LOCAL_TESTING_RESULTS.md). The 59-file inventory and test counts below describe the original Phase 5 engineering handoff; the follow-up does not change its study dataset.

## A. Implementation summary

**ENGINEERING_READY_RESEARCH_DATA_PENDING** describes engineering readiness for review. **NOT_READY_NO_OPT_IN_DATA** describes the empirical research state. The existing Phase 4 auth/UI/robust12 implementation and starter were extended into an operational local research system. No real volunteers were collected; no application classifier was fitted or promoted. All work is local and uncommitted on `feature/lavaguard-phase5`, based on `8fc9eb0`.

Delivered strict v3 provenance, optional bounded collection, actual browser automation, exact shared features, leakage-aware frozen cohorts, three classifier baselines, independent calibration, final-evaluation guards, development comparisons, disabled portable inference, withdrawal and documentation. This work creates no remote PR or deployment. Original approved images, lava dynamics, ring results and passkey protections are preserved.

## B. Every changed file

Private generated captures/records/manifests/reports are intentionally excluded from this publishable source inventory and remain in ignored `ml/private/phase5/`. No private filenames or study codes appear below. Six incidental regenerated UI screenshots were restored to their original bytes; no screenshot asset is changed.

| File | Change | Role |
| --- | --- | --- |
| [CLAUDE.md](../CLAUDE.md) | Modified | Records the current owner-authorized Phase 5 scope and external-action limits. |
| [PROGRESS.md](../PROGRESS.md) | Modified | Records verified Phase 5 engineering completion and pending research. |
| [README.md](../README.md) | Modified | Replaces starter-only claims with current evidence and links; keeps all original/result images. |
| [docs/LAVAGUARD_DATASETS.md](../docs/LAVAGUARD_DATASETS.md) | Modified | Adds current v3 private-data lineage and distinguishes historical public-corpus results. |
| [docs/LAVAGUARD_HUMAN_STUDY.md](../docs/LAVAGUARD_HUMAN_STUDY.md) | Modified | Points the historical guide to the current consent/import/withdrawal protocol. |
| [docs/LAVAGUARD_PHASE5_IMPLEMENTATION.md](../docs/LAVAGUARD_PHASE5_IMPLEMENTATION.md) | Modified | Preserves the supplied starter as explicitly superseded historical documentation. |
| [ml/phase5.py](../ml/phase5.py) | Modified | Keeps the starter API/entry point while delegating to the strict pipeline. |
| [ml/test_phase5.py](../ml/test_phase5.py) | Modified | Preserves the six starter test intentions using the current strict schema. |
| [package.json](../package.json) | Modified | Adds reproducible Phase 5 capture, evaluation, tests, benchmark and withdrawal commands. |
| [scripts/check-consent-import.mjs](../scripts/check-consent-import.mjs) | Modified | Keeps the old check command working by delegating to the current strict checks. |
| [scripts/import-consenting.mjs](../scripts/import-consenting.mjs) | Modified | Strict CLI entry point; explicit inputs, validation-only and manifest-backed v2 migration. |
| [src/client/guard/lab.ts](../src/client/guard/lab.ts) | Modified | Integrates the recorder and controls while preserving existing plots and analysis. |
| [src/client/guard/observer.ts](../src/client/guard/observer.ts) | Modified | Adds optional disclosed cadence and live local target callback during active capture. |
| [src/client/guard/session.ts](../src/client/guard/session.ts) | Modified | Snapshots preparation, cancellation, expiry, network failure and completion research outcomes. |
| [src/client/main.ts](../src/client/main.ts) | Modified | Wires Lab lifecycle/capture callbacks into the existing application. |
| [tests/e2e/research.spec.ts](../tests/e2e/research.spec.ts) | Modified | Actual local consent-before-capture, v3 provenance, cancellation/grouping, export/delete and late-consent checks. |
| [docs/LAVAGUARD_PHASE5_ARCHITECTURE.md](../docs/LAVAGUARD_PHASE5_ARCHITECTURE.md) | New | Explains the implemented schema, feature, cohort, modeling and inference design. |
| [docs/LAVAGUARD_PHASE5_DATA_COLLECTION.md](../docs/LAVAGUARD_PHASE5_DATA_COLLECTION.md) | New | Documents local consent, device declarations, capture/import, retention and withdrawal. |
| [docs/LAVAGUARD_PHASE5_HANDOFF.md](../docs/LAVAGUARD_PHASE5_HANDOFF.md) | New | This complete A?J handoff and changed-file inventory. |
| [docs/LAVAGUARD_PHASE5_ML_RESULTS.md](../docs/LAVAGUARD_PHASE5_ML_RESULTS.md) | New | Reports actual data, browser failures, experiments, costs and exact test results. |
| [docs/LAVAGUARD_PHASE5_ROADMAP.md](../docs/LAVAGUARD_PHASE5_ROADMAP.md) | New | Maps Phase 5A?5M and gives prioritized Phase 6 acceptance criteria. |
| [docs/LAVAGUARD_PHASE5_SECURITY.md](../docs/LAVAGUARD_PHASE5_SECURITY.md) | New | Reviews authentication boundaries, forgeability, privacy, deletion coverage and limits. |
| [ml/artifacts/phase5-capture-initial.json](../ml/artifacts/phase5-capture-initial.json) | New | Preserves checkpointed initial browser failures and the uncheckpointed interruption disclosure. |
| [ml/artifacts/phase5-capture-recovery.json](../ml/artifacts/phase5-capture-recovery.json) | New | Three successful new attempts after fixing the harness. |
| [ml/artifacts/phase5-capture.json](../ml/artifacts/phase5-capture.json) | New | Aggregate reconciliation: thirty measured captures, including completed/incomplete and protocol outcomes. |
| [ml/artifacts/phase5-development-smoke.json](../ml/artifacts/phase5-development-smoke.json) | New | Synthetic-only ablation/family-fold execution counts, no human accuracy claims. |
| [ml/artifacts/phase5-import-check.json](../ml/artifacts/phase5-import-check.json) | New | Synthetic-only seventeen-check importer audit. |
| [ml/artifacts/phase5-inference-performance.json](../ml/artifacts/phase5-inference-performance.json) | New | Actual measured local synthetic inference/extraction costs with limitations. |
| [ml/artifacts/phase5-perturbations.json](../ml/artifacts/phase5-perturbations.json) | New | Aggregate bot-capture sensitivity across twelve derived views per attempt. |
| [ml/artifacts/phase5-readiness.json](../ml/artifacts/phase5-readiness.json) | New | Machine-readable engineering readiness, data insufficiency, counts and verification status. |
| [ml/check_phase5_development.py](../ml/check_phase5_development.py) | New | Reproduces five ablations and twenty family folds using only synthetic fixtures. |
| [ml/generate_phase5_fixture.py](../ml/generate_phase5_fixture.py) | New | Generates an explicit synthetic portable-model Python golden parity fixture. |
| [ml/phase5_pipeline.py](../ml/phase5_pipeline.py) | New | Audits readiness, freezes cohorts, isolates final access and writes private disabled candidates/reports. |
| [ml/study_data.py](../ml/study_data.py) | New | Strict derived schema, integrity/duplicate/revocation audits and connected grouped splits. |
| [ml/study_experiments.py](../ml/study_experiments.py) | New | Training-only development ablations, nuisance controls, connected family holdout and private reliability SVG. |
| [ml/study_models.py](../ml/study_models.py) | New | Fixed logistic/forest/boosting baselines, diagnostic anomaly model, calibration, metrics and costs. |
| [ml/study_test_fixtures.py](../ml/study_test_fixtures.py) | New | Explicitly synthetic integrity rows; never real participant evidence. |
| [ml/study_withdraw.py](../ml/study_withdraw.py) | New | Dry-run-first local withdrawal, revocations, derived-copy cleanup and candidate invalidation. |
| [ml/test_study_pipeline.py](../ml/test_study_pipeline.py) | New | Corruption, leakage, calibration isolation, insufficient-data, metrics and withdrawal regression tests. |
| [scripts/benchmark-phase5.mjs](../scripts/benchmark-phase5.mjs) | New | Synthetic local cold/warm inference, extraction, bundle and noisy heap measurements. |
| [scripts/check-study-import.mjs](../scripts/check-study-import.mjs) | New | Seventeen isolated importer checks without touching actual study data. |
| [scripts/phase5-capture.mjs](../scripts/phase5-capture.mjs) | New | Actual localhost browser movement/export and separate clearance/options/session measurements. |
| [scripts/phase5-experiments.mjs](../scripts/phase5-experiments.mjs) | New | Private matched perturbation vectors and public aggregate descriptive sensitivity evidence. |
| [scripts/phase5-generators.mjs](../scripts/phase5-generators.mjs) | New | Seeded realistic automation families and related cadence/scale/replay lineage. |
| [scripts/phase5-runtime.ts](../scripts/phase5-runtime.ts) | New | Bundles the exact shared schema/extractors/estimators for local research tools. |
| [scripts/python-local.mjs](../scripts/python-local.mjs) | New | Runs the project virtualenv correctly on Windows and Unix npm shells. |
| [scripts/study-import.mjs](../scripts/study-import.mjs) | New | Atomic import, private raw/derived lineage, conflicts, exclusions, withdrawal and existing-manifest integrity. |
| [scripts/summarize-phase5-capture.mjs](../scripts/summarize-phase5-capture.mjs) | New | Reconciles this initial/recovery evidence without hiding failed attempts. |
| [src/client/guard/research-controls.ts](../src/client/guard/research-controls.ts) | New | Functional local Lab notice, device/provenance form, session export and withdrawal controls. |
| [src/client/guard/research.ts](../src/client/guard/research.ts) | New | Consent snapshot, memory-only bounded session recorder and separate research attempt IDs. |
| [src/shared/experimental-features.ts](../src/shared/experimental-features.ts) | New | Sixteen finite experimental temporal/dynamic-response descriptors and acquisition diagnostics. |
| [src/shared/portable-model.ts](../src/shared/portable-model.ts) | New | Strict disabled JSON candidate, prepared observe-only inference and uncertain safe fallbacks. |
| [src/shared/research-perturbations.ts](../src/shared/research-perturbations.ts) | New | Deterministic cadence, geometry, timing, jitter and sample-count counterfactual views. |
| [src/shared/research.ts](../src/shared/research.ts) | New | Exact versioned consent export/derived schema, normalization, validation and path signatures. |
| [src/worker/guard/research-estimator.ts](../src/worker/guard/research-estimator.ts) | New | Unused manual/offline integration seam; no deployed route loads Phase 5 artifacts. |
| [tests/fixtures/phase5-portable.json](../tests/fixtures/phase5-portable.json) | New | Explicit synthetic Python golden model/vectors; no real study evidence. |
| [tests/fixtures/study.ts](../tests/fixtures/study.ts) | New | Explicit synthetic automation export for schema/importer tests. |
| [tests/unit/portable-model.test.ts](../tests/unit/portable-model.test.ts) | New | Python parity, off/OOD/device/withdrawal/version/finiteness fallbacks and no activation. |
| [tests/unit/research-schema.test.ts](../tests/unit/research-schema.test.ts) | New | Consent/schema, finite features, invariance/perturbation and recorder lifecycle tests. |

Follow-up implementation and current verification: [Automation Environment Evidence](LAVAGUARD_AUTOMATION_ENVIRONMENT.md). Browser environment hints now have a separately versioned advisory assessment with zero behavioral/enforcement contribution; actual coverage and synthetic shortcut diagnostics are documented there. Original counts in this handoff remain the historical Phase 5 baseline.

## C. ML architecture

Explicit pre-attempt consent ? bounded local memory ? manual export ? exact shared TypeScript validation/extraction ? canonical private records/hash manifest ? connected participant/family/session/run/replay cohorts ? fit-only preprocessing/models ? separate calibration/threshold ? explicit locked final evaluation ? private disabled candidate ? manual observe-only inference. Acquisition metadata and identifiers never become predictors. Default fitting does not access the final feature matrix. Detailed algorithms, feature versions, fixed parameters and serialization are in [architecture](LAVAGUARD_PHASE5_ARCHITECTURE.md).

## D. Dataset audit

Genuine human participants/attempts: **0/0**. Declared browser automation: **30 attempts**, **12 declared families**, **20 eligible completed attempts across 8 families**, **10 incomplete exclusions**. Invalid rows, duplicate IDs/vectors/paths and conflicting labels: **0**. Dataset `phase5-b384bc4f27a9dc32`; no cohorts were formed and no independence success is claimed without humans. Known source/run/replay relationships are preserved for future grouping. Tests use generated human-shaped fixture labels only and never contribute to these counts.

## E. Model comparison

Logistic regression, random forest, histogram gradient boosting and diagnostic Isolation Forest execute reproducibly on synthetic integrity inputs. Five ablations and 20 development family folds execute. Genuine application accuracy, human acceptance/false flags, real calibration, unseen-person generalization and device performance are **unavailable**. The pipeline stops before fitting on the real bot-only dataset. There is no invented winner or deployable application model. Node costs and fixed historical-model perturbation deltas are descriptive engineering measurements, not evidence of human detection.

## F. Tests and executed evidence

**196 tests passed**: 110 TypeScript, 37 Python, 29 shadow/browser, 6 normal enforce, 6 isolated research enforce, 8 hardening. Zero final test failures/skips. An additional **17 isolated importer checks** passed. The complete list of commands, profiles, actual capture failures/recovery, synthetic-development execution and benchmark values is in [measured results](LAVAGUARD_PHASE5_ML_RESULTS.md). `npm audit` found zero vulnerabilities. Source/private-data/secret-pattern and local link/image checks are recorded in the [readiness artifact](../ml/artifacts/phase5-readiness.json).

The initial automation harness had three failures among 30 initiated attempts. Three recovery attempts succeeded; all 33 initiated attempts remain accounted for. Thirty retained captures yielded 20 protected-options HTTP 200 responses, 10 HTTP 403 responses, and 30 unauthenticated session HTTP 401 responses. Incomplete/error attempts are not bot-detection successes. Required tests were not weakened to hide these outcomes.

## G. Security and privacy

Authentication routes, challenge/clearance protocol, origin/RP/user-verification/signature checks, secure randomness, cookies and production flags are unchanged. The new Worker seam is unused. Phase 5 estimates have only `observe` authority; missing/stale/revoked/malformed/OOD/unsupported/numerically unstable evidence returns uncertain null. No model can authorize sign-in or permanent BLOCK. Production guard/ML/metrics/Lab stay off. No push, PR, deployment, real-person recruitment or production collection occurred.

Research data is local and opt-in before capture; raw samples never enter a new API. Deletion clears supported owned copies and invalidates candidates, with revocations written first and final-use lock preserved. Arbitrary external downloads/backups and unknown formats need manual follow-up. Motion and codes can be identifying; hashes do not prove truthful consent or anonymous participants. Full [security review](LAVAGUARD_PHASE5_SECURITY.md).

## H. Engineering trade-offs

One shared extractor avoids divergent Python/browser feature meanings. Existing sklearn histogram boosting avoids another dependency. Logistic is the only portable model; forests/boosting remain offline comparisons. No deep sequence architecture, online adaptation or deployed candidate loader was added without data. Hash-based group assignment deliberately fails rather than reshuffling to manufacture class balance. Empty traces are excluded from replay signature linking because trivial absence of movement is not replay evidence.

Cadence features, nearest-bubble target proxies, browser scheduling, self-reported labels, bot-family taxonomy and prototype calibration can bias results. Attempt-level Wilson intervals do not provide independent-person population coverage. OOD uses conservative observed fit ranges, not a certified detector. Memory/timing measurements are local and noisy. The operator-controlled final lock supports workflow discipline but cannot replace preregistration and independent review. Future custom copies outside supported private formats remain governance debt.

## I. Remaining research blockers

An approved prospective study, enough genuine independent participants, representative input devices, accessible/abandoned cases, supervised label confidence, matched acquisition, independent generator implementations/runs, prospective untouched cohorts, powered uncertainty and external security/accessibility review remain required. No code change can replace those observations. Touch/pen/assistive physical hardware and edge CPU were not available as real validation targets in this work.

## J. Phase 6 readiness

The collection/import, provenance, grouped evaluation, calibration, portable parity, withdrawal and adversarial controls are ready for engineering review and future approved use. Empirical model promotion and staging are blocked by evidence and approval requirements. Priorities and measurable acceptance criteria are in [Phase 6 roadmap](LAVAGUARD_PHASE5_ROADMAP.md): approve study/governance; gather audited independent data; preregister/freeze cohorts; compare without final leakage; independently validate security/accessibility; measure real edge costs; then request a concrete staging decision. There is no automatic merge, release or enforcement step.
