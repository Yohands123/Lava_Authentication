import { spawn, execFileSync } from 'node:child_process';
import { mkdir, writeFile, readdir, readFile, cp } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const port = 8783, origin = `http://localhost:${port}`;
const levels = process.argv.length > 2 ? process.argv.slice(2).map(Number) : [1, 4, 16, 64, 128];
if (levels.some(n => ![1,4,16,64,128].includes(n))) throw new Error('Controlled local concurrency levels only');
const report = { origin, localOnly: true, requestsPerOperation: 'max(64,concurrency)', notes: ['Development workerd/DO SQLite only, not edge capacity', 'Reserved synthetic client headers simulate multiple local clients; IP is not identity', 'No requests to public Cloudflare infrastructure', 'Host CPU/RSS includes the isolated workerd process; no per-request CPU attribution'], phases: [] };
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const quantile = (values, q) => { const a = [...values].sort((a, b) => a - b); return a[Math.floor((a.length - 1) * q)] ?? 0; };
async function batch(count, concurrency, fn) {
  let next = 0; const results = [], start = performance.now();
  await Promise.all(Array.from({ length: Math.min(count, concurrency) }, async () => {
    while (next < count) { const i = next++, began = performance.now(); try { results[i] = { ...await fn(i), ms: performance.now() - began }; } catch (error) { results[i] = { status: 0, error: error.message, ms: performance.now() - began }; } }
  }));
  const durationMs = performance.now() - start, statuses = {}, actual = results.filter(r => !r.skipped);
  for (const r of actual) statuses[r.status] = (statuses[r.status] ?? 0) + 1;
  return { results, summary: { durationMs, actualRequestN: actual.length, requestsPerSecond: actual.length * 1000 / durationMs, successfulPerSecond: (statuses[200] ?? 0) * 1000 / durationMs, transportErrors: [...new Set(actual.filter(r => r.status === 0).map(r => r.error))],
    p50Ms: quantile(actual.map(r => r.ms), .5), p95Ms: quantile(actual.map(r => r.ms), .95), p99Ms: quantile(actual.map(r => r.ms), .99), successfulP95Ms: quantile(actual.filter(r => r.status===200).map(r => r.ms), .95), statuses, skippedN: results.filter(r => r.skipped).length, deliberateOverloadN: actual.filter(r => r.status===503).length, unexpectedErrorN: actual.filter(r => r.status === 0 || r.status === 500).length, errorRate: actual.filter(r => r.status === 0 || r.status >= 500).length / Math.max(1,actual.length) } };
}
async function post(path, data, i, cookie) {
  const response = await fetch(origin + path, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', 'CF-Connecting-IP': `198.51.100.${i % 250 + 1}`, ...(cookie ? { Cookie: cookie } : {}) }, body: JSON.stringify(data), signal: AbortSignal.timeout(15000) });
  let responseData = null;
  try { responseData = await response.json(); } catch {}
  return { status: response.status, data: responseData, cookie: response.headers.get('set-cookie')?.split(';')[0] };
}
function usage() {
  const source = `$loadWorkerPid=(Get-NetTCPConnection -State Listen -LocalPort ${port} | Select-Object -First 1).OwningProcess; Get-Process -Id $loadWorkerPid | Select-Object CPU,WorkingSet64,PeakWorkingSet64,PrivateMemorySize64 | ConvertTo-Json -Compress`;
  try { return JSON.parse(execFileSync('powershell.exe', ['-NoProfile', '-Command', source], { encoding: 'utf8', windowsHide: true })); } catch { return null; }
}
async function storage(directory) {
  const totals = {};
  for (const file of await readdir(directory, { recursive: true })) {
    if (!file.endsWith('.sqlite')) continue;
    const db = new DatabaseSync(resolve(directory, file), { readOnly: true });
    for (const { name } of db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('guard_attempts','guard_clearances','guard_history','guard_metrics','guard_stepups')").all()) totals[name] = (totals[name] ?? 0) + db.prepare(`SELECT COUNT(*) AS n FROM ${name}`).get().n;
    db.close();
  }
  return totals;
}
await mkdir('ml/artifacts', { recursive: true });
await mkdir('.cache', { recursive: true });
// Freeze code/assets for the entire run: unrelated IDE builds cannot invalidate
// requests by causing Wrangler's development hot reload during a load phase.
const snapshot = resolve(`.cache/load-snapshot-${Date.now()}`);
await mkdir(snapshot, { recursive: true });
await build({ entryPoints: ['src/worker/index.ts'], outfile: resolve(snapshot, 'worker.mjs'), bundle: true, format: 'esm', platform: 'browser', target: 'es2022', external: ['cloudflare:workers', 'node:*'], logLevel: 'error' });
await cp('dist', resolve(snapshot, 'assets'), { recursive: true });
const config = (await readFile('wrangler.toml', 'utf8')).replace('main = "src/worker/index.ts"', 'main = "./worker.mjs"').replace('directory = "./dist"', 'directory = "./assets"');
await writeFile(resolve(snapshot, 'wrangler.toml'), config);
report.workerBundleSha256 = createHash('sha256').update(await readFile(resolve(snapshot, 'worker.mjs'))).digest('hex');
if (process.argv.length > 2) {
  const previous = JSON.parse(await readFile('ml/artifacts/phase4-load.json', 'utf8'));
  report.phases = previous.phases.filter(p => !levels.includes(p.concurrency));
}
for (const concurrency of levels) {
  const n = Math.max(64, concurrency);
  const directory = resolve(`.wrangler/load-phase4-${Date.now()}-c${concurrency}`);
  const worker = spawn(process.execPath, ['node_modules/wrangler/bin/wrangler.js', 'dev', '--config', resolve(snapshot, 'wrangler.toml'), '--port', String(port), '--persist-to', directory, '--var', `ORIGIN:${origin}`, '--var', 'LAVAGUARD_MODE:enforce', '--var', 'LAVAGUARD_STEP_UP:off', '--var', 'LAVAGUARD_EXPERIMENTAL_MODEL:0'], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  const log = createWriteStream(`.cache/load-worker-c${concurrency}.log`);
  worker.stdout.pipe(log); worker.stderr.pipe(log);
  try {
    let ready = false;
    for (let i = 0; i < 100; i++) { try { if ((await fetch(origin + '/api/lavaguard/config')).ok) { ready = true; break; } } catch {} await wait(200); }
    if (!ready) throw new Error('Local load Worker did not start');
    const before = usage();
    const issued = await batch(n, concurrency, i => post('/api/lavaguard/challenge', { kind: 'accessible' }, i));
    const evaluated = await batch(n, concurrency, async i => {
      const c = issued.results[i];
      if (c.status !== 200) return { status: c.status, skipped: true };
      return post('/api/lavaguard/evaluate', { id: c.data.id, nonce: c.data.nonce, summary: null }, i, c.cookie);
    });
    const winner = evaluated.results.findIndex(r => r.status === 200 && r.data?.clearance);
    const redemption = winner < 0 ? null : await batch(8, 8, () => post('/api/login/options', { digests: {}, clearance: evaluated.results[winner].data.clearance }, winner, issued.results[winner].cookie));
    const abusive = await batch(40, concurrency, () => post('/api/lavaguard/challenge', { kind: 'gesture' }, 248));
    const distributed = concurrency === 128 ? await batch(320, 8, i => post('/api/lavaguard/challenge', { kind: 'gesture' }, i)) : null;
    const after = usage();
    let sessionStatus = 0;
    try { sessionStatus = (await fetch(origin + '/api/session', { signal: AbortSignal.timeout(15000) })).status; } catch {}
    const phase = { concurrency, requestsPerOperation: n, measuredAt: new Date().toISOString(), issuance: issued.summary, evaluation: evaluated.summary, parallelRedemption: redemption?.summary, distributedIssuance: distributed?.summary,
      abusiveCookieResetsSameNetwork: abusive.summary, unauthenticatedSession: sessionStatus,
      workerBefore: before, workerAfter: after, workerCpuSeconds: before && after ? after.CPU - before.CPU : null,
      storedRows: await storage(directory) };
    report.phases.push(phase);
    console.log(JSON.stringify({ concurrency, issuance: phase.issuance, evaluation: phase.evaluation, abusiveStatuses: abusive.summary.statuses }));
  } finally {
    if (worker.pid) { try { execFileSync('taskkill.exe', ['/PID', String(worker.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true }); } catch {} }
    log.end();
    await wait(300);
    await writeFile('ml/artifacts/phase4-load.json', JSON.stringify(report, null, 2) + '\n');
  }
}
