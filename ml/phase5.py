"""LavaGuard Phase 5: privacy-preserving, application-specific OFFLINE model research.

This tool does not collect data, alter a Worker, claim that movement proves
humanity, or enable a production model. All outputs live under ignored ml/private.

Requirements: numpy and scikit-learn (see ml/requirements.txt).
"""
from __future__ import annotations

import argparse
from collections import Counter, defaultdict
from dataclasses import dataclass
import hashlib
import json
import math
from pathlib import Path
import re

import numpy as np
from sklearn.ensemble import IsolationForest, RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import average_precision_score, brier_score_loss, roc_auc_score
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

ROOT = Path(__file__).resolve().parents[1]
FEATURES = (
    'efficiency', 'pathLength', 'speedCv', 'speedP95', 'accelP95',
    'jerkP95', 'turnMean', 'turnP95', 'curvatureP95', 'reversalRate',
    'correctionRate', 'pauseShare',
)
SEED = 'lava-phase5-split-v1'
TARGET_CAL_FPR = 0.01
SCHEMA = 'lava-phase5-provenance-v1'


@dataclass
class Row:
    attempt: str
    label: int  # 0: declared human, 1: declared automation
    group: str
    device: str
    vector: np.ndarray
    source_label: str


def wilson(successes: int, total: int):
    """95% Wilson binomial interval; attempt-level only, not person-level CI."""
    if not total:
        return None
    z = 1.959963984540054
    p = successes / total
    d = 1 + z*z/total
    c = (p + z*z/(2*total)) / d
    s = z * math.sqrt(p*(1-p)/total + z*z/(4*total*total)) / d
    return [round(max(0, c-s), 6), round(min(1, c+s), 6)]


def hashed_order(groups):
    return sorted(groups, key=lambda g: hashlib.sha256((SEED + ':' + g).encode()).hexdigest())


def split_groups(groups):
    """Stable independent-group split, 60/20/20 with at least one group per set."""
    ordered = hashed_order(set(groups))
    n = len(ordered)
    if n < 3:
        raise ValueError('Need at least three independent groups for train/calibration/test')
    n_train = max(1, int(n * 0.6))
    n_cal = max(1, int(n * 0.2))
    if n_train + n_cal >= n:
        n_train = max(1, n - n_cal - 1)
    return {
        'train': set(ordered[:n_train]),
        'calibration': set(ordered[n_train:n_train+n_cal]),
        'test': set(ordered[n_train+n_cal:]),
    }


