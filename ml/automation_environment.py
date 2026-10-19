"""Advisory context and shortcut diagnostics. Never a production predictor."""
from collections import Counter

VERSION = 'lava-automation-environment-v1'
SIGNALS = ('webdriver', 'headlessUserAgent', 'headlessBrand')
ENVIRONMENTS = {'unknown', 'ordinary-browser', 'ordinary-chrome', 'headed-playwright', 'headless-playwright', 'puppeteer', 'ghost-cursor', 'human-controlled-automation'}


def validate_environment(value):
    if not isinstance(value, dict) or set(value) != {'version', 'declaredEnvironment', 'declaredControl', 'displayMode', 'evidence'}: return False
    if any(not isinstance(value[k], str) for k in ('version', 'declaredEnvironment', 'declaredControl', 'displayMode')): return False
    if value['version'] != 'lava-research-environment-v1' or value['declaredEnvironment'] not in ENVIRONMENTS or value['declaredControl'] not in ('unknown', 'human', 'scripted', 'mixed') or value['displayMode'] not in ('unknown', 'headed', 'headless'): return False
    e = value['evidence']
    return (isinstance(e, dict) and set(e) == {'version', 'authority', 'signals'} and e['version'] == VERSION and e['authority'] == 'advisory'
            and isinstance(e['signals'], dict) and set(e['signals']) == set(SIGNALS) and all(e['signals'][k] is None or isinstance(e['signals'][k], bool) for k in SIGNALS))


def environment_audit(rows):
    observed = [r for r in rows if validate_environment(r.get('environment'))]
    cells = Counter((r['label'], r['environment']['declaredEnvironment'], r['environment']['declaredControl'], r['environment']['displayMode']) for r in observed)
    humans = [r for r in observed if r['label'] == 'human']
    return {'version': VERSION, 'authority': 'advisory', 'policyContribution': 0, 'recordsWithEvidence': len(observed), 'missingEvidenceRecords': len(rows)-len(observed),
        'missingEvidenceIsHuman': False, 'environmentLabelsAreDeclarations': True, 'productionBehaviorPredictorsChanged': False,
        'signalCounts': {k: {'available': sum(r['environment']['evidence']['signals'][k] is not None for r in observed), 'positive': sum(r['environment']['evidence']['signals'][k] is True for r in observed)} for k in SIGNALS},
        'cells': [{'label': k[0], 'declaredEnvironment': k[1], 'declaredControl': k[2], 'displayMode': k[3], 'attempts': n} for k, n in sorted(cells.items())],
        'declaredHumanAttemptsWithEvidence': len(humans), 'declaredHumanAttemptsWithPositiveHints': sum(any(r['environment']['evidence']['signals'][k] is True for k in SIGNALS) for r in humans),
        'humanPopulationExposureRate': None, 'humanPopulationFpr': None,
        'humanEvidenceStatus': 'NOT_ESTABLISHED_NO_HUMAN_ENVIRONMENT_DATA' if not humans else 'DECLARED_CORRELATED_ATTEMPTS_NOT_POPULATION_ESTIMATE',
        'limitations': ['No browser hint establishes who moves the pointer or detects an AI agent.', 'A human using an automation browser can expose the same signals.', 'VM and remote desktop status is not collected or inferred.', 'Unavailable and false signals are not evidence of humanity.']}


def environment_matrix(rows, scenario='observed'):
    """Separate diagnostics only: three positive bits and three availability bits."""
    import numpy as np
    values = []
    for r in rows:
        e = r['environment']['evidence']['signals']
        if scenario == 'all-positive': e = {k: True for k in SIGNALS}
        elif scenario == 'all-hidden': e = {k: False for k in SIGNALS}
        elif scenario == 'unavailable': e = {k: None for k in SIGNALS}
        values.append([int(e[k] is True) for k in SIGNALS] + [int(e[k] is not None) for k in SIGNALS])
    return np.asarray(values, dtype=float)


def development_environment_comparison(fitting_rows, dataset_hash):
    """Primary fitting cohort only. Independent dev calibration/test, no artifact."""
    report = {'version': VERSION, 'scope': 'Primary fitting cohort only; no final calibration/test access', 'productionInfluence': False, 'artifactExported': False,
              'risk': 'Environment/label correlation can teach an acquisition shortcut rather than behavior', 'audit': environment_audit(fitting_rows)}
    rows = [r for r in fitting_rows if validate_environment(r.get('environment'))]
    if {r['label'] for r in rows} != {'human', 'bot'}:
        return {**report, 'status': 'NOT_READY_MATCHED_HUMAN_BOT_ENVIRONMENT_DATA'}
    import numpy as np
    from sklearn.linear_model import LogisticRegression
    from sklearn.pipeline import make_pipeline
    from sklearn.preprocessing import StandardScaler
    from study_data import assign_cohorts, SEED, canonical, digest
    from study_models import matrix, labels, group_weights, choose_threshold, rate_summary
    try: parts, frozen = assign_cohorts(rows, seed=SEED + ':environment-development', related_records=fitting_rows)
    except ValueError as error: return {**report, 'status': 'NOT_READY_INDEPENDENT_ENVIRONMENT_DEVELOPMENT_COHORTS', 'reason': str(error)}
    train, cal, held = (parts[k] for k in ('train', 'calibration', 'test'))
    behavior = {k: matrix(v) for k, v in parts.items()}
    report.update(status='DIAGNOSTIC_ONLY_NOT_VALIDATED', datasetHash=dataset_hash, splitHash=digest(canonical(frozen)), variants={})
    def inputs(name, section, scenario='observed'):
        if name == 'behavior-only': return behavior[section]
        env = environment_matrix(parts[section], scenario)
        return env if name == 'environment-only' else np.column_stack((behavior[section], env))
    for name in ('behavior-only', 'environment-only', 'behavior-plus-environment'):
        model = make_pipeline(StandardScaler(), LogisticRegression(C=.1, class_weight='balanced', max_iter=3000, random_state=20261018))
        weights = group_weights(train)
        model.fit(inputs(name, 'train'), labels(train), standardscaler__sample_weight=weights, logisticregression__sample_weight=weights)
        calibrator = LogisticRegression(C=1., random_state=20261018)
        calibrator.fit(model.decision_function(inputs(name, 'calibration')).reshape(-1, 1), labels(cal), sample_weight=group_weights(cal))
        def score(section, scenario='observed'): return calibrator.predict_proba(model.decision_function(inputs(name, section, scenario)).reshape(-1, 1))[:, 1]
        threshold = choose_threshold(score('calibration')[labels(cal) == 0]); baseline = score('test')
        result = rate_summary(labels(held), baseline, threshold)
        result['calibrationThreshold'] = threshold
        result['counterfactualEnvironmentChanges'] = {}
        for scenario in ('all-positive', 'all-hidden', 'unavailable'):
            p = score('test', scenario)
            result['counterfactualEnvironmentChanges'][scenario] = {'decisionFlipN': int(((p >= threshold) != (baseline >= threshold)).sum()),
                'maxAbsoluteScoreDelta': float(np.max(np.abs(p-baseline))), 'humanFlagged': int(((p >= threshold) & (labels(held) == 0)).sum()), 'botMissed': int(((p < threshold) & (labels(held) == 1)).sum())}
        report['variants'][name] = result
    report['noHumanControlledAutomationValidation'] = not any(r['label'] == 'human' and r['environment']['declaredEnvironment'] == 'human-controlled-automation' for r in held)
    report['interpretation'] = 'Controlled counterfactual changes are sensitivity, not new people or measured genuine-user FPR. Do not promote these models.'
    return report
