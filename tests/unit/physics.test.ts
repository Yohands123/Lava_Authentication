import { describe, expect, it } from "vitest";
import { LampPhysics } from "../../src/client/lamp/physics";
import { STIR } from "../../src/client/lamp/constants";

describe("keep-out ring", () => {
  it("clears the ring within a second and keeps it clear while stirring", () => {
    const p = new LampPhysics(13);
    p.resize(16 / 9, 1);
    const ring = { cx: p.width / 2, cy: 0.5, radius: 0.36 };
    // Start with every blob inside the ring.
    p.blobs.forEach((b, i) => {
      b.x = ring.cx + Math.cos(i) * 0.1;
      b.y = ring.cy + Math.sin(i) * 0.1;
    });
    p.keepOut = ring;
    const inside = () =>
      p.blobs.filter((b) => Math.hypot(b.x - ring.cx, b.y - ring.cy) < ring.radius + b.r * STIR.RING_CLEARANCE - 0.01);

    for (let i = 0; i < 60; i++) p.step(1 / 60);
    expect(inside()).toHaveLength(0);

    // Stir hard straight through the middle; the ring stays clear.
    for (let i = 0; i < 180; i++) {
      p.stir(ring.cx + Math.sin(i / 10) * 0.3, ring.cy, 1.5, 0.4, 1 / 60);
      p.step(1 / 60);
    }
    expect(inside()).toHaveLength(0);
  });

  it("lets the wax back in once released", () => {
    const p = new LampPhysics(13);
    p.resize(16 / 9, 1);
    p.keepOut = null;
    p.formation = { kind: "point", cx: p.width / 2, cy: 0.5, spread: 0.05 };
    for (let i = 0; i < 300; i++) p.step(1 / 60);
    const near = p.blobs.filter((b) => Math.hypot(b.x - p.width / 2, b.y - 0.5) < 0.2);
    expect(near.length).toBeGreaterThan(0);
  });
});
