import { build } from 'vite';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { generate, families } from './attacks.mjs';
await mkdir('ml/private', { recursive: true });
await build({ configFile: false, logLevel: 'error', build: { outDir: '.cache/guard', emptyOutDir: false, lib: { entry: 'scripts/phase4-runtime.ts', formats: ['es'], fileName: () => 'phase4.mjs' } } });
const { robustFeatures, extractFeatures } = await import(pathToFileURL(resolve('.cache/guard/phase4.mjs')).href);
const rows = (await readFile('ml/private/normalized.jsonl', 'utf8')).split('\n').filter(Boolean).map(s => JSON.parse(s)).filter(r => r.samples.length >= 12);
for (const family of families) for (let seed = 1; seed <= 40; seed++) rows.push({ id: `local-${family}-${seed}`, source: 'lava-generator-v1', group: `local-${family}`, label: 'bot', samples: generate(family, seed) });
const { path } = await import('ghost-cursor');
for (let seed = 1001; seed <= 1030; seed++) {
  let state = seed;
  const saved = Math.random;
  // Only the visual adversarial generator is seeded, never cryptographic APIs.
  Math.random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  const points = path({ x: .15, y: .2 }, { x: .8, y: .75 }, { spreadOverride: .4 });
  Math.random = saved;
  rows.push({ id: `held-ghost-${seed}`, source: 'independent-generator-v4', group: 'held-ghost', label: 'bot', samples: points.map((p, i) => ({ ...p, t: i * 32 })) });
  let x = .5, y = .5;
  const responsive = Array.from({ length: 256 }, (_, i) => {
    const targetX = .5 + .3 * Math.sin(Math.floor(Math.max(0, i - 5) / 32) * 1.8 + seed), targetY = .5 + .3 * Math.cos(Math.floor(Math.max(0, i - 5) / 32) * 2.1 + seed);
    x += (targetX - x) * .2; y += (targetY - y) * .2;
    return { x, y, t: i * 32, targetX, targetY, targetId: 1 };
  });
  rows.push({ id: `held-reactive-${seed}`, source: 'independent-generator-v4', group: 'held-reactive', label: 'bot', samples: responsive });
  rows.push({ id: `held-replay-${seed}`, source: 'independent-generator-v4', group: 'held-replayed', label: 'bot', samples: generate('variable-speed', seed) });
}
function cadence(points, ms) {
  const samples = [], first = points[0].t, end = points.at(-1).t;
  let j = 1;
  for (let t = first; t <= end && samples.length < 1024; t += ms) {
    while (j < points.length - 1 && points[j].t < t) j++;
    const a = points[j - 1], b = points[j], w = (t - a.t) / Math.max(.001, b.t - a.t);
    samples.push({ x: a.x + (b.x - a.x) * w, y: a.y + (b.y - a.y) * w, t: t - first });
  }
  return samples;
}
const output = [];
for (const r of rows) {
  const variants = { original: r.samples, cadence16: cadence(r.samples, 16), cadence32: cadence(r.samples, 32), cadence64: cadence(r.samples, 64),
    scaled2: r.samples.map(s => ({ ...s, x: s.x * 2 + 3, y: s.y * 2 - 2 })),
    jitter: r.samples.map((s, i) => ({ ...s, x: s.x + .001 * Math.sin(i * 1.73), y: s.y + .001 * Math.cos(i * 2.17) })) };
  output.push({ id: r.id, source: r.source, group: r.group, label: r.label, device: r.device ?? 'synthetic',
    variants: Object.fromEntries(Object.entries(variants).map(([key, samples]) => [key, { features: robustFeatures(samples), legacy: extractFeatures(samples) }])) });
}
await writeFile('ml/private/phase4-features.jsonl', output.map(r => JSON.stringify(r)).join('\n') + '\n');
console.log(JSON.stringify({ rows: output.length, variants: 6, rawRedistributed: false }));
