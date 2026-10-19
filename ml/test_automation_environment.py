"""Synthetic-only shortcut/isolation tests; no genuine-human accuracy claims."""
import copy
import unittest
from automation_environment import validate_environment, environment_audit, environment_matrix, development_environment_comparison
from study_data import validate_record
from study_models import matrix
from study_test_fixtures import fixture_rows
import numpy as np


def add_environment(row):
    automated = row['label'] == 'bot'
    row['environment'] = {'version': 'lava-research-environment-v1', 'declaredEnvironment': 'headless-playwright' if automated else 'ordinary-chrome',
        'declaredControl': 'scripted' if automated else 'human', 'displayMode': 'headless' if automated else 'headed',
        'evidence': {'version': 'lava-automation-environment-v1', 'authority': 'advisory', 'signals': {'webdriver': automated, 'headlessUserAgent': automated, 'headlessBrand': None}}}
    return row


class EnvironmentTests(unittest.TestCase):
    def test_strict_optional_schema_and_old_records(self):
        row = add_environment(fixture_rows()[0])
        self.assertEqual(validate_record(row), ([], []))
        self.assertEqual(validate_record(fixture_rows()[0]), ([], []))
        for change in ({'declaredEnvironment': []}, {'rawUA': 'forbidden'}, {'declaredEnvironment': 'vm-detected'}):
            self.assertFalse(validate_environment({**row['environment'], **change}))
        row['environment']['evidence']['signals']['webdriver'] = 1
        self.assertFalse(validate_environment(row['environment']))

    def test_missing_is_not_false_and_human_automation_is_a_valid_declaration(self):
        rows = [add_environment(fixture_rows()[0]), fixture_rows()[1]]
        rows[0]['environment']['declaredEnvironment'] = 'human-controlled-automation'
        rows[0]['environment']['evidence']['signals']['webdriver'] = True
        audit = environment_audit(rows)
        self.assertEqual(audit['missingEvidenceRecords'], 1)
        self.assertEqual(audit['declaredHumanAttemptsWithPositiveHints'], 1)
        self.assertIsNone(audit['humanPopulationFpr'])

    def test_environment_changes_never_enter_behavior_matrix(self):
        rows = [add_environment(r) for r in fixture_rows()]
        original = matrix(rows).copy()
        for row in rows: row['environment']['evidence']['signals'] = {'webdriver': True, 'headlessUserAgent': True, 'headlessBrand': True}
        np.testing.assert_array_equal(original, matrix(rows))
        self.assertEqual(environment_matrix(rows).shape, (180, 6))

    def test_no_real_environment_or_human_data_produces_no_accuracy(self):
        self.assertEqual(development_environment_comparison(fixture_rows(), 'a'*64)['status'], 'NOT_READY_MATCHED_HUMAN_BOT_ENVIRONMENT_DATA')
        bots = [add_environment(r) for r in fixture_rows() if r['label'] == 'bot']
        self.assertNotIn('variants', development_environment_comparison(bots, 'a'*64))

    def test_synthetic_shortcut_stress_does_not_export_or_influence_real_models(self):
        rows = [add_environment(copy.deepcopy(r)) for r in fixture_rows()]
        report = development_environment_comparison(rows, 'b'*64)
        self.assertEqual(report['status'], 'DIAGNOSTIC_ONLY_NOT_VALIDATED')
        self.assertFalse(report['artifactExported']); self.assertFalse(report['productionInfluence'])
        variants = report['variants']
        self.assertEqual(variants['behavior-only']['counterfactualEnvironmentChanges']['all-positive']['maxAbsoluteScoreDelta'], 0)
        self.assertGreater(variants['environment-only']['counterfactualEnvironmentChanges']['all-hidden']['decisionFlipN'], 0)
        self.assertGreater(variants['environment-only']['counterfactualEnvironmentChanges']['all-positive']['humanFlagged'], 0)
        self.assertTrue(report['noHumanControlledAutomationValidation'])


if __name__ == '__main__': unittest.main()
