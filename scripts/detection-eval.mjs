// Runs the real LavaDetector over local private rows and prints aggregate
// counts only. No row, id or feature value leaves this process.
//   bots:   ml/private/phase5|phase6 records (scripted attacks on this app)
//   humans: ml/private/features.jsonl public research rows (not this task;
//           a transfer check, not LavaGuard's human false-positive rate)
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'vite';

await build({ configFile: false, logLevel: 'error', build: { outDir: '.cache/detection-eval', emptyOutDir: true, lib: { entry: 'src/worker/guard/LavaDetector.ts', formats: ['es'], fileName: () => 'detector.mjs' } } });
const { LavaDetector, parseSummary } = await import(pathToFileURL(resolve('.cache/detection-eval/detector.mjs')).href);
const detector = new LavaDetector();
const hash = 'a'.repeat(43);
const lines = async file => (await readFile(file, 'utf8')).split('\n').filter(Boolean).map(l => JSON.parse(l));

function judge(features, webdriver) {
  const summary = parseSummary({ version: 'lava-features-v1', features, fingerprint: hash, geometryHash: hash, ...(webdriver === undefined ? {} : { signals: { webdriver } }) });
  if (!summary) return { rejected: true, flagged: true, reasons: ['schema_rejected'] };
  // Generous server elapsed time: the clock rule is measured separately in tests.
  const d = detector.evaluate(summary, features.durationMs + features.reactionMs + 60000, false);
  return { rejected: false, flagged: d.enforcementRisk >= 0.5, reasons: d.reasons };
}
function tally(name, rows) {
  const out = { rows: rows.length, flagged: 0, rejected: 0, reasons: {} };
  for (const r of rows) {
    const j = judge(r.features, r.webdriver);
    if (j.flagged) out.flagged++;
    if (j.rejected) out.rejected++;
    for (const reason of j.reasons) out.reasons[reason] = (out.reasons[reason] ?? 0) + 1;
  }
  out.flagRate = rows.length ? +(out.flagged / rows.length).toFixed(4) : null;
  console.log(name.padEnd(34), JSON.stringify(out));
  return out;
}

const records = [...await lines('ml/private/phase5/records.jsonl'), ...await lines('ml/private/phase6/records.jsonl')];
const appBots = records.map(r => ({ features: r.features, webdriver: r.environment?.evidence?.signals?.webdriver ?? undefined, cleared: r.outcome?.verdict === 'CLEAR' }));
const research = await lines('ml/private/features.jsonl');
const human = research.filter(r => r.label === 'human').map(r => ({ features: r.features }));
const researchBots = research.filter(r => r.label === 'bot').map(r => ({ features: r.features }));

console.log(`detector ${LavaDetector.version}; flagged = enforcementRisk >= 0.5 or schema rejection`);
tally('app attacks (all)', appBots);
tally('app attacks that previously CLEARED', appBots.filter(r => r.cleared));
tally('app attacks, webdriver hint removed', appBots.map(r => ({ features: r.features })));
tally('public research bots', researchBots);
tally('public research humans', human);

// Generator family names are harness labels, not private data.
const missed = {};
for (const r of records) {
  if (r.outcome?.verdict !== 'CLEAR') continue;
  const j = judge(r.features, r.environment?.evidence?.signals?.webdriver ?? undefined);
  const key = `${r.generator?.family ?? 'unknown'}${r.environment?.evidence?.signals?.webdriver === true ? '' : ' (webdriver hidden/absent)'}`;
  missed[key] ??= { cleared: 0, nowFlagged: 0 };
  missed[key].cleared++; if (j.flagged) missed[key].nowFlagged++;
}
console.log('previously-CLEAR attacks by family:', JSON.stringify(missed, null, 1));
