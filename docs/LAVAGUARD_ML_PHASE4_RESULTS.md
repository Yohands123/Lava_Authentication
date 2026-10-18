# LavaGuard behavioral ML — Phase 4 results

The pipeline, preprocessing, inference and evaluation were improved and executed. No model was promoted. **Application deployment accuracy remains unvalidated:** there are zero consenting LavaGuard human rows and zero study participants available. The existing WebGL/stirring experience remains unchanged; raw research exports stay opt-in and local. Model output never substitutes for passkeys or proves physical human presence.

## Diagnosis: the earlier 687/777 → 92/777 result

The Phase 2 cadence experiment **refitted and recalibrated** models after interpolating traces to 32 ms. It did not measure the same fitted classifier before/after resampling. This distinction matters.

Phase 4 also perturbs the **fixed legacy artifact**, using the original 513-human/777-bot held-out groups and threshold 0.9:

| Fixed-model input | Human flags | Bot detections |
| --- | ---: | ---: |
| Original acquisition | 10/513 | 687/777 |
| 32-ms interpolated acquisition | **261/513** | 684/777 |
| Resampled, retaining original dtCv/pause/burst fields | 10/513 | 682/777 |

The fixed model's human false-positive rate rises from 1.95% to 50.88% under this change. The counterfactual timing restoration is a diagnostic, not physically valid new data. It strongly implicates acquisition timing shortcuts. In contrast, refitting after removing timing variation loses much of the original separability, explaining the earlier 92/777 detections. Neither experiment justifies enforcement.

Other shortcut risks remain: public circle tasks differ from moving wax, participant identity is absent, duration and derivative/count features reflect recording tools, source families correlate with labels, and trajectory-extent normalization differs from ring-diameter normalization. The >=12-point filter excludes 11 of 955 public human traces and 1,229 of 2,596 public bot traces. These selection/class-distribution differences must not be hidden behind an accuracy score.

## Robust shared preprocessing and features

`src/shared/robust-features.ts` defines `lava-robust-v2`, used unchanged by browser capture, explicit private imports, offline extraction and Worker validation. The v1 feature schema remains compatible; an optional independently versioned robust summary is added to local evaluation. OFF sends neither set of behavioral features.

V2 normalizes translation/isotropic coordinate scale by trajectory span, interpolates onto 64 relative-time positions, applies a three-point smoother, and extracts 12 bounded dimensionless features: path efficiency/length, speed variation/p95, acceleration/jerk p95, turn mean/p95, curvature p95, reversal/correction rates and relative pause share. Fixed-count rates replace raw event counts. No WebDriver, source, participant, label, pressure or capture-clock metadata enters this classifier.

This is **approximate** acquisition robustness, not sampling independence. Coarse samples lose information that interpolation cannot restore. Canonicalizing duration also discards physical timing that might distinguish some attacks. Shape similarity is not trusted recurrence; source paths and timestamps can be forged. The unchanged v1 extractor still supplies descriptive timing/reaction features, and existing bubble-response research measures corrections, target displacement, tracking error and response timing. No bubble-response human classifier is fitted without human target-response examples.

The bounded Worker parser rejects incomplete/nonfinite/out-of-range robust vectors and mismatched versions. Missing robust features, unknown model versions and unsupported touch/pen return no candidate risk, with explicit uncertainty. Out-of-training-range features are marked OOD and cannot trigger candidate model refusal in research. Trackpads cannot be distinguished reliably from mouse pointers; study device labels remain self reported.

## Fitting, calibration and independence

`scripts/extract-phase4.mjs` generated 2,681 feature rows with six acquisition variants from the permitted pinned DELBOT corpus, existing declared generators and 90 new synthetic held-out bot trajectories. Raw data is ignored/private; no raw corpus redistribution or new restricted dataset download occurred. Original deduplication and folder splits yield 1,028 fitting, 195 separate calibration and 1,290 held-out rows. Metadata/labels are not predictors. All variants from a trajectory stay with its original group.

Candidate models were fixed before evaluation:

