import { describe, expect, it } from "vitest";
import { isCovered, lumaStats } from "../../src/client/entropy/camera";

const rgba = (n: number, px: (i: number) => number) => {
  const out = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) {
    const v = px(i);
    out.set([v, v, v, 255], i * 4);
  }
  return out;
};

describe("camera health", () => {
  it("flags a black (covered) frame", () => {
    expect(isCovered(lumaStats(rgba(1000, () => 2)))).toBe(true);
  });

  it("flags a flat grey fake feed", () => {
    expect(isCovered(lumaStats(rgba(1000, () => 128)))).toBe(true);
  });

  it("passes a frame with real variation", () => {
    expect(isCovered(lumaStats(rgba(1000, (i) => (i * 37) % 200)))).toBe(false);
  });

  it("computes luma mean and variance", () => {
    const stats = lumaStats(rgba(2, (i) => (i === 0 ? 0 : 100)));
    expect(stats.mean).toBeCloseTo(100 * (0.299 + 0.587 + 0.114) / 2, 5);
    expect(stats.variance).toBeCloseTo(2500, 3);
  });
});
