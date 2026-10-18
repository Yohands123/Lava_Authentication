"""Descriptive Phase 2 experiments. Never writes models or tunes a threshold."""
import hashlib
import json
from collections import Counter, defaultdict
import numpy as np
from sklearn.ensemble import IsolationForest, RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import brier_score_loss, roc_auc_score, average_precision_score
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import GroupShuffleSplit
from train import ROOT, SEED, KEYS


def load():
    rows = [json.loads(s) for s in (ROOT / 'ml/private/features.jsonl').read_text().splitlines() if s]
    seen, unique, collisions = {}, [], []
    for r in rows:
        digest = hashlib.sha256(json.dumps([r['features'][k] for k in KEYS]).encode()).hexdigest()
        if digest in seen:
            collisions.append((seen[digest]['label'], r['label']))
        else:
            seen[digest] = r
            unique.append(r)
    return rows, unique, collisions


def matrix(rows, keys):
    return np.array([[r['features'][k] for k in keys] for r in rows])


def truth(rows):
    return np.array([r['label'] == 'bot' for r in rows], dtype=int)


def metrics(y, p):
    def counts(threshold):
        flags = p >= threshold
        hn, bn = int((y == 0).sum()), int((y == 1).sum())
        fp, tp = int((flags & (y == 0)).sum()), int((flags & (y == 1)).sum())
        return {'humanN': hn, 'falsePositiveN': fp, 'falsePositiveRate': fp / hn if hn else None,
                'botN': bn, 'detectedN': tp, 'botDetectionRate': tp / bn if bn else None}
    bins, ece = [], 0.
    for i in range(10):
        a, b = i / 10, (i + 1) / 10
        mask = (p >= a) & (p < b if b < 1 else p <= b)
        if mask.any():
            mean, observed = float(p[mask].mean()), float(y[mask].mean())
            ece += mask.mean() * abs(mean - observed)
            bins.append({'lower': float(a), 'n': int(mask.sum()), 'meanScore': mean, 'observedBotFraction': observed})
    return {'threshold05': counts(.5), 'threshold09': counts(.9),
            'rocAuc': float(roc_auc_score(y, p)) if len(set(y)) == 2 else None,
            'prAuc': float(average_precision_score(y, p)) if len(set(y)) == 2 else None,
            'brier': float(brier_score_loss(y, p)), 'ece10': float(ece), 'calibrationBins': bins}


def experiment(train, calibration, test, keys=KEYS):
    if not train or not calibration or not test or len(set(truth(train))) < 2 or len(set(truth(calibration))) < 2:
        return {'unavailable': 'Needs two labels in fitting and separate calibration data'}
    x, y, cx, cy, tx, ty = matrix(train, keys), truth(train), matrix(calibration, keys), truth(calibration), matrix(test, keys), truth(test)
    logistic = make_pipeline(StandardScaler(), LogisticRegression(max_iter=3000, random_state=SEED, class_weight='balanced'))
    logistic.fit(x, y)
    calibrator = LogisticRegression(random_state=SEED, C=1.)
    calibrator.fit(logistic.decision_function(cx).reshape(-1, 1), cy)
    forest = RandomForestClassifier(n_estimators=200, max_depth=8, min_samples_leaf=5, random_state=SEED, class_weight='balanced', n_jobs=1)
    forest.fit(x, y)
    anomaly = make_pipeline(StandardScaler(), IsolationForest(n_estimators=150, random_state=SEED, contamination='auto'))
    anomaly.fit(x[y == 0])
    flags = anomaly.predict(tx) == -1
    return {'trainN': len(train), 'calibrationN': len(calibration), 'testN': len(test),
            'logistic': metrics(ty, calibrator.predict_proba(logistic.decision_function(tx).reshape(-1, 1))[:, 1]),
            'randomForest': metrics(ty, forest.predict_proba(tx)[:, 1]),
            'humanAnomaly': {'humanN': int((ty == 0).sum()), 'humanOutlierN': int(flags[ty == 0].sum()),
                             'botN': int((ty == 1).sum()), 'botOutlierN': int(flags[ty == 1].sum()),
                             'interpretation': 'Anomaly is not a probability or proof of automation'}}


