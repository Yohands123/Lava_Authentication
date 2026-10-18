import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
const browser = await chromium.launch();
const report = { environment: 'Local headless Chromium; not a physical mobile benchmark', comparison: 'Same original renderer/physics, observer disabled vs enabled; not a historical binary benchmark', samples: [] };
for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
  for (const observer of [false, true]) {
    const page = await browser.newPage({ viewport });
    if (!observer) await page.route('**/api/lavaguard/config', route => route.fulfill({ json: { mode: 'off', lab: false } }));
    await page.goto('http://localhost:8787');
    const cdp = await page.context().newCDPSession(page); await cdp.send('Performance.enable');
    await page.getByRole('button', { name: 'Enter', exact: true }).click();
    const start = performance.now();
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('[data-screen=stir]').dataset.guardState === 'STIRRING');
    const preparationMs = performance.now() - start;
    await page.waitForTimeout(1000);
    const before = await cdp.send('Performance.getMetrics');
    await page.evaluate(() => {
      window.guardFrameTimes = []; let last = performance.now();
      const tick = now => { window.guardFrameTimes.push(now - last); last = now; if (window.guardFrameTimes.length < 240) requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    });
    const box = await page.locator('[data-ring-arc]').boundingBox();
    // Small repeated movement doesn't clear the ring; capture cost is still measured.
    for (let i = 0; i < 120; i++) await page.mouse.move(box.x + box.width / 2 + Math.sin(i * .2) * 5, box.y + box.height / 2 + Math.cos(i * .3) * 5);
    await page.waitForTimeout(1000);
    const frame = await page.evaluate(() => window.guardFrameTimes);
    const after = await cdp.send('Performance.getMetrics');
    const metric = (m, name) => m.metrics.find(x => x.name === name)?.value ?? 0;
    const sorted = frame.filter(v => v > 0).sort((a, b) => a - b);
    report.samples.push({ viewport, observer, preparationMs, frameN: frame.length, frameP50Ms: sorted[Math.floor(sorted.length * .5)], frameP95Ms: sorted[Math.floor(sorted.length * .95)], approximateFps: 1000 / (frame.reduce((a, b) => a + b, 0) / frame.length), mainThreadTaskSeconds: metric(after, 'TaskDuration') - metric(before, 'TaskDuration'), jsHeapBytes: metric(after, 'JSHeapUsedSize'), gestureExtraClicks: 0 });
    await page.close();
  }
}
await browser.close();
await writeFile('ml/artifacts/performance.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ samples: report.samples.length, report: 'ml/artifacts/performance.json' }));
