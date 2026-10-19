import { chromium } from '@playwright/test';
import { randomUUID, createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { captureCases, captureSettings, generator } from './phase5-generators.mjs';

const origin = process.env.LAVAGUARD_LOCAL_ORIGIN ?? 'http://localhost:8791';
const target = new URL(origin);
if (target.hostname !== 'localhost' || target.protocol !== 'http:') throw new Error('Only project-owned localhost research is authorized.');
const configuration = await (await fetch(origin + '/api/lavaguard/config')).json();
if (!configuration.lab || configuration.experimentalModel || configuration.modelMode !== 'shadow') throw new Error('Run the disclosed local Lab with advisory ML and optional verification off.');
const seeds = (process.env.LAVAGUARD_CAPTURE_SEEDS ?? '1001,1002').split(',').map(Number);
if (seeds.length > 4 || seeds.some(s => !Number.isInteger(s) || s < 1 || s > 1e6)) throw new Error('Use one to four bounded, declared seeds.');
const cases = process.env.LAVAGUARD_CAPTURE_CASES ? process.env.LAVAGUARD_CAPTURE_CASES.split(',') : captureCases;
if (cases.some(c => !captureCases.includes(c))) throw new Error('Unknown declared generator case.');
await mkdir('ml/private/phase5/captures', { recursive: true }); await mkdir('ml/artifacts', { recursive: true });
const report = { schema: 'lava-browser-capture-v3', realLocalBrowser: true, generatedAutomationOnly: true, humanParticipants: 0,
  origin, configuration, cases: [], noAuthenticationBypassClaim: true };
const checkpoint = () => writeFile('ml/artifacts/phase5-capture.json', JSON.stringify(report, null, 2) + '\n');
let failures = 0;
for (const seed of seeds) for (const name of cases) {
  let browser, puppet;
  const began = performance.now();
  try {
    if (name === 'puppeteer') {
      const puppeteer = await import('puppeteer-core');
      puppet = await puppeteer.default.launch({ executablePath: chromium.executablePath(), headless: true });
      browser = await chromium.connectOverCDP(puppet.wsEndpoint());
    } else browser = await chromium.launch();
    const context = name === 'puppeteer' ? browser.contexts()[0] : await browser.newContext({ viewport: { width: 1200, height: 900 } });
    const page = await context.newPage(); await page.setViewportSize({ width: 1200, height: 900 });
    let decision = null;
    // Attach rejection handling immediately; a disconnected response must be
    // reported as a failed capture rather than terminating the whole run.
    page.on('response', response => { if (response.url().endsWith('/api/lavaguard/evaluate')) decision = response.json().then(data => ({ data }), error => ({ error: error.message })); });
    await page.goto(origin); await page.locator('[data-action=lab]').click();
    await page.locator('[data-research-consent]').check();
    await page.locator('[data-study-label]').selectOption('automation-declared');
    await page.locator('[data-study-device]').selectOption('mouse');
    await page.locator('[data-study-acquisition]').selectOption(name === 'puppeteer' ? 'puppeteer' : 'playwright');
    if (await page.locator('[data-study-environment]').count()) {
      await page.locator('[data-study-environment]').selectOption(name === 'puppeteer' ? 'puppeteer' : name === 'ghost-cursor' ? 'ghost-cursor' : 'headless-playwright');
      await page.locator('[data-study-control]').selectOption('scripted'); await page.locator('[data-study-display]').selectOption('headless');
    }
    const settings = captureSettings(name, seed);
    await page.locator('[data-study-cadence]').selectOption(String(settings.cadence));
    await page.getByText('Declared automation provenance', { exact: true }).click();
    const provenance = { family: settings.family, revision: 'phase5-generators-v1', seed: String(seed), run: randomUUID(), trajectory: settings.lineage };
    for (const [key, value] of Object.entries(provenance)) await page.locator(`[data-generator-${key}]`).fill(value);
    await page.locator('[data-action=lab]').click();
    await page.getByRole('button', { name: 'Enter', exact: true }).click(); await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('[data-screen=stir]')?.dataset.guardState === 'STIRRING');
    const box = await page.locator('[data-ring-arc]').boundingBox();
    const next = await generator(name, seed), started = performance.now();
    let count = 0;
    const puppetPage = puppet ? (await puppet.pages()).find(p => p.url() === origin + '/') : null;
    if (puppet && !puppetPage) throw new Error('Actual Puppeteer page was not found.');
    while (await page.locator('[data-screen=stir]').getAttribute('data-guard-state') === 'STIRRING' && performance.now()-started < 6500) {
      const lastTarget = name === 'reactive' ? await page.locator('.guard-lab').getAttribute('data-study-target') : null;
      const point = next(count++, lastTarget ? JSON.parse(lastTarget) : null);
      const x = box.x + point.x*box.width, y = box.y + point.y*box.height;
      if (name === 'dom-synthetic') await page.evaluate(({ x, y }) => window.dispatchEvent(new PointerEvent('pointermove', { clientX: x, clientY: y, pointerType: 'mouse' })), { x, y });
      else if (puppetPage) await puppetPage.mouse.move(x, y);
      else await page.mouse.move(x, y);
      await page.waitForTimeout(point.wait);
    }
    let state = await page.locator('[data-screen=stir]').getAttribute('data-guard-state');
    if (state === 'RING_CLEARED_PENDING_DECISION') {
      await page.waitForFunction(() => ['CLEAR', 'FLAG', 'BLOCK'].includes(document.querySelector('[data-screen=stir]')?.dataset.guardState));
      state = await page.locator('[data-screen=stir]').getAttribute('data-guard-state');
    }
    if (!['CLEAR', 'FLAG', 'BLOCK'].includes(state)) {
      try { await page.getByRole('button', { name: 'Back', exact: true }).click({ timeout: 1500 }); }
      catch (error) {
        // Rendering/physics may complete between the state read and click.
        await page.waitForFunction(() => ['CLEAR', 'FLAG', 'BLOCK'].includes(document.querySelector('[data-screen=stir]')?.dataset.guardState), null, { timeout: 10000 }).catch(() => { throw error; });
      }
    }
    await page.locator('[data-action=lab]').click();
    if (await page.locator('[data-export-research]').isDisabled()) throw new Error('The actual consented attempt was not retained.');
    const downloaded = page.waitForEvent('download'); await page.locator('[data-export-research]').click();
    const raw = await readFile(await (await downloaded).path(), 'utf8'), exported = JSON.parse(raw);
    if (exported.label !== 'automation-declared' || exported.schema !== 'lava-consent-v3') throw new Error('Research export lost automation provenance.');
    const hash = createHash('sha256').update(raw).digest('hex');
    await writeFile(`ml/private/phase5/captures/${hash}.json`, raw);
    const completed = exported.outcome.status === 'completed' && exported.outcome.ringCompleted;
    const response = decision ? await decision : null;
    if (response?.error) throw new Error('Evaluation response unavailable: ' + response.error);
    const actual = response?.data ?? null;
    const options = await context.request.post(origin + '/api/login/options', { headers: { Origin: origin }, data: { digests: {}, ...(actual?.clearance ? { clearance: actual.clearance } : {}) } });
    const sessionStatus = (await context.request.get(origin + '/api/session')).status();
    report.cases.push({ case: name, family: settings.family, seed, acquisition: exported.capture.acquisition, requestedCadenceMs: settings.cadence,
      sampleCount: exported.samples.length, pointerCount: count, taskComplete: completed, captureOutcome: exported.outcome.status,
      serverVerdict: actual?.verdict ?? null, clearanceIssued: Boolean(actual?.clearance), optionsStatus: options.status(), sessionStatus,
      authenticatedSessionObserved: sessionStatus === 200, durationMs: performance.now()-began });
    if (sessionStatus !== 401) throw new Error('Unexpected authenticated session in credential-free automation.');
    console.log(JSON.stringify({ case: name, seed, complete: completed, samples: exported.samples.length, options: options.status(), session: sessionStatus }));
  } catch (error) {
    failures++; report.cases.push({ case: name, seed, error: error.message.split('\n')[0], taskComplete: false, classificationNotEstablished: true });
    console.error(`Capture failed (${name}, ${seed}): ${error.message}`);
  } finally {
    await browser?.close().catch(() => {}); await puppet?.close().catch(() => {}); await checkpoint();
  }
}
report.summary = { attempts: report.cases.length, taskCompleted: report.cases.filter(c => c.taskComplete).length,
  incomplete: report.cases.filter(c => !c.taskComplete && !c.error).length, errors: failures,
  optionsAllowed: report.cases.filter(c => c.optionsStatus === 200).length, authenticatedSessions: report.cases.filter(c => c.authenticatedSessionObserved).length,
  actualHumanStudyRows: 0, unfinishedRingIsNotDetection: true };
await checkpoint(); console.log(JSON.stringify(report.summary));
if (failures) process.exitCode = 1;