- Log1p features → StandardScaler → balanced regularized logistic regression, **C=0.1**, then sigmoid calibration on separate folders.
- Existing 200-tree, depth-eight, minimum-leaf-five balanced Random Forest, with log-odds sigmoid calibration on those calibration folders.
- Human-only standardized Isolation Forest, reported as anomaly detection rather than calibrated automation probability.

The operating threshold uses calibration humans only, permitting at most 1% **empirical** false positives there. No held-out data selected a threshold, model or hyperparameter. Tests compare fixed candidates; the better-looking held-out result was not promoted. The target is not a statistical guarantee of <=1% application FPR. Public source-folder groups cannot establish participant independence, and confidence intervals below describe row counts rather than independent people.

No LightGBM, neural sequence model or external ML service was added. With no independent application training corpus and weak generalization, extra complexity is not justified. RF remains an offline comparison; its serialized model is roughly 857 KB versus a 2.7 KB portable logistic JSON artifact, with higher measured inference cost. Exporting a larger candidate would not repair forged telemetry or missing validation.

## Measured held-out model quality

Operating points use each candidate's calibration-only threshold:

| Metric | Robust logistic | Calibrated robust Random Forest |
| --- | ---: | ---: |
| Human accepted | 511/513 (99.61%) | 511/513 (99.61%) |
| Human false-positive rate | 2/513 (0.39%) | 2/513 (0.39%) |
| FPR Wilson 95% | 0.11–1.41% | 0.11–1.41% |
| Bot detections | 34/777 (4.38%) | 211/777 (27.16%) |
| Bot false-negative rate | 95.62% | 72.84% |
| Detection Wilson 95% | 3.15–6.05% | 24.15–30.39% |
| ROC AUC | 0.6026 | 0.9421 |
| PR AUC | 0.7700 | 0.9548 |
| Brier score | 0.3528 | 0.2081 |
| Ten-bin calibration error | 0.3510 | 0.3000 |

The calibrated scores transfer poorly even between these source folders. High ROC AUC does not establish an acceptable operating point. Logistic improves sampling/scale stability and lowers measured public-corpus false positives, while discarding much bot discrimination. It is not an overall validated accuracy improvement. RF detects more at this operating point but still misses most bots. Human Isolation Forest marks 81/513 held-out humans and 743/777 bots anomalous; this does not justify blocking anomalies.

Cross-device **folder proxies** for logistic: pc2 has one flag among 451 human rows (0.22%, Wilson 0.04–1.25%); pc2_pad has one among 62 (1.61%, Wilson 0.29–8.59%). No genuine LavaGuard mouse, trackpad, touch or assistive acceptance rate has been measured. These folders cannot substitute for independent participant/device trials.

## Perturbation and ablation experiments

Fixed robust logistic on the same held-out groups:

| Perturbation | Human flags | Bot detections | Median absolute score change |
| --- | ---: | ---: | ---: |
| Original | 2/513 | 34/777 | N/A |
| 16 ms cadence | 2/513 | 28/777 | 0.00172 |
| 32 ms cadence | 2/513 | 26/777 | 0.00335 |
| 64 ms cadence | 2/513 | 7/777 | 0.00789 |
| Isotropic scale ×2 plus translation | 2/513 | 34/777 | 0 |
| Deterministic 0.001-coordinate jitter | 2/513 | 32/777 | 0.00071 |

These interpolations are derived views of the same traces, not independent samples. Coarser acquisition still harms discrimination. The 1,024-point bound also truncates two long held-out traces in the 16-ms variant; that is an additional confound, not sampling invariance. Exact coordinate-scale parity is covered by unit tests.

Feature ablations refit/calibrate from the original fitting/calibration groups without changing the held-out set:

| Feature subset | Logistic human flags / detections | RF human flags / detections |
| --- | --- | --- |
| All twelve | 2/513; 34/777 | 2/513; 211/777 |
| Without derivative/magnitude features | 2/513; 29/777 | 2/513; 178/777 |
| Direction and efficiency only | 1/513; 0/777 | 8/513; 289/777 |
| Without reversal/correction rates | 2/513; 52/777 | 1/513; 138/777 |

