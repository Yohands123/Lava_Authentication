"""Local synthetic engineering diagnostics and actual-count audit, no promotion."""
import copy
import json
from pathlib import Path
import platform
import sys
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from study_data import load_dataset, assign_cohorts, canonical, digest, ROBUST_KEYS
from study_test_fixtures import fixture_rows
from study_models import matrix, labels, choose_threshold, train_and_score
from automation_environment import development_environment_comparison

ROOT = Path(__file__).resolve().parents[1]


def write_fixture_cohort_manifest():
    """Reproduce metadata only; never fit/select a model or use application data."""
    _, cohorts = assign_cohorts(fixture_rows())
    fixture = json.loads((ROOT/'tests/fixtures/phase5-portable.json').read_text(encoding='utf-8'))
    content = canonical(cohorts)+'\n'
    if digest(canonical(cohorts)) != fixture['model']['splitHash']: raise ValueError('Synthetic fixture cohort lineage mismatch')
    folder = ROOT/'ml/private/phase6/registry'; folder.mkdir(parents=True,exist_ok=True)
    file = folder/('cohorts-'+fixture['model']['splitHash']+'.json')
    try:
        with file.open('x',encoding='utf-8') as stream: stream.write(content)
    except FileExistsError:
        if file.read_text(encoding='utf-8') != content: raise ValueError('Immutable fixture cohort manifest changed')


def negative_controls(rows):
    """Synthetic fixtures only; no application final cohort enters this function."""
    parts, frozen = assign_cohorts(rows)
    def source(r): return r['capture']['acquisition']
    categories = sorted({source(r) for r in parts['train']})
    def inputs(name, section):
        rs = parts[section]
        if name in ('behavior', 'label-shuffled-fitting'): return matrix(rs)
        if name == 'behavior-plus-response-v3': return matrix(rs, ROBUST_KEYS+tuple(rs[0]['experimental']['features']))
        if name == 'cadence-only': return np.asarray([[r['capture']['cadenceMs']] for r in rs], dtype=float)
        if name == 'browser-config-only': return np.asarray([[r['environment']['evidence']['signals']['webdriver'] is True] for r in rs], dtype=float)
        return np.asarray([[source(r) == c for c in categories] for r in rs], dtype=float)
    report = {}
    for name in ('behavior','behavior-plus-response-v3','cadence-only','browser-config-only','source-id-only','label-shuffled-fitting'):
        y = labels(parts['train']).copy()
        if name == 'label-shuffled-fitting': np.random.default_rng(6101).shuffle(y)
        model = make_pipeline(StandardScaler(), LogisticRegression(C=.1, max_iter=3000, random_state=6101))
        model.fit(inputs(name,'train'),y)
        cal = LogisticRegression(C=1.,random_state=6101)
        cal.fit(model.decision_function(inputs(name,'calibration')).reshape(-1,1),labels(parts['calibration']))
        def score(section): return cal.predict_proba(model.decision_function(inputs(name,section)).reshape(-1,1))[:,1]
        threshold = choose_threshold(score('calibration')[labels(parts['calibration']) == 0])
        p = score('test')
        report[name] = {'syntheticOnly':True,'generatedDevelopmentRows':len(p),'generatedLabelFlags':int((p>=threshold).sum()),
            'scoreMinimum':float(p.min()),'scoreMaximum':float(p.max()),'thresholdFrozenFromDevelopmentCalibration':True,
            'learnedSourceCategories':len(categories) if name == 'source-id-only' else None,'applicationAccuracy':None}
    return {'seed':6101,'splitHash':digest(canonical(frozen)),'counts':{k:len(v) for k,v in parts.items()},'controls':report,'productionInfluence':False}


def synthetic_diagnostics():
    rows = fixture_rows()
    for row in rows:
        bot = row['label'] == 'bot'
        row['environment'] = {'version':'lava-research-environment-v1','declaredEnvironment':'headless-playwright' if bot else 'ordinary-chrome',
            'declaredControl':'scripted' if bot else 'human','displayMode':'headless' if bot else 'headed',
            'evidence':{'version':'lava-automation-environment-v1','authority':'advisory','signals':{'webdriver':bot,'headlessUserAgent':bot,'headlessBrand':None}}}
    parts, frozen = assign_cohorts(rows)
    models, _, _ = train_and_score(parts,ROBUST_KEYS,'f'*64,digest(canonical(frozen)),evaluate_test=False)
    costs = {k:{field:v.get(field) for field in ('trainingMs','serializedPythonBytes','pythonTrackedPeakBytes','pythonSingleInferenceMs','nativeMemoryIncluded')} for k,v in models.items() if k != 'environment'}
    # Only primary fitting rows reach the environment development comparison.
    environment = development_environment_comparison(parts['train'],'f'*64)
    return {'syntheticOnly':True,'notStudyEvidence':True,'modelCosts':costs,'negativeControls':negative_controls(rows),
        'environmentComparisonStatus':environment['status'],'environmentVariantsExecuted':list(environment.get('variants',{})),
        'applicationModelFit':False,'finalApplicationCohortAccessed':False,'portableCandidateExported':False,
        'familyAndShiftTests':'Existing Phase 5 grouped/family/perturbation regression suite; new live seed 6102 is declared bot engineering only'}


def application_audit(root=ROOT):
    folder = root/'ml/private/phase5'
    data = load_dataset(folder/'records.jsonl',folder/'manifest.json',folder/'withdrawals.json')
    humans = [r for r in data.records if r['label'] == 'human']
    return {'datasetHash':data.content_hash,'attempts':len(data.records),'eligible':len(data.eligible),
        'declaredHumanAttempts':len(humans),'declaredHumanCodes':len({r['participant'] for r in humans}),
        'declaredBotAttempts':sum(r['label'] == 'bot' for r in data.records),'audit':data.audit,
        'status':'NOT_READY_NO_OPT_IN_DATA' if not humans else 'REQUIRES_INDEPENDENT_PROVENANCE_AND_SUFFICIENCY_REVIEW',
        'humanPopulationFpr':None,'calibratedApplicationProbability':None,'participantGeneralization':None,
        'independentlyVettedHumanParticipants':0 if not humans else None}


def main():
    write_fixture_cohort_manifest()
    if sys.argv[1:] == ['--registry-metadata-only']:
        print('Reproduced synthetic cohort metadata only; no fitting or selection')
        return
    if sys.argv[1:]: raise ValueError('Only --registry-metadata-only is supported')
    report = {'schema':'lava-phase6-ml-engineering-v1','application':application_audit(),'syntheticEngineering':synthetic_diagnostics(),
        'productionEligibility':False,'modelPromoted':False,'python':platform.python_version(),
        'unknowns':['Matched genuine human acquisition/device/assistive cases','Independent agent/participant evaluation','Untouched prospective final cohorts'],
        'deepModel':'NOT_JUSTIFIED_WITHOUT_DATA'}
    target = ROOT/'ml/artifacts/phase6-ml.json'
    target.write_text(json.dumps(report,indent=2,allow_nan=False)+'\n',encoding='utf-8')
    print(json.dumps({'status':report['application']['status'],'models':list(report['syntheticEngineering']['modelCosts']),'applicationModelFit':False}))


if __name__ == '__main__': main()
