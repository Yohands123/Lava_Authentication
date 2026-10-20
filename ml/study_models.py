"""Fixed offline baselines; separate calibration; private disabled candidates."""
from collections import defaultdict, Counter
import pickle
import time
import tracemalloc
import numpy as np
from sklearn import __version__ as sklearn_version
from sklearn.ensemble import HistGradientBoostingClassifier, IsolationForest, RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import average_precision_score, brier_score_loss, roc_auc_score
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from threadpoolctl import threadpool_limits
from study_data import ROBUST_KEYS, RESPONSE_KEYS, canonical, digest

SEED = 20261018
TARGET_CAL_FPR = .01


def wilson(successes, total):
    if not total: return None
    z, p = 1.959963984540054, successes / total
    d = 1 + z*z/total
    c = (p + z*z/(2*total))/d
    s = z*np.sqrt(p*(1-p)/total + z*z/(4*total*total))/d
    return [float(max(0, c-s)), float(min(1, c+s))]


def choose_threshold(human_scores, target=TARGET_CAL_FPR):
    scores = np.sort(np.asarray(human_scores, dtype=float))
    if not len(scores) or not np.isfinite(scores).all() or not 0 <= target < 1: raise ValueError('finite calibration humans and valid target required')
    allowed = min(int(np.floor(len(scores)*target)), len(scores)-1)
    return float(np.nextafter(scores[-allowed-1], np.inf))


def rate_summary(y, scores, threshold):
    y, scores = np.asarray(y), np.asarray(scores)
    if len(y) != len(scores) or not np.isfinite(scores).all() or np.any((scores < 0) | (scores > 1)): raise ValueError('invalid evaluation scores')
    human, bot, flags = y == 0, y == 1, scores >= threshold
    hn, bn = int(human.sum()), int(bot.sum())
    fp, tp = int((flags & human).sum()), int((flags & bot).sum())
    bins, ece = [], 0.
    membership = np.minimum(9, (scores*10).astype(int))
    for i in range(10):
        lo = i/10
        mask = membership == i
        n = int(mask.sum())
        predicted, observed = (float(scores[mask].mean()), float(y[mask].mean())) if n else (None, None)
        if n: ece += n/max(1, len(y))*abs(predicted-observed)
        bins.append({'lower': float(lo), 'upper': (i+1)/10, 'n': n, 'meanScore': predicted, 'observedBotFraction': observed})
    return {'humanAttempts': hn, 'humanFlagged': fp, 'humanAccepted': hn-fp, 'humanAttemptFalseFlagRate': fp/hn if hn else None,
        'humanAcceptanceRate': 1-fp/hn if hn else None, 'humanAttemptFalseFlagWilson95': wilson(fp, hn),
        'botAttempts': bn, 'botFlagged': tp, 'botMissed': bn-tp, 'botDetectionRate': tp/bn if bn else None,
        'botFalseNegativeRate': 1-tp/bn if bn else None, 'botDetectionWilson95': wilson(tp, bn),
        'rocAuc': float(roc_auc_score(y, scores)) if hn and bn else None,
        'prAuc': float(average_precision_score(y, scores)) if hn and bn else None,
        'brier': float(brier_score_loss(y, scores)) if len(y) else None, 'ece10': float(ece), 'calibrationBins': bins,
        'intervalScope': 'Correlated attempts, not independent-human population confidence or a deployment guarantee'}


def matrix(rows, keys=ROBUST_KEYS):
    return np.log1p(np.array([[r['robust']['features'][k] if k in ROBUST_KEYS else r['experimental']['features'][k] for k in keys] for r in rows], dtype=float))


def labels(rows): return np.array([r['label'] == 'bot' for r in rows], dtype=int)


def group_weights(rows):
    groups = [('human:' + r['participant']) if r['label'] == 'human' else ('bot:' + r['generator']['family']) for r in rows]
    counts = Counter(groups)
    weights = np.array([1/counts[g] for g in groups])
    return weights * len(rows)/weights.sum()


def raw_score(model, name, x):
    if name in ('regularizedLogistic', 'histGradientBoosting'): return model.decision_function(x)
    p = np.clip(model.predict_proba(x)[:, 1], 1e-6, 1-1e-6)
    return np.log(p/(1-p))


