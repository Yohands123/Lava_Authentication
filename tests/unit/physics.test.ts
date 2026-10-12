import { describe, expect, it } from "vitest";
import { LampPhysics } from "../../src/client/lamp/physics";

const STEP = 1 / 60;

function lampWithRing(heatScale = 1) {
  const p = new LampPhysics(13);
  p.resize(16 / 9, 1);
  p.heatScale = heatScale;
  const ring = { cx: p.width / 2, cy: 0.5, radius: 0.36 };
  p.beginRing(ring.cx, ring.cy, ring.radius);
  // Let the wax gather in.
  for (let i = 0; i < 60 * 4 && p.ring!.phase === "gather"; i++) p.step(STEP);
  return { p, ring };
}

/** Curved, irregular strokes that sweep through the ring and outward. */
function stirOut(p: LampPhysics, ring: { cx: number; cy: number; radius: number }, seconds: number) {
  for (let i = 0; i < seconds * 60 && !p.ring!.isClear(p.blobs); i++) {
    const a = i * 0.11;
    const r = ring.radius * (0.2 + 0.9 * Math.abs(Math.sin(i * 0.037)));
    const x = ring.cx + Math.cos(a) * r;
    const y = ring.cy + Math.sin(a * 1.3) * r;
    p.stir(x, y, Math.cos(a) * 1.6, Math.sin(a) * 1.6, STEP);
    p.step(STEP);
  }
}

describe("clear the ring", () => {
  it("gathers the wax into the ring before stirring starts", () => {
    const { p } = lampWithRing();
    expect(p.ring!.phase).toBe("clear");
    expect(p.ring!.progress(p.blobs)).toBeLessThan(0.2);
  });

  it("holds the wax in the ring when nobody stirs (it can't float out on its own)", () => {
    const { p } = lampWithRing();
    const before = p.ring!.progress(p.blobs);
    for (let i = 0; i < 60 * 30; i++) p.step(STEP);
    expect(p.ring!.isClear(p.blobs)).toBe(false);
    expect(p.ring!.progress(p.blobs)).toBeLessThanOrEqual(before + 0.05);
  });

  it("can be cleared by stirring, and wax that is out stays out", () => {
    const { p, ring } = lampWithRing();
    stirOut(p, ring, 40);
    expect(p.ring!.isClear(p.blobs)).toBe(true);
    for (let i = 0; i < 60 * 10; i++) p.step(STEP);
    expect(p.ring!.isClear(p.blobs)).toBe(true);
  });

  it("can still be cleared with the lamp frozen", () => {
    const { p, ring } = lampWithRing(0);
    stirOut(p, ring, 60);
    expect(p.ring!.isClear(p.blobs)).toBe(true);
  });

  it("frees the wax when the ring ends", () => {
    const { p } = lampWithRing();
    p.endRing();
    expect(p.ring).toBeNull();
  });
});
