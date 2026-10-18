import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { automatedStir } from './automated-stir.mjs';

// Visible adversarial demonstration: real server verdict, no forced outcome.
const origin = 'http://localhost:8787';
const health = await fetch(`${origin}/api/lavaguard/config`);
if (!health.ok) throw new Error('Start the local Worker with npm run dev first.');
const config = await health.json();
const browser = await chromium.launch({ headless: false });
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const result = await automatedStir(page, origin);
  await mkdir('ml/artifacts', { recursive: true });
  const { clearance, ...decision } = result.decision;
  const verification = { mode: config.mode, actualServerStatus: result.status, decision, clearanceIssued: Boolean(clearance), automationReported: result.summary?.signals?.webdriver, screenshot: 'docs/media/lavaguard/preview-automation.png' };
  await writeFile('ml/artifacts/preview-verification.json', JSON.stringify(verification, null, 2) + '\n');
  if (config.experimentalModel && (result.decision.verdict === 'CLEAR' || clearance)) throw new Error('Research enforcement regression: automated stir received clearance.');
  await page.waitForTimeout(900);
  await mkdir('docs/media/lavaguard', { recursive: true });
  await page.screenshot({ path: 'docs/media/lavaguard/preview-automation.png' });
  await page.bringToFront();
  console.log(JSON.stringify({ mode: config.mode, verdict: decision.verdict, clearanceIssued: Boolean(clearance), evidence: decision.lab?.reasons }));
  console.log('Automation test browser: webdriver remains true during manual use. Use your regular browser at ' + origin + ' for participant trials. CLEAR permits passkey options; it does not verify humanity.');
  await new Promise(resolve => browser.once('disconnected', resolve));
} catch (error) {
  await browser.close();
  throw error;
}
