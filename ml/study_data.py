"""Strict Phase 5 derived-record audit. No raw traces or IDs in public summaries."""
from collections import Counter, defaultdict
from dataclasses import dataclass
import hashlib
import json
import math
from pathlib import Path
import re
from automation_environment import validate_environment

ROBUST_KEYS = ('efficiency', 'pathLength', 'speedCv', 'speedP95', 'accelP95', 'jerkP95', 'turnMean', 'turnP95', 'curvatureP95', 'reversalRate', 'correctionRate', 'pauseShare')
RESPONSE_KEYS = ('reactionShare', 'cadenceCv', 'decelerationShare', 'angularVelocityP95', 'burstShare', 'correctionPauseShare', 'targetCoverage', 'trackingErrorMean', 'trackingErrorP95', 'responseDelayShare', 'targetTurnRate', 'pursuitShare', 'targetSwitchRate', 'reacquisitionShare', 'overshootShare', 'lateStrategyShare')
V1_KEYS = ('samples', 'durationMs', 'pathLength', 'efficiency', 'speedP50', 'speedP95', 'speedCv', 'accelP95', 'decelP95', 'jerkP95', 'angularP95', 'curvatureP95', 'headingChangeMean', 'dtP50', 'dtP95', 'dtCv', 'pauseRatio', 'bursts', 'reversals', 'corrections', 'overshoots', 'reactionMs', 'coalescedRatio', 'clockQuantumMs', 'pressureRange', 'pressurePresent', 'touchRatio', 'penRatio', 'untrustedRatio', 'invalidTiming', 'bubbleEncounters', 'bubbleChases', 'bubbleMisses', 'bubbleDisplacements', 'strategyChanges', 'firstEncounterMs')
ROOT_KEYS = {'schema', 'consentScope', 'source', 'participant', 'session', 'device', 'label', 'labelProvenance', 'featureVersion', 'robustVersion', 'normalizationVersion', 'consentProvenance', 'capture', 'generator', 'outcome', 'id', 'features', 'robust', 'experimental', 'signatures', 'quality'}
DEVICES = {'mouse', 'trackpad', 'touch', 'pen', 'assisted', 'unknown'}
SEED = 'lava-phase5-cohorts-v3'
SCHEMA = 'lava-study-record-v3'


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'), allow_nan=False)


def digest(value):
    return hashlib.sha256((value if isinstance(value, bytes) else str(value).encode())).hexdigest()


def exact(value, keys):
    return isinstance(value, dict) and set(value) == set(keys)


def finite(value, low=0, high=1e12):
    return not isinstance(value, bool) and isinstance(value, (int, float)) and math.isfinite(value) and low <= value <= high


def identifier(value, minimum=8):
    return isinstance(value, str) and re.fullmatch(r'[A-Za-z0-9_-]{%d,64}' % minimum, value) is not None


def vector(value, keys):
    return exact(value, keys) and all(finite(value[k]) for k in keys)


def has_movement(row):
    f = row['features']
    return f['samples'] >= 12 and f['pathLength'] >= .1 and f['durationMs'] >= 200


