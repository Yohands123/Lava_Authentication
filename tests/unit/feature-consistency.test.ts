import { describe, expect, it } from "vitest";
import { extractFeatures, type PointerSample } from "../../src/shared/features";
import { FEATURE_VERSION, type Features } from "../../src/shared/lavaguard";
import { consistentFeatures } from "../../src/shared/feature-consistency";
import { parseSummary } from "../../src/worker/guard/LavaDetector";

const path = (count = 40): PointerSample[] => Array.from({ length: count }, (_, i) => ({
  x: Math.sin(i * .4), y: Math.cos(i * .3), t: 100 + i * 32,
  pressure: .5, bubbleDistance: i % 3 ? .05 : .4, bubbleCount: 8 - Math.floor(i / 8),
}));
const parse = (features: Features) => parseSummary({ version: FEATURE_VERSION, features,
  fingerprint: "f".repeat(43), geometryHash: "g".repeat(43), signals: { webdriver: true } });

describe("necessary feature relationships, without operator classification", () => {
  it.each([
    { speedP50: 2, speedP95: 1 }, { dtP50: 50, dtP95: 32 },
    { clockQuantumMs: 100 }, { pressurePresent: .5 },
    { pressurePresent: 0, pressureRange: .1 },
    { headingChangeMean: 4 }, { invalidTiming: 40 }, { bursts: 40 },
    { bubbleChases: 40 }, { bubbleMisses: 40 }, { reversals: 39 },
    { corrections: 39 }, { overshoots: 39 }, { strategyChanges: 39 },
    { reversals: 0, overshoots: 1 }, { bubbleDisplacements: 0, strategyChanges: 1 },
    { bubbleEncounters: 21 }, { bubbleEncounters: 0, firstEncounterMs: 100 },
  ])("rejects contradictory aggregates %j", changes => {
    expect(parse({ ...extractFeatures(path()), ...changes })).toBeNull();
  });
  it("rejects movement claims with no valid intervals", () => {
    const f = extractFeatures(path(1));
    expect(parse({ ...f, durationMs: 100 })).toBeNull();
    expect(parse({ ...f, pathLength: 1 })).toBeNull();
    expect(parse({ ...f, pressureRange: .1 })).toBeNull();
    const invalid = extractFeatures(path().map(p => ({ ...p, t: 100 })));
    expect(parse(invalid)).not.toBeNull();
    expect(parse({ ...invalid, speedP50: 1, speedP95: 1 })).toBeNull();
  });
  it("preserves the extractor's rounding boundary", () => {
    const f = extractFeatures(path());
    expect(consistentFeatures({ ...f, speedP50: f.speedP95 + .000001 })).toBe(true);
    expect(consistentFeatures({ ...f, dtP50: f.dtP95 + .000001 })).toBe(true);
    // Positive displacement can round to zero while efficiency remains positive.
    expect(parse(extractFeatures([{ x: 0, y: 0, t: 100 }, { x: 1e-9, y: 0, t: 132 }]))).not.toBeNull();
  });
  it("accepts generated valid mouse, touch and pen summaries, including coarse clocks and pauses", () => {
    // All paths are explicitly synthetic fixtures; none are human participants.
    for (const count of [1, 2, 3, 12, 40, 128, 1024]) {
      for (const pointer of ["mouse", "touch", "pen"] as const) {
        for (const clock of ["ordinary", "coarse", "pause", "invalid"] as const) {
          const samples = path(count).map((p, i) => ({ ...p, pointer,
            bubbleCount: Math.max(0, p.bubbleCount!),
            t: clock === "coarse" ? Math.round(p.t / 100) * 100 : clock === "pause" ? p.t + (i > count / 2 ? 70000 : 0) : clock === "invalid" ? 100 : p.t }));
          expect(parse(extractFeatures(samples)), `${pointer}/${clock}/${count}`).not.toBeNull();
        }
      }
    }
  });
});
