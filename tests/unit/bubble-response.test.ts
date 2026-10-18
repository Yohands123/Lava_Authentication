import { describe, expect, it } from "vitest";
import { bubbleResponse } from "../../src/shared/bubble-response";
import type { PointerSample } from "../../src/shared/features";

describe("research target response", () => {
  it("does not manufacture timing evidence from missing targets or nearest-target switches", () => {
    const empty = bubbleResponse([{ x: 0, y: 0, t: 0 }]);
    expect(empty.responseMedianMs).toBeNull(); expect(empty.trackingErrorMean).toBeNull();
    const switched = bubbleResponse(Array.from({ length: 10 }, (_, i) => ({ x: .5, y: .5, t: i * 32, targetId: i, targetX: i % 2, targetY: .5 })));
    expect(switched.displacementEvents).toBe(0); expect(switched.postEventCorrections).toBe(0);
  });
  it("measures a known delayed direction correction without calling it human", () => {
    const samples: PointerSample[] = [
      { x: 0, y: 0, t: 0 }, { x: .1, y: 0, t: 100 }, { x: .2, y: 0, t: 200 },
      { x: .3, y: 0, t: 300 }, { x: .3, y: .1, t: 400 },
    ].map((s, i) => ({ ...s, targetId: 1, targetX: .4, targetY: i < 2 ? 0 : .6 }));
    const response = bubbleResponse(samples);
    expect(response.displacementEvents).toBe(1); expect(response.postEventCorrections).toBe(1);
    expect(response.responseMedianMs).toBe(200);
    expect(response.trackingErrorMean).toBeGreaterThan(0);
  });
});
