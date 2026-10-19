"""Reviewable local withdrawal. Dry run by default; never deletes external copies."""
import argparse
import json
from pathlib import Path
from study_data import canonical, digest, identifier

ROOT = Path(__file__).resolve().parents[1]
PRIVATE = ROOT/'ml/private'


def checked(path, root):
    target, base = path.resolve(), root.resolve()
    if target == base or not target.is_relative_to(base) or path.is_symlink(): raise ValueError('Withdrawal target escapes the explicitly selected private root')
    return path


def withdraw(private_root, participant, apply=False):
    if Path(private_root).is_symlink(): raise ValueError('Private root must not be a symlink')
    root = Path(private_root).resolve()
    if not identifier(participant): raise ValueError('Expected a study code, never a name or email')
    folder = root/'phase5'
    changes, removed_ids, raw_count, row_count = {}, set(), 0, 0
    extra_invalidated = []
    for file in root.rglob('*.json') if root.exists() else []:
        checked(file, root)
        try: data = json.loads(file.read_text(encoding='utf-8'))
        except (ValueError, UnicodeError): continue
        if not isinstance(data, dict): continue
        if data.get('schema') in ('lava-phase5-report-v3', 'lava-portable-logistic-v3', 'lava-observation-candidate-v1', 'lava-phase6-report-v1', 'lava-phase6-private-views-v1', 'lava-phase6-bot-derived-v1', 'lava-cohorts-v3'):
            changes[file] = None; extra_invalidated.append(file.name)
        if data.get('schema') in ('lava-consent-v2', 'lava-consent-v3') and data.get('participant') == participant:
            changes[file] = None; raw_count += 1; removed_ids.add(data.get('attempt', ''))
        elif data.get('schema') == 'lava-consent-batch-v1' and isinstance(data.get('exports'), list):
            removed = [r for r in data['exports'] if r.get('participant') == participant]
            if removed:
                removed_ids.update(r.get('attempt', '') for r in removed); raw_count += len(removed)
                kept = [r for r in data['exports'] if r.get('participant') != participant]
                changes[file] = canonical({**data, 'exports': kept})+'\n' if kept else None
    # Include custom private JSONL copies made for offline evaluations.
    for file in root.rglob('*.jsonl') if root.exists() else []:
        if not file.exists(): continue
        checked(file, root)
        rows = [json.loads(s) for s in file.read_text(encoding='utf-8').splitlines() if s.strip()]
        removed = [r for r in rows if r.get('participant') == participant]
        if removed:
            row_count += len(removed); removed_ids.update(r.get('id', '') for r in removed)
            changes[file] = '\n'.join(canonical(r) for r in rows if r.get('participant') != participant)+'\n'
    invalidated = list(extra_invalidated)
    # Conservative invalidation avoids pretending model coefficients can be unlearned.
    for file in [folder/'candidate-review.json', folder/'cohorts.json', folder/'reliability.html', folder/'perturbations.json', folder/'last-import-audit.json', root/'phase5-report.json', root/'application-candidate-review.json']:
        if file.exists(): checked(file, root); changes[file] = None; invalidated.append(file.name)
    ledger_path = folder/'withdrawals.json'
    ledger = json.loads(ledger_path.read_text()) if ledger_path.exists() else {'schema': 'lava-withdrawals-v1', 'participantHashes': [], 'attemptHashes': [], 'revokedDatasetHashes': []}
    old_manifest = json.loads((folder/'manifest.json').read_text()) if (folder/'manifest.json').exists() else None
    if old_manifest and old_manifest.get('datasetHash'): ledger['revokedDatasetHashes'] = sorted(set(ledger.get('revokedDatasetHashes', []) + [old_manifest['datasetHash']]))
    ledger['participantHashes'] = sorted(set(ledger['participantHashes'] + [digest(participant)]))
    ledger['attemptHashes'] = sorted(set(ledger['attemptHashes'] + [digest(v) for v in removed_ids if v]))
    # Keep the prior final-test lock so withdrawal cannot reset "untouched" status.
    report = {'schema': 'lava-withdrawal-audit-v1', 'applied': apply, 'rawAttemptsRemoved': raw_count, 'derivedRowsRemoved': row_count,
              'invalidatedArtifacts': sorted(invalidated), 'externalCopiesDeleted': False, 'requiresRetraining': True, 'finalEvaluationLockPreserved': True}
    if not apply: return report
    for file in [*changes, ledger_path, folder/'manifest.json', folder/'last-withdrawal-audit.json']: checked(file, root)
    folder.mkdir(parents=True, exist_ok=True)
    # Revoke first. An interrupted deletion then makes old rows ineligible rather
    # than allowing them to be trained again before cleanup can be retried.
    ledger_temp = checked(folder/'withdrawals.json.tmp', root)
    ledger_temp.write_text(canonical(ledger)+'\n', encoding='utf-8')
    ledger_temp.replace(ledger_path)
    for file, content in changes.items():
        if content is None: file.unlink()
        else: file.write_text(content, encoding='utf-8')
    records = folder/'records.jsonl'
    if records.exists():
        manifest = {**(old_manifest or {}), 'schema': 'lava-dataset-manifest-v3', 'datasetHash': digest(records.read_bytes()),
                    'datasetVersion': 'phase5-' + digest(records.read_bytes())[:16], 'records': sum(bool(s.strip()) for s in records.read_text().splitlines()),
                    'sourceHashes': [], 'withdrawalApplied': True}
        (folder/'manifest.json').write_text(canonical(manifest)+'\n', encoding='utf-8')
    (folder/'last-withdrawal-audit.json').write_text(canonical(report)+'\n', encoding='utf-8')
    return report


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--participant', required=True)
    parser.add_argument('--apply', action='store_true', help='Delete matching in-root study copies/rows and invalidate local application artifacts')
    args = parser.parse_args(argv)
    print(json.dumps(withdraw(PRIVATE, args.participant, args.apply), indent=2))
    return 0


if __name__ == '__main__': raise SystemExit(main())
