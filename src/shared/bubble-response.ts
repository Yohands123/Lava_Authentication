import { percentile, type PointerSample } from "./features";

/** Local research evidence only. Target positions are untrusted client physics. */
export function bubbleResponse(samples: readonly PointerSample[]) {
  const errors: number[] = [], latencies: number[] = [];
  let displacements = 0, directionChanges = 0, corrections = 0, lastEvent = -Infinity;
  const target = (s: PointerSample) => Number.isFinite(s.targetX) && Number.isFinite(s.targetY) && s.targetId !== undefined;
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i]!;
    if (!target(s)) continue;
    errors.push(Math.hypot(s.x - s.targetX!, s.y - s.targetY!));
    if (i < 2) continue;
    const prev = samples[i - 1]!, before = samples[i - 2]!;
    if (!target(prev) || !target(before) || prev.targetId !== s.targetId || before.targetId !== s.targetId) continue;
    const move = { x: s.targetX! - prev.targetX!, y: s.targetY! - prev.targetY! };
    const prior = { x: prev.targetX! - before.targetX!, y: prev.targetY! - before.targetY! };
    const magnitude = Math.hypot(move.x, move.y), priorMagnitude = Math.hypot(prior.x, prior.y);
    const turn = magnitude > .002 && priorMagnitude > .002 && (move.x * prior.x + move.y * prior.y) / (magnitude * priorMagnitude) < .5;
    if ((magnitude < .04 && !turn) || s.t - lastEvent < 200) continue;
    lastEvent = s.t;
    if (magnitude >= .04) displacements++;
    if (turn) directionChanges++;
    const oldHeading = Math.atan2(prev.y - before.y, prev.x - before.x);
    for (let j = i + 1; j < samples.length; j++) {
      const next = samples[j]!, last = samples[j - 1]!;
      if (next.t - s.t > 1000 || next.targetId !== s.targetId) break;
      const dx = next.x - last.x, dy = next.y - last.y, speed = Math.hypot(dx, dy);
      const tx = next.targetX! - last.x, ty = next.targetY! - last.y, distance = Math.hypot(tx, ty);
      const headingChange = Math.abs(Math.atan2(Math.sin(Math.atan2(dy, dx) - oldHeading), Math.cos(Math.atan2(dy, dx) - oldHeading)));
      if (speed > .001 && distance > .001 && (dx * tx + dy * ty) / (speed * distance) > .6 && headingChange > .2) {
        corrections++; latencies.push(next.t - s.t); break;
      }
    }
  }
  return { version: "lava-bubble-response-v1", samplesWithTargets: errors.length, displacementEvents: displacements,
    movingTargetTurns: directionChanges, postEventCorrections: corrections, responseN: latencies.length,
    responseMedianMs: latencies.length ? percentile(latencies, .5) : null,
    trackingErrorMean: errors.length ? errors.reduce((a, b) => a + b, 0) / errors.length : null,
    trackingErrorP95: errors.length ? percentile(errors, .95) : null };
}
