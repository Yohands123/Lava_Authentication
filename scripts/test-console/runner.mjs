import { chromium } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { generator, captureSettings } from '../phase5-generators.mjs';
import { automatedStir } from '../automated-stir.mjs';
import { PROFILES } from './settings.mjs';

const terminal = state => ['CLEAR', 'FLAG', 'BLOCK'].includes(state);
function cancelled(signal) { if (signal.aborted) throw new Error('Stopped by operator.'); }
export class BrowserRunner {
  constructor({ headless = false, screenshotFolder = '.cache/test-console/screenshots', budgetMs = 12000 } = {}) {
    this.headless = headless; this.screenshotFolder = resolve(screenshotFolder); this.budgetMs = budgetMs;
    this.browser = null; this.lastContext = null; this.puppet = null;
  }
  async close() { await this.lastContext?.close().catch(() => {}); await this.browser?.close().catch(() => {}); await this.puppet?.close().catch(() => {}); this.lastContext = null; this.browser = null; this.puppet = null; }
  async attempt({ id, profile, pattern, seed, signal, progress }) {
    if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error('A generated attempt identifier is required.');
    cancelled(signal); const began = performance.now(), settings = captureSettings(pattern, seed), target = PROFILES[profile];
    const configResponse = await fetch(target.origin + '/api/lavaguard/config', { signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]) });
    const config = await configResponse.json();
    if (!configResponse.ok || config.experimentalModel !== target.experimental || config.modelMode !== target.modelMode || !config.lab) throw new Error('Target configuration changed. Restart the test console.');
    await this.lastContext?.close().catch(() => {}); this.lastContext = null;
    await this.puppet?.close().catch(() => {}); this.puppet = null;
    let browser = this.browser;
    if (pattern === 'puppeteer') {
      const { default: puppeteer } = await import('puppeteer-core');
      this.puppet = await puppeteer.launch({ executablePath: chromium.executablePath(), headless: this.headless, args: ['--window-size=1280,1000'] });
      browser = await chromium.connectOverCDP(this.puppet.wsEndpoint());
    } else if (!browser?.isConnected()) this.browser = browser = await chromium.launch({ headless: this.headless, args: ['--window-size=1280,1000'] });
    const context = pattern === 'puppeteer' ? browser.contexts()[0] : await browser.newContext({ viewport: { width: 1200, height: 900 } });
    this.lastContext = context;
    const page = await context.newPage(); page.setDefaultTimeout(12000);
    await page.setViewportSize({ width: 1200, height: 900 });
    // A local presentation marker only: actual events, physics and verdicts stay unchanged.
    await page.addInitScript(({ pattern, label }) => {
      document.addEventListener('DOMContentLoaded', () => {
        const note = document.createElement('div'); note.textContent = `AUTOMATION: ${pattern} | ${label}`;
        note.style.cssText = 'position:fixed;top:12px;left:16px;color:#ffb6d7;font:12px monospace;z-index:2147483647;pointer-events:none';
        const dot = document.createElement('div'); dot.style.cssText = 'display:none;position:fixed;width:18px;height:18px;border:2px solid #ffb6d7;border-radius:50%;z-index:2147483647;pointer-events:none;transform:translate(-50%,-50%)';
        document.body.append(note, dot);
        window.addEventListener('pointermove', event => { dot.style.display = 'block'; dot.style.left = event.clientX+'px'; dot.style.top = event.clientY+'px'; });
      });
    }, { pattern, label: target.label });
    let evaluated = null;
    page.on('response', response => {
      if (response.url() === target.origin + '/api/lavaguard/evaluate') evaluated = response.json().then(data => ({ data, status: response.status(), retryAfter: response.headers()['retry-after'] }), () => ({ error: true, status: response.status() }));
    });
    const onStop = () => { context.close().catch(() => {}); };
    signal.addEventListener('abort', onStop, { once: true });
    try {
      progress('Preparing declared automation');
      await page.goto(target.origin); await page.bringToFront(); cancelled(signal);
      await page.locator('[data-action=lab]').click(); await page.locator('[data-research-consent]').check();
      await page.locator('[data-study-device]').selectOption('mouse'); await page.locator('[data-study-label]').selectOption('automation-declared');
      await page.locator('[data-study-acquisition]').selectOption(pattern === 'puppeteer' ? 'puppeteer' : 'playwright');
      if (await page.locator('[data-study-environment]').count()) {
        await page.locator('[data-study-environment]').selectOption(pattern === 'puppeteer' ? 'puppeteer' : pattern === 'ghost-cursor' ? 'ghost-cursor' : this.headless ? 'headless-playwright' : 'headed-playwright');
        await page.locator('[data-study-control]').selectOption('scripted'); await page.locator('[data-study-display]').selectOption(this.headless ? 'headless' : 'headed');
      }
      await page.locator('[data-study-cadence]').selectOption(String(settings.cadence));
      await page.getByText('Declared automation provenance', { exact: true }).click();
      const provenance = { family: settings.family, revision: 'phase5-generators-v1', seed: String(seed), run: randomUUID(), trajectory: settings.lineage };
      for (const [key, value] of Object.entries(provenance)) await page.locator(`[data-generator-${key}]`).fill(value);
      await page.locator('[data-action=lab]').click();
      await page.getByRole('button', { name: 'Enter', exact: true }).click(); await page.getByRole('button', { name: 'Sign in', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('[data-screen=stir]')?.dataset.guardState === 'STIRRING');
      const box = await page.locator('[data-ring-arc]').boundingBox();
      if (!box) throw new Error('The real ring is unavailable.');
      const next = await generator(pattern, seed), start = performance.now(); let count = 0;
      const puppetPage = this.puppet ? (await this.puppet.pages()).find(p => p.url() === target.origin + '/') : null;
      if (this.puppet && !puppetPage) throw new Error('Puppeteer page unavailable.');
      progress('Moving the visible automated cursor');
      let state;
      if (pattern === 'original-demo') {
        await automatedStir(page, target.origin, seed, { resume: true }); count = null;
        state = await page.locator('[data-screen=stir]').getAttribute('data-guard-state');
      }
      while (pattern !== 'original-demo' && (state = await page.locator('[data-screen=stir]').getAttribute('data-guard-state')) === 'STIRRING' && performance.now() - start < this.budgetMs) {
        cancelled(signal);
        const latest = pattern === 'reactive' ? await page.locator('.guard-lab').getAttribute('data-study-target') : null;
        const point = next(count++, latest ? JSON.parse(latest) : null), x = box.x + point.x*box.width, y = box.y + point.y*box.height;
        if (pattern === 'dom-synthetic') await page.evaluate(({ x, y }) => window.dispatchEvent(new PointerEvent('pointermove', { clientX: x, clientY: y, pointerType: 'mouse' })), { x, y });
        else if (puppetPage) await puppetPage.mouse.move(x, y);
        else await page.mouse.move(x, y);
        await page.waitForTimeout(point.wait);
      }
      if (state === 'RING_CLEARED_PENDING_DECISION') {
        await page.waitForFunction(() => ['CLEAR', 'FLAG', 'BLOCK', 'ERROR'].includes(document.querySelector('[data-screen=stir]')?.dataset.guardState));
        state = await page.locator('[data-screen=stir]').getAttribute('data-guard-state');
      }
      progress('Measuring real server outcomes');
      // Let a completion racing the budget finish. An unfinished ring is kept
      // visible and receives no detector credit; next run closes this context.
      await page.waitForTimeout(350); state = await page.locator('[data-screen=stir]').getAttribute('data-guard-state');
      if (state === 'RING_CLEARED_PENDING_DECISION') {
        await page.waitForFunction(() => ['CLEAR', 'FLAG', 'BLOCK', 'ERROR'].includes(document.querySelector('[data-screen=stir]')?.dataset.guardState));
        state = await page.locator('[data-screen=stir]').getAttribute('data-guard-state');
      }
      const response = evaluated ? await evaluated : null;
      if (response?.error) throw new Error('Evaluation response disconnected; classification unknown.');
      const decision = response?.data;
      const options = await context.request.post(target.origin + '/api/login/options', { headers: { Origin: target.origin }, data: { digests: {}, ...(decision?.clearance ? { clearance: decision.clearance } : {}) }, timeout: 8000 });
      const sessionStatus = (await context.request.get(target.origin + '/api/session', { timeout: 8000 })).status();
      cancelled(signal); await mkdir(this.screenshotFolder, { recursive: true });
      await page.screenshot({ path: resolve(this.screenshotFolder, id + '.png') });
      await page.bringToFront();
      return { taskComplete: terminal(state), state, verdict: decision?.verdict ?? null, evaluationStatus: response?.status ?? null,
        clearanceIssued: Boolean(decision?.clearance), optionsStatus: options.status(), sessionStatus,
        modelMode: config.modelMode, modelVersion: config.modelVersion, riskScore: decision?.lab?.estimator?.riskScore ?? null,
        reasons: decision?.lab?.reasons ?? [], moveCount: count, screenshot: true, durationMs: performance.now() - began,
        automationEnvironment: decision?.lab?.automationEnvironment?.source === 'versioned-local-research' ? decision.lab.automationEnvironment.evidence : null,
        declaredEnvironment: pattern === 'puppeteer' ? 'puppeteer' : pattern === 'ghost-cursor' ? 'ghost-cursor' : this.headless ? 'headless-playwright' : 'headed-playwright',
        declaredControl: 'scripted', displayMode: this.headless ? 'headless' : 'headed',
        retryAfter: Number(response?.retryAfter ?? options.headers()['retry-after'] ?? decision?.retryAfter ?? 0) };
    } finally { signal.removeEventListener('abort', onStop); }
  }
}
