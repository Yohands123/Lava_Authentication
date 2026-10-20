"""Deliberate corruption/leakage and withdrawal tests; no real study data."""
import copy
import io
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch
import numpy as np
from phase5_pipeline import evaluate, main, private_path
from study_data import validate_record, load_dataset, assign_cohorts, digest, canonical
from study_models import train_and_score, matrix, score_portable, group_weights, rate_summary
from study_experiments import acquisition_audit, render_reliability_html
from study_withdraw import withdraw, checked
from study_test_fixtures import fixture_row, fixture_rows, write_fixture


class StudyValidationTests(unittest.TestCase):
    def test_strict_nested_schema_and_finite_values(self):
        baseline = fixture_row()
        self.assertEqual(validate_record(baseline), ([], []))
        mutations = [lambda r: r.update(cookie='forbidden'), lambda r: r.update(device='invented'),
            lambda r: r.update(normalizationVersion='pixels'), lambda r: r.update(robustVersion='unknown'),
            lambda r: r.update(labelProvenance='CLEAR'), lambda r: r['consentProvenance'].update(beforeCapture=False),
            lambda r: r['consentProvenance'].update(secret='forbidden'), lambda r: r['robust']['features'].update(speedCv=float('nan')),
            lambda r: r['features'].update(invalidTiming=1), lambda r: r['features'].update(samples=1025),
            lambda r: r['capture'].update(cadenceMs=True), lambda r: r['signatures'].update(path='raw coordinates'),
            lambda r: r['experimental']['features'].update(targetCoverage=2), lambda r: r['outcome'].update(authentication='signed-in')]
        for mutate in mutations:
            with self.subTest(mutation=repr(mutate)):
                row = copy.deepcopy(baseline); mutate(row); self.assertTrue(validate_record(row)[0])

    def test_unlabeled_and_incomplete_are_preserved_but_not_fit(self):
        r = fixture_row(); r['label'] = 'unlabeled'; r['labelProvenance'] = 'unlabeled'
        r['outcome'].update(status='cancelled', ringCompleted=False, verdict=None)
        with TemporaryDirectory() as d:
            path = Path(d)/'records.jsonl'; write_fixture(path, [r]); data = load_dataset(path)
        self.assertEqual(len(data.records), 1); self.assertFalse(data.eligible)
        self.assertEqual(data.audit['invalidRecords'], 0); self.assertEqual(data.audit['incompleteRecords'], 1)

    def test_duplicate_attempts_and_label_conflicts_stop_fitting(self):
        a = fixture_row(); b = fixture_row(1000, 'bot'); b['id'] = a['id']
        with TemporaryDirectory() as d:
            path = Path(d)/'records.jsonl'; write_fixture(path, [a, b]); report = evaluate(path)
        self.assertEqual(report['datasetAudit']['duplicateAttempts'], 1)
        self.assertEqual(report['datasetAudit']['conflictingLabels'], 1)
        self.assertNotIn('modelExperiments', report)

    def test_feature_and_trajectory_duplicates_are_audited(self):
        a, b = fixture_row(), fixture_row(2)
        b['robust'] = copy.deepcopy(a['robust']); b['signatures']['path'] = a['signatures']['path']
        with TemporaryDirectory() as d:
            path = Path(d)/'records.jsonl'; write_fixture(path, [a, b]); data = load_dataset(path)
        self.assertEqual(data.audit['duplicateVectors'], 1); self.assertEqual(data.audit['duplicateTrajectories'], 1)
        self.assertEqual(len(data.eligible), 1)

    def test_conflicting_duplicate_evidence_is_invalid(self):
        a, b = fixture_row(), fixture_row(1000, 'bot'); b['robust'] = copy.deepcopy(a['robust'])
        with TemporaryDirectory() as d:
            path = Path(d)/'records.jsonl'; write_fixture(path, [a, b]); data = load_dataset(path)
        self.assertEqual(data.audit['conflictingLabels'], 1); self.assertTrue(data.audit['invalidRecords'])

    def test_zero_movement_opposite_labels_are_incomplete_not_conflicting_replays(self):
        a, b = fixture_row(), fixture_row(1000, 'bot')
        for row in (a, b):
            row['features'].update(samples=0, pathLength=0, durationMs=0)
            row['quality']['diagnostics']['sampleCount'] = 0
            row['outcome'].update(status='cancelled', ringCompleted=False, verdict=None)
            row['signatures'] = {'raw': '0'*64, 'path': '0'*64}
        b['robust'] = copy.deepcopy(a['robust'])
        with TemporaryDirectory() as d:
            path = Path(d)/'records.jsonl'; write_fixture(path, [a,b]); data = load_dataset(path)
        self.assertEqual(data.audit['invalidRecords'], 0)
        self.assertEqual(data.audit['incompleteRecords'], 2)
        self.assertEqual(data.audit['duplicateTrajectories'], 0)

    def test_manifest_hash_is_checked(self):
        with TemporaryDirectory() as d:
            path = Path(d)/'records.jsonl'; write_fixture(path, [fixture_row()])
            manifest = Path(d)/'manifest.json'; manifest.write_text(json.dumps({'schema': 'lava-dataset-manifest-v3', 'datasetHash': '0'*64}))
            data = load_dataset(path, manifest)
        self.assertIn('manifest_integrity', data.audit['exclusions'])

    def test_retries_are_not_independent_participants(self):
        with TemporaryDirectory() as d:
            path = Path(d)/'records.jsonl'; write_fixture(path, [fixture_row(i, participant='fixture-one-person') for i in range(1, 30)])
            report = evaluate(path)
        self.assertEqual(report['independentHumanStudyCodes'], 1); self.assertNotIn('modelExperiments', report)

    def test_missing_bot_family_diversity_is_not_relaxed(self):
        rows = [r for r in fixture_rows() if r['label'] == 'human'] + [fixture_row(9000, 'bot', family='fixture-one-family')]
        with TemporaryDirectory() as d:
            path = Path(d)/'records.jsonl'; write_fixture(path, rows); report = evaluate(path)
        self.assertIn('THREE_DISTINCT', report['status'])

    def test_bot_only_capture_is_not_human_validation(self):
        with TemporaryDirectory() as d:
            path = Path(d)/'records.jsonl'; write_fixture(path, [fixture_row(1000, 'bot')]); report = evaluate(path)
        self.assertEqual(report['status'], 'NOT_READY_NO_OPT_IN_DATA'); self.assertEqual(report['declaredHumanAttempts'], 0)

    def test_research_enforcement_human_capture_is_incomplete(self):
        row = fixture_row(); row['capture']['modelMode'] = 'research_enforce'
        self.assertIn('human_capture_requires_advisory_model', validate_record(row)[1])


