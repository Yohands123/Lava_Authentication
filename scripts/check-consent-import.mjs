import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { generate } from './attacks.mjs';

await mkdir('.cache/consent-import-check', { recursive: true });
const path = '.cache/consent-import-check/declared-automation.json';
const fixture = { schema: 'lava-consent-v2', consent: true, consentScope: 'one-local-attempt-export', source: 'lava-consenting-local',
  featureNormalization: 'ring-diameter', participant: 'declared-automation-test', attempt: randomUUID(), device: 'mouse',
  label: 'automation-declared', samples: generate('corrections', 42) };
async function existingCorpus() {
  try { return await readFile('ml/private/consenting-features.jsonl', 'utf8'); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}
const before = await existingCorpus();
const run = () => spawnSync(process.execPath, ['scripts/import-consenting.mjs', '--validate-only', path], { encoding: 'utf8' });
await writeFile(path, JSON.stringify(fixture));
const valid = run(); assert.equal(valid.status, 0, valid.stderr);
for (const change of [{ consent: false }, { label: 'unlabeled' }, { participant: '' }, { samples: [] }]) {
  await writeFile(path, JSON.stringify({ ...fixture, ...change }));
  assert.notEqual(run().status, 0, 'Invalid study input was accepted');
}
assert.equal(await existingCorpus(), before, 'Validation-only workflow must not change the application corpus');
await writeFile('ml/artifacts/phase2-consent-import.json', JSON.stringify({ syntheticDeclaredAutomationOnly: true,
  validExportAccepted: true, missingConsentRejected: true, unlabeledRejected: true, missingStudyCodeRejected: true,
  emptyTraceRejected: true, persistedApplicationRows: false }, null, 2) + '\n');
console.log('Consent importer: valid declared-automation export accepted; four invalid variants rejected; study corpus unchanged.');
