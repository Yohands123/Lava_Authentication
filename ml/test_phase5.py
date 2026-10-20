"""Starter intentions retained against strict v3 records; synthetic inputs only."""
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
import numpy as np
from phase5 import evaluate, split_groups, wilson, choose_threshold
from study_test_fixtures import fixture_row, fixture_rows, write_fixture

class PhaseFiveAuditTests(unittest.TestCase):
    def test_no_real_data_available_is_reported_not_fabricated(self):
        with TemporaryDirectory() as d:
            result = evaluate(Path(d)/'missing.jsonl')
        self.assertEqual(result['applicationAttempts'], 0)
        self.assertFalse(result['modelPromoted'])
        self.assertEqual(result['status'], 'NOT_READY_NO_OPT_IN_DATA')

    def test_split_deterministic_disjoint(self):
        groups = [f'fixture:{i}' for i in range(20)]
        s = split_groups(groups)
        self.assertFalse(s['train'] & s['calibration'] or s['train'] & s['test'] or s['calibration'] & s['test'])
        self.assertEqual(set.union(*s.values()), set(groups))
        self.assertEqual(s, split_groups(groups))

    def test_calibration_threshold_never_false_flags_calibration_with_small_n(self):
        scores = np.array([.15, .3, .65])
        self.assertEqual(int(np.sum(scores >= choose_threshold(scores))), 0)

    def test_wilson_zero_is_not_perfect_guarantee(self):
        self.assertGreater(wilson(0, 8)[1], 0)

    def test_missing_bot_family_rejected_not_leaked(self):
        row = fixture_row(1000, 'bot'); row['generator'] = None
        with TemporaryDirectory() as d:
            path = Path(d)/'records.jsonl'; write_fixture(path, [row]); result = evaluate(path)
        self.assertEqual(result['status'], 'NOT_READY_DATA_VALIDATION_ERRORS')
        self.assertIn('missing_generator_provenance', result['datasetAudit']['exclusions'])
        self.assertNotIn('modelExperiments', result)

    def test_synthetic_cohorts_only_test_pipeline_no_deployment_claim(self):
        with TemporaryDirectory() as d:
            path = Path(d)/'records.jsonl'; write_fixture(path, fixture_rows())
            report = evaluate(path, final_test=True)
        self.assertEqual(report['status'], 'OFFLINE_CANDIDATES_EVALUATED_NOT_VALIDATED_FOR_DEPLOYMENT')
        self.assertFalse(report['modelPromoted']); self.assertFalse(report['productionBlocking'])
        self.assertFalse(report['identityAndBotFamilyOverlap'])
        for key in ('regularizedLogistic', 'randomForest', 'histGradientBoosting', 'isolationForestDiagnostics'):
            self.assertIn(key, report['modelExperiments'])

if __name__ == '__main__': unittest.main()
