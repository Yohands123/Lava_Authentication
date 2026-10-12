import { describe, expect, it } from "vitest";
import { StirMeter, type StirSample } from "../../src/client/stir/health";
import { STIR } from "../../src/client/lamp/constants";

const sample = (dx: number, dy: number, dt: number, trusted = true): StirSample => ({
  dx, dy, dt, pressure: 0.5, tiltX: 0, tiltY: 0, trusted,
});

/** A wobbly, human-ish curve with jittery timing (deterministic for tests). */
function humanPath(n: number): StirSample[] {
  const out: StirSample[] = [];
  for (let i = 0; i < n; i++) {
    const a = i * 0.21 + Math.sin(i * 0.7) * 0.6;
    const speed = 6 + Math.sin(i * 0.37) * 3;
    out.push(sample(Math.cos(a) * speed, Math.sin(a) * speed, 8 + ((i * 7) % 5) * 0.3));
  }
  return out;
}

describe("StirMeter", () => {
  it("credits human-like motion", () => {
    const meter = new StirMeter();
    humanPath(80).forEach((s, i) => meter.accept(s, i * 10));
    expect(meter.credited).toBeGreaterThan(0);
  });

  it("credits nothing for a straight line", () => {
    const meter = new StirMeter();
    for (let i = 0; i < 100; i++) meter.accept(sample(5, 0, 8 + (i % 3) * 0.4), i * 10);
    expect(meter.credited).toBe(0);
  });

  it("credits nothing for a scripted circle at constant speed and timing", () => {
    const meter = new StirMeter();
    for (let i = 0; i < 100; i++) {
      const a = i * 0.1;
      meter.accept(sample(Math.cos(a) * 5, Math.sin(a) * 5, 8 + (i % 2) * 0.5), i * 10);
    }
    expect(meter.credited).toBe(0);
  });

  it("rejects untrusted and still samples", () => {
    const meter = new StirMeter();
    expect(meter.accept(sample(3, 4, 8, false), 0)).toBe("untrusted");
    expect(meter.accept(sample(0, 0, 8), 0)).toBe("still");
  });

  it("rejects long runs of identical timing", () => {
    const meter = new StirMeter();
    const results = humanPath(40).map((s, i) => meter.accept({ ...s, dt: 8 }, i * 10));
    expect(results.slice(STIR.MAX_REPEATED_DT + 1).every((r) => r === "repeated-timing")).toBe(true);
  });

  it("caps credit per second", () => {
    const meter = new StirMeter();
    humanPath(500).forEach((s) => meter.accept(s, 0)); // all in the same instant
    expect(meter.credited).toBeLessThanOrEqual(STIR.MAX_BITS_PER_SECOND);
  });

  it("skip fills the meter", () => {
    const meter = new StirMeter();
    meter.fill();
    expect(meter.complete).toBe(true);
  });
});
