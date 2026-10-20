"""Prospective Phase 7 study gates. No collection, uploads or model promotion.
All operator attestations are declarations, not cryptographic identity proof.
"""
from collections import Counter, defaultdict
import json
import math
import os
import re
from pathlib import Path
import numpy as np
from study_data import load_dataset, assign_cohorts, canonical, digest, ROBUST_KEYS
from study_models import train_and_score, matrix, rate_summary
from study_experiments import run_development_experiments

ROOT = Path(__file__).resolve().parents[1]


def app_source_hash():
    files = sorted([ROOT/'index.html', *(ROOT/'src').rglob('*.ts'), *(ROOT/'src').rglob('*.css')])
    return digest(canonical({str(p.relative_to(ROOT)).replace('\\', '/'): digest(p.read_bytes()) for p in files}))


def zero_error_upper(n, alpha=.05):
    if not isinstance(n, int) or isinstance(n, bool) or n < 0 or not 0 < alpha < 1:
        raise ValueError('Independent count and alpha required')
    return -math.expm1(math.log(alpha)/n) if n else None


def clustered_flags(participants, scores, threshold, seed=7019):
    """Any false flag within the first three prescheduled attempts per person.
    Missing scores remain unknown; no missing subject is counted as accepted.
    Bootstrap resamples people; attempts never become independent participants.
    """
    groups = defaultdict(list)
    for p, score in zip(participants, scores, strict=True):
        if score is not None and (type(score) not in (int, float) or not math.isfinite(score) or not 0 <= score <= 1):
            raise ValueError('Invalid score')
        groups[p].append(score)
    values = [1 if any(s is not None and s >= threshold for s in ss[:3]) else 0 if len(ss) >= 3 and all(s is not None for s in ss[:3]) else None for ss in groups.values()]
    known = [v for v in values if v is not None]
    n, flags, missing = len(values), sum(known), len(values)-len(known)
    interval = None
    if known:
        rng = np.random.default_rng(seed)
        interval = [float(v) for v in np.quantile([np.mean(rng.choice(known, len(known), replace=True)) for _ in range(1000)], [.025, .975])]
    return {'participants': n, 'participantsWithObservedFlag': flags, 'participantsWithUnknownOutcome': missing,
            'completeCaseFalseFlagRate': flags/len(known) if known else None,
            'missingOutcomeRange': [flags/n, (flags+missing)/n] if n else None,
            'participantBootstrap95': interval,
            'zeroErrorOneSided95Upper': zero_error_upper(len(known)) if known and flags == 0 else None,
            'populationRepresentativenessEstablished': False}


