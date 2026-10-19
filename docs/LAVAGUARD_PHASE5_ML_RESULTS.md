# Phase 5 measured results — October 18, 2026

**Engineering: ENGINEERING_READY_RESEARCH_DATA_PENDING. Data: NOT_READY_NO_OPT_IN_DATA.**

The local Phase 5 implementation is ready for engineering review. Application accuracy, population false-positive performance, calibration validity and deployment fitness are **unavailable** because genuine consenting application-human data is absent. Passing code tests is not scientific validation. Nothing was pushed or deployed; production ML remains off.

Follow-up: [Automation Environment Evidence](LAVAGUARD_AUTOMATION_ENVIRONMENT.md) adds versioned advisory diagnostics, ten measured browser configurations and separate shortcut comparisons. The measurements below describe the original Phase 5 run; no new human data or deployable model was created by that extension.

## Actual dataset audit

| Measurement | Actual count/status |
| --- | --- |
| Genuine human participants / attempts | **0 / 0** |
| Retained actual-browser automation attempts | **30** |
| Declared generator families, all / with eligible attempts | **12 / 8** |
| Completed, eligible automation attempts | **20** |
| Incomplete attempts retained and excluded from fitting | **10** |
| Invalid rows / duplicate IDs / duplicate vectors / duplicate paths / conflicting labels | **0 / 0 / 0 / 0 / 0** |
| Training/calibration/final cohorts | Not formed: no human data |
| Application model fitting / final evaluation / promotion | Not performed / not performed / disabled |

Dataset version: `phase5-b384bc4f27a9dc32`. Exact byte hash is in the private manifest and aggregate readiness artifact. Counts describe declarations and known generator relationships, not verified independent people or independent bot authors. Case types, seeds, cadence variants and retries do not multiply independent families. No public corpus row or synthetic unit-test human label was imported into this dataset.

The strict importer accepted 20 and retained 10 incomplete exports, with zero invalid records. Validation-only ran first and did not write data. Existing private Phase 4 files were not migrated or overwritten. Raw and derived rows remain ignored under `ml/private/phase5/`.

## Browser evidence and failed attempts

Fifteen local case types at seeds 1001/1002 produced the 30 retained captures. They used actual frontend instrumentation, Ghost Cursor paths, real Puppeteer movement, Playwright movement, DOM events, reactive target feedback and shared-lineage cadence/scale/replay controls. Twenty completed and received CLEAR plus protected options HTTP 200 in the ordinary enforce/shadow-ML profile. Ten remained incomplete and received options 403. All 30 measured session requests returned **401**, with no authenticator supplied. This demonstrates that clearance/options access remains separate from passkey authentication; it is not evidence that ML detected the automated attempts.

The first run started 30 attempts but had **three harness failures**: two cancellation/render races and a final evaluation response disconnection. That run exited 1. Failed attempts have unknown classification; they were not counted as successful detection. The corrected harness retried the three affected case/seed pairs and exited 0 with three completed captures. Thus **33 initiated attempts, 30 retained measured captures, three failed harness attempts**. Original checkpoint and recovery evidence remain separately available. The harness now handles completion during cancellation and attaches response rejection handling immediately.

Public aggregate evidence: [capture summary](../ml/artifacts/phase5-capture.json), [initial failed run](../ml/artifacts/phase5-capture-initial.json), [recovery](../ml/artifacts/phase5-capture-recovery.json).

## Models and research experiments

| Candidate | Implementation exercised | Real application accuracy/calibration |
| --- | --- | --- |
| Regularized logistic regression | Fit, calibration, serialization and Python/TS parity on synthetic fixtures | Unavailable: zero real humans |
| Random forest | Fixed fit/calibration/evaluation path on synthetic fixtures | Unavailable |
| Histogram gradient boosting | Existing sklearn alternative to extra boosting dependencies, exercised on synthetic fixtures | Unavailable |
| Human-only Isolation Forest | Outlier diagnostic exercised on synthetic fixtures | Unavailable; never a bot probability |
| Deep sequence model | Deferred until independent sequence data justifies it | Not run |

Synthetic development smoke executed **five feature ablations and 20 leave-one-family-out folds**, zero unavailable folds, in 119.82 seconds. Its 180 generated fixture rows are engineering inputs only; no resulting synthetic accuracy is published as study evidence. The current application dataset triggers the data-readiness stop before fitting. No application candidate or final-cohort reliability curve is fabricated.

