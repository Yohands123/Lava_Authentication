// Owns the render loop: fixed-timestep physics, eased visual state, pause,
// tab-visibility pause, and adaptive resolution.

import { LAMP, STIR } from "./constants";
import { LampPhysics } from "./physics";
import { LampRenderer, isMobile } from "./renderer";

const STEP = 1 / 60;

export class Lamp {
  readonly renderer: LampRenderer;
  readonly physics: LampPhysics;
  /** Called once per physics step with the step length. */
  onStep: ((dt: number) => void) | null = null;
  /** Called after each rendered frame (snapshots read pixels here). */
  onFrame: (() => void) | null = null;

  freeze = 0;
  private glow = 0;
  glowTarget = 0;
  private dim = 0;
  dimTarget = 0;
  /** Per-second easing for dim; lower for slow dims (rate limiting). */
  dimEase = LAMP.VISUAL_EASE;
  // The ring mask eases in and out; the last ring is kept while it fades away.
  private ring = { cx: 0, cy: 0, radius: 0 };
  private ringAmount = 0;
  private paused = false;
  private time = 0;
  private last = 0;
  private acc = 0;
  private slowSince = 0;
  private raf = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new LampRenderer(canvas);
    this.physics = new LampPhysics(isMobile() ? LAMP.COUNT_MOBILE : LAMP.COUNT_DESKTOP);
    this.syncSize();
    window.addEventListener("resize", () => {
      this.renderer.resize();
      this.syncSize();
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) cancelAnimationFrame(this.raf);
      else this.start();
    });
  }

  start(): void {
    cancelAnimationFrame(this.raf);
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
  }

  get isPaused(): boolean {
    return this.paused;
  }

  private syncSize(): void {
    const { width, height } = this.renderer.worldSize;
    this.physics.resize(width, height);
  }

  private frame = (now: number) => {
    const frameMs = now - this.last;
    const dt = Math.min(frameMs / 1000, 0.1);
    this.last = now;

    if (!this.paused) {
      this.acc += dt;
      let steps = 0;
      while (this.acc >= STEP && steps < 5) {
        this.physics.step(STEP);
        this.onStep?.(STEP);
        this.acc -= STEP;
        steps++;
      }
      this.time += dt * this.physics.speed;
    }

    // Ease visual state slowly; nothing snaps.
    this.glow += (this.glowTarget - this.glow) * (1 - Math.exp(-dt * LAMP.VISUAL_EASE));
    this.dim += (this.dimTarget - this.dim) * (1 - Math.exp(-dt * this.dimEase));
    const ring = this.physics.ring;
    if (ring) this.ring = { cx: ring.cx, cy: ring.cy, radius: ring.radius };
    const ringOn = ring?.phase === "clear" ? 1 : 0;
    this.ringAmount += (ringOn - this.ringAmount) * (1 - Math.exp(-dt * STIR.RING_PUSH_RATE));

    this.renderer.render(this.physics.blobs, {
      time: this.time, freeze: this.freeze, glow: this.glow, dim: this.dim, ring: this.ring, ringAmount: this.ringAmount,
      isOut: (b) => ring?.isOut(b) ?? false,
    });
    this.onFrame?.();
    this.adapt(frameMs, now);
    this.raf = requestAnimationFrame(this.frame);
  };

  /** Drop resolution if frames take over 20 ms for 2 seconds. */
  private adapt(frameMs: number, now: number): void {
    if (frameMs > 20 && frameMs < 200) {
      if (!this.slowSince) this.slowSince = now;
      if (now - this.slowSince > 2000 && this.renderer.resolutionScale > LAMP.RESOLUTION_SCALE_MIN) {
        this.renderer.setResolutionScale(this.renderer.resolutionScale - 0.1);
        this.syncSize();
        this.slowSince = 0;
      }
    } else {
      this.slowSince = 0;
    }
  }
}
