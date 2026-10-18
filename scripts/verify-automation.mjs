import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { automatedStir } from './automated-stir.mjs';

const origin = process.env.LAVAGUARD_LOCAL_ORIGIN ?? 'http://localhost:8787';
if (new URL(origin).hostname !== 'localhost') throw new Error('Local testing only');
const config = await (await fetch(`${origin}/api/lavaguard/config`)).json();
assert.equal(config.mode, 'enforce');
const browser = await chromium.launch();
const cases = [];
try {
  for (const [seed, maskWebdriver] of [[42, false], [42, true], [812, true]]) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    if (maskWebdriver) await context.addInitScript(() => Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false, configurable: true }));
    const page = await context.newPage();
    const result = await automatedStir(page, origin, seed);
    const options = await context.request.post(`${origin}/api/login/options`, { data: { digests: {}, clearance: result.decision.clearance }, headers: { Origin: origin } });
    const session = await context.request.get(`${origin}/api/session`);
    const { clearance, ...decision } = result.decision;
    cases.push({ seed, maskWebdriver, reportedWebdriver: result.summary.signals?.webdriver, decision, clearanceIssued: Boolean(clearance), loginOptionsStatus: options.status(), sessionStatus: session.status() });
    assert.equal(decision.verdict, config.experimentalModel ? 'FLAG' : 'CLEAR');
    assert.equal(Boolean(clearance), !config.experimentalModel);
    assert.equal(options.status(), config.experimentalModel ? 403 : 200);
    assert.equal(session.status(), 401);
    if (maskWebdriver && config.experimentalModel) assert.ok(decision.lab.reasons.includes('experimental_model_anomaly'));
    if (seed === 42 && maskWebdriver && process.argv.includes('--record-fixture')) {
      await mkdir('tests/fixtures', { recursive: true });
      // Synthetic browser capture only; no human trace, nonce or clearance.
      await writeFile('tests/fixtures/automated-preview-summary.json', JSON.stringify(result.summary, null, 2) + '\n');
    }
    await context.close();
  }
} finally {
  await browser.close();
  await writeFile('ml/artifacts/automation-phase2.json', JSON.stringify({ configuration: config, cases }, null, 2) + '\n');
}
console.log(JSON.stringify({ cases: cases.length, verdicts: cases.map(c => c.decision.verdict), report: 'ml/artifacts/automation-phase2.json' }));
