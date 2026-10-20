"""Publish synthetic shortcut sensitivity only, never application accuracy."""
import json
from pathlib import Path
from automation_environment import development_environment_comparison
from study_test_fixtures import fixture_rows


def main():
    rows = fixture_rows()
    for row in rows:
        automated = row['label'] == 'bot'
        row['environment'] = {'version': 'lava-research-environment-v1',
            'declaredEnvironment': 'headless-playwright' if automated else 'ordinary-chrome',
            'declaredControl': 'scripted' if automated else 'human', 'displayMode': 'headless' if automated else 'headed',
            'evidence': {'version': 'lava-automation-environment-v1', 'authority': 'advisory',
                'signals': {'webdriver': automated, 'headlessUserAgent': automated, 'headlessBrand': None}}}
    report = development_environment_comparison(rows, 'f'*64)
    assert report['status'] == 'DIAGNOSTIC_ONLY_NOT_VALIDATED'
    variants = {name: {'generatedHumanLabeledTestRows': v['humanAttempts'], 'generatedBotLabeledTestRows': v['botAttempts'],
        'counterfactualEnvironmentChanges': v['counterfactualEnvironmentChanges']} for name, v in report['variants'].items()}
    assert variants['behavior-only']['counterfactualEnvironmentChanges']['all-positive']['maxAbsoluteScoreDelta'] == 0
    assert variants['environment-only']['counterfactualEnvironmentChanges']['all-hidden']['decisionFlipN'] > 0
    assert variants['environment-only']['counterfactualEnvironmentChanges']['all-positive']['humanFlagged'] > 0
    out = {'schema': 'lava-environment-shortcut-smoke-v1', 'syntheticOnly': True, 'notStudyEvidence': True,
        'generatedFixtureRows': len(rows), 'actualHumanParticipants': 0, 'applicationRowsWritten': False,
        'productionInfluence': False, 'artifactExported': False, 'variants': variants,
        'interpretation': 'Labels and environment correlation were constructed. Counterfactual flips demonstrate shortcut sensitivity, not real user or AI detection accuracy.'}
    target = Path(__file__).resolve().parent/'artifacts/automation-environment-shortcuts.json'
    target.write_text(json.dumps(out, indent=2, allow_nan=False)+'\n', encoding='utf-8')
    print(json.dumps(out))


if __name__ == '__main__': main()