def validate_record(r):
    """Return invalid reasons and incomplete reasons independently."""
    bad, incomplete = [], []
    if not (exact(r, ROOT_KEYS) or exact(r, ROOT_KEYS | {'environment'})):
        return ['unexpected_or_missing_fields'], []
    if 'environment' in r and not validate_environment(r['environment']): bad.append('invalid_automation_environment')
    if r['schema'] != SCHEMA or r['source'] != 'lava-consenting-local': bad.append('unsupported_schema_or_source')
    if not identifier(r['id'], 16) or not identifier(r['participant']) or not identifier(r['session']): bad.append('invalid_study_identifiers')
    if r['device'] not in DEVICES: bad.append('unsupported_device')
    provenance = {'human': 'participant-self-report', 'bot': 'operator-declared-automation', 'unlabeled': 'unlabeled'}
    if r['label'] not in provenance or r['labelProvenance'] != provenance.get(r['label']): bad.append('invalid_label_provenance')
    if r['label'] == 'unlabeled': incomplete.append('unlabeled')
    if r['featureVersion'] != 'lava-features-v1' or r['robustVersion'] != 'lava-robust-v2': bad.append('feature_version_mismatch')
    if r['normalizationVersion'] != 'ring-diameter-v1': bad.append('normalization_mismatch')
    c = r['consentProvenance']
    if r['consentScope'] != 'one-local-attempt-export' or not exact(c, {'revision', 'beforeCapture', 'localOnly'}) or c['revision'] != 'lava-local-research-2026-10-18' or c['beforeCapture'] is not True or c['localOnly'] is not True: bad.append('invalid_consent')
    capture = r['capture']
    if not exact(capture, {'revision', 'cadenceMs', 'maxSamples', 'acquisition', 'viewport', 'guardMode', 'modelMode'}): bad.append('invalid_capture')
    else:
        if capture['revision'] != 'lava-capture-v3' or capture['cadenceMs'] not in (16, 32, 64) or isinstance(capture['cadenceMs'], bool) or capture['maxSamples'] != 1024 or capture['acquisition'] not in ('regular-browser', 'playwright', 'puppeteer', 'unknown'): bad.append('invalid_capture')
        if capture['guardMode'] not in ('off', 'shadow', 'enforce') or capture['modelMode'] not in ('off', 'shadow', 'research_enforce', 'production_enforce', 'unknown'): bad.append('invalid_capture_mode')
        vp = capture['viewport']
        if not exact(vp, {'width', 'height', 'dpr'}) or not finite(vp['width'], 1, 32000) or not finite(vp['height'], 1, 32000) or not finite(vp['dpr'], .1, 16): bad.append('invalid_viewport')
        if r['label'] == 'human' and capture['modelMode'] in ('research_enforce', 'production_enforce'): incomplete.append('human_capture_requires_advisory_model')
    g = r['generator']
    if r['label'] == 'bot':
        if not exact(g, {'family', 'revision', 'seed', 'run', 'trajectory'}) or not all(isinstance(g[k], str) and re.fullmatch(r'[\w.-]{3,80}', g[k]) for k in ('family', 'revision')) or not identifier(g['run']) or not identifier(g['trajectory']) or not isinstance(g['seed'], str) or not re.fullmatch(r'[\w.-]{1,64}', g['seed']): bad.append('missing_generator_provenance')
    elif g is not None: bad.append('generator_label_conflict')
    o = r['outcome']
    if not exact(o, {'status', 'ringCompleted', 'verdict', 'passkeyOptions', 'authentication'}) or o['status'] not in ('completed', 'cancelled', 'expired', 'network-error', 'accessible', 'incomplete') or not isinstance(o['ringCompleted'], bool) or o['verdict'] not in (None, 'CLEAR', 'FLAG', 'BLOCK') or o['passkeyOptions'] != 'not-tested' or o['authentication'] != 'not-tested': bad.append('invalid_outcome')
    else:
        if o['status'] == 'completed' and not o['ringCompleted']: bad.append('outcome_conflict')
        if o['status'] != 'completed': incomplete.append('incomplete_task')
    if not vector(r['features'], V1_KEYS): bad.append('invalid_v1_features')
    else:
        f = r['features']
        if not isinstance(f['samples'], int) or not 0 <= f['samples'] <= 1024 or f['invalidTiming'] != 0 or f['durationMs'] + f['reactionMs'] > 180000: bad.append('invalid_timing_or_samples')
        if f['samples'] < 12 or f['durationMs'] < 200 or f['pathLength'] < .1: incomplete.append('insufficient_evidence')
    for field, version, keys in [('robust', 'lava-robust-v2', ROBUST_KEYS), ('experimental', 'lava-response-v3', RESPONSE_KEYS)]:
        v = r[field]
        if not exact(v, {'version', 'features'}) or v['version'] != version or not vector(v['features'], keys): bad.append('invalid_' + field + '_features')
        elif any(v['features'][k] > 1 for k in (('efficiency', 'reversalRate', 'correctionRate', 'pauseShare') if field == 'robust' else ('reactionShare', 'decelerationShare', 'burstShare', 'correctionPauseShare', 'targetCoverage', 'pursuitShare', 'targetSwitchRate', 'reacquisitionShare', 'overshootShare', 'lateStrategyShare'))): bad.append('invalid_bounded_features')
    signatures = r['signatures']
    if not exact(signatures, {'raw', 'path'}) or any(not isinstance(v, str) or not re.fullmatch('[a-f0-9]{64}', v) for v in signatures.values()): bad.append('invalid_trajectory_signatures')
    quality = r['quality']
    if not exact(quality, {'eligible', 'issues', 'diagnostics'}) or not isinstance(quality['eligible'], bool) or not isinstance(quality['issues'], list): bad.append('invalid_quality')
    else:
        for issue in quality['issues']:
            if not exact(issue, {'kind', 'code'}) or issue['kind'] not in ('invalid', 'incomplete') or not isinstance(issue['code'], str) or not re.fullmatch('[a-z_]{1,80}', issue['code']): bad.append('invalid_quality_issue')
            elif issue['kind'] == 'invalid': bad.append('invalid_export_evidence')
            else: incomplete.append(issue['code'])
        diag = quality['diagnostics']
        if not exact(diag, {'sampleCount', 'medianGapMs', 'meanGapMs', 'targetCoverage', 'interpretation'}) or any(not finite(diag[k]) for k in ('sampleCount', 'medianGapMs', 'meanGapMs', 'targetCoverage')) or diag['targetCoverage'] > 1: bad.append('invalid_capture_diagnostics')
        elif not bad and diag['sampleCount'] != r['features']['samples']: bad.append('sample_count_mismatch')
    return sorted(set(bad)), sorted(set(incomplete))