class CohortTests(unittest.TestCase):
    def test_participants_and_bot_families_never_cross(self):
        rows = fixture_rows(); parts, frozen = assign_cohorts(rows)
        self.assertEqual(sum(map(len, parts.values())), len(rows))
        groups = {p: {('human:' + r['participant']) if r['label'] == 'human' else ('bot:' + r['generator']['family']) for r in rs} for p, rs in parts.items()}
        self.assertFalse(groups['train'] & groups['calibration'] or groups['train'] & groups['test'] or groups['calibration'] & groups['test'])
        again, _ = assign_cohorts(list(reversed(rows)), frozen)
        self.assertEqual({p: {r['id'] for r in rs} for p, rs in parts.items()}, {p: {r['id'] for r in rs} for p, rs in again.items()})

    def test_capture_runs_and_replay_lineage_are_connected(self):
        rows = fixture_rows()
        bots = [r for r in rows if r['label'] == 'bot']; a = bots[0]; b = bots[-1]
        b['generator']['run'] = a['generator']['run']
        parts, _ = assign_cohorts(rows)
        location = {r['id']: p for p, rs in parts.items() for r in rs}
        self.assertEqual(location[a['id']], location[b['id']])

    def test_raw_replays_cannot_cross_a_frozen_holdout(self):
        rows = fixture_rows(); parts, frozen = assign_cohorts(rows)
        a, b = parts['train'][0], parts['test'][0]
        b['signatures']['raw'] = a['signatures']['raw']
        with self.assertRaisesRegex(ValueError, 'cross_frozen'): assign_cohorts(rows, frozen)

    def test_duplicate_vectors_cross_cohorts_are_rejected(self):
        rows = fixture_rows(); parts, _ = assign_cohorts(rows)
        parts['test'][0]['robust'] = copy.deepcopy(parts['train'][0]['robust'])
        with self.assertRaisesRegex(ValueError, 'duplicate_vectors'): assign_cohorts(rows)

    def test_frozen_assignment_survives_new_independent_groups(self):
        rows = fixture_rows(); first, frozen = assign_cohorts(rows)
        extended, _ = assign_cohorts(rows + [fixture_row(55555)], frozen)
        locations = {r['id']: p for p, rs in extended.items() for r in rs}
        for p, rs in first.items(): self.assertTrue(all(locations[r['id']] == p for r in rs))

    def test_excluded_incomplete_attempts_still_connect_capture_lineage(self):
        rows = fixture_rows(); parts, frozen = assign_cohorts(rows)
        a = next(r for r in parts['train'] if r['label'] == 'bot')
        b = next(r for r in parts['test'] if r['label'] == 'bot')
        bridge = fixture_row(90001, 'bot', family=a['generator']['family'])
        bridge['generator']['run'] = b['generator']['run']
        bridge['outcome'].update(status='cancelled', ringCompleted=False, verdict=None)
        with self.assertRaisesRegex(ValueError, 'cross_frozen'):
            assign_cohorts(rows, frozen, related_records=rows+[bridge])


class ModelTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.parts, cls.frozen = assign_cohorts(fixture_rows())
        cls.models, cls.artifact, cls.predictors = train_and_score(cls.parts, dataset_hash='1'*64, split_hash='2'*64)

    def test_metrics_have_correct_denominators_and_calibration(self):
        m = rate_summary(np.array([0, 1]), np.array([.1, .9]), .5)
        self.assertEqual((m['humanFlagged'], m['botFlagged']), (0, 1)); self.assertAlmostEqual(m['brier'], .01)
        self.assertAlmostEqual(m['ece10'], .1); self.assertEqual(m['rocAuc'], 1)
        boundary = rate_summary(np.array([0, 0, 1]), np.array([.3, .6, 1.]), .5)
        self.assertEqual(sum(b['n'] for b in boundary['calibrationBins']), 3)

    def test_python_serialization_parity(self):
        model = json.loads(json.dumps(self.artifact))
        expected = self.predictors['regularizedLogistic'][0](matrix(self.parts['test']))
        for r, p in zip(self.parts['test'], expected): self.assertAlmostEqual(score_portable(model, r['robust']['features']), p, places=12)
        self.assertFalse(model['enabled']); self.assertFalse(model['automaticPromotion'])

    def test_training_and_calibration_are_unchanged_by_final_features(self):
        changed = copy.deepcopy(self.parts)
        for r in changed['test']: r['robust']['features']['pathLength'] += 9999
        _, artifact, _ = train_and_score(changed, dataset_hash='1'*64, split_hash='2'*64, evaluate_test=False)
        self.assertEqual(artifact, self.artifact)

    def test_normal_fit_never_extracts_final_test_matrix(self):
        original = matrix
        held = {r['id'] for r in self.parts['test']}
        def guarded(rows, keys):
            self.assertFalse(held & {r['id'] for r in rows}); return original(rows, keys)
        with patch('study_models.matrix', side_effect=guarded):
            models, _, _ = train_and_score(self.parts, evaluate_test=False)
        self.assertEqual(models['regularizedLogistic']['testStatus'], 'UNTOUCHED_REQUIRES_EXPLICIT_FINAL_EVALUATION')

    def test_group_weighting_does_not_reward_retries(self):
        rows = self.parts['train']; weights = group_weights(rows)
        grouped = {}
        for r, w in zip(rows, weights):
            key = r['participant'] if r['label'] == 'human' else r['generator']['family']; grouped[key] = grouped.get(key, 0) + w
        self.assertLess(max(grouped.values()) - min(grouped.values()), 1e-10)

    def test_calibration_html_has_no_network_or_individual_ids(self):
        html = render_reliability_html(self.models)
        self.assertIn('<svg', html); self.assertNotIn('http', html); self.assertNotIn('fixture-human-', html)

    def test_acquisition_metadata_is_only_a_diagnostic(self):
        audit = acquisition_audit(self.parts['train'])
        self.assertFalse(audit['metadataUsedAsBehaviorPredictors'])
        self.assertFalse(any(k in self.artifact['features'] for k in ('participant', 'source', 'device', 'cadenceMs', 'webdriver')))


