import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
export const digest = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
export const canonical = value => JSON.stringify(value, (_, v) => v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map(k => [k, v[k]])) : v);
export async function optionalJson(path, fallback) { try { return JSON.parse(await readFile(path, 'utf8')); } catch (error) { if (error.code === 'ENOENT') return fallback; throw error; } }
export async function atomicWrite(path, text) { await writeFile(path + '.tmp', text); await rename(path + '.tmp', path); }

/** Legacy migration requires an explicit coordinator manifest; no capture or
 * consent facts are inferred from the outcome, label, or WebDriver signal. */
export function migrateV2(data, manifest) {
  const allowed = ['schema', 'consent', 'consentScope', 'source', 'participant', 'device', 'label', 'attempt', 'featureVersion', 'featureNormalization', 'decision', 'bubbleResponse', 'provenance', 'samples'];
  const entry = manifest?.schema === 'lava-study-migration-v1' ? manifest.attempts?.[data.attempt] : null;
  if (!entry || data.featureNormalization !== 'ring-diameter' || Object.keys(data).some(k => !allowed.includes(k))) throw new Error('legacy_requires_explicit_migration');
  // Legacy diagnostics are discarded, but credential-shaped nested fields are
  // rejected rather than silently accepted as a research input.
  const forbidden = /^(cookie|cookies|authorization|password|secret|token|clearance|credential|credentials|email|accountId)$/i;
  const inspect = value => {
    if (value && typeof value === 'object') for (const [key, nested] of Object.entries(value)) {
      if (forbidden.test(key)) throw new Error('forbidden_legacy_field');
      inspect(nested);
    }
  };
  inspect(data);
  return { schema: 'lava-consent-v3', consent: data.consent, consentScope: data.consentScope, source: data.source,
    participant: data.participant, attempt: data.attempt, session: entry.session, device: data.device, label: data.label,
    labelProvenance: data.label === 'human-self-report' ? 'participant-self-report' : data.label === 'automation-declared' ? 'operator-declared-automation' : 'unlabeled',
    featureVersion: data.featureVersion, robustVersion: 'lava-robust-v2', normalizationVersion: 'ring-diameter-v1',
    consentProvenance: entry.consentProvenance, capture: entry.capture, generator: entry.generator ?? null,
    outcome: entry.outcome, samples: data.samples };
}

