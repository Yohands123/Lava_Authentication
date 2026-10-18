import { build } from 'vite';
import { performance } from 'node:perf_hooks';
import { readFile, writeFile, stat } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
await build({ configFile: false, logLevel: 'error', build: { outDir: '.cache/guard', emptyOutDir: false, lib: { entry: 'scripts/phase4-runtime.ts', formats: ['es'], fileName: () => 'inference-bench.mjs' } } });
const before = process.memoryUsage().heapUsed;
const { estimateRisk } = await import(pathToFileURL(resolve('.cache/guard/inference-bench.mjs')).href);
const artifact = JSON.parse(await readFile('ml/artifacts/robust-logistic-v2.json', 'utf8'));
const legacy = JSON.parse(await readFile('ml/artifacts/logistic-experimental.json', 'utf8'));
const summary = { version: 'lava-features-v1', features: legacy.parityFixture.features, robust: { version: 'lava-robust-v2', features: artifact.parityFixture.features } };
const results = {};
for (const version of ['lava-logistic-experimental-v1', 'lava-robust-logistic-v2']) {
  for (let i=0;i<1000;i++) estimateRisk(summary,version);
  const latencies = [];
  for (let i=0;i<10000;i++) { const start=performance.now(); estimateRisk(summary,version); latencies.push(performance.now()-start); }
  latencies.sort((a,b)=>a-b);
  results[version] = { iterations:10000,p50Ms:latencies[5000],p95Ms:latencies[9500],p99Ms:latencies[9900] };
}
await writeFile('ml/artifacts/phase4-inference-performance.json', JSON.stringify({ runtime:process.version, notes:'Local Node implementation, not Cloudflare edge CPU. Heap change includes module import, JIT and allocation noise.', moduleHeapDeltaBytes:process.memoryUsage().heapUsed-before, portableBundleBytes:(await stat('.cache/guard/inference-bench.mjs')).size, candidateJsonBytes:(await stat('ml/artifacts/robust-logistic-v2.json')).size,results },null,2)+'\n');
console.log(JSON.stringify(results));
