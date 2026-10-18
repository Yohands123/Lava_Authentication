"""Fixed, descriptive candidate experiment. No production promotion or online fitting."""
import hashlib
import json
import pickle
import time
import tracemalloc
from collections import Counter
import numpy as np
from sklearn.ensemble import IsolationForest, RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from train import ROOT, SEED
from validate import metrics

KEYS = ['efficiency', 'pathLength', 'speedCv', 'speedP95', 'accelP95', 'jerkP95', 'turnMean', 'turnP95', 'curvatureP95', 'reversalRate', 'correctionRate', 'pauseShare']


def matrix(rows, variant='original', keys=KEYS):
    return np.log1p(np.array([[r['variants'][variant]['features'][k] for k in keys] for r in rows]))


def labels(rows):
    return np.array([r['label'] == 'bot' for r in rows], dtype=int)


def wilson(k, n):
    if not n:
        return None
    z, p = 1.96, k / n
    center = (p + z*z/(2*n))/(1+z*z/n)
    spread = z * np.sqrt(p*(1-p)/n+z*z/(4*n*n))/(1+z*z/n)
    return [float(center-spread), float(center+spread)]


def quality(y, p, threshold):
    r = metrics(y, p)
    hn, bn = int((y == 0).sum()), int((y == 1).sum())
    fp, tp = int(((y == 0) & (p >= threshold)).sum()), int(((y == 1) & (p >= threshold)).sum())
    r['calibrationSelectedThreshold'] = threshold
    r['operatingPoint'] = {'humanN': hn, 'falsePositiveN': fp, 'humanFalsePositiveRate': fp/hn if hn else None,
                           'humanAcceptance': 1-fp/hn if hn else None, 'falsePositiveWilson95': wilson(fp, hn),
                           'botN': bn, 'detectedN': tp, 'botDetectionRate': tp/bn if bn else None,
                           'botFalseNegativeRate': 1-tp/bn if bn else None, 'detectionWilson95': wilson(tp, bn)}
    return r


def fit(train, cal, test, keys=KEYS):
    x, y, cx, cy, tx, ty = matrix(train, keys=keys), labels(train), matrix(cal, keys=keys), labels(cal), matrix(test, keys=keys), labels(test)
    # Fixed beforehand; no search on held-out tasks/generators.
    candidates = {'regularizedLogistic': make_pipeline(StandardScaler(), LogisticRegression(C=.1, max_iter=3000, class_weight='balanced', random_state=SEED)),
                  'randomForest': RandomForestClassifier(n_estimators=200, max_depth=8, min_samples_leaf=5, class_weight='balanced', random_state=SEED, n_jobs=1)}
    report, fitted = {}, {}
    for name, model in candidates.items():
        tracemalloc.start(); began = time.perf_counter(); model.fit(x, y)
        training_seconds = time.perf_counter() - began
        _, peak = tracemalloc.get_traced_memory(); tracemalloc.stop()
        calibrator = LogisticRegression(C=1., random_state=SEED)
        raw_cal = model.decision_function(cx) if name == 'regularizedLogistic' else np.clip(model.predict_proba(cx)[:, 1], 1e-6, 1-1e-6)
        if name != 'regularizedLogistic': raw_cal = np.log(raw_cal/(1-raw_cal))
        calibrator.fit(raw_cal.reshape(-1, 1), cy)
        def predict(a, model=model, calibrator=calibrator, name=name):
            raw = model.decision_function(a) if name == 'regularizedLogistic' else np.clip(model.predict_proba(a)[:, 1], 1e-6, 1-1e-6)
            if name != 'regularizedLogistic': raw = np.log(raw/(1-raw))
            return calibrator.predict_proba(raw.reshape(-1, 1))[:, 1]
        human_scores = np.sort(predict(cx)[cy == 0])
        allowed = int(len(human_scores)*.01)
        threshold = float(np.nextafter(human_scores[-allowed-1], 1.))
        began = time.perf_counter(); p = predict(tx); latency = (time.perf_counter()-began)*1000/len(tx)
        report[name] = quality(ty, p, threshold) | {'calibrationFprConstraint': .01, 'trainingSeconds': training_seconds,
            'pythonPeakTrackedBytes': peak, 'pythonInferenceMsPerRow': latency, 'serializedPythonBytes': len(pickle.dumps((model, calibrator)))}
        fitted[name] = (model, calibrator, threshold, predict)
    anomaly = make_pipeline(StandardScaler(), IsolationForest(n_estimators=150, random_state=SEED, contamination='auto'))
    anomaly.fit(x[y == 0]); flags = anomaly.predict(tx) == -1
    report['humanAnomaly'] = {'humanN': int((ty == 0).sum()), 'humanOutlierN': int(flags[ty == 0].sum()), 'botN': int((ty == 1).sum()), 'botOutlierN': int(flags[ty == 1].sum()), 'interpretation': 'Not an automation probability'}
    return report, fitted


