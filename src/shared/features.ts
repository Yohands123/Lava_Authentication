import { FEATURE_KEYS, type Features } from "./lavaguard";

/** Coordinates normalized to the ring diameter, time relative to challenge start. */
export interface PointerSample {
  x: number; y: number; t: number;
  pressure?: number;
  pointer?: "mouse" | "touch" | "pen";
  trusted?: boolean;
  coalesced?: boolean;
  bubbleDistance?: number;
  bubbleCount?: number;
  /** Ephemeral target observations, used only by local research/export. */
  targetX?: number;
  targetY?: number;
  targetId?: number;
}
const mean = (a: number[]) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
const cv = (a: number[]) => { const m = mean(a); return m ? Math.sqrt(mean(a.map(x => (x - m) ** 2))) / m : 0; };
export function percentile(values: number[], q: number): number {
  if (!values.length) return 0;
  const a = [...values].sort((x, y) => x - y), i = (a.length - 1) * q;
  return a[Math.floor(i)]! + (a[Math.ceil(i)]! - a[Math.floor(i)]!) * (i % 1);
}
const angleDiff = (a: number, b: number) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

/** Same extractor is used by browser capture, offline datasets and attack evaluation. */
export function extractFeatures(input: readonly PointerSample[]): Features {
  const f = Object.fromEntries(FEATURE_KEYS.map(k => [k, 0])) as Features;
  const samples = input.slice(0, 1024).filter(s => [s.x, s.y, s.t].every(Number.isFinite));
  f.samples = samples.length;
  if (!samples.length) return f;
  f.reactionMs = Math.max(0, samples[0]!.t);
  const dt: number[] = [], speeds: number[] = [], accel: number[] = [], decel: number[] = [];
  const jerk: number[] = [], angles: number[] = [], angular: number[] = [], curve: number[] = [], changes: number[] = [];
  let prevSpeed = 0, prevAccel = 0, prevAngle: number | null = null, prevTurn = 0, wasPaused = true;
  let near = false, firstEncounter = false, priorCount = samples[0]!.bubbleCount;
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i]!;
    f.touchRatio += Number(s.pointer === "touch"); f.penRatio += Number(s.pointer === "pen");
    f.untrustedRatio += Number(s.trusted === false); f.coalescedRatio += Number(s.coalesced === true);
    if (s.bubbleDistance !== undefined) {
      const close = s.bubbleDistance < 0.13;
      if (close && !near) { f.bubbleEncounters++; if (!firstEncounter) { f.firstEncounterMs = Math.max(0, s.t); firstEncounter = true; } }
      if (close && near && i && s.bubbleDistance < (samples[i - 1]!.bubbleDistance ?? 1)) f.bubbleChases++;
      if (!close && near && s.bubbleCount === priorCount) f.bubbleMisses++;
      near = close;
    }
    if (s.bubbleCount !== undefined && priorCount !== undefined && s.bubbleCount < priorCount) f.bubbleDisplacements += priorCount - s.bubbleCount;
    priorCount = s.bubbleCount;
    if (!i) continue;
    const p = samples[i - 1]!, ms = s.t - p.t;
    if (ms <= 0 || ms > 60000) { f.invalidTiming++; continue; }
    const dx = s.x - p.x, dy = s.y - p.y, distance = Math.hypot(dx, dy), seconds = ms / 1000;
    dt.push(ms); f.pathLength += distance;
    const speed = distance / seconds;
    speeds.push(speed);
    const a = (speed - prevSpeed) / seconds;
    (a >= 0 ? accel : decel).push(Math.abs(a));
    jerk.push(Math.abs(a - prevAccel) / seconds);
    const paused = ms > 160 || speed < 0.015;
    f.pauseRatio += Number(paused);
    if (!paused && wasPaused) f.bursts++;
    wasPaused = paused;
    if (distance > 1e-6) {
      const angle = Math.atan2(dy, dx); angles.push(angle);
      if (prevAngle !== null) {
        const turn = angleDiff(angle, prevAngle);
        changes.push(Math.abs(turn)); angular.push(Math.abs(turn) / seconds); curve.push(Math.abs(turn) / distance);
        if (Math.abs(turn) > Math.PI * 0.6) { f.reversals++; if (near) f.overshoots++; }
        if (turn * prevTurn < 0 && Math.abs(turn) > 0.1) f.corrections++;
        prevTurn = turn;
      }
      prevAngle = angle;
    }
    prevSpeed = speed; prevAccel = a;
  }
  f.durationMs = Math.max(0, samples.at(-1)!.t - samples[0]!.t);
  f.efficiency = f.pathLength ? Math.min(1, Math.hypot(samples.at(-1)!.x - samples[0]!.x, samples.at(-1)!.y - samples[0]!.y) / f.pathLength) : 0;
  f.speedP50 = percentile(speeds, 0.5); f.speedP95 = percentile(speeds, 0.95); f.speedCv = cv(speeds);
  f.accelP95 = percentile(accel, 0.95); f.decelP95 = percentile(decel, 0.95); f.jerkP95 = percentile(jerk, 0.95);
  f.angularP95 = percentile(angular, 0.95); f.curvatureP95 = percentile(curve, 0.95); f.headingChangeMean = mean(changes);
  f.dtP50 = percentile(dt, 0.5); f.dtP95 = percentile(dt, 0.95); f.dtCv = cv(dt); f.clockQuantumMs = dt.length ? Math.min(...dt) : 0;
  f.pauseRatio /= Math.max(1, dt.length);
  for (const k of ["touchRatio", "penRatio", "untrustedRatio", "coalescedRatio"] as const) f[k] /= samples.length;
  const pressure = samples.flatMap(s => s.pressure === undefined ? [] : [s.pressure]);
  f.pressurePresent = Number(pressure.length > 0); f.pressureRange = pressure.length ? Math.max(...pressure) - Math.min(...pressure) : 0;
  // Strategy changes are coarse heading changes after wax count changes, not a human label.
  f.strategyChanges = Math.min(f.bubbleDisplacements, changes.filter(v => v > 0.5).length);
  for (const k of FEATURE_KEYS) f[k] = Number(f[k].toFixed(6));
  return f;
}

export function trajectorySignature(samples: readonly PointerSample[], geometryOnly = false): string {
  const origin = samples[0];
  if (!origin) return "empty";
  // Relative geometry reduces coordinate leakage; hashes expire with the browser context.
  return samples.filter((_, i) => i % 4 === 0).map(s => [
    Math.round((s.x - origin.x) * 128), Math.round((s.y - origin.y) * 128),
    ...(geometryOnly ? [] : [Math.round((s.t - origin.t) / 16)]),
  ].join(",")).join(";");
}
