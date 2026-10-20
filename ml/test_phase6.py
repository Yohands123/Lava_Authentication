"""Integrity inputs only, never human observations."""
import copy
import json
from pathlib import Path
import tempfile
import unittest
from phase6 import negative_controls, application_audit
from study_test_fixtures import fixture_rows, write_fixture
from study_data import assign_cohorts
from study_withdraw import withdraw


class PhaseSixTests(unittest.TestCase):
    def test_no_data_never_manufactures_human_accuracy(self):
        with tempfile.TemporaryDirectory() as tmp:
            audit = application_audit(Path(tmp))
            self.assertEqual(audit['declaredHumanAttempts'],0)
            self.assertIsNone(audit['humanPopulationFpr'])
            self.assertEqual(audit['status'],'NOT_READY_NO_OPT_IN_DATA')

    def test_negative_controls_are_separate_and_no_candidate_is_exported(self):
        rows = fixture_rows()
        for row in rows: row['environment'] = {'evidence':{'signals':{'webdriver':row['label']=='bot'}}}
        report = negative_controls(rows)
        self.assertEqual(len(report['controls']),6)
        self.assertFalse(report['productionInfluence'])
        self.assertTrue(all(c['applicationAccuracy'] is None for c in report['controls'].values()))
        self.assertEqual(report['controls']['cadence-only']['scoreMinimum'],report['controls']['cadence-only']['scoreMaximum'])

    def test_derived_views_cannot_cross_a_frozen_cohort(self):
        rows = fixture_rows(); _, frozen = assign_cohorts(rows)
        a = next(r for r in rows if frozen['assignments'][__import__('study_data').digest('human:'+r['participant'])]=='train' and r['label']=='human')
        b = next(r for r in rows if r['label']=='human' and frozen['assignments'][__import__('study_data').digest('human:'+r['participant'])]=='test')
        linked = copy.deepcopy(a);linked['id']='fixture-linked-attempt-0001';linked['participant']=b['participant']
        with self.assertRaisesRegex(ValueError,'related_groups_cross'): assign_cohorts(rows+[linked],frozen)

    def test_withdrawal_invalidates_private_phase6_registry_and_preserves_final_lock(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);folder=root/'phase5';folder.mkdir();registry=root/'phase6/registry';registry.mkdir(parents=True)
            rows=fixture_rows();write_fixture(folder/'records.jsonl',rows)
            (folder/'final-evaluation-lock.json').write_text('{}',encoding='utf-8')
            candidate=registry/'candidate.json';candidate.write_text(json.dumps({'schema':'lava-observation-candidate-v1'}),encoding='utf-8')
            views=root/'phase6/perturbations.json';views.write_text(json.dumps({'schema':'lava-phase6-private-views-v1'}),encoding='utf-8')
            dry=withdraw(root,rows[0]['participant']);self.assertFalse(dry['applied']);self.assertTrue(candidate.exists())
            withdraw(root,rows[0]['participant'],True);self.assertFalse(candidate.exists());self.assertFalse(views.exists());self.assertTrue((folder/'final-evaluation-lock.json').exists())


if __name__ == '__main__': unittest.main()