def supervised_audit(dataset, supervision, protocol):
    issues, exclusions, devices = [], Counter(), Counter()
    rows, by_id = dataset.records, {r['id']: r for r in dataset.records}
    protocol_hash = digest(canonical(protocol))
    if supervision.get('schema') != 'lava-supervised-study-v1' or supervision.get('protocolHash') != protocol_hash:
        issues.append('missing_or_mismatched_supervision_manifest')
    if supervision.get('approval') != 'OWNER_APPROVED' or supervision.get('ethicsReview') not in ('APPROVED', 'OWNER_DOCUMENTED_NOT_APPLICABLE'):
        issues.append('study_design_not_approved')
    if supervision.get('datasetHash') != dataset.content_hash: issues.append('supervision_dataset_hash_mismatch')
    entries = supervision.get('attempts', {})
    if not isinstance(entries, dict): entries = {}; issues.append('malformed_attempt_manifest')
    if set(entries) != set(by_id): issues.append('attempt_manifest_coverage_mismatch')
    eligible, human_codes, pilot = [], set(), 0
    arms = defaultdict(set)
    for r in rows:
        m = entries.get(r['id'], {})
        if isinstance(m, dict): arms[r['participant']].add(m.get('arm'))
    if any(len(a) > 1 for a in arms.values()): issues.append('pilot_prospective_participant_overlap')
    for r in rows:
        meta = entries.get(r['id'], {})
        devices[r['device']] += 1
        reasons = []
        if not isinstance(meta, dict): meta = {}; reasons.append('malformed_attempt_manifest')
        if meta.get('consentStatus') != 'current' or meta.get('beforeFirstSample') is not True: reasons.append('consent_invalid_or_missing')
        times = [meta.get(k) for k in ('consentMs', 'captureStartMs', 'firstSampleMs')]
        if not all(type(t) in (int, float) and math.isfinite(t) and t >= 0 for t in times) or (all(type(t) in (int, float) for t in times) and not times[0] <= times[1] <= times[2]): reasons.append('consent_timing_unverified')
        if meta.get('participant') != r['participant'] or meta.get('session') != r['session']: reasons.append('participant_or_session_continuity_mismatch')
        if meta.get('arm') not in ('pilot', 'prospective'): reasons.append('study_arm_missing')
        if not isinstance(meta.get('deviceCode'), str) or not 8 <= len(meta['deviceCode']) <= 64: reasons.append('declared_device_lineage_missing')
        if r['device'] == 'unknown': reasons.append('device_unknown')
        matched = protocol['matchedCapture']
        if meta.get('appSourceHash') != matched.get('requiredAppSourceHash') or not matched.get('requiredAppSourceHash'): reasons.append('app_revision_unfrozen_or_mismatched')
        if r['capture']['cadenceMs'] != matched['cadenceMs'] or r['capture']['maxSamples'] != matched['maxSamples'] or r['capture']['modelMode'] != matched['modelMode']:
            reasons.append('unmatched_capture_configuration')
        if r['label'] == 'human' and meta.get('supervisedHuman') is not True: reasons.append('human_operator_not_supervised')
        if r['label'] == 'bot' and any(not isinstance(meta.get(k), str) or not meta[k] for k in ('scriptHash', 'sourceHash', 'modelFamily')): reasons.append('automation_source_lineage_missing')
        if reasons: exclusions.update(reasons); continue
        if meta['arm'] == 'pilot': pilot += 1; continue
        if r['label'] == 'human': human_codes.add(r['participant'])
        eligible.append(r)
    if exclusions: issues.append('supervision_or_consent_validation_failed')
    return eligible, {'issues': sorted(set(issues)), 'exclusions': dict(exclusions), 'devices': dict(devices), 'pilotAttempts': pilot,
                      'supervisedDeclaredHumanCodes': len(human_codes), 'protocolHash': protocol_hash}


def validate_linkage(parts, supervision):
    seen = {}
    for cohort, rows in parts.items():
        for r in rows:
            m = supervision['attempts'][r['id']]
            links = [('participant', r['participant']), ('session', r['session']), ('sharedDevice', m['deviceCode'])]
            if r['label'] == 'bot':
                links += [(k, m[k]) for k in ('scriptHash', 'sourceHash', 'modelFamily')]
                links += [('generatorFamily', r['generator']['family']), ('generatorSeed', r['generator']['seed']), ('run', r['generator']['run']), ('lineage', r['generator']['trajectory'])]
            links += [('path', r['signatures']['path']), ('raw', r['signatures']['raw'])]
            for key in links:
                if key in seen and seen[key] != cohort: raise ValueError('related_groups_cross_frozen_cohorts:' + key[0])
                seen[key] = cohort


