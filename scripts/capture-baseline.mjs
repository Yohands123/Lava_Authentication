import { chromium } from '@playwright/test';
import { mkdir, access } from 'node:fs/promises';
try {
  await access('docs/media/lavaguard/before-stir-desktop.png');
  throw new Error('The preserved original baseline already exists; refusing to overwrite it.');
} catch (error) { if (error.code !== 'ENOENT') throw error; }
await mkdir('docs/media/lavaguard', { recursive: true });
const browser = await chromium.launch();
for (const [name, viewport] of [['desktop', { width: 1440, height: 1000 }], ['mobile', { width: 390, height: 844 }]]) {
  const page = await browser.newPage({ viewport });
  await page.goto('http://localhost:8787');
  await page.getByRole('button', { name: 'Enter', exact: true }).click();
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `docs/media/lavaguard/before-stir-${name}.png` });
  await page.close();
}
await browser.close();