class WithdrawalTests(unittest.TestCase):
    def test_dry_run_then_apply_removes_owned_copies_and_invalidates_models(self):
        with TemporaryDirectory() as d:
            root = Path(d); folder = root/'phase5'; (folder/'exports').mkdir(parents=True)
            a, b = fixture_row(), fixture_row(2)
            write_fixture(folder/'records.jsonl', [a, b]); raw = folder/'exports/raw.json'
            raw.write_text(json.dumps({'schema': 'lava-consent-v3', 'participant': a['participant'], 'attempt': a['id']}))
            (folder/'candidate-review.json').write_text('{}'); (root/'phase5-report.json').write_text('{}')
            (root/'custom-review.json').write_text(json.dumps({'schema': 'lava-phase5-report-v3'}))
            write_fixture(root/'custom-derived.jsonl', [a, b])
            (folder/'final-evaluation-lock.json').write_text('{}')
            before = (folder/'records.jsonl').read_bytes()
            plan = withdraw(root, a['participant']); self.assertFalse(plan['applied']); self.assertTrue(raw.exists())
            self.assertEqual((folder/'records.jsonl').read_bytes(), before)
            result = withdraw(root, a['participant'], True)
            self.assertEqual(result['derivedRowsRemoved'], 2); self.assertFalse(raw.exists())
            self.assertFalse((folder/'candidate-review.json').exists()); self.assertTrue((folder/'final-evaluation-lock.json').exists())
            self.assertFalse((root/'custom-review.json').exists())
            self.assertEqual(len((root/'custom-derived.jsonl').read_text().splitlines()), 1)
            self.assertEqual(len(load_dataset(folder/'records.jsonl', folder/'manifest.json').records), 1)
            self.assertIn(digest(a['participant']), json.loads((folder/'withdrawals.json').read_text())['participantHashes'])

    def test_withdrawal_ledger_blocks_resurrected_rows(self):
        with TemporaryDirectory() as d:
            folder = Path(d); path = folder/'records.jsonl'; a = fixture_row(); write_fixture(path, [a])
            ledger = folder/'withdrawals.json'; ledger.write_text(json.dumps({'participantHashes': [digest(a['participant'])], 'attemptHashes': []}))
            self.assertIn('withdrawn_record', load_dataset(path, ledger_path=ledger).audit['exclusions'])

    def test_resolved_outside_targets_are_refused(self):
        with TemporaryDirectory() as d:
            with self.assertRaises(ValueError): checked(Path(d).parent/'outside-file.json', Path(d))
        with self.assertRaises(ValueError): private_path(Path('outside-private.json'))


class FinalEvaluationTests(unittest.TestCase):
    def test_final_evaluation_requires_explicit_reuse_acknowledgement(self):
        with TemporaryDirectory() as d:
            root = Path(d); folder = root/'phase5'; folder.mkdir(); data = folder/'records.jsonl'; write_fixture(data, fixture_rows())
            (folder/'manifest.json').write_text(json.dumps({'schema': 'lava-dataset-manifest-v3', 'datasetHash': digest(data.read_bytes())}))
            args = ['--data', str(data), '--out', str(root/'phase5-report.json'), '--evaluate-test']
            with patch('phase5_pipeline.PRIVATE', root), patch('sys.stdout', new_callable=io.StringIO), patch('sys.stderr', new_callable=io.StringIO):
                self.assertEqual(main(args), 0)
                with self.assertRaises(SystemExit) as error: main(args)
                self.assertEqual(error.exception.code, 2)

    def test_cli_refuses_existing_dataset_without_import_manifest(self):
        with TemporaryDirectory() as d:
            root = Path(d); path = root/'records.jsonl'; write_fixture(path, [fixture_row()])
            with patch('phase5_pipeline.PRIVATE', root), patch('sys.stderr', new_callable=io.StringIO):
                with self.assertRaises(SystemExit): main(['--data', str(path), '--out', str(root/'report.json')])


if __name__ == '__main__': unittest.main()
