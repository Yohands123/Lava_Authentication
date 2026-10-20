"""Predeclared development experiments. Never receives final test participants."""
from collections import Counter, defaultdict
from html import escape
import numpy as np
from study_data import assign_cohorts, ROBUST_KEYS, RESPONSE_KEYS, SEED, canonical, digest
from study_models import train_and_score, matrix, labels, rate_summary
from automation_environment import development_environment_comparison


def acquisition_audit(rows):
    counts = Counter((r['label'], r['capture']['acquisition'], r['capture']['cadenceMs'], r['device']) for r in rows)
    return {'cells': [{'declaredLabel': k[0], 'acquisition': k[1], 'requestedCadenceMs': k[2], 'declaredDevice': k[3], 'attempts': n} for k, n in sorted(counts.items())],
        'status': 'DESCRIPTIVE_ONLY' if {r['label'] for r in rows} == {'human', 'bot'} else 'NO_MATCHED_HUMAN_AUTOMATION_CONTROL',
        'metadataUsedAsBehaviorPredictors': False, 'warning': 'Acquisition, participant, source, run and label are excluded from model inputs. Cross-tabs are nuisance controls, not accuracy.'}


def related_rows(rows, family):
    selected, nodes = set(), set()
    signatures = []
    for r in rows:
        keys = {'session:' + r['session'], 'path:' + r['signatures']['path'], 'raw:' + r['signatures']['raw']}
        if r['label'] == 'bot': keys |= {'family:' + r['generator']['family'], 'run:' + r['generator']['run'], 'lineage:' + r['generator']['trajectory']}
        else: keys.add('human:' + r['participant'])
        signatures.append(keys)
    nodes.add('family:' + family)
    changed = True
    while changed:
        changed = False
        for i, keys in enumerate(signatures):
            if i not in selected and keys & nodes: selected.add(i); nodes |= keys; changed = True
    return selected


def run_development_experiments(fitting_rows, dataset_hash, variants=None):
    report = {'scope': 'Primary fitting cohort only; final calibration/test excluded', 'noModelSelection': True,
              'sequenceModel': 'NOT_JUSTIFIED: no sufficient independent application-human sequence corpus', 'acquisition': acquisition_audit(fitting_rows),
              'automationEnvironmentComparison': development_environment_comparison(fitting_rows, dataset_hash)}
    try: parts, frozen = assign_cohorts(fitting_rows, seed=SEED + ':development')
    except ValueError as error:
        report['status'] = 'NOT_READY_DEVELOPMENT_COHORTS'; report['reason'] = str(error); return report
    split_hash = digest(canonical(frozen))
    report['status'] = 'DESCRIPTIVE_DEVELOPMENT_EXPERIMENTS'
    report['ablations'] = {}
    subsets = {'robust12': ROBUST_KEYS, 'withoutDerivativeMagnitude': tuple(k for k in ROBUST_KEYS if k not in ('speedP95', 'accelP95', 'jerkP95', 'curvatureP95')),
               'withoutCorrectionRates': tuple(k for k in ROBUST_KEYS if k not in ('reversalRate', 'correctionRate'))}
    targets_available = all(r['experimental']['features']['targetCoverage'] >= .5 for r in fitting_rows)
    if targets_available:
        subsets['robustAndDynamicResponse'] = ROBUST_KEYS + tuple(k for k in RESPONSE_KEYS if k not in ('cadenceCv', 'reactionShare', 'correctionPauseShare'))
        subsets['withAcquisitionTimingControl'] = ROBUST_KEYS + RESPONSE_KEYS
    report['bubbleResponseComparison'] = 'AVAILABLE_DESCRIPTIVE_ONLY' if targets_available else 'NOT_READY_MATCHED_HUMAN_TARGET_OBSERVATIONS'
    for name, keys in subsets.items():
        result, _, predictors = train_and_score(parts, keys, dataset_hash, split_hash)
        report['ablations'][name] = result
        if name == 'robust12' and variants:
            report['fixedModelPerturbations'] = {}
            for variant in sorted({v for row in variants.values() for v in row}):
                held = [r for r in parts['test'] if r['id'] in variants and variant in variants[r['id']]]
                if len(held) != len(parts['test']):
                    report['fixedModelPerturbations'][variant] = {'status': 'INCOMPLETE_MATCHED_CAPTURE_SET'}; continue
                changed = [{**r, 'robust': variants[r['id']][variant]['robust']} for r in held]
                variant_results = {}
                for model, (predict, threshold) in predictors.items():
                    p, baseline = predict(matrix(changed)), predict(matrix(held))
                    variant_results[model] = rate_summary(labels(held), p, threshold) | {'medianAbsoluteScoreDelta': float(np.median(np.abs(p-baseline))), 'decisionFlipN': int(((p >= threshold) != (baseline >= threshold)).sum())}
                report['fixedModelPerturbations'][variant] = variant_results
    report['leaveOneGeneratorFamilyOut'] = {}
    for family in sorted({r['generator']['family'] for r in fitting_rows if r['label'] == 'bot'}):
        related = related_rows(fitting_rows, family)
        excluded = {fitting_rows[i]['id'] for i in related}
        fold = {name: [r for r in rs if r['id'] not in excluded] for name, rs in parts.items()}
        fold['test'] = [r for r in parts['test'] if r['label'] == 'human'] + [r for r in fitting_rows if r['label'] == 'bot' and r['generator']['family'] == family]
        if any({r['label'] for r in rs} != {'human', 'bot'} for rs in fold.values()):
            report['leaveOneGeneratorFamilyOut'][family] = {'status': 'NOT_READY_INDEPENDENT_DEVELOPMENT_GROUPS'}; continue
        result, _, _ = train_and_score(fold, ROBUST_KEYS, dataset_hash, split_hash)
        report['leaveOneGeneratorFamilyOut'][family] = {'scope': 'Reused development humans; do not pool across folds', 'models': result}
    return report


def render_reliability_html(models):
    """Standalone private SVG plots; no network, raw paths or study identifiers."""
    chunks = ['<!doctype html><meta charset="utf-8"><title>Private Phase 5 calibration</title><h1>Private descriptive calibration</h1><p>Correlated attempt counts; no validated deployment probability. Empty final-test plots mean the final test remains untouched.</p>']
    for name, model in models.items():
        if not isinstance(model, dict) or 'calibrationBins' not in model: continue
        points = ' '.join(f"{40+300*b['meanScore']:.3f},{340-300*b['observedBotFraction']:.3f}" for b in model['calibrationBins'] if b['n'])
        chunks.append(f'<h2>{escape(name)}</h2><svg viewBox="0 0 380 380" width="380" role="img" aria-label="Reliability diagram"><path d="M40 40V340H340 M40 340L340 40" stroke="#888" fill="none"/><polyline points="{points}" fill="none" stroke="#1265a8" stroke-width="3"/><text x="70" y="375">Mean model score</text></svg>')
    return '\n'.join(chunks)