def main():
    raw = [json.loads(s) for s in (ROOT/'ml/private/phase4-features.jsonl').read_text().splitlines() if s]
    rows, seen = [], set()
    for r in raw:
        digest = hashlib.sha256(json.dumps(r['variants']['original']['features'], sort_keys=True).encode()).hexdigest()
        if digest not in seen:
            seen.add(digest); rows.append(r)
    phase2 = json.loads((ROOT/'ml/artifacts/evaluation.json').read_text())
    cg, tg = set(phase2['calibrationGroups']), set(phase2['heldOutGroups'])
    train = [r for r in rows if r['group'] not in cg | tg and r['source'] != 'independent-generator-v4']
    cal = [r for r in rows if r['group'] in cg]
    test = [r for r in rows if r['group'] in tg]
    independent = [r for r in rows if r['source'] == 'independent-generator-v4']
    comparison, fitted = fit(train, cal, test)
    model, calibrator, threshold, predict = fitted['regularizedLogistic']
    scaler, logistic = model.steps[0][1], model.steps[1][1]
    artifact = {'version': 'lava-robust-logistic-v2', 'featureVersion': 'lava-robust-v2', 'enabled': False, 'transform': 'log1p-standardize',
                'features': KEYS, 'mean': scaler.mean_.tolist(), 'scale': scaler.scale_.tolist(), 'coefficients': logistic.coef_[0].tolist(), 'intercept': float(logistic.intercept_[0]),
                'calibrationSlope': float(calibrator.coef_[0][0]), 'calibrationIntercept': float(calibrator.intercept_[0]), 'researchThreshold': threshold,
                'trainingMinimum': matrix(train).min(axis=0).tolist(), 'trainingMaximum': matrix(train).max(axis=0).tolist(),
                'calibration': {'method': 'held-out-source-folder sigmoid', 'applicationValidated': False, 'humanN': int((labels(cal)==0).sum()), 'targetHumanFpr': .01}, 'seed': SEED}
    fixture = next(r for r in rows if r['group'] == 'local-variable-speed')
    artifact['parityFixture'] = {'features': fixture['variants']['original']['features'], 'expectedRisk': float(predict(matrix([fixture]))[0])}
    report = {'seed': SEED, 'noPromotion': True, 'schema': 'lava-robust-v2', 'rawRows': len(raw), 'uniqueVectors': len(rows),
              'trainN': len(train), 'calibrationN': len(cal), 'heldOutN': len(test), 'independentBotN': len(independent), 'consentingApplicationHumanN': 0,
              'selection': 'Fixed C=.1, fixed RF defaults. Threshold uses calibration humans only, target <=1% empirical FPR. No held-out selection.',
              'models': comparison, 'perturbations': {}, 'independentGenerators': {}, 'leaveOneGeneratorFamilyOut': {},
              'limitations': ['No application-specific human corpus', 'Source folders cannot establish participant identity', 'Canonical shape loses physical time and may miss reactive bots', 'Python tracemalloc excludes some native allocations', 'No calibrated application probability', 'No independent second human corpus; bot-only source transfer is not human FPR', 'No human bubble-response training data'],
              'lightgbmAndSequences': 'Not added: no independent application training set or evidence justifying additional complexity'}
    report['ablations'] = {}
    for name, keys in {'withoutMagnitude': [k for k in KEYS if k not in ['speedP95','accelP95','jerkP95','curvatureP95']],
                       'directionAndEfficiency': ['turnMean','turnP95','reversalRate','correctionRate','efficiency'],
                       'withoutCorrections': [k for k in KEYS if k not in ['reversalRate','correctionRate']]}.items():
        report['ablations'][name], _ = fit(train, cal, test, keys)
    report['bubbleResponseContribution'] = {'humanRowsWithTargets': 0, 'status': 'Not estimable without consenting human bubble-response data; synthetic responsiveness is not human classification', 'benchmark': 'phase2-bubble-response.json'}
    base_x, base_p = matrix(test), predict(matrix(test))
    for variant in ['cadence16', 'cadence32', 'cadence64', 'scaled2', 'jitter']:
        vx, vp = matrix(test, variant), predict(matrix(test, variant))
        report['perturbations'][variant] = quality(labels(test), vp, threshold) | {'medianAbsoluteFeatureChange': np.median(abs(vx-base_x), axis=0).tolist(), 'medianRiskChange': float(np.median(abs(vp-base_p))), 'decisionFlipN': int(((vp>=threshold)!=(base_p>=threshold)).sum())}
    for group in sorted({r['group'] for r in independent}):
        held = [r for r in independent if r['group']==group]
        report['independentGenerators'][group] = quality(labels(held), predict(matrix(held)), threshold)
    public_train = [r for r in train if r['source']=='delbot']
    transfer, _ = fit(public_train, cal, independent)
    report['crossSourceBotOnly'] = transfer
    report['crossDeviceProxy'] = {group: quality(labels(part), predict(matrix(part)), threshold) for group in sorted({r['group'] for r in test if r['label']=='human'}) if (part := [r for r in test if r['group']==group])}
    # Test fold labels never participate in calibration or fitting.
    humans = {r['group'] for r in test if r['label']=='human'}
    families = sorted({r['group'] for r in rows if r['label']=='bot' and r['source']!='independent-generator-v4'})
    for family in families:
        calibration = {'circles_human_vm', 'circles_bot_pyhm' if family!='circles_bot_pyhm' else 'circles_bot_pynput'}
        fit_rows = [r for r in rows if r['source']!='independent-generator-v4' and r['group'] not in humans | calibration | {family}]
        held = [r for r in rows if r['group'] in humans | {family}]
        fold, _ = fit(fit_rows, [r for r in rows if r['group'] in calibration], held)
        report['leaveOneGeneratorFamilyOut'][family] = fold
    old = json.loads((ROOT/'ml/artifacts/logistic-experimental.json').read_text())
    def legacy(variant, replace_timing=False):
        x = np.array([[r['variants'][variant]['legacy'][k] for k in old['features']] for r in test])
        if replace_timing:
            for k in ['dtCv', 'pauseRatio', 'bursts']:
                x[:, old['features'].index(k)] = [r['variants']['original']['legacy'][k] for r in test]
        z = ((x-np.array(old['mean']))/np.array(old['scale']))@np.array(old['coefficients'])+old['intercept']
        p = 1/(1+np.exp(-np.clip(z*old['calibrationSlope']+old['calibrationIntercept'], -40, 40)))
        return quality(labels(test), p, .9)
    report['fixedLegacyModelDiagnostics'] = {'original': legacy('original'), 'resampled32': legacy('cadence32'), 'resampledKeepingOriginalTiming': legacy('cadence32', True), 'note': 'Phase 2 687->92 compared refitted models, not a single model perturbed in place.'}
    folder = ROOT/'ml/artifacts'
    (folder/'phase4-model-evaluation.json').write_text(json.dumps(report, indent=2)+'\n')
    (folder/'robust-logistic-v2.json').write_text(json.dumps(artifact, indent=2)+'\n')
    (ROOT/'src/worker/guard/robust-model.ts').write_text('// Generated by ml/phase4.py. Candidate only; never automatically promoted.\nexport const robustModel = '+json.dumps(artifact, indent=2)+' as const;\n')
    print(json.dumps({'train':len(train),'calibration':len(cal),'heldOut':len(test),'independentBots':len(independent),'families':len(families),'modelEnabled':False,'models':list(comparison)}))


if __name__ == '__main__':
    main()