export async function importStudy(files, runtime, { validateOnly = false, migration = null, storageFolder = 'ml/private/phase5' } = {}) {
  // CLI never exposes storageFolder; dependency injection isolates unit fixtures.
  const folder = resolve(storageFolder);
  const audit = { schema: 'lava-import-audit-v3', sourceFiles: files.length, accepted: 0, incomplete: 0, invalid: 0, exclusions: {}, rawUploaded: false, validateOnly };
  const note = (kind, code) => { audit[kind]++; audit.exclusions[code] = (audit.exclusions[code] ?? 0) + 1; };
  let text = '';
  try { text = await readFile(folder + '/records.jsonl', 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const rows = text.split('\n').filter(Boolean).map(line => JSON.parse(line));
  if (rows.some(r => r.schema !== 'lava-study-record-v3' || !r.signatures || !r.quality)) throw new Error('Existing dataset requires strict-schema review; no overwrite performed.');
  const priorManifest = await optionalJson(folder + '/manifest.json', { sourceHashes: [] });
  if (text && (priorManifest.schema !== 'lava-dataset-manifest-v3' || priorManifest.datasetHash !== digest(text))) throw new Error('Existing dataset manifest integrity mismatch; no rebaseline performed.');
  const ids = new Map(rows.map(r => [r.id, r]));
  const hasMovement = r => r.features.samples >= 12 && r.features.pathLength >= .1 && r.features.durationMs >= 200;
  const vectors = new Map(rows.filter(hasMovement).map(r => [digest(canonical(r.robust)), r.label]));
  const paths = new Map(rows.filter(hasMovement).map(r => [r.signatures.path, r.label]));
  const ledger = await optionalJson(folder + '/withdrawals.json', { participantHashes: [], attemptHashes: [] });
  const retained = [], sourceHashes = [];
  for (const file of files) {
    let data;
    try { const raw = await readFile(file, 'utf8'); sourceHashes.push(digest(raw)); data = JSON.parse(raw); }
    catch { note('invalid', 'unreadable_export'); continue; }
    if (!data || typeof data !== 'object' || Array.isArray(data)) { note('invalid', 'invalid_export_object'); continue; }
    const batch = data.schema === 'lava-consent-batch-v1';
    if (batch && (Object.keys(data).sort().join(',') !== 'exports,schema' || !Array.isArray(data.exports) || data.exports.length > 32)) { note('invalid', 'invalid_batch'); continue; }
    const exports = batch ? data.exports : [data];
    for (let record of exports) {
      try { if (record?.schema === 'lava-consent-v2') record = migrateV2(record, migration); }
      catch { note('invalid', 'legacy_requires_explicit_migration'); continue; }
      const result = runtime.validateResearchExport(record);
      if (!result.data) { note('invalid', result.issues.find(i => i.kind === 'invalid')?.code ?? 'invalid_export'); continue; }
      const row = await runtime.deriveStudyRecord(result.data);
      if (ledger.participantHashes.includes(digest(row.participant)) || ledger.attemptHashes.includes(digest(row.id))) { note('invalid', 'withdrawn_record'); continue; }
      if (ids.has(row.id)) { note('invalid', ids.get(row.id).label === row.label ? 'duplicate_attempt' : 'conflicting_label'); continue; }
      const vector = digest(canonical(row.robust));
      const duplicateLabels = hasMovement(row) ? [vectors.get(vector), paths.get(row.signatures.path)].filter(x => x !== undefined) : [];
      if (duplicateLabels.some(label => label !== row.label && label !== 'unlabeled' && row.label !== 'unlabeled')) { note('invalid', 'conflicting_duplicate_label'); continue; }
      if (duplicateLabels.length) row.quality.issues.push({ kind: 'incomplete', code: 'duplicate_feature_or_path' });
      row.quality.eligible = row.quality.issues.length === 0;
      if (!row.quality.eligible) {
        audit.incomplete++;
        for (const issue of row.quality.issues) audit.exclusions[issue.code] = (audit.exclusions[issue.code] ?? 0) + 1;
      } else audit.accepted++;
      ids.set(row.id, row);
      if (hasMovement(row)) { vectors.set(vector, row.label); paths.set(row.signatures.path, row.label); }
      rows.push(row);
      retained.push({ hash: digest(canonical(record)), data: record });
    }
  }
  audit.totalRecords = rows.length;
  audit.written = !validateOnly && !audit.invalid;
  audit.datasetHash = digest(rows.slice().sort((a, b) => a.id.localeCompare(b.id)).map(r => canonical(r)).join('\n') + '\n');
  if (!validateOnly && !audit.invalid) {
    await mkdir(folder + '/exports', { recursive: true });
    for (const raw of retained) await atomicWrite(folder + '/exports/' + raw.hash + '.json', canonical(raw.data) + '\n');
    await atomicWrite(folder + '/records.jsonl', rows.slice().sort((a, b) => a.id.localeCompare(b.id)).map(r => canonical(r)).join('\n') + '\n');
    const manifest = { schema: 'lava-dataset-manifest-v3', datasetVersion: 'phase5-' + audit.datasetHash.slice(0, 16), datasetHash: audit.datasetHash,
      recordSchema: 'lava-study-record-v3', featureVersions: ['lava-features-v1', 'lava-robust-v2', 'lava-response-v3'], normalizationVersion: 'ring-diameter-v1',
      extractionRevision: 'lava-capture-v3', sourceHashes: [...new Set([...(priorManifest.sourceHashes ?? []), ...sourceHashes])].sort(), records: rows.length, audit,
      researchExtensions: rows.some(r => r.environment) ? ['lava-research-environment-v1'] : [],
      lineage: 'Canonical JSON, sorted by attempt ID; source hashes and private raw copies support explicit withdrawal. Labels are declarations.' };
    await atomicWrite(folder + '/manifest.json', canonical(manifest) + '\n');
    await atomicWrite(folder + '/last-import-audit.json', canonical(audit) + '\n');
  }
  return audit;
}