def main():
    raw, rows, duplicates = load()
    baseline = json.loads((ROOT / 'ml/artifacts/evaluation.json').read_text())
    hg = set(baseline['heldOutGroups']) & {r['group'] for r in rows if r['label'] == 'human'}
    cg, tg = set(baseline['calibrationGroups']), set(baseline['heldOutGroups'])
    train = [r for r in rows if r['group'] not in cg | tg]
    cal = [r for r in rows if r['group'] in cg]
    test = [r for r in rows if r['group'] in tg]
    report = {'seed': SEED, 'noModelPromotion': True, 'thresholdsPredeclared': [.5, .9],
              'selection': 'Fixed Phase 1 hyperparameters; descriptive evaluation only; no model or thresholds selected',
              'audit': {'rowsBeforeDedup': len(raw), 'uniqueModelVectors': len(rows), 'duplicateModelVectors': len(duplicates),
                        'conflictingDuplicateLabels': sum(a != b for a, b in duplicates),
                        'participantIdentityAvailableInPublicCorpus': False,
                        'sampling': 'DELBOT extent normalization vs application ring diameter; >=32ms downsample; local generators often exact32ms',
                        'shortcutRisks': ['dtCv and pause/timing can identify acquisition tools', 'bursts/reversals/corrections scale with length',
                                          'DELBOT circle task differs from clearing a moving ring', 'generator family/source and label are correlated',
                                          'small device folders are not independent participants'],
                        'metadataUsedAsPredictors': False}, 'leaveOneGeneratorFamilyOut': {}}
    normalized = [json.loads(s) for s in (ROOT / 'ml/private/normalized.jsonl').read_text().splitlines() if s]
    trace_labels = defaultdict(set)
    for r in normalized:
        signature = json.dumps([[round(s['x'], 6), round(s['y'], 6), round(s['t'], 3)] for s in r['samples']])
        trace_labels[hashlib.sha256(signature.encode()).hexdigest()].add(r['label'])
    report['audit']['normalizedLabelCounts'] = dict(Counter(r['label'] for r in normalized))
    report['audit']['excludedShortPublicTracesByLabel'] = dict(Counter(r['label'] for r in normalized if len(r['samples']) < 12))
    report['audit']['duplicateNormalizedPaths'] = len(normalized) - len(trace_labels)
    report['audit']['conflictingNormalizedPathLabels'] = sum(len(v) > 1 for v in trace_labels.values())
    families = sorted({r['group'] for r in rows if r['label'] == 'bot'})
    for family in families:
        bot_cal = 'circles_bot_pyhm' if family != 'circles_bot_pyhm' else 'circles_bot_pynput'
        calibration_groups = {'circles_human_vm', bot_cal}
        fit = [r for r in rows if r['group'] not in hg | calibration_groups | {family}]
        calibration = [r for r in rows if r['group'] in calibration_groups]
        held = [r for r in rows if r['group'] in hg | {family}]
        report['leaveOneGeneratorFamilyOut'][family] = experiment(fit, calibration, held)
    kinetic = ['efficiency', 'speedCv', 'headingChangeMean', 'angularP95', 'curvatureP95']
    spatial = ['efficiency', 'headingChangeMean', 'reversals', 'corrections']
    report['ablations'] = {name: experiment(train, cal, test, keys) for name, keys in {
        'all15': KEYS, 'withoutTiming': [k for k in KEYS if k not in ['dtCv', 'pauseRatio', 'bursts']],
        'withoutCountFeatures': [k for k in KEYS if k not in ['bursts', 'reversals', 'corrections']],
        'shapeOnly': spatial, 'fiveKinematic': kinetic, 'acquisitionOnlyControl': ['samples', 'durationMs', 'dtP50', 'dtP95', 'clockQuantumMs']}.items()}
    report['crossSource'] = {'delbotToLocalGenerators': experiment([r for r in train if r['source'] == 'delbot'], cal,
                                                                 [r for r in rows if r['source'] == 'lava-generator-v1']),
                            'interpretation': 'Bot-only source transfer. Local source has no humans; no cross-source human FPR can be measured.',
                            'independentHumanCorpus': 'Unavailable: no reusable second human corpus or consenting application export present'}
    matched_file = ROOT / 'ml/private/matched-features.jsonl'
    if matched_file.exists():
        matched = [json.loads(s) for s in matched_file.read_text().splitlines() if s]
        # Preserve membership from the already deduplicated original dataset.
        train_ids, cal_ids, test_ids = ({r['id'] for r in part} for part in [train, cal, test])
        report['matched32msControl'] = experiment([r for r in matched if r['id'] in train_ids], [r for r in matched if r['id'] in cal_ids], [r for r in matched if r['id'] in test_ids])
        signatures = lambda ids: {tuple(r['features'][k] for k in KEYS) for r in matched if r['id'] in ids}
        cross_duplicates = signatures(train_ids) & signatures(test_ids)
        report['audit']['matchedTrainTestDuplicateVectors'] = len(cross_duplicates)
        if cross_duplicates:
            report['matched32msControl'] = {'unavailable': 'Resampling introduced cross-split duplicates; do not report leaked metrics'}
    # Optional local participant imports are never manufactured or auto-collected.
    consent_file = ROOT / 'ml/private/consenting-features.jsonl'
    local = [json.loads(s) for s in consent_file.read_text().splitlines() if s] if consent_file.exists() else []
    report['consentingApplication'] = {'n': len(local), 'participants': len({r['participant'] for r in local}), 'labels': dict(Counter(r['label'] for r in local))}
    if local:
        report['crossSource']['delbotToConsentingApplication'] = experiment(train, cal, local)
    if len({r['participant'] for r in local}) >= 4:
        split = GroupShuffleSplit(n_splits=1, test_size=.5, random_state=SEED)
        a, b = next(split.split(local, groups=[r['participant'] for r in local]))
        fit_local, held_local = [local[i] for i in a], [local[i] for i in b]
        assert not {r['participant'] for r in fit_local} & {r['participant'] for r in held_local}
        # Use fixed upstream calibration; this can still be out of domain.
        report['consentingApplication']['participantDisjoint'] = experiment(fit_local, cal, held_local)
    else:
        report['consentingApplication']['participantDisjoint'] = 'Not run: need >=4 consenting participant IDs; none invented'
    (ROOT / 'ml/artifacts/phase2-generalization.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({'unique': len(rows), 'families': len(families), 'ablations': len(report['ablations']), 'consentingApplicationN': len(local)}))


if __name__ == '__main__':
    main()
