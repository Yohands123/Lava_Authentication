// Clear the ring: at sign-in the wax gathers inside the entropy ring and the
// user must stir it all back out before Sign in appears. Wax inside is held
// (no buoyancy, no wander, thick), so only stirring moves it; wax that is out
// stays out. This is a ritual, not a security check: the passkey's user
// verification is what proves a person is present.

import { STIR } from "./constants";
import type { Blob } from "./physics";

export type RingPhase = "gather" | "clear";

export class RingField {
  cx = 0;
  cy = 0;
  radius = 0;
  phase: RingPhase = "gather";
  private elapsed = 0;
  private readonly out = new WeakSet<Blob>();

  setGeometry(cx: number, cy: number, radius: number): void {
    this.cx = cx;
    this.cy = cy;
    this.radius = radius;
  }

  /** Inside wax that the user still has to push out. */
  isHeld(b: Blob): boolean {
    return this.phase === "clear" && !this.out.has(b);
  }

  isOut(b: Blob): boolean {
    return this.out.has(b);
  }

  /** Advance the phase and mark blobs that have been pushed fully out. */
  update(blobs: readonly Blob[], dt: number): void {
    this.elapsed += dt;
    if (this.phase === "gather") {
      const allIn = blobs.every((b) => b.fizzle || this.distance(b) < this.radius - b.r * 0.3);
      if (allIn || this.elapsed > STIR.RING_GATHER_SECONDS) this.phase = "clear";
      return;
    }
    for (const b of blobs) {
      if (!this.out.has(b) && this.distance(b) >= this.minDistance(b)) this.out.add(b);
    }
  }

  /** Wax that is out stays out: ease it back and cancel inward motion. */
  constrain(b: Blob, dt: number): void {
    if (!this.out.has(b)) return;
    const dx = b.x - this.cx;
    const dy = b.y - this.cy;
    const d = Math.hypot(dx, dy);
    const min = this.minDistance(b);
    if (d >= min) return;
    const nx = d > 1e-4 ? dx / d : 0;
    const ny = d > 1e-4 ? dy / d : 1;
    const ease = 1 - Math.exp(-STIR.RING_PUSH_RATE * dt);
    b.x += nx * (min - d) * ease;
    b.y += ny * (min - d) * ease;
    const inward = b.vx * nx + b.vy * ny;
    if (inward < 0) {
      b.vx -= inward * nx;
      b.vy -= inward * ny;
    }
  }

  /** Share of the wax (by area) that is out of the ring, 0..1. */
  progress(blobs: readonly Blob[]): number {
    if (this.phase === "gather") return 0;
    let total = 0;
    let out = 0;
    for (const b of blobs) {
      if (b.fizzle) continue;
      total += b.r * b.r;
      if (this.out.has(b)) out += b.r * b.r;
    }
    return total > 0 ? out / total : 1;
  }

  isClear(blobs: readonly Blob[]): boolean {
    return this.phase === "clear" && blobs.every((b) => b.fizzle || this.out.has(b));
  }

  private distance(b: Blob): number {
    return Math.hypot(b.x - this.cx, b.y - this.cy);
  }

  private minDistance(b: Blob): number {
    return this.radius + b.r * STIR.RING_CLEARANCE;
  }
}
