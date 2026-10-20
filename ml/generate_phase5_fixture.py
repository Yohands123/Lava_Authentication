"""Generate a declared-synthetic numerical fixture, never application evidence."""
import json
from pathlib import Path
import numpy as np
from study_test_fixtures import fixture_rows
from study_data import assign_cohorts, canonical, digest
from study_models import train_and_score, score_portable


def main():
    parts, cohorts = assign_cohorts(fixture_rows())
    _, model, _ = train_and_score(parts, dataset_hash=digest('synthetic-unit-fixture-only'), split_hash=digest(canonical(cohorts)), evaluate_test=False)
    model['version'] = 'lava-fixture-logistic-v3'
    vectors = []
    for name in ['mean', 'trainingMinimum', 'trainingMaximum']:
        features = {k: float(np.expm1(v)) for k, v in zip(model['features'], model[name])}
        vectors.append({'case': name, 'features': features, 'expectedRisk': score_portable(model, features)})
    output = {'syntheticOnly': True, 'notStudyEvidence': True, 'model': model, 'vectors': vectors, 'tolerance': 1e-12}
    path = Path(__file__).resolve().parents[1]/'tests/fixtures/phase5-portable.json'
    path.write_text(json.dumps(output, indent=2, allow_nan=False)+'\n', encoding='utf-8')
    print('Generated synthetic-only portable inference parity fixture; no application data or model promotion.')


if __name__ == '__main__': main()