Twelve perturbation views were extracted for each of the 30 captured bot traces: original, three cadences, scale, translation, three reduced counts, timing jitter, spatial jitter and variable speed. **360 views**, zero nonfinite feature views, zero capped views; all 30 six-point views are explicitly insufficient. Scaling/translation yielded median maximum robust-feature change **0** and fixed-model score change **0**. Cadence16/32/64 median absolute fixed Phase 4 robust score deltas were **0.001423 / 0.002224 / 0.004717**; reduced-six was **0.067214** and variable speed **0.006715**. These are descriptive sensitivity measurements across bot captures using a frozen historical corpus candidate, not new model training, server verdicts, human false-positive rates or independent trials. See [perturbation artifact](../ml/artifacts/phase5-perturbations.json).

## Local inference costs

Node v24.13.0, Windows; synthetic disabled logistic fixture, 10,000 warm calls per path. Times vary by machine and concurrent work. These are neither Cloudflare CPU measurements nor browser frame-time claims.

| Path | p50 ms | p95 ms | p99 ms |
| --- | ---: | ---: | ---: |
| Existing legacy estimator | 0.0005 | 0.0009 | 0.0010 |
| Existing robust Phase 4 estimator | 0.0013 | 0.0024 | 0.0049 |
| Portable format, validation each call | 0.0040 | 0.0050 | 0.0081 |
| Prepared portable model | 0.0011 | 0.0013 | 0.0031 |

Synthetic JSON model: **2,051 bytes**. Complete bundled offline runtime: **31,104 bytes**, including shared extraction/validation; this is not an incremental deployed Worker size. Fresh Node module import **1.311 ms**, first inference **0.508 ms**, prepared batch of 10,000 **9.526 ms**. For 1,024 points, 500 iterations: robust extraction p50/p95 **0.145/0.202 ms**, response extraction **2.106/2.771 ms**. Observed heap delta **28,414,072 bytes** includes JIT/loop allocation/GC noise; it is not model-resident memory. Python candidate reports additionally measure fitting, single/batch inference, own-model serialization and traced Python allocations, excluding native allocations. [Full benchmark](../ml/artifacts/phase5-inference-performance.json).

## Executed checks

| Exact command/profile | Final outcome |
| --- | --- |
| `npm run check` | TypeScript checks and ESLint pass; **110 tests in 18 files passed** |
| `npm run build` | Vite production build passed; no deployment |
| `npm run test:ml` | **37 tests passed**, 0 failed/skipped |
| `npm run test:research` | **17 importer checks passed**, isolated synthetic storage |
| `npm run test:e2e` | **29 passed**, 3.6 minutes, 0 failed/skipped |
| `npm run test:enforce` | **6 passed**, 17.6 seconds |
| `$env:LAVAGUARD_RESEARCH='1'; npm run test:enforce` | **6 passed**, 16.7 seconds; research env removed afterwards |
| `npm run test:hardening` | **8 passed**, 19.5 seconds, including real provider dummy-key verification |
| `npm run ml:phase5` | Exit 0; `NOT_READY_NO_OPT_IN_DATA`, no fitting/promotion |
| `npm run ml:phase5:features` | 30 inputs, 360 finite descriptive views |
| `npm run ml:phase5:benchmark` | Completed synthetic local benchmark |
| `node scripts/python-local.mjs ml/check_phase5_development.py` | Passed; 5 ablations, 20 family folds, no application writes |
| `npm audit --audit-level=low` | **0 vulnerabilities** |

The synthetic development check was also executed through its source script path shown above. It is separate from the 37 unit tests. The original six starter tests remain represented in `ml/test_phase5.py` using the current strict schema. Original auth, replay and hardening tests were not weakened.

Initial failures were investigated: npm's Windows shell could not execute `.venv/Scripts/python`, now replaced for new Phase 5 scripts with a portable Node launcher; the capture races/disconnection were corrected and preserved above; a new empty-trace regression fixture accidentally reused a revoked study code and was corrected to test a separate non-revoked input. Empty captures from different labels now remain incomplete rather than being falsely treated as conflicting replays. No unresolved executable-test failure remains. Existing SQLite/terminal-color warnings are nonfatal.

The local publication scan reviewed **268 publishable files (239 text)**, checked **180 case-correct local links**, validated **8 required PNG screenshots**, and reported zero private-path, secret-pattern or broken-local-link findings. Remote links were not fetched during this local Phase 5 task. Raw private bot exports were checked against the strict schema before import.

Source review additionally preserves the approved images, shaders, ring geometry, bubble forces and result styling. Six regenerated visual fixtures were restored to their pre-run bytes because no result UI change was intended. Actual touch/pen/assistive hardware, low-end devices, independently supervised labels, real-human acquisition controls, population uncertainty, edge CPU and prospective final performance remain **untested/unavailable**.

See [complete handoff](LAVAGUARD_PHASE5_HANDOFF.md) for every changed file, security review, limitations and Phase 6 acceptance criteria. The [machine-readable readiness report](../ml/artifacts/phase5-readiness.json) records engineering completion separately from research readiness.
