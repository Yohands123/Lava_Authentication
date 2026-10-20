import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

const parse = async file => JSON.parse(await readFile(file, 'utf8'));
const report = await parse('ml/private/automation-environment-report.json');
const bytes = await readFile('ml/private/phase5/records.jsonl');
assert.equal(report.datasetHash, createHash('sha256').update(bytes).digest('hex'));
const coverage = await parse('ml/artifacts/automation-environment-coverage.json');
const shortcuts = await parse('ml/artifacts/automation-environment-shortcuts.json');
assert.ok(!coverage.error && coverage.summary.measured >= 9 && coverage.summary.measured + coverage.summary.skipped === 10 && shortcuts.syntheticOnly);
const out = { schema: 'lava-automation-environment-readiness-v1', datasetHash: report.datasetHash,
  applicationReadiness: report.status, applicationAttempts: report.applicationAttempts, eligibleAttempts: report.eligibleAttempts,
  declaredHumanAttempts: report.declaredHumanAttempts, declaredBotAttempts: report.declaredBotAttempts,
  automationEnvironment: report.automationEnvironment, automationEnvironmentComparison: report.automationEnvironmentComparison,
  controlledBrowserConfigurationsMeasured: coverage.summary.measured,
  syntheticDiagnosticVariantsExecuted: Object.keys(shortcuts.variants),
  humanPopulationExposureRate: null, humanPopulationFpr: null, actualHumanControlledBrowserTrials: 0,
  vmOrRemoteDesktopInference: false, aiIdentityDetectionClaim: false, productionEnforcementEnabled: false,
  finalTestEvaluated: report.finalTestEvaluated, applicationModelPromoted: report.modelPromoted,
  limitations: ['Controlled configuration observations are not independent people or population prevalence.',
    'No genuine-human data establishes whether adding these hints improves application risk assessment.',
    'Old records remain missing; no environment context or consent was reconstructed.'] };
await writeFile('ml/artifacts/automation-environment-readiness.json', JSON.stringify(out, null, 2) + '\n');
console.log(JSON.stringify({ applicationReadiness: out.applicationReadiness, measured: coverage.summary.measured, actualHumanControlledBrowserTrials: 0 }));
