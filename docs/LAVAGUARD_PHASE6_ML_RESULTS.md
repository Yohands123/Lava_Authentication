# Phase 6 ML, dynamic-response and leakage results

**MODEL_NOT_VALIDATED_FOR_PRODUCTION.** [Actual-count audit and engineering controls](../ml/artifacts/phase6-ml.json); [derived-view results](../ml/artifacts/phase6-perturbations.json).

The original Phase 5 dataset is unchanged: 30 declared bot attempts, 20 eligible, 10 incomplete, zero declared human attempts/codes and zero vetted human participants. Its byte hash remains `b384bc4f27a9dc321f8b29f0d62ecc827e0fbad497aad2b6699b4cd44c9b0425`. No application model was trained, no application final cohort was accessed and no production candidate was promoted. Genuine-user false positives, application calibration, unseen-person generalization and fairness remain unavailable.

## New data and features

Phase 6 retained 34 strictly validated, automation-labeled browser exports separately: 21 eligible and 13 incomplete. They are not appended to Phase 5. Existing consent, normalization, generator, run/session and replay lineage remains attached. Private `records.jsonl`, manifest and perturbation sidecar contain derived diagnostics; they are not a replacement human/bot training corpus.

`lava-dynamic-response-v4` adds a separate six-field diagnostic: target coverage, target-switch count, subsequent steering response share, median response fraction, reacquisition share and unanswered-switch share. A response requires a later observation steering toward the same declared target after its identity changes. Missing targets and degenerate/invalid timing yield finite zeros with coverage zero. Samples are capped at 1024. The old robust12 and response-v3 meanings are unchanged.

All 34 traces had target observations and 32 had observed switches. Twelve derived views per trace produced **408 views**, with no nonfinite feature views. All 34 six-point views were explicitly insufficient. These views are dependent transformations, not fresh people or independent bot trials. Cadence and sample count materially affect target switches/derivatives; the v4 fixed ring-normalized reacquisition distance is not arbitrary-scale invariant. Translation on pathological/nearly degenerate paths can expose quantization differences in existing robust descriptors; the maximum observed robust translation delta was 0.016129. This failure case is retained rather than generalized into an invariance claim.

Targets are nearest observed bubbles, not verified intent. Browser target state, pointer data, timestamps and canvas pixels are forgeable. No visual perturbation or extra target-chasing burden was added to normal authentication. The v4 sidecar is a diagnostic extension; baseline Phase 5 portable candidates continue to support their existing versioned feature lists. Adding v4 to a future fitted candidate requires explicit schema/matched-data review.

## Synthetic engineering comparisons

The existing 180 generated integrity fixtures exercised regularized logistic regression, random forest, histogram gradient boosting and human-shaped-fixture-only Isolation Forest. The anomaly model remains an outlier diagnostic, not a bot probability. Model fit/serialization/native-memory limitations are recorded; no pickle is deserialized in Workers. Deep models are **NOT_JUSTIFIED_WITHOUT_DATA**.

Six separately named controls execute on fixed grouped synthetic development splits: behavior, behavior plus response-v3, cadence only, browser config only, source ID only and shuffled fitting labels. Preprocessing is fitted on training only; calibration/thresholds use separate development calibration. Source categories are learned from training only. The constant-cadence control produces constant scores. Shuffled fitting labels test sensitivity to broken label relationships; their observed score range is descriptive, not a claim of population chance accuracy. No source or browser-control predictor enters the runtime.

Behavior-only, environment-only and combined logistic comparisons also execute using **only primary synthetic fitting groups**, with separate nested development splits. Their status is `DIAGNOSTIC_ONLY_NOT_VALIDATED`. Existing Phase 5 family, calibration isolation and final-cohort guards remain covered by the regression suite. New live seed 6102 is additional declared-bot engineering evidence; it does not establish independent-human or adaptive-agent generalization.

Connected participant/family/session/run/replay grouping remains authoritative. A new test connects a derived view across two frozen cohorts and confirms rejection. No split is shuffled until favorable results appear. Application evaluation with zero humans stops gracefully instead of inventing a human class. Environment hints, declared devices/acquisition and labels remain zero-authority context; availability itself can be a shortcut.

## Study and statistical gate

Future participants must consent before capture, may decline research independently of authentication, and must have accessible/no-WebGL passkey alternatives. Preregister device, acquisition, browser takeover and remote/virtual-browser conditions; record task time, retries, abandonment, completion and accessible-route use. Preserve participant grouping across attempts/devices, and freeze prospective cohorts before model comparison. Recruitment, supervision, retention and independent evaluation are not performed here.

For a **conditional planning example only**, zero false flags across 299 genuinely independent prespecified participant observations gives the one-sided exact binomial 95% upper bound `1 - 0.05^(1/299)`, approximately 1%. This is not an observed result, an enrollment recommendation or a guarantee. Repeated attempts do not provide 299 independent people; multiple conditions, selective dropout and representative accessibility/device coverage need a separate powered study and multiplicity plan.

```powershell
npm run phase6:features
npm run phase6:ml
npm run test:ml
```