def parse_rows(data_path: Path, provenance_path: Path):
    if not data_path.exists():
        return [], ['No consenting application feature file exists. Collect genuine opt-in samples first.']
    errors = []
    try:
        lines = [json.loads(line) for line in data_path.read_text(encoding='utf-8').splitlines() if line.strip()]
    except (ValueError, OSError) as exc:
        return [], [f'Unable to parse private JSONL: {type(exc).__name__}']

    manifest = {}
    if provenance_path.exists():
        try:
            obj = json.loads(provenance_path.read_text(encoding='utf-8'))
            if obj.get('schema') != SCHEMA or not isinstance(obj.get('attempts'), dict):
                return [], [f'Provenance must declare schema {SCHEMA} and an attempts object']
            manifest = obj['attempts']
        except (ValueError, OSError, AttributeError, TypeError) as exc:
            return [], [f'Unable to parse provenance: {type(exc).__name__}']

    seen_attempts = set()
    rows = []
    for line_no, item in enumerate(lines, 1):
        if not isinstance(item, dict):
            errors.append(f'Row {line_no}: not an object')
            continue
        attempt = item.get('id')
        participant = item.get('participant')
        label = item.get('label')
        if not isinstance(attempt, str) or not re.fullmatch(r'[A-Za-z0-9_-]{16,64}', attempt):
            errors.append(f'Row {line_no}: invalid attempt ID')
            continue
        if attempt in seen_attempts:
            errors.append(f'Row {line_no}: duplicate attempt ID')
            continue
        seen_attempts.add(attempt)
        if item.get('source') != 'lava-consenting-local' or item.get('labelProvenance') != 'self-report-not-attested':
            errors.append(f'Row {line_no}: incorrect data provenance')
            continue
        if label not in ('human', 'bot'):
            errors.append(f'Row {line_no}: unlabeled or unsupported label')
            continue
        if not isinstance(participant, str) or not re.fullmatch(r'[A-Za-z0-9_-]{8,64}', participant):
            errors.append(f'Row {line_no}: missing/invalid participant code')
            continue
        device = item.get('device')
        if device not in {'mouse', 'trackpad', 'touch', 'pen', 'assisted', 'unknown'}:
            errors.append(f'Row {line_no}: unsupported device')
            continue
        robust = item.get('robust')
        if not isinstance(robust, dict) or robust.get('version') != 'lava-robust-v2' or not isinstance(robust.get('features'), dict):
            errors.append(f'Row {line_no}: missing lava-robust-v2 features')
            continue
        f = robust['features']
        if set(f) != set(FEATURES) or any(isinstance(f[k], bool) or not isinstance(f[k], (int, float)) or not math.isfinite(f[k]) or f[k] < 0 or f[k] > 1e12 for k in FEATURES):
            errors.append(f'Row {line_no}: invalid robust vector')
            continue
        if any(f[k] > 1 for k in ('efficiency', 'reversalRate', 'correctionRate', 'pauseShare')):
            errors.append(f'Row {line_no}: bounded feature exceeds 1')
            continue
        if label == 'human':
            group = 'human:' + participant
            source_label = 'self-reported human (NOT attested)'
        else:
            provenance = manifest.get(attempt)
            if not isinstance(provenance, dict):
                errors.append(f'Row {line_no}: declared bot lacks independently recorded generatorFamily provenance')
                continue
            family = provenance.get('generatorFamily')
            if not isinstance(family, str) or not re.fullmatch(r'[A-Za-z0-9_.-]{3,80}', family):
                errors.append(f'Row {line_no}: missing valid generatorFamily')
                continue
            group = 'bot-family:' + family
            source_label = 'declared automation (NOT attested)'
        rows.append(Row(attempt=attempt, label=int(label == 'bot'), group=group,
                        device=device, vector=np.log1p(np.array([f[k] for k in FEATURES], dtype=float)),
                        source_label=source_label))
    return rows, errors


def assign_splits(rows):
    human = split_groups([r.group for r in rows if r.label == 0])
    bot = split_groups([r.group for r in rows if r.label == 1])
    assigned = {set_name: [r for r in rows if r.group in human[set_name] | bot[set_name]]
                for set_name in ('train', 'calibration', 'test')}
    assert sum(len(v) for v in assigned.values()) == len(rows)
    groups = {name: {r.group for r in values} for name, values in assigned.items()}
    assert not (groups['train'] & groups['calibration'] or groups['train'] & groups['test'] or groups['calibration'] & groups['test'])
    # Exact vector leakage (including identical human/bot evidence) invalidates evaluation.
    vectors = {name: {tuple(r.vector) for r in values} for name, values in assigned.items()}
    if vectors['train'] & vectors['calibration'] or vectors['train'] & vectors['test'] or vectors['calibration'] & vectors['test']:
        raise ValueError('Exact duplicate feature vectors cross cohorts; do not fit or score')
    for name, values in assigned.items():
        if len({r.label for r in values}) != 2:
            raise ValueError(f'{name} needs independently grouped human and bot examples')
    return assigned


def matrix(rows):
    return np.stack([r.vector for r in rows])


def label_array(rows):
    return np.array([r.label for r in rows], dtype=int)


def choose_threshold(cal_humans, target=TARGET_CAL_FPR):
    """Pick only from separate calibration human scores; test stays untouched."""
    scores = np.sort(np.asarray(cal_humans, dtype=float))
    if not len(scores) or not np.isfinite(scores).all():
        raise ValueError('Calibration requires finite human scores')
    allowed = min(int(math.floor(len(scores) * target)), len(scores)-1)
    return float(np.nextafter(scores[-allowed-1], np.inf))


