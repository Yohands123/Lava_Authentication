import { readFile } from 'node:fs/promises';
import { build } from 'vite';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { importStudy } from './study-import.mjs';

const validateOnly = process.argv.includes('--validate-only');
const args = process.argv.slice(2).filter(arg => arg !== '--validate-only');
const migrationIndex = args.indexOf('--migrate-v2');
let migration = null;
if (migrationIndex >= 0) { const path = args[migrationIndex + 1]; if (!path) throw new Error('Provide a private migration manifest.'); migration = JSON.parse(await readFile(path, 'utf8')); args.splice(migrationIndex, 2); }
const files = args;
if (!files.length || files.some(f => f.startsWith('--'))) throw new Error('Provide explicit consenting exports; optional --validate-only or --migrate-v2 MANIFEST.');
await build({ configFile: false, logLevel: 'error', build: { outDir: '.cache/guard', emptyOutDir: false,
  lib: { entry: 'scripts/phase5-runtime.ts', formats: ['es'], fileName: () => 'study-features.mjs' } } });
const runtime = await import(pathToFileURL(resolve('.cache/guard/study-features.mjs')).href + '?v=' + Date.now());
const audit = await importStudy(files, runtime, { validateOnly, migration });
console.log(JSON.stringify(audit));
if (audit.invalid) process.exitCode = 1;
