import { randomUUID } from 'node:crypto';
import { validateJob, describeOutcome, redactResult, PATTERNS, PROFILES } from './settings.mjs';

const delay = (ms, signal) => new Promise(resolve => {
  if (signal.aborted) return resolve();
  const done = () => { clearTimeout(timer); signal.removeEventListener('abort', done); resolve(); };
  const timer = setTimeout(done, ms); signal.addEventListener('abort', done, { once: true });
});

export class TestController {
  constructor({ runAttempt, saveHistory = async () => {}, history = [], gapMs = 2500 }) {
    this.runAttempt = runAttempt; this.saveHistory = saveHistory; this.gapMs = gapMs;
    // Persisted evidence is already redacted by the runner; never store raw decisions.
    this.history = history.filter(r => r && /^[a-f0-9-]{36}$/.test(r.id) && Object.hasOwn(PROFILES, r.profile) && PATTERNS.some(p => p.id === r.pattern) && Number.isInteger(r.seed)).slice(-100).map(r => {
      const safe = { ...redactResult(r), id: r.id, profile: r.profile, pattern: r.pattern, seed: r.seed,
        startedAt: typeof r.startedAt === 'string' && Number.isFinite(Date.parse(r.startedAt)) ? new Date(r.startedAt).toISOString() : null, declaredAutomation: true };
      return { ...safe, outcome: describeOutcome(safe) };
    }); this.job = null; this.abort = null; this.task = null;
  }
  state() { return { job: this.job ? structuredClone(this.job) : null, history: structuredClone(this.history) }; }
  start(input) {
    const options = validateJob(input);
    if (this.abort) throw new Error('An automation run is already active. Stop it before starting another.');
    const id = randomUUID(), abort = new AbortController(); this.abort = abort;
    this.job = { id, ...options, status: 'running', total: options.cases.length * options.repeats, completed: 0, current: null, stage: 'Opening visible browser', startedAt: new Date().toISOString() };
    this.task = this.execute(options, abort).finally(() => { this.abort = null; });
    return structuredClone(this.job);
  }
  stop() { if (this.abort) { this.job.status = 'stopping'; this.abort.abort(); } }
  async execute(options, abort) {
    try {
      outer: for (let repeat = 0; repeat < options.repeats; repeat++) for (const pattern of options.cases) {
        if (abort.signal.aborted) break outer;
        const seed = ((options.seed - 1 + repeat * 997) % 1e6) + 1, id = randomUUID();
        this.job.current = { pattern, seed, repeat: repeat + 1 };
        const started = new Date().toISOString();
        let result;
        try {
          result = await this.runAttempt({ id, profile: options.profile, pattern, seed, signal: abort.signal,
            progress: stage => { this.job.stage = stage; } });
        } catch (error) { result = { error: String(error.message).split('\n')[0].slice(0, 240), taskComplete: false }; }
        const row = { ...redactResult(result), id, startedAt: started, profile: options.profile, pattern, seed, declaredAutomation: true,
          ...(abort.signal.aborted ? { stopped: true } : {}) };
        row.outcome = describeOutcome(row);
        this.history.push(row); this.history = this.history.slice(-100); this.job.completed++;
        await this.saveHistory(this.history);
        this.job.stage = 'Cooling down between independent attempts';
        // Respect observed rate limits; never turn a 429 into model credit.
        await delay(Math.max(this.gapMs, row.retryAfter * 1000), abort.signal);
      }
      this.job.status = abort.signal.aborted ? 'stopped' : 'finished';
    } catch (error) { this.job.status = 'error'; this.job.error = String(error.message).split('\n')[0].slice(0, 240); }
    finally { this.job.stage = 'Idle'; this.job.finishedAt = new Date().toISOString(); }
  }
}
