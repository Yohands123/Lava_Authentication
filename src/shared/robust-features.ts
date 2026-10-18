import { percentile, type PointerSample } from "./features";
export const ROBUST_VERSION = "lava-robust-v2";
export const ROBUST_KEYS = ["efficiency", "pathLength", "speedCv", "speedP95", "accelP95", "jerkP95", "turnMean", "turnP95", "curvatureP95", "reversalRate", "correctionRate", "pauseShare"] as const;
export type RobustFeatures = Record<typeof ROBUST_KEYS[number], number>;
const average = (x: number[]) => x.reduce((a, b) => a + b, 0) / Math.max(1, x.length);
/** Fixed 64-point relative-time grid, span normalization, smoothing. Approximate
 * sampling invariance; cannot recover information lost to coarse acquisition. */
export function robustFeatures(input: readonly PointerSample[]): RobustFeatures {
  const out = Object.fromEntries(ROBUST_KEYS.map(k => [k, 0])) as RobustFeatures;
  const points = input.slice(0, 1024).filter(s => [s.x, s.y, s.t].every(Number.isFinite));
  if (points.length < 3 || points.some((s, i) => i > 0 && s.t <= points[i - 1]!.t)) return out;
  const start = points[0]!.t, duration = points.at(-1)!.t - start;
  if (duration <= 0) return out;
  const minX = Math.min(...points.map(s => s.x)), minY = Math.min(...points.map(s => s.y));
  const span = Math.hypot(Math.max(...points.map(s => s.x)) - minX, Math.max(...points.map(s => s.y)) - minY);
  if (span < 1e-8) return out;
  const grid: { x: number; y: number }[] = []; let cursor = 1;
  for (let i = 0; i < 64; i++) {
    const t = start + duration * i / 63;
    while (cursor < points.length - 1 && points[cursor]!.t < t) cursor++;
    const a = points[cursor - 1]!, b = points[cursor]!, w = (t - a.t) / (b.t - a.t);
    grid.push({ x: (a.x + (b.x - a.x) * w - minX) / span, y: (a.y + (b.y - a.y) * w - minY) / span });
  }
  const smooth = grid.map((s, i) => i === 0 || i === 63 ? s : { x: (grid[i - 1]!.x + 2 * s.x + grid[i + 1]!.x) / 4, y: (grid[i - 1]!.y + 2 * s.y + grid[i + 1]!.y) / 4 });
  const speed: number[] = [], headings: number[] = [], turns: number[] = [], curvature: number[] = [];
  for (let i = 1; i < smooth.length; i++) {
    const dx = smooth[i]!.x - smooth[i - 1]!.x, dy = smooth[i]!.y - smooth[i - 1]!.y;
    const step = Math.hypot(dx, dy);
    speed.push(step * 63); headings.push(Math.atan2(dy, dx)); out.pathLength += step;
    if (i > 1) {
      const turn = Math.atan2(Math.sin(headings.at(-1)! - headings.at(-2)!), Math.cos(headings.at(-1)! - headings.at(-2)!));
      turns.push(turn); curvature.push(Math.abs(turn) / Math.max(.001, step));
    }
  }
  const acceleration = speed.slice(1).map((s, i) => (s - speed[i]!) * 63);
  const jerk = acceleration.slice(1).map((a, i) => Math.abs(a - acceleration[i]!) * 63);
  const m = average(speed);
  out.efficiency = Math.min(1, Math.hypot(smooth.at(-1)!.x - smooth[0]!.x, smooth.at(-1)!.y - smooth[0]!.y) / Math.max(1e-8, out.pathLength));
  out.speedCv = m ? Math.sqrt(average(speed.map(s => (s - m) ** 2))) / m : 0;
  out.speedP95 = percentile(speed, .95); out.accelP95 = percentile(acceleration.map(Math.abs), .95);
  out.jerkP95 = percentile(jerk, .95); out.turnMean = average(turns.map(Math.abs)); out.turnP95 = percentile(turns.map(Math.abs), .95);
  out.curvatureP95 = percentile(curvature, .95); out.reversalRate = turns.filter(t => Math.abs(t) > 2).length / Math.max(1, turns.length);
  out.correctionRate = turns.filter((t, i) => i > 0 && t * turns[i - 1]! < 0 && Math.abs(t) > .1).length / Math.max(1, turns.length);
  out.pauseShare = speed.filter(s => s < m * .1).length / Math.max(1, speed.length);
  return Object.fromEntries(ROBUST_KEYS.map(k => [k, Number.isFinite(out[k]) ? Math.round(out[k] * 1e6) / 1e6 : 0])) as RobustFeatures;
}
export function parseRobust(value: unknown): RobustFeatures | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const f = value as Record<string, unknown>;
  if (Object.keys(f).length !== ROBUST_KEYS.length || ROBUST_KEYS.some(k => typeof f[k] !== "number" || !Number.isFinite(f[k]) || (f[k] as number) < 0 || (f[k] as number) > 1e12)) return null;
  for (const k of ["efficiency", "reversalRate", "correctionRate", "pauseShare"]) if ((f[k] as number) > 1) return null;
  return f as RobustFeatures;
}
