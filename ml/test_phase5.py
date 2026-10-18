"""Synthetic-only integrity tests. None of these rows are real people or model evidence."""
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from phase5 import evaluate, split_groups, wilson, choose_threshold

KEYS = ('efficiency','pathLength','speedCv','speedP95','accelP95','jerkP95',
        'turnMean','turnP95','curvatureP95','reversalRate','correctionRate','pauseShare')


def row(attempt, participant, label, n, device='mouse'):
    features = {key: .01 + n / 10000 for key in KEYS}
    return {'id': attempt, 'participant': participant, 'source': 'lava-consenting-local',
            'device': device, 'label': label, 'labelProvenance':'self-report-not-attested',
            'robust': {'version':'lava-robust-v2', 'features':features}}


class PhaseFiveAuditTests(unittest.TestCase):
    def test_no_real_data_available_is_reported_not_fabricated(self):
        with TemporaryDirectory() as d:
            result = evaluate(Path(d)/'missing.jsonl', Path(d)/'none.json')
        self.assertEqual(result['applicationAttempts'], 0)
        self.assertFalse(result['modelPromoted'])
        self.assertEqual(result['status'], 'NOT_READY_NO_OPT_IN_DATA')

    def test_split_deterministic_disjoint(self):
        s = split_groups([f'human:{i}' for i in range(20)])
        self.assertFalse(s['train'] & s['calibration'])
        self.assertFalse(s['train'] & s['test'])
        self.assertFalse(s['calibration'] & s['test'])
        self.assertEqual(s, split_groups([f'human:{i}' for i in range(20)]))

    def test_calibration_threshold_never_false_flags_calibration_with_small_n(self):
        import numpy as np
        h = np.array([0.15, 0.3, 0.65])
        threshold = choose_threshold(h)
        self.assertEqual(int(np.sum(h >= threshold)), 0)

    def test_wilson_zero_is_not_perfect_guarantee(self):
        lo, hi = wilson(0, 8)
        self.assertGreater(hi, 0)

    def test_missing_bot_family_rejected_not_leaked(self):
        with TemporaryDirectory() as d:
            base = Path(d)
            rs = [row(f'attempt_{i:020}', f'participant_{i:03}', 'human', i) for i in range(8)]
            rs += [row('attempt_99999999999999', 'bot_actor_001', 'bot', 999)]
            data = base/'features.jsonl'
            data.write_text('\n'.join(json.dumps(x) for x in rs)+'\n')
            report = evaluate(data, base/'missing-provenance.json')
        self.assertIn('DATA_VALIDATION_ERRORS', report['status'])
        self.assertTrue(any('generatorFamily' in s for s in report['problems']))
        self.assertNotIn('modelExperiments', report)

    def test_synthetic_cohorts_only_test_pipeline_no_deployment_claim(self):
        with TemporaryDirectory() as d:
            base = Path(d)
            rs = []
            manifest = {}
            for h in range(18):
                for j in range(3):
                    n = h * 3 + j
                    rs.append(row(f'attempt_H{n:019}', f'participant_{h:03}', 'human', n + 100))
            for b in range(6):
                for j in range(12):
                    n = b*12 + j
                    attempt = f'attempt_B{n:019}'
                    rs.append(row(attempt, f'bot_operator_{b:03}', 'bot', n+2000))
                    manifest[attempt] = {'generatorFamily': f'generator_{b:03}'}
            data = base/'features.jsonl'
            provenance = base/'provenance.json'
            data.write_text('\n'.join(json.dumps(x) for x in rs)+'\n')
            provenance.write_text(json.dumps({'schema':'lava-phase5-provenance-v1','attempts':manifest}))
            report = evaluate(data, provenance)
        self.assertEqual(report['status'], 'OFFLINE_CANDIDATES_EVALUATED_NOT_VALIDATED_FOR_DEPLOYMENT')
        self.assertFalse(report['modelPromoted'])
        self.assertFalse(report['productionBlocking'])
        self.assertFalse(report['identityAndBotFamilyOverlap'])
        self.assertIn('regularizedLogistic', report['modelExperiments'])
        self.assertIn('randomForest', report['modelExperiments'])


if __name__ == '__main__':
    unittest.main()