def readiness(path, protocol, supervision, frozen=None, *, final=True):
    path = Path(path)
    dataset = load_dataset(path, path.parent/'manifest.json', path.parent/'withdrawals.json')
    # The existing withdrawal command revokes globally before deleting. A failed
    # Phase 7 file deletion must still prevent re-use of its rows.
    global_ledger = path.parent.parent/'phase5/withdrawals.json'
    if global_ledger.exists():
        ledger = json.loads(global_ledger.read_text(encoding='utf-8'))
        if any(digest(r['participant']) in ledger.get('participantHashes', []) or digest(r['id']) in ledger.get('attemptHashes', []) for r in dataset.records):
            dataset.audit['invalidRecords'] += 1
            dataset.audit['exclusions']['globally_withdrawn_record'] = len(dataset.records)
    report = {'schema': 'lava-phase7a-readiness-v1', 'status': 'NOT_READY_NO_OPT_IN_DATA',
              'genuineHumanParticipants': 0, 'declaredHumanAttempts': sum(r['label'] == 'human' for r in dataset.records),
              'applicationAttempts': len(dataset.records), 'datasetHash': dataset.content_hash, 'datasetAudit': dataset.audit,
              'humanFalseFlagRate': None, 'accuracy': None, 'calibration': None, 'finalTestEvaluated': False,
              'productionEligible': False, 'supervisedAttestationsAreNotIdentityProof': True, 'modelPromoted': False}
    report['currentAppSourceHashForOwnerReview'] = app_source_hash()
    supervised, audit = supervised_audit(dataset, supervision, protocol)
    if path.exists() and (not (path.parent/'manifest.json').is_file() or (path.parent/'manifest.json').is_symlink()): audit['issues'].append('dataset_manifest_required')
    report['supervisionAudit'] = audit
    # Files can contain operator declarations; code cannot attest that they are
    # truthful human identities. Zero records establishes zero enrollments here.
    report['genuineHumanParticipants'] = None if report['declaredHumanAttempts'] else 0
    report['supervisedDeclaredHumanCodes'] = audit['supervisedDeclaredHumanCodes']
    if dataset.audit['invalidRecords'] or audit['issues'] or not audit['supervisedDeclaredHumanCodes']:
        report['status'] = 'NOT_READY_NO_OPT_IN_DATA' if not report['declaredHumanAttempts'] else 'NOT_READY_STUDY_GOVERNANCE_OR_DATA'
        return report, None
    # Never infer pilot membership, consent timing or supervision from old exports.
    ids = {r['id'] for r in supervised}
    eligible = [r for r in dataset.eligible if r['id'] in ids]
    try:
        parts, cohorts = assign_cohorts(eligible, frozen, related_records=supervised)
        validate_linkage(parts, supervision)
    except (KeyError, ValueError) as error:
        report['status'] = 'NOT_READY_COHORT_INTEGRITY'; report['problems'] = [str(error).split(':')[0]]; return report, None
    counts = {c: len({r['participant'] for r in rs if r['label'] == 'human'}) for c, rs in parts.items()}
    report['independentDeclaredHumanCodesByCohort'] = counts
    if len({r['generator']['family'] for r in parts['test'] if r['label'] == 'bot'}) < protocol['minimumHeldOutBotFamilies']:
        report['status'] = 'NOT_READY_INDEPENDENT_GENERATOR_HOLDOUT'; return report, None
    def declared_cohort_matches(r):
        primary = 'bot-family:'+r['generator']['family'] if r['label'] == 'bot' else ('human:' if r['label'] == 'human' else 'unlabeled:')+r['participant']
        return supervision['attempts'][r['id']].get('cohort') == cohorts['assignments'].get(digest(primary))
    if any(not declared_cohort_matches(r) for r in supervised):
        report['status'] = 'NOT_READY_SUPERVISION_COHORT_MISMATCH'; return report, None
    if any(counts[c] < protocol['minimumIndependentHumans'][c] for c in counts):
        report['status'] = 'NOT_READY_PROSPECTIVE_SAMPLE_MINIMUM'; return report, None
    if frozen is None or digest(canonical(cohorts)) != supervision.get('cohortHash'):
        report['status'] = 'NOT_READY_UNFROZEN_COHORTS'; return report, None
    if protocol['approvalStatus'] != 'OWNER_APPROVED' or final and supervision.get('independentEvaluationApproval') is not True:
        report['status'] = 'NOT_READY_INDEPENDENT_REVIEW'; return report, None
    if protocol['matchedCapture'].get('requiredAppSourceHash') != app_source_hash():
        report['status'] = 'NOT_READY_APP_SOURCE_CHANGED'; return report, None
    threshold = supervision.get('frozenThreshold')
    if final and (type(threshold) not in (int, float) or not math.isfinite(threshold) or not 0 <= threshold <= 1):
        report['status'] = 'NOT_READY_FROZEN_THRESHOLD'; return report, None
    if final and not re.fullmatch('[a-f0-9]{64}', str(supervision.get('frozenCandidateHash', ''))):
        report['status'] = 'NOT_READY_FROZEN_CANDIDATE'; return report, None
    report['status'] = 'READY_FOR_EXPLICIT_LOCAL_FINAL_EVALUATION_ONLY' if final else 'READY_FOR_LOCAL_DEVELOPMENT_ONLY'
    return report, (parts, cohorts, supervised)


