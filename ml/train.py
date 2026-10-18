"""Offline experimental baselines. Never promotes or enables production inference."""
import hashlib
import json
import platform
import time
from pathlib import Path
import numpy as np
import sklearn
from sklearn.ensemble import IsolationForest, RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import average_precision_score, brier_score_loss, confusion_matrix, precision_recall_fscore_support, roc_auc_score
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

ROOT = Path(__file__).resolve().parents[1]
SEED = 20261017
# Exclude acquisition/trust/source metadata and application-only bubble response.
KEYS = ["efficiency", "speedP50", "speedP95", "speedCv", "accelP95", "decelP95", "jerkP95", "angularP95", "curvatureP95", "headingChangeMean", "dtCv", "pauseRatio", "bursts", "reversals", "corrections"]

def vector(row):
    return [row["features"][k] for k in KEYS]

def main():
    rows = [json.loads(line) for line in (ROOT / "ml/private/features.jsonl").read_text().splitlines() if line]
    # Remove duplicate feature vectors before group assignment, regardless of source/label.
    seen, unique = set(), []
    for row in rows:
        fingerprint = hashlib.sha256(json.dumps(vector(row)).encode()).hexdigest()
        if fingerprint not in seen:
            seen.add(fingerprint)
            unique.append(row)
    # Folder grouping is a conservative proxy, not evidence of participant independence.
    groups = sorted(set(r["group"] for r in unique))
    human_groups = sorted(set(r["group"] for r in unique if r["label"] == "human"))
    if len(human_groups) < 2:
        raise SystemExit("Need at least two distinct human source groups; no supervised artifact emitted")
    human_test = {g for g in human_groups if "pc2" in g} or {human_groups[-1]}
    test_groups = human_test | {g for g in groups if "gan" in g.lower() or g in ("local-lognormal", "local-bezier")}
    calibration_groups = {"circles_human_vm", "circles_bot_pyhm"}
    train = [r for r in unique if r["group"] not in test_groups | calibration_groups]
    calibration = [r for r in unique if r["group"] in calibration_groups]
    test = [r for r in unique if r["group"] in test_groups]
    x, y = np.array([vector(r) for r in train]), np.array([r["label"] == "bot" for r in train], dtype=int)
    tx, ty = np.array([vector(r) for r in test]), np.array([r["label"] == "bot" for r in test], dtype=int)
    cx, cy = np.array([vector(r) for r in calibration]), np.array([r["label"] == "bot" for r in calibration], dtype=int)
    if len(set(y)) != 2 or len(set(ty)) != 2:
        raise SystemExit("Both classes must occur in disjoint train/test groups")
    models = {"logistic": make_pipeline(StandardScaler(), LogisticRegression(max_iter=3000, random_state=SEED, class_weight="balanced")),
              "random_forest": RandomForestClassifier(n_estimators=200, max_depth=8, min_samples_leaf=5, random_state=SEED, class_weight="balanced", n_jobs=1)}
    report = {"seed": SEED, "featureVersion": "lava-features-v1", "experimentalOnly": True, "productionPromotion": "blocked_pending_consenting_lavaguard_validation",
              "python": platform.python_version(), "numpy": np.__version__, "sklearn": sklearn.__version__,
              "limitations": ["No consenting LavaGuard human sessions", "Only small DELBOT task corpus", "Participant IDs unavailable; folder/device holdout cannot prove user-disjointness", "No calibrated probability; high domain uncertainty", "No bubble-response validation", "No touchscreen/trackpad labels", "Single-corpus source artifacts may inflate scores", "Test set not used for selection/calibration"],
              "trainGroups": sorted(set(r["group"] for r in train)), "heldOutGroups": sorted(set(r["group"] for r in test)),
              "calibrationGroups": sorted(calibration_groups), "calibrationN": len(calibration),
              "trainN": len(train), "testN": len(test), "removedDuplicateVectors": len(rows) - len(unique), "models": {}}
    artifact = None
    for name, model in models.items():
        began = time.perf_counter(); model.fit(x, y); training = time.perf_counter() - began
        began = time.perf_counter(); p = model.predict_proba(tx)[:, 1]; latency = (time.perf_counter() - began) * 1000 / len(tx)
        calibration_slope, calibration_intercept = 1., 0.
        if name == "logistic":
            calibrator = LogisticRegression(random_state=SEED, C=1.)
            calibrator.fit(model.decision_function(cx).reshape(-1, 1), cy)
            p = calibrator.predict_proba(model.decision_function(tx).reshape(-1, 1))[:, 1]
            calibration_slope, calibration_intercept = float(calibrator.coef_[0][0]), float(calibrator.intercept_[0])
        prediction = p >= .5
        precision, recall, f1, _ = precision_recall_fscore_support(ty, prediction, average="binary", zero_division=0)
        tn, fp, fn, tp = confusion_matrix(ty, prediction, labels=[0, 1]).ravel()
        families = {}
        for group in sorted(set(r["group"] for r in test)):
            mask = np.array([r["group"] == group for r in test]); truth = ty[mask]; pred = prediction[mask]
            families[group] = {"n": int(mask.sum()), "humanN": int((truth == 0).sum()), "botN": int((truth == 1).sum()), "flaggedN": int(pred.sum()), "falsePositiveN": int(((truth == 0) & pred).sum()), "falseNegativeN": int(((truth == 1) & ~pred).sum())}
        # Wilson uncertainty on held-out human acceptance, avoids false precision.
        human_n = int(tn + fp); accepted = int(tn); z = 1.96; center = (accepted / human_n + z*z/(2*human_n)) / (1 + z*z/human_n)
        spread = z * ((accepted / human_n * (1-accepted / human_n)/human_n + z*z/(4*human_n*human_n)) ** .5) / (1+z*z/human_n)
        report["models"][name] = {"precision": float(precision), "recall": float(recall), "f1": float(f1), "rocAuc": float(roc_auc_score(ty, p)), "prAuc": float(average_precision_score(ty, p)), "brier": float(brier_score_loss(ty, p)), "humanAcceptance": accepted / human_n, "humanAcceptanceWilson95": [center-spread, center+spread], "confusion": {"tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp)}, "trainingSeconds": training, "inferenceMsPerRow": latency, "byFamily": families}
        if name == "logistic":
            scaler, classifier = model.steps[0][1], model.steps[1][1]
            artifact = {"version": "lava-logistic-experimental-v1", "featureVersion": "lava-features-v1", "experimental": True, "enabled": False, "features": KEYS, "mean": scaler.mean_.tolist(), "scale": scaler.scale_.tolist(), "coefficients": classifier.coef_[0].tolist(), "intercept": float(classifier.intercept_[0]), "calibrationSlope": calibration_slope, "calibrationIntercept": calibration_intercept, "trainingSeed": SEED}
            synthetic = next(r for r in unique if r["source"] == "lava-generator-v1")
            artifact["parityFixture"] = {"features": synthetic["features"], "expectedRisk": float(calibrator.predict_proba(model.decision_function(np.array([vector(synthetic)])).reshape(-1, 1))[0, 1])}
    anomaly = make_pipeline(StandardScaler(), IsolationForest(n_estimators=150, random_state=SEED, contamination="auto"))
    anomaly.fit(x[y == 0]); flags = anomaly.predict(tx) == -1
    report["models"]["human_isolation_forest"] = {"interpretation": "anomaly only; not bot classification", "humanOutlierN": int(flags[ty == 0].sum()), "humanN": int((ty == 0).sum()), "generatedOutlierN": int(flags[ty == 1].sum()), "generatedN": int((ty == 1).sum())}
    report["lightgbm"] = "Not run: no demonstrated benefit justifying another model/dependency on this limited corpus"
    folder = ROOT / "ml/artifacts"; folder.mkdir(parents=True, exist_ok=True)
    (folder / "evaluation.json").write_text(json.dumps(report, indent=2) + "\n")
    (folder / "logistic-experimental.json").write_text(json.dumps(artifact, indent=2) + "\n")
    (ROOT / "src/worker/guard/experimental-model.ts").write_text("// Generated by ml/train.py. Default disabled; localhost opt-in is handled by guard/config.ts.\nexport const experimentalModel = " + json.dumps(artifact, indent=2) + " as const;\n")
    lab_report = {"trainN": len(train), "heldOutN": len(test), "calibrationN": len(calibration), "corpus": "DELBOT + lava-generator-v1", "consentingApplicationHumanN": 0, "experimentalOnly": True,
                  "logistic": report["models"]["logistic"], "randomForest": report["models"]["random_forest"], "limitations": report["limitations"]}
    (ROOT / "src/worker/guard/experimental-evaluation.ts").write_text("// Generated by ml/train.py. Corpus experiment, not production performance.\nexport const experimentalEvaluation = " + json.dumps(lab_report, indent=2) + " as const;\n")
    print(json.dumps({"train": len(train), "heldOut": len(test), "models": list(report["models"]), "artifactEnabled": False}))

if __name__ == "__main__":
    main()
