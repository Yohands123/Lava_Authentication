// Controlled, loopback-only observability experiment. Not a classifier benchmark.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { chromium } from '@playwright/test';
import puppeteer from 'puppeteer-core';
import { path as ghostPath } from 'ghost-cursor';
import { build } from 'vite';

const folder = resolve('.cache/automation-environment');
await mkdir(folder, { recursive: true });
await build({ configFile: false, logLevel: 'error', build: { outDir: folder, emptyOutDir: false,
  lib: { entry: 'scripts/environment-runtime.ts', formats: ['es'], fileName: () => 'runtime.mjs' } } });
const runtime = await import(pathToFileURL(folder + '/runtime.mjs').href);
const bundle = await readFile(folder + '/runtime.mjs');
const pending = new Map();
let origin;
const server = createServer(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.headers.host !== new URL(origin).host) { res.writeHead(403).end(); return; }
  const url = new URL(req.url, origin), token = url.searchParams.get('token');
  if (req.method === 'GET' && url.pathname === '/runtime.mjs') { res.setHeader('Content-Type', 'text/javascript'); res.end(bundle); return; }
  if (req.method === 'GET' && url.pathname === '/' && pending.has(token)) {
    res.setHeader('Content-Type', 'text/html');
    res.end(`<title>LavaGuard local environment experiment</title><p>Controlled browser experiment. Three advisory booleans only. No authentication or human classification.</p><p id="status">Measuring…</p>
      <script type="module">import {collectAutomationEnvironment} from '/runtime.mjs';
      window.snapshot=()=>collectAutomationEnvironment(navigator);
      window.submit=async()=>{const evidence=window.snapshot();await fetch('/result?token=${token}',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(evidence)});document.querySelector('#status').textContent=JSON.stringify(evidence);};
      if(new URL(location).searchParams.get('auto')!=='0') await window.submit();</script>`);
    return;
  }
  if (req.method !== 'POST' || url.pathname !== '/result' || req.headers.origin !== origin || !pending.has(token)) { res.writeHead(403).end(); return; }
  let body = '', bytes = 0;
  try {
    for await (const chunk of req) { bytes += chunk.length; if (bytes > 2048) { res.writeHead(413).end(); return; } body += chunk; }
    const evidence = runtime.parseAutomationEnvironment(JSON.parse(body));
    if (!evidence) { res.writeHead(400).end(); return; }
    pending.get(token)(evidence); res.writeHead(204).end();
  } catch { res.writeHead(400).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
origin = `http://127.0.0.1:${server.address().port}`;
const reserve = () => {
  const token = randomUUID(); let timer;
  const result = new Promise(resolve => {
    const finish = evidence => { clearTimeout(timer); pending.delete(token); resolve(evidence); };
    pending.set(token, finish); timer = setTimeout(() => finish(null), 30000);
  });
  return { url: origin + '/?token=' + token, result, cancel: () => pending.get(token)?.(null) };
};
const report = { schema: 'lava-automation-environment-coverage-v1', evidenceVersion: 'lava-automation-environment-v1',
  generatedAt: new Date().toISOString(), localOnly: true, browserVersion: null, cases: [],
  humanParticipants: 0, humanPopulationExposureRate: null, humanFalsePositiveRate: null,
  humanControlledAutomation: { status: 'NOT_RUN_NO_CONSENTING_HUMAN_OPERATOR', supportedDeclaration: true },
  identityDetectionClaim: false, vmOrRemoteDesktopDetection: false, productionEnforcementEnabled: false };
function record(name, declaration, evidence, extra = {}) {
  assert.ok(runtime.parseAutomationEnvironment(evidence), 'Real browser must return the versioned allowlisted schema');
  const comparisons = runtime.fixedBehaviorComparison(evidence);
  assert.ok(comparisons.every(v => v.riskDelta === 0 && v.enforcementRiskDelta === 0 && v.behavioralModelUnchanged && v.decisionUnchanged));
  const row = { name, ...declaration, evidence, fixedGeneratedBehaviorControl: comparisons, ...extra };
  report.cases.push(row); console.log(JSON.stringify({ case: name, signals: evidence.signals }));
}
// A separate, disposable profile prevents attachment to the user's own Chrome.
async function ordinaryChrome() {
  const executable = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  try { await access(executable); } catch { report.cases.push({ name: 'ordinary-chrome', status: 'NOT_RUN_CHROME_UNAVAILABLE' }); return; }
  const probe = reserve(), profile = resolve(folder, 'ordinary-profile-' + randomUUID());
  const child = spawn(executable, ['--user-data-dir=' + profile, '--no-first-run', '--no-default-browser-check', '--new-window', probe.url], { stdio: 'ignore' });
  child.on('error', probe.cancel);
  try {
    const evidence = await probe.result;
    assert.ok(evidence, 'Ordinary Chrome did not report within 30 seconds');
    record('ordinary-chrome', { declaredEnvironment: 'ordinary-chrome', declaredControl: 'unknown', displayMode: 'headed' }, evidence,
      { webdriverOrCdpUsed: false, automationLaunchFlagsUsed: false, scriptedLaunchOnly: true, genuineHumanTrial: false, browserVersion: null });
  } finally {
    probe.cancel();
    // Only the process we just spawned and its children, never personal Chrome.
    if (child.pid && child.exitCode === null) await new Promise(resolve => {
      const kill = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
      kill.on('exit', resolve); kill.on('error', resolve);
    });
  }
}
async function controlled(name, { headless, driver = 'playwright', ghost = false, mask = null, userAgent = undefined }) {
  const probe = reserve(); let browser;
  try {
    browser = driver === 'puppeteer' ? await puppeteer.launch({ executablePath: chromium.executablePath(), headless }) : await chromium.launch({ headless });
    report.browserVersion = driver === 'puppeteer' ? await browser.version() : browser.version();
    const page = driver === 'puppeteer' ? await browser.newPage() : await browser.newPage({ userAgent });
    if (mask) await page.addInitScript(mode => {
      Object.defineProperty(Navigator.prototype, 'webdriver', { configurable: true, get: () => mode === 'unavailable' ? undefined : false });
      if (mode !== 'webdriver-only') {
        Object.defineProperty(Navigator.prototype, 'userAgent', { configurable: true, get: () => mode === 'unavailable' ? undefined : 'Chrome/controlled-test' });
        Object.defineProperty(Navigator.prototype, 'userAgentData', { configurable: true, get: () => mode === 'unavailable' ? undefined : { brands: [{ brand: 'Chromium', version: '0' }] } });
      }
    }, mask);
    await page.goto(probe.url + '&auto=0'); await page.waitForFunction(() => typeof window.snapshot === 'function');
    const before = await page.evaluate(() => window.snapshot());
    const points = ghost ? ghostPath({ x: 40, y: 50 }, { x: 600, y: 350 }, { moveSpeed: 60 }) : [{ x: 40, y: 50 }, { x: 600, y: 350 }];
    for (const p of points) await page.mouse.move(p.x, p.y);
    await page.evaluate(() => window.submit()); const evidence = await probe.result;
    assert.deepEqual(evidence, before, 'Pointer driver must not be mistaken for a distinct observable environment');
    if (mask === 'all-false') assert.deepEqual(Object.values(evidence.signals), [false, false, false]);
    if (mask === 'unavailable') assert.deepEqual(Object.values(evidence.signals), [null, null, null]);
    record(name, { declaredEnvironment: ghost ? 'ghost-cursor' : driver === 'puppeteer' ? 'puppeteer' : headless ? 'headless-playwright' : 'headed-playwright', declaredControl: 'scripted', displayMode: headless ? 'headless' : 'headed' }, evidence,
      { browserVersion: report.browserVersion, webdriverOrCdpUsed: true, condition: mask ?? (userAgent ? 'ua-token-overridden-at-launch' : 'default'), pointerMoves: points.length, unchangedAfterPointerMovement: true });
  } finally { probe.cancel(); await browser?.close(); }
}
try {
  await ordinaryChrome();
  await controlled('headed-playwright', { headless: false });
  await controlled('headless-playwright', { headless: true });
  await controlled('headed-puppeteer', { headless: false, driver: 'puppeteer' });
  await controlled('headless-puppeteer', { headless: true, driver: 'puppeteer' });
  await controlled('ghost-cursor-headed-playwright', { headless: false, ghost: true });
  await controlled('headless-webdriver-hidden', { headless: true, mask: 'webdriver-only' });
  await controlled('headless-ua-token-overridden', { headless: true, userAgent: 'Chrome/controlled-test' });
  await controlled('headless-all-hints-forged-false', { headless: true, mask: 'all-false' });
  await controlled('headless-all-hints-unavailable', { headless: true, mask: 'unavailable' });
} catch (error) { report.error = error.message; process.exitCode = 1; }
finally {
  report.summary = { measured: report.cases.filter(c => c.evidence).length, skipped: report.cases.filter(c => !c.evidence).length,
    positive: report.cases.filter(c => c.evidence && Object.values(c.evidence.signals).includes(true)).length,
    meaning: 'Selected controlled configurations, not population prevalence or classifier accuracy. No genuine human or VM/RDP study.' };
  await mkdir('ml/artifacts', { recursive: true });
  await writeFile('ml/artifacts/automation-environment-coverage.json', JSON.stringify(report, null, 2) + '\n');
  server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  console.log(JSON.stringify(report.summary));
}
