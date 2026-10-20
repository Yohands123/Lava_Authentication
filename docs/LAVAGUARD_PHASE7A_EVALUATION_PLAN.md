# Phase 7A evaluation and final-access procedure

The executable entry is [ml/phase7a.py](../ml/phase7a.py). Default `npm run phase7:study` performs QA/readiness only. It does not train or evaluate final data. The current output is [readiness](../ml/artifacts/phase7a-readiness.json): zero genuine participants and null human FPR, accuracy and calibration.

## Future supervised local procedure

These steps require actual consent and approved study governance; they were not performed on people here.

1. Review the machine protocol, owner/applicable ethics approval, current source hash and acquisition settings before enrollment. Freeze the design and codes/families independently of scores. Record supervision and consent chronology prospectively; do not backfill it from verdicts.
2. Validate/export locally, inspect the preview, then explicitly import approved copies into the separate Phase 7 folder. Supply `supervision.json` using schema `lava-supervised-study-v1`, the exact protocol/dataset hashes, approval/ethics status and per-attempt metadata described below.
3. `npm run phase7:study -- --prepare-cohorts` proposes connected cohort assignments without model fitting/final prediction. It creates `cohorts.json` exclusively, never overwrites an existing freeze, and writes a private proposal. Review its hash, lineage and denominators. Put the reviewed cohort hash and each declared assignment into supervision.
4. `npm run phase7:study -- --development` fits only training/calibration cohorts after QA, source and sample gates. The fitting function receives no final rows. Review the private disabled candidate, candidate hash, calibration threshold and fixed baseline diagnostics. This step cannot promote a model.
5. Independently review the frozen candidate/threshold and put `frozenCandidateHash`, `frozenThreshold`, `independentEvaluationApproval: true` into the private supervision record. A script setting those fields is not independent evaluation or proof of truthful supervision.
6. Only then explicitly run `npm run phase7:study -- --evaluate-final`. An exclusive filesystem lock is reserved **before fitting or final-score access**. A crash, mismatch or failed run retains the lock. There is no reuse/force/reset flag. The lock is a workflow control, not protection from an administrator deleting files.

Supervision uses `approval: OWNER_APPROVED`, `ethicsReview: APPROVED` or `OWNER_DOCUMENTED_NOT_APPLICABLE`, exact `protocolHash`/`datasetHash`/`cohortHash`, and an `attempts` map keyed by private attempt ID. Each entry requires participant/session, current `consentStatus`, `beforeFirstSample: true`, ordered finite `consentMs <= captureStartMs <= firstSampleMs`, `arm` (pilot/prospective), device code, exact approved `appSourceHash` and declared cohort. A human declaration additionally requires `supervisedHuman: true`; automation requires script/source/model-family lineage. These are coordinator claims, not browser identity attestations. The pre-registration must resolve actual timestamp interpretation and independent supervision before collection.

## Analysis contract

Existing v3 validation checks finite features, timing problems, sample limits, quality, consent, unknown devices/labels, duplicates and withdrawals. Connected groups keep participant/session, shared device, bot family/seed/run/path, script/source/model and raw/normalized trace relatives out of separate cohorts. Pilot/prospective overlap, unmatched acquisition, missing consent/supervision, inconsistent frozen assignments, insufficient independent units, changed source, missing threshold/candidate pin or review prevent final evaluation.

Fit-only scaling, fixed seeds, separate calibration and the logistic/Random Forest/HistGradientBoosting implementations reuse Phase 5. Development calls now omit final rows entirely; final-enabled baseline calls still require both labels in every scored cohort. Primary final scoring rechecks the reviewed candidate hash and threshold. Unsupported devices or features outside the declared fitting support abstain; coverage/unknown outcomes are reported rather than treated as acceptance.

Report eligible attempt ROC-AUC, PR-AUC, Brier, calibration error, confusion counts, FPR/FNR and thresholds from the existing metric implementation. Report participant endpoint, missing-outcome range, participant bootstrap intervals, per-device and per-declared-environment results separately. An all-zero bootstrap interval is not a zero-risk claim: the independent-unit one-sided upper bound and representativeness caveat remain necessary. Very small strata, correlated devices and selective dropout require independent review before any disclosure or population inference.

Environment-only/behavior-only/combined comparisons reuse isolated development diagnostics from primary fitting groups; no final group becomes a predictor-selection source. Counterfactual hint changes measure shortcut sensitivity, not an intervention on real people. No hint can refuse passkeys or establish AI identity. No new synthetic fixture enters the application dataset. The full synthetic pipeline test uses an OS temporary directory, explicit fixture IDs and reduced fixture-only gates; its metrics are never published as application accuracy.

Actual representative human data, independent review, physical accessibility testing, external generalization and an approved release decision remain outstanding. Current model state is observe-only/off; no automatic ML FLAG/BLOCK or promotion is implemented by this workflow.
