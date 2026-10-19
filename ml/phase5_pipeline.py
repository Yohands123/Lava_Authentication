"""Application research only. No automatic collection, promotion or deployment."""
import argparse
import json
from pathlib import Path
import platform
from study_data import load_dataset, assign_cohorts, ROBUST_KEYS, SEED, canonical, digest
from study_models import train_and_score
from study_experiments import acquisition_audit, run_development_experiments, render_reliability_html
from automation_environment import environment_audit

ROOT = Path(__file__).resolve().parents[1]
PRIVATE = ROOT/'ml/private'


def split_groups(groups):
    """Starter-compatible utility. Actual fitting uses the connected cohort graph."""
    ordered = sorted(set(groups), key=lambda group: digest(SEED + ':' + group))
    if len(ordered) < 3: raise ValueError('Need at least three groups')
    n, cal = len(ordered), max(1, len(ordered)//5)
    train = min(max(1, int(n*.6)), n-cal-1)
    return {'train': set(ordered[:train]), 'calibration': set(ordered[train:train+cal]), 'test': set(ordered[train+cal:])}


def evaluate(data_path, provenance_path=None, *, final_test=False, experiments=False, frozen=None, variants=None):
    path = Path(data_path)
    manifest = path.parent/'manifest.json'
    dataset = load_dataset(path, manifest if manifest.exists() else None, path.parent/'withdrawals.json')
    rows = dataset.eligible
    human_codes = {r['participant'] for r in rows if r['label'] == 'human'}
    bot_families = {r['generator']['family'] for r in rows if r['label'] == 'bot'}
    report = {'phase': 5, 'schema': 'lava-phase5-report-v3', 'modelEnabled': False, 'modelPromoted': False, 'productionBlocking': False,
        'engineeringStatus': 'Infrastructure present; this command does not certify test completion',
        'applicationAttempts': len(dataset.records), 'eligibleAttempts': len(rows),
        'declaredHumanAttempts': sum(r['label'] == 'human' for r in dataset.records),
        'declaredBotAttempts': sum(r['label'] == 'bot' for r in dataset.records),
        'allDeclaredBotFamilies': len({r['generator']['family'] for r in dataset.records if r['label'] == 'bot'}),
        'independentHumanStudyCodes': len(human_codes), 'declaredIndependentBotFamilies': len(bot_families),
        'datasetHash': dataset.content_hash, 'datasetVersion': 'phase5-' + dataset.content_hash[:16],
        'featureVersions': ['lava-robust-v2', 'lava-response-v3'], 'splitSeed': SEED,
        'datasetAudit': dataset.audit, 'acquisitionControls': acquisition_audit(dataset.records), 'automationEnvironment': environment_audit(dataset.records),
        'automationEnvironmentComparison': {'status': 'NOT_RUN_REQUIRES_ELIGIBLE_MATCHED_DATA_AND_EXPERIMENTS', 'productionInfluence': False, 'artifactExported': False, 'scope': 'Primary fitting cohort only; final cohorts excluded'},
        'environment': {'python': platform.python_version()}, 'finalTestEvaluated': False,
        'missingRequirements': [], 'limitations': [
            'Self-reported codes are not verified unique people or guaranteed anonymity.',
            'Client samples, outcome claims, generator declarations and timing are forgeable.',
            'Incomplete and unlabeled attempts are audited, never labeled from CLEAR or passkeys.',
            'Attempt-level intervals do not establish population FPR. Eight codes is only a pipeline minimum.',
            'No permanent/model BLOCK, automatic promotion, remote fitting or deployment.',
        ]}
    if dataset.audit['invalidRecords']:
        report['status'] = 'NOT_READY_DATA_VALIDATION_ERRORS'; report['missingRequirements'] = ['Resolve validation/label/integrity conflicts without changing labels to improve results']; return report
    if not human_codes:
        report['status'] = 'NOT_READY_NO_ELIGIBLE_OPT_IN_DATA' if report['declaredHumanAttempts'] else 'NOT_READY_NO_OPT_IN_DATA'; report['missingRequirements'] = ['Genuine consenting application-human attempts across independent study codes/devices', 'Prospectively frozen matched human/bot cohorts and broader independent runs; bot-only captures do not establish generalization']; return report
    if len(human_codes) < 8:
        report['status'] = 'NOT_READY_NEED_AT_LEAST_EIGHT_DISTINCT_CONSENTING_HUMAN_CODES'; report['missingRequirements'] = ['At least eight eligible declared human codes (not a scientifically sufficient study)']; return report
    if len(bot_families) < 3:
        report['status'] = 'NOT_READY_NEED_THREE_DISTINCT_DECLARED_BOT_GENERATOR_FAMILIES'; report['missingRequirements'] = ['At least three eligible independent bot families and both labels in each preassigned cohort']; return report
    try: parts, cohorts = assign_cohorts(rows, frozen, related_records=dataset.records)
    except ValueError as error:
        report['status'] = 'NOT_READY_COHORT_INTEGRITY'; report['problems'] = [str(error)]; return report
    split_hash = digest(canonical(cohorts))
    report['splitHash'] = split_hash
    report['splitCounts'] = {name: {'attempts': len(values), 'humanAttempts': sum(r['label'] == 'human' for r in values), 'botAttempts': sum(r['label'] == 'bot' for r in values),
        'humanCodes': len({r['participant'] for r in values if r['label'] == 'human'}), 'botFamilies': len({r['generator']['family'] for r in values if r['label'] == 'bot'})} for name, values in parts.items()}
    models, candidate, _ = train_and_score(parts, ROBUST_KEYS, dataset.content_hash, split_hash, evaluate_test=final_test)
    report['identityAndBotFamilyOverlap'] = False
    report['modelExperiments'] = models
    report['finalTestEvaluated'] = final_test
    report['status'] = 'OFFLINE_CANDIDATES_EVALUATED_NOT_VALIDATED_FOR_DEPLOYMENT' if final_test else 'OFFLINE_CANDIDATES_CALIBRATED_FINAL_TEST_UNTOUCHED'
    report['sequenceModel'] = 'Not added: independent real-human sequence diversity has not justified the complexity'
    report['developmentExperiments'] = run_development_experiments(parts['train'], dataset.content_hash, variants) if experiments else {'status': 'NOT_RUN_REQUEST_EXPERIMENTS_EXPLICITLY', 'scope': 'Only primary fitting participants/families; no final cohort access'}
    if experiments: report['automationEnvironmentComparison'] = report['developmentExperiments']['automationEnvironmentComparison']
    report['_candidate'], report['_cohorts'] = candidate, cohorts
    return report


def private_path(path):
    if PRIVATE.is_symlink(): raise ValueError('Private root must not be a symlink')
    resolved = Path(path).resolve()
    if not resolved.is_relative_to(PRIVATE.resolve()) or resolved == PRIVATE.resolve(): raise ValueError('Phase 5 inputs/outputs must stay inside ignored ml/private/')
    return resolved


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--data', type=Path, default=PRIVATE/'phase5/records.jsonl')
    parser.add_argument('--out', type=Path, default=PRIVATE/'phase5-report.json')
    parser.add_argument('--experiments', action='store_true')
    parser.add_argument('--variants', type=Path)
    parser.add_argument('--evaluate-test', action='store_true', help='Explicitly score the frozen final test once; never selects thresholds')
    parser.add_argument('--acknowledge-test-reuse', action='store_true', help='Marks any repeated final evaluation exploratory, never untouched')
    args = parser.parse_args(argv)
    try: path, output = private_path(args.data), private_path(args.out)
    except ValueError as error: parser.error(str(error))
    if path.exists() and not (path.parent/'manifest.json').exists(): parser.error('Existing study data requires its import-generated manifest; do not recreate provenance by hand')
    folder = PRIVATE/'phase5'
    freeze_path, lock_path = folder/'cohorts.json', folder/'final-evaluation-lock.json'
    frozen = json.loads(freeze_path.read_text()) if freeze_path.exists() else None
    reused = args.evaluate_test and lock_path.exists()
    if reused and not args.acknowledge_test_reuse: parser.error('Final test already evaluated; explicit --acknowledge-test-reuse required, results become exploratory')
    variants = None
    if args.variants:
        artifact = json.loads(private_path(args.variants).read_text())
        if artifact.get('schema') != 'lava-perturbations-v1' or not path.exists() or artifact.get('datasetHash') != digest(path.read_bytes()): parser.error('Perturbations must match the exact current dataset hash')
        variants = artifact['variants']
    report = evaluate(path, final_test=args.evaluate_test, experiments=args.experiments, frozen=frozen, variants=variants)
    report['finalTestReuseAcknowledged'] = bool(reused)
    if '_candidate' in report:
        folder.mkdir(parents=True, exist_ok=True)
        (folder/'candidate-review.json').write_text(json.dumps(report.pop('_candidate'), indent=2, allow_nan=False)+'\n', encoding='utf-8')
        (folder/'cohorts.json').write_text(canonical(report.pop('_cohorts'))+'\n', encoding='utf-8')
        (folder/'reliability.html').write_text(render_reliability_html(report['modelExperiments']), encoding='utf-8')
        if args.evaluate_test: lock_path.write_text(canonical({'schema': 'lava-final-lock-v1', 'datasetHash': report['datasetHash'], 'splitHash': report['splitHash'], 'reuseAcknowledged': bool(reused)})+'\n', encoding='utf-8')
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2, allow_nan=False)+'\n', encoding='utf-8')
    print(json.dumps({key: report[key] for key in ('status', 'applicationAttempts', 'independentHumanStudyCodes', 'declaredIndependentBotFamilies', 'modelPromoted', 'finalTestEvaluated')}))
    print('Private report: ' + str(output))
    return 0


if __name__ == '__main__': raise SystemExit(main())
