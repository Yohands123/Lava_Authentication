import { captureCases } from '../phase5-generators.mjs';
import { environmentResult } from './environment-result.mjs';

export const CONSOLE_ORIGIN = 'http://localhost:8792';
export const PROFILES = Object.freeze({
  normal: { origin: 'http://localhost:8787', label: 'Normal: ML observation', experimental: false, modelMode: 'shadow' },
  research: { origin: 'http://localhost:8791', label: 'Experimental: older ML enforcement', experimental: true, modelMode: 'research_enforce' },
});
export const PATTERNS = Object.freeze([{ id: 'original-demo', label: 'Original fast automated demo' }, ...captureCases.map(id => ({ id, label: ({
  linear: 'Straight line', 'constant-speed': 'Constant-speed circle', random: 'Erratic random jumps', bezier: 'Smooth Bezier curve',
  'variable-velocity': 'Changing speed', corrections: 'Curves with corrections', pauses: 'Movement with pauses',
  'ghost-cursor': 'Ghost Cursor', puppeteer: 'Actual Puppeteer', reactive: 'Reactive bubble pursuit',
  'synthetic-replay': 'Seeded path replay', 'dom-synthetic': 'Synthetic DOM events', cadence16: '16 ms sampling',
  cadence64: '64 ms sampling', scaled: 'Scaled and shifted path',
})[id] }))]);

export function validateJob(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).sort().join(',') !== 'cases,profile,repeats,seed') throw new Error('Choose a profile, cases, seed and repeats.');
  if (!Object.hasOwn(PROFILES, value.profile)) throw new Error('Unknown local profile.');
  if (!Array.isArray(value.cases) || !value.cases.length || value.cases.length > PATTERNS.length || new Set(value.cases).size !== value.cases.length || value.cases.some(id => !PATTERNS.some(p => p.id === id))) throw new Error('Choose known, distinct automation patterns.');
  if (!Number.isInteger(value.seed) || value.seed < 1 || value.seed > 1e6 || !Number.isInteger(value.repeats) || value.repeats < 1 || value.repeats > 3) throw new Error('Seed must be 1–1000000 and repeats 1–3.');
  return { profile: value.profile, cases: [...value.cases], seed: value.seed, repeats: value.repeats };
}

export function describeOutcome(row) {
  if (row.stopped) return 'Stopped; detection unknown';
  if (row.error) return 'Harness error; detection unknown';
  if (!row.taskComplete) return 'Ring incomplete; no detection credit';
  if (row.verdict === 'CLEAR' && row.clearanceIssued) return 'Automation received clearance';
  if (row.verdict === 'FLAG') return 'Server flagged this attempt';
  if (row.verdict === 'BLOCK') return 'Server restricted this attempt';
  return 'Decision unavailable; detection unknown';
}

export function redactResult(value) {
  const v = value && typeof value === 'object' ? value : {};
  const status = n => Number.isInteger(n) && n >= 100 && n <= 599 ? n : null;
  return { ...environmentResult(v), taskComplete: v.taskComplete === true, clearanceIssued: v.clearanceIssued === true,
    verdict: ['CLEAR', 'FLAG', 'BLOCK'].includes(v.verdict) ? v.verdict : null,
    state: typeof v.state === 'string' && /^[A-Z_]{2,40}$/.test(v.state) ? v.state : null,
    evaluationStatus: status(v.evaluationStatus), optionsStatus: status(v.optionsStatus), sessionStatus: status(v.sessionStatus),
    modelMode: ['off', 'shadow', 'research_enforce'].includes(v.modelMode) ? v.modelMode : null,
    modelVersion: typeof v.modelVersion === 'string' && /^lava-[\w-]{3,100}$/.test(v.modelVersion) ? v.modelVersion : null,
    riskScore: typeof v.riskScore === 'number' && Number.isFinite(v.riskScore) && v.riskScore >= 0 && v.riskScore <= 1 ? v.riskScore : null,
    reasons: Array.isArray(v.reasons) ? v.reasons.filter(r => typeof r === 'string' && /^[a-z_0-9]{2,80}$/.test(r)).slice(0, 12) : [],
    moveCount: Number.isInteger(v.moveCount) && v.moveCount >= 0 && v.moveCount <= 1e6 ? v.moveCount : null,
    durationMs: Number.isFinite(v.durationMs) && v.durationMs >= 0 && v.durationMs <= 180000 ? v.durationMs : null,
    retryAfter: Number.isFinite(v.retryAfter) ? Math.max(0, Math.min(60, v.retryAfter)) : 0,
    screenshot: v.screenshot === true, ...(v.stopped === true ? { stopped: true } : {}),
    ...(v.error ? { error: String(v.error).split('\n')[0].slice(0, 240) } : {}) };
}
