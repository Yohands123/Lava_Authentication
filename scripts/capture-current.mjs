import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const origin = process.env.LAVAGUARD_LOCAL_ORIGIN ?? 'http://localhost:8787';
const target = new URL(origin);
if (target.hostname !== 'localhost' || target.protocol !== 'http:') throw new Error('Capture only the project-owned local Worker.');
const configuration = await (await fetch(origin + '/api/lavaguard/config')).json();
const captures = [];
const browser = await chromium.launch();
await mkdir('docs/media/lavaguard', { recursive: true });
try {
for (const [name, viewport] of [['desktop', { width: 1440, height: 1000 }], ['mobile', { width: 390, height: 844 }]]) {
  const page = await browser.newPage({ viewport });
  const failures = [];
  page.on('pageerror', error => failures.push(error.message));
  page.on('console', message => { if (message.type() === 'warning' || message.type() === 'error') failures.push(message.text()); });
  let evaluated = null;
  page.on('response', response => {
    if (response.url().endsWith('/api/lavaguard/evaluate')) evaluated = response.json().then(decision => ({ status: response.status(), verdict: decision.verdict, assessment: decision.assessment, clearanceIssued: Boolean(decision.clearance) }));
  });
  await page.goto(origin);
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `docs/media/lavaguard/after-landing-${name}.png` });
  await page.getByRole('button', { name: 'Enter', exact: true }).click();
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('[data-screen=stir]').dataset.guardState === 'STIRRING');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `docs/media/lavaguard/after-stir-${name}.png` });
  const box = await page.locator('[data-ring-arc]').boundingBox();
  let a = 0, seed = 42;
  const rng = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const started = Date.now();
  while (await page.locator('[data-screen=stir]').getAttribute('data-guard-state') === 'STIRRING') {
    if (Date.now() - started > 40000) throw new Error('Ring screenshot input did not complete');
    for (let i = 0; i < 40; i++) {
      a += .12 + rng() * .1;
      const r = box.width / .6624 * (.08 + .3 * Math.abs(Math.sin(a * .31)) + rng() * .03);
      await page.mouse.move(box.x + box.width / 2 + Math.cos(a) * r, box.y + box.height / 2 + Math.sin(a * 1.17) * r);
    }
  }
  await page.waitForFunction(() => ['CLEAR', 'FLAG', 'BLOCK'].includes(document.querySelector('[data-screen=stir]').dataset.guardState));
  const verdict = await page.locator('[data-screen=stir]').getAttribute('data-guard-state');
  await page.waitForTimeout(900);
  const contextLost = await page.evaluate(() => document.querySelector('canvas').getContext('webgl2')?.isContextLost());
  if (contextLost || failures.some(message => message.includes('CONTEXT_LOST'))) throw new Error(`WebGL context lost during capture: ${failures.join('; ')}`);
  const luminance = await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => {
    const canvas = document.querySelector('canvas'), gl = canvas.getContext('webgl2'), pixel = new Uint8Array(4);
    gl.readPixels(4, 4, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    resolve(pixel[0] + pixel[1] + pixel[2]);
  })));
  if (!luminance) throw new Error(`The lamp rendered black during ${name} capture: ${failures.join('; ')}`);
  await page.screenshot({ path: `docs/media/lavaguard/real-${verdict.toLowerCase()}-${name}.png` });
  if (!evaluated) throw new Error('Screenshot has no real Worker evaluation.');
  captures.push({ viewport, screenshot: `docs/media/lavaguard/real-${verdict.toLowerCase()}-${name}.png`, ...await evaluated });
  await page.close();
}
} finally { await browser.close(); }
await mkdir('ml/artifacts', { recursive: true });
await writeFile('ml/artifacts/capture-current.json', JSON.stringify({ capturedAt: new Date().toISOString(), origin, configuration, syntheticAutomation: true, mockedResponses: false, captures }, null, 2) + '\n');
console.log('Current landing, stirring and actual server-decision screenshots captured at both widths.');