No subset was selected from these held-out comparisons. Bubble-response contribution to human discrimination is **unavailable**, because human rows with moving targets are zero. The earlier 18-case synthetic responsiveness benchmark remains a useful engineering control; reactive bots can respond well and independent paths can align by chance. A supervised bubble-response model would currently manufacture evidence rather than validate humanity.

## Unseen generators and actual browser capture

Eleven leave-one-family-out experiments exclude the tested family from fitting/calibration, retain the same held-out humans and refit descriptive baselines. Do not pool those reused humans across folds. Full logistic/RF/anomaly counts and calibration curves are in `phase4-model-evaluation.json`.

| Held-out bot family | Logistic detected | RF detected |
| --- | ---: | ---: |
| DELBOT GAN | 113/697 | 185/697 |
| NaturalMouseMotion | 10/234 | 71/234 |
| pyhm | 0/55 | 6/55 |
| pynput | 81/381 | 94/381 |
| Local Bézier | 0/40 | 40/40 |
| Local circle | 0/1 | 0/1 |
| Local corrections | 0/40 | 0/40 |
| Local linear | 0/1 | 1/1 |
| Local lognormal proxy | 0/40 | 0/40 |
| Local randomized | 0/40 | 0/40 |
| Local variable speed | 0/40 | 0/40 |

Single-vector circle/linear groups reflect deduplication, not 40 independent runs.

New synthetic groups use seeds 1001–1030 and were excluded from all candidate fitting/calibration: actual Ghost Cursor paths (0/30 logistic detections), delayed reactive synthetic target tracking (30/30), and new variable-speed replay trajectories (30/30). These are declared synthetic bots, not human task samples. DELBOT-to-independent-generator transfer is separately reported as bot-only source transfer; it cannot yield a human FPR or replace a second independent human corpus.

The exact original StirMeter baseline was rerun on 2,591 normalized trajectories: its credit meter completed for 10/944 public human rows and 92/1,647 bot rows. These circle-task traces are generally too short to represent a full LavaAuth sign-in, so incomplete credit is not a human false positive and meter completion is not a classification probability or visual-ring result. The current StirMeter and physical interaction were preserved. Source artifacts: `phase2-stirmeter.json` and the rerun `scripts/research-benchmarks.mjs` output.

The real-Worker 12-family browser harness captured six completed Playwright-driven attempts through the **same browser/shared extractor**, with bounded real browser timing. `ml/score_browser.py` then scored the frozen candidate without fitting or threshold tuning. Five captures (random, Bézier, variable speed, corrections, lognormal) fell below its research threshold; the Ghost Cursor capture exceeded it. These actual captures show why passing a synthetic generator benchmark is not general resistance. All actual server decisions were advisory CLEAR, passkey options 200 and unauthenticated session 401. Incomplete rings have no evaluated capture and are not counted as detections. Artifact: `phase4-browser-model.json`.

## Worker inference, uncertainty and lifecycle

`src/worker/guard/risk-estimator.ts` returns a bounded risk score or null, calibration scope, high domain uncertainty, OOD/missing/unsupported-device indicators, model version, feature version and internal reason categories. Source-folder sigmoid calibration does **not** make the result a meaningful application probability. Inputs remain forgeable. Only the restricted Lab sees diagnostics; public responses do not reveal coefficients, scores or policy thresholds. Admin metrics store coarse deciles by model version with independent policy version and expiry.

V2 Worker inference uses the identical log1p/standardization/dot-product/calibration as Python. A declared-synthetic parity fixture matches to 12 decimal places. No model executes in the render loop or needs an external service. The selected model version can be rolled back independently of protocol policy. Unknown/missing features fail to an uncertain estimate, not an automatic behavioral ban.

Local Node timing, 10,000 warmed calls:

| Portable estimator | p50 / p95 / p99 ms |
| --- | ---: |
| Legacy logistic | 0.0005 / 0.0007 / 0.0012 |
| Robust logistic | 0.0012 / 0.0019 / 0.0032 |