@dataclass
class Dataset:
    records: list
    eligible: list
    audit: dict
    content_hash: str
    exists: bool


def load_dataset(path: Path, manifest_path=None, ledger_path=None):
    audit = {'invalidRecords': 0, 'incompleteRecords': 0, 'duplicateAttempts': 0, 'duplicateVectors': 0, 'duplicateTrajectories': 0, 'conflictingLabels': 0, 'exclusions': {}}
    if not path.exists(): return Dataset([], [], audit, digest(b''), False)
    content = path.read_bytes()
    exclusions = Counter()
    records, eligible, ids, vectors, paths = [], [], {}, {}, {}
    try: lines = [json.loads(s) for s in content.decode('utf-8').splitlines() if s.strip()]
    except (ValueError, UnicodeError):
        audit['invalidRecords'] = 1; audit['exclusions'] = {'invalid_jsonl': 1}
        return Dataset([], [], audit, digest(content), True)
    ledger = json.loads(ledger_path.read_text()) if ledger_path and ledger_path.exists() else {'participantHashes': [], 'attemptHashes': []}
    for r in lines:
        try: bad, incomplete = validate_record(r)
        except (TypeError, KeyError, AttributeError): bad, incomplete = ['malformed_nested_schema'], []
        if not bad and (digest(r['participant']) in ledger['participantHashes'] or digest(r['id']) in ledger['attemptHashes']): bad.append('withdrawn_record')
        if bad:
            audit['invalidRecords'] += 1; exclusions.update(bad); continue
        records.append(r)
        if r['id'] in ids:
            audit['duplicateAttempts'] += 1; audit['invalidRecords'] += 1
            if ids[r['id']] != r['label']: audit['conflictingLabels'] += 1
            exclusions['duplicate_attempt'] += 1; continue
        ids[r['id']] = r['label']
        key = canonical(r['robust']['features'])
        prior = [vectors.get(key), paths.get(r['signatures']['path'])] if has_movement(r) else [None, None]
        if any(label is not None and label != r['label'] and label != 'unlabeled' and r['label'] != 'unlabeled' for label in prior): audit['conflictingLabels'] += 1; audit['invalidRecords'] += 1; exclusions['conflicting_labels'] += 1; continue
        if prior[0] is not None: audit['duplicateVectors'] += 1; incomplete.append('duplicate_vector')
        if prior[1] is not None: audit['duplicateTrajectories'] += 1; incomplete.append('duplicate_trajectory')
        if has_movement(r): vectors[key], paths[r['signatures']['path']] = r['label'], r['label']
        if incomplete: audit['incompleteRecords'] += 1; exclusions.update(set(incomplete))
        else: eligible.append(r)
    if manifest_path and manifest_path.exists():
        try:
            manifest = json.loads(manifest_path.read_text())
            if manifest.get('schema') != 'lava-dataset-manifest-v3' or manifest.get('datasetHash') != digest(content): raise ValueError('manifest mismatch')
        except (ValueError, AttributeError): audit['invalidRecords'] += 1; exclusions['manifest_integrity'] += 1
    audit['exclusions'] = dict(sorted(exclusions.items()))
    return Dataset(records, eligible, audit, digest(content), True)


