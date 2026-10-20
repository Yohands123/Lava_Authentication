"""Synthetic engineering smoke ONLY; never imports or writes application rows."""
import json
from pathlib import Path
import time
from study_experiments import run_development_experiments
from study_test_fixtures import fixture_rows


def main():
    started = time.perf_counter()
    report = run_development_experiments(fixture_rows(), 'f'*64)
    assert report['status'] == 'DESCRIPTIVE_DEVELOPMENT_EXPERIMENTS'
    assert len(report['ablations']) == 5
    assert any('models' in v for v in report['leaveOneGeneratorFamilyOut'].values())
    out = {'syntheticOnly': True, 'notStudyEvidence': True, 'status': report['status'],
           'ablationsExecuted': len(report['ablations']),
           'familyFoldsExecuted': sum('models' in v for v in report['leaveOneGeneratorFamilyOut'].values()),
           'unavailableFolds': sum('models' not in v for v in report['leaveOneGeneratorFamilyOut'].values()),
           'seconds': time.perf_counter()-started, 'applicationRowsWritten': False}
    target = Path(__file__).resolve().parent/'artifacts/phase5-development-smoke.json'
    target.write_text(json.dumps(out, indent=2)+'\n', encoding='utf-8')
    print(json.dumps(out))


if __name__ == '__main__': main()
