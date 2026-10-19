"""Generated integrity inputs ONLY. No row is a real participant or research result."""
import copy
import json
from pathlib import Path
from study_data import ROBUST_KEYS, RESPONSE_KEYS, V1_KEYS, digest


def fixture_row(number=1, label='human', participant=None, family=None):
    f = {k: 0 for k in V1_KEYS}
    f.update(samples=64, durationMs=2100, reactionMs=40, pathLength=2, dtP50=32, dtP95=40)
    base = .05 + number/100000 + (label == 'bot')*.15
    robust = {k: base*(i+1) if k not in ('efficiency', 'reversalRate', 'correctionRate', 'pauseShare') else base for i, k in enumerate(ROBUST_KEYS)}
    response = {k: base for k in RESPONSE_KEYS}; response['targetCoverage'] = 1
    participant = participant or 'fixture-participant-' + str(number)
    family = family or 'fixture-generator-' + str(number)
    return {'schema': 'lava-study-record-v3', 'consentScope': 'one-local-attempt-export', 'source': 'lava-consenting-local',
        'participant': participant, 'session': 'fixture-session-' + participant if label == 'human' else 'fixture-bot-session-' + str(number),
        'device': 'mouse', 'label': label, 'labelProvenance': 'participant-self-report' if label == 'human' else 'operator-declared-automation',
        'featureVersion': 'lava-features-v1', 'robustVersion': 'lava-robust-v2', 'normalizationVersion': 'ring-diameter-v1',
        'consentProvenance': {'revision': 'lava-local-research-2026-10-18', 'beforeCapture': True, 'localOnly': True},
        'capture': {'revision': 'lava-capture-v3', 'cadenceMs': 32, 'maxSamples': 1024, 'acquisition': 'regular-browser' if label == 'human' else 'playwright', 'viewport': {'width': 1200, 'height': 900, 'dpr': 1}, 'guardMode': 'enforce', 'modelMode': 'shadow'},
        'generator': None if label == 'human' else {'family': family, 'revision': 'fixture-v1', 'seed': str(number), 'run': 'fixture-run-' + str(number), 'trajectory': 'fixture-lineage-' + str(number)},
        'outcome': {'status': 'completed', 'ringCompleted': True, 'verdict': 'CLEAR', 'passkeyOptions': 'not-tested', 'authentication': 'not-tested'},
        'id': 'fixture-attempt-' + str(number).zfill(12), 'features': f,
        'robust': {'version': 'lava-robust-v2', 'features': robust}, 'experimental': {'version': 'lava-response-v3', 'features': response},
        'signatures': {'raw': digest('fixture-raw-' + str(number)), 'path': digest('fixture-path-' + str(number))},
        'quality': {'eligible': True, 'issues': [], 'diagnostics': {'sampleCount': 64, 'medianGapMs': 32, 'meanGapMs': 33.3, 'targetCoverage': 1, 'interpretation': 'Synthetic-only unit fixture'}}}


def fixture_rows():
    return [fixture_row(h*3+j+1, participant='fixture-human-' + str(h)) for h in range(40) for j in range(3)] + [fixture_row(1000+b*3+j, 'bot', family='fixture-family-' + str(b)) for b in range(20) for j in range(3)]


def write_fixture(path: Path, rows):
    path.write_text('\n'.join(json.dumps(r) for r in rows)+'\n', encoding='utf-8')
