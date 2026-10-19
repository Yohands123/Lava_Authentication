import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { PROFILES, PATTERNS, CONSOLE_ORIGIN } from './settings.mjs';

const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'" };
function respond(res, status, value, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { ...headers, 'Content-Type': type }); res.end(type.startsWith('application/json') ? JSON.stringify(value) : value);
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0, text = '', failed = false;
    const fail = (message, status = 400) => { if (failed) return; failed = true; reject(Object.assign(new Error(message), { status })); };
    req.setTimeout(5000, () => fail('Request timed out.', 408));
    req.on('data', chunk => {
      if (failed) return;
      size += chunk.length;
      if (size > 2048) return fail('Request too large.', 413);
      text += chunk.toString('utf8');
    });
    req.on('end', () => { if (!failed) { try { resolve(JSON.parse(text)); } catch { fail('Malformed JSON.'); } } });
    req.on('error', () => fail('Request disconnected.'));
    req.on('aborted', () => fail('Request disconnected.'));
  });
}
export function createConsoleServer({ controller, origin = CONSOLE_ORIGIN, screenshot = async () => null, profiles = () => PROFILES }) {
  const token = randomBytes(32).toString('hex');
  const server = createServer(async (req, res) => {
    try {
      const address = typeof origin === 'function' ? origin() : origin, target = new URL(req.url, address);
      if (req.headers.host !== new URL(address).host) return respond(res, 403, { error: 'Loopback host required.' });
      if (req.method === 'POST') {
        const supplied = Buffer.from(String(req.headers['x-lava-console'] ?? ''));
        if (req.headers.origin !== address || supplied.length !== token.length || !timingSafeEqual(supplied, Buffer.from(token))) return respond(res, 403, { error: 'Use the local console controls.' });
        if (req.headers['content-type'] !== 'application/json') return respond(res, 415, { error: 'JSON required.' });
        if (Number(req.headers['content-length'] ?? 0) > 2048) return respond(res, 413, { error: 'Request too large.' });
        if (target.pathname === '/api/run') {
          const body = await readBody(req);
          if (controller.abort) return respond(res, 409, { error: 'Another run is active.' });
          return respond(res, 202, controller.start(body));
        }
        if (target.pathname === '/api/stop') { const body = await readBody(req); if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length) throw new Error('Stop accepts an empty object.'); controller.stop(); return respond(res, 200, { stopping: true }); }
      }
      if (req.method !== 'GET') return respond(res, 405, { error: 'Method not allowed.' });
      if (target.pathname === '/api/state') return respond(res, 200, { ...controller.state(), profiles: profiles(), patterns: PATTERNS });
      if (target.pathname === '/api/report') {
        res.setHeader('Content-Disposition', 'attachment; filename="lavaguard-local-tests.json"');
        return respond(res, 200, { schema: 'lava-local-test-console-v1', generatedAutomationOnly: true, humanStudyEvidence: false, ...controller.state() });
      }
      if (target.pathname.startsWith('/api/screenshot/')) {
        const id = target.pathname.slice('/api/screenshot/'.length);
        if (!/^[a-f0-9-]{36}$/.test(id) || !controller.history.some(r => r.id === id && r.screenshot)) return respond(res, 404, { error: 'Screenshot not found.' });
        const bytes = await screenshot(id);
        return bytes ? respond(res, 200, bytes, 'image/png') : respond(res, 404, { error: 'Screenshot unavailable.' });
      }
      const assets = { '/': ['index.html', 'text/html; charset=utf-8'], '/app.js': ['app.js', 'text/javascript; charset=utf-8'], '/styles.css': ['styles.css', 'text/css; charset=utf-8'] };
      if (!Object.hasOwn(assets, target.pathname)) return respond(res, 404, { error: 'Not found.' });
      const [file, type] = assets[target.pathname];
      let bytes = await readFile(new URL('public/' + file, import.meta.url));
      if (file === 'index.html') bytes = bytes.toString('utf8').replace('__CONSOLE_TOKEN__', token);
      respond(res, 200, bytes, type);
    } catch (error) { if (!res.headersSent) respond(res, [408, 413].includes(error.status) ? error.status : 400, { error: String(error.message).split('\n')[0].slice(0, 240) }); }
  });
  server.requestTimeout = 5000; server.headersTimeout = 5000;
  return server;
}
