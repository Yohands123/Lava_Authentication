"""Synthetic identifiers only: test grouping without inventing human traces."""
import unittest
from train_application import cohorts


class ParticipantSplitTests(unittest.TestCase):
    def test_independent_complete_cohorts(self):
        rows = [{'participant': 'fixture-'+str(i//5)} for i in range(80)]
        split = cohorts(rows)
        self.assertEqual(sorted(i for part in split for i in part), list(range(80)))
        identities = [{rows[i]['participant'] for i in part} for part in split]
        self.assertTrue(all(identities))
        self.assertFalse(identities[0] & identities[1] or identities[0] & identities[2] or identities[1] & identities[2])

    def test_deterministic_group_assignment(self):
        rows = [{'participant': 'fixture-'+str(i//3)} for i in range(48)]
        self.assertEqual(cohorts(rows), cohorts(rows))


if __name__ == '__main__':
    unittest.main()
