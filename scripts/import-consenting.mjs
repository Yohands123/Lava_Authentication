import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { build } from 'vite';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const validateOnly = process.argv.includes('--validate-only');
const files = process.argv.slice(2).filter(arg => arg !== '--validate-only');
if (!files.length) throw new Error('Provide explicitly exported lava-consent-v2 JSON files. See docs/LAVAGUARD_HUMAN_STUDY.md.');
await build({ configFile: false, logLevel: 'error', build: { outDir: '.cache/guard', emptyOutDir: false,
  lib: { entry: 'scripts/phase4-runtime.ts', formats: ['es'], fileName: () => 'study-features.mjs' } } });
const { extractFeatures, robustFeatures } = await import(pathToFileURL(resolve('.cache/guard/study-features.mjs')).href);
await mkdir('ml/private', { recursive: true });
let previous = '';
try { previous = await readFile('ml/private/consenting-features.jsonl', 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const rows = previous.split('\n').filter(Boolean).map(s => JSON.parse(s)), ids = new Set(rows.map(r => r.id));
for (const file of files) {
  const data = JSON.parse(await readFile(file, 'utf8'));
  if (data.schema !== 'lava-consent-v2' || data.consent !== true || data.consentScope !== 'one-local-attempt-export' || data.source !== 'lava-consenting-local' || data.featureNormalization !== 'ring-diameter') throw new Error('Invalid consent/provenance');
  if (!/^[\w-]{8,64}$/.test(data.participant) || typeof data.attempt !== 'string' || !/^[\w-]{16,64}$/.test(data.attempt)) throw new Error('Missing study IDs');
  if (!Array.isArray(data.samples) || data.samples.length < 12 || data.samples.length > 1024 || data.samples.some(s => ![s.x, s.y, s.t].every(Number.isFinite))) throw new Error('Invalid scoped samples');
  if (!['human-self-report', 'automation-declared'].includes(data.label)) throw new Error('Keep unlabeled attempts out of labeled evaluation');
  if (!['mouse', 'trackpad', 'touch', 'pen', 'assisted', 'unknown'].includes(data.device)) throw new Error('Choose a declared study device');
  if (data.samples.some((s, i) => i > 0 && s.t <= data.samples[i - 1].t)) throw new Error('Study timestamps must increase');
  if (!ids.has(data.attempt)) {
    rows.push({ id: data.attempt, participant: data.participant, device: data.device, source: data.source, label: data.label === 'human-self-report' ? 'human' : 'bot', labelProvenance: 'self-report-not-attested', group: 'participant-' + data.participant, features: extractFeatures(data.samples), robust: { version: 'lava-robust-v2', features: robustFeatures(data.samples) } });
    ids.add(data.attempt);
  }
}
if (!validateOnly) await writeFile('ml/private/consenting-features.jsonl', rows.map(r => JSON.stringify(r)).join('\n') + '\n');
console.log(JSON.stringify({ importedTotal: rows.length, rawUploaded: false, validateOnly }));
