import { build } from 'vite';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { digest } from './study-import.mjs';
const folder = 'ml/private/phase5';
await build({ configFile: false, logLevel: 'error', build: { outDir: '.cache/phase5-experiments', emptyOutDir: false,
  lib: { entry: 'scripts/phase5-runtime.ts', formats: ['es'], fileName: () => 'runtime.mjs' } } });
const runtime = await import(pathToFileURL(resolve('.cache/phase5-experiments/runtime.mjs')).href);
let names = [], rows = '', source = [];
try { names = await readdir(folder+'/exports'); rows = await readFile(folder+'/records.jsonl', 'utf8'); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
const currentIds = new Set(rows.split('\n').filter(Boolean).map(s => JSON.parse(s).id));
for (const name of names.filter(n => /^[a-f0-9]{64}\.json$/.test(n)).sort()) {
  const record = JSON.parse(await readFile(folder+'/exports/'+name, 'utf8'));
  if (currentIds.has(record.attempt)) source.push(record);
}
const report = { schema: 'lava-phase5-perturbation-summary-v1', dataScope: 'Current consenting application exports, no new independent people',
  recordedHumanAttempts: source.filter(r => r.label === 'human-self-report').length, declaredAutomationAttempts: source.filter(r => r.label === 'automation-declared').length,
  originals: source.length, invalidExports: 0, eligibleOriginals: 0, variants: {},
  inferenceMeaning: 'Fixed Phase 4 robust corpus candidate scored offline; not server decisions or validated application accuracy', datasetHash: digest(rows),
  cadenceControlsAreDerivedViews: true, newApplicationModelFit: false };
const variants = {}, changes = {};
const median = list => list.length ? [...list].sort((a, b) => a-b)[Math.floor(list.length/2)] : null;
function score(samples, robust) {
  return runtime.estimateRisk({ version: 'lava-features-v1', features: runtime.extractFeatures(samples), fingerprint: 'f'.repeat(43), geometryHash: 'g'.repeat(43), robust }, 'lava-robust-logistic-v2');
}
for (const record of source) {
  const checked = runtime.validateResearchExport(record);
  if (!checked.data) { report.invalidExports++; continue; }
  const eligible = checked.issues.length === 0;
  if (eligible) report.eligibleOriginals++;
  const baseline = runtime.robustFeatures(record.samples), oldScore = score(record.samples, { version: 'lava-robust-v2', features: baseline });
  variants[record.attempt] = {};
  for (const [name, item] of Object.entries(runtime.researchVariants(record.samples, 20261018))) {
    const robust = { version: 'lava-robust-v2', features: runtime.robustFeatures(item.samples) }, experimental = { version: 'lava-response-v3', features: runtime.experimentalFeatures(item.samples) };
    variants[record.attempt][name] = { robust, experimental, truncated: item.truncated, sampleCount: item.samples.length };
    const stats = report.variants[name] ??= { traces: 0, eligibleOriginals: 0, truncated: 0, insufficientSampleViews: 0, nonfiniteFeatureViews: 0 };
    stats.traces++; stats.eligibleOriginals += Number(eligible); stats.truncated += Number(item.truncated); stats.insufficientSampleViews += Number(item.samples.length < 12);
    stats.nonfiniteFeatureViews += Number(![...Object.values(robust.features), ...Object.values(experimental.features)].every(Number.isFinite));
    if (eligible) {
      const estimate = score(item.samples, robust), values = changes[name] ??= { features: [], scores: [], ood: 0 };
      values.features.push(Math.max(...runtime.ROBUST_KEYS.map(k => Math.abs(robust.features[k]-baseline[k]))));
      if (estimate.riskScore !== null && oldScore.riskScore !== null) values.scores.push(Math.abs(estimate.riskScore-oldScore.riskScore));
      values.ood += Number(estimate.uncertainty.outOfDistribution);
    }
  }
}
for (const [name, values] of Object.entries(changes)) Object.assign(report.variants[name], { medianMaxAbsoluteRobustFeatureDelta: median(values.features), medianAbsoluteFixedModelScoreDelta: median(values.scores), oodViews: values.ood });
report.status = source.length ? 'DESCRIPTIVE_CAPTURE_PERTURBATIONS_NOT_HUMAN_VALIDATION' : 'NOT_READY_NO_CAPTURE_DATA';
await mkdir(folder, { recursive: true }); await mkdir('ml/artifacts', { recursive: true });
await writeFile(folder+'/perturbations.json', JSON.stringify({ schema: 'lava-perturbations-v1', datasetHash: digest(rows), variants }, null, 2)+'\n');
await writeFile('ml/artifacts/phase5-perturbations.json', JSON.stringify(report, null, 2)+'\n');
console.log(JSON.stringify(report));