def prepare_cohorts(path, protocol, supervision):
    path = Path(path)
    initial = readiness(path, protocol, supervision)[0]
    if initial['datasetAudit']['invalidRecords'] or initial['supervisionAudit']['issues']: return initial, None
    dataset = load_dataset(path, path.parent/'manifest.json', path.parent/'withdrawals.json')
    supervised, audit = supervised_audit(dataset, supervision, protocol)
    if dataset.audit['invalidRecords'] or audit['issues'] or not audit['supervisedDeclaredHumanCodes']:
        return readiness(path, protocol, supervision)[0], None
    ids = {r['id'] for r in supervised}
    parts, cohorts = assign_cohorts([r for r in dataset.eligible if r['id'] in ids], related_records=supervised)
    validate_linkage(parts, supervision)
    return {'schema': 'lava-phase7-cohort-proposal-v1', 'status': 'PROPOSED_REQUIRES_OWNER_REVIEW', 'datasetHash': dataset.content_hash,
            'protocolHash': digest(canonical(protocol)), 'cohortHash': digest(canonical(cohorts)), 'finalAccess': False,
            'counts': {c:len(rows) for c,rows in parts.items()}}, cohorts


def develop(path, protocol, supervision, frozen):
    report, prepared = readiness(path, protocol, supervision, frozen, final=False)
    if prepared is None: return report
    parts, cohorts, _ = prepared
    # The development call receives no final feature rows, even though the
    # baseline's evaluate_test=False also guards against test prediction.
    results, candidate, predictors = train_and_score({**parts, 'test': []}, ROBUST_KEYS, report['datasetHash'], digest(canonical(cohorts)), evaluate_test=False)
    report.update(schema='lava-phase7a-development-v1', status='DEVELOPMENT_CALIBRATED_FINAL_UNTOUCHED', frozenThresholdForReview=predictors[protocol['primaryModel']][1], candidateHash=digest(canonical(candidate)), developmentModels=results)
    report['_candidate'] = candidate
    return report


def evaluate_final(path, protocol, supervision, frozen, lock_path):
    report, prepared = readiness(path, protocol, supervision, frozen)
    if prepared is None: return report
    # Reserve BEFORE fitting/accessing held-out rows. A crash retains a consumed
    # evaluation lock; it does not silently reset an allegedly untouched cohort.
    lock_path = Path(lock_path)
    if lock_path.is_symlink(): raise ValueError('Symlink lock refused')
    fd = os.open(lock_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, 'w') as out:
        out.write(canonical({'schema': 'lava-phase7-final-lock-v1', 'datasetHash': report['datasetHash'], 'protocolHash': digest(canonical(protocol)), 'state': 'reserved_before_final_access'}))
    parts, cohorts, supervised = prepared
    _results, candidate, predictors = train_and_score({**parts, 'test': []}, ROBUST_KEYS, report['datasetHash'], digest(canonical(cohorts)), evaluate_test=False)
    chosen = protocol['primaryModel']
    predict, threshold = predictors[chosen]
    # A prospective external review pins the calibration-only threshold. No
    # candidate or threshold can be selected using final results.
    if supervision.get('frozenThreshold') != threshold: raise ValueError('Frozen threshold mismatch; lock retained')
    if supervision.get('frozenCandidateHash') != digest(canonical(candidate)): raise ValueError('Frozen candidate mismatch; lock retained')
    held = parts['test']; tx = matrix(held, ROBUST_KEYS); fitting = matrix(parts['train'], ROBUST_KEYS)
    supported_devices = {r['device'] for r in parts['train']}
    supported = np.array([r['device'] in supported_devices for r in held]) & ~((tx < fitting.min(axis=0)-.01) | (tx > fitting.max(axis=0)+.01)).any(axis=1)
    scores = predict(tx); score_map = {r['id']: float(s) if ok else None for r, s, ok in zip(held, scores, supported)}
    report['evaluationCoverage'] = {'eligibleFinalAttempts': len(held), 'scored': int(supported.sum()), 'oodAbstentions': int((~supported).sum())}
    report['attemptMetrics'] = rate_summary(np.array([int(r['label'] == 'bot') for r in held])[supported], scores[supported], threshold)
    report['developmentComparisons'] = {n: rate_summary(np.array([int(r['label'] == 'bot') for r in parts['calibration']]), fn(matrix(parts['calibration'], ROBUST_KEYS)), t) for n, (fn,t) in predictors.items()}
    report['environmentComparison'] = run_development_experiments(parts['train'], report['datasetHash'])['automationEnvironmentComparison']
    # Cohort assignment of incomplete subjects must be prospectively supplied;
    # they stay in the primary denominator with unknown score.
    humans = [r for r in supervised if r['label'] == 'human' and supervision['attempts'][r['id']].get('cohort') == 'test']
    humans.sort(key=lambda r: supervision['attempts'][r['id']]['captureStartMs'])
    report['participantEndpoint'] = clustered_flags([r['participant'] for r in humans], [score_map.get(r['id']) for r in humans], threshold)
    report['perDevice'] = {d: clustered_flags([r['participant'] for r in humans if r['device'] == d], [score_map.get(r['id']) for r in humans if r['device'] == d], threshold) for d in sorted({r['device'] for r in humans})}
    environments = {r.get('environment', {}).get('declaredEnvironment', 'unknown') for r in humans}
    report['perDeclaredEnvironment'] = {e: clustered_flags([r['participant'] for r in humans if r.get('environment', {}).get('declaredEnvironment', 'unknown') == e], [score_map.get(r['id']) for r in humans if r.get('environment', {}).get('declaredEnvironment', 'unknown') == e], threshold) for e in sorted(environments)}
    report['finalTestEvaluated'] = True; report['selectedPolicy'] = chosen; report['threshold'] = threshold
    report['status'] = 'EVALUATED_LOCALLY_REQUIRES_INDEPENDENT_VALIDATION'
    return report