def portable_candidate(model, calibrator, threshold, fit_rows, dataset_hash, split_hash, keys):
    scaler, classifier = model.steps[0][1], model.steps[1][1]
    x = matrix(fit_rows, keys)
    return {'schema': 'lava-portable-logistic-v3', 'version': 'lava-application-v3-' + dataset_hash[:16],
        'featureVersion': 'lava-robust-v2' if tuple(keys) == ROBUST_KEYS else 'lava-robust-response-v3', 'features': list(keys),
        'enabled': False, 'applicationValidated': False, 'transform': 'log1p-standardize', 'datasetHash': dataset_hash, 'splitHash': split_hash,
        'mean': scaler.mean_.tolist(), 'scale': scaler.scale_.tolist(), 'coefficients': classifier.coef_[0].tolist(), 'intercept': float(classifier.intercept_[0]),
        'calibrationSlope': float(calibrator.coef_[0][0]), 'calibrationIntercept': float(calibrator.intercept_[0]), 'researchThreshold': threshold,
        'trainingMinimum': x.min(axis=0).tolist(), 'trainingMaximum': x.max(axis=0).tolist(),
        'supportedDevices': sorted({r['device'] for r in fit_rows if r['device'] in ('mouse', 'trackpad')}),
        'seed': SEED, 'calibrationScope': 'separate self-reported application cohorts; unvalidated', 'automaticPromotion': False}


