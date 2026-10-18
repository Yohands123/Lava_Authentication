import { build } from 'vite';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { generate, families } from './attacks.mjs';
await mkdir('ml/private', { recursive: true });
await build({ configFile: false, logLevel: 'error', build: { outDir: '.cache/guard', emptyOutDir: false,
  lib: { entry: 'src/shared/features.ts', formats: ['es'], fileName: () => 'features.mjs' } } });
const { extractFeatures } = await import(pathToFileURL(resolve('.cache/guard/features.mjs')).href);
const rows = [];
try {
  for (const line of (await readFile('ml/private/normalized.jsonl', 'utf8')).trim().split('\n')) {
    if (!line) continue;
    const row = JSON.parse(line);
    if (row.samples.length < 12) continue;
    rows.push({ id: row.id, label: row.label, source: row.source, group: row.group, device: row.device, features: extractFeatures(row.samples) });
  }
} catch (error) { if (error.code !== 'ENOENT') throw error; }
for (const family of families) for (let seed = 1; seed <= 40; seed++) rows.push({ id: `local-${family}-${seed}`, label: 'bot', source: 'lava-generator-v1', group: `local-${family}`, device: 'synthetic', features: extractFeatures(generate(family, seed)) });
await writeFile('ml/private/features.jsonl', rows.map(r => JSON.stringify(r)).join('\n') + '\n');
console.log(JSON.stringify({ extracted: rows.length, output: 'ml/private/features.jsonl' }));