def main():
    import argparse
    p = argparse.ArgumentParser(description=__doc__)
    mode = p.add_mutually_exclusive_group()
    mode.add_argument('--evaluate-final', action='store_true')
    mode.add_argument('--prepare-cohorts', action='store_true')
    mode.add_argument('--development', action='store_true')
    args = p.parse_args()
    protocol = json.loads((ROOT/'ml/study-protocol.json').read_text(encoding='utf-8'))
    folder = ROOT/'ml/private/phase7a'
    from study_withdraw import checked
    private = ROOT/'ml/private'
    if private.is_symlink() or folder.is_symlink(): raise ValueError('Private study symlink refused')
    folder.mkdir(parents=True, exist_ok=True)
    for name in ('records.jsonl','manifest.json','withdrawals.json','supervision.json','cohorts.json','last-readiness.json','final-evaluation-lock.json','candidate-review.json','cohort-proposal.json'):
        checked(folder/name, private)
    read = lambda name, default: json.loads((folder/name).read_text(encoding='utf-8')) if (folder/name).exists() and not (folder/name).is_symlink() else default
    supervision, frozen = read('supervision.json', {}), read('cohorts.json', None)
    path = folder/'records.jsonl'
    if args.prepare_cohorts:
        report, proposal = prepare_cohorts(path, protocol, supervision)
        if proposal is not None:
            with (folder/'cohorts.json').open('x', encoding='utf-8') as out: out.write(canonical(proposal)+'\n')
            (folder/'cohort-proposal.json').write_text(canonical(report)+'\n', encoding='utf-8')
    elif args.development:
        report = develop(path, protocol, supervision, frozen)
        if '_candidate' in report: (folder/'candidate-review.json').write_text(canonical(report.pop('_candidate'))+'\n', encoding='utf-8')
    else:
        report = evaluate_final(path, protocol, supervision, frozen, folder/'final-evaluation-lock.json') if args.evaluate_final else readiness(path, protocol, supervision, frozen)[0]
    (folder/'last-readiness.json').write_text(canonical(report)+'\n', encoding='utf-8')
    # Public summary excludes participant maps, identifiers, raw samples and scores.
    (ROOT/'ml/artifacts/phase7a-readiness.json').write_text(json.dumps(report, indent=2, allow_nan=False)+'\n', encoding='utf-8')
    print(json.dumps(report))


if __name__ == '__main__': main()
