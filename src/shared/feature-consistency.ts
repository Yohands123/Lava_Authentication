import type { Features } from "./lavaguard";

/** Necessary relationships guaranteed by the v1 extractor, not human traits.
 * Inputs have already passed finite/nonnegative/integer/ratio validation.
 * Passing these checks cannot attest that any pointer events occurred.
 */
export function consistentFeatures(f: Features): boolean {
  const transitions = f.samples - 1, turns = Math.max(0, transitions - 1);
  // The extractor rounds each feature independently to six decimal places.
  const tolerance = 0.000002;
  if (f.speedP50 > f.speedP95 + tolerance || f.dtP50 > f.dtP95 + tolerance) return false;
  if (f.clockQuantumMs > f.dtP50 + tolerance) return false;
  if (f.pressurePresent !== 0 && f.pressurePresent !== 1) return false;
  if (!f.pressurePresent && f.pressureRange !== 0) return false;
  if (f.headingChangeMean > Math.PI + tolerance) return false;
  if ([f.invalidTiming, f.bursts, f.bubbleChases, f.bubbleMisses].some(n => n > transitions)) return false;
  if ([f.reversals, f.corrections, f.overshoots, f.strategyChanges].some(n => n > turns)) return false;
  if (f.overshoots > f.reversals || f.strategyChanges > f.bubbleDisplacements) return false;
  if (f.bubbleEncounters > Math.ceil(f.samples / 2)) return false;
  if (!f.bubbleEncounters && f.firstEncounterMs !== 0) return false;
  if (f.samples === 1 && (f.durationMs !== 0 || f.pressureRange !== 0)) return false;
  // With no valid intervals, the extractor cannot compute movement derivatives.
  if (f.invalidTiming === transitions) {
    const intervalFeatures = [f.pathLength, f.speedP50, f.speedP95, f.speedCv,
      f.accelP95, f.decelP95, f.jerkP95, f.angularP95, f.curvatureP95,
      f.headingChangeMean, f.dtP50, f.dtP95, f.dtCv, f.pauseRatio, f.clockQuantumMs];
    if (intervalFeatures.some(value => value !== 0)) return false;
  }
  return true;
}
