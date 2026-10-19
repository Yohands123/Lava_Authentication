import { extractFeatures, percentile, type PointerSample } from "./features";
import { bubbleResponse } from "./bubble-response";

export const EXPERIMENTAL_VERSION = "lava-response-v3";
export const EXPERIMENTAL_KEYS = ["reactionShare", "cadenceCv", "decelerationShare", "angularVelocityP95", "burstShare", "correctionPauseShare", "targetCoverage", "trackingErrorMean", "trackingErrorP95", "responseDelayShare", "targetTurnRate", "pursuitShare", "targetSwitchRate", "reacquisitionShare", "overshootShare", "lateStrategyShare"] as const;
export type ExperimentalFeatures = Record<typeof EXPERIMENTAL_KEYS[number], number>;
const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);

/** Descriptive research variant. No trust/source/device metadata is a predictor.
 * Spatial normalization applies equally to pointers and targets. Timing features
 * deliberately remain acquisition-sensitive controls, not invariance claims. */
export function experimentalFeatures(input: readonly PointerSample[]): ExperimentalFeatures {
  const out = Object.fromEntries(EXPERIMENTAL_KEYS.map(k => [k, 0])) as ExperimentalFeatures;
  const p = input.slice(0, 1024);
  if (p.length < 3 || p.some((s, i) => ![s.x, s.y, s.t].every(Number.isFinite) || (i > 0 && s.t <= p[i - 1]!.t))) return out;
  const duration = p.at(-1)!.t - p[0]!.t;
  const minX = Math.min(...p.map(s => s.x)), minY = Math.min(...p.map(s => s.y));
  const span = Math.hypot(Math.max(...p.map(s => s.x)) - minX, Math.max(...p.map(s => s.y)) - minY);
  if (span < 1e-8 || duration <= 0) return out;
  const points = p.map(s => ({ ...s, x: (s.x - minX) / span, y: (s.y - minY) / span,
    targetX: Number.isFinite(s.targetX) ? (s.targetX! - minX) / span : undefined,
    targetY: Number.isFinite(s.targetY) ? (s.targetY! - minY) / span : undefined }));
  const f = extractFeatures(points), response = bubbleResponse(points);
  const target = (s: PointerSample) => Number.isFinite(s.targetX) && Number.isFinite(s.targetY) && s.targetId !== undefined;
  const speeds: number[] = [], angular: number[] = [];
  let heading = 0, corrections = 0, pausedCorrections = 0, pursuit = 0, switches = 0, reacquisitions = 0, overshoots = 0, late = 0;
  let lastTurn = 0, priorDistance = Infinity;
  const initialCount = Math.max(1, p[0]!.bubbleCount ?? 1);
  for (let i = 1; i < points.length; i++) {
    const s = points[i]!, prev = points[i - 1]!, dt = (s.t - prev.t) / duration;
    const dx = s.x - prev.x, dy = s.y - prev.y, length = Math.hypot(dx, dy), angle = Math.atan2(dy, dx);
    const turn = Math.atan2(Math.sin(angle - heading), Math.cos(angle - heading));
    speeds.push(length / Math.max(1e-8, dt));
    if (i > 1) {
      angular.push(Math.abs(turn) / Math.max(1e-8, dt));
      if (turn * lastTurn < 0 && Math.abs(turn) > .1) { corrections++; if (s.t - prev.t > 160) pausedCorrections++; }
      if ((s.bubbleCount ?? initialCount) < initialCount / 2 && Math.abs(turn) > .5) late++;
    }
    if (target(s)) {
      const tx = s.targetX! - prev.x, ty = s.targetY! - prev.y, distance = Math.hypot(s.x - s.targetX!, s.y - s.targetY!);
      if (length > 1e-8 && Math.hypot(tx, ty) > 1e-8 && (dx * tx + dy * ty) / (length * Math.hypot(tx, ty)) > .6) pursuit++;
      if (target(prev) && s.targetId !== prev.targetId) switches++;
      if (distance < .13 && priorDistance >= .13) reacquisitions++;
      if (target(prev) && s.targetId === prev.targetId && (s.x - s.targetX!) * (prev.x - prev.targetX!) + (s.y - s.targetY!) * (prev.y - prev.targetY!) < 0) overshoots++;
      priorDistance = distance;
    }
    heading = angle; lastTurn = turn;
  }
  const n = Math.max(1, points.length - 1);
  out.reactionShare = p[0]!.t / Math.max(1, p.at(-1)!.t);
  out.cadenceCv = f.dtCv; out.decelerationShare = speeds.slice(1).filter((v, i) => v < speeds[i]!).length / Math.max(1, speeds.length - 1);
  out.angularVelocityP95 = percentile(angular, .95); out.burstShare = f.bursts / n;
  out.correctionPauseShare = pausedCorrections / Math.max(1, corrections); out.targetCoverage = response.samplesWithTargets / p.length;
  out.trackingErrorMean = response.trackingErrorMean ?? 0; out.trackingErrorP95 = response.trackingErrorP95 ?? 0;
  out.responseDelayShare = (response.responseMedianMs ?? 0) / duration; out.targetTurnRate = response.movingTargetTurns / n;
  out.pursuitShare = pursuit / n; out.targetSwitchRate = switches / n; out.reacquisitionShare = reacquisitions / n;
  out.overshootShare = overshoots / n; out.lateStrategyShare = late / n;
  // Clamp roundoff and pathological finite coordinates to the schema's bounds.
  return Object.fromEntries(EXPERIMENTAL_KEYS.map(k => [k, Number.isFinite(out[k]) ? Math.min(1e12, Math.max(0, Math.round(out[k] * 1e6) / 1e6)) : 0])) as ExperimentalFeatures;
}

export function acquisitionDiagnostics(samples: readonly PointerSample[]) {
  const gaps = samples.slice(1).map((s, i) => s.t - samples[i]!.t).filter(v => v > 0 && Number.isFinite(v));
  return { sampleCount: samples.length, medianGapMs: percentile(gaps, .5), meanGapMs: mean(gaps),
    targetCoverage: samples.filter(s => Number.isFinite(s.targetX) && Number.isFinite(s.targetY)).length / Math.max(1, samples.length),
    interpretation: "Capture diagnostics, excluded from the robust baseline; not operator identity" };
}
