import { chromium } from '@playwright/test';
import { mkdir, readFile, writeFile, rename, readdir, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { LocalServices } from './test-console/services.mjs';
import { BrowserRunner } from './test-console/runner.mjs';
import { TestController } from './test-console/controller.mjs';
import { createConsoleServer } from './test-console/http.mjs';
import { CONSOLE_ORIGIN } from './test-console/settings.mjs';

process.chdir(fileURLToPath(new URL('..', import.meta.url)));
const services = new LocalServices(), runner = new BrowserRunner();
let server, consoleBrowser, controller, stopping = false;
async function shutdown() {
  if (stopping) return; stopping = true; controller?.stop();
  server?.close(); await runner.close(); await consoleBrowser?.close().catch(() => {}); services.close();
}
process.on('SIGINT', () => { shutdown().finally(() => process.exit(0)); });
process.on('SIGTERM', () => { shutdown().finally(() => process.exit(0)); });
try {
  console.log('Preparing localhost test servers. No deployment, training or production activation.');
  await services.ensure();
  const folder = resolve('.cache/test-console'), shots = resolve(folder, 'screenshots');
  await mkdir(shots, { recursive: true });
  let history = [];
  try { history = JSON.parse(await readFile(resolve(folder, 'history.json'), 'utf8')); if (!Array.isArray(history)) history = []; }
  catch (error) { if (error.code !== 'ENOENT') console.error('Previous local history could not be read; starting an empty history.'); }
  controller = new TestController({ runAttempt: options => runner.attempt(options), history,
    saveHistory: async rows => {
      await writeFile(resolve(folder, 'history.json.tmp'), JSON.stringify(rows, null, 2) + '\n');
      await rename(resolve(folder, 'history.json.tmp'), resolve(folder, 'history.json'));
      const retained = new Set(rows.filter(r => r.screenshot).map(r => r.id + '.png'));
      for (const file of await readdir(shots)) if (/^[a-f0-9-]{36}\.png$/.test(file) && !retained.has(file)) await unlink(resolve(shots, file));
    } });
  server = createConsoleServer({ controller, profiles: () => services.status,
    screenshot: async id => { try { return await readFile(resolve(shots, id + '.png')); } catch { return null; } } });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(8792, '127.0.0.1', resolve); });
  console.log('Test console: ' + CONSOLE_ORIGIN);
  console.log('Manual/advisory app: http://localhost:8787 | Older-model research comparison: http://localhost:8791');
  console.log('Keep this terminal running. Ctrl+C stops only servers owned by this console.');
  if (!process.argv.includes('--no-open')) {
    try {
      consoleBrowser = await chromium.launch({ headless: false, args: ['--window-size=1360,1000'] });
      const page = await consoleBrowser.newPage({ viewport: { width: 1280, height: 900 } });
      await page.goto(CONSOLE_ORIGIN); await page.bringToFront();
    } catch { console.error('The console is running. Open ' + CONSOLE_ORIGIN + ' in your browser.'); }
  }
} catch (error) { console.error(String(error.message)); await shutdown(); process.exitCode = 1; }
