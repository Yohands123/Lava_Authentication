import { build } from 'vite';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { families, generate } from './attacks.mjs';

await build({ configFile: false, logLevel: 'error', build: { outDir: '.cache/guard', emptyOutDir: false,
  lib: { entry: 'scripts/guard-runtime.ts', formats: ['es'], fileName: () => 'research.mjs' } } });
const { StirMeter, extractFeatures, bubbleResponse } = await import(pathToFileURL(resolve('.cache/guard/research.mjs')).href);
const corpus = (await readFile('ml/private/normalized.jsonl', 'utf8')).split('\n').filter(Boolean).map(s => JSON.parse(s)).filter(r => r.samples.length >= 12);
for (const family of families) for (let seed = 1; seed <= 40; seed++) corpus.push({ id: `local-${family}-${seed}`, source: 'lava-generator-v1', label: 'bot', group: `local-${family}`, samples: generate(family, seed) });
const baseline = { meaning: 'Original StirMeter crediting, not visual ring completion or human detection. Assumes trusted public samples for comparability; provenance is not event attestation.', byGroup: {} };
const matched = [];
for (const row of corpus) {
  const meter = new StirMeter();
  for (let i = 1; i < row.samples.length; i++) {
    const s = row.samples[i], prior = row.samples[i - 1];
    meter.accept({ dx: s.x - prior.x, dy: s.y - prior.y, dt: s.t - prior.t, pressure: 0, tiltX: 0, tiltY: 0, trusted: s.trusted !== false }, s.t);
  }
  const tally = baseline.byGroup[row.group] ??= { n: 0, humanN: 0, botN: 0, humanMeterCompleteN: 0, botMeterCompleteN: 0, meanProgress: 0 };
  tally.n++; tally[row.label === 'human' ? 'humanN' : 'botN']++;
  if (meter.complete) tally[row.label === 'human' ? 'humanMeterCompleteN' : 'botMeterCompleteN']++;
  tally.meanProgress += meter.progress;
  // Explicit resampling control; interpolation does not create new independent data.
  const samples = [], start = row.samples[0].t, end = row.samples.at(-1).t;
  let j = 1;
  for (let t = start; t <= end && samples.length < 1024; t += 32) {
    while (j < row.samples.length - 1 && row.samples[j].t < t) j++;
    const a = row.samples[j - 1], b = row.samples[j], w = Math.min(1, Math.max(0, (t - a.t) / Math.max(.001, b.t - a.t)));
    samples.push({ x: a.x + w * (b.x - a.x), y: a.y + w * (b.y - a.y), t: t - start });
  }
  if (samples.length >= 12) matched.push({ id: row.id, source: row.source, group: row.group, label: row.label, features: extractFeatures(samples) });
}
for (const tally of Object.values(baseline.byGroup)) tally.meanProgress /= tally.n;
await writeFile('ml/artifacts/phase2-stirmeter.json', JSON.stringify(baseline, null, 2) + '\n');
await writeFile('ml/private/matched-features.jsonl', matched.map(r => JSON.stringify(r)).join('\n') + '\n');

function targets(seed) {
  let state = seed;
  const rng = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  const positions = Array.from({ length: 14 }, () => ({ x: .15 + rng() * .7, y: .15 + rng() * .7 }));
  return Array.from({ length: 400 }, (_, i) => positions[Math.floor(i / 32)]);
}
function follow(arrangement, lag = 5) {
  let x = .5, y = .5;
  return arrangement.map((target, i) => {
    const delayed = arrangement[Math.max(0, i - lag)];
    x += (delayed.x - x) * .2; y += (delayed.y - y) * .2;
    return { x, y, t: i * 32, targetX: target.x, targetY: target.y, targetId: 1 };
  });
}
const bubble = { seed: 42, humanN: 0, interpretation: 'Deterministic synthetic responsiveness benchmark. A reactive bot can score well. Correlation and nearest-target switches cannot establish human presence.', cases: [] };
for (const seed of [42, 812, 20261017]) {
  const a = targets(seed), b = targets(seed + 1), responsive = follow(a);
  const indifferent = generate('variable-speed', seed);
  const moving = a.map((_, i) => ({ x: .2 + (i % 128 <= 64 ? i % 128 : 128 - i % 128) * .008, y: .4 + .1 * Math.sin(i / 20 + seed) }));
  const cases = {
    'reactive-160ms': responsive,
    'reactive-0ms': follow(a, 0),
    'moving-target-reactive': follow(moving),
    'moving-target-independent': moving.map((target, i) => ({ ...indifferent[i % indifferent.length], t: i * 32, targetX: target.x, targetY: target.y, targetId: 1 })),
    'same-path-other-arrangement': responsive.map((s, i) => ({ ...s, targetX: b[i].x, targetY: b[i].y })),
    'target-independent': a.map((target, i) => ({ ...indifferent[i % indifferent.length], t: i * 32, targetX: target.x, targetY: target.y, targetId: 1 })),
  };
  for (const [family, samples] of Object.entries(cases)) bubble.cases.push({ seed, family,
    pathHash: createHash('sha256').update(JSON.stringify(samples.map(({ x, y, t }) => [x, y, t]))).digest('hex'), features: bubbleResponse(samples) });
}
await writeFile('ml/artifacts/phase2-bubble-response.json', JSON.stringify(bubble, null, 2) + '\n');
console.log(JSON.stringify({ stirmeterRows: corpus.length, resampledRows: matched.length, bubbleCases: bubble.cases.length }));
