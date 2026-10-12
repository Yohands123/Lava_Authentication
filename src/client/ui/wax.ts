// What the wax does for each auth event (CLAUDE.md section 9). Every event
// that shows a message also gets one of these, so nothing is text-only.

import type { Lamp } from "../lamp/lamp";
import { LAMP } from "../lamp/constants";
import { ApiError } from "../auth/api";
import { prefersReducedMotion } from "../a11y/motion";

/** Dim level while the camera lens is covered. */
const COVERED_DIM = 0.45;

export class Wax {
  constructor(
    private readonly lamp: Lamp | null,
    /** True while an enabled camera reports a covered lens. */
    private readonly cameraCovered: () => boolean,
  ) {}

  private get centre() {
    const p = this.lamp!.physics;
    return { cx: p.width / 2, cy: p.height / 2 };
  }

  /** Enter, ring complete: blobs ease toward the centre for a moment. */
  gather(ms = 1400): void {
    const lamp = this.lamp;
    if (!lamp) return;
    lamp.physics.formation = { kind: "point", ...this.centre, spread: 0.18 };
    window.setTimeout(() => {
      if (lamp.physics.formation?.kind === "point") lamp.physics.formation = null;
    }, ms);
  }

  /** Sign up started: blobs gather into a glowing ring. */
  portal(): void {
    if (!this.lamp) return;
    const p = this.lamp.physics;
    p.formation = { kind: "ring", ...this.centre, radius: Math.min(p.width, p.height) * 0.26 };
  }

  release(): void {
    if (this.lamp) this.lamp.physics.formation = null;
  }

  /** Passkey created: the portal bursts (a glow alone under reduced motion). */
  burst(): void {
    if (!prefersReducedMotion()) this.lamp?.physics.burst();
  }

  /** Signed in: the whole lamp warms, then settles to a gentle glow. */
  warmUp(): void {
    const lamp = this.lamp;
    if (!lamp) return;
    lamp.glowTarget = 1;
    window.setTimeout(() => (lamp.glowTarget = 0.35), 2600);
  }

  /** Signed out: the warmth fades. */
  coolDown(): void {
    if (this.lamp) this.lamp.glowTarget = 0;
  }

  /** A failed attempt: a droplet fizzles and the lamp dips. Rate limits dim slowly instead. */
  fail(err: unknown): void {
    const lamp = this.lamp;
    if (!lamp) return;
    this.release();
    if (err instanceof ApiError && err.code === "rate_limited") {
      // No droplet: the lamp dims slowly and stays dim while you wait.
      const seconds = Math.min(err.retryAfter ?? 60, LAMP.RATE_LIMIT_DIM_MAX_SECONDS);
      lamp.dimEase = LAMP.SLOW_DIM_EASE;
      lamp.dimTarget = LAMP.RATE_LIMIT_DIM;
      window.setTimeout(() => {
        lamp.dimTarget = this.restingDim();
        window.setTimeout(() => (lamp.dimEase = LAMP.VISUAL_EASE), 4000);
      }, seconds * 1000);
      return;
    }
    lamp.physics.drop(true);
    lamp.dimTarget = 0.4;
    window.setTimeout(() => (lamp.dimTarget = this.restingDim()), 1800);
  }

  /** Bad input or a rejected source: one droplet fizzles instead of merging. */
  fizzle(): void {
    this.lamp?.physics.drop(true);
  }

  /** Your entropy joining the lamp: a droplet melts in. */
  melt(): void {
    this.lamp?.physics.drop(false);
  }

  /** Camera covered: the lamp dims until the lens is clear. */
  cameraHealth(): void {
    if (this.lamp) this.lamp.dimTarget = this.restingDim();
  }

  private restingDim(): number {
    return this.cameraCovered() ? COVERED_DIM : 0;
  }
}
