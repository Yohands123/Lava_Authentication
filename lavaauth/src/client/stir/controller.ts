// Wires pointer / keyboard input to the wax and the entropy meter.

import type { LampPhysics } from "../lamp/physics";
import type { LampRenderer } from "../lamp/renderer";
import { STIR } from "../lamp/constants";
import { StirMeter } from "./health";
import { EntropyPool } from "./pool";

export interface StirCallbacks {
  onProgress(bits: number, progress: number): void;
  onTooRegular(): void;
}

export interface StirResult {
  /** 32-byte digest, or null when skipped. */
  digest: Uint8Array | null;
  skipped: boolean;
}

export class StirController {
  private meter = new StirMeter();
  private pool = new EntropyPool();
  private active = false;
  private last: { x: number; y: number; t: number } | null = null;
  private velocity = { x: 0, y: 0 };
  private pointerWorld: { x: number; y: number } | null = null;
  private holding = false;
  private holdAngle = 0;
  private lastHoldTime = 0;
  private resolve: ((r: StirResult) => void) | null = null;
  private skipping = false;

  constructor(
    private readonly renderer: LampRenderer,
    private readonly physics: LampPhysics,
    private readonly callbacks: StirCallbacks,
    private readonly reducedMotion: () => boolean,
  ) {}

  run(): Promise<StirResult> {
    this.meter = new StirMeter();
    this.pool.reset();
    this.active = true;
    this.skipping = false;
    this.last = null;
    document.body.classList.add("is-stirring");
    window.addEventListener("pointermove", this.onMove, { passive: true });
    window.addEventListener("pointerdown", this.onDown);
    window.addEventListener("pointerup", this.onUp);
    window.addEventListener("pointercancel", this.onUp);
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    this.callbacks.onProgress(0, 0);
    return new Promise((resolve) => (this.resolve = resolve));
  }

  /** Skip: fill the ring with a slow automatic swirl; no client entropy is sent. */
  skip(): void {
    if (!this.active) return;
    this.skipping = true;
  }

  cancel(): void {
    this.finish(null, true);
  }

  /** Called every physics step by the main loop. */
  update(dt: number): void {
    if (!this.active) return;
    const { width, height } = this.physics;

    if (this.skipping || this.holding) {
      // Automatic swirl around the centre (skip, Space, or reduced-motion hold).
      this.holdAngle += dt * (this.reducedMotion() ? 0.6 : 1.8);
      const r = Math.min(width, height) * 0.22;
      const x = width / 2 + Math.cos(this.holdAngle) * r;
      const y = height / 2 + Math.sin(this.holdAngle) * r;
      const v = this.reducedMotion() ? 0.2 : 0.9;
      this.physics.stir(x, y, -Math.sin(this.holdAngle) * v, Math.cos(this.holdAngle) * v, dt);
      if (this.skipping) {
        this.meter.credited = Math.min(STIR.TARGET_BITS, this.meter.credited + STIR.TARGET_BITS * dt * 0.6);
        this.report();
      } else {
        this.holdSample();
      }
    } else if (this.pointerWorld) {
      this.physics.stir(this.pointerWorld.x, this.pointerWorld.y, this.velocity.x, this.velocity.y, dt);
      this.velocity.x *= Math.exp(-8 * dt);
      this.velocity.y *= Math.exp(-8 * dt);
    }

    if (this.meter.complete) {
      void this.complete();
    }
  }

  private onMove = (e: PointerEvent) => {
    if (!this.active || this.skipping) return;
    const samples = typeof e.getCoalescedEvents === "function" ? e.getCoalescedEvents() : [];
    for (const s of samples.length ? samples : [e]) this.sample(s, e.isTrusted);
  };

  private sample(e: PointerEvent, trusted: boolean): void {
    const t = e.timeStamp;
    const world = this.renderer.toWorld(e.clientX, e.clientY);
    if (this.last) {
      const dtMs = t - this.last.t;
      const dx = e.clientX - this.last.x;
      const dy = e.clientY - this.last.y;
      const result = this.meter.accept(
        { dx, dy, dt: dtMs, pressure: e.pressure, tiltX: e.tiltX, tiltY: e.tiltY, trusted },
        performance.now(),
      );
      if (trusted && !(dx === 0 && dy === 0)) {
        this.pool.add([dx, dy, dtMs, e.pressure, e.tiltX, e.tiltY]);
      }
      if (result === "too-regular" && this.meter.regularStreak === 24) this.callbacks.onTooRegular();
      if (dtMs > 0 && this.pointerWorld) {
        const s = 1000 / Math.max(dtMs, 4);
        const k = 0.35;
        this.velocity.x += ((world.x - this.pointerWorld.x) * s - this.velocity.x) * k;
        this.velocity.y += ((world.y - this.pointerWorld.y) * s - this.velocity.y) * k;
      }
      this.report();
    }
    this.last = { x: e.clientX, y: e.clientY, t };
    this.pointerWorld = world;
  }

  private onDown = (e: PointerEvent) => {
    if (this.reducedMotion() && e.isTrusted && !(e.target instanceof HTMLButtonElement)) this.holding = true;
  };

  private onUp = () => {
    if (this.reducedMotion()) this.holding = false;
  };

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.code !== "Space" || !e.isTrusted) return;
    if (e.target instanceof HTMLButtonElement || e.target instanceof HTMLInputElement) return;
    e.preventDefault();
    this.holding = true;
  };

  private onKeyUp = (e: KeyboardEvent) => {
    if (e.code === "Space") this.holding = false;
  };

  /** Timing-only sample while holding. Weak source, so the meter caps it lower. */
  private holdSample(): void {
    const now = performance.now();
    this.pool.add([now - this.lastHoldTime, 0, 0, 0, 0, 0]);
    this.lastHoldTime = now;
    this.meter.acceptHold(now);
    this.report();
  }

  private report(): void {
    this.callbacks.onProgress(Math.floor(this.meter.credited), this.meter.progress);
  }

  private async complete(): Promise<void> {
    if (!this.active) return;
    this.active = false;
    const digest = this.skipping ? null : await this.pool.digest();
    this.finish(digest, this.skipping);
  }

  private finish(digest: Uint8Array | null, skipped: boolean): void {
    this.active = false;
    this.holding = false;
    this.pointerWorld = null;
    document.body.classList.remove("is-stirring");
    window.removeEventListener("pointermove", this.onMove);
    window.removeEventListener("pointerdown", this.onDown);
    window.removeEventListener("pointerup", this.onUp);
    window.removeEventListener("pointercancel", this.onUp);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    this.pool.reset();
    const resolve = this.resolve;
    this.resolve = null;
    resolve?.({ digest, skipped });
  }
}
