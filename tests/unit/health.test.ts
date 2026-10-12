import { describe, expect, it } from "vitest";
import { emptyStats, healthReport, presentSources } from "../../src/worker/entropy/stats";

const stats = emptyStats();

describe("health report", () => {
  it("reports zero shares before any challenge is issued", () => {
    expect(healthReport(stats).clientDigests).toEqual({ stir: 0, lamp: 0, camera: 0 });
  });

  it("reports real counts and digest shares", () => {
    const report = healthReport({ ...stats, issued: 200, expired: 12, unknown: 3, withStir: 150, withLamp: 198, withCamera: 0 });
    expect(report).toEqual({
      secureGenerator: "ok",
      challengesIssued: 200,
      challengesRejected: { expired: 12, reused: 3 },
      clientDigests: { stir: 0.75, lamp: 0.99, camera: 0 },
    });
  });
});

describe("presentSources", () => {
  it("lists only the digests that were sent", () => {
    const d = new Uint8Array(32);
    expect(presentSources({ stir: d, lamp: null, camera: d })).toEqual(["stir", "camera"]);
    expect(presentSources({ stir: null, lamp: null, camera: null })).toEqual([]);
  });
});
