import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { request } from 'node:http';
import { validateJob, redactResult, describeOutcome, PATTERNS } from './settings.mjs';
import { TestController } from './controller.mjs';
import { createConsoleServer } from './http.mjs';

const job = () => ({ profile: 'normal', cases: ['corrections'], seed: 812, repeats: 1 });
const finish = async controller => { await controller.task; assert.equal(controller.abort, null); };
async function fixture(t) {
  const calls = [];
  const controller = new TestController({ runAttempt: async options => { calls.push(options); return { taskComplete: true, verdict: 'CLEAR', clearanceIssued: true, sessionStatus: 401 }; }, gapMs: 0 });
  let origin;
  const server = createConsoleServer({ controller, origin: () => origin });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = 'http://127.0.0.1:' + server.address().port;
  t.after(async () => { controller.stop(); await controller.task; await new Promise(resolve => server.close(resolve)); });
  const html = await (await fetch(origin)).text(), token = html.match(/name="console-token" content="([a-f0-9]{64})"/)?.[1];
  assert.ok(token);
  const post = (path, body, headers = {}) => fetch(origin + path, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', 'X-Lava-Console': token, ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) });
  return { calls, controller, origin, token, post };
}

test('job inputs use fixed local profiles and copied, bounded generator choices', () => {
  const input = job(), parsed = validateJob(input); input.cases.push('random');
  assert.deepEqual(parsed.cases, ['corrections']); assert.equal(PATTERNS.length, 16);
});
test('unknown profiles, command-like fields, URLs, repeated patterns and invalid ranges are refused', () => {
  for (const change of [{ profile: '__proto__' }, { profile: 'https://external.invalid' }, { command: 'injected' }, { cases: ['bad'] }, { cases: ['random', 'random'] }, { cases: [] }, { seed: NaN }, { seed: 0 }, { seed: 1.5 }, { repeats: 4 }]) assert.throws(() => validateJob({ ...job(), ...change }));
});
test('incomplete, stopped and error attempts never earn detector credit', () => {
  assert.match(describeOutcome({ taskComplete: false, verdict: 'FLAG' }), /no detection credit/);
  assert.match(describeOutcome({ stopped: true, error: 'closed' }), /Stopped/);
  assert.match(describeOutcome({ error: 'broken', taskComplete: true }), /unknown/);
  assert.match(describeOutcome({ taskComplete: true, verdict: 'CLEAR', clearanceIssued: true }), /received clearance/);
});
test('persisted/exported results drop raw vectors, credentials, tokens and invalid scores', () => {
  const safe = redactResult({ verdict: 'CLEAR', taskComplete: true, clearance: 'secret', cookie: 'secret', samples: [1], lab: { fingerprint: 'secret' }, riskScore: NaN, reasons: ['known_reason', '<script>'], optionsStatus: 200, sessionStatus: 401 });
  assert.equal(safe.riskScore, null); assert.deepEqual(safe.reasons, ['known_reason']); assert.equal(safe.optionsStatus, 200);
  assert.doesNotMatch(JSON.stringify(safe), /secret|fingerprint|samples|cookie/);
});

test('versioned advisory environment is allowlisted and legacy missing evidence stays unknown', () => {
  const evidence = { version: 'lava-automation-environment-v1', authority: 'advisory', signals: { webdriver: true, headlessUserAgent: false, headlessBrand: null } };
  const safe = redactResult({ automationEnvironment: evidence, declaredEnvironment: 'ghost-cursor', declaredControl: 'scripted', displayMode: 'headed' });
  assert.deepEqual(safe.automationEnvironment, evidence); evidence.signals.webdriver = false;
  assert.equal(safe.automationEnvironment.signals.webdriver, true); assert.equal(safe.declaredEnvironment, 'ghost-cursor');
  assert.equal(redactResult({}).automationEnvironment, null); assert.equal(redactResult({}).declaredEnvironment, 'unknown');
  for (const change of [{ userAgent: 'private' }, { authority: 'verified' }, { signals: { webdriver: true } }, { version: 'future' }]) {
    const invalid = redactResult({ automationEnvironment: { ...evidence, ...change } });
    assert.equal(invalid.automationEnvironment, null); assert.doesNotMatch(JSON.stringify(invalid), /private|verified|future/);
  }
  assert.equal(redactResult({ declaredControl: 'human', declaredEnvironment: 'ordinary-chrome' }).declaredControl, 'unknown');
});
test('one active job, deterministic distinct repeat seeds, and real output kept after completion', async () => {
  const calls = [], controller = new TestController({ runAttempt: async options => { calls.push([options.pattern, options.seed]); return { verdict: 'FLAG', taskComplete: true, optionsStatus: 403, clearance: 'secret' }; }, gapMs: 0 });
  controller.start({ ...job(), cases: ['random', 'corrections'], repeats: 2 }); assert.throws(() => controller.start(job()), /already active/);
  await finish(controller); assert.equal(controller.job.status, 'finished'); assert.equal(calls.length, 4);
  assert.deepEqual(calls.map(c => c[1]), [812, 812, 1809, 1809]); assert.doesNotMatch(JSON.stringify(controller.state()), /secret/);
});
test('stop interrupts an active attempt and prevents later queued attempts', async () => {
  let calls = 0;
  const controller = new TestController({ runAttempt: ({ signal }) => new Promise(resolve => { calls++; signal.addEventListener('abort', () => resolve({ taskComplete: false }), { once: true }); }), gapMs: 0 });
  controller.start({ ...job(), cases: ['random', 'linear'] }); controller.stop(); await finish(controller);
  assert.equal(calls, 1); assert.equal(controller.job.status, 'stopped'); assert.match(controller.history[0].outcome, /Stopped/);
});
test('a failed attempt remains visible and does not turn a suite into invented detection', async () => {
  let calls = 0;
  const controller = new TestController({ runAttempt: async () => { calls++; throw new Error('Browser unavailable\nprivate stack'); }, gapMs: 0 });
  controller.start({ ...job(), cases: ['linear', 'random'] }); await finish(controller);
  assert.equal(calls, 2); assert.equal(controller.history.length, 2); assert.match(controller.history[0].outcome, /unknown/); assert.equal(controller.history[0].error, 'Browser unavailable');
});
test('reloaded history is bounded and re-redacted before the console serves it', () => {
  const rows = Array.from({ length: 120 }, () => ({ id: randomUUID(), ...job(), pattern: 'linear', startedAt: new Date().toISOString(), clearance: 'secret' }));
  const controller = new TestController({ runAttempt: async () => ({}), history: rows });
  assert.equal(controller.history.length, 100); assert.doesNotMatch(JSON.stringify(controller.state()), /secret/);
});
test('the local page has a fresh CSRF token and restrictive browser headers', async t => {
  const { origin } = await fixture(t), response = await fetch(origin);
  assert.match(response.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  assert.equal(response.headers.get('access-control-allow-origin'), null);
  assert.equal(response.headers.get('cache-control'), 'no-store');
});
test('cross-origin browser-control requests are refused even with a valid token', async t => {
  const { post, calls } = await fixture(t);
  assert.equal((await post('/api/run', job(), { Origin: 'https://external.invalid' })).status, 403); assert.equal(calls.length, 0);
});
test('missing tokens, invalid hosts and non-JSON requests cannot launch automation', async t => {
  const { post, origin, calls } = await fixture(t);
  assert.equal((await post('/api/run', job(), { 'X-Lava-Console': '' })).status, 403);
  assert.equal((await post('/api/run', job(), { 'Content-Type': 'text/plain' })).status, 415);
  // fetch normalizes Host; use an actual wire-level override for rebinding.
  const wrongHostStatus = await new Promise((resolve, reject) => {
    const req = request(origin + '/', { headers: { Host: 'external.invalid' } }, response => { response.resume(); resolve(response.statusCode); }); req.on('error', reject); req.end();
  });
  assert.equal(wrongHostStatus, 403);
  assert.equal(calls.length, 0);
});
test('oversized and malformed jobs are rejected before any browser work', async t => {
  const { post, calls } = await fixture(t);
  assert.equal((await post('/api/run', JSON.stringify({ padding: 'x'.repeat(3000) }))).status, 413);
  assert.equal((await post('/api/run', '{bad')).status, 400);
  assert.equal((await post('/api/run', { ...job(), target: 'https://external.invalid' })).status, 400); assert.equal(calls.length, 0);
  assert.equal((await post('/api/stop', [])).status, 400);
});
test('valid console controls run one bounded attempt and export only redacted evidence', async t => {
  const { post, controller, origin } = await fixture(t);
  assert.equal((await post('/api/run', job())).status, 202); await finish(controller);
  const report = await (await fetch(origin + '/api/report')).json();
  assert.equal(report.generatedAutomationOnly, true); assert.equal(report.humanStudyEvidence, false); assert.equal(report.history.length, 1);
  assert.equal(report.history[0].sessionStatus, 401);
});
test('chunked bodies cannot bypass the byte limit and leave the control server usable', async t => {
  const { origin, token, calls } = await fixture(t);
  const status = await new Promise((resolve, reject) => {
    const req = request(origin + '/api/run', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', 'X-Lava-Console': token, 'Transfer-Encoding': 'chunked' } }, response => { response.resume(); resolve(response.statusCode); });
    req.on('error', reject); req.write('{"padding":"' + 'x'.repeat(3000)); req.end('"}');
  });
  assert.equal(status, 413); assert.equal(calls.length, 0); assert.equal((await fetch(origin + '/api/state')).status, 200);
});
test('GET requests and screenshot traversal cannot trigger actions or arbitrary file reads', async t => {
  const { origin, calls } = await fixture(t);
  assert.equal((await fetch(origin + '/api/run')).status, 404);
  assert.equal((await fetch(origin + '/api/screenshot/%2e%2e%2fprivate')).status, 404);
  assert.equal((await fetch(origin + '/api/screenshot/00000000-0000-0000-0000-000000000000')).status, 404); assert.equal(calls.length, 0);
});
