// Conservative crediting for Stir the Lamp. These counts are a UX meter, not a
// formal entropy measurement (CLAUDE.md section 7.3). Pure logic, unit tested.

import { STIR } from "../lamp/constants";

export interface StirSample {
  dx: number;
  dy: number;
  /** Time since the previous sample, ms. */
  dt: number;
  pressure: number;
  tiltX: number;
  tiltY: number;
  trusted: boolean;
}

export type RejectReason = "untrusted" | "still" | "repeated-timing" | "too-regular" | "rate-cap" | "warming-up";

export class StirMeter {
  credited = 0;
  /** Consecutive "too-regular" rejections, used to show "Too regular, keep stirring." */
  regularStreak = 0;
  private angles: number[] = [];
  private steps: number[] = [];
  private lastDt = -1;
  private repeatedDt = 0;
  private windowStart = 0;
  private windowBits = 0;

  get progress(): number {
    return Math.min(1, this.credited / STIR.TARGET_BITS);
  }

  get complete(): boolean {
    return this.credited >= STIR.TARGET_BITS;
  }

  /** Returns 1 if the sample earned a bit, otherwise the reason it didn't. */
  accept(s: StirSample, now: number): 1 | RejectReason {
    if (!s.trusted) return "untrusted";
    if (s.dx === 0 && s.dy === 0) return "still";

    if (s.dt === this.lastDt) {
      this.repeatedDt++;
      if (this.repeatedDt > STIR.MAX_REPEATED_DT) return "repeated-timing";
    } else {
      this.repeatedDt = 0;
    }
    this.lastDt = s.dt;

    this.angles.push(Math.atan2(s.dy, s.dx));
    // Step length, not speed: a script can vary its timing but rarely its stride.
    this.steps.push(Math.hypot(s.dx, s.dy));
    if (this.angles.length > STIR.DIRECTION_WINDOW + 1) this.angles.shift();
    if (this.steps.length > STIR.DIRECTION_WINDOW) this.steps.shift();
    if (this.angles.length <= STIR.DIRECTION_WINDOW) return "warming-up";

    if (isTooRegular(this.angles, this.steps)) {
      this.regularStreak++;
      return "too-regular";
    }
    this.regularStreak = 0;
    return this.credit(now, STIR.MAX_BITS_PER_SECOND);
  }

  /** Keyboard (hold Space) or press-and-hold timing. Weaker, so capped lower. */
  acceptHold(now: number): 1 | RejectReason {
    return this.credit(now, STIR.MAX_HOLD_BITS_PER_SECOND);
  }

  /** Skip: fill the meter without crediting any client entropy. */
  fill(): void {
    this.credited = STIR.TARGET_BITS;
  }

  private credit(now: number, cap: number): 1 | RejectReason {
    if (now - this.windowStart >= 1000) {
      this.windowStart = now;
      this.windowBits = 0;
    }
    if (this.windowBits >= cap) return "rate-cap";
    this.windowBits++;
    this.credited++;
    return 1;
  }
}

/** Straight lines (no direction change) or perfectly steady strokes read as robotic. */
export function isTooRegular(angles: readonly number[], steps: readonly number[]): boolean {
  const deltas: number[] = [];
  for (let i = 1; i < angles.length; i++) {
    let d = angles[i]! - angles[i - 1]!;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    deltas.push(d);
  }
  const meanAbs = deltas.reduce((n, d) => n + Math.abs(d), 0) / deltas.length;
  if (meanAbs < STIR.MIN_DIRECTION_CHANGE) return true;

  // Constant curvature with a constant stride (a scripted circle) is also robotic.
  const variance = (xs: readonly number[]) => {
    const m = xs.reduce((n, x) => n + x, 0) / xs.length;
    return xs.reduce((n, x) => n + (x - m) ** 2, 0) / xs.length;
  };
  const meanStep = steps.reduce((n, s) => n + s, 0) / steps.length;
  const curvatureSteady = variance(deltas) < 1e-6;
  const strideSteady = variance(steps) < (meanStep * 0.01) ** 2;
  return curvatureSteady && strideSteady;
}