def rate_summary(y, score, threshold):
    human = (y == 0)
    bot = (y == 1)
    flagged = score >= threshold
    fp = int((human & flagged).sum())
    tp = int((bot & flagged).sum())
    hn = int(human.sum())
    bn = int(bot.sum())
    return {
        'humanAttempts': hn, 'humanFlagged': fp, 'humanAttemptFalseFlagRate': round(fp / hn, 6) if hn else None,
        'humanAttemptFalseFlagWilson95': wilson(fp, hn),
        'botAttempts': bn, 'botFlagged': tp, 'botAttemptDetectionRate': round(tp / bn, 6) if bn else None,
        'botAttemptDetectionWilson95': wilson(tp, bn),
        'rocAuc': round(float(roc_auc_score(y, score)), 6) if hn and bn else None,
        'prAuc': round(float(average_precision_score(y, score)), 6) if hn and bn else None,
        'brier': round(float(brier_score_loss(y, score)), 6) if hn and bn else None,
        'note': 'Rows/attempts may be correlated. These are not participant-level population CIs or production accuracy.'
    }


def train_and_score(parts):
    fit, cal, test = (parts[k] for k in ('train', 'calibration', 'test'))
    x, cx, tx = (matrix(v) for v in (fit, cal, test))
    y, cy, ty = (label_array(v) for v in (fit, cal, test))
    candidates = {
        'regularizedLogistic': make_pipeline(StandardScaler(), LogisticRegression(C=.1, max_iter=3000, class_weight='balanced', random_state=17)),
        'randomForest': RandomForestClassifier(n_estimators=200, max_depth=8, min_samples_leaf=5, class_weight='balanced', random_state=17, n_jobs=1),
    }
    results = {}
    for name, model in candidates.items():
        model.fit(x, y)
        def raw(inputs):
            if name == 'regularizedLogistic':
                return model.decision_function(inputs)
            p = np.clip(model.predict_proba(inputs)[:, 1], 1e-6, 1-1e-6)
            return np.log(p/(1-p))
        calibrator = LogisticRegression(C=1.0, random_state=17)
        calibrator.fit(raw(cx).reshape(-1, 1), cy)
        def probability(inputs):
            return calibrator.predict_proba(raw(inputs).reshape(-1, 1))[:, 1]
        threshold = choose_threshold(probability(cx)[cy == 0])
        scores = probability(tx)
        result = rate_summary(ty, scores, threshold)
        result['calibrationThreshold'] = round(threshold, 8)
        result['calibrationHumanAttempts'] = int((cy == 0).sum())
        result['calibrationEmpiricalFprTarget'] = TARGET_CAL_FPR
        human_groups = defaultdict(list)
        bot_families = defaultdict(list)
        for item, score in zip(test, scores):
            (bot_families if item.label == 1 else human_groups)[item.group].append(float(score))
        result['humanStudyCodeSummary'] = {
            'studyCodes': len(human_groups),
            'codesWithAtLeastOneFlaggedAttempt': sum(any(v >= threshold for v in scores) for scores in human_groups.values()),
            'warning': 'Study codes are self-reported; not independently verified unique people.'
        }
        result['botGeneratorFamilySummary'] = {
            'heldOutGeneratorFamilies': len(bot_families),
            'familiesWithAtLeastOneDetectedAttempt': sum(any(v >= threshold for v in scores) for scores in bot_families.values()),
            'warning': 'Families are operator-declared and do not represent all possible bots.'
        }
        result['deviceBreakdown'] = {
            device: rate_summary(ty[[r.device == device for r in test]], scores[[r.device == device for r in test]], threshold)
            for device in sorted({r.device for r in test})
        }
        results[name] = result
    outlier = make_pipeline(StandardScaler(), IsolationForest(n_estimators=150, contamination='auto', random_state=17, n_jobs=1))
    outlier.fit(x[y == 0])
    flags = outlier.predict(tx) == -1
    results['isolationForestDiagnostics'] = {
        'humanAttemptsFlaggedAsOutliers': int(flags[ty == 0].sum()),
        'humanAttempts': int((ty == 0).sum()),
        'botAttemptsFlaggedAsOutliers': int(flags[ty == 1].sum()),
        'botAttempts': int((ty == 1).sum()),
        'warning': 'Outlier is not bot proof, and this model cannot be used as a ban policy.'
    }
    return results