def assign_cohorts(rows, frozen=None, seed=SEED, related_records=None):
    """Connected provenance groups; all participant/session/run/replay relatives stay
    together. Hash buckets are predeclared, never retried to get nicer labels."""
    parents = {}
    def find(x):
        parents.setdefault(x, x)
        root = x
        while parents[root] != root: root = parents[root]
        while parents[x] != x:
            previous = parents[x]; parents[x] = root; x = previous
        return root
    def union(a, b): parents[find(b)] = find(a)
    row_nodes = {}
    for r in related_records if related_records is not None else rows:
        primary = 'bot-family:' + r['generator']['family'] if r['label'] == 'bot' else ('human:' if r['label'] == 'human' else 'unlabeled:') + r['participant']
        nodes = [primary, 'session:' + r['session']]
        # Empty/insufficient captures share trivial hashes without being replays.
        if has_movement(r): nodes += ['path:' + r['signatures']['path'], 'raw:' + r['signatures']['raw']]
        if r['label'] == 'bot': nodes += ['run:' + r['generator']['run'], 'lineage:' + r['generator']['trajectory']]
        for n in nodes[1:]: union(nodes[0], n)
        row_nodes[r['id']] = nodes
    components = defaultdict(set)
    for nodes in row_nodes.values():
        components[find(nodes[0])].update(nodes)
    if frozen and (frozen.get('schema') != 'lava-cohorts-v3' or frozen.get('seed') != seed): raise ValueError('frozen_cohort_version_mismatch')
    assignments, frozen_map = {}, (frozen or {}).get('assignments', {})
    for component, nodes in components.items():
        prior = {frozen_map[digest(n)] for n in nodes if digest(n) in frozen_map}
        if len(prior) > 1: raise ValueError('related_groups_cross_frozen_cohorts')
        primary = min(n for n in nodes if n.startswith(('human:', 'bot-family:', 'unlabeled:')))
        bucket = int(digest(seed + ':' + primary)[:8], 16) % 100
        part = next(iter(prior)) if prior else 'train' if bucket < 60 else 'calibration' if bucket < 80 else 'test'
        if part not in ('train', 'calibration', 'test'): raise ValueError('invalid_frozen_cohort')
        assignments[component] = part
    parts = {name: [] for name in ('train', 'calibration', 'test')}
    seen_vectors = {}
    for r in rows:
        nodes = row_nodes[r['id']]
        part = assignments[find(nodes[0])]
        v = canonical(r['robust']['features'])
        if v in seen_vectors and seen_vectors[v] != part: raise ValueError('duplicate_vectors_cross_cohorts')
        seen_vectors[v] = part; parts[part].append(r)
    if any({r['label'] for r in values} != {'human', 'bot'} for values in parts.values()): raise ValueError('preassigned_cohorts_need_both_labels')
    manifest = {'schema': 'lava-cohorts-v3', 'seed': seed, 'assignments': {digest(n): assignments[c] for c, nodes in components.items() for n in nodes}, 'noTestTuning': True}
    return parts, manifest
