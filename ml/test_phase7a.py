"""Synthetic fixtures only. Never enroll people or write the private study corpus."""
import copy
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch
from phase7a import zero_error_upper, clustered_flags, supervised_audit, readiness, validate_linkage, evaluate_final, prepare_cohorts, develop, app_source_hash
from study_data import Dataset, digest, canonical
from study_test_fixtures import fixture_row, fixture_rows, write_fixture
from study_withdraw import withdraw

PROTOCOL = json.loads((Path(__file__).parent/'study-protocol.json').read_text(encoding='utf-8'))
PROTOCOL['matchedCapture']['requiredAppSourceHash'] = digest('synthetic-fixture-only')


def supervision(rows, protocol=PROTOCOL):
    return {'schema': 'lava-supervised-study-v1', 'protocolHash': digest(canonical(protocol)), 'approval': 'OWNER_APPROVED',
            'ethicsReview': 'OWNER_DOCUMENTED_NOT_APPLICABLE', 'datasetHash': 'synthetic-hash', 'attempts': {r['id']: {
                'consentStatus': 'current', 'beforeFirstSample': True, 'consentMs': 1, 'captureStartMs': 2, 'firstSampleMs': 3,
                'participant': r['participant'], 'session': r['session'], 'arm': 'prospective', 'deviceCode': 'fixture-device-'+str(i),
                'supervisedHuman': r['label'] == 'human', 'scriptHash': 'fixture-script-'+str(i), 'sourceHash': 'fixture-source-'+str(i),
                'modelFamily': 'fixture-model-'+str(i), 'appSourceHash': protocol['matchedCapture']['requiredAppSourceHash']} for i, r in enumerate(rows)}}