def evaluate(data_path, provenance_path):
    report = {
        'phase': 5, 'artifactType': 'PRIVATE_APPLICATION_RESEARCH_ONLY',
        'modelEnabled': False, 'modelPromoted': False, 'productionBlocking': False,
        'featureVersion': 'lava-robust-v2', 'splitSeed': SEED,
        'source': 'Locally consenting self-reports and declared automation; never independent identity attestation',
        'operationalMeaning': 'Experiment; a behavioral model cannot prove a real person stirred the lamp',
    }
    rows, errors = parse_rows(data_path, provenance_path)
    report['applicationAttempts'] = len(rows)
    report['declaredHumanAttempts'] = sum(r.label == 0 for r in rows)
    report['declaredBotAttempts'] = sum(r.label == 1 for r in rows)
    report['independentHumanStudyCodes'] = len({r.group for r in rows if r.label == 0})
    report['declaredIndependentBotFamilies'] = len({r.group for r in rows if r.label == 1})
    report['deviceCounts'] = dict(Counter(r.device for r in rows))
    if errors:
        report['status'] = 'NOT_READY_NO_OPT_IN_DATA' if not data_path.exists() else 'NOT_READY_DATA_VALIDATION_ERRORS'
        report['problems'] = errors[:25]
        report['remainingProblemCount'] = max(0, len(errors)-25)
        return report
    if report['independentHumanStudyCodes'] < 8:
        report['status'] = 'NOT_READY_NEED_AT_LEAST_EIGHT_DISTINCT_CONSENTING_HUMAN_CODES'
        report['notes'] = 'Eight is only a minimum to exercise grouped splits, NOT enough to establish low false-positive rates.'
        return report
    if report['declaredIndependentBotFamilies'] < 3:
        report['status'] = 'NOT_READY_NEED_THREE_DISTINCT_DECLARED_BOT_GENERATOR_FAMILIES'
        return report
    try:
        parts = assign_splits(rows)
    except ValueError as e:
        report['status'] = 'NOT_READY_COHORT_INTEGRITY'
        report['problems'] = [str(e)]
        return report
    report['splitCounts'] = {name: {'humanAttempts': int(sum(r.label == 0 for r in rs)),
                                    'botAttempts': int(sum(r.label == 1 for r in rs)),
                                    'humanGroups': len({r.group for r in rs if r.label == 0}),
                                    'botGeneratorFamilies': len({r.group for r in rs if r.label == 1})}
                             for name, rs in parts.items()}
    report['identityAndBotFamilyOverlap'] = False
    report['modelExperiments'] = train_and_score(parts)
    report['status'] = 'OFFLINE_CANDIDATES_EVALUATED_NOT_VALIDATED_FOR_DEPLOYMENT'
    report['limitations'] = [
        'Human study codes are self-reported, not verified unique individuals.',
        'Bot generator families are operator-declared; holdouts do not cover adaptive attackers.',
        'Attempt-level Wilson intervals are NOT independent-human confidence intervals.',
        'Calibration targets empirical FPR on a small split; it is NOT a bound on deployment FPR.',
        'All browser-side features, bubble-target claims and timestamps are forgeable.',
        'Mouse-trained scores cannot be used to deny touch, pen, assistive or unstudied devices.',
        'No model is exported to Worker and no threshold is promoted automatically.'
    ]
    return report


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--data', type=Path, default=ROOT/'ml/private/consenting-features.jsonl')
    p.add_argument('--provenance', type=Path, default=ROOT/'ml/private/phase5-provenance.json')
    p.add_argument('--out', type=Path, default=ROOT/'ml/private/phase5-report.json')
    args = p.parse_args(argv)
    report = evaluate(args.data, args.provenance)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    print(f"Phase 5: {report['status']}")
    print(f"Human codes: {report['independentHumanStudyCodes']}; bot families: {report['declaredIndependentBotFamilies']}")
    print(f"Private report: {args.out}")
    return 0 if report['status'].startswith(('OFFLINE_', 'NOT_READY_')) else 1


if __name__ == '__main__':
    raise SystemExit(main())
