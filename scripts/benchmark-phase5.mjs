import { build } from 'vite';
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
await build({ configFile: false, logLevel: 'error', build: { outDir: '.cache/phase5-benchmark', emptyOutDir: false,
  lib: { entry: 'scripts/phase5-runtime.ts', formats: ['es'], fileName: () => 'runtime.mjs' } } });
const url = pathToFileURL(resolve('.cache/phase5-benchmark/runtime.mjs')).href;
const beganImport = performance.now(), runtime = await import(url), importMs = performance.now()-beganImport;
const fixture = JSON.parse(await readFile('tests/fixtures/phase5-portable.json', 'utf8'));
if (!fixture.syntheticOnly || !fixture.notStudyEvidence) throw new Error('Use an explicit synthetic parity fixture, never study records.');
const context = { mode: 'shadow', device: 'mouse', datasetHash: fixture.model.datasetHash, datasetState: 'current', withdrawnDatasetHashes: [] };
const prepared = runtime.preparePortableModel(fixture.model), vector = fixture.vectors[0].features;
const percentile = (values, q) => [...values].sort((a, b) => a-b)[Math.min(values.length-1, Math.floor(values.length*q))];
const time = (f, n) => {
  for (let i = 0; i < 200; i++) f();
  const values = [];
  for (let i = 0; i < n; i++) { const began = performance.now(); f(); values.push(performance.now()-began); }
  return { n, p50Ms: percentile(values, .5), p95Ms: percentile(values, .95), p99Ms: percentile(values, .99) };
};
const points = Array.from({ length: 1024 }, (_, i) => ({ x: .5+.3*Math.cos(i*.13), y: .5+.3*Math.sin(i*.17), t: 45+i*32+i%5,
  targetX: .5+.2*Math.cos(i*.11), targetY: .5+.2*Math.sin(i*.09), targetId: Math.floor(i/100), bubbleCount: Math.max(0, 12-Math.floor(i/100)) }));
const summary = { version: 'lava-features-v1', features: runtime.extractFeatures(points), fingerprint: 'f'.repeat(43), geometryHash: 'g'.repeat(43), robust: { version: 'lava-robust-v2', features: runtime.robustFeatures(points) } };
const memoryBefore = process.memoryUsage().heapUsed;
const report = { schema: 'lava-phase5-runtime-benchmark-v1', syntheticOnly: true, notStudyEvidence: true, node: process.version, platform: process.platform,
  fixtureHash: createHash('sha256').update(JSON.stringify(fixture)).digest('hex'), moduleImportMs: importMs,
  modelBytes: Buffer.byteLength(JSON.stringify(fixture.model)), portableBundleBytes: (await stat('.cache/phase5-benchmark/runtime.mjs')).size,
  legacy: time(() => runtime.estimateRisk(summary, 'lava-logistic-experimental-v1'), 10000),
  robustPhase4: time(() => runtime.estimateRisk(summary, 'lava-robust-logistic-v2'), 10000),
  portableValidatedEachCall: time(() => runtime.estimatePortableRisk(fixture.model, vector, context), 10000),
  portablePrepared: time(() => prepared(vector, context), 10000),
  featureExtraction1024: { robust: time(() => runtime.robustFeatures(points), 500), response: time(() => runtime.experimentalFeatures(points), 500) },
  limitations: ['Local Node timings, not Worker edge CPU or browser FPS', 'Heap delta includes JIT, loop allocations and garbage collection noise', 'Synthetic model fixture is not a human-trained application candidate'] };
report.observedHeapDeltaBytes = process.memoryUsage().heapUsed-memoryBefore;
const batchStart = performance.now(); for (let i = 0; i < 10000; i++) prepared(vector, context);
report.preparedBatch10000Ms = performance.now()-batchStart;
await writeFile('.cache/phase5-benchmark/cold.mjs', `import {readFile} from 'node:fs/promises'; const began=performance.now(); const r=await import(${JSON.stringify(url)}); const importMs=performance.now()-began; const f=JSON.parse(await readFile('tests/fixtures/phase5-portable.json','utf8')); const start=performance.now(); r.estimatePortableRisk(f.model,f.vectors[0].features,{mode:'shadow',device:'mouse',datasetHash:f.model.datasetHash,datasetState:'current',withdrawnDatasetHashes:[]}); console.log(JSON.stringify({moduleImportMs:importMs,firstInferenceMs:performance.now()-start}));`);
report.freshNodeProcess = JSON.parse(execFileSync(process.execPath, ['.cache/phase5-benchmark/cold.mjs'], { encoding: 'utf8' }));
await mkdir('ml/artifacts', { recursive: true });
await writeFile('ml/artifacts/phase5-inference-performance.json', JSON.stringify(report, null, 2)+'\n');
console.log(JSON.stringify(report));