@threadpool_limits.wrap(limits=1)
def train_and_score(parts, keys=ROBUST_KEYS, dataset_hash='0'*64, split_hash='0'*64, evaluate_test=True):
    train, cal = parts['train'], parts['calibration']
    # Development callers need not supply or expose final rows at all.
    held = parts['test'] if evaluate_test else []
    checked_cohorts = (train, cal, held) if evaluate_test else (train, cal)
    if any(not rows or len(set(labels(rows))) != 2 for rows in checked_cohorts): raise ValueError('independent cohorts need both labels')
    x, cx = matrix(train, keys), matrix(cal, keys)
    tx = matrix(held, keys) if evaluate_test else np.empty((0, len(keys)))
    y, cy = labels(train), labels(cal)
    ty = labels(held) if evaluate_test else np.array([], dtype=int)
    candidates = {
        'regularizedLogistic': make_pipeline(StandardScaler(), LogisticRegression(C=.1, class_weight='balanced', max_iter=3000, random_state=SEED)),
        'randomForest': RandomForestClassifier(n_estimators=200, max_depth=8, min_samples_leaf=5, class_weight='balanced', random_state=SEED, n_jobs=1),
        'histGradientBoosting': HistGradientBoostingClassifier(max_iter=100, max_leaf_nodes=15, learning_rate=.05, l2_regularization=1., early_stopping=False, class_weight='balanced', random_state=SEED),
    }
    results, artifact, predictors = {}, None, {}
    for name, model in candidates.items():
        weights = group_weights(train)
        tracemalloc.start(); started = time.perf_counter()
        if name == 'regularizedLogistic': model.fit(x, y, standardscaler__sample_weight=weights, logisticregression__sample_weight=weights)
        else: model.fit(x, y, sample_weight=weights)
        fit_ms = (time.perf_counter()-started)*1000
        _, peak = tracemalloc.get_traced_memory(); tracemalloc.stop()
        calibrator = LogisticRegression(C=1., random_state=SEED)
        calibrator.fit(raw_score(model, name, cx).reshape(-1, 1), cy, sample_weight=group_weights(cal))
        def predict(a, model=model, name=name, calibrator=calibrator): return calibrator.predict_proba(raw_score(model, name, a).reshape(-1, 1))[:, 1]
        threshold = choose_threshold(predict(cx)[cy == 0])
        started = time.perf_counter(); p = predict(tx) if evaluate_test else np.array([]); batch_ms = (time.perf_counter()-started)*1000
        timings = []
        for _ in range(30):
            began = time.perf_counter(); predict(cx[:1]); timings.append((time.perf_counter()-began)*1000)
        ood = ((tx < x.min(axis=0)-.01) | (tx > x.max(axis=0)+.01)).any(axis=1)
        result = rate_summary(ty, p, threshold) if evaluate_test else {'testStatus': 'UNTOUCHED_REQUIRES_EXPLICIT_FINAL_EVALUATION'}
        result.update({'calibrationThreshold': threshold, 'calibrationHumanAttempts': int((cy == 0).sum()), 'calibrationEmpiricalFprTarget': TARGET_CAL_FPR,
            'datasetHash': dataset_hash, 'splitHash': split_hash, 'featureKeys': list(keys), 'seed': SEED,
            'hyperparameters': {k: v for k, v in model.get_params().items() if v is None or isinstance(v, (str, bool, int, float))},
            'trainingMs': fit_ms, 'pythonTrackedPeakBytes': peak, 'nativeMemoryIncluded': False,
            'pythonSingleInferenceMs': {'p50': float(np.percentile(timings, 50)), 'p95': float(np.percentile(timings, 95)), 'n': len(timings)},
            'pythonBatchInferenceMs': batch_ms, 'batchN': len(tx), 'serializedPythonBytes': len(pickle.dumps((model, calibrator))),
            'modelPromoted': False, 'oodAttempts': int(ood.sum()) if evaluate_test else None, 'deviceBreakdown': {d: rate_summary(ty[mask], p[mask], threshold) for d in sorted({r['device'] for r in held}) if evaluate_test and (mask := np.array([r['device'] == d for r in held])).any()}})
        groups = defaultdict(list)
        for r, score in zip(held if evaluate_test else [], p):
            group = 'human:' + r['participant'] if r['label'] == 'human' else 'bot:' + r['generator']['family']
            groups[group].append(float(score))
        humans = [scores for g, scores in groups.items() if g.startswith('human:')]
        bots = [scores for g, scores in groups.items() if g.startswith('bot:')]
        result['independentGroupSummary'] = {'declaredHumanCodes': len(humans), 'humanCodesWithAnyFlag': sum(any(v >= threshold for v in vs) for vs in humans),
            'equalCodeMeanHumanFalseFlagRate': float(np.mean([np.mean(np.array(vs) >= threshold) for vs in humans])) if humans else None,
            'heldOutBotFamilies': len(bots), 'familiesWithAnyDetection': sum(any(v >= threshold for v in vs) for vs in bots), 'codesAreNotAttestedPeople': True}
        results[name], predictors[name] = result, (predict, threshold)
        if name == 'regularizedLogistic': artifact = portable_candidate(model, calibrator, threshold, train, dataset_hash, split_hash, keys)
    anomaly = make_pipeline(StandardScaler(), IsolationForest(n_estimators=150, contamination='auto', random_state=SEED, n_jobs=1))
    tracemalloc.start(); started = time.perf_counter(); anomaly.fit(x[y == 0]); anomaly_ms = (time.perf_counter()-started)*1000
    _, anomaly_peak = tracemalloc.get_traced_memory(); tracemalloc.stop()
    started = time.perf_counter(); out = anomaly.predict(tx) == -1 if evaluate_test else np.array([], dtype=bool); anomaly_inference_ms = (time.perf_counter()-started)*1000
    results['isolationForestDiagnostics'] = {'humanOutlierN': int(out[ty == 0].sum()) if evaluate_test else None, 'humanN': int((ty == 0).sum()) if evaluate_test else None,
        'botOutlierN': int(out[ty == 1].sum()) if evaluate_test else None, 'botN': int((ty == 1).sum()) if evaluate_test else None, 'notBotProof': True,
        'featureKeys': list(keys), 'datasetHash': dataset_hash, 'splitHash': split_hash, 'seed': SEED, 'hyperparameters': {'n_estimators': 150, 'contamination': 'auto'},
        'trainingMs': anomaly_ms, 'pythonTrackedPeakBytes': anomaly_peak, 'serializedPythonBytes': len(pickle.dumps(anomaly)), 'batchInferenceMs': anomaly_inference_ms if evaluate_test else None, 'batchN': len(tx), 'nativeMemoryIncluded': False}
    results['environment'] = {'numpy': np.__version__, 'sklearn': sklearn_version, 'runtime': 'local Python, not Cloudflare edge CPU'}
    return results, artifact, predictors


def score_portable(artifact, features):
    x = np.log1p(np.array([features[k] for k in artifact['features']]))
    z = np.dot((x-np.array(artifact['mean']))/np.array(artifact['scale']), artifact['coefficients']) + artifact['intercept']
    return float(1/(1+np.exp(-np.clip(z*artifact['calibrationSlope']+artifact['calibrationIntercept'], -40, 40))))
