import type { PointerSample } from "./features";
/** Event-based target switches, separate from the unchanged response-v3 vector. */
export const DYNAMIC_VERSION = "lava-dynamic-response-v4";
export const DYNAMIC_KEYS = ["targetCoverage", "switchCount", "switchResponseShare", "medianResponseFraction", "reacquisitionShare", "unansweredSwitchShare"] as const;
export type DynamicResponse = Record<typeof DYNAMIC_KEYS[number], number>;
export function dynamicResponse(input: readonly PointerSample[]): DynamicResponse {
  const out = Object.fromEntries(DYNAMIC_KEYS.map(k => [k, 0])) as DynamicResponse, p = input.slice(0, 1024);
  if (p.length < 3 || p.some((v, i) => ![v.x, v.y, v.t].every(n => Number.isFinite(n) && Math.abs(n) <= 1e12) || i > 0 && v.t <= p[i-1]!.t)) return out;
  const target = (s: PointerSample) => [s.targetX, s.targetY, s.targetId].every(n => typeof n === "number" && Number.isFinite(n) && Math.abs(n) <= 1e12);
  out.targetCoverage = p.filter(target).length / p.length;
  const duration = Math.max(1, p.at(-1)!.t - p[0]!.t), delays: number[] = [];
  let pending: { t: number; id: number; distance: number } | null = null, acquired = 0;
  for (let i = 1; i < p.length; i++) {
    const a = p[i-1]!, b = p[i]!; if (!target(a) || !target(b)) { pending = null; continue; }
    if (b.targetId !== a.targetId) {
      out.switchCount++;
      pending = { t: b.t, id: b.targetId!, distance: Math.hypot(b.x-b.targetX!, b.y-b.targetY!) };
    } else if (pending && pending.id === b.targetId) {
      const distance = Math.hypot(b.x-b.targetX!, b.y-b.targetY!);
      const dx = b.x-a.x, dy = b.y-a.y, tx = b.targetX!-a.x, ty = b.targetY!-a.y;
      // Require a subsequent observation steering toward the same declared target.
      if (distance < pending.distance && dx*tx + dy*ty > 0) { delays.push((b.t-pending.t)/duration); if (distance < .13) acquired++; pending = null; }
    }
  }
  delays.sort((a,b) => a-b);
  out.switchResponseShare = delays.length / Math.max(1, out.switchCount);
  out.medianResponseFraction = delays.length ? delays[Math.floor((delays.length-1)/2)]! : 0;
  out.reacquisitionShare = acquired / Math.max(1, out.switchCount);
  out.unansweredSwitchShare = out.switchCount ? 1-out.switchResponseShare : 0;
  return out;
}
