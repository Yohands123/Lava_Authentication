import { chromium } from '@playwright/test';
import { build } from 'vite';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { generate, families } from './attacks.mjs';

const origin = process.env.LAVAGUARD_LOCAL_ORIGIN ?? 'http://localhost:8787';
const target = new URL(origin);
if (target.hostname !== 'localhost' || target.protocol !== 'http:') throw new Error('Adversarial harness is restricted to the project-owned localhost server');
await mkdir('ml/artifacts', { recursive: true });
await build({ configFile: false, logLevel: 'error', build: { outDir: '.cache/guard', emptyOutDir: false, lib: { entry: 'scripts/guard-runtime.ts', formats: ['es'], fileName: () => 'runtime.mjs' } } });
const { extractFeatures, LavaDetector, LavaPolicy } = await import(pathToFileURL(resolve('.cache/guard/runtime.mjs')).href);
const browser = await chromium.launch();
const configuration = await (await fetch(origin + '/api/lavaguard/config')).json();
const report = { version: 'lava-attacks-v2', seed: 42, origin, configuration, classificationIsExperimental: true, realHumanSamples: 0, cases: [] };
const hash = data => createHash('sha256').update(JSON.stringify(data)).digest('base64url');
async function api(context, path, data) {
  const response = await context.request.post(origin + path, { data, headers: { Origin: origin } });
  return { status: response.status(), data: await response.json() };
}
async function attempt(family, points, driver = 'playwright') {
  const context = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  const page = await context.newPage();
  let evaluation = null;
  page.on('response', response => {
    if (response.url().endsWith('/api/lavaguard/evaluate')) evaluation = response.json().then(data => ({ status: response.status(), data, captured: response.request().postDataJSON().summary }));
  });
  await page.goto(origin); await page.getByRole('button', { name: 'Enter', exact: true }).click();
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('[data-screen=stir]').dataset.guardState === 'STIRRING');
  const box = await page.locator('[data-ring-arc]').boundingBox();
  const started = performance.now();
  // Same normalized family is also evaluated offline. Browser replay is capped to
  // avoid stressing the local GPU; this is not a timeout-based human assessment.
  for (const point of points) {
    if (await page.locator('[data-screen=stir]').getAttribute('data-guard-state') !== 'STIRRING') break;
    const x = box.x + point.x * box.width, y = box.y + point.y * box.height;
    if (driver === 'dom') await page.evaluate(({ x, y }) => window.dispatchEvent(new PointerEvent('pointermove', { clientX: x, clientY: y, pointerType: 'mouse' })), { x, y });
    else await page.mouse.move(x, y);
  }
  await page.waitForTimeout(250);
  if (await page.locator('[data-screen=stir]').getAttribute('data-guard-state') === 'RING_CLEARED_PENDING_DECISION') await page.waitForFunction(() => ['CLEAR', 'FLAG', 'BLOCK'].includes(document.querySelector('[data-screen=stir]').dataset.guardState));
  const state = await page.locator('[data-screen=stir]').getAttribute('data-guard-state');
  const signals = { webdriver: await page.evaluate(() => navigator.webdriver) };
  const observedPoints = driver === 'dom' ? points.map(p => ({ ...p, trusted: false })) : points;
  const f = extractFeatures(observedPoints), summary = { version: 'lava-features-v1', features: f, fingerprint: hash(points), geometryHash: hash(points.map(({ x, y }) => [x, y])), signals };
  const evidence = new LavaDetector().evaluate(summary, Math.max(f.durationMs + f.reactionMs, performance.now() - started), false, { experimentalModel: configuration.experimentalModel });
  // Observe the browser's real challenge/evaluation. Do not substitute a second
  // challenge with incompatible timestamps and count its refusal as detection.
  const decision = evaluation ? await evaluation : null;
  const capturedFeatures = decision?.captured ? { features: decision.captured.features, robust: decision.captured.robust } : null;
  const protectedOptions = await api(context, '/api/login/options', { digests: {}, ...(decision?.data.clearance ? { clearance: decision.data.clearance } : {}) });
  const sessionResponse = await context.request.get(origin + '/api/session');
  report.cases.push({ family, driver, seed: 42, browserState: state, clearsRing: ['CLEAR', 'FLAG', 'BLOCK'].includes(state), actualServerStatus: decision?.status ?? null, actualServerVerdict: decision?.data.verdict ?? null, clearanceIssued: Boolean(decision?.data.clearance), protectedOptionsStatus: protectedOptions.status, capturedFeatures, experimentalModel: decision?.data.lab?.experimental ?? null, actualEvidence: decision?.data.lab?.reasons ?? [], offlineShadowVerdict: new LavaPolicy().decide('shadow', evidence, false), offlineEnforceVerdict: new LavaPolicy().decide('enforce', evidence, false), offlineEvidence: evidence.reasons, sessionStatus: sessionResponse.status(), bypassesAuthentication: sessionResponse.status() === 200, durationMs: performance.now() - started });
  await context.close();
}
try {
  for (const family of families) await attempt(family, generate(family, 42));
  await attempt('dom-synthetic', generate('corrections', 42), 'dom');
  const { path } = await import('ghost-cursor');
  let seeded = 42;
  const saved = Math.random;
  // Scope deterministic randomness to the generator only, never security APIs.
  Math.random = () => { seeded = (Math.imul(seeded, 1664525) + 1013904223) >>> 0; return seeded / 4294967296; };
  const ghost = [];
  for (let i = 0; i < 8; i++) ghost.push(...path({ x: .2 + i % 2 * .6, y: .25 }, { x: .8 - i % 2 * .6, y: .75 }, { spreadOverride: .2 }).map((p, j) => ({ x: p.x, y: p.y, t: ghost.length * 32 + j * 32 + 250 })));
  Math.random = saved;
  await attempt('ghost-cursor', ghost.slice(0, 600));
  const puppeteer = await import('puppeteer-core');
  const puppet = await puppeteer.launch({ executablePath: chromium.executablePath(), headless: true });
  const p = await puppet.newPage();
  let puppetEvaluation = null;
  p.on('response', response => { if (response.url().endsWith('/api/lavaguard/evaluate')) puppetEvaluation = response.json(); });
  await p.goto(origin);
  await p.evaluate(() => { document.querySelector('[data-action=enter]').click(); document.querySelector('[data-action=signin]').click(); });
  await p.waitForFunction(() => document.querySelector('[data-screen=stir]').dataset.guardState === 'STIRRING');
  const b = await p.$eval('[data-ring-arc]', e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });
  for (const point of generate('corrections', 42)) await p.mouse.move(b.x + point.x * b.width, b.y + point.y * b.height);
  if (await p.$eval('[data-screen=stir]', e => e.dataset.guardState) === 'RING_CLEARED_PENDING_DECISION') await p.waitForFunction(() => ['CLEAR', 'FLAG', 'BLOCK'].includes(document.querySelector('[data-screen=stir]').dataset.guardState));
  const puppetDecision = puppetEvaluation ? await puppetEvaluation : null;
  const puppetOptions = await p.evaluate(async clearance => {
    const response = await fetch('/api/login/options', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ digests: {}, ...(clearance ? { clearance } : {}) }) });
    return response.status;
  }, puppetDecision?.clearance);
  const puppetSession = await p.evaluate(async () => (await fetch('/api/session')).status);
  const puppetState = await p.$eval('[data-screen=stir]', e => e.dataset.guardState);
  report.cases.push({ family: 'puppeteer-corrections', driver: 'puppeteer-core', seed: 42, browserState: puppetState, clearsRing: ['CLEAR', 'FLAG', 'BLOCK'].includes(puppetState), actualServerVerdict: puppetDecision?.verdict ?? null, experimentalModel: puppetDecision?.lab?.experimental ?? null, clearanceIssued: Boolean(puppetDecision?.clearance), protectedOptionsStatus: puppetOptions, sessionStatus: puppetSession, bypassesAuthentication: puppetSession === 200 });
  await puppet.close();
  const context = await browser.newContext();
  const direct = await api(context, '/api/login/options', { digests: {} });
  const forged = await api(context, '/api/login/options', { digests: {}, verdict: 'CLEAR', score: 0 });
  const directSession = await context.request.get(origin + '/api/session');
  report.cases.push({ family: 'direct-api', status: direct.status, protectedEndpointBypass: direct.status === 200, sessionStatus: directSession.status() }, { family: 'forged-verdict', status: forged.status, protectedEndpointBypass: forged.status === 200, sessionStatus: directSession.status() });
  await context.close();
} finally {
  await browser.close();
  await writeFile('ml/artifacts/adversarial-phase4.json', JSON.stringify(report, null, 2) + '\n');
}
console.log(JSON.stringify({ cases: report.cases.length, report: 'ml/artifacts/adversarial-phase4.json' }));