class Phase7StudyTests(unittest.TestCase):
    def test_synthetic_full_workflow_keeps_final_unseen_until_pinned_locked_evaluation(self):
        # Explicitly artificial schema exercise in an OS temporary directory.
        # No fixture enters ml/private, public accuracy artifacts or enrollment.
        with TemporaryDirectory() as d:
            path = Path(d)/'records.jsonl'; rows = fixture_rows(); write_fixture(path, rows)
            (path.parent/'manifest.json').write_text(json.dumps({'schema':'lava-dataset-manifest-v3','datasetHash':digest(path.read_bytes())}))
            protocol = copy.deepcopy(PROTOCOL); protocol['approvalStatus'] = 'OWNER_APPROVED'
            protocol['minimumIndependentHumans'] = dict(train=1, calibration=1, test=1)
            protocol['minimumHeldOutBotFamilies'] = 1; protocol['matchedCapture']['requiredAppSourceHash'] = app_source_hash()
            m = supervision(rows, protocol); m['datasetHash'] = digest(path.read_bytes())
            proposal, cohorts = prepare_cohorts(path, protocol, m); self.assertFalse(proposal['finalAccess'])
            m['cohortHash'] = proposal['cohortHash']
            for r in rows:
                node = 'bot-family:'+r['generator']['family'] if r['label'] == 'bot' else 'human:'+r['participant']
                m['attempts'][r['id']]['cohort'] = cohorts['assignments'][digest(node)]
            developed = develop(path, protocol, m, cohorts)
            self.assertEqual(developed['status'], 'DEVELOPMENT_CALIBRATED_FINAL_UNTOUCHED')
            self.assertFalse(developed['finalTestEvaluated'])
            self.assertFalse(readiness(path, protocol, m, cohorts)[1])
            m.update(independentEvaluationApproval=True, frozenThreshold=developed['frozenThresholdForReview'], frozenCandidateHash=developed['candidateHash'])
            lock = path.parent/'final-evaluation-lock.json'
            with patch('phase7a.run_development_experiments', return_value={'automationEnvironmentComparison':{'status':'SYNTHETIC_FIXTURE_ENVIRONMENT_UNAVAILABLE'}}):
                result = evaluate_final(path, protocol, m, cohorts, lock)
            self.assertTrue(result['finalTestEvaluated']); self.assertFalse(result['productionEligible']); self.assertFalse(result['modelPromoted'])
            self.assertTrue(lock.exists())
            with self.assertRaises(FileExistsError): evaluate_final(path, protocol, m, cohorts, lock)

    def test_partial_withdrawal_revokes_first_and_preserves_final_lock(self):
        with TemporaryDirectory() as d:
            root = Path(d); folder = root/'phase7a'; folder.mkdir()
            data = folder/'export.json'; data.write_text(json.dumps({'schema':'lava-consent-v3','participant':'fixture-person','attempt':'fixture-attempt'}))
            lock = folder/'final-evaluation-lock.json'; lock.write_text('{"schema":"lava-phase7-final-lock-v1"}')
            original = Path.unlink
            def fail_one(path, *args, **kwargs):
                if path == data: raise PermissionError('fixture denied')
                return original(path, *args, **kwargs)
            with patch.object(Path, 'unlink', fail_one): report = withdraw(root, 'fixture-person', True)
            self.assertEqual(report['cleanupStatus'], 'PARTIAL_CLEANUP_REVOKED')
            self.assertIsNone(report['rawAttemptsRemoved']); self.assertTrue(data.exists()); self.assertTrue(lock.exists())
            ledger = json.loads((root/'phase5/withdrawals.json').read_text())
            self.assertIn(digest('fixture-person'), ledger['participantHashes'])
            self.assertEqual(withdraw(root, 'fixture-person', True)['cleanupStatus'], 'SUPPORTED_LOCAL_COPIES_REMOVED')

    def test_global_withdrawal_prevents_phase7_reuse_even_when_rows_survive(self):
        with TemporaryDirectory() as d:
            root = Path(d); folder = root/'phase7a'; folder.mkdir(); legacy = root/'phase5'; legacy.mkdir()
            path = folder/'records.jsonl'; rows = [fixture_row()]; write_fixture(path, rows)
            (legacy/'withdrawals.json').write_text(json.dumps({'participantHashes':[digest(rows[0]['participant'])],'attemptHashes':[]}))
            r, prepared = readiness(path, PROTOCOL, supervision(rows))
            self.assertIsNone(prepared); self.assertEqual(r['datasetAudit']['exclusions']['globally_withdrawn_record'], 1)

    def test_precision_uses_independent_people_not_repeated_attempts(self):
        self.assertIsNone(zero_error_upper(0))
        self.assertGreater(zero_error_upper(8), .3)
        self.assertLess(zero_error_upper(300), .01)
        for n in (True, -1, 3.5):
            with self.assertRaises(ValueError): zero_error_upper(n)

    def test_clustered_endpoint_unknowns_and_zero_errors(self):
        r = clustered_flags(['fixture-a']*3 + ['fixture-b']*3, [.1]*3 + [.1, None, .1], .9)
        self.assertEqual(r['participants'], 2)
        self.assertEqual(r['participantsWithUnknownOutcome'], 1)
        self.assertEqual(r['missingOutcomeRange'], [0, .5])
        self.assertGreater(r['zeroErrorOneSided95Upper'], .9)
        self.assertIsNone(clustered_flags([], [], .9)['completeCaseFalseFlagRate'])
        self.assertEqual(clustered_flags(['fixture-a']*3, [1, None, None], .9)['participantsWithObservedFlag'], 1)
        self.assertEqual(clustered_flags(['fixture-a'], [.1], .9)['participantsWithUnknownOutcome'], 1)

    def test_supervision_never_reconstructed_from_clear_or_self_report(self):
        row = fixture_row(); ds = Dataset([row], [row], {}, 'synthetic-hash', True)
        rows, audit = supervised_audit(ds, {}, PROTOCOL)
        self.assertFalse(rows); self.assertTrue(audit['issues'])
        for mutation in ('consentStatus', 'beforeFirstSample', 'supervisedHuman', 'participant', 'session', 'deviceCode'):
            m = supervision([row]); m['attempts'][row['id']][mutation] = None
            self.assertFalse(supervised_audit(ds, m, PROTOCOL)[0])
        m = supervision([row]); m['attempts'][row['id']]['consentMs'] = 4
        self.assertIn('consent_timing_unverified', supervised_audit(ds, m, PROTOCOL)[1]['exclusions'])

    def test_pilot_cannot_become_untouched_prospective_data(self):
        a, b = fixture_row(), fixture_row(2, participant=fixture_row()['participant'])
        ds = Dataset([a,b], [a,b], {}, 'synthetic-hash', True); m = supervision([a,b]); m['attempts'][a['id']]['arm'] = 'pilot'
        self.assertIn('pilot_prospective_participant_overlap', supervised_audit(ds, m, PROTOCOL)[1]['issues'])

    def test_source_seed_script_model_and_shared_device_overlap_refused(self):
        a, b = fixture_row(1000, 'bot'), fixture_row(1001, 'bot'); m = supervision([a,b])
        parts = {'train':[a], 'test':[b]}
        validate_linkage(parts, m)
        for key in ('scriptHash', 'sourceHash', 'modelFamily', 'deviceCode'):
            c = copy.deepcopy(m); c['attempts'][b['id']][key] = c['attempts'][a['id']][key]
            with self.subTest(key=key), self.assertRaises(ValueError): validate_linkage(parts, c)
        b['generator']['seed'] = a['generator']['seed']
        with self.assertRaises(ValueError): validate_linkage(parts, m)

    def test_missing_real_study_has_null_metrics_and_no_final_lock(self):
        with TemporaryDirectory() as d:
            path = Path(d)/'records.jsonl'; lock = Path(d)/'final-evaluation-lock.json'
            r = evaluate_final(path, PROTOCOL, {}, None, lock)
            self.assertEqual(r['status'], 'NOT_READY_NO_OPT_IN_DATA')
            self.assertEqual(r['genuineHumanParticipants'], 0)
            self.assertIsNone(r['humanFalseFlagRate']); self.assertIsNone(r['accuracy']); self.assertFalse(lock.exists())

    def test_invalid_manifest_or_governance_prevents_training(self):
        with TemporaryDirectory() as d:
            path = Path(d)/'records.jsonl'; rows = [fixture_row()]; write_fixture(path, rows)
            m = supervision(rows); m['datasetHash'] = digest(path.read_bytes())
            r, prepared = readiness(path, PROTOCOL, m)
            self.assertIsNone(prepared); self.assertIn('dataset_manifest_required', r['supervisionAudit']['issues'])

    def test_final_lock_is_reserved_before_fitting_and_survives_errors(self):
        with TemporaryDirectory() as d:
            lock = Path(d)/'lock.json'
            with patch('phase7a.readiness', return_value=({'datasetHash':'fixture-only'}, ({}, {}, []))), patch('phase7a.train_and_score', side_effect=RuntimeError('fixture failure')):
                with self.assertRaises(RuntimeError): evaluate_final(Path(d)/'rows', PROTOCOL, {}, None, lock)
                self.assertEqual(json.loads(lock.read_text())['state'], 'reserved_before_final_access')
                with self.assertRaises(FileExistsError): evaluate_final(Path(d)/'rows', PROTOCOL, {}, None, lock)


if __name__ == '__main__': unittest.main()
