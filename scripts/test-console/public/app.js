const el = id => document.getElementById(id);
const token = document.querySelector('meta[name="console-token"]').content;
let state, active = false, renderingKey = '', shotId = '', refreshing = false, connectionError = false;
const descriptions = {
  'original-demo': 'The exact fast automated stir used in the earlier visible demo. No added per-point delay; sampling and scheduling affect its scores.',
  random: 'Fast irregular jumps. A known automation probe, not a human trace.',
  reactive: 'Uses the actual moving bubble targets from the explicitly labeled local automation capture.',
  'ghost-cursor': 'The existing Ghost Cursor library generates the path. Real browser mouse events move it.',
  puppeteer: 'Launches actual Puppeteer Chromium movement; the other ordinary paths use Playwright.',
  'synthetic-replay': 'Reuses the seeded corrections path. Browser timing and the lava simulation may vary.',
  'dom-synthetic': 'Dispatches explicitly synthetic pointer events through the real frontend.',
  cadence16: 'Requests 16 ms observation. The browser can deliver slower actual samples.',
  cadence64: 'Requests 64 ms observation. Cadence changes are acquisition controls.',
};
function patternDescription() { el('pattern-description').textContent = descriptions[el('pattern').value] ?? 'Real cursor movement through the existing lava physics. No fabricated verdict or virtual passkey.'; }
async function post(path, data) {
  const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Lava-Console': token }, body: JSON.stringify(data) });
  const value = await response.json(); if (!response.ok) throw new Error(value.error ?? 'Local request failed.'); return value;
}
async function start(all) {
  if (active || !el('run-form').reportValidity()) return;
  el('error').textContent = '';
  const options = { profile: el('profile').value, cases: all ? state.patterns.map(p => p.id) : [el('pattern').value], seed: Number(el('seed').value), repeats: Number(el('repeats').value) };
  try { await post('/api/run', options); await refresh(); }
  catch (error) { el('error').textContent = error.message; }
}
function cell(row, value, className) {
  const td = document.createElement('td'); td.textContent = value ?? '—'; if (className) td.className = className; row.append(td);
}
function renderHistory(history) {
  const key = JSON.stringify(history.map(r => [r.id, r.outcome])); if (key === renderingKey) return; renderingKey = key;
  const tbody = el('results'); tbody.replaceChildren();
  for (const record of [...history].reverse()) {
    const row = document.createElement('tr');
    cell(row, `${record.pattern} / ${record.seed}`); cell(row, record.profile); cell(row, record.taskComplete ? 'Completed' : record.stopped ? 'Stopped' : record.error ? 'Unknown' : 'Incomplete');
    cell(row, record.verdict, record.verdict ? 'verdict-' + record.verdict : ''); cell(row, record.clearanceIssued ? 'Issued' : 'None');
    cell(row, record.optionsStatus); cell(row, record.sessionStatus); cell(row, record.error ?? record.outcome); tbody.append(row);
  }
  el('empty').hidden = history.length > 0;
  const complete = history.filter(r => r.taskComplete).length, clear = history.filter(r => r.clearanceIssued).length;
  el('totals').textContent = `${history.length} retained · ${complete} rings completed · ${clear} clearances`;
  const latest = history.at(-1); el('details').hidden = !latest;
  if (latest) {
    el('detail-text').textContent = `${latest.pattern} · seed ${latest.seed} · ${latest.modelMode ?? latest.profile} · ${latest.outcome}. ${latest.durationMs ? (latest.durationMs/1000).toFixed(1)+' seconds.' : ''}`;
    el('reasons').textContent = latest.error ?? `Model: ${latest.modelVersion ?? 'unavailable'}. Server reasons: ${latest.reasons?.join(', ') || 'none returned'}. Environment (${latest.declaredEnvironment ?? 'unknown'}, declared): ${latest.automationEnvironment ? JSON.stringify(latest.automationEnvironment.signals) : 'not recorded'}. Environment hints are advisory; operator identity unknown. Scores and verdicts remain unvalidated research evidence.`;
    el('screenshot').hidden = !latest.screenshot;
    if (latest.screenshot && latest.id !== shotId) { shotId = latest.id; el('screenshot').src = '/api/screenshot/' + latest.id; }
  }
}
async function refresh() {
  if (refreshing) return; refreshing = true;
  try {
    const response = await fetch('/api/state', { signal: AbortSignal.timeout(5000) }); if (!response.ok) throw new Error('Local test console is unavailable.'); state = await response.json();
    if (connectionError) { el('error').textContent = ''; connectionError = false; }
    if (!el('pattern').options.length) {
      for (const pattern of state.patterns) { const option = document.createElement('option'); option.value = pattern.id; option.textContent = pattern.label; el('pattern').append(option); }
      el('pattern').value = 'original-demo'; patternDescription();
    }
    active = ['running', 'stopping'].includes(state.job?.status);
    for (const id of ['run-selected', 'run-suite', 'profile', 'pattern', 'seed', 'repeats']) el(id).disabled = active;
    el('stop').disabled = !active || state.job?.status === 'stopping';
    const job = state.job;
    el('status').textContent = job ? `${job.status === 'running' ? 'Running' : job.status} · ${job.completed}/${job.total} · ${job.current?.pattern ?? ''} · ${job.stage}${job.error ? ' · '+job.error : ''}` : 'Ready. Choose a pattern or open the app for manual testing.';
    el('progress').max = job?.total ?? 1; el('progress').value = job?.completed ?? 0;
    el('configuration').textContent = Object.values(state.profiles).map(p => `${p.origin}: ${p.configuration?.modelMode ?? p.modelMode}`).join('   |   ');
    renderHistory(state.history);
  } catch (error) { connectionError = true; el('error').textContent = error.message + ' Keep the test server terminal open.'; }
  finally { refreshing = false; }
}
el('run-form').addEventListener('submit', event => { event.preventDefault(); start(false); });
el('run-suite').addEventListener('click', () => start(true));
el('pattern').addEventListener('change', patternDescription);
el('stop').addEventListener('click', async () => { try { await post('/api/stop', {}); await refresh(); } catch (error) { el('error').textContent = error.message; } });
await refresh(); setInterval(refresh, 1200);
