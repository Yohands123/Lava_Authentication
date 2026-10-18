import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { automatedStir } from './automated-stir.mjs';

const origin = 'http://localhost:8785';
const configuration = await (await fetch(origin + '/api/lavaguard/config')).json();
if (configuration.mode !== 'enforce' || !configuration.experimentalModel) throw new Error('Start the isolated research preview on port 8785 first.');
await mkdir('docs/media/lavaguard', { recursive: true });
const browser = await chromium.launch({ headless: false });
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const challengeIds = [];
  page.on('request', request => { if (request.url().endsWith('/api/lavaguard/evaluate')) challengeIds.push(request.postDataJSON().id); });
  const first = await automatedStir(page, origin, 42);
  await page.waitForTimeout(900);
  await page.screenshot({ path: 'docs/media/lavaguard/retry-first.png' });
  const attempts = [first];
  let clickedTryAgain = false;
  if (first.decision.verdict === 'FLAG') {
    await page.getByRole('button', { name: /^Try again/ }).click();
    clickedTryAgain = true;
    attempts.push(await automatedStir(page, origin, 42, { resume: true }));
    await page.waitForTimeout(900);
    await page.screenshot({ path: 'docs/media/lavaguard/retry-second.png' });
  }
  const report = { origin, configuration, actualServerDecisions: true, clickedTryAgain,
    freshChallengeOnRetry: challengeIds.length === 2 && challengeIds[0] !== challengeIds[1],
    attempts: [] };
  for (const result of attempts) {
    const options = await context.request.post(origin + '/api/login/options', { data: { digests: {}, ...(result.decision.clearance ? { clearance: result.decision.clearance } : {}) }, headers: { Origin: origin } });
    report.attempts.push({ status: result.status, verdict: result.decision.verdict, clearanceIssued: Boolean(result.decision.clearance),
      reasons: result.decision.lab?.reasons, experimental: result.decision.lab?.experimental,
      optionsStatus: options.status(), sessionStatus: (await context.request.get(origin + '/api/session')).status() });
  }
  await writeFile('ml/artifacts/preview-retry-phase2.json', JSON.stringify(report, null, 2) + '\n');
  await page.bringToFront();
  console.log(JSON.stringify(report));
  console.log('Visible research retry completed. This is an automation test browser; normal participant preview remains on localhost:8787. Close the window to end this script.');
  await new Promise(resolve => browser.once('disconnected', resolve));
} catch (error) { await browser.close(); throw error; }