Candidate JSON is 2,674 bytes; the benchmark bundle containing estimators/extractors is 11,911 bytes. Observed Node heap delta about 2.13 MB includes module import, benchmark allocations and JIT noise, not static model memory alone. Python tracked peak fitting allocation was about 0.40 MB logistic and 2.11 MB RF; tracemalloc misses some native allocations. Measured Python inference per held-out row was approximately 0.00149 ms and 0.0411 ms respectively on this run. These are local runtime measurements, not Cloudflare edge CPU guarantees. Artifact: `phase4-inference-performance.json`.

Lifecycle:

- OFF disables behavioral inference/enforcement; production is explicitly OFF and aggregate metrics disabled.
- SHADOW computes minimal aggregate outcomes while leaving access unchanged by ML.
- RESEARCH ENFORCE requires localhost or separately approved staging research; candidate OOD evidence cannot trigger candidate refusal.
- PRODUCTION ENFORCE has configuration support behind separate environment and explicit approval flags, all disabled in committed production settings. Current results do not justify enabling it.

No traffic-triggered fitting, automatic promotion or permanent movement-based ban was introduced. `LAVAGUARD_MODEL_VERSION` is an environment choice, not an online model selector. See [staging and rollback instructions](LAVAGUARD_STAGING.md).

## Genuine application data infrastructure and reproducibility

The explicit consenting importer now preserves both feature versions, source/consent/label provenance, participant study ID and declared device. It rejects invalid consent, unlabeled samples, unknown devices and nonincreasing timestamps. It never converts CLEAR or ring completion into a human label. `--validate-only` checks without writing rows. The positive importer smoke uses declared automation; four invalid variants are rejected and no study corpus is created.

`ml/train_application.py` requires at least eight consenting study participants, assigns three deterministic **participant-disjoint train/calibration/test cohorts**, checks label sufficiency and cross-cohort feature duplication, reports device strata and emits a private disabled review artifact only when fitting is possible. Participant codes are study-scoped and not persistent browser tracking. The current command reports **0 rows, 0 participants, unavailable**; no human measurements were invented. Actual recruitment/coordinator provenance and label review are still necessary; self reports are not attestations.

```powershell
# Existing permitted corpus/private normalized data must be present first.
npm run ml:phase4
.venv/Scripts/python ml/score_browser.py  # after the independent browser harness
node scripts/check-consent-import.mjs
npm run check
# When consenting exports actually exist:
npm run ml:import-consenting -- --validate-only ml/private/study-attempt.json
npm run ml:import-consenting -- ml/private/study-attempt.json
.venv/Scripts/python ml/train_application.py
```

The pinned corpus revision, license/integrity checks and privacy limits remain documented in `LAVAGUARD_DATASETS.md`. Seeds, fixed group membership, package versions, calibration bins, unseen-family metrics, perturbations, intervals and artifact defaults are recorded in JSON. Node 24, the pinned Python environment and lockfile reproduce the local workflow. Runtimes vary by machine. No raw trace, model label or device identity is silently collected in production.

Conclusion: the strongest supported improvement is a reproducible, versioned, more stable and uncertainty-aware research pipeline, together with evidence that **current models still do not justify enforcement on genuine users**. Keep them advisory; collect consenting application interactions with independent cohorts before considering model promotion. Protocol integrity, bounded abuse controls, optional independently validated escalation and mandatory WebAuthn remain separate defenses against spoofed behavioral inputs.

Executed verification: 86 TypeScript/unit tests including shared scaling/degeneracy, malformed/OOD/device handling, offline/Worker numerical parity and lifecycle approvals passed; two Python tests verified complete deterministic participant-disjoint cohorts using synthetic IDs only. Both typechecks, real ESLint, Python compile checks and build passed. The real-Worker/browser suites also passed; their full command counts and outcomes are in [Phase 4 security results](LAVAGUARD_PHASE4_RESULTS.md). The private application trainer ran and reported unavailable data instead of fitting fictional humans.
